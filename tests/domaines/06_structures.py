"""Structures : calculs, treillis à la souris, bulle, animation, vue 3D."""
import os

NIVEAU = 3


def run(t):
    pg, check, E, OUT, URL, b, errors = t.pg, t.check, t.E, t.OUT, t.URL, t.browser, t.errors
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
