# Simulation : Valider, Mécanique, Structures

Notes détaillées pour Claude (voir la carte dans `CLAUDE.md`). Tests : domaines `mecanique`, `structures`, `demarche`.

## Valider
- `p.valid` (statut, triangles, proxy) et `p.locs` (repères, en coordonnées locales de la pièce). `vState(p)` renvoie `stale` si la géométrie a changé depuis la validation.
- La Mécanique exige `mechReady()` (toutes les pièces validées).

## Mécanique
- Bulle : `#bubLink` relie la bulle à l'élément ciblé (`bubbleAnchor()`), mis à jour chaque image. La bulle se déplace par son en-tête (`LAYOUT.bubble`).
- Étiquettes de liaison : groupe déplaçable et transparent `#jlGroup`, disposition `prefs.jl` (orbite par défaut, libre, ligne, colonne, carre, rect, cercle), réduction automatique `data-sz` (full → compact → mini). Toutes les dispositions sauf « libre » sont calculées chaque image par `freeJointLabels()` / `placeJointLabels()` autour de la boîte écran des pièces en mouvement (`systemScreenBox()`) : ovale, cercle, ligne au-dessus, colonne ou grille du côté le plus libre.

## Structures
- `state.struct` (treillis + maillage), unités mm / N / MPa, plan vertical (x, y) affiché en (X, Z) dans la vue 3D.
- Déformée « auto » : l'échelle est figée par modèle (`ST.ampRef`, remise à zéro par `resetAmpRef()` au chargement d'un exemple ou au changement de module/portée) pour qu'une force plus grande se voie ; plafond à 30 % de la portée.
- Structures 3D : mêmes symboles qu'en 2D (flèches de charge, appuis, réactions, forme au repos, flèche max) ; les textes sont des étiquettes HTML dans `#st3d`, placées chaque image par `positionStruct3DLabels()`.
