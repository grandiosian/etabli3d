"""Languette, panneaux plaqués, arborescence."""
import os

NIVEAU = 3


def run(t):
    pg, check, E, OUT, URL, b, errors = t.pg, t.check, t.E, t.OUT, t.URL, t.browser, t.errors
    # Onglet Création mécanique, cube de vue remonté, liseré de la languette
    pg.evaluate(f"()=>{E}.setWs('model')"); pg.click('#rack [data-rtab="meca"]'); pg.wait_for_timeout(100)
    r = pg.evaluate("()=>[document.querySelector('#rackMeca').hidden, document.querySelectorAll('#rackMeca .shape').length, document.querySelector('#rackBasic').hidden]")
    pg.click('#rack [data-rtab="vol"]')
    check('onglet « Création mécanique » : roue dentée et crémaillère', r == [False, 2, True], r)
    r = pg.evaluate("()=>{const v=document.querySelector('#views').getBoundingClientRect(), k=document.querySelector('#rack').getBoundingClientRect(), t=document.querySelector('#toolbar').getBoundingClientRect(); return [v.top < t.bottom, v.top >= k.bottom-1, getComputedStyle(document.querySelector('.ed-rim')).backgroundColor]}")
    check('cube de vue juste sous la barre de création ; languette liserée de blanc', r[0] and r[1] and r[2] in ('rgb(255, 255, 255)','rgb(232, 238, 235)'), r)
    r = pg.evaluate("()=>{const g=document.querySelector('#views > .pgrip'); return [getComputedStyle(g).position, getComputedStyle(g).backgroundColor]}")
    check('cube de vue : poignée et réduire dans les coins, sans barre', r[0] == 'absolute' and r[1] in ('rgba(0, 0, 0, 0)','transparent'), r)
    pg.evaluate("()=>document.documentElement.dataset.theme='dark'"); pg.wait_for_timeout(100)
    r = pg.evaluate("()=>[getComputedStyle(document.querySelector('.ed-rim')).backgroundColor, getComputedStyle(document.querySelector('.ed-shape')).backgroundColor]")
    pg.evaluate("()=>document.documentElement.dataset.theme=''"); pg.wait_for_timeout(100)
    check('languette en mode sombre : liseré et fond sombres', r[0] != 'rgb(255, 255, 255)' and not r[1].startswith('rgba(248') and not r[1].startswith('color(srgb 0.97'), r)
    # Plaquer un panneau contre un côté oblique de la languette : seulement la Grille, le Guide et les Propriétés
    pg.evaluate(f"()=>{{const E={E}; E.prefs.nav='show'; E.applyNavBar();}}"); pg.wait_for_timeout(100)
    def drag_to(grip, tx, ty):
        g = pg.locator(grip).first.bounding_box(); pg.mouse.move(g['x']+5, g['y']+6); pg.mouse.down(); pg.mouse.move(tx, ty, steps=12); pg.mouse.up(); pg.wait_for_timeout(350)
    ed = pg.locator('.ed-wrap').bounding_box(); g = pg.locator('#snapBox .pgrip').bounding_box()
    pg.mouse.move(g['x']+5, g['y']+8); pg.mouse.down(); pg.mouse.move(ed['x']-60, ed['y']+20, steps=12); pg.wait_for_timeout(50)
    hint = pg.evaluate("()=>[document.querySelector('.ed-row').classList.contains('snap-L'), !!document.querySelector('#edWingL > .dock-ghost')]"); pg.mouse.up(); pg.wait_for_timeout(300)
    r = pg.evaluate(f"()=>{{const n=document.querySelector('#snapBox'), w=document.querySelector('#edWingL').getBoundingClientRect(), e=document.querySelector('.ed-rim').getBoundingClientRect(); return [{E}.LAYOUT().snapBox && {E}.LAYOUT().snapBox.dock, n.parentElement.id, Math.abs(w.height-e.height)<1.5, getComputedStyle(n).clipPath.startsWith('polygon'), w.right>e.left && w.right<e.left+30]}}")
    check('grille plaquée à gauche de la languette : même hauteur, bord oblique (aperçu pendant le glisser)', hint == [True, True] and r == ['L', 'edWingL', True, True, True], [hint, r])
    ed = pg.locator('.ed-wrap').bounding_box(); drag_to('#navBar .pgrip', ed['x']+ed['width']+20, ed['y']+15)
    ed = pg.locator('.ed-wrap').bounding_box(); drag_to('#views > .pgrip', ed['x']-200, ed['y']+10)
    r = pg.evaluate(f"()=>[document.querySelector('#navBar').parentElement.id, document.querySelector('#views').parentElement.id, !!({E}.LAYOUT().navBar||{{}}).dock, !!({E}.LAYOUT().views||{{}}).dock, document.querySelectorAll('.ed-wing > .docked, .dock-sp').length]")
    check('navigation et cube de vue ne se plaquent pas', r == ['stage', 'stage', False, False, 1], r)
    pg.evaluate(f"()=>{{const E={E}; delete E.LAYOUT().navBar; delete E.LAYOUT().views; E.applyNavBar();}}"); pg.evaluate("()=>{for(const k of ['navBar','views']){const e=document.querySelector('#'+k); for(const p of ['left','top','right','bottom','transform']) e.style[p]='';}}")
    pg.evaluate(f"()=>{E}.resetLayout()"); pg.wait_for_timeout(300)
    g = pg.locator('#snapBox .pgrip').bounding_box(); ed = pg.locator('.ed-wrap').bounding_box(); drag_to('#snapBox .pgrip', ed['x']-60, ed['y']+20)
    g = pg.locator('#snapBox .pgrip').bounding_box(); pg.mouse.move(g['x']+5, g['y']+8); pg.mouse.down(); pg.mouse.move(g['x']+60, g['y']+400, steps=10); pg.mouse.up(); pg.wait_for_timeout(200)
    r = pg.evaluate(f"()=>[document.querySelector('#snapBox').parentElement.id, !!({E}.LAYOUT().snapBox||{{}}).dock, document.querySelector('#snapBox').classList.contains('docked')]")
    check('le panneau se décroche en le glissant', r == ['stage', False, False], r)
    # Les grands panneaux : guide à gauche, propriétés à droite, grille à gauche ; le cube de vue reste dans le coin
    # (niveau Intermédiaire : sans l'arborescence, il y a la place pour les trois à 1400 px)
    pg.click('#lvl [data-lvl="2"]'); pg.wait_for_timeout(300)
    pg.evaluate(f"()=>{{const E={E}; E.LAYOUT().demo=null; if(!document.querySelector('#demo').offsetParent) document.querySelector('#bGuide').click();}}"); pg.wait_for_timeout(200)
    ed = pg.locator('.ed-wrap').bounding_box(); drag_to('#demo .demo-grip', ed['x']-120, ed['y']+10)
    ed = pg.locator('.ed-wrap').bounding_box(); drag_to('#insp .insp-tt', ed['x']+ed['width']+60, ed['y']+40)
    ed = pg.locator('.ed-wrap').bounding_box(); drag_to('#snapBox .pgrip', ed['x']-40, ed['y']+15)
    r = pg.evaluate("""()=>{const q=s=>document.querySelector(s), b=s=>q(s).getBoundingClientRect(), w=b('.ed-wrap'), t=q('#toolbar'), cs=getComputedStyle(t), tl=t.getBoundingClientRect().left+parseFloat(cs.paddingLeft), tr=t.getBoundingClientRect().right-parseFloat(cs.paddingRight), sh=q('.ed-shape'), st=b('#stage'), v=b('#views'), d=getComputedStyle(q('#demo')), i=getComputedStyle(q('#insp'));
      return [['demo','insp'].map(k=>q('#'+k).classList.contains('docked-tall') && q('#dsp-'+k)?.parentElement.id), q('#snapBox').parentElement.id, Math.abs(b('#demo').top-w.top)<2 && Math.abs(b('#insp').top-w.top)<2, b('#insp').left>=w.right-32, d.clipPath.startsWith('polygon') && i.clipPath.startsWith('polygon'), d.borderLeftWidth==='4px' && d.borderTopWidth==='0px' && i.borderTopWidth==='0px', d.backgroundImage.includes('gradient') && i.backgroundImage.includes('gradient'), Math.abs((w.left+w.right)/2-(tl+tr)/2)<3, sh.scrollWidth<=sh.clientWidth+1, st.right-v.right<14 && v.top<b('#toolbar').bottom && v.left>b('#insp').right]}""")
    check('guide et propriétés plaqués : coin oblique liseré, liseré jaune du guide, languette centrée et entière ; cube de vue dans le coin à droite', r[0] == ['edWingL', 'edWingR'] and r[1] == 'edWingL' and all(r[2:]), r)
    pg.screenshot(path=os.path.join(OUT, 'panneaux-plaques.png'))
    pg.set_viewport_size({'width': 1000, 'height': 860}); pg.wait_for_timeout(500)
    r = pg.evaluate("()=>{const s=document.querySelector('.ed-shape'); return [s.scrollWidth<=s.clientWidth+1, ['#edWingL','#edWingR'].every(k=>{const w=document.querySelector(k); return !w.offsetParent || w.scrollWidth<=w.clientWidth+1}), ['demo','insp','snapBox'].some(k=>document.querySelector('#'+k).dataset.noroom)]}")
    pg.set_viewport_size({'width': 1400, 'height': 860}); pg.wait_for_timeout(500)
    r2 = pg.evaluate("()=>[document.querySelector('#snapBox').parentElement.id, !!document.querySelector('#demo').dataset.noroom, !!document.querySelector('#insp').dataset.noroom]")
    check('fenêtre étroite : rien n’est coupé, un panneau retourne sur la vue ; plus large : il revient', r == [True, True, True] and r2 == ['edWingL', False, False], [r, r2])
    pg.evaluate(f"()=>{E}.setWs('check')"); pg.wait_for_timeout(300)
    r2 = pg.evaluate("()=>[document.querySelector('#demo').parentElement.id, document.querySelector('#snapBox').parentElement.id, document.querySelector('#insp').classList.contains('docked')]")
    pg.evaluate(f"()=>{E}.setWs('model')"); pg.wait_for_timeout(300)
    r3 = pg.evaluate("()=>['demo','insp'].map(k=>document.querySelector('#'+k).classList.contains('docked-tall'))")
    check('hors de Modéliser, les panneaux plaqués reviennent sur la vue, puis se replaquent', r2 == ['stage', 'stage', False] and r3 == [True, True], [r2, r3])
    pg.evaluate(f"()=>{E}.resetLayout()"); pg.wait_for_timeout(300)
    r = pg.evaluate("()=>[document.querySelector('#demo').parentElement.id, document.querySelector('#snapBox').parentElement.id, document.querySelectorAll('.dock-sp').length]")
    check('« Remettre les panneaux à leur place » les décroche tous', r == ['stage', 'stage', 0], r)
    pg.click('#lvl [data-lvl="3"]'); pg.wait_for_timeout(300)
    pg.evaluate(f"()=>{{const E={E}; E.prefs.nav='auto'; E.applyNavBar();}}")
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
