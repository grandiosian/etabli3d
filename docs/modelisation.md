# Modélisation : survol, poignées, groupes, navigation, esquisses, matières

Notes détaillées pour Claude (voir la carte dans `CLAUDE.md`). Tests : domaines `manipulation`, `esquisse`, `rendu`, `guide`, `reperes`.

## Survol et sélection dans la vue 3D
- Survol (`src/hover.js`) : liseré (`hull`, normales lissées), nom (`#hovName`), pièce grisée ; aucun choix de mode au survol. Clic répété = pièce suivante sous le curseur (`pickAll`). Maj + glisser dans le vide = cadre de sélection.
- Cadre de sélection : une pièce est prise dès qu'une partie est dans le cadre (`partInRect`).
- Magnétisme en glissant une pièce (`smartSnap` dans scene.js) : bords et centres alignés ou en contact avec les autres pièces, à quelques pixels près ; guides `SNAPSEG` dessinés par `tgTick`. Alt désactive.

## Poignées de sélection à la Tinkercad (`src/gizmo.js`, `#tg`, `tgTick()` chaque image)
- Coins / milieux des côtés / haut = taille (cotes via `SCALE_MAP` / `scaleParams()`, côté opposé fixe). Un groupe s'étire aussi : aperçu par l'échelle du maillage, puis `scaleParams` reporte l'étirement sur ses pièces au relâchement.
- Cône = soulever.
- Arcs fléchés dans le plan de chaque rotation (`tgArc`, pastille au milieu) = rotation. Rapporteur `TG.ring` affiché au survol (`TG.hover`) et pendant la rotation ; graduations noires de 5° / 15° / 45° avec étiquettes `TG.marks` ; liseré blanc seulement sur la graduation sous le pointeur ou attrapée (`tgHi`, `tgHoverTick`). Le 0° du rapporteur est sous la poignée (`TG.gripW`) ou le point attrapé, pour que les crans vus sous le pointeur soient ceux qui aimantent. Aimantation `tgSnapAngle()` à 6 / 10 / 16 px des petites / moyennes / grandes graduations (`TG_SNAP`), sinon au degré ; Maj : libre. Pendant une rotation, les autres poignées, le cadre et les cotes sont masqués (`#tg.turning`).
- Cotes cliquables (`tgEditDim`).
- Les esquisses s'étirent aussi en X / Y (`scaleSketch` : points, cercles, poignées de Bézier et valeurs des cotes).
- Les TransformControls (`tc`) ne sont plus affichés. Glisser la pièce = plan horizontal.

## Mode édition d'un groupe
`enterGroupEdit(id)` remet les enfants dans la scène (`p.inGroup`, `state.edit`) et isole le groupe : le reste est caché dans la vue (`sync()`) et dans l'arborescence, non cliquable via `editable()`, la vue cadre le groupe. `finishGroupEdit()` reconstruit le groupe (même id, perçages recalculés). Sortie automatique en changeant d'atelier, en enregistrant ou en exportant.

## Navigation et caméra
- Alt + clic gauche = tourner la vue, Espace + clic gauche = décaler la vue, même sur une pièce (`NAV` dans hover.js change `orbit.mouseButtons.LEFT`, `beginPointer` laisse faire OrbitControls) ; inactif pendant une esquisse (elle a son propre Espace).
- Barre de navigation tactile `#navBar` (dans `FLOATS`) : modes Tourner / Décaler / Zoom (`setNavLock`, `NAV.lock` : le glisser au doigt ou au clic gauche navigue, même sur une pièce ; zoom = glisser vertical), boutons + / − (`zoomBy`) et Tout voir ; affichée automatiquement sur écran tactile, réglable dans Apparence (`prefs.nav` auto / show / hide, `applyNavBar()`).
- `camera` est `camP` (perspective) ou `camO` (orthographique), basculée par `setOrtho()` (bouton `#orthoBtn` en haut du cube de vue, `prefs.ortho`). En orthographique, `updOrtho()` cale chaque image la demi-hauteur sur distance × tan(fov/2), donc le cadrage par distance (`setView`, `frameBox`) marche pareil ; le zoom ortho d'OrbitControls est replié en distance au retour en perspective. Utilisez toujours `camera` (pas `camP`).

