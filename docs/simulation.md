# Simulation : Valider, Mécanique, Structures

Notes détaillées pour Claude (voir la carte dans `CLAUDE.md`). Tests : domaines `mecanique`, `structures`, `demarche`.

## Valider
- `p.valid` (statut, triangles, proxy) et `p.locs` (repères, en coordonnées locales de la pièce). `vState(p)` renvoie `stale` si la géométrie a changé depuis la validation.
- La Mécanique exige `mechReady()` (toutes les pièces validées).

### Patron à imprimer (`src/patron.js`, rubrique « Patron à imprimer » de Valider, niveau 3)
- `patronSec(p)` (appelée par `renderValidation` pour la pièce choisie, sauf perçage) : mode de coupe (auto / manuelle), taille max. d'un morceau, largeur des languettes, échelle ; bouton `#patBtn` → `patronMake(p)`. Réglages et résultat dans `PAT` (pas dans `params` : la pièce ne change pas) ; `patReset()` au changement de projet (`resetFor`, `loadProject`).
- `patronCompute(p, opt)` : `getGeometry(p)` (géométrie finale d'un groupe) → `patMesh` (sommets fusionnés à 10 µm, triangles aplatis retirés, jonctions en T réparées par `patFixT`) → faces planes (triangles voisins du même plan). Fermeture : chaque arête **entre deux faces** doit avoir exactement deux triangles ; à l'intérieur d'une face plane on tolère des défauts du CSG s'ils restent dans le plan. Sinon `{ok:false, err}`.
- Dépliage glouton (arbre couvrant de poids maximal = longueur de l'arête commune ; recollage forcé en manuel = priorité absolue) : une face n'est posée que si elle ne chevauche pas le morceau (`triHit`, grille `Grid`) et le garde sous la taille max. (bornée par la page A4 moins les languettes) ; sinon l'arête est coupée et la face ira dans un autre morceau. Le nombre de coupures ajoutées est signalé (`warn`).
- Coupe manuelle : `patManual(true)` met `pickMode` ; `patClick` cherche l'arête entre faces la plus proche du point cliqué et bascule `PAT.forced[nom]` (`cut` / `join`, nom = coordonnées arrondies des deux bouts, stable d'un calcul à l'autre). Coutures en 3D : `patGroup` (rouge coupée, vert recollée), suivi par `patTick()` dans la boucle.
- Mise en page : languettes trapèze à 45° d'un seul côté de chaque couture (hauteur ≤ 0,45 × arête ; retirée si elle chevauche, puis remarque), plis montagne (arête convexe, tiret-point) ou vallée (tirets), numéros d'assemblage des deux côtés, numéro de morceau ; orientation qui prend le moins de place, rangées sur des pages A4 portrait (marges 10 mm, en-tête avec barre de contrôle de 50 mm). Un SVG par page (`width="210mm"`, `viewBox="0 0 210 297"` : 1 unité = 1 mm).
- Sorties : `patSaveSvg` (`offerFile`, zip si plusieurs pages), `patPrint` (iframe `@page A4`, marges 0), grand aperçu `#patView`. `patronGenerated()` : vrai si le patron de la pièce choisie est à jour et qu'on est dans Valider (utilisé par le tuto « patron »).
- Limite connue : three-bvh-csg laisse parfois de vrais défauts (triangles minuscules doublés ou retournés) autour d'un perçage cylindrique fin (48 facettes) : le patron est alors refusé avec un conseil (moins de facettes, patron avant de grouper). Les groupes à faces droites et un cylindre à 12 facettes passent.

## Mécanique
- Bulle : `#bubLink` relie la bulle à l'élément ciblé (`bubbleAnchor()`), mis à jour chaque image. La bulle se déplace par son en-tête (`LAYOUT.bubble`).
- Étiquettes de liaison : groupe déplaçable et transparent `#jlGroup`, disposition `prefs.jl` (orbite par défaut, libre, ligne, colonne, carre, rect, cercle), réduction automatique `data-sz` (full → compact → mini). Toutes les dispositions sauf « libre » sont calculées chaque image par `freeJointLabels()` / `placeJointLabels()` autour de la boîte écran des pièces en mouvement (`systemScreenBox()`) : ovale, cercle, ligne au-dessus, colonne ou grille du côté le plus libre.

## Structures
- `state.struct` (treillis + maillage), unités mm / N / MPa, plan vertical (x, y) affiché en (X, Z) dans la vue 3D.
- Déformée « auto » : l'échelle est figée par modèle (`ST.ampRef`, remise à zéro par `resetAmpRef()` au chargement d'un exemple ou au changement de module/portée) pour qu'une force plus grande se voie ; plafond à 30 % de la portée.
- Structures 3D : mêmes symboles qu'en 2D (flèches de charge, appuis, réactions, forme au repos, flèche max) ; les textes sont des étiquettes HTML dans `#st3d`, placées chaque image par `positionStruct3DLabels()`.
