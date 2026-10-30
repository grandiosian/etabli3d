# Établi 3D — notes pour Claude

- Application pour des élèves de collège : tous les textes visibles sont en français, ton simple et direct.
- Le code source est dans `src/`. Ne modifiez jamais `dist/` à la main : lancez `python3 build.py`.
- Les fichiers `src/*.js` partagent une seule portée (concaténés dans l'ordre de `JS_ORDER` dans `build.py`). Pas d'`import`/`export` entre eux ; seuls three.js et three-bvh-csg sont importés, via l'import map.
- Repère : Z vers le haut, unités en millimètres, chaque pièce a sa base à z = 0 dans son repère local.
- Avant de pousser : `npm test` (nécessite `npm install` et Playwright) doit afficher « TOUT EST OK ».
- `dist/artifact.html` est la même page sans `<html>`/`<head>`, pour la version publiée sur claude.ai.
- Les exemples de démonstration sont dans `src/examples.js` (objet `SAMPLES`) : chaque exemple a une fiche « À observer / À essayer » ; les positions sont en coordonnées monde.
- Le push sur `main` déploie automatiquement sur GitHub Pages.
