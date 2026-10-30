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
    check('débutant : pas d’esquisse, bouton « Vérifier pour l’impression »', not pg.is_visible('#bSketch') and not pg.is_visible('#simbar') and 'impression' in pg.inner_text('#flow [data-go="check"]'))
    pg.click('#lvl [data-lvl="2"]'); pg.wait_for_timeout(200)
    check('intermédiaire : esquisse et bouton « Valider pour simulation »', pg.is_visible('#bSketch') and 'simulation' in pg.inner_text('#flow [data-go="check"]') and not pg.is_visible('#bTree'))
    check('intermédiaire : outil Bézier disponible', pg.is_visible('#rack [data-sktool="bezier"]'))
    r = pg.evaluate("()=>{const k=[...document.querySelectorAll('#rack [data-sktool]')].map(e=>e.getBoundingClientRect()), v=[...document.querySelectorAll('#rackBasic .shape')].map(e=>e.getBoundingClientRect()), rk=document.querySelector('#rack').getBoundingClientRect(); return [k.length, Math.min(...k.map(b=>b.left)) > Math.max(...v.map(b=>b.right)), rk.right-Math.max(...k.map(b=>b.right)) < 60]}")
    check('icônes de création d’esquisse à droite de la barre', r == [5, True, True], r)
    pg.click('#lvl [data-lvl="3"]'); pg.wait_for_timeout(300)
    check('avancé : arborescence visible', pg.is_visible('#outliner') and pg.locator('#treeBody .tr').count() == 4)
    r = pg.evaluate("()=>{const o=document.querySelector('#outliner').getBoundingClientRect(), s=document.querySelector('#stage').getBoundingClientRect(), i=document.querySelector('#insp').getBoundingClientRect(), v=document.querySelector('#views').getBoundingClientRect(); return [o.left<=1 && o.right<=s.left+1, i.right>s.right-40 && i.top>=v.bottom-2]}")
    check('arborescence à gauche, propriétés à droite sous le cube de vue', r == [True, True], r)
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
    check('clic sur Esquisse : choix du plan (3 plans dans la vue)', pg.is_visible('#planePick') and pg.is_hidden('#sk') and pg.evaluate(f"()=>{E}.PP.open && {E}.PP.group.visible && {E}.PP.group.children.length===3"))
    pg.click('#planePick [data-plane="xy"]'); pg.wait_for_timeout(300)
    check('plan XY choisi : l’éditeur s’ouvre', pg.is_visible('#sk') and pg.is_hidden('#planePick') and pg.evaluate(f"()=>{E}.SK.plane")=='xy')
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
    check('esquisse extrudée', pg.evaluate(f"()=>{E}.state.parts.some(p=>p.kind==='sketch' && p.params.plane==='xy')"))
    # Plan de face (XZ) choisi en cliquant dans la vue 3D : la pièce est debout
    pg.click('#bNew'); pg.click('#rack [data-sktool="circle"]'); pg.wait_for_timeout(700)
    pt = pg.evaluate(f"()=>{{const E={E}; const m=E.PP.meshes.xz; const v=new E.camera.position.constructor(0.3,0.75,0).applyMatrix4(m.matrix); const r=E.renderer.domElement.getBoundingClientRect(); v.project(E.camera); return [r.left+(v.x+1)/2*r.width, r.top+(1-v.y)/2*r.height];}}")
    pg.mouse.move(pt[0], pt[1]); pg.wait_for_timeout(100)
    hot = pg.evaluate(f"()=>{E}.PP.hot")
    pg.mouse.click(pt[0], pt[1]); pg.wait_for_timeout(300)
    check('plan de face cliqué dans la vue → éditeur avec l’outil Cercle', hot == 'xz' and pg.evaluate(f"()=>[{E}.SK.plane, {E}.SK.tool]") == ['xz', 'circle'], [hot, pg.evaluate(f"()=>[{E}.SK.plane, {E}.SK.tool]")])
    bb = pg.locator('#skCanvas').bounding_box()
    pg.mouse.click(*w2s(0, 15)); pg.mouse.click(*w2s(8, 15)); pg.click('#skOk'); pg.wait_for_timeout(400)
    r = pg.evaluate(f"()=>{{const E={E}; const p=E.state.parts.at(-1); const m=E.meshes.get(p.id).mesh; m.updateMatrixWorld(); const b=new E.camera.position.constructor(); const box=m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld); return [p.rot, Math.round(box.min.z), Math.round(box.max.z), Math.round(box.max.y-box.min.y)];}}")
    check('esquisse sur le plan XZ : debout (Z de 7 à 23), épaisseur en Y', r == [[90, 0, 0], 7, 23, 10], r)

    # Bézier: a straight base closed by one curve
    pg.evaluate(f'()=>{E}.openSketch(null)'); pg.wait_for_timeout(300)
    bb = pg.locator('#skCanvas').bounding_box()
    pg.click('[data-tool=line]'); pg.mouse.click(*w2s(0, 0)); pg.mouse.click(*w2s(30, 0)); pg.keyboard.press('Escape')
    pg.click('[data-tool=bezier]')
    pg.mouse.move(*w2s(30, 0)); pg.mouse.down(); pg.mouse.move(*w2s(30, 12), steps=5); pg.mouse.up()   # départ, tangente tirée vers le haut
    pg.mouse.move(*w2s(0, 0)); pg.mouse.down(); pg.mouse.move(*w2s(0, -12), steps=5); pg.mouse.up()   # arrivée sur le point existant : ferme
    r = pg.evaluate(f'()=>{{const d={E}.SK.d; return [d.beziers.length, {E}.skProfiles(d).loops.length, !!{E}.SK.pend]}}')
    check('Bézier point par point (cliquer-glisser) fermant un contour', r == [1, 1, False], r)
    r = pg.evaluate(f"()=>{{const d={E}.SK.d, z=d.beziers[0]; return [z.t1, z.t2]}}")
    check('cliquer-glisser : tangentes tirées par la souris', abs(r[0][1]-12) < 0.6 and abs(r[1][1]-12) < 0.6, r)
    # trois points : clic = anguleux, glisser = symétrique ; puis options du point
    pg.keyboard.press('Escape'); pg.evaluate(f'()=>{{const S={E}.SK; S.d.beziers=[]; S.d.lines=[]; S.d.cons=[]; S.d.pts=S.d.pts.filter(p=>p.origin);}}'); pg.click('[data-tool=bezier]')
    pg.mouse.click(*w2s(0, 0))
    pg.mouse.move(*w2s(20, 10)); pg.mouse.down(); pg.mouse.move(*w2s(20, 22), steps=5); pg.mouse.up()
    pg.mouse.click(*w2s(0, 30)); pg.wait_for_timeout(100)
    pg.mouse.click(*w2s(0, 0)); pg.wait_for_timeout(100)
    r = pg.evaluate(f"()=>{{const d={E}.SK.d; const p=d.pts.find(q=>q.x===20); return [d.beziers.length, {E}.skProfiles(d).loops.length, p.it, p.tm, d.beziers.map(z=>[z.t1,z.t2])]}}")
    check('clic = point anguleux, glisser = point lisse symétrique', r[0] == 3 and r[1] == 1 and r[2:4] == ['bez', 'sym'] and abs(r[4][0][1][1]+12) < 0.6 and abs(r[4][1][0][1]-12) < 0.6, r)
    pg.click('[data-tool=select]'); pg.mouse.click(*w2s(20, 10)); pg.wait_for_timeout(100)
    check('options du point visibles', pg.is_visible('#bzOpts') and pg.locator('#bzOpts [data-tm="sym"].on').count() == 1)
    pg.click('#bzOpts [data-tm="free"]')
    h = pg.locator('#skCanvas').bounding_box(); hx, hy = w2s(20, 22); pg.mouse.move(hx, hy); pg.mouse.down(); pg.mouse.move(*w2s(26, 22), steps=5); pg.mouse.up()
    r = pg.evaluate(f"()=>{{const d={E}.SK.d; const p=d.pts.find(q=>q.x===20); return [p.tm, d.beziers.map(z=>[z.t1,z.t2])]}}")
    check('tangentes cassées : une poignée bouge seule', r[0] == 'free' and abs(r[1][1][0][0]-6) < 0.6 and abs(r[1][0][1][1]+12) < 0.6, r)
    pg.click('#bzOpts [data-tm="sym"]')
    r = pg.evaluate(f"()=>{{const d={E}.SK.d; const a=d.beziers[0].t2, b=d.beziers[1].t1; return [Math.abs(a[0]+b[0])+Math.abs(a[1]+b[1])]}}")
    check('symétriser : poignées opposées et de même longueur', r[0] < 0.01, r)
    pg.click('#bzOpts [data-tm="align"]'); hx, hy = w2s(*pg.evaluate(f"()=>{{const z={E}.SK.d.beziers[1]; return [20+z.t1[0], 10+z.t1[1]]}}"))
    pg.mouse.move(hx, hy); pg.mouse.down(); pg.mouse.move(*w2s(20, 40), steps=5); pg.mouse.up()
    r = pg.evaluate(f"()=>{{const d={E}.SK.d; const a=d.beziers[0].t2, b=d.beziers[1].t1; return [a, b, Math.abs(a[0]*b[1]-a[1]*b[0])]}}")
    check('dessymétriser : alignées, longueurs différentes', r[2] < 0.05 and abs(abs(r[0][1]) - abs(r[1][1])) > 3, r)
    pg.click('#bzOpts [data-it="lin"]')
    r = pg.evaluate(f"()=>{{const d={E}.SK.d; return [d.beziers[0].t2, d.beziers[1].t1]}}")
    check('interpolation anguleuse : poignées vers les voisins', [round(v,2) for v in r[0]] == [-6.67, -3.33] and [round(v,2) for v in r[1]] == [-6.67, 6.67], r)
    pg.click('#bzOpts [data-it="auto"]')
    r = pg.evaluate(f"()=>{{const d={E}.SK.d; const a=d.beziers[0].t2, b=d.beziers[1].t1; return [a, b]}}")
    check('lisse auto : tangente parallèle aux voisins', abs(r[0][0]) < 0.01 and abs(r[1][0]) < 0.01 and r[1][1] > 0 > r[0][1], r)
    pg.screenshot(path=os.path.join(OUT, 'bezier.png'))
    pg.click('#skOk'); pg.wait_for_timeout(300)
    for k in ['coeur', 'vase']:
        pg.evaluate(f"()=>{E}.loadExample('{k}')"); pg.wait_for_timeout(300)
        n = pg.evaluate(f'()=>{E}.getGeometry({E}.state.parts[0]).attributes.position.count')
        check(f'volume Bézier ({k})', n > 500, n)

    # Valider -> Mécanique : gate, repères, liaison accrochée à un repère
    pg.evaluate(f"()=>{E}.setWs('model')"); pg.click('#bNew'); pg.wait_for_timeout(200)
    pg.evaluate(f"()=>{{const E={E}; const a=E.addPart('box',[0,0]); a.params.L=60; a.params.l=40; a.params.h=6; const c=E.addPart('cylinder',[20,0]); c.pos=[20,0,6];}}")
    pg.evaluate(f"()=>{E}.setWs('mech')"); pg.wait_for_timeout(300)
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

    # Bulle et étiquettes (Mécanique)
    pg.evaluate(f"()=>{E}.loadExample('gears')"); pg.wait_for_timeout(500)
    n = pg.locator('#jlabels .jl').count()
    check('une étiquette par liaison', n == 4, n)
    pg.locator('#jlabels .jl').nth(0).click(); pg.wait_for_timeout(200)
    check('bulle Mécanique ouverte depuis une étiquette', pg.evaluate(f"()=>{E}.BUB.kind")=='mech' and pg.is_visible('#bubble'))
    pg.click('#bubPlay'); pg.wait_for_timeout(600)
    check('la bulle lance la simulation', pg.evaluate(f"()=>{E}.sim.playing"))
    pg.click('#bubPlay'); pg.evaluate(f"()=>{E}.simReset()")
    r = pg.evaluate(f"""()=>{{const E={E}; const p=E.state.parts[1]; const l=p.locs.find(k=>k.id==='axe'); const j=E.state.joints[0];
        j.loc={{pid:p.id,lid:'axe'}}; const before=j.axis.slice(); E.locEdit(p,l,'flip'); return [before[2], j.axis[2]];}}""")
    check('inverser un repère inverse l’axe de la liaison', r[0] > 0.99 and r[1] < -0.99, r)
    # Étiquettes regroupées : dispositions et réduction automatique
    pg.evaluate(f"()=>{E}.simReset(true)"); pg.wait_for_timeout(300)
    r = pg.evaluate("""()=>{const st=document.querySelector('#stage').getBoundingClientRect(); const L=[...document.querySelectorAll('#jlabels > .jl')].map(e=>e.getBoundingClientRect());
      return [document.querySelector('#jlabels').dataset.lay, L.length, L.every(r=>r.left>=st.left-1 && r.right<=st.right+1 && r.top>=st.top-1 && r.bottom<=st.bottom+1),
        getComputedStyle(document.querySelector('#jlGroup')).backgroundColor]}""")
    check('étiquettes autour du mécanisme (ovale, par défaut), groupe transparent', r[0]=='orbite' and r[1]==4 and r[2] and r[3] in ('rgba(0, 0, 0, 0)','transparent'), r)
    pg.click('#jlGroup .jl-lay[aria-label="En cercle"]'); pg.wait_for_timeout(200)
    pg.wait_for_timeout(300)
    r = pg.evaluate(f"""()=>{{const E={E}; const st=document.querySelector('#stage').getBoundingClientRect(); const L=[...document.querySelectorAll('#jlabels > .jl')].map(e=>e.getBoundingClientRect());
      const c=L.map(r=>[r.left+r.width/2-st.left, r.top+r.height/2-st.top]); const mx=c.reduce((a,p)=>a+p[0],0)/c.length, my=c.reduce((a,p)=>a+p[1],0)/c.length;
      const d=c.map(p=>Math.hypot(p[0]-mx,p[1]-my)); return [document.querySelector('#jlabels').dataset.lay, L.length, Math.max(...d)-Math.min(...d) < 0.25*Math.max(...d)];}}""")
    check('étiquettes en cercle autour du mécanisme', r == ['cercle', 4, True], r)
    pg.click('#jlGroup .jl-lay[aria-label="En ligne"]'); pg.wait_for_timeout(200)
    big = pg.evaluate("()=>document.querySelector('#jlabels').dataset.sz")
    pg.set_viewport_size({'width': 760, 'height': 560}); pg.wait_for_timeout(500)
    small = pg.evaluate("()=>{const st=document.querySelector('#stage').getBoundingClientRect(); return [document.querySelector('#jlabels').dataset.sz, [...document.querySelectorAll('#jlabels > .jl')].every(e=>{const r=e.getBoundingClientRect(); return r.left>=st.left-1 && r.right<=st.right+1;})]}")
    rank = {'full':0, 'compact':1, 'mini':2}
    check('étiquettes réduites quand la vue est petite', rank[small[0]] >= rank[big] and small[0] != 'full' and small[1], [big, small])
    pg.set_viewport_size({'width': 1400, 'height': 860}); pg.wait_for_timeout(400)
    r = pg.evaluate(f"()=>{{const st=document.querySelector('#stage').getBoundingClientRect(), c=document.querySelector('#stage canvas.gl').getBoundingClientRect(), a=document.querySelector('#app').getBoundingClientRect(); return [Math.round(c.width-st.width), Math.round(st.left-a.left+a.right-st.right), getComputedStyle(document.querySelector('#insp')).backgroundColor, Math.round(st.top-c.top), getComputedStyle(document.querySelector('#rack')).backgroundColor]}}")
    check('panneaux transparents (réglages, barre de création), la vue 3D passe dessous', abs(r[0]-r[1]) <= 1 and r[0] > 40 and ('/ 0.' in r[2] or 'rgba' in r[2]), r)

    # Bulle et animation (Structures)
    pg.evaluate(f"()=>{E}.loadExample('pontWarren')"); pg.wait_for_timeout(400)
    pg.evaluate(f"""()=>{{const E={E}; const n=E.SD().truss.nodes[2]; E.openStructBubble({{t:'node',id:n.id}}, 400, 400);}}""")
    pg.locator('#bubble input[type=range]').nth(0).evaluate("(e)=>{e.value=900; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change'));}")
    r = pg.evaluate(f"()=>[{E}.SD().truss.nodes[2].fy, {E}.ST.res.worst.sf < 1]")
    check('curseur de force dans la bulle', r == [-900, True], r)
    pg.click('#bubPlay'); pg.wait_for_timeout(500)
    k1 = pg.evaluate(f"()=>{E}.ST.k"); pg.wait_for_timeout(400); k2 = pg.evaluate(f"()=>{E}.ST.k")
    check('animation de la déformation en boucle', pg.evaluate(f"()=>{E}.ST.anim.on") and k1 != k2 and 0 <= k1 <= 1, [k1, k2])
    pg.click('#stTools [data-v3="1"]'); pg.wait_for_timeout(500)
    k3 = pg.evaluate(f"()=>{E}.ST.k"); pg.wait_for_timeout(300)
    check('animation aussi en 3D', pg.evaluate(f"()=>{E}.ST.g3 && {E}.ST.g3.kind==='truss'") and pg.evaluate(f"()=>{E}.ST.k") != k3)
    r = pg.evaluate(f"()=>[{E}.SD().truss.nodes.filter(n=>+n.fx||+n.fy).length, {E}.ST.g3.arrows.length, document.querySelectorAll('#st3d .st3-f').length, document.querySelectorAll('#st3d .st3-r').length, document.querySelectorAll('#st3d .st3-u').length, !document.querySelector('#st3d').hidden]")
    check('vue 3D : mêmes flèches, réactions et flèche max qu’en 2D', r[0] > 0 and r[1] == r[0] and r[2] == r[0] and r[3] == 2 and r[4] == 1 and r[5], r)
    # Vue 3D des Structures : navigation, sélection et double-clic (cadrage)
    pg.evaluate(f"()=>{E}.stAnimPlay(false)"); pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
    check('vue 3D : le calque 2D ne bloque plus la souris', pg.is_hidden('#stWrap'))
    cr = pg.locator('#stage canvas.gl').bounding_box()
    c0 = pg.evaluate(f"()=>{E}.camera.position.toArray()")
    pg.mouse.move(cr['x']+cr['width']*0.5, cr['y']+cr['height']*0.75); pg.mouse.down(); pg.mouse.move(cr['x']+cr['width']*0.5+160, cr['y']+cr['height']*0.75+30, steps=8); pg.mouse.up(); pg.wait_for_timeout(200)
    c1 = pg.evaluate(f"()=>{E}.camera.position.toArray()")
    check('vue 3D : glisser fait tourner la vue', sum((a-b)**2 for a,b in zip(c0,c1)) > 1, [c0, c1])
    pt = pg.evaluate(f"""()=>{{const E={E}; const r=E.renderer.domElement.getBoundingClientRect(); const o=E.structGroup.children.find(c=>c.userData && c.userData.t==='bar');
      const v=new o.position.constructor(); o.getWorldPosition(v); v.project(E.camera); return [r.left+(v.x+1)/2*r.width, r.top+(1-v.y)/2*r.height, o.userData.id];}}""")
    pg.mouse.click(pt[0], pt[1]); pg.wait_for_timeout(200)
    r = pg.evaluate(f"()=>[{E}.BUB.kind, {E}.BUB.target && {E}.BUB.target.t]")
    check('vue 3D : clic sur une barre → bulle', r == ['struct', 'bar'], r)
    pg.keyboard.press('Escape')
    d0 = pg.evaluate(f"()=>{E}.camera.position.distanceTo({E}.orbit.target)")
    pg.wait_for_timeout(200)
    pt = pg.evaluate(f"""()=>{{const E={E}; const r=E.renderer.domElement.getBoundingClientRect(); const o=E.structGroup.children.find(c=>c.userData && c.userData.t==='bar');
      const v=new o.position.constructor(); o.getWorldPosition(v); v.project(E.camera); return [r.left+(v.x+1)/2*r.width, r.top+(1-v.y)/2*r.height, o.userData.id];}}""")
    pg.mouse.dblclick(pt[0], pt[1]); pg.wait_for_timeout(700)
    d1 = pg.evaluate(f"()=>{E}.camera.position.distanceTo({E}.orbit.target)")
    check('vue 3D : double-clic zoome sur la barre', d1 < d0*0.8, [round(d0), round(d1)])
    pg.click('#stTools [data-v3="0"]'); pg.wait_for_timeout(300); pg.keyboard.press('Escape')
    check('retour en 2D : le calque 2D est revenu', pg.is_visible('#stCanvas') and pg.is_visible('#stWrap'))

    # Échelle de déformée fixe : une force double donne une déformée dessinée double
    pg.evaluate(f"()=>{E}.loadExample('pontWarren')"); pg.wait_for_timeout(300)
    r = pg.evaluate(f"""()=>{{const E={E}; const shown=()=>{{const b=E.structBox(), R=E.ST.res; return E.ampFactor(Math.max(b.maxx-b.minx,b.maxy-b.miny), R.umax, 0.035)*R.umax;}};
      const a=shown(); for(const n of E.SD().truss.nodes){{ n.fy=2*(+n.fy||0); n.fx=2*(+n.fx||0); }} E.computeStruct(); const c=shown(); return [a, c];}}""")
    check('force ×2 → déformée affichée ×2', abs(r[1]/r[0] - 2) < 0.05, r)

    # Flèche de charge cliquable (vue 2D) → bulle du nœud
    pg.click('#stTools [data-st="select"]')
    pg.evaluate(f"()=>{E}.stDraw()")
    pt = pg.evaluate(f"""()=>{{const E={E}; E.closeBubble(); const c=document.querySelector('#stCanvas').getBoundingClientRect();
      for(const a of E.arrowHits()){{ const x=c.left+(a.x0*0.4+a.x1*0.6), y=c.top+(a.y0*0.4+a.y1*0.6); if(document.elementFromPoint(x,y)?.id==='stCanvas') return [x,y]; }} return null;}}""")
    if pt: pg.mouse.click(pt[0], pt[1]); pg.wait_for_timeout(150)
    r = pg.evaluate(f"()=>[{E}.BUB.kind, {E}.BUB.target && {E}.BUB.target.t]")
    check('clic sur une flèche de charge → bulle', r == ['struct', 'node'], r)

    # Bulle déplaçable et transparente
    bb = pg.locator('#bubble .bub-head').bounding_box(); pg.mouse.move(bb['x']+60, bb['y']+10); pg.mouse.down(); pg.mouse.move(bb['x']-120, bb['y']+90, steps=6); pg.mouse.up()
    r = pg.evaluate(f"()=>[{E}.LAYOUT().bubble, document.querySelector('#bubble').dataset.side]")
    check('bulle déplacée et mémorisée', r[0] and r[0].get('x') is not None and r[1] == '', r)
    pg.evaluate(f"()=>{{const E={E}; const n=E.SD().truss.nodes[1]; E.openStructBubble({{t:'node',id:n.id}}, 50, 50);}}")
    pos = pg.evaluate("()=>{const s=document.querySelector('#stage').getBoundingClientRect(), b=document.querySelector('#bubble').getBoundingClientRect(); return [Math.round(b.left-s.left), Math.round(b.top-s.top)]}")
    check('la bulle rouverte reste à sa place', [pos[0], pos[1]] == [r[0]['x'], r[0]['y']], [pos, r[0]])
    pg.evaluate("()=>{const b=document.querySelector('#bubble'); b.style.left='0px'; b.style.top='0px';}"); pg.wait_for_timeout(100)
    r = pg.evaluate("()=>{const s=document.querySelector('#bubLink'), l=s.querySelector('line'); return [getComputedStyle(s).display, Math.hypot(l.x1.baseVal.value-l.x2.baseVal.value, l.y1.baseVal.value-l.y2.baseVal.value)]}")
    check('trait entre la bulle et l’élément ciblé', r[0] == 'block' and r[1] > 10, r)
    alpha = pg.evaluate("()=>getComputedStyle(document.querySelector('#bubble')).backgroundColor")
    check('bulle et panneaux semi-transparents', ('/ 0.7' in alpha or 'rgba' in alpha) and pg.evaluate("()=>getComputedStyle(document.querySelector('#stLegendBox')).backgroundColor") != pg.evaluate("()=>getComputedStyle(document.querySelector('#insp')).backgroundColor"), alpha)
    pg.click('#bubble .bub-pin'); pg.wait_for_timeout(100)
    check('bulle raccrochée à l’objet', pg.evaluate(f"()=>!{E}.LAYOUT().bubble && document.querySelector('#bubble').dataset.side!==''"))
    pg.keyboard.press('Escape')

    # Démarche : Modéliser -> Valider -> simulations, sans bandeau
    pg.evaluate(f"()=>{E}.loadExample('maison')"); pg.wait_for_timeout(300)
    pg.click('#flow [data-go="check"]'); pg.wait_for_timeout(300)
    check('« Valider pour simulation » ouvre la Validation', pg.evaluate(f"()=>{E}.ws()")=='check' and pg.is_hidden('#rack') and pg.is_hidden('#tools'))
    check('Mouvement verrouillé avant validation', pg.evaluate("()=>document.querySelector('#flow [data-go=\"mech\"]').disabled"))
    pg.click('#inspBody .btn.primary'); pg.wait_for_timeout(500)
    pg.locator('#inspBody .vrow').nth(2).click(); pg.wait_for_timeout(200)
    pg.click('#locTestBtn'); pg.wait_for_timeout(600)
    moved = 0
    for _ in range(4):   # the test motion swings back and forth: take the largest of a few readings
        moved = max(moved, pg.evaluate(f"()=>{{const E={E}; const p=E.state.parts[2]; const r=E.meshes.get(p.id); return Math.abs(r.mesh.rotation.z)+Math.abs(r.mesh.rotation.x)+Math.abs(r.mesh.rotation.y)}}")); pg.wait_for_timeout(150)
    check('mode test : la pièce tourne autour du repère', pg.evaluate(f"()=>{E}.CHK.test.on") and moved > 0.01, moved)
    pg.click('#locTestBtn')
    pg.click('#flow [data-go="mech"]'); pg.wait_for_timeout(300)
    check('passage à la simulation du mouvement', pg.evaluate(f"()=>{E}.ws()")=='mech' and pg.locator('#flow [data-go="model"]').count()==1)

    # Panneaux déplaçables et réductibles, disposition mémorisée
    g = pg.locator('#views .pgrip').bounding_box(); pg.mouse.move(g['x']+4, g['y']+4); pg.mouse.down(); pg.mouse.move(500, 500, steps=5); pg.mouse.up()
    pg.click('#simbar .pmin'); h = pg.locator('#insp .insp-tt').bounding_box(); pg.mouse.move(h['x']+20, h['y']+8); pg.mouse.down(); pg.mouse.move(h['x']-200, h['y']+40, steps=5); pg.mouse.up(); pg.wait_for_timeout(200)
    L = pg.evaluate(f"()=>{E}.LAYOUT()")
    check('panneaux déplacés (vues, propriétés) et réduit', L.get('views',{}).get('x') is not None and L.get('simbar',{}).get('c') and L.get('insp',{}).get('x') is not None, L)
    check('panneau réduit masque son contenu', pg.is_hidden('#sPlay'))
    pg.evaluate(f"()=>{E}.resetLayout()"); pg.wait_for_timeout(200)
    check('disposition réinitialisée', pg.evaluate(f"()=>JSON.stringify({E}.LAYOUT())")=='{}' and pg.is_visible('#sPlay'))

    # Survol, manipulation, sélection et regroupement (Modéliser)
    pg.evaluate(f"()=>{E}.setWs('model')"); pg.evaluate(f"()=>{{const E={E}; E.state.parts.length=0; E.state.joints.length=0; E.setSel([]);}}")
    pg.evaluate(f"""()=>{{const E={E}; const a=E.addPart('box',[0,0]); a.params={{L:40,l:40,h:20}}; const b=E.addPart('cylinder',[0,0]); b.params.d=10; b.params.h=30; b.hole=true; E.setSel([]); E.camera.position.set(60,-90,80); E.orbit_().target.set(0,0,10); E.orbit_().update();}}""")
    pg.evaluate("()=>{const d=document.querySelector('#demo'); if(d) d.hidden=true;}"); pg.wait_for_timeout(400)
    def proj(x, y, z):
        return pg.evaluate(f"""()=>{{const E={E}; const r=E.renderer.domElement.getBoundingClientRect(); const v=new E.camera.position.constructor({x},{y},{z}); v.project(E.camera); return [r.left+(v.x+1)/2*r.width, r.top+(1-v.y)/2*r.height];}}""")
    p0 = proj(14, -14, 20)
    pg.mouse.move(p0[0]-40, p0[1]+40); pg.mouse.move(p0[0], p0[1], steps=5); pg.wait_for_timeout(250)
    r = pg.evaluate("()=>[document.querySelector('#hovName').hidden, document.querySelector('#hovName').textContent]")
    check('survol : nom de la pièce (sans boutons de mode)', r[0] is False and 'Cube' in r[1] and not pg.locator('#hovTools').count(), r)
    pg.evaluate(f"()=>{{const E={E}; E.setSel([E.state.parts[0].id]);}}"); pg.wait_for_timeout(200)
    def ctr(sel):
        b = pg.locator(sel).bounding_box(); return (b['x']+b['width']/2, b['y']+b['height']/2)
    n = pg.evaluate("()=>[...document.querySelectorAll('#tg .tg-corner,#tg .tg-edge,#tg .tg-rot,#tg .tg-lift')].filter(e=>!e.hidden).length")
    check('poignées de sélection : coins, côtés, hauteur, rotations, soulever', n == 4+4+1+3+1, n)
    x, y = ctr('.tg-corner[data-k="c1"]'); pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x+50, y+10, steps=8); pg.mouse.up(); pg.wait_for_timeout(200)
    r = pg.evaluate(f"()=>{{const q={E}.state.parts[0]; return [q.params.L, q.params.l, q.params.h]}}")
    check('poignée de coin : longueur et largeur changent, hauteur non', r[0] != 40 and r[2] == 20, r)
    x, y = ctr('.tg-corner[data-k="top"]'); pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x, y-50, steps=8); pg.mouse.up(); pg.wait_for_timeout(200)
    check('poignée du haut : hauteur', pg.evaluate(f"()=>{E}.state.parts[0].params.h") > 20)
    x, y = ctr('.tg-rot[data-k="rz"]'); pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x-220, y-160, steps=12); pg.wait_for_timeout(100)
    lab = pg.evaluate("()=>[!document.querySelector('.tg-ang').hidden, document.querySelector('.tg-ang').textContent]"); pg.mouse.up(); pg.wait_for_timeout(200)
    rz = pg.evaluate(f"()=>{E}.state.parts[0].rot[2]")
    check('flèche de rotation : rapporteur et angle par pas de 15°', lab[0] and rz != 0 and abs(rz) % 15 == 0, [lab, rz])
    x, y = ctr('.tg-corner[data-k="c1"]'); pg.mouse.move(x, y); pg.wait_for_timeout(150)
    pg.locator('.tg-dimv[data-a="x"]').click(); pg.keyboard.press('Control+a'); pg.keyboard.type('33'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    check('cote tapée au clavier', pg.evaluate(f"()=>{E}.state.parts[0].params.L") == 33, pg.evaluate(f"()=>{E}.state.parts[0].params"))
    pg.evaluate(f"()=>{{const E={E}; const q=E.state.parts.find(k=>k.kind==='box'); q.params={{L:40,l:40,h:20}}; q.pos=[0,0,0]; q.rot=[0,0,0]; E.setSel([]);}}"); pg.wait_for_timeout(200)
    pc = proj(0, 0, 20)
    pg.mouse.click(pc[0], pc[1]); pg.wait_for_timeout(150); s1 = pg.evaluate(f"()=>{E}.selection().map(i=>{E}.state.parts.find(p=>p.id===i).kind)")
    pg.mouse.click(pc[0], pc[1]); pg.wait_for_timeout(150); s2 = pg.evaluate(f"()=>{E}.selection().map(i=>{E}.state.parts.find(p=>p.id===i).kind)")
    check('clic répété : la pièce de derrière (perçage dans le cube)', s1 != s2 and sorted([s1[0], s2[0]]) == ['box','cylinder'], [s1, s2])
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape')
    cr = pg.locator('#stage canvas.gl').bounding_box(); st = pg.locator('#stage').bounding_box()
    pg.keyboard.down('Shift'); pg.mouse.move(st['x']+150, st['y']+120); pg.mouse.down(); pg.mouse.move(st['x']+st['width']-160, st['y']+st['height']-80, steps=8); pg.mouse.up(); pg.keyboard.up('Shift'); pg.wait_for_timeout(200)
    check('Maj + glisser : sélection par cadre', pg.evaluate(f"()=>{E}.selection().length") == 2, pg.evaluate(f"()=>{E}.selection()"))
    pg.keyboard.press('Control+g'); pg.wait_for_timeout(500)
    r = pg.evaluate(f"()=>{{const E={E}; const G=E.state.parts.find(p=>p.kind==='group'); return G? [G.children.length, G.children.filter(c=>c.hole).length, E.meshes.get(G.id).mesh.geometry.attributes.position.count>100] : null}}")
    check('regroupement avec perçage depuis la vue', r == [2, 1, True], r)
    gid = pg.evaluate(f"()=>{E}.state.parts.find(p=>p.kind==='group').id")
    pg.evaluate(f"()=>{E}.enterGroupEdit({gid})"); pg.wait_for_timeout(200)
    r = pg.evaluate(f"()=>[{E}.state.parts.length, !!{E}.state.edit, !document.querySelector('#grpEdit').hidden]")
    check('entrer dans le groupe : ses pièces redeviennent séparées', r == [2, True, True], r)
    pg.evaluate(f"()=>{{const E={E}; const c=E.state.parts.find(p=>p.kind==='cylinder'); c.params.d=20; E.setSel([c.id]);}}")
    pg.click('#grpEdit .btn'); pg.wait_for_timeout(400)
    r = pg.evaluate(f"""()=>{{const E={E}; const G=E.state.parts.find(p=>p.kind==='group'); let g=E.getGeometry(G); g=g.index? g.toNonIndexed():g; const p=g.attributes.position.array; let V=0;
      for(let i=0;i<p.length;i+=9){{ V+=p[i]*(p[i+4]*p[i+8]-p[i+5]*p[i+7])-p[i+1]*(p[i+3]*p[i+8]-p[i+5]*p[i+6])+p[i+2]*(p[i+3]*p[i+7]-p[i+4]*p[i+6]); }}
      return [E.state.parts.length, G && G.id, !E.state.edit, Math.round(V/6)];}}""")
    check('sortir du groupe : perçage recalculé avec la nouvelle cote', r[0] == 1 and r[1] == gid and r[2] and abs(r[3] - round(32000-3.14159*100*20)) < 60, r)
    g0 = pg.evaluate(f"()=>{E}.state.parts[0].pos.slice()")
    pa = proj(g0[0]+14, g0[1]-14, 20); pb = proj(g0[0]+34, g0[1]-14, 20)
    pg.mouse.move(pa[0], pa[1]); pg.mouse.down(); pg.mouse.move(pb[0], pb[1], steps=8); pg.mouse.up(); pg.wait_for_timeout(200)
    g1 = pg.evaluate(f"()=>{E}.state.parts[0].pos.slice()")
    check('glisser une pièce la déplace sur le sol (hauteur inchangée)', abs(g1[2]-g0[2]) < 1e-6 and abs(g1[0]-g0[0]) > 5, [g0, g1])
    pg.mouse.click(st['x']+120, st['y']+st['height']-120, button='right'); pg.wait_for_timeout(200)
    vis = pg.is_visible('#ctxMenu')
    pg.locator('#ctxMenu button', has_text='panoramique').click(); pg.wait_for_timeout(100)
    r = pg.evaluate(f"()=>[{E}.prefs.lmb, {E}.orbit_().mouseButtons.LEFT, document.querySelector('#ctxMenu').hidden]")
    check('clic droit : menu, clic gauche réglé sur panoramique', vis and r == ['pan', 2, True], [vis, r])
    pg.evaluate(f"()=>{E}.setLmb('orbit')")
    pg.evaluate(f"()=>{E}.loadExample('coeur')"); pg.wait_for_timeout(500)
    v = pg.evaluate(f"""()=>{{const E={E}; let g=E.getGeometry(E.state.parts[0]); g=g.index? g.toNonIndexed():g; const p=g.attributes.position.array; let V=0;
      for(let i=0;i<p.length;i+=9){{ V+=p[i]*(p[i+4]*p[i+8]-p[i+5]*p[i+7])-p[i+1]*(p[i+3]*p[i+8]-p[i+5]*p[i+6])+p[i+2]*(p[i+3]*p[i+7]-p[i+4]*p[i+6]); }} return V/6;}}""")
    check('esquisse avec trou : volume correct (trou bien orienté)', abs(v - 2059) < 15, round(v))

    # Nouvelle disposition, cube de vue, magnétisme, cadre partiel
    pg.evaluate(f"()=>{E}.loadExample('maison')"); pg.wait_for_timeout(500)
    r = pg.evaluate("()=>{const r=document.querySelector('#rack').getBoundingClientRect(), t=document.querySelector('#toolbar').getBoundingClientRect(), i=document.querySelector('#insp').getBoundingClientRect(), v=document.querySelector('#views').getBoundingClientRect(), s=document.querySelector('#stage').getBoundingClientRect(), c=document.querySelector('#stage canvas.gl').getBoundingClientRect(); return [r.width>r.height*4, Math.abs(t.top-r.bottom)<2 && !!document.querySelector('#toolbar #tSolid'), i.right<=s.right+1 && i.right>s.right-40 && i.top>=v.bottom-2, Math.round(s.top-c.top)>20]}")
    check('barre de création, puis barre d’outils dessous ; propriétés sous le cube de vue ; vue dessous', r == [True, True, True, True], r)
    pg.evaluate(f"()=>{{const E={E}; E.camera.position.set(170,-240,180); E.orbit_().target.set(0,0,10); E.orbit_().update();}}"); pg.wait_for_timeout(200)
    c = pg.locator('#vcube').bounding_box(); pg.mouse.move(c['x']+c['width']*0.42, c['y']+c['height']*0.25); pg.wait_for_timeout(100); pg.mouse.down(); pg.mouse.up(); pg.wait_for_timeout(700)
    d = pg.evaluate(f"()=>{{const E={E}; return E.camera.position.clone().sub(E.orbit_().target).normalize().z}}")
    check('cube de vue : clic sur « Dessus » → vue de dessus', d > 0.99, d)
    a0 = pg.evaluate(f"()=>{E}.camera.position.toArray()"); pg.mouse.move(c['x']+c['width']/2, c['y']+c['height']/2); pg.mouse.down(); pg.mouse.move(c['x']+c['width']/2+40, c['y']+c['height']/2+20, steps=6); pg.mouse.up(); pg.wait_for_timeout(100)
    a1 = pg.evaluate(f"()=>{E}.camera.position.toArray()")
    check('cube de vue : glisser tourne la vue', sum((x-y)**2 for x,y in zip(a0,a1)) > 1)
    pg.evaluate(f"()=>{{const E={E}; E.state.parts.length=0; E.setSel([]); const a=E.addPart('box',[0,0]); const b=E.addPart('box',[40,3]); E.setSel([]); E.camera.position.set(20,-120,90); E.orbit_().target.set(20,0,10); E.orbit_().update();}}"); pg.wait_for_timeout(400)
    pa = proj(40, 3, 20); pb = proj(20.7, 0.6, 20)
    pg.mouse.move(pa[0], pa[1]); pg.mouse.down(); pg.mouse.move(pb[0], pb[1], steps=10); pg.wait_for_timeout(100)
    gv = pg.evaluate("()=>document.querySelector('#stage') && true"); pg.mouse.up(); pg.wait_for_timeout(200)
    r = pg.evaluate(f"()=>{E}.state.parts[1].pos.slice()")
    check('magnétisme : la pièce vient se coller au bord et s’aligner', abs(r[0]-20) < 1e-6 and abs(r[1]-0) < 1e-6, r)
    pg.evaluate("()=>{const d=document.querySelector('#demo'); if(d) d.hidden=true;}"); pg.evaluate(f"()=>{E}.setSel([])"); st = pg.locator('#stage').bounding_box()
    q0 = proj(-6, -6, 10); q1 = [max(st['x']+8, q0[0]-220), min(st['y']+st['height']-8, q0[1]+160)]
    pg.keyboard.down('Shift'); pg.mouse.move(q1[0], q1[1]); pg.mouse.down(); pg.mouse.move(q0[0], q0[1], steps=6); pg.mouse.up(); pg.keyboard.up('Shift'); pg.wait_for_timeout(200)
    check('cadre sur une partie de la pièce : elle est sélectionnée', pg.evaluate(f"()=>{E}.selection()") == [pg.evaluate(f"()=>{E}.state.parts[0].id")], pg.evaluate(f"()=>{E}.selection()"))

    check('aucune erreur JavaScript', not errors, errors[:3])
    b.close()

srv.shutdown()
print('\n' + ('TOUT EST OK' if not failures else f'{len(failures)} ÉCHEC(S)'))
sys.exit(1 if failures else 0)
