# Établi 3D

Modeleur 3D pour les cours de technologie, dans l'esprit de Tinkercad, qui fonctionne dans le navigateur sans installation.

**Application en ligne :** https://grandiosian.github.io/etabli3d/

## Quatre ateliers

L'application suit la démarche de conception, avec une barre d'étapes en haut :

| Atelier | Rôle |
|---|---|
| **1 · Modéliser** | Créer les pièces : volumes, esquisses, perçages, groupes |
| **2 · Valider** | Contrôler chaque pièce (forme vide ou plate, surface non fermée, contour d'esquisse qui se croise, épaisseur < 1 mm, pièce sous le plan ou en l'air, perçage isolé), mesurer sa complexité (triangles), créer un **proxy basse résolution** pour les pièces lourdes et poser des **repères** (centre, base, axes de révolution, axes des perçages) |
| **3 · Mécanique** | Liaisons, moteurs et simulation. Verrouillée tant que les pièces ne sont pas validées ; les liaisons s'accrochent aux repères (clic direct dans la vue 3D) et les pièces lourdes sont affichées en proxy. Chaque liaison a une **étiquette** (« Roue menante tourne sur Platine · axe Z »). Un clic sur une pièce ouvre une **bulle** : moteur, vitesse, course, relancer |
| **4 · Structures** | Un clic sur la structure ouvre une **bulle** : animer la déformation en boucle, régler force / diamètre / hauteur / matériau, relancer. Simulation de déformation, indépendante des pièces : **Treillis** (barres articulées en cylindre plein, tube = cylindres imbriqués, ou câble en traction seule ; flambage d'Euler, réactions, masse) et **Maillage** (éléments finis 2D simplifiés en contraintes planes : flèche, von Mises, traction / compression, comparaison avec le calcul RDM) |

Unités des structures : mm, N, MPa. Matériaux : bois, acier, aluminium, PLA, pierre, béton.

## Repères (locators)

Chaque repère est un trièdre X, Y, Z coloré (palette réglable dans **Apparence** : classique, contrastée, pastel). Le dégradé et la pointe de flèche indiquent le sens positif ; Z est l'axe principal, celui des liaisons. Dans **Valider**, chaque repère se règle : ↻ quart de tour autour de Z, ⇅ inverser Z, ⤨ prendre X comme axe principal. Les liaisons accrochées au repère suivent.

## Trois niveaux

Le niveau se choisit en haut à droite (mémorisé dans le navigateur) :

| Niveau | Ce qui s'affiche |
|---|---|
| **Débutant** | Volumes simples (cube, cylindre, sphère, cône, pyramide, coin, texte), perçages, groupes, couleurs, export STL |
| **Intermédiaire** | + esquisses cotées (lignes, rectangles, cercles, cotes, H/V), tube et tore, aligner, liaisons, moteurs et simulation |
| **Avancé** | + roues dentées et crémaillère, transmissions entre liaisons, courbes de Bézier, révolution, contraintes ∥ ⊥ = ⦿ fixe, facettes, **arborescence** |

Un exemple d'un niveau supérieur fait passer automatiquement à ce niveau.

## Ce que l'on peut faire

- **Volumes** : cube, cylindre, sphère, cône, pyramide, coin, tube, tore, texte en relief, roue dentée, crémaillère. Cotes, position et rotation au dixième de millimètre.
- **Perçages et groupes** : une forme devient un perçage ; groupée avec un solide, elle retire la matière.
- **Esquisses** : lignes, rectangles, cercles, courbes de Bézier à poignées, cotes (longueur, horizontale, verticale, diamètre) et contraintes (horizontale, verticale, parallèle, perpendiculaire, égale, coïncidence, point fixe). L'esquisse devient un volume par extrusion ou révolution.
- **Mouvements** : liaisons encastrement, pivot et glissière ; moteur continu ou aller-retour ; transmissions par rapport (engrenages, poulies, pignon-crémaillère, vis-écrou) ; simulation animée.
- **Arborescence** (avancé) : vue par pièces (groupes dépliables) ou par liaisons (arbre cinématique), masquer, verrouiller, renommer.
- **Apparence** : thème auto / clair / sombre, couleur principale, couleur du plan de travail.
- **Fichiers** : projet en `.json` (Enregistrer / Ouvrir), export `.stl` pour l'impression 3D. Sauvegarde automatique dans le navigateur.

## Exemples de démonstration

Le bouton **Exemples** ouvre une galerie de 22 projets prêts à l'emploi, chacun marqué de son niveau. Chacun s'ouvre avec une fiche « À observer / À essayer ».

| Famille | Exemples |
|---|---|
| Modéliser avec des volumes | Maison (perçages, groupes, coins) · Pot à crayons gravé (texte en creux) · Dé à jouer (sphères en perçage) · Porte-clés |
| Esquisser et coter | Plaque de fixation (esquisse totalement contrainte) · Pion d'échecs (révolution) · Pendentif cœur (Bézier) · Vase (Bézier + révolution) |
| Simuler la déformation | Pont en treillis · Grue en tubes (cylindres imbriqués) · Pont suspendu (câbles) · Plongeoir · Plancher simple · Voûte en pierre · Point suspendu (potence) |
| Mettre en mouvement | Barrière de parking (pivot, butées) · Engrenages et crémaillère · Réducteur à deux étages (rapport 1/9) · Poulies et courroie · Étau (vis-écrou) · Bras articulé · Éolienne |

Pour ajouter un exemple, complétez l'objet `SAMPLES` dans `src/examples.js`.

## Organisation du code

```
src/head.html    titre et feuille de style (couleurs, mise en page)
src/body.html    structure de la page (barres d'outils, panneaux, éditeur d'esquisse, aide)
src/core.js      icônes, catalogue des formes, construction des géométries, profils d'esquisse et Bézier, groupes (CSG)
src/prefs.js     niveaux, thème et couleurs (mémorisés dans le navigateur)
src/scene.js     scène 3D, sélection, déplacements, historique, opérations d'édition
src/ui.js        panneau de réglages, liaisons, simulation, fichiers (.json, .stl)
src/sketch.js    éditeur d'esquisse et solveur de contraintes
src/validate.js  atelier Valider : contrôles, proxy, repères (locators)
src/struct.js    atelier Structures : treillis, maillage, solveurs, vue 2D et aperçu 3D
src/examples.js  exemples de démonstration, galerie et fiche démo
src/outliner.js  arborescence des objets (niveau avancé)
src/bubble.js    bulle de simulation et étiquettes de liaison
src/workspace.js navigation entre les ateliers
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
