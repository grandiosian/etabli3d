# Établi 3D — notes pour Claude

- Application pour des élèves de collège : tous les textes visibles sont en français, ton simple et direct.
- Le code source est dans `src/`. Ne modifiez jamais `dist/` à la main : lancez `python3 build.py`.
- Les fichiers `src/*.js` partagent une seule portée (concaténés dans l'ordre de `JS_ORDER` dans `build.py`). Pas d'`import`/`export` entre eux ; seuls three.js et three-bvh-csg sont importés, via l'import map.
- Repère : Z vers le haut, unités en millimètres, chaque pièce a sa base à z = 0 dans son repère local.
- Avant de pousser : `npm test` (nécessite `npm install` et Playwright) doit afficher « TOUT EST OK ».
- `dist/artifact.html` est la même page sans `<html>`/`<head>`, pour la version publiée sur claude.ai.
- Les exemples de démonstration sont dans `src/examples.js` (objet `SAMPLES`) : chaque exemple a une fiche « À observer / À essayer » ; les positions sont en coordonnées monde.
- Niveaux : `<html data-level="1|2|3">`. Marquez un élément `data-min="2"` ou `data-min="3"` pour le réserver à un niveau, `data-max="2"` pour le masquer au-dessus ; en JS, testez `lv(n)`. Les formes ont leur niveau dans `KIND_LVL`, chaque exemple dans `level`.
- Ateliers : `<html data-ws="model|check|mech|struct">` ; un élément `data-ws="model mech"` n'apparaît que dans ces ateliers. Changez d'atelier avec `setWs(k)`, testez `ws`. La Mécanique exige `mechReady()` (toutes les pièces validées).
- Validation : `p.valid` (statut, triangles, proxy) et `p.locs` (repères, en coordonnées locales de la pièce). `vState(p)` renvoie `stale` si la géométrie a changé depuis la validation.
- Structures : `state.struct` (treillis + maillage), unités mm / N / MPa, plan vertical (x, y) affiché en (X, Z) dans la vue 3D.
- Le push sur `main` déploie automatiquement sur GitHub Pages.
