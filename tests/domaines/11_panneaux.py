"""Barre Édition, panneaux, arborescence."""
import os
from commun import niveau

NIVEAU = 3


def run(t):
    pg, check, E, OUT, URL, b, errors = t.pg, t.check, t.E, t.OUT, t.URL, t.browser, t.errors
    # Onglet Création mécanique, cube de vue sous la barre de création
    pg.evaluate(f"()=>{E}.setWs('model')"); pg.click('#rack [data-rtab="meca"]'); pg.wait_for_timeout(100)
    r = pg.evaluate("()=>[document.querySelector('#rackMeca').hidden, document.querySelectorAll('#rackMeca .shape').length, document.querySelector('#rackBasic').hidden]")
    pg.click('#rack [data-rtab="vol"]')
    check('onglet « Création mécanique » : roue dentée et crémaillère', r == [False, 2, True], r)
    r = pg.evaluate("()=>{const v=document.querySelector('#views').getBoundingClientRect(), k=document.querySelector('#rack').getBoundingClientRect(); return [v.top >= k.bottom-1, v.top < k.bottom+30]}")
    check('cube de vue juste sous la barre de création', all(r), r)
    r = pg.evaluate("()=>{const g=document.querySelector('#views > .pgrip'); return [getComputedStyle(g).position, getComputedStyle(g).backgroundColor]}")
    check('cube de vue : poignée et réduire dans les coins, sans barre', r[0] == 'absolute' and r[1] in ('rgba(0, 0, 0, 0)','transparent'), r)
    # Barre Édition : rentrée quand rien n'est choisi, elle s'ouvre dès qu'une pièce est choisie, en colonne à droite de la création ;
    # l'onglet « Édition » et la flèche l'ouvrent ou la rentrent à la main ; rentrée à la main, elle ne s'ouvre plus toute seule
    pg.evaluate(f"()=>{{const E={E}; E.loadExample('maison'); E.setSel([]);}}"); pg.wait_for_timeout(300)
    shut = pg.evaluate(f"()=>[{E}.edOpen_(), !document.querySelector('#edBar').offsetParent, !!document.querySelector('#edToggle').offsetParent, document.querySelector('#edToggle').getAttribute('aria-expanded')]")
    cam0 = pg.evaluate(f"()=>[document.querySelector('#stage canvas.gl').getBoundingClientRect().top, {E}.camera.view?.offsetY ?? 0]")
    st0 = pg.evaluate("()=>document.querySelector('#stage').getBoundingClientRect().top")
    pg.evaluate(f"()=>{{const E={E}; E.setSel([E.state.parts[0].id]);}}"); pg.wait_for_timeout(300)
    r = pg.evaluate(f"""()=>{{const q=s=>document.querySelector(s), b=q('#edBar').getBoundingClientRect(), st=q('#stage').getBoundingClientRect(), k=q('#rack').getBoundingClientRect();
      return [{E}.edOpen_(), q('#edToggle').getAttribute('aria-expanded'), Math.abs(b.left-k.right)<2 && Math.abs(b.right-st.right)<2, Math.abs(b.top-k.top)<2 && Math.abs(b.bottom-k.bottom)<2 && !q('#edToggle').offsetParent,
        getComputedStyle(q('#edBar')).clipPath, !q('#tSolid').disabled]}}""")
    cam1 = pg.evaluate(f"()=>[document.querySelector('#stage canvas.gl').getBoundingClientRect().top, {E}.camera.view?.offsetY ?? 0]")
    st1 = pg.evaluate("()=>document.querySelector('#stage').getBoundingClientRect().top")
    check('barre Édition rentrée sans sélection (onglet visible), ouverte dès qu’une pièce est choisie : colonne à droite de la création, même hauteur, la vue ne bouge pas',
          shut == [False, True, True, 'false'] and r == [True, 'true', True, True, 'none', True] and abs(st1 - st0) < 1, [shut, r, st0, st1])
    check('la barre Édition ne fait pas bouger l’image 3D', abs(cam0[0]-cam1[0]) < 1.5 and abs(cam0[1]-cam1[1]) < 1.5, [cam0, cam1])
    pg.evaluate(f"()=>{E}.setSel([])"); pg.wait_for_timeout(200)
    r1 = pg.evaluate(f"()=>{E}.edOpen_()")
    pg.evaluate(f"()=>{{const E={E}; E.setSel([E.state.parts[0].id]);}}"); pg.wait_for_timeout(200)
    pg.click('#edFold'); pg.wait_for_timeout(200)
    r2 = pg.evaluate(f"()=>[{E}.edOpen_(), {E}.LAYOUT().edAuto]")
    pg.evaluate(f"()=>{{const E={E}; E.setSel([]); E.setSel([E.state.parts[1].id]);}}"); pg.wait_for_timeout(200)
    r3 = pg.evaluate(f"()=>{E}.edOpen_()")
    pg.click('#edToggle'); pg.wait_for_timeout(200)
    r4 = pg.evaluate(f"()=>[{E}.edOpen_(), {E}.LAYOUT().edAuto === undefined]")
    pg.evaluate(f"()=>{E}.setSel([])"); pg.wait_for_timeout(200)
    r5 = pg.evaluate(f"()=>{E}.edOpen_()")
    pg.click('#edToggle'); pg.wait_for_timeout(200)
    r6 = pg.evaluate(f"()=>{E}.edOpen_()")
    check('barre Édition : se rentre quand plus rien n’est choisi ; rentrée à la main, elle reste rentrée ; l’onglet la rouvre (et l’ouverture automatique revient), même sans sélection',
          [r1, r2, r3, r4, r5, r6] == [False, [False, False], False, [True, True], False, True], [r1, r2, r3, r4, r5, r6])
    pg.evaluate("()=>document.documentElement.dataset.theme='dark'"); pg.wait_for_timeout(100)
    r = pg.evaluate("()=>getComputedStyle(document.querySelector('#edBar')).backgroundColor")
    pg.evaluate("()=>document.documentElement.dataset.theme=''"); pg.wait_for_timeout(100)
    check('barre Édition en mode sombre : fond sombre', not r.startswith('rgba(248') and not r.startswith('rgb(248') and not r.startswith('color(srgb 0.97'), r)
    pg.set_viewport_size({'width': 900, 'height': 860}); pg.wait_for_timeout(500)
    r = pg.evaluate("()=>{const s=document.querySelector('#tools'), k=document.querySelector('#rack').getBoundingClientRect(), b=document.querySelector('#edBar').getBoundingClientRect(); return [s.scrollWidth<=s.clientWidth+1, document.querySelector('#edFold').getBoundingClientRect().right<=innerWidth, Math.abs(b.bottom-k.bottom)<2, k.width>300]}")
    pg.set_viewport_size({'width': 1400, 'height': 860}); pg.wait_for_timeout(500)
    check('fenêtre étroite (900 px, arborescence) : la barre Édition se resserre sans rien couper', all(r), r)
    pg.screenshot(path=os.path.join(OUT, 'barre-edition.png'))
    # les panneaux ne se plaquent plus : une ancienne disposition plaquée revient sur la vue
    pg.evaluate(f"()=>{{const E={E}; E.LAYOUT().snapBox={{dock:'L', order:0, w:200, t:1}}; E.resetLayout(); E.setEdOpen(true);}}"); pg.wait_for_timeout(300)
    g = pg.locator('#snapBox .pgrip').bounding_box(); ed = pg.locator('#edBar').bounding_box()
    pg.mouse.move(g['x']+5, g['y']+8); pg.mouse.down(); pg.mouse.move(ed['x']+60, ed['y']+20, steps=10); pg.mouse.up(); pg.wait_for_timeout(300)
    r = pg.evaluate(f"()=>[document.querySelector('#snapBox').parentElement.id, !!({E}.LAYOUT().snapBox||{{}}).dock, document.querySelectorAll('.docked, .ed-wing, .dock-sp').length]")
    check('Grille glissée vers la barre Édition : elle reste sur la vue (plus de panneaux plaqués)', r == ['stage', False, 0], r)
    pg.evaluate(f"()=>{E}.resetLayout()"); pg.wait_for_timeout(300)
    # Arborescence : réduire, déplacer, remettre
    pg.evaluate(f"()=>{E}.LAYOUT().tree=null"); 
    w0 = pg.evaluate("()=>document.querySelector('#outliner').getBoundingClientRect().width")
    pg.click('#treeMin'); pg.wait_for_timeout(200)
    w1 = pg.evaluate("()=>[document.querySelector('#outliner').getBoundingClientRect().width, getComputedStyle(document.querySelector('#treeBody')).display]")
    pg.click('#treeMin'); pg.wait_for_timeout(200)
    hb = pg.locator('#outliner .tree-head b').bounding_box(); pg.mouse.move(hb['x']+10, hb['y']+8); pg.mouse.down(); pg.mouse.move(hb['x']+400, hb['y']+120, steps=8); pg.mouse.up(); pg.wait_for_timeout(300)
    r = pg.evaluate(f"()=>{{const o=document.querySelector('#outliner').getBoundingClientRect(), s=document.querySelector('#stage').getBoundingClientRect(); return [document.querySelector('#app').classList.contains('tree-float'), o.left>300, s.left<5, !!{E}.LAYOUT().tree]}}")
    pg.click('#treeDock'); pg.wait_for_timeout(300)
    r2 = pg.evaluate("()=>[document.querySelector('#app').classList.contains('tree-float'), document.querySelector('#outliner').getBoundingClientRect().left]")
    check('arborescence : réduite en rail, déplacée sur la vue, remise à gauche', w0 > 200 and w1[0] < 60 and w1[1] == 'none' and r == [True, True, True, True] and r2 == [False, 0], [w0, w1, r, r2])
