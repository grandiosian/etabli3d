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
- Sous 860 px, `#top` a `min-width:0` : la barre ne peut plus élargir la page (avant, avec la démarche et un élève connecté, la roue sortait de l'écran entre 600 et 760 px). L'identifiant de l'élève se coupe avec « … » (140 px, 84 px sous 760 px, 64 px sous 680 px).
- 600 à 760 px : barres de difficulté masquées, widget resserré ; avec la démarche affichée, le type d'activité (`.tpcn`) s'efface aussi (il reste dans l'info-bulle). Sous 680 px, le logo perd son chevron.
- Téléphone (sous 600 px, bloc `@media (max-width: 599px)`) : deux lignes au plus. Ligne 1 : logo, flèches, widget et la roue poussée à droite (`.tb-r` en `display:contents`, `.tb-l` occupe la ligne moins la roue) ; ligne 2 : l'activité puis la démarche. Sous 440 px avec la démarche, le type d'activité s'efface ; sous 400 px, barres de difficulté et chevron du logo aussi.
- Test : « barre du haut chargée à N px » (domaine `demarrage`) vérifie le cas le plus chargé (connecté avec « ← », démarche) de 360 à 860 px.
- Fenêtre plus étroite : le logo perd d'abord son texte « Établi 3D » (≤ 1600 px, ou ≤ 1800 px avec la démarche) ; la colonne du centre peut se réduire (`minmax(0,auto)`) pour que la barre ne déborde jamais. Mesures communes à toutes les barres (52 px, pilules 34 px, boutons 36 × 34) : spécification de la passerelle de la Centrale, §2.6.

## Disposition générale
- **Barre de création** en haut (`#rack`) : onglets `[data-rtab]` Volumes (`#rackBasic`) / **Esquisse** (niveau 2, `#rackSk` : Esquisse, Ligne, Rectangle, Cercle, Bézier, Tôle au niveau 3) / Création mécanique (roues dentées, crémaillère, niveau 3, `#rackMeca`) / Simulation mécanique (`#rackSim` : seulement le bouton « Valider pour simulation », ou « Vérifier l’impression » au niveau 1, rendu par `updateSteps()` ; `#app.tab-sim` grise la barre d'édition). `setRackTab()` (repli sur Volumes si le niveau ne permet pas l'onglet) ; Volumes au démarrage ; un tuto d'esquisse (`cat:'sketch'`) ouvre l'onglet Esquisse (`startLesson()`). Boutons d'esquisse `[data-sktool]` enfoncés seulement pendant le choix du plan ; `#rackMin` reste au bout de la rangée.
  - Place : de 600 à 760 px, et de 861 à 1100 px quand la colonne Édition est ouverte, seul l'onglet ouvert garde son nom (les autres en icône, nom dans l'info-bulle).
- **Barre Édition** (`#toolbar` > `#edBar` > `.ed-shape` + flèche `#edFold`). `#rack` et `#toolbar` sont dans `#bars`.
  - Grand écran : `#bars` est une rangée flex (zone `rack` de la grille) ; la barre Édition est une **colonne à droite de la barre de création**, séparée par un trait, de même hauteur (icônes des outils ramenées à 26 px pour ne pas dépasser les formes). Elle prend sa largeur, jusqu'à 46 % ; la création prend le reste et défile si besoin. `.ed-bar` y est une grille : en-tête (onglet « Édition » + sélection `.ed-head`, flèche `#edFold` tournée vers la droite) aligné sur les onglets de création, puis `#tools` aligné sur les formes (`.ed-shape` en `display:contents`). Ouverte, l'onglet `#edToggle` est masqué (l'en-tête le remplace).
  - Plus petit (`#bars` en `display:contents`) : pleine largeur sous la création (600 à 860 px, en haut de la vue) ou au-dessus d'elle (téléphone), bords droits. Résumé de la sélection `#edSel` ; gros boutons « Convertir en » Solide / Perçage, « Assembler » Grouper / Dégrouper, « Pièce » Dupliquer / Poser / Supprimer, actifs selon la sélection dans `updateToolButtons()`. Place réduite : `fitEdBar()` (mesure `.ed-shape`, ou `#tools` sur grand écran) passe en icônes seules (`.ed-tight`) puis sans titres de groupe (`.ed-tight2`).
  - **Rétractable** (`#toolbar.ed-closed`, état `edOpen`, `setEdOpen()` dans panels.js) : rentrée quand rien n'est choisi, elle s'ouvre dès qu'une pièce est choisie (`edSelChanged()`, appelé par `updateToolButtons()` au passage « rien → quelque chose » et inversement).
  - À la main : l'onglet **« Édition ▾ »** (`#edToggle`, au bout des onglets de création, `aria-expanded`) et la flèche `#edFold` appellent `edToggle()`. Rentrée à la main alors qu'une pièce est choisie, elle ne s'ouvre plus toute seule (`LAYOUT.edAuto=false`, avec un message) ; la rouvrir à la main rétablit l'ouverture automatique. `resetLayout()` l'efface aussi.
  - Grand écran : l'ouvrir ou la rentrer ne change pas la hauteur de la rangée, donc ni la vue ni l'image 3D ne bougent (test « la vue ne bouge pas », domaine `panneaux`).
  - Téléphone : la barre est en bas, au-dessus de la création ; les flèches sont retournées.
  - Les panneaux ne se plaquent plus contre elle (ancienne « languette » aux bords obliques et ses « ailes », retirées) : `initPanels()` efface les anciens `LAYOUT[id].dock`.
- « PLAN DE TRAVAIL » est écrit sur le tapis (`matTexture()`).
- **Panneau des propriétés** (`#insp`) flottant sous le cube de vue à droite (`placeInsp()`), déplaçable par son en-tête (`LAYOUT.insp`), réductible, bouton ⟲ pour le remettre ; `rightReserve()` décale la caméra pour ne pas cacher la scène. En Modéliser, il s'intitule « Propriétés » (`updateSteps()`) et invite à cliquer un objet quand rien n'est choisi ; les rappels des gestes sont dans le Guide (onglet Tutos).
- **Arborescence** à gauche (colonne 1, lignes 3–4 de la grille : elle monte à côté de la barre d'édition) ; réductible en rail (`LAYOUT.treeMin`), déplaçable par son en-tête au-dessus de la vue (`LAYOUT.tree` → `#app.tree-float`), bouton ⟲ pour la remettre ; `applyTree()`. Le Guide est juste à sa droite sur la vue.
- Barres et arborescence sont semi-transparentes : sur grand écran, les canevas 3D et 2D s'étendent dessous (`OVR.t` / `OVR.l` / `OVR.r` mesurés sur la mise en page, variables CSS `--ovr-*`, `updateOverlay()`).

## Panneaux flottants
- Listés dans `FLOATS` (`src/panels.js`) ; position et réduction dans `LAYOUT` (localStorage), réinitialisées par `resetLayout()`.
- La bulle (`#bubble`) se déplace par son en-tête (`LAYOUT.bubble`) ; transparence des panneaux : `prefs.glass` → `<html data-glass>`.

## Cube de vue
- `src/viewcube.js`, canevas `#vcube` dans `#views`, toujours dans le coin en haut à droite de la vue, juste sous la barre de création.
- Sa poignée et son bouton réduire sont posés dans les coins du haut, sans barre entre eux. Clic face / arête / coin → `vcGo(dir)`, glisser → `vcOrbit`.
- Boutons rangés en cercle autour de lui (`layoutCubeRing()` dans init.js : perspective, tout voir, repère, souris, sélection, vue de départ) ; `data-view` iso / fit / sel, `#lmbBtn`.
- Préférence du clic gauche dans le vide : `prefs.lmb` (select / orbit / pan), réglée par le menu du clic droit (`openCtxMenu`) ou le bouton souris de `#views` (`applyLmb()`).

## Rendu (Apparence → « Rendu des pièces », « Qualité de l’image », « Éclairage », « Ombres »)
- `prefs.rmode` plein / texture / aretes (traits noirs `edgeLineMat`) / filaire (`material.wireframe`) / xray (transparent + arêtes), appliqué dans `sync()`.
- Texture = motif calculé dans le shader en coordonnées de la pièce, sans UV (définition `TEX`, `TEX_GLSL`, `TEXK` : `prefs.tex` impression 3D / bois / métal / damier).
- Haute qualité `prefs.hq` (`applyQuality()` : pixels ×1,6 jusqu'à 3, environnement `RoomEnvironment` pour les reflets, tons `NeutralToneMapping`, ombres 4096, lumières baissées).
- `prefs.light` (`LIGHTS` : Atelier, Doux, Contrasté, Soleil → intensités de `hemi`, `sun`, `fill`) ; `prefs.shadows` (ombres portées : `renderer.shadowMap`, `sun.castShadow`, caméra d'ombre ajustée aux pièces par `fitShadow()` à chaque `sync()`).
- `applyRender()` applique le tout. `edgesOf(g, boxOnly)` a deux caches (boîte / vraies arêtes).
