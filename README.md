# Établi 3D

Modeleur 3D pour les cours de technologie, dans l'esprit de Tinkercad, qui fonctionne dans le navigateur sans installation.

**Application en ligne :** https://grandiosian.github.io/etabli3d/

## La démarche

Il n'y a plus de bandeau d'étapes : la navigation suit la démarche.

1. **Modéliser** : créer les pièces. En haut, le bouton **Valider pour simulation** (ou **Vérifier pour l'impression** au niveau Débutant) mène à la validation.
2. **Valider** : une interface réduite aux panneaux utiles. On contrôle chaque pièce (forme vide ou plate, surface non fermée, contour d'esquisse qui se croise, épaisseur < 1 mm, pièce sous le plan ou en l'air, perçage isolé), on mesure sa complexité, on crée un **proxy basse résolution** pour les pièces lourdes, on règle et ajoute des **repères**, et le **mode test** fait tourner ou glisser la pièce autour d'un repère pour vérifier son axe et son sens. Les boutons **Mouvement** et **Déformation** mènent aux simulations (Mouvement se débloque quand toutes les pièces sont validées).
3. **Mécanique** (mouvement) et **Structures** (déformation) : seulement un bouton de retour et le passage de l'une à l'autre. Chaque liaison a une **étiquette** ; un clic sur une pièce, sur la structure ou sur une flèche de charge ouvre une **bulle** pour animer, régler et relancer. La bulle se déplace par son en-tête (l'épingle la raccroche à l'objet). Les panneaux sont semi-transparents (Apparence → Panneaux). En Structures, l'échelle « Amplifiée » reste fixe pendant les essais : une force deux fois plus grande donne une déformée deux fois plus grande (bouton « Recaler » pour la réajuster). **Double-clic** sur un objet (pièce, barre, nœud, plaque) : la vue zoome dessus ; double-clic dans le vide : tout voir. En haut : annuler / rétablir, le menu **Fichier** (nouveau, ouvrir, enregistrer, export STL, bibliothèque), le nom du projet, et à droite les niveaux, le Guide, l'Apparence et l'Aide. Dessous, la barre de création à onglets : **Volumes**, **Création mécanique** (roues dentées et crémaillère, niveau avancé) et **Simulation mécanique**, qui n'affiche que le bouton « Valider pour simulation » et grise le reste ; les esquisses sont à droite. Juste dessous, la barre d'**Édition**, centrée aux bords obliques, montre ce qui est choisi et de gros boutons : convertir en Solide ou en Perçage, Grouper, Dégrouper, Dupliquer, Poser, Supprimer ; le panneau des propriétés flotte à droite sous le cube de vue (déplaçable, réductible) ; l'arborescence est à gauche, le Guide juste à sa droite ; ces panneaux laissent voir la scène en transparence. Un cube de vue en haut à droite oriente la caméra. En glissant, les pièces s'aimantent aux bords et aux centres des autres (Alt : sans aimant). Au survol, une pièce est entourée, grisée et nommée. Une pièce sélectionnée porte des poignées comme dans Tinkercad : coins et côtés pour la taille, haut pour la hauteur, cône pour soulever, flèches courbes pour tourner (rapporteur gradué tous les 5°, 15° et 45° qui s'affiche au survol ; l'angle s'aimante aux crans sous le pointeur, Maj : libre ; pendant la rotation, les autres poignées disparaissent), cotes cliquables. Double-clic sur un groupe pour passer en **mode édition du groupe** (seules ses pièces restent affichées), puis « Terminer le groupe » recalcule les perçages. Glisser une pièce la déplace sur le sol ; Maj + glisser trace un cadre de sélection ; **Alt + glisser** tourne la vue et **Espace + glisser** la décale ; sur tablette, une **barre de navigation** (Tourner, Décaler, Zoom, +, −, Tout voir) fait la même chose au doigt ; un bouton sur le cube de vue passe de la **perspective** à la vue **orthographique** ; un clic droit règle ce que fait le clic gauche dans le vide (cadre, orbite, panoramique). La vue 3D des Structures montre les mêmes repères que la 2D (forces, appuis, réactions, forme au repos, flèche max). Un trait relie la bulle à l'élément réglé. En Mécanique, les étiquettes de liaison se placent d'elles-mêmes sur un ovale autour des pièces en mouvement, chacune du côté de sa liaison (ou, au choix, en ligne, en colonne, en carré, en rectangle, en cercle ou près des liaisons) et se réduisent quand la vue est petite. Le panneau de réglages laisse voir la vue 3D en transparence.

