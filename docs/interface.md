# Interface : barres, disposition, panneaux, cube de vue, rendu

Notes détaillées pour Claude (voir la carte dans `CLAUDE.md`). Tests : domaines `demarrage`, `panneaux`, `demarche`, `rendu`, `reperes`.

## Barre du haut
Même barre que NetSim et TechnoStudio, en trois zones (`#top` en grille `.tb-l` / `.tb-c` / `.tb-r` ; le centre reste au milieu tant que les côtés ont la place ; sous 860 px elles passent à la ligne).
- À gauche : le logo, qui ouvre le menu déroulant **Fichier** (`button.brand#bFile` → `#menuFile` : `#bNew`, `#bOpen`, `#bSave`, `#bStl`, `#bNuage`, `#bExamples` = bibliothèque ; `closeFileMenu()`), annuler / rétablir (`.tb-hist` : `#bUndo`, `#bRedo`, boutons d'icône 36 × 34, mêmes flèches que NetSim, grisés par `updateUndo()`), puis le widget de l'élève `#widgetCentrale` (pastille `.tbres.tbid` : « ← » de la Centrale + « Visiteur » ou l'identifiant, voir `docs/centrale.md`).
- Au centre : l'activité en cours `#tbAtelier` (`.tbres.tbat`, `majAtelier()` / `activiteEnCours()` dans guide.js, appelé par `renderDemo()` et `centraleBouton()`) : pastille de la classe (connecté), type (Tuto, Exercice, Exemple, TP), nom du projet `#projName` (modifiable), difficulté en barres `.nvb`, étapes faites / total `.tbpct`. Un clic hors du nom ouvre la bibliothèque.
- À droite, le moins d'icônes possible : `#flow` (seulement hors Modéliser), puis l'engrenage des **réglages** (`#bSet` → `#menuSet`, `ouvrirReglages()` / `closeSetMenu()`, état mis à jour par `majReglages()`) :
  - **Niveau** (`#lvl`, boutons `[data-lvl]` Débutant / Intermédiaire / Avancé → `setLevel()` ; le menu reste ouvert) ;
  - **Panneaux** : interrupteurs **Guide** (`#bGuide` → `toggleGuide()`, son état suit `renderDemo()`) et **Propriétés** (`#mobileInsp` : sur grand écran, réduit ou agrandit le panneau comme `#inspMin` ; sous 860 px, ouvre le panneau du bas `#insp.open`), puis **Arborescence** Affichée / Masquée (`#setTree`, `renderSetTree()` → `setTreeOpen()` ; grisée avec « Disponible au niveau Avancé » sous le niveau 3) ; le menu reste ouvert ;
  - **Apparence…** (`#bLook`) : le menu Apparence (`#menuLook`, `renderLook()`) prend la place des réglages, avec « ← Réglages » en haut (l'engrenage y ramène aussi) ;
  - **Aide et raccourcis** (`#bHelp` → `#help`).
  Un menu ouvert ferme les autres ; clic ailleurs ou Échap le ferme. Les éléments du menu : `.set-item` (icône, libellé, précision, interrupteur `.set-coche`).
- Petite fenêtre ou tablette (600 à 860 px, bloc `@media (min-width: 600px) and (max-width: 860px)` de head.html) : la barre du haut reste sur une ligne (logo sans texte, flèches, widget, activité qui se réduit, engrenage), la barre de création est juste dessous et la barre Édition flotte en haut de la vue, comme sur grand écran ; panneau Propriétés en bas (`#insp.open`). Sous 600 px : disposition téléphone (barre du haut sur deux lignes, création et Édition en bas).
- Fenêtre plus étroite : le logo perd d'abord son texte « Établi 3D » (≤ 1600 px, ou ≤ 1800 px avec la démarche) ; la colonne du centre peut se réduire (`minmax(0,auto)`) pour que la barre ne déborde jamais. Mesures communes à toutes les barres (52 px, pilules 34 px, boutons 36 × 34) : spécification de la passerelle de la Centrale, §2.6.

## Disposition générale
- **Barre de création** en haut (`#rack`) : onglets `[data-rtab]` Volumes (`#rackBasic`) / Création mécanique (roues dentées, crémaillère, niveau 3, `#rackMeca`) / Simulation mécanique (`#rackSim` : seulement le bouton « Valider pour simulation », ou « Vérifier l’impression » au niveau 1, rendu par `updateSteps()` ; `#app.tab-sim` grise esquisses et barre d'édition). `setRackTab()` ; Volumes au démarrage. Boutons d'esquisse `[data-sktool]` à droite, enfoncés seulement pendant le choix du plan.
- **Barre d'édition (« languette »)** juste dessous, centrée sur la vue (décalée de la largeur de l'arborescence : `--tree-w` posé par `updateOverlay()`), en trapèze aux bords obliques liserés. Résumé de la sélection `#edSel` ; gros boutons « Convertir en » Solide / Perçage, « Assembler » Grouper / Dégrouper, « Pièce » Dupliquer / Poser / Supprimer, actifs selon la sélection dans `updateToolButtons()`.
- « PLAN DE TRAVAIL » est écrit sur le tapis (`matTexture()`).
- **Panneau des propriétés** (`#insp`) flottant sous le cube de vue à droite (`placeInsp()`), déplaçable par son en-tête (`LAYOUT.insp`), réductible, bouton ⟲ pour le remettre ; `rightReserve()` décale la caméra pour ne pas cacher la scène. En Modéliser, il s'intitule « Propriétés » (`updateSteps()`) et invite à cliquer un objet quand rien n'est choisi ; les rappels des gestes sont dans le Guide (onglet Tutos).
- **Arborescence** à gauche (colonne 1, lignes 3–4 de la grille : elle monte à côté de la barre d'édition) ; réductible en rail (`LAYOUT.treeMin`), déplaçable par son en-tête au-dessus de la vue (`LAYOUT.tree` → `#app.tree-float`), bouton ⟲ pour la remettre ; `applyTree()`. Le Guide est juste à sa droite sur la vue.
- Barres et arborescence sont semi-transparentes : sur grand écran, les canevas 3D et 2D s'étendent dessous (`OVR.t` / `OVR.l` / `OVR.r` mesurés sur la mise en page, variables CSS `--ovr-*`, `updateOverlay()`).

## Structure de la languette
`#toolbar` (transparent) > `.ed-row` > [`#edWingL`] `.ed-wrap` > `.ed-rim` (trapèze un peu plus grand, couleur `--ed-rim` : blanc en clair, gris clair en sombre) > `.ed-shape` (fond `--ed-bg`) [`#edWingR`].
`.ed-row` est une grille à trois colonnes (aile | languette | aile) : la languette reste centrée.

## Panneaux flottants
- Listés dans `FLOATS` (`src/panels.js`) ; position et réduction dans `LAYOUT` (localStorage), réinitialisées par `resetLayout()`.
- La bulle (`#bubble`) se déplace par son en-tête (`LAYOUT.bubble`) ; transparence des panneaux : `prefs.glass` → `<html data-glass>`.

## Panneaux plaqués contre la languette (ailes)
- Seuls les panneaux `DOCKABLE` se plaquent : snapBox = Grille, demo = Guide, insp = Propriétés (ni le cube de vue ni la navigation ; les anciens `LAYOUT.views/navBar.dock` sont effacés par `initPanels()`). Glissés vers un côté, ils s'y plaquent.
- Pendant le glisser : `dockTarget`, aperçu `.dock-ghost` via `dockStart` / `dockFeedback` / `dockCommit` ; le panneau est soulevé (`.lifted`) dans `body`.
- État : `LAYOUT[id].dock` = L / R, `order`, `w`, `t` (date) ; `applyLayout` les range.
- La grille va dans l'aile, même hauteur, bords parallèles à l'oblique.
- Les grands panneaux (`TALL` : demo, insp) réservent leur place par une cale `#dsp-<id>` (`.dock-sp`, largeur `tallW(id)`, au moins `TALL_MIN`) et sont posés dans `#app` par `placeTall()` (`.docked-tall`, 2,5 px plus large côté languette pour recouvrir le liseré de l'aile ; coin du haut en oblique sur `--band` ; liseré `--ed-rim` dessiné par un dégradé `--dk-rim` / `--dk-t` ; bordure `--ed-rim` sauf en haut ; fond `--ed-bg`). Le guide garde son liseré jaune `--mark` à gauche, et sur l'oblique quand il est à droite. L'aile s'arrête droit derrière un grand panneau placé à son bout.
- `homeOf(id)` / `undockEl()` les remettent chez eux. Plusieurs par côté (emboîtés), décrochés en glissant leur poignée, remis sur la vue hors de Modéliser.
- `fitWings()` (appelé par `placeInsp()`) adapte à la place en repartant chaque fois de l'état complet : pour chaque état de la languette (normale → `.ed-tight` icônes seules → `.ed-tight2` sans titres), ailes `data-fit` full → compact (icônes) → grands panneaux rétrécis juste ce qu'il faut (`TALL_MIN`) ; si rien ne suffit, `data-noroom` renvoie sur la vue le panneau plaqué depuis le plus longtemps et on recommence (il revient au prochain calcul). L'aile droite s'arrête toujours avant le cube de vue (`capR`).
- Ordre des appels : `placeInsp()` → `placeViews()` → `fitWings()` → `placeTall()`. Toute retouche de la languette ou des ailes se vérifie avec le domaine `panneaux`, puis à 1000 px et 1400 px de large.

## Cube de vue
- `src/viewcube.js`, canevas `#vcube` dans `#views`, toujours dans le coin en haut à droite de la vue, juste sous la barre de création. En Modéliser il remonte dans la rangée de la languette quand celle-ci lui laisse la place (`placeViews()`, appelé par `placeInsp()`). Il ne se plaque pas et ne se décale jamais à gauche d'un panneau plaqué.
- Sa poignée et son bouton réduire sont posés dans les coins du haut, sans barre entre eux. Clic face / arête / coin → `vcGo(dir)`, glisser → `vcOrbit`.
- Boutons rangés en cercle autour de lui (`layoutCubeRing()` dans init.js : perspective, tout voir, repère, souris, sélection, vue de départ) ; `data-view` iso / fit / sel, `#lmbBtn`.
- Préférence du clic gauche dans le vide : `prefs.lmb` (select / orbit / pan), réglée par le menu du clic droit (`openCtxMenu`) ou le bouton souris de `#views` (`applyLmb()`).

## Rendu (Apparence → « Rendu des pièces », « Qualité de l’image », « Éclairage », « Ombres »)
- `prefs.rmode` plein / texture / aretes (traits noirs `edgeLineMat`) / filaire (`material.wireframe`) / xray (transparent + arêtes), appliqué dans `sync()`.
- Texture = motif calculé dans le shader en coordonnées de la pièce, sans UV (définition `TEX`, `TEX_GLSL`, `TEXK` : `prefs.tex` impression 3D / bois / métal / damier).
- Haute qualité `prefs.hq` (`applyQuality()` : pixels ×1,6 jusqu'à 3, environnement `RoomEnvironment` pour les reflets, tons `NeutralToneMapping`, ombres 4096, lumières baissées).
- `prefs.light` (`LIGHTS` : Atelier, Doux, Contrasté, Soleil → intensités de `hemi`, `sun`, `fill`) ; `prefs.shadows` (ombres portées : `renderer.shadowMap`, `sun.castShadow`, caméra d'ombre ajustée aux pièces par `fitShadow()` à chaque `sync()`).
- `applyRender()` applique le tout. `edgesOf(g, boxOnly)` a deux caches (boîte / vraies arêtes).
