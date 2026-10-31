"""Outils partagés par les tests de bout en bout (tests/domaines/*.py).

Chaque domaine reçoit un objet `t` :
  t.pg      page Playwright déjà ouverte sur l'application (contexte neuf : localStorage vide)
  t.check   check(nom, condition, détail)
  t.E       'window.__etabli' (point d'accès aux fonctions de l'application)
  t.OUT     dossier des captures (tests/out/)
  t.URL     adresse de dist/test.html
  t.browser navigateur, pour ouvrir d'autres contextes (Centrale)
  t.errors  erreurs JavaScript relevées (vérifiées à la fin de chaque domaine)
"""
import functools, http.server, os, socketserver, threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'out')
E = 'window.__etabli'
VIEWPORT = {'width': 1400, 'height': 860}
CHROMIUM_ARGS = ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass


def start_server():
    """Sert la racine du dépôt sur un port libre ; renvoie (serveur, URL de dist/test.html)."""
    handler = functools.partial(_Quiet, directory=ROOT)
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), handler)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f'http://127.0.0.1:{srv.server_address[1]}/dist/test.html'


def wait_ready(pg, timeout=30000):
    """Attend que l'application soit démarrée (au lieu d'une pause fixe)."""
    pg.wait_for_function(f"()=>{E} && {E}.state && document.querySelector('#stage canvas.gl')", timeout=timeout)
    pg.wait_for_timeout(300)


class Ctx:
    def __init__(self, browser, url, failures, prefix=''):
        self.browser, self.URL, self.E, self.OUT = browser, url, E, OUT
        self.failures, self.prefix, self.errors = failures, prefix, []
        self.context = self.pg = None

    def check(self, name, cond, detail=''):
        print(('OK   ' if cond else 'FAIL ') + self.prefix + name + (f'  ({detail})' if detail else ''), flush=True)
        if not cond:
            self.failures.append(self.prefix + name)

    def open(self, level=3, close_gallery=True):
        """Ouvre l'application dans un contexte neuf, ferme la bibliothèque et choisit le niveau."""
        self.context = self.browser.new_context(viewport=VIEWPORT)
        self.pg = self.context.new_page()
        self.pg.on('pageerror', lambda e: self.errors.append(str(e)))
        self.pg.goto(self.URL)
        wait_ready(self.pg)
        if close_gallery:
            if self.pg.is_visible('#gallery'):
                self.pg.click('#galleryClose')
            if level != 1:
                self.pg.click(f'#lvl [data-lvl="{level}"]')
                self.pg.wait_for_timeout(300)
        return self.pg

    def close(self):
        self.check('aucune erreur JavaScript', not self.errors, self.errors[:3])
        if self.context:
            self.context.close()
