"""Options de rendu et matières des pièces."""
import os

NIVEAU = 3


def run(t):
    pg, check, E, OUT, URL, b, errors = t.pg, t.check, t.E, t.OUT, t.URL, t.browser, t.errors
    # Options de rendu : arêtes, fil de fer, rayons X, ombres, éclairage
    pg.evaluate(f"()=>{E}.loadExample('maison')"); pg.wait_for_timeout(400)
    pg.click('#bLook'); pg.wait_for_timeout(100)
    pg.locator('#menuLook .look-rend button', has_text='Fil de fer').click(); pg.wait_for_timeout(100)
    a = pg.evaluate(f"()=>[...{E}.meshes.values()].every(r=>r.mesh.material.wireframe)")
    pg.locator('#menuLook .look-rend button', has_text='Arêtes').click(); pg.wait_for_timeout(100)
    bb_ = pg.evaluate(f"()=>[...{E}.meshes.values()].every(r=>r.line && r.line.material==={E}.edgeLineMat && !r.mesh.material.wireframe)")
    pg.locator('#menuLook .look-rend button', has_text='Rayons X').click(); pg.wait_for_timeout(100)
    c = pg.evaluate(f"()=>[...{E}.meshes.values()].every(r=>r.mesh.material.transparent && r.mesh.material.opacity<0.5)")
    pg.locator('#menuLook .look-rend button', has_text='Avec').click(); pg.locator('#menuLook .look-rend button', has_text='Contrasté').click(); pg.wait_for_timeout(300)
    d = pg.evaluate(f"()=>[{E}.renderer.shadowMap.enabled, [...{E}.meshes.values()].every(r=>r.mesh.castShadow), {E}.prefs.light]")
    pg.screenshot(path=os.path.join(OUT, 'rendu.png'))
    pg.locator('#menuLook .look-rend button', has_text='Plein').click(); pg.locator('#menuLook .look-rend button', has_text='Sans').click(); pg.locator('#menuLook .look-rend button', has_text='Atelier').click(); pg.click('#bLook')
    check('rendu : fil de fer, arêtes, rayons X, ombres et éclairage', a and bb_ and c and d == [True, True, 'contraste'], [a, bb_, c, d])
    pg.click('#bLook'); pg.wait_for_timeout(100)
    pg.locator('#menuLook .look-rend button', has_text='Texture').click(); pg.wait_for_timeout(100)
    pg.locator('#menuLook .look-rend button', has_text='Bois').click(); pg.wait_for_timeout(300)
    t = pg.evaluate(f"()=>[[...{E}.meshes.values()].every(r=>'TEX' in (r.mesh.material.defines||{{}})), {E}.TEXK.value]")
    pg.locator('#menuLook .look-rend button', has_text='Haute').click(); pg.wait_for_timeout(500)
    q = pg.evaluate(f"()=>[{E}.renderer.getPixelRatio()>1, {E}.renderer.toneMapping!==0, !!{E}.scene_().environment]")
    pg.screenshot(path=os.path.join(OUT, 'rendu-hq.png'))
    pg.locator('#menuLook .look-rend button', has_text='Normale').click(); pg.locator('#menuLook .look-rend button', has_text='Plein').click(); pg.wait_for_timeout(200)
    t2 = pg.evaluate(f"()=>[[...{E}.meshes.values()].some(r=>'TEX' in (r.mesh.material.defines||{{}})), {E}.renderer.toneMapping, !!{E}.scene_().environment]")
    pg.click('#bLook')
    check('mode texture (bois) et haute qualité (environnement, tons film), puis retour', t == [True, 2] and q == [True, True, True] and t2 == [False, 0, False], [t, q, t2])
    # Matières des pièces : motif propre à chaque pièce, couleur naturelle, masse, image importée, enregistrement
    pid = pg.evaluate(f"()=>{E}.state.parts.find(p=>p.kind!=='group' && !p.hole).id")
    pg.evaluate(f"()=>{E}.setSel([{pid}])"); pg.wait_for_timeout(200)
    pg.locator('#inspBody .mat-b', has_text='Bois').click(); pg.wait_for_timeout(300)
    r = pg.evaluate(f"()=>{{const p={E}.state.parts.find(p=>p.id==={pid}), m={E}.meshes.get({pid}).mesh.material; return [p.mat && p.mat.k, p.color, 'TEX' in (m.defines||{{}}), m.userData.u.texK.value, /Masse/.test(document.querySelector('#inspBody').textContent)]}}")
    import base64
    png = os.path.join(OUT, 'motif.png')
    with open(png, 'wb') as f: f.write(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg=='))
    with pg.expect_file_chooser() as fc: pg.locator('#inspBody .mat-imp').click()
    fc.value.set_files(png); pg.wait_for_timeout(800)
    r2 = pg.evaluate(f"()=>{{const p={E}.state.parts.find(p=>p.id==={pid}), m={E}.meshes.get({pid}).mesh.material, tx={E}.state.textures||{{}}; return [p.mat.k, !!tx[p.mat.img] && tx[p.mat.img].src.startsWith('data:image/'), 'TEXIMG' in (m.defines||{{}}), !!m.userData.u.texImg.value, !!document.querySelector('#inspBody .mat-img.on')]}}")
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(300)
    r3 = pg.evaluate(f"()=>{{const p={E}.state.parts.find(p=>p.id==={pid}); return [p.mat && p.mat.k, 'TEXIMG' in ({E}.meshes.get({pid}).mesh.material.defines||{{}})]}}")
    pg.locator('#inspBody .mat-b', has_text='Aucune').click(); pg.wait_for_timeout(200)
    r4 = pg.evaluate(f"()=>{{const p={E}.state.parts.find(p=>p.id==={pid}), m={E}.meshes.get({pid}).mesh.material; return [!!p.mat, 'TEX' in (m.defines||{{}})]}}")
    check('matière par pièce : bois (motif, couleur, masse), image importée projetée, annuler, aucune', r == ['bois', '#c8955a', True, 2, True] and r2 == ['image', True, True, True, True] and r3 == ['bois', False] and r4 == [False, False], [r, r2, r3, r4])
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(200); pg.keyboard.press('Control+z'); pg.wait_for_timeout(200)
