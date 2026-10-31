"""Perçage hachuré, tuto pas à pas, consignes du TP."""
import os

NIVEAU = 3


def run(t):
    pg, check, E, OUT, URL, b, errors = t.pg, t.check, t.E, t.OUT, t.URL, t.browser, t.errors
    # Perçage hachuré, Guide : tuto pas à pas et consignes du TP
    pg.evaluate("()=>document.querySelector('#bNew').click()"); pg.wait_for_timeout(200)
    r = pg.evaluate(f"()=>{{const E={E}; const c=E.addPart('cylinder'); c.hole=true; E.setSel([]); const m=E.meshes.get(c.id).mesh.material; return [!!m.defines && 'HATCH' in m.defines, m.transparent]}}")
    check('perçage transparent et hachuré', r == [True, True], r)
    pg.evaluate("()=>document.querySelector('#bNew').click()"); pg.wait_for_timeout(200)
    if pg.is_hidden('#demo'): pg.click('#bGuide')
    pg.locator('#demo .gd-tabs .btn', has_text='Tutos').click(); pg.locator('#demo .gd-tuto', has_text='Premiers pas').click(); pg.wait_for_timeout(200)
    pg.evaluate(f"()=>{E}.addPart('box')"); pg.wait_for_timeout(800)
    r = pg.evaluate(f"()=>[{E}.GUIDE.done[0], {E}.GUIDE.step, document.querySelector('#demo .gd-n').textContent]")
    check('tuto pas à pas : l’étape se coche seule et le guide passe à la suivante', r[0] is True and r[1] == 1 and 'Étape 2' in r[2], r)
    pg.locator('#demo .gd-tabs .btn', has_text='Mon TP').click(); pg.wait_for_timeout(100)
    pg.fill('#demo .gd-ta', 'Dessiner la plaque\nPercer le trou\nExporter en STL'); pg.locator('#demo button', has_text='Enregistrer les consignes').click(); pg.wait_for_timeout(100)
    pg.locator('#demo .gd-done input').click(); pg.wait_for_timeout(100)
    r = pg.evaluate(f"()=>{{const E={E}; return [E.state.tp.tasks.length, E.state.tp.tasks[0].done, E.GUIDE.step, JSON.parse(localStorage.getItem('etabli3d.autosave')||'{{}}').tp ? 1 : 0]}}")
    pg.wait_for_timeout(600); r[3] = pg.evaluate("()=>JSON.parse(localStorage.getItem('etabli3d.autosave')||'{}').tp?.tasks?.length||0")
    check('consignes du TP en pas à pas, cochées et enregistrées avec le projet', r == [3, True, 1, 3] and 'null' not in pg.inner_text('#demo'), r)
    pg.screenshot(path=os.path.join(OUT, 'guide-tp.png'))