## Esquisses
- Contour extérieur dans le sens trigonométrique et trous dans le sens horaire (sinon les parois des trous sont retournées).
- Plan d'esquisse (`src/planes.js`) : les boutons d'esquisse ouvrent `openPlanePicker(tool)` (panneau `#planePick` + trois plans cliquables dans la vue, via `pickMode`) puis `openSketch(null, {plane, tool})`. `SKPLANES` (xy dessus, xz face, yz côté) ; la pièce garde `params.plane` et reçoit `rot = planeRot(plane, mode)` à sa création (extrusion : profil sur (u, v), épaisseur selon u × v ; révolution : axe = axe vertical de l'esquisse). Les anciennes esquisses sans `plane` gardent leur comportement.
- Bézier (niveau 2) : outil plume point par point (clic = point anguleux, cliquer-glisser = point lisse symétrique, Alt = tangente cassée). Chaque point a `it` (`lin` anguleux, `auto` lisse automatique, `bez` à la main) et, pour `bez`, `tm` (`sym`, `align` = dessymétrisé, `free` = cassé) ; les poignées restent dans les courbes (`t1` au départ `a`, `t2` à l'arrivée `b`) et `bzRefresh()` recalcule celles des points `lin` / `auto`. Barre d'options `#bzOpts` pour le point en cours ou sélectionné (`bzSetInterp`, `bzSetType`). Points sans `it` : `bez` / `free` (anciens fichiers).
- Sélection dans l'esquisse : `SK.sel` (un élément) ou `SK.msel` (plusieurs : cadre en glissant dans le vide, Maj + clic) ; filtre `SK.filt` (points, arêtes, contraintes) réglé par `#skFilt`. Glisser un élément d'une sélection multiple déplace tous ses points. Panoramique : Espace + clic gauche (`SK.space`), clic du milieu ou droit. `skCleanup()` garde les points de la chaîne en cours (`SK.pend`, `SK.chain`).

## Perçages
Même matériau que les solides (`partMaterial()`), avec la définition `HATCH` (`setHatch`) qui ajoute des hachures obliques en coordonnées écran (toujours face caméra) sur une pièce transparente ; pas et épaisseur dans `HATCH` (× pixelRatio).

## Matières
`MATIERES` dans scene.js : clé, nom, motif `TEXK`, rugosité, métal, couleur naturelle, masse volumique g/cm³, opacité. `p.mat = {k}` ou `{k:'image', img, size}` ; images dans `state.textures` (data URL JPEG ≤ 512 px, seules celles utilisées sont enregistrées : `usedTextures()`). Chaque matériau de pièce a ses uniformes (`material.userData.u` : `texK`, `texImg`, `texSize`), définitions `TEX` (motif) et `TEXIMG` (image projetée sur trois plans, `TEXIMG_GLSL`). Sans matière, le mode Texture d'Apparence applique le motif global. Rubrique « Matière » : `matSec()` dans ui.js ; volume `geoVolume()`. Ne pas confondre avec `MATS` (couleurs du tapis, prefs.js) ni `MATERIALS` (Structures).

## Repères d'échelle (`src/refs.js`)
Une série de trois objets qui se suivent en taille (`REF_ORDER` : pièce de 1 € 2,3 cm, pomme 8 cm, canette 12 cm, personne 1,70 m, voiture 4,2 m, immeuble 12 m, avion 38 m ; `refSeries(k)`), en gris, rangés du plus petit au plus grand loin derrière le plan de travail, toujours au même endroit pour une série (ne suivent pas les pièces), chacun avec une ombre au sol et une plaque « Référence d'échelle » (`refItem`, `refPlaque`) ; `refUpdate()` appelé par `sync()`. `prefs.ref` = auto (série autour de l'objet choisi selon la plus grande dimension, `refAuto(D)`) / série autour d'un objet / aucun, réglé par le bouton `#refBtn` du cube de vue (`openRefMenu`). Pas dans `meshes` : ni cliquables, ni exportés, ni enregistrés, ni pris dans le cadrage (« Tout voir »). Caméra lointaine (far 150 m).
