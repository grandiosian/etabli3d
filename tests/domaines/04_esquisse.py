"""Esquisses : cotes, plans, Bézier, sélection, volumes Bézier."""
import os

NIVEAU = 3


def run(t):
    pg, check, E, OUT, URL, b, errors = t.pg, t.check, t.E, t.OUT, t.URL, t.browser, t.errors
    # Sketch: rectangle + dimension typed in the field
    pg.evaluate("()=>document.querySelector('#bNew').click()"); pg.click('#bSketch'); pg.wait_for_timeout(300)
    check('bouton Esquisse enfoncé pendant le choix du plan', pg.evaluate("()=>[...document.querySelectorAll('#rack .shape.on')].map(e=>e.id)") == ['bSketch'])
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
    pg.evaluate("()=>document.querySelector('#bNew').click()"); pg.click('#rack [data-sktool="circle"]'); pg.wait_for_timeout(700)
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
    # Bézier commencée dans le vide : le premier point reste et les suivants s'enchaînent
    pg.click('#skCancel'); pg.wait_for_timeout(200)
    pg.click('#rack [data-sktool="bezier"]'); pg.wait_for_timeout(300); pg.click('#planePick [data-plane="xy"]'); pg.wait_for_timeout(300)
    bb = pg.locator('#skCanvas').bounding_box()
    pg.mouse.click(*w2s(10, 0)); pg.wait_for_timeout(50)
    r1 = pg.evaluate(f"()=>[{E}.SK.d.pts.length, !!{E}.SK.pend]")
    pg.mouse.move(*w2s(30, 10)); pg.mouse.down(); pg.mouse.move(*w2s(30, 20), steps=5); pg.mouse.up()
    pg.mouse.click(*w2s(10, 25)); pg.mouse.click(*w2s(10, 0))
    r = pg.evaluate(f"()=>{{const d={E}.SK.d; return [d.beziers.length, {E}.skProfiles(d).loops.length, !!{E}.SK.pend]}}")
    check('Bézier commencée dans le vide : premier point gardé, contour fermé', r1 == [2, True] and r == [3, 1, False], [r1, r])
    # Sélection par cadre avec filtre, Suppr, Espace + glisser
    pg.click('[data-tool=select]')
    pg.mouse.move(*w2s(-5, -5)); pg.mouse.down(); pg.mouse.move(*w2s(40, 30), steps=6); pg.mouse.up()
    r = sorted(pg.evaluate(f"()=>{E}.SK.msel.map(e=>e.type)"))
    check('glisser dans le vide : cadre de sélection (points et arêtes)', r == ['bez', 'bez', 'bez', 'pt', 'pt', 'pt'], r)
    pg.click('#skFilt [data-f="edge"]')
    pg.mouse.move(*w2s(-5, -5)); pg.mouse.down(); pg.mouse.move(*w2s(40, 30), steps=6); pg.mouse.up()
    check('filtre sans arêtes : le cadre ne prend que les points', sorted(pg.evaluate(f"()=>{E}.SK.msel.map(e=>e.type)")) == ['pt', 'pt', 'pt'])
    pg.click('#skFilt [data-f="edge"]')
    v0 = pg.evaluate(f"()=>[{E}.SK.view.cx, {E}.SK.view.cy]")
    pg.mouse.move(*w2s(20, -20)); pg.keyboard.down(' '); pg.mouse.down(); pg.mouse.move(bb['x']+40, bb['y']+40, steps=5); pg.mouse.up(); pg.keyboard.up(' ')
    v1 = pg.evaluate(f"()=>[{E}.SK.view.cx, {E}.SK.view.cy, {E}.SK.msel.length]")
    check('Espace + glisser : la vue se décale, la sélection reste', abs(v1[0]-v0[0]) > 1 and v1[2] == 3, [v0, v1])
    pg.keyboard.press('Delete')
    check('Suppr efface toute la sélection', pg.evaluate(f"()=>[{E}.SK.d.beziers.length, {E}.SK.d.pts.filter(p=>!p.origin).length]") == [0, 0])
    pg.click('#skCancel'); pg.wait_for_timeout(200)
    for k in ['coeur', 'vase']:
        pg.evaluate(f"()=>{E}.loadExample('{k}')"); pg.wait_for_timeout(300)
        n = pg.evaluate(f'()=>{E}.getGeometry({E}.state.parts[0]).attributes.position.count')
        check(f'volume Bézier ({k})', n > 500, n)
