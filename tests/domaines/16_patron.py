"""Patron (papercraft) dans Valider : dépliage, chevauchements, pages A4 en SVG, coupe manuelle."""
import os, re

NIVEAU = 3

# Contrôles géométriques du dépliage, faits dans la page :
#  - aire à plat = aire de la pièce (le dépliage ne déforme pas) ;
#  - aucun triangle d'un morceau ne chevauche un autre triangle d'une AUTRE face du même morceau.
CHECK = """(pid)=>{const E=%s; const p=E.state.parts.find(q=>q.id===pid); const R=E.PAT.res; if(!R||!R.ok) return {ok:false, err:R&&R.err};
  const g=E.getGeometry(p), pos=g.attributes.position, idx=g.index, n=idx?idx.count:pos.count; let A3=0; const a=new E.camera.position.constructor(), b=a.clone(), c=a.clone();
  for(let i=0;i<n;i+=3){ a.fromBufferAttribute(pos, idx?idx.getX(i):i); b.fromBufferAttribute(pos, idx?idx.getX(i+1):i+1); c.fromBufferAttribute(pos, idx?idx.getX(i+2):i+2); A3+=b.clone().sub(a).cross(c.clone().sub(a)).length()/2; }
  let A2=0, over=0; const ar=t=>Math.abs((t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[2][0]-t[0][0])*(t[1][1]-t[0][1]))/2;
  const sep=(P,Q)=>{ for(const S of [P,Q]) for(let i=0;i<3;i++){ const u=S[i], v=S[(i+1)%%3]; const nx=u[1]-v[1], ny=v[0]-u[0], L=Math.hypot(nx,ny)||1; let p0=1e9,p1=-1e9,q0=1e9,q1=-1e9;
      for(const w of P){ const d=(w[0]*nx+w[1]*ny)/L; p0=Math.min(p0,d); p1=Math.max(p1,d); } for(const w of Q){ const d=(w[0]*nx+w[1]*ny)/L; q0=Math.min(q0,d); q1=Math.max(q1,d); }
      if(p1<=q0+1e-3||q1<=p0+1e-3) return true; } return false; };
  for(const P of R.pieces){ P.tris.forEach(t=>A2+=ar(t)); if(P.tris.length<=600) for(let i=0;i<P.tris.length;i++) for(let j=i+1;j<P.tris.length;j++) if(!sep(P.tris[i],P.tris[j])) over++; }
  return {ok:true, pieces:R.pieces.length, pages:R.svgs.length, cuts:R.nCuts, A3, A2, over, warn:R.warn, gen:E.patronGenerated()};}""" % 'window.__etabli'


