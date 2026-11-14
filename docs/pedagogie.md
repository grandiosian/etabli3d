# Pédagogie : exemples, Guide, tutos, exercices, bibliothèque

Notes détaillées pour Claude (voir la carte dans `CLAUDE.md`). Tests : domaines `guide`, `bibliotheque`, `exemples`.

## Exemples de démonstration
Dans `src/examples.js` (objet `SAMPLES`) : chaque exemple a une fiche « À observer / À essayer » ; les positions sont en coordonnées monde. Un exemple est « terminé » quand toutes ses étapes « À essayer » sont cochées.
- Niveau 3 : `tole` (« Équerre en tôle », esquisse ouverte en L → tôle pliée) et `pyramide` (« Pyramide à monter », pièce fermée dont le patron tient en un seul morceau). Rappel `SKB()` : `poly()` ferme toujours le contour, une ligne ouverte se fait avec `line(a,b)` ; dans `dx(a,b,off)` / `dy(a,b,off)` le 3ᵉ argument est le décalage de l'étiquette (la valeur est mesurée sur les points).

## Guide (`src/guide.js`, élément `#demo`, bouton `#bGuide`)
Panneau flottant à gauche de la vue, à droite de l'arborescence (au-dessus de l'éditeur pendant une esquisse, `placeDemo()`). Onglets :
- Exemple : fiche de `state.note`, « À essayer » en pas à pas ;
- Tutos et exercices : `LESSONS` de lessons.js, étapes ou critères avec `ok()` vérifiée deux fois par seconde, une étape faite le reste ;
- Mon TP : `state.tp = {title, tasks:[{t, done}]}`, écrit par le professeur, enregistré avec le projet.

État : `GUIDE`, ouverture `demoClosed` / `demoOpen`. Le Guide peut se plaquer contre la languette (voir `docs/interface.md`).

## Tutos et exercices (`src/lessons.js`, `LESSONS`)
`type` tuto (étapes guidées) ou exo (`brief`, critères `steps` vérifiés tout seuls, `hint`), `cat` (model / sketch / move / struct, `LCATS`), `level`, `start()` facultatif (scène de départ, sinon projet vide `lessonReset`). Lancés par `startLesson(k)` dans le Guide. Avancement dans le navigateur : `PROG` (`etabli3d.progress` : `done['tuto:k'|'exo:k'|'ex:k']`, `seen`, `part`), `lessonProgress()` / `markDone()`.

Tutos de niveau 3 ajoutés : `tole` (Esquisser, après `vase` : Ligne sur le plan de face, L ouvert, deux cotes, mode « Tôle pliée » de l'éditeur, puis réglages dans Propriétés) et `patron` (Modéliser, après `tole` : pyramide 40 × 40 × 50, atelier Valider, bouton Patron → `patronGenerated()`, coupe manuelle et impression en cases à cocher). Leurs étapes sont vérifiées à la souris, tuto lancé depuis la bibliothèque, dans les domaines de test `tole` et `patron`.

Après tout ajout de tuto, exercice ou exemple : mettre à jour la Centrale (voir `docs/centrale.md`). Les clés de `LESSONS` / `SAMPLES` ne sont jamais renommées.

## Bibliothèque (`#gallery`, bouton « Bibliothèque »)
Tutos, exercices et exemples rangés par catégorie, onglets Tout / Tutos / Exercices / Exemples et filtre de niveau (`LIB`, `renderGallery()`, `openGallery(tab)`), état de chaque carte (`lessonStatus`, `statusChip`), avancement global et « Remettre à zéro ». Elle s'ouvre toute seule à la première visite.
