#!/usr/bin/env python3
"""Smoke test: opens dist/test.html in headless Chromium and exercises the main features.

Requires `npm install` (three.js in node_modules), `python3 build.py --local`, and Playwright for Python.
Screenshots go to tests/out/.
"""
import functools, http.server, os, socketserver, sys, threading
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'out')
os.makedirs(OUT, exist_ok=True)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
Handler = functools.partial(Quiet, directory=ROOT)
srv = socketserver.TCPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/dist/test.html'

failures = []
def check(name, cond, detail=''):
    print(('OK   ' if cond else 'FAIL ') + name + (f'  ({detail})' if detail else ''))
    if not cond: failures.append(name)

with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 1400, 'height': 860})
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(2500)
    E = 'window.__etabli'

    check('galerie ouverte à la première visite', pg.is_visible('#gallery'))
    pg.click('#galleryClose')
    n = pg.evaluate(f'()=>[{E}.state.parts.length,{E}.state.joints.length,document.documentElement.dataset.level]')
    check('démarrage : maison, niveau débutant', n == [4, 0, '1'], n)
    check('débutant : pas d’esquisse ni de Mécanique', not pg.is_visible('#bSketch') and not pg.is_visible('#simbar') and not pg.is_visible('#steps [data-wsk="mech"]'))
    pg.click('#lvl [data-lvl="2"]'); pg.wait_for_timeout(200)
    check('intermédiaire : esquisse, Mécanique et Structures visibles', pg.is_visible('#bSketch') and pg.is_visible('#steps [data-wsk="mech"]') and pg.is_visible('#steps [data-wsk="struct"]') and not pg.is_visible('#bTree'))
    pg.click('#lvl [data-lvl="3"]'); pg.wait_for_timeout(300)
    check('avancé : arborescence visible', pg.is_visible('#outliner') and pg.locator('#treeBody .tr').count() == 4)
    pg.locator('#treeBody .tr').nth(0).locator('.tr-btn').nth(0).click(); pg.wait_for_timeout(200)
    check('arborescence : masquer une pièce', pg.evaluate(f'()=>{E}.state.parts[0].hidden===true && ![...{E}.meshes.values()][0].mesh.visible'))
    pg.locator('#treeBody .tr').nth(0).locator('.tr-btn').nth(0).click()

    pg.evaluate(f"()=>{E}.loadExample('gears')"); pg.wait_for_timeout(500)
    pg.click('#sPlay'); pg.wait_for_timeout(1500)
    v = pg.evaluate(f'()=>{E}.state.joints.map(j=>j.id).map(id=>{E}.sim.values[id]||0)')
    check('le moteur fait tourner la roue', abs(v[0]) > 1, v)
    pg.screenshot(path=os.path.join(OUT, 'simulation.png'))
    pg.click('#sReset')

    pg.click('#bNew')
    for k in ['box','cylinder','sphere','cone','pyramid','wedge','tube','torus','text','gear','rack']:
        pg.evaluate(f"()=>{E}.addPart('{k}')")
    check('11 volumes ajoutés', pg.evaluate(f'()=>{E}.state.parts.length') == 11)
    pg.screenshot(path=os.path.join(OUT, 'volumes.png'))

    pg.click('#bNew')
    g = pg.evaluate(f"""()=>{{const E={E}; const a=E.addPart('box'); const c=E.addPart('cylinder',[0,0],{{hole:true}});
        c.params.d=10; c.params.h=30; c.pos=[0,0,-5]; E.setSel([a.id,c.id]); E.groupSel();
        const G=E.state.parts[0]; return [E.state.parts.length, G.kind, E.getGeometry(G).attributes.position.count/3]}}""")
    check('groupe avec perçage (CSG)', g[0] == 1 and g[1] == 'group' and g[2] > 100, g)

    stl = pg.evaluate(f'()=>{E}.stlBinary([...{E}.meshes.values()]).length')
    check('export STL', stl > 84, f'{stl} octets')

    for ex in pg.evaluate(f'()=>Object.keys({E}.SAMPLES)'):
        pg.evaluate(f"()=>{E}.loadExample('{ex}')"); pg.wait_for_timeout(500)
        r = pg.evaluate(f'''()=>{{const E={E}; const struct=E.SAMPLES['{ex}'].cat==='struct';
            const sk=E.state.parts.filter(p=>p.kind==='sketch').map(p=>{{const s=E.SK.d; E.SK.d=JSON.parse(JSON.stringify(p.params.sk)); const e=E.skSolve(); E.SK.d=s; return e;}});
            const R= struct? (E.SD().mod==='treillis'? E.ST.res : E.ST.mres) : null;
            return {{struct, ws:E.ws(), parts:E.state.parts.length, motors:E.state.joints.filter(j=>j.motor).length, note:!!E.state.note, skErr:Math.max(0,...sk), res: R? R.ok : null}}}}''')
        ok = r['note'] and r['skErr'] < 1e-3 and ((r['struct'] and r['res'] and r['ws']=='struct') or (not r['struct'] and r['parts'] > 0))
        if r['motors']:
            ok = ok and r['ws']=='mech'
            pg.click('#sPlay'); pg.wait_for_timeout(800); pg.click('#sPlay')
            ok = ok and pg.evaluate(f'()=>Object.values({E}.sim.values).some(v=>Math.abs(v)>0.5)')
            pg.click('#sReset')
        check(f'exemple {ex}', ok, r)
        pg.screenshot(path=os.path.join(OUT, f'exemple-{ex}.png'))

    # Sketch: rectangle + dimension typed in the field
    pg.click('#bNew'); pg.click('#bSketch'); pg.wait_for_timeout(300)
    bb = pg.locator('#skCanvas').bounding_box()
    def w2s(x, y):
        v = pg.evaluate(f"()=>{{const S={E}.SK, c=document.getElementById('skCanvas').getBoundingClientRect();"
                        f" return [c.width/2+({x}-S.view.cx)*S.view.s, c.height/2-({y}-S.view.cy)*S.view.s]}}")
        return bb['x'] + v[0], bb['y'] + v[1]
    pg.click('[data-tool=rect]')
    pg.mouse.click(*w2s(0, 0)); pg.mouse.click(*w2s(36, 22))
    pg.click('[data-tool=dim]'); pg.mouse.click(*w2s(18, 0)); pg.wait_for_timeout(100)
    pg.keyboard.type('40'); pg.keyboard.press('Enter')
    w = pg.evaluate(f'()=>Math.max(...{E}.SK.d.pts.map(p=>p.x))')
    check('cote imposée à 40 mm', abs(w - 40) < 0.01, w)
    pg.screenshot(path=os.path.join(OUT, 'esquisse.png'))
    pg.click('#skOk'); pg.wait_for_timeout(400)
    check('esquisse extrudée', pg.evaluate(f"()=>{E}.state.parts.some(p=>p.kind==='sketch')"))

    # Bézier: a straight base closed by one curve
    pg.evaluate(f'()=>{E}.openSketch(null)'); pg.wait_for_timeout(300)
    bb = pg.locator('#skCanvas').bounding_box()
    pg.click('[data-tool=line]'); pg.mouse.click(*w2s(0, 0)); pg.mouse.click(*w2s(30, 0)); pg.keyboard.press('Escape')
    pg.click('[data-tool=bezier]'); pg.mouse.click(*w2s(30, 0)); pg.mouse.click(*w2s(0, 0)); pg.mouse.click(*w2s(15, 18))
    r = pg.evaluate(f'()=>{{const d={E}.SK.d; return [d.beziers.length, {E}.skProfiles(d).loops.length]}}')
    check('courbe de Bézier fermant un contour', r == [1, 1], r)
    pg.screenshot(path=os.path.join(OUT, 'bezier.png'))
    pg.click('#skOk'); pg.wait_for_timeout(300)
    for k in ['coeur', 'vase']:
        pg.evaluate(f"()=>{E}.loadExample('{k}')"); pg.wait_for_timeout(300)
        n = pg.evaluate(f'()=>{E}.getGeometry({E}.state.parts[0]).attributes.position.count')
        check(f'volume Bézier ({k})', n > 500, n)

    # Valider -> Mécanique : gate, repères, liaison accrochée à un repère
    pg.evaluate(f"()=>{E}.setWs('model')"); pg.click('#bNew'); pg.wait_for_timeout(200)
    pg.evaluate(f"()=>{{const E={E}; const a=E.addPart('box',[0,0]); a.params.L=60; a.params.l=40; a.params.h=6; const c=E.addPart('cylinder',[20,0]); c.pos=[20,0,6];}}")
    pg.click('#steps [data-wsk="mech"]'); pg.wait_for_timeout(300)
    check('Mécanique verrouillée avant validation', pg.evaluate(f'()=>!{E}.mechReady()') and pg.locator('text=Avant de simuler').count() == 1)
    pg.click('#inspBody .btn.primary'); pg.wait_for_timeout(500)
    r = pg.evaluate(f"()=>{E}.state.parts.map(p=>[{E}.vState(p), (p.locs||[]).map(l=>l.id)])")
    check('validation : statut et repères', all(s in ('ok','warn') for s,_ in r) and 'axe' in r[1][1], r)
    pg.click('text=Ajouter une liaison'); pg.wait_for_timeout(300)
    pg.click('text=Créer la liaison'); pg.wait_for_timeout(300)
    j = pg.evaluate(f"()=>{E}.state.joints[0]")
    check('liaison accrochée au repère « axe »', j and j['loc'] and j['loc']['lid']=='axe', j and j.get('loc'))
    pg.evaluate(f"()=>{{const p={E}.state.parts[1]; p.params.d=30;}}")
    check('pièce modifiée = à revalider', pg.evaluate(f"()=>{E}.vState({E}.state.parts[1])") == 'stale')
    big = pg.evaluate(f"()=>{{const E={E}; const g=E.getGeometry({{kind:'sphere',params:{{d:20,seg:96}}}}); const p=E.makeProxy(g); return [(g.index?g.index.count:g.attributes.position.count)/3, p.attributes.position.count/3];}}")
    check('proxy basse résolution', big[1] < big[0]/3 and big[1] <= 1300, big)

    # Structures : résultats physiques
    pg.evaluate(f"()=>{E}.loadExample('plongeoir')"); pg.wait_for_timeout(400)
    r = pg.evaluate(f"()=>{{const E={E}; return [E.ST.mres.umax, E.beamTheory(E.SD().mesh).f]}}")
    check('plongeoir : flèche proche du calcul RDM', abs(r[0]-r[1])/r[1] < 0.15, r)
    pg.evaluate(f"()=>{E}.loadExample('pontSuspendu')"); pg.wait_for_timeout(300)
    check('pont suspendu stable et câbles tendus', pg.evaluate(f"()=>{{const R={E}.ST.res; return R.ok && R.slack===0}}"))
    pg.evaluate(f"()=>{{const E={E}; const T=E.SD().truss; T.nodes=[]; T.bars=[]; T.sec='plein'; T.D=6; T.mat='bois'; E.ST.fitted=false; E.setWs('struct');}}"); pg.wait_for_timeout(300)
    pg.click('#stTools [data-st="bar"]')
    bb = pg.locator('#stCanvas').bounding_box()
    def s2s(x, y):
        v = pg.evaluate(f"()=>{{const S={E}.ST, c=document.getElementById('stCanvas').getBoundingClientRect(); return [c.width/2+({x}-S.view.cx)*S.view.s, c.height/2-({y}-S.view.cy)*S.view.s]}}")
        return bb['x']+v[0], bb['y']+v[1]
    for xy in [(0,0),(100,0),(50,80),(0,0)]: pg.mouse.click(*s2s(*xy))
    pg.keyboard.press('Escape')
    pg.click('#stTools [data-st="fixe"]'); pg.mouse.click(*s2s(0,0))
    pg.click('#stTools [data-st="glissant"]'); pg.mouse.click(*s2s(100,0))
    pg.click('#stTools [data-st="charge"]'); pg.mouse.click(*s2s(50,80))
    r = pg.evaluate(f"()=>{{const R={E}.ST.res; return [R.ok, R.ok && Math.round(R.worst.N)]}}")
    check('treillis tracé à la souris et calculé', r[0] and r[1] < 0, r)
    pg.screenshot(path=os.path.join(OUT, 'treillis.png'))
    pg.click('#stTools [data-v3="1"]'); pg.wait_for_timeout(400)
    check('aperçu 3D du treillis', pg.evaluate(f"()=>{E}.ST.mode3d") and pg.is_hidden('#stCanvas'))
    pg.click('#stTools [data-v3="0"]')

    check('aucune erreur JavaScript', not errors, errors[:3])
    b.close()

srv.shutdown()
print('\n' + ('TOUT EST OK' if not failures else f'{len(failures)} ÉCHEC(S)'))
sys.exit(1 if failures else 0)