| Simulation | Contenu |
|---|---|
| **Mécanique** | Liaisons accrochées aux repères (clic direct dans la vue 3D), moteurs, transmissions, pièces lourdes affichées en proxy |
| **Structures** | **Treillis** (barres articulées en cylindre plein, tube = cylindres imbriqués, ou câble en traction seule ; flambage d'Euler, réactions, masse) et **Maillage** (éléments finis 2D simplifiés en contraintes planes : flèche, von Mises, traction / compression, comparaison avec le calcul RDM) |

## Guide

Le **Guide** (bouton en haut, panneau à gauche de la vue) accompagne le travail : la fiche de l'exemple ouvert (« À essayer » en pas à pas), des **tutos pas à pas** dont les étapes se cochent seules (Premiers pas, Ma première esquisse, Courbes de Bézier) et l'onglet **Mon TP**, où le professeur écrit les consignes (une par ligne) que l'élève coche ; elles sont enregistrées avec le projet. Pendant une esquisse, le guide reste visible au-dessus de l'éditeur.

## Panneaux

Chaque panneau flottant (outils, vues, grille, simulation, légende, guide) se **déplace** par sa poignée ⋮⋮ et se **réduit** avec sa flèche. Le panneau de droite se réduit en rail ou passe à gauche ; la barre des formes se réduit aux icônes. La disposition est mémorisée dans le navigateur ; **Apparence → Remettre les panneaux à leur place** la réinitialise.

Unités des structures : mm, N, MPa. Matériaux : bois, acier, aluminium, PLA, pierre, béton.

## Repères (locators)

Chaque repère est un trièdre X, Y, Z coloré (palette réglable dans **Apparence** : classique, contrastée, pastel). Le dégradé et la pointe de flèche indiquent le sens positif ; Z est l'axe principal, celui des liaisons. Dans **Valider**, chaque repère se règle : ↻ quart de tour autour de Z, ⇅ inverser Z, ⤨ prendre X comme axe principal. Les liaisons accrochées au repère suivent.

## Trois niveaux

Le niveau se choisit en haut à droite (mémorisé dans le navigateur) :

| Niveau | Ce qui s'affiche |
|---|---|
| **Débutant** | Volumes simples (cube, cylindre, sphère, cône, pyramide, coin, texte), perçages, groupes, couleurs, export STL |
| **Intermédiaire** | + esquisses cotées sur le plan de son choix (lignes, rectangles, cercles, courbes de Bézier, cotes, H/V), tube et tore, aligner, liaisons, moteurs et simulation |
| **Avancé** | + roues dentées et crémaillère, transmissions entre liaisons, révolution, contraintes ∥ ⊥ = ⦿ fixe, facettes, **arborescence** |

Un exemple d'un niveau supérieur fait passer automatiquement à ce niveau.

## Ce que l'on peut faire

- **Volumes** : cube, cylindre, sphère, cône, pyramide, coin, tube, tore, texte en relief, roue dentée, crémaillère. Cotes, position et rotation au dixième de millimètre.
- **Perçages et groupes** : une forme devient un perçage, affiché transparent et hachuré ; groupée avec un solide, elle retire la matière.
- **Esquisses** : on choisit d'abord le **plan** (dessus XY, face XZ, côté YZ), dans un panneau ou en cliquant le plan dans la vue. Lignes, rectangles, cercles, courbes de Bézier tracées **point par point** (clic : point anguleux ; cliquer-glisser : point lisse dont on tire la courbe), cotes (longueur, horizontale, verticale, diamètre) et contraintes (horizontale, verticale, parallèle, perpendiculaire, égale, coïncidence, point fixe). Pour chaque point d'une courbe, des boutons changent l'**interpolation** (anguleux, lisse auto, courbe) et les **tangentes** (casser, symétriser, dessymétriser). L'esquisse devient un volume par extrusion ou révolution.
- **Mouvements** : liaisons encastrement, pivot et glissière ; moteur continu ou aller-retour ; transmissions par rapport (engrenages, poulies, pignon-crémaillère, vis-écrou) ; simulation animée.
- **Arborescence** (avancé) : vue par pièces (groupes dépliables) ou par liaisons (arbre cinématique), masquer, verrouiller, renommer.
- **Apparence** : rendu (plein, arêtes, fil de fer, rayons X), éclairage, ombres, thème auto / clair / sombre, couleur principale, couleur du plan de travail, arborescence (réductible et déplaçable).
- **Fichiers** : projet en `.json` (Enregistrer / Ouvrir), export `.stl` pour l'impression 3D. Sauvegarde automatique dans le navigateur.
- **Centrale de la classe** : avec le bouton **Mon code**, l'élève se connecte au serveur de la classe ; son projet et son avancement (tutos, exercices, exemples) y sont enregistrés, il les retrouve sur n'importe quel ordinateur et le professeur suit sa progression. Le menu Fichier propose alors d'envoyer le STL au professeur et, dans un atelier transversal, de reprendre ou déposer les fichiers de l'étape. Sans connexion, rien ne change. Contrat : [PASSERELLE.md](PASSERELLE.md) et [centrale.json](centrale.json).

## Bibliothèque : tutos, exercices, exemples

Le bouton **Bibliothèque** range par catégorie (modéliser, esquisser, mouvement, structures) des **tutos pas à pas** dont les étapes se cochent seules, des **exercices** (une consigne, des critères de réussite vérifiés automatiquement, un indice) et les **exemples** de démonstration. Des onglets filtrent par type (Tout, Tutos, Exercices, Exemples) et par niveau ; chaque carte montre son avancement (nouveau, en cours, terminé), gardé dans le navigateur.

| Type | Contenu |
|---|---|
| Tutos | Premiers pas · Tailles et positions · Empiler et aligner · Ma première esquisse · Esquisser debout · Courbes de Bézier · Faire tourner une pièce · Deux roues dentées · Calculer un petit pont |
| Exercices | Dé à jouer · Plaque percée · Tour de 3 étages · Équerre de fixation · Vase en révolution · Barrière qui se lève · Réducteur 1/3 · Pont de 400 mm |

Les exemples s'ouvrent avec une fiche « À observer / À essayer ».

## Repères d'échelle

Trois objets connus qui se suivent en taille, en gris, sont posés loin derrière le plan de travail (toujours au même endroit, chacun avec une plaque « Référence d'échelle ») pour juger de la taille réelle des pièces et des rapports d'échelle : **pièce de 1 €** (2,3 cm), **personne** (1,70 m) et **pomme** (8 cm), **canette** (12 cm), **voiture** (4,2 m), **immeuble** (12 m) ou **avion de ligne** (38 m). En automatique, la série suit la taille du modèle ; le bouton pomme près du cube de vue permet de la choisir ou de la masquer. Ces objets ne sont ni exportés, ni enregistrés, ni pris en compte par « Tout voir ».

## Rendu

Dans **Apparence** : affichage des pièces (plein, **texture** — impression 3D avec ses couches, bois, métal, damier —, arêtes, fil de fer, rayons X), **qualité haute** (image plus fine, reflets, plus lent), éclairage (atelier, doux, contrasté, soleil) et ombres portées.

Trois panneaux peuvent se **plaquer** à gauche ou à droite de la barre d'édition : la **Grille**, le **Guide** et les **Propriétés** (le cube de vue reste dans le coin en haut à droite, la navigation sur la vue). Glissez-les vers un côté, leur emplacement apparaît en pointillé. La grille prend la hauteur et le biais de la barre ; le guide et les propriétés s'accrochent en haut, leur coin suit le bord oblique avec le même liseré, puis ils descendent sur la vue (le guide garde son liseré jaune). Plusieurs panneaux peuvent se ranger du même côté. La barre d'édition reste centrée et tout s'adapte à la place : la grille passe en icônes, le guide et les propriétés se rétrécissent, puis la barre se resserre ; si la fenêtre est vraiment trop étroite, le panneau plaqué depuis le plus longtemps retourne sur la vue et revient de lui-même quand la place le permet. Glissez leur poignée (ou l'en-tête des propriétés) pour les décrocher ; hors de Modéliser, ils reprennent leur place sur la vue.

## Matières

Dans le panneau des propriétés, la rubrique **Matière** donne à chaque pièce son aspect et sa masse volumique : PLA, bois, médium, carton, acier, aluminium, laiton, plexiglas, caoutchouc, béton, pierre. Le motif (veinage, couches d'impression, métal brossé…) est calculé sur la pièce elle-même, il marche donc aussi sur les groupes et les esquisses. Au niveau Intermédiaire, on peut **importer une image** (photo de bois, tissu, logo) projetée sur les faces, avec la taille du motif en mm, et le panneau affiche le **volume et la masse** (m = ρ × V). Les images sont enregistrées dans le projet.

### Exemples de démonstration

22 projets prêts à l'emploi, chacun marqué de son niveau.

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
src/sketch.js    éditeur d'esquisse, solveur de contraintes, outil Bézier point par point
src/planes.js    choix du plan de l'esquisse (XY, XZ, YZ)
src/validate.js  atelier Valider : contrôles, proxy, repères (locators)
src/struct.js    atelier Structures : treillis, maillage, solveurs, vue 2D et aperçu 3D
src/examples.js  exemples de démonstration et bibliothèque (onglets, filtres, avancement)
src/lessons.js   tutos pas à pas, exercices vérifiés automatiquement, suivi de l'avancement
src/refs.js      repères d'échelle (pomme, canette, voiture, immeuble, avion)
src/guide.js     Guide : fiche de l'exemple, tutos pas à pas, consignes du TP
src/outliner.js  arborescence des objets (niveau avancé)
src/bubble.js    bulle de simulation et étiquettes de liaison
src/workspace.js navigation dans la démarche (boutons contextuels)
src/panels.js    panneaux déplaçables et réductibles, disposition mémorisée
src/centrale.js  connexion à la Centrale de la classe, point d'accès window.Etabli3D
src/init.js      exemples, raccourcis clavier, démarrage
centrale.json    descripteur lu par la Centrale (passerelle.atelier v1)
outils/          verifier-descripteur.html : compare centrale.json et l'application
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
npm test                    # tous les domaines (avant de pousser)
npm test -- panneaux        # un seul domaine, pendant une correction
python3 tests/smoke.py --liste
```

Les tests sont rangés par domaine dans `tests/domaines/` ; chaque domaine part d'une page neuve.

## Mise en ligne

Chaque `push` sur `main` reconstruit la page et la publie sur GitHub Pages (`.github/workflows/pages.yml`).
Première fois seulement : *Settings → Pages → Build and deployment → Source : GitHub Actions*.
