"""Passerelle avec la Centrale (fausse Centrale de tests/centrale/)."""
import os

NIVEAU = 3
PAGE = False   # ouvre ses propres contextes avec une fausse Centrale


def run(t):
    pg, check, E, OUT, URL, b, errors = t.pg, t.check, t.E, t.OUT, t.URL, t.browser, t.errors
    # Passerelle avec la Centrale : une fausse Centrale (tests/centrale/) répond comme le vrai module
    base = URL.split('/dist/')[0]
    depart = {'app': 'etabli3d', 'version': 2, 'name': 'Support de départ', 'nextId': 2, 'joints': [],
              'parts': [{'id': 1, 'kind': 'box', 'name': 'Socle', 'params': {'L': 60, 'l': 40, 'h': 5}, 'color': '#4aa36b', 'hole': False, 'pos': [0, 0, 0], 'rot': [0, 0, 0]}]}
    serveur = {'app': 'etabli3d', 'version': 2, 'name': 'Porte-crayon', 'nextId': 4, 'joints': [],
               'parts': [{'id': 1, 'kind': 'group', 'name': 'Porte-crayon', 'color': '#c8955a', 'mat': {'k': 'bois'}, 'hole': False, 'pos': [0, 0, 0], 'rot': [0, 0, 0], 'params': {}, 'children': [
                   {'id': 2, 'kind': 'cylinder', 'name': 'Corps', 'params': {'d': 60, 'h': 90, 'seg': 64}, 'color': '#c8955a', 'hole': False, 'pos': [0, 0, 0], 'rot': [0, 0, 0]},
                   {'id': 3, 'kind': 'cylinder', 'name': 'Creux', 'params': {'d': 52, 'h': 90, 'seg': 64}, 'color': '#7b8985', 'hole': True, 'pos': [0, 0, 4], 'rot': [0, 0, 0]}]}]}
    cfg = {'activite': 'ex-de', 'progressions': {'tuto-premiers': {'faites': 3, 'total': 6, 'statut': 'commence'}, 'exo-de': {'faites': 3, 'total': 3, 'statut': 'termine'}},
           'projet': serveur, 'atelier': {'titre': 'Fabriquer le support', 'entrees': ['depart.json'], 'sorties': ['projet.etabli3d.json', 'piece.stl', 'apercu.png', 'resume.json']},
           'fichiers': {'depart.json': depart}}
    import json as _json
    ctx = b.new_context(viewport={'width': 1400, 'height': 860})
    ctx.add_init_script(f"window.CENTRALE_URL='{base}/tests/centrale/'; window.__CZ_TEST={_json.dumps(cfg)};")
    cz = ctx.new_page(); cz.on('pageerror', lambda e: errors.append('centrale: ' + str(e)))
    cz.goto(URL); cz.wait_for_timeout(2500); cz.click('#galleryClose')
    r = cz.evaluate("()=>[__cz.init.app, __cz.init.activites.length, Etabli3D.activites().length, document.querySelector('#bCentrale').textContent.trim()]")
    cz.click('#bCentrale'); cz.wait_for_timeout(200); cz.click('#czFaux'); cz.wait_for_timeout(1500)
    r2 = cz.evaluate("""()=>{const E=window.__etabli; return [document.querySelector('#bCentrale').textContent.trim(), !!E.PROG.done['exo:de'], E.PROG.part.premiers, E.state.note && E.state.note.key,
      __cz.progres.some(([id,p])=>id==='ex-de' && p.faites===0 && p.statut==='commence'), __cz.sauve.some(([k,v])=>k==='projet' && v.app==='etabli3d'), Etabli3D.progression('exo-de').statut]}""")
    # Annuler : exemple demandé → fichier de l'étape (ouvert à l'arrivée) → projet du serveur
    cz.keyboard.press('Control+z'); cz.wait_for_timeout(300)
    r3a = cz.evaluate("()=>window.__etabli.state.name")
    cz.keyboard.press('Control+z'); cz.wait_for_timeout(300)
    r3 = [r3a] + cz.evaluate("()=>[window.__etabli.state.name, window.__etabli.state.parts[0].mat && window.__etabli.state.parts[0].mat.k]")
    n0 = cz.evaluate("()=>__cz.sauve.length")
    cz.click('#bFile'); cz.locator('#menuFile .cz-item', has_text='Reprendre').click(); cz.wait_for_timeout(600)
    r4 = cz.evaluate("()=>[window.__etabli.state.name, __cz.sauve.length]")
    cz.click('#bFile'); cz.locator('#menuFile .cz-item', has_text='Déposer').click(); cz.wait_for_timeout(1500)
    cz.click('#bFile'); cz.locator('#menuFile .cz-item', has_text='STL').click(); cz.wait_for_timeout(600)
    r5 = cz.evaluate("()=>[__cz.depots.map(d=>d.nom+':'+d.type+':'+(d.taille>0)).join(' '), __cz.fichiers.map(f=>f.nom.endsWith('.stl')+':'+f.type).join(' ')]")
    check('Centrale : déclaration des activités, bouton « Mon code », progression fusionnée, projet du serveur (Annuler revient), activité demandée, sauvegarde',
          r == ['etabli3d', 39, 39, 'Mon code'] and r2 == ['5A · 07', True, 3, 'de', True, True, 'termine'] and r3 == ['Support de départ', 'Porte-crayon', 'bois'], [r, r2, r3])
    check('Centrale : fichier de l’atelier repris, dépôt des sorties (projet, STL, aperçu, résumé), STL envoyé au professeur',
          r4[0] == 'Support de départ' and r4[1] > n0 and r5 == ['projet.etabli3d.json:application/json:true resume.json:application/json:true piece.stl:model/stl:true apercu.png:image/png:true', 'true:model/stl'], [r4, n0, r5])
    ver = ctx.new_page(); ver.goto(base + '/dist/outils/verifier-descripteur.html?app=../test.html'); ver.wait_for_function("()=>document.body.dataset.resultat", timeout=30000)
    vr = ver.evaluate("()=>[document.body.dataset.resultat, [...document.querySelectorAll('#res li.ko')].map(l=>l.textContent)]")
    check('centrale.json correspond à l’application (outils/verifier-descripteur.html)', vr[0] == 'ok', vr)
    ctx.close()

    # Ouvert depuis le portail, dans une étape de parcours : le module retire le jeton (#centrale=…) dès init()
    depose = dict(depart, name='Support déposé')
    for cas, dossier, donnees, attendu in [
            ('rien de déposé', [], [], 'Support de départ'),
            ('dépôt plus récent que le projet', [{'nom': 'support.json', 'fourni': False, 'maj': 2000}], [{'cle': 'projet', 'maj': 1000}], 'Support déposé'),
            ('projet modifié après le dépôt', [{'nom': 'support.json', 'fourni': False, 'maj': 1000}], [{'cle': 'projet', 'maj': 2000}], 'Porte-crayon')]:
        cfg2 = {'projet': serveur, 'donnees': donnees, 'dossier': dossier, 'fichiers': {'depart.json': depart, **({'support.json': depose} if dossier else {})},
                'atelier': {'titre': 'Modéliser le support', 'entrees': ['depart.json'], 'sorties': ['support.json', 'support.stl']}}
        ctx = b.new_context(viewport={'width': 1400, 'height': 860})
        ctx.add_init_script(f"window.CENTRALE_URL='{base}/tests/centrale/'; window.__CZ_TEST={_json.dumps(cfg2)};")
        cz = ctx.new_page(); cz.on('pageerror', lambda e: errors.append('centrale: ' + str(e)))
        cz.goto(URL + '#centrale=jeton-essai&parcours=1&etape=0'); cz.wait_for_timeout(3000)
        r = cz.evaluate("()=>[document.querySelector('#bCentrale').textContent.trim(), location.hash.includes('centrale='), window.__etabli.state.name, typeof __cz.init.avantDeQuitter]")
        if cas == 'rien de déposé':
            check('Centrale : ouvert depuis le portail (#centrale=…), connexion automatique et fichier reçu par l’étape ouvert',
                  r == ['5A · 07', False, attendu, 'function'], r)
            cz.evaluate("()=>__cz.init.avantDeQuitter()"); cz.wait_for_timeout(300)
            d1 = cz.evaluate("()=>__cz.depots.map(d=>d.nom+':'+d.type+':'+(d.taille>0)).join(' ')")
            cz.evaluate("()=>__cz.init.avantDeQuitter()"); cz.wait_for_timeout(300)
            n1 = cz.evaluate("()=>__cz.depots.length")
            cz.evaluate(f"()=>{E}.addPart('box',[80,0]) && 1"); cz.wait_for_timeout(300)
            cz.evaluate("()=>__cz.init.avantDeQuitter()"); cz.wait_for_timeout(300)
            n2 = cz.evaluate("()=>__cz.depots.length")
            check('Centrale : avant « Étape suivante », les sorties de l’étape sont déposées (une seule fois tant que rien ne change)',
                  d1 == 'support.json:application/json:true support.stl:model/stl:true' and n1 == 2 and n2 == 4, [d1, n1, n2])
        else:
            check(f'Centrale : arrivée dans l’étape, {cas} → « {attendu} »', r[0] == '5A · 07' and r[2] == attendu, r)
        ctx.close()
