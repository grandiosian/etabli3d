"""Tôle pliée : ligne médiane ouverte, plis, cas refusés, bouton Tôle et éditeur."""
import os

NIVEAU = 3

# Une pièce tôle créée en JS à partir d'une liste de points (ligne ouverte) ; renvoie le contrôle et la géométrie.
TOLE = """(a)=>{const E=%s; const [pts,t,W,r]=a; const d={nid:1,pts:[],lines:[],circles:[],beziers:[],cons:[]};
  pts.forEach(q=>d.pts.push({id:d.nid++,x:q[0],y:q[1]})); for(let i=0;i<pts.length-1;i++) d.lines.push({id:d.nid++,a:d.pts[i].id,b:d.pts[i+1].id});
  const p=E.newPart('tole',{params:{t,W,r,sk:d}}); const c=E.toleCheck(p.params); const g=E.getGeometry(p); g.computeBoundingBox(); const b=g.boundingBox;
  const st=E.meshStats(g); return {ok:c.ok, err:c.err||null, warn:c.warn||null, bends:c.bends, flat:c.flat, open:st.open, vol:Math.abs(E.signedVolume(g)),
    box:[b.min.x,b.min.y,b.min.z,b.max.x,b.max.y,b.max.z].map(v=>Math.round(v*100)/100)};}""" % 'window.__etabli'


