"""Démarche Modéliser → Valider → simulations ; panneaux déplacés et remis."""
import os

NIVEAU = 3


def run(t):
    pg, check, E, OUT, URL, b, errors = t.pg, t.check, t.E, t.OUT, t.URL, t.browser, t.errors
    # Démarche : Modéliser -> Valider -> simulations, sans bandeau
    pg.evaluate(f"()=>{E}.loadExample('maison')"); pg.wait_for_timeout(300)
    pg.click('#rack [data-rtab="sim"]'); pg.wait_for_timeout(100)
    r = pg.evaluate("()=>[document.querySelector('#rackBasic').hidden, getComputedStyle(document.querySelector('.ed-wrap')).pointerEvents, getComputedStyle(document.querySelector('#bSketch')).pointerEvents]")
    check('onglet Simulation mécanique : seul « Valider pour simulation », le reste grisé', r == [True, 'none', 'none'], r)
    pg.click('#rackSim [data-go="check"]'); pg.wait_for_timeout(300)
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
