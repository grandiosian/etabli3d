"""Bibliothèque, exercice vérifié tout seul, démarrage de chaque tuto."""
import os

NIVEAU = 3


def run(t):
    pg, check, E, OUT, URL, b, errors = t.pg, t.check, t.E, t.OUT, t.URL, t.browser, t.errors
    # Bibliothèque : onglets, filtres, avancement ; exercice vérifié tout seul
    pg.evaluate(f"()=>{E}.openGallery('all')"); pg.wait_for_timeout(200)
    nAll = pg.locator('#galleryBody .gal-card').count()
    pg.click('#libTabs [data-t="exo"]'); pg.wait_for_timeout(100)
    r = [pg.locator('#galleryBody .gal-card').count(), pg.locator('#galleryBody .gal-card.lb-exo').count()]
    pg.click('#libLvl [data-l="1"]'); pg.wait_for_timeout(100)
    r.append(pg.evaluate("()=>[...document.querySelectorAll('#galleryBody .gal-card .gal-lvl')].every(e=>e.textContent==='Débutant')"))
    check('bibliothèque : onglet Exercices et filtre de niveau', nAll > 30 and r[0] == r[1] and r[0] >= 6 and r[2], [nAll, r])
    pg.click('#libTabs [data-t="all"]'); pg.click('#libLvl [data-l="0"]')
    pg.locator('#galleryBody .gal-card[data-k="exo:plaque"]').click(); pg.wait_for_timeout(300)
    check('l’exercice s’ouvre dans le guide avec sa consigne', pg.is_hidden('#gallery') and pg.locator('#demo .gd-brief').count() == 1 and pg.locator('#demo .gd-crit li').count() == 3)
    pg.evaluate(f"""()=>{{const E={E}; const a=E.addPart('box',[0,0]); a.params={{L:60,l:30,h:4}}; const c1=E.addPart('cylinder',[20,0]); c1.params.d=5; c1.params.h=10; c1.hole=true;
      const c2=E.addPart('cylinder',[-20,0]); c2.params.d=5; c2.params.h=10; c2.hole=true; E.setSel([a.id,c1.id,c2.id]); E.groupSel();}}"""); pg.wait_for_timeout(1200)
    r = pg.evaluate(f"()=>[!!{E}.PROG.done['exo:plaque'], document.querySelectorAll('#demo .gd-crit li.ok').length, !!document.querySelector('#demo .gd-bravo')]")
    check('exercice réussi : critères cochés tout seuls, marqué terminé', r == [True, 3, True], r)
    pg.evaluate(f"()=>{E}.openGallery('exo')"); pg.wait_for_timeout(100)
    check('la bibliothèque affiche « Terminé » sur l’exercice', 'Terminé' in pg.inner_text('#galleryBody .gal-card[data-k="exo:plaque"]'))
    pg.screenshot(path=os.path.join(OUT, 'bibliotheque.png'))
    pg.click('#galleryClose')
    # chaque tuto et exercice a une scène de départ qui marche
    r = pg.evaluate(f"""()=>{{const E={E}, bad=[]; for(const k of Object.keys(E.LESSONS)){{ try{{ E.startLesson(k); }}catch(e){{ bad.push(k+': '+e.message); }} }} return bad;}}""")
    check('tous les tutos et exercices démarrent', r == [], r)
