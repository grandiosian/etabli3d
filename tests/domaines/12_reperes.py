"""Repères d’échelle et boutons du cube de vue."""
import os

NIVEAU = 3


def run(t):
    pg, check, E, OUT, URL, b, errors = t.pg, t.check, t.E, t.OUT, t.URL, t.browser, t.errors
    # Repères d'échelle
    pg.evaluate(f"()=>{E}.loadExample('maison')"); pg.wait_for_timeout(500)
    r = pg.evaluate(f"""()=>{{const E={E}; E.setRef('auto'); const b=new (E.camera.position.constructor)(); const B=E.state.parts.length;
      const pb=E.partsBox(), D=Math.max(pb.max.x-pb.min.x, pb.max.y-pb.min.y, pb.max.z-pb.min.z), rb=new (pb.constructor)().setFromObject(E.REF.group);
      return [E.REF.kind===E.refAuto(D), E.REF.group.visible, [...E.meshes.values()].every(m=>!m.mesh.userData.ref), Math.abs(rb.min.z)<1];}}""")
    pg.wait_for_timeout(100); r.append(pg.evaluate(f"()=>{{const E={E}; const b=new (E.partsBox().constructor)().setFromObject(E.REF.group); return b.min.y>100 && E.REF.group.children.some(o=>o.visible && o.children.length===3)}}"))
    check('repère d’échelle automatique, loin derrière le plan de travail, avec sa plaque, hors des pièces', all(r), r)
    r = pg.evaluate(f"()=>[{E}.refAuto(60), {E}.refAuto(300), {E}.refAuto(3000), {E}.refAuto(15000), {E}.refAuto(40000), {E}.refAuto(20), {E}.refAuto(1500)]")
    check('repère choisi selon la taille : pièce, pomme, canette, personne, voiture, immeuble, avion', r == ['pomme','canette','voiture','immeuble','avion','piece','personne'], r)
    r = pg.evaluate(f"""()=>{{const E={E}; E.setRef('pomme'); const vis=E.REF.group.children.filter(o=>o.visible); const xs=vis.map(o=>o.position.x).sort((a,b)=>a-b);
      const sb=[...E.meshes.values()].reduce((b,r)=>b.union(new (E.partsBox().constructor)().setFromObject(r.mesh)), new (E.partsBox().constructor)());
      E.setRef('auto'); return [E.refSeries('pomme').join(','), vis.length, xs[0]<xs[1] && xs[1]<xs[2]];}}""")
    check('série de trois repères côte à côte (pièce, pomme, canette)', r == ['piece,pomme,canette', 3, True], r)
    pg.click('#views [data-view=fit]'); pg.wait_for_timeout(600)
    r = pg.evaluate(f"()=>{{const E={E}, c=E.cam(), pb=E.partsBox(); return c.position.distanceTo(E.orbit_().target) < 3*pb.getSize(new (c.position.constructor)()).length() + 60}}")
    check('« Tout voir » cadre les pièces seules, sans les repères d’échelle', r)
    pg.click('#refBtn'); pg.wait_for_timeout(100); pg.locator('#refMenu button', has_text='Voiture').click(); pg.wait_for_timeout(300)
    r = pg.evaluate(f"()=>[{E}.REF.kind, {E}.prefs.ref, {E}.stlBinary([...{E}.meshes.values()]).length]")
    check('menu du repère : voiture choisie, l’export STL ne la contient pas', r[0] == 'voiture' and r[1] == 'voiture', r)
    pg.evaluate(f"()=>{E}.setRef('auto')")
    r = pg.evaluate("()=>{const w=document.querySelector('#views .vc-wrap').getBoundingClientRect(), c=[w.left+w.width/2, w.top+w.height/2]; return [...document.querySelectorAll('#views .vc-b')].filter(b=>b.offsetParent).map(b=>{const r=b.getBoundingClientRect(); return Math.round(Math.hypot(r.left+r.width/2-c[0], r.top+r.height/2-c[1]));})}")
    check('boutons du cube de vue en cercle autour de lui', len(r) == 6 and max(r)-min(r) <= 1, r)