def run(t):
    pg, check, E, OUT, URL, b, errors = t.pg, t.check, t.E, t.OUT, t.URL, t.browser, t.errors
    # Cas simple : la pyramide du tuto, dans l'atelier Valider
    pg.evaluate("()=>document.querySelector('#bNew').click()")
    pid = pg.evaluate(f"()=>{{const p={E}.addPart('pyramid'); Object.assign(p.params,{{L:40,l:40,h:50}}); {E}.setSel([p.id]); return p.id}}")
    pg.evaluate(f"()=>{E}.setWs('check')"); pg.wait_for_timeout(300)
    check('section Patron dans Valider', pg.is_visible('#patBtn'))
    check('pas encore de patron', pg.evaluate(f"()=>{E}.patronGenerated()") is False)
    pg.click('#patBtn'); pg.wait_for_timeout(300)
    r = pg.evaluate(CHECK, pid)
    check('pyramide : patron produit (patronGenerated)', r['ok'] and r['gen'], r)
    check('pyramide : aire à plat = aire de la pièce', abs(r['A2'] - r['A3']) < 0.01 * r['A3'], [r['A2'], r['A3']])
    check('pyramide : aucun chevauchement, une page', r['over'] == 0 and r['pages'] == 1, r)
    svg = pg.evaluate(f"()=>{E}.PAT.res.svgs[0]")
    check('SVG A4 à l’échelle réelle (210 × 297 mm, 1 unité = 1 mm)', 'width="210mm"' in svg and 'height="297mm"' in svg and 'viewBox="0 0 210 297"' in svg)
    check('SVG : barre de contrôle 50 mm, légende des plis', 'h50' in svg and 'pli vallée' in svg and 'pli montagne' in svg)
    check('SVG : plis montagne (pyramide convexe), languettes, numéros', 'stroke-dasharray="2.4 0.8 0.4 0.8"' in svg and svg.count('fill="#eceae4"') >= 2 and re.search(r'>\s*4\s*<', svg) is not None)
    nums = [float(x) for x in re.findall(r'points="([^"]+)"', svg) for x in re.split('[ ,]', x) if x]
    xs, ys = nums[0::2], nums[1::2]
    check('SVG : tout tient dans la page (marges de 10 mm)', min(xs) >= 9.9 and max(xs) <= 200.1 and min(ys) >= 9.9 and max(ys) <= 287.1, [min(xs), max(xs), min(ys), max(ys)])
    with open(os.path.join(OUT, 'patron_pyramide.svg'), 'w') as f: f.write(svg)
    check('panneau : miniatures, boutons SVG et Imprimer', pg.locator('.pat-thumb').count() == 1 and pg.is_visible('#patSvg') and pg.is_visible('#patPrint'))
    pg.screenshot(path=os.path.join(OUT, 'patron_valider.png'))
    with pg.expect_download() as dl:
        pg.click('#patSvg')
    check('bouton SVG : fichier .svg', dl.value.suggested_filename.endswith('-patron.svg'), dl.value.suggested_filename)
    pg.click('.pat-thumb'); pg.wait_for_timeout(300)
    check('grand aperçu des pages', pg.is_visible('#patView') and pg.locator('#patView .pat-page svg').count() == 1)
    pg.screenshot(path=os.path.join(OUT, 'patron_apercu.png'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    check('Échap ferme l’aperçu', pg.locator('#patView').count() == 0)

    # Coupe manuelle : un vrai clic sur une arête pliée de la pyramide (dans la vue 3D) la coupe
    pg.evaluate(f"()=>{{const P={E}.PAT; P.mode='manuel'; {E}.renderInspector();}}"); pg.click('#patBtn'); pg.wait_for_timeout(300)
    before = pg.evaluate(f"()=>{E}.PAT.res.nCuts")
    pt = pg.evaluate(f"""()=>{{const E={E}; const R=E.PAT.res; const p=E.state.parts.find(q=>q.id==={pid}); const m=E.meshes.get(p.id).mesh; m.updateMatrixWorld();
        const mid=e=>e.a.clone().add(e.b).multiplyScalar(0.5).applyMatrix4(m.matrixWorld);   // le pli le plus proche de la caméra (visible)
        const e=R.edges.filter(e=>!R.cutNames.has(e.name)).sort((x,y)=>mid(x).distanceTo(E.camera.position)-mid(y).distanceTo(E.camera.position))[0]; const v=mid(e);
        const r=E.renderer.domElement.getBoundingClientRect(); v.project(E.camera); return [r.left+(v.x+1)/2*r.width, r.top+(1-v.y)/2*r.height, e.name];}}""")
    pg.mouse.click(pt[0], pt[1]); pg.wait_for_timeout(300)
    r = pg.evaluate(f"()=>[{E}.PAT.res.cutNames.has({repr(pt[2])}), {E}.PAT.forced[{repr(pt[2])}]||null, {E}.patGroup.visible]")
    check('mode manuel : clic sur un pli dans la vue → cette arête est coupée', r[0] is True and r[1] == 'cut', r)
    check('coutures dessinées en 3D sur la pièce', r[2] is True)
    pg.screenshot(path=os.path.join(OUT, 'patron_manuel.png'))
    pg.mouse.click(pt[0], pt[1]); pg.wait_for_timeout(300)
    check('second clic : la coupure forcée est retirée', pg.evaluate(f"()=>{E}.PAT.forced[{repr(pt[2])}]||null") is None)
    pg.evaluate(f"()=>{{const P={E}.PAT; P.mode='auto'; {E}.renderInspector();}}")
    # La pièce change : le patron n'est plus à jour (le tuto le voit)
    pg.evaluate(f"()=>{{const p={E}.state.parts.find(q=>q.id==={pid}); p.params.h=80; {E}.renderInspector();}}")
    check('pièce modifiée : patron à refaire', pg.evaluate(f"()=>{E}.patronGenerated()") is False and 'a changé' in pg.inner_text('#inspBody'))

    # Cas difficile : sphère à peu de facettes, petite taille maximale → plusieurs morceaux, sans chevauchement
    pg.evaluate("()=>document.querySelector('#bNew').click()")
    pid = pg.evaluate(f"()=>{{const E={E}; const p=E.addPart('sphere'); Object.assign(p.params,{{d:120,seg:10}}); E.setSel([p.id]); E.PAT.maxSize=90; E.setWs('check'); return p.id}}")
    pg.wait_for_timeout(200); pg.click('#patBtn'); pg.wait_for_timeout(500)
    r = pg.evaluate(CHECK, pid)
    check('sphère 10 facettes, 90 mm max : plusieurs morceaux', r['ok'] and r['pieces'] > 1, r)
    check('sphère : aucun chevauchement, aire conservée', r['over'] == 0 and abs(r['A2'] - r['A3']) < 0.01 * r['A3'], [r['over'], r['A2'], r['A3']])
    check('sphère : coupures ajoutées signalées', any('coupure' in w for w in r['warn']), r['warn'])
    pg.screenshot(path=os.path.join(OUT, 'patron_sphere.png'))
    with open(os.path.join(OUT, 'patron_sphere_p1.svg'), 'w') as f: f.write(pg.evaluate(f"()=>{E}.PAT.res.svgs[0]"))
    # Échelle 200 % : morceaux deux fois plus grands
    a1 = r['A2']; pg.evaluate(f"()=>{{const E={E}; E.PAT.scale=200; E.PAT.maxSize=180; E.patronMake(E.state.parts[0], true);}}")
    r = pg.evaluate(CHECK, pid)
    check('échelle 200 % : aire à plat × 4', abs(r['A2'] - 4 * r['A3']) < 0.02 * 4 * r['A3'], [r['A2'], r['A3']])
    pg.evaluate(f"()=>{{{E}.PAT.scale=100;}}")

    # Pièce ouverte : message clair, pas de patron
    r = pg.evaluate(f"""()=>{{const E={E}; document.querySelector('#bNew').click(); const p=E.addPart('box'); p.params.L=21.234; const g=E.getGeometry(p); g.setIndex(Array.from(g.index.array).slice(0,-6));
        E.setSel([p.id]); E.patronMake(p,true); return [E.PAT.res.ok, E.PAT.res.err, E.patronGenerated()];}}""")
    check('pièce ouverte : refusée avec un message clair', r[0] is False and 'pas fermée' in r[1] and r[2] is False, r)
    pg.evaluate(f"()=>{E}.renderInspector()")
    check('message « Pas de patron » dans le panneau', 'Pas de patron' in pg.inner_text('#inspBody'))
    # Pièce dans un groupe : géométrie finale du groupe (cube percé d'un trou carré : un « anneau » → 2 morceaux)
    r = pg.evaluate(f"""()=>{{const E={E}; document.querySelector('#bNew').click(); E.setWs('model'); const a=E.addPart('box',[0,0]); Object.assign(a.params,{{L:40,l:30,h:20}});
        const c=E.addPart('box',[0,0],{{hole:true}}); Object.assign(c.params,{{L:10,l:10,h:30}}); c.pos=[0,0,-5]; E.setSel([a.id,c.id]); E.groupSel();
        const G=E.state.parts[0]; E.setWs('check'); E.setSel([G.id]); E.patronMake(G,true); return [G.kind, E.PAT.res.ok, E.PAT.res.pieces?.length, E.PAT.res.nFaces];}}""")
    check('groupe percé (trou carré) : patron de la pièce finale', r[0] == 'group' and r[1] is True and r[3] == 10, r)
    r = pg.evaluate(f"""()=>{{const E={E}; document.querySelector('#bNew').click(); E.setWs('model'); const a=E.addPart('box',[0,0]); const c=E.addPart('cylinder',[0,0],{{hole:true}});
        c.params.d=10; c.params.h=30; c.pos=[0,0,-5]; E.setSel([a.id,c.id]); E.groupSel(); const G=E.state.parts[0]; E.setWs('check'); E.setSel([G.id]); E.patronMake(G,true); return [G.kind, E.PAT.res.ok, E.PAT.res.err||''];}}""")
    check('groupe percé d’un cylindre à 48 facettes : défauts du calcul signalés, pas de patron faux', r[0] == 'group' and (r[1] is True or 'groupe' in r[2]), r)
    # Une tôle se déplie aussi
    r = pg.evaluate(f"()=>{{const E={E}; document.querySelector('#bNew').click(); const p=E.state.parts.push(E.newPart('tole')); const q=E.state.parts[0]; E.setSel([q.id]); E.patronMake(q,true); return E.PAT.res.ok}}")
    check('tôle : patron possible (pièce fermée)', r is True)

    # Exemple « Pyramide à monter » : un seul morceau, comme l'annonce sa fiche
    pg.evaluate(f"()=>{E}.loadExample('pyramide')"); pg.wait_for_timeout(500)
    r = pg.evaluate(f"()=>{{const E={E}; const p=E.state.parts[0]; E.setSel([p.id]); E.patronMake(p,true); return [p.kind, E.PAT.res.ok, E.PAT.res.pieces.length]}}")
    check('exemple Pyramide à monter : patron en un seul morceau', r == ['pyramid', True, 1], r)

    # Tuto « Un patron à imprimer » lancé depuis la bibliothèque, chaque étape faite à la souris
    pg.evaluate(f"()=>{E}.setWs('model')"); pg.evaluate(f"()=>{E}.openGallery('all')"); pg.wait_for_timeout(200)
    pg.locator('#galleryBody .gal-card[data-k="tuto:patron"]').click(); pg.wait_for_timeout(400)
    done = lambda: pg.evaluate(f"()=>{E}.GUIDE.done.slice()")
    pg.click('#rack [data-rtab="vol"]'); pg.click('#rackBasic [title="Ajouter : Pyramide"]'); pg.wait_for_timeout(700)
    d1 = done()
    for lab, v in [('Longueur (X)', '40'), ('Largeur (Y)', '40'), ('Hauteur (Z)', '50')]:
        f = pg.locator(f'#inspBody [aria-label="{lab}"]'); f.fill(v); f.press('Enter'); pg.wait_for_timeout(150)
    pg.wait_for_timeout(600); d2 = done()
    pg.click('#rack [data-rtab="sim"]'); pg.wait_for_timeout(200); pg.click('#rack [data-go="check"]'); pg.wait_for_timeout(700)
    d3 = done()
    pg.click('#patBtn'); pg.wait_for_timeout(800)
    d4 = done()
    check('tuto patron : étape 1 (pyramide ajoutée)', d1[:1] == [True], d1)
    check('tuto patron : étape 2 (40 × 40 × 50)', d2[:2] == [True, True], d2)
    check('tuto patron : étape 3 (atelier Valider)', d3[:3] == [True] * 3, d3)
    check('tuto patron : étape 4 (Patron cliqué)', d4[:4] == [True] * 4, d4)
    pg.screenshot(path=os.path.join(OUT, 'patron_tuto.png'))
