# Pédagogie : exemples, Guide, tutos, exercices, bibliothèque

Notes détaillées pour Claude (voir la carte dans `CLAUDE.md`). Tests : domaines `guide`, `bibliotheque`, `exemples`.

## Exemples de démonstration
Dans `src/examples.js` (objet `SAMPLES`) : chaque exemple a une fiche « À observer / À essayer » ; les positions sont en coordonnées monde. Un exemple est « terminé » quand toutes ses étapes « À essayer » sont cochées.

## Guide (`src/guide.js`, élément `#demo`, bouton `#bGuide`)
Panneau flottant à gauche de la vue, à droite de l'arborescence (au-dessus de l'éditeur pendant une esquisse, `placeDemo()`). Onglets :
- Exemple : fiche de `state.note`, « À essayer » en pas à pas ;
- Tutos et exercices : `LESSONS` de lessons.js, étapes ou critères avec `ok()` vérifiée deux fois par seconde, une étape faite le reste ;
- Mon TP : `state.tp = {title, tasks:[{t, done}]}`, écrit par le professeur, enregistré avec le projet.

État : `GUIDE`, ouverture `demoClosed` / `demoOpen`. Le Guide peut se plaquer contre la languette (voir `docs/interface.md`).

## Tutos et exercices (`src/lessons.js`, `LESSONS`)
`type` tuto (étapes guidées) ou exo (`brief`, critères `steps` vérifiés tout seuls, `hint`), `cat` (model / sketch / move / struct, `LCATS`), `level`, `start()` facultatif (scène de départ, sinon projet vide `lessonReset`). Lancés par `startLesson(k)` dans le Guide. Avancement dans le navigateur : `PROG` (`etabli3d.progress` : `done['tuto:k'|'exo:k'|'ex:k']`, `seen`, `part`), `lessonProgress()` / `markDone()`.

Après tout ajout de tuto, exercice ou exemple : mettre à jour la Centrale (voir `docs/centrale.md`). Les clés de `LESSONS` / `SAMPLES` ne sont jamais renommées.

## Bibliothèque (`#gallery`, bouton « Bibliothèque »)
Tutos, exercices et exemples rangés par catégorie, onglets Tout / Tutos / Exercices / Exemples et filtre de niveau (`LIB`, `renderGallery()`, `openGallery(tab)`), état de chaque carte (`lessonStatus`, `statusChip`), avancement global et « Remettre à zéro ». Elle s'ouvre toute seule à la première visite.
