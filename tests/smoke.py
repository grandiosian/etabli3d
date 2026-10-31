#!/usr/bin/env python3
"""Tests de bout en bout : ouvrent dist/test.html dans Chromium sans écran et exercent l'application.

Les tests sont rangés par domaine dans tests/domaines/ ; chaque domaine part d'une page neuve
(localStorage vide), on peut donc en lancer un seul :

  python3 tests/smoke.py                   tous les domaines (c'est ce que fait `npm test`)
  python3 tests/smoke.py panneaux          un domaine (le nom, ou le début du nom)
  python3 tests/smoke.py esquisse rendu    plusieurs domaines
  python3 tests/smoke.py --liste           la liste des domaines

Il faut d'abord `npm install`, Playwright pour Python et `python3 build.py --local`
(`npm test -- panneaux` fait le build puis lance seulement ce domaine). Captures dans tests/out/.
"""
import glob, importlib.util, os, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from commun import CHROMIUM_ARGS, OUT, ROOT, Ctx, start_server

DOSSIER = os.path.join(ROOT, 'tests', 'domaines')


def domaines():
    """[(nom, chemin)] dans l'ordre des fichiers (01_demarrage.py → 'demarrage')."""
    out = []
    for f in sorted(glob.glob(os.path.join(DOSSIER, '[0-9][0-9]_*.py'))):
        out.append((os.path.basename(f)[3:-3], f))
    return out


def charger(nom, chemin):
    spec = importlib.util.spec_from_file_location('domaine_' + nom, chemin)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main(args):
    tous = domaines()
    if '--liste' in args:
        for nom, f in tous:
            print(f'{nom:14s} {charger(nom, f).__doc__.strip()}')
        return 0
    choix = tous
    if args:
        choix = [d for d in tous if any(d[0].startswith(a) for a in args)]
        inconnus = [a for a in args if not any(d[0].startswith(a) for d in tous)]
        if inconnus or not choix:
            print('Domaine inconnu : ' + ', '.join(inconnus or args) + '\nDomaines : ' + ', '.join(n for n, _ in tous))
            return 2
    if not os.path.exists(os.path.join(ROOT, 'dist', 'test.html')):
        print('dist/test.html manquant : lancez d’abord  python3 build.py --local')
        return 2
    os.makedirs(OUT, exist_ok=True)

    from playwright.sync_api import sync_playwright
    srv, url = start_server()
    failures, durees = [], []
    t0 = time.time()
    with sync_playwright() as p:
        browser = p.chromium.launch(args=CHROMIUM_ARGS)
        for nom, f in choix:
            mod = charger(nom, f)
            print(f'\n== {nom} — {mod.__doc__.strip()}', flush=True)
            d0 = time.time()
            t = Ctx(browser, url, failures, prefix='' if len(choix) == 1 else f'[{nom}] ')
            try:
                if getattr(mod, 'PAGE', True):
                    t.open(level=getattr(mod, 'NIVEAU', 3), close_gallery=not getattr(mod, 'GALERIE', False))
                mod.run(t)
            except Exception as e:   # un domaine qui plante n'empêche pas les suivants
                t.check('le domaine va jusqu’au bout', False, f'{type(e).__name__}: {str(e).splitlines()[0][:300]}')
            finally:
                t.close()
            durees.append((nom, time.time() - d0))
        browser.close()
    srv.shutdown()

    if len(choix) > 1:
        print('\nDurées : ' + ', '.join(f'{n} {d:.0f} s' for n, d in durees))
    print(f'\nTemps total : {time.time() - t0:.0f} s')
    print('\n' + ('TOUT EST OK' if not failures else f'{len(failures)} ÉCHEC(S) :\n  ' + '\n  '.join(failures)))
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