def run(t):
    pg, check, E, OUT, URL, b, errors = t.pg, t.check, t.E, t.OUT, t.URL, t.browser, t.errors
    ev = lambda pts, tt=2, W=30, r=2: pg.evaluate(TOLE, [pts, tt, W, r])

    # Cas simple : un seul segment = plaque plate
    r = ev([[0, 0], [40, 0]])
    check('un segment : plaque plate, sans pli', r['ok'] and r['bends'] == 0 and r['box'] == [0, -1, 0, 40, 1, 30] and r['open'] == 0, r)
    check('plaque : volume 40 × 2 × 30', abs(r['vol'] - 2400) < 1, r['vol'])
    # Équerre en L : un pli à 90°, rayon intérieur 2, extérieur 4
    r = ev([[0, 0], [40, 0], [40, 30]])
    check('L : un pli, surface fermée', r['ok'] and r['bends'] == 1 and r['open'] == 0 and not r['warn'], r)
    check('L : extérieur arrondi (coin à r + t), largeur 30', r['box'][3] == 41 and r['box'][1] == -1 and r['box'][5] == 30, r['box'])
    import math
    flat = 40 - 3 + 30 - 3 + 3 * math.pi / 2   # fibre neutre au milieu : R = r + t/2 = 3
    check('L : longueur à plat (fibre au milieu)', abs(r['flat'] - flat) < 0.01, [r['flat'], flat])
    vol = (flat) * 2 * 30
    check('L : volume = longueur à plat × t × W', abs(r['vol'] - vol) < 2, [r['vol'], vol])
    # Cas difficile : U puis zigzag à angles aigus, plis gauche et droite
    r = ev([[0, 0], [0, 30], [25, 30], [25, 0]])
    check('U : deux plis, surface fermée', r['ok'] and r['bends'] == 2 and r['open'] == 0, r)
    r = ev([[0, 0], [30, 0], [10, 15], [40, 25], [40, 45]], 1.5, 20, 1.5)
    check('zigzag (plis à gauche et à droite, aigus) : surface fermée', r['ok'] and r['bends'] == 3 and r['open'] == 0, r)
    # Rayon trop petit : minimum imposé (= épaisseur), message clair
    r = ev([[0, 0], [40, 0], [40, 30]], 2, 30, 0)
    check('r = 0 : minimum imposé, message « rayon trop petit »', r['ok'] and r['warn'] and 'trop petit' in r['warn'] and r['open'] == 0, r)
    r = ev([[0, 0], [40, 0], [40, 30]], 4, 30, 2)
    check('r < t : géométrie avec r = t, pas de croisement', r['ok'] and r['warn'] and r['box'][3] == 42, r)
    # Refus propres
    r = ev([[0, 0], [5, 0], [5, 30]], 2, 30, 4)
    check('segment trop court : refusé', not r['ok'] and 'trop court' in r['err'], r['err'])
    r = ev([[0, 0], [40, 0], [40, 30], [20, -10]])
    check('ligne qui se recoupe : refusée', not r['ok'] and 'recoupe' in r['err'], r['err'])
    r = ev([[0, 0], [40, 0], [0.5, 1]])
    check('pli presque replié (> 175°) : refusé', not r['ok'] and r['err'], r['err'])
    r = ev([[0, 0], [40, 0], [40, 20], [1, 20], [1, 1.5]], 2, 30, 2)
    check("deux parties trop proches : refusé", not r["ok"] and "proches" in r["err"], r["err"])
    c = pg.evaluate(f"""()=>{{const E={E}; const d={{nid:5,pts:[{{id:1,x:0,y:0}},{{id:2,x:30,y:0}},{{id:3,x:30,y:30}}],lines:[{{id:4,a:1,b:2}},{{id:5,a:2,b:3}},{{id:6,a:3,b:1}}],circles:[],beziers:[],cons:[]}};
        return E.toleCheck({{t:2,W:30,r:2,sk:d}}).err}}""")
    check('ligne fermée : refusée (une tôle a deux bouts)', bool(c) and 'fermée' in c, c)

    # Interface : bouton Tôle → plan de face → éditeur en mode tôle, outil Ligne
    pg.evaluate("()=>document.querySelector('#bNew').click()")
    pg.click('#rack [data-sktool="tole"]'); pg.wait_for_timeout(300)
    pg.click('#planePick [data-plane="xz"]'); pg.wait_for_timeout(300)
    check('bouton Tôle : éditeur en mode tôle, outil Ligne, plan XZ', pg.evaluate(f"()=>[{E}.SK.mode,{E}.SK.tool,{E}.SK.plane]") == ['tole', 'line', 'xz'])
    bb = pg.locator('#skCanvas').bounding_box()
    def w2s(x, y):
        v = pg.evaluate(f"()=>{{const S={E}.SK, c=document.getElementById('skCanvas').getBoundingClientRect();"
                        f" return [c.width/2+({x}-S.view.cx)*S.view.s, c.height/2-({y}-S.view.cy)*S.view.s]}}")
        return bb['x'] + v[0], bb['y'] + v[1]
    pg.mouse.click(*w2s(0, 0)); pg.mouse.click(*w2s(40, 0)); pg.mouse.click(*w2s(40, 30)); pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    check('ligne ouverte tracée : état « 1 pli », Valider actif', 'pli' in pg.inner_text('#skStatus') and pg.is_enabled('#skOk'), pg.inner_text('#skStatus'))
    pg.screenshot(path=os.path.join(OUT, 'tole_esquisse.png'))
    pg.click('#skOk'); pg.wait_for_timeout(400)
    r = pg.evaluate(f"()=>{{const p={E}.state.parts.at(-1); return [p.kind, p.params.plane, p.params.t, p.params.W, p.params.r, p.rot]}}")
    check('Valider : pièce tôle debout sur le plan de face', r == ['tole', 'xz', 2, 30, 2, [90, 0, 0]], r)
    check('Propriétés : champs Épaisseur, Largeur, Rayon de pli', all(pg.locator(f'#inspBody [aria-label="{k}"]').count() for k in ['Épaisseur', 'Largeur', 'Rayon de pli']))
    check('Propriétés : nombre de plis et longueur à plat', '1 pli' in pg.inner_text('#inspBody') and 'Longueur à plat' in pg.inner_text('#inspBody'))
    f = pg.locator('#inspBody [aria-label="Rayon de pli"]'); f.fill('0'); f.press('Enter'); pg.wait_for_timeout(300)
    check('rayon 0 tapé : message dans Propriétés', 'trop petit' in pg.inner_text('#inspBody'), pg.inner_text('#inspBody')[:300])
    f = pg.locator('#inspBody [aria-label="Rayon de pli"]'); f.fill('2'); f.press('Enter'); pg.wait_for_timeout(300)
    pg.screenshot(path=os.path.join(OUT, 'tole.png'))
    # Ligne Esquisse classique, ligne ouverte, puis mode « Tôle pliée » dans l'éditeur
    pg.click('#rack [data-sktool="line"]'); pg.click('#planePick [data-plane="xy"]'); pg.wait_for_timeout(300)
    bb = pg.locator('#skCanvas').bounding_box()
    pg.mouse.click(*w2s(0, 0)); pg.mouse.click(*w2s(30, 0)); pg.mouse.click(*w2s(30, 20)); pg.mouse.click(*w2s(60, 20)); pg.keyboard.press('Escape')
    check('ligne ouverte en mode Extrusion : Valider grisé', not pg.is_enabled('#skOk'))
    pg.click('#skModeTole'); pg.wait_for_timeout(100)
    check('mode Tôle pliée choisi : « 2 plis », Valider actif', '2 plis' in pg.inner_text('#skStatus') and pg.is_enabled('#skOk'), pg.inner_text('#skStatus'))
    pg.click('#skOk'); pg.wait_for_timeout(400)
    check('deux tôles dans la scène', pg.evaluate(f"()=>{E}.state.parts.filter(p=>p.kind==='tole').length") == 2)
    # Rouvrir : l'éditeur revient en mode tôle et garde l'épaisseur
    pg.evaluate(f"()=>{{const p={E}.state.parts.at(-1); p.params.t=3; {E}.openSketch(p);}}"); pg.wait_for_timeout(300)
    check('rouvrir une tôle : mode tôle', pg.evaluate(f"()=>{E}.SK.mode") == 'tole')
    pg.click('#skOk'); pg.wait_for_timeout(300)
    check('épaisseur conservée après modification de la ligne', pg.evaluate(f"()=>{E}.state.parts.at(-1).params.t") == 3)
    # Validation (atelier Valider) : la tôle est fermée
    v = pg.evaluate(f"()=>{{const E={E}; const p=E.state.parts.at(-1); E.validatePart(p); return [p.valid.level, p.valid.issues.map(i=>i.title)]}}")
    check('tôle validée, surface fermée', v[0] in ('ok', 'warn') and 'Surface fermée' in v[1], v)
    # Compatibilité : un fichier sans tôle s'ouvre comme avant (esquisse classique inchangée)
    r = pg.evaluate(f"()=>{{const E={E}; const p=E.newPart('sketch',{{params:{{sk:{{nid:6,pts:[{{id:1,x:0,y:0}},{{id:2,x:10,y:0}},{{id:3,x:10,y:10}},{{id:4,x:0,y:10}}],lines:[{{id:5,a:1,b:2}},{{id:6,a:2,b:3}},{{id:7,a:3,b:4}},{{id:8,a:4,b:1}}],circles:[],cons:[]}},mode:'extrude',h:5}}}}); const g=E.getGeometry(p); return Math.round(Math.abs(E.signedVolume(g)))}}")
    check('esquisse ancienne (sans beziers ni plan) inchangée', r == 500, r)

    # Exemple « Équerre en tôle » : les cotes de l'esquisse sont cohérentes, la tôle est valide
    pg.evaluate(f"()=>{E}.loadExample('tole')"); pg.wait_for_timeout(500)
    r = pg.evaluate(f"""()=>{{const E={E}; const p=E.state.parts[0]; const s=E.SK.d; E.SK.d=JSON.parse(JSON.stringify(p.params.sk)); const e=E.skSolve(); E.SK.d=s;
        const c=E.toleCheck(p.params); return [p.kind, e<1e-3, c.ok, c.bends, p.params.sk.cons.filter(k=>k.type==='dx'||k.type==='dy').map(k=>k.value)]}}""")
    check('exemple Équerre en tôle : 1 pli, cotes 40 et 30 tenues', r == ['tole', True, True, 1, [40, 30]], r)
    pg.screenshot(path=os.path.join(OUT, 'tole_exemple.png'))

    # Tuto « Une tôle pliée » lancé depuis la bibliothèque, chaque étape faite à la souris
    pg.evaluate(f"()=>{E}.openGallery('all')"); pg.wait_for_timeout(200)
    pg.locator('#galleryBody .gal-card[data-k="tuto:tole"]').click(); pg.wait_for_timeout(400)
    done = lambda: pg.evaluate(f"()=>{E}.GUIDE.done.slice()")
    pg.click('#rack [data-sktool="line"]'); pg.wait_for_timeout(200); pg.click('#planePick [data-plane="xz"]'); pg.wait_for_timeout(700)
    d1 = done()
    bb = pg.locator('#skCanvas').bounding_box()
    pg.mouse.click(*w2s(0, 0)); pg.mouse.click(*w2s(37, 0)); pg.mouse.click(*w2s(37, 28)); pg.keyboard.press('Escape'); pg.wait_for_timeout(700)
    d2 = done()
    pg.click('[data-tool=dim]'); pg.mouse.click(*w2s(18, 0)); pg.wait_for_timeout(100); pg.keyboard.type('40'); pg.keyboard.press('Enter'); pg.wait_for_timeout(100)
    pg.mouse.click(*w2s(40, 14)); pg.wait_for_timeout(100); pg.keyboard.type('30'); pg.keyboard.press('Enter'); pg.wait_for_timeout(700)
    d3 = done()
    pg.click('#skModeTole'); pg.click('#skOk'); pg.wait_for_timeout(1200)
    d4 = done()
    check('tuto tôle : étape 1 (Ligne, plan Face)', d1[:1] == [True], d1)
    check('tuto tôle : étape 2 (ligne en L)', d2[:2] == [True, True], d2)
    check('tuto tôle : étape 3 (deux cotes)', d3[:3] == [True, True, True], d3)
    check('tuto tôle : étapes 4 à 6 (Tôle pliée, épaisseur, largeur, rayon)', d4[:6] == [True] * 6, d4)
    r = pg.evaluate(f"()=>{{const p={E}.state.parts.find(q=>q.kind==='tole'); return [p.params.plane, p.params.sk.cons.filter(c=>['dist','dx','dy'].includes(c.type)).map(c=>c.value)]}}")
    check('tuto tôle : pièce debout, cotes 40 et 30', r == ['xz', [40, 30]], r)
    pg.screenshot(path=os.path.join(OUT, 'tole_tuto.png'))
