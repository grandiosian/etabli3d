# Établi 3D

Modeleur 3D pour les cours de technologie, dans l'esprit de Tinkercad, qui fonctionne dans le navigateur sans installation.

**Application en ligne :** https://grandiosian.github.io/etabli3d/

## Ce que l'on peut faire

- **Volumes** : cube, cylindre, sphère, cône, pyramide, coin, tube, tore, texte en relief, roue dentée, crémaillère. Cotes, position et rotation au dixième de millimètre.
- **Perçages et groupes** : une forme devient un perçage ; groupée avec un solide, elle retire la matière.
- **Esquisses** : lignes, rectangles, cercles, cotes (longueur, horizontale, verticale, diamètre) et contraintes (horizontale, verticale, parallèle, perpendiculaire, égale, coïncidence, point fixe). L'esquisse devient un volume par extrusion ou révolution.
- **Mouvements** : liaisons encastrement, pivot et glissière ; moteur continu ou aller-retour ; transmissions par rapport (engrenages, poulies, pignon-crémaillère, vis-écrou) ; simulation animée.
- **Fichiers** : projet en `.json` (Enregistrer / Ouvrir), export `.stl` pour l'impression 3D. Sauvegarde automatique dans le navigateur.

## Organisation du code

```
src/head.html    titre et feuille de style (couleurs, mise en page)
src/body.html    structure de la page (barres d'outils, panneaux, éditeur d'esquisse, aide)
src/core.js      icônes, catalogue des formes, construction des géométries, groupes (CSG)
src/scene.js     scène 3D, sélection, déplacements, historique, opérations d'édition
src/ui.js        panneau de réglages, liaisons, simulation, fichiers (.json, .stl)
src/sketch.js    éditeur d'esquisse et solveur de contraintes
src/init.js      exemples, raccourcis clavier, démarrage
build.py         assemble src/ en une seule page dans dist/
```

Les fichiers JavaScript sont mis bout à bout dans un seul module : une fonction définie dans `core.js` est utilisable dans `init.js` sans `import`. three.js est chargé depuis jsDelivr (versions figées dans `build.py`).

## Travailler sur le projet

```bash
python3 build.py          # produit dist/index.html (à ouvrir via un petit serveur web)
python3 -m http.server    # puis http://localhost:8000/dist/
```

Tests automatiques (Chromium sans écran) :

```bash
npm install
pip install playwright
npm test
```

## Mise en ligne

Chaque `push` sur `main` reconstruit la page et la publie sur GitHub Pages (`.github/workflows/pages.yml`).
Première fois seulement : *Settings → Pages → Build and deployment → Source : GitHub Actions*.
