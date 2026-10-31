# Établi 3D — notes pour Claude

Modeleur 3D pour la technologie au collège, dans le navigateur. Ce fichier est la carte du projet : les détails de chaque partie sont dans `docs/`, à lire **seulement** quand on touche à cette partie.

## Règles
- Tous les textes visibles sont en français, ton simple et direct (élèves de collège).
- Le code est dans `src/`. Ne modifiez jamais `dist/` à la main : `python3 build.py`.
- Les `src/*.js` sont concaténés dans **une seule portée** (ordre `JS_ORDER` de `build.py`) : pas d'`import`/`export` entre eux, une fonction de core.js est visible partout. Pour trouver qui appelle une fonction : `grep -n "nomFonction(" src/*.js`.
- Repère : Z vers le haut, millimètres, chaque pièce a sa base à z = 0 dans son repère local.
- Faites la correction la plus petite possible, dans le fichier concerné ; ne réorganisez pas le code voisin sans qu'on le demande.

## Tester (le plus long : choisissez bien)
- Les tests de bout en bout sont rangés par domaine dans `tests/domaines/` ; chaque domaine part d'une page neuve.
- **Pendant une correction, lancez seulement le domaine concerné** : `npm test -- panneaux` (build puis ce domaine, ~30 s à 2 min). `python3 tests/smoke.py --liste` donne les domaines.
- **Avant de pousser** : `npm test` (tous les domaines, plusieurs minutes) doit afficher « TOUT EST OK ». Il faut `npm install` et Playwright pour Python.
- Pour voir le résultat : les captures sont dans `tests/out/` ; une vérification visuelle se fait aussi en ouvrant `dist/test.html` servi depuis la racine.
- Nouveau test : ajoutez-le au domaine qui correspond (ou créez `NN_nom.py` sur le modèle des autres) ; ne comptez pas sur l'état laissé par un autre domaine.

| Je touche à… | Fichiers | Domaine de test | Notes détaillées |
|---|---|---|---|
| Barre du haut, barre de création, languette, panneaux plaqués, arborescence | `panels.js`, `init.js`, `outliner.js`, `head.html` (CSS), `body.html` | `demarrage`, `panneaux`, `demarche` | `docs/interface.md` |
| Cube de vue, rendu, apparence | `viewcube.js`, `scene.js`, `prefs.js` | `manipulation`, `rendu`, `reperes` | `docs/interface.md` |
| Survol, poignées, groupes, navigation, magnétisme | `hover.js`, `gizmo.js`, `scene.js` | `manipulation` | `docs/modelisation.md` |
| Esquisses, plans, Bézier | `sketch.js`, `planes.js`, `core.js` | `esquisse` | `docs/modelisation.md` |
| Matières, perçages, repères d'échelle | `scene.js`, `ui.js`, `refs.js` | `rendu`, `guide`, `reperes` | `docs/modelisation.md` |
| Validation, Mécanique, bulle, étiquettes de liaison | `validate.js`, `ui.js`, `bubble.js` | `mecanique` | `docs/simulation.md` |
| Structures | `struct.js`, `bubble.js` | `structures` | `docs/simulation.md` |
| Guide, tutos, exercices, bibliothèque, exemples | `guide.js`, `lessons.js`, `examples.js` | `guide`, `bibliotheque`, `exemples` | `docs/pedagogie.md` |
| Passerelle avec la Centrale | `centrale.js`, `centrale.json` | `centrale` | `docs/centrale.md`, `PASSERELLE.md` |

## Carte de `src/`
- `head.html` : toute la feuille de style (variables de couleur sur `:root`, mode sombre) ; `body.html` : le HTML de la page.
- `core.js` : imports three.js, icônes, `toast`, géométrie des pièces (`getGeometry`, primitives, esquisses, groupes).
- `prefs.js` : niveau et apparence (`prefs`, enregistrés dans le navigateur) ; `scene.js` : scène, caméra, annuler (`commit`/`undo`), `addPart`, `sync()` (met la vue à jour), matériaux et rendu.
- `ui.js` : panneau Propriétés (`renderInspector`), liaisons et simulation du mouvement ; `sketch.js` : éditeur d'esquisse ; `validate.js` : atelier Valider ; `struct.js` : atelier Structures.
- `examples.js` (`SAMPLES`), `lessons.js` (`LESSONS`), `guide.js` (`#demo`), `outliner.js` (arborescence), `bubble.js` (bulle de simulation), `workspace.js` (ateliers), `panels.js` (panneaux flottants et plaqués), `hover.js` (survol, navigation), `gizmo.js` (poignées), `viewcube.js`, `refs.js`, `planes.js`, `centrale.js`, `init.js` (branchements, boucle d'affichage, `window.__etabli` utilisé par les tests).

## Conventions transversales
- Niveaux : `<html data-level="1|2|3">`. `data-min="2"` / `data-min="3"` réserve un élément à un niveau, `data-max="2"` le masque au-dessus ; en JS, `lv(n)`. Niveau des formes : `KIND_LVL` ; des exemples : `level`.
- Ateliers : `<html data-ws="model|check|mech|struct">` ; un élément `data-ws="model mech"` n'apparaît que dans ces ateliers. `setWs(k)`, variable `ws`. Navigation dans `#flow` (barre du haut), rendue par `updateSteps()`. La Mécanique exige `mechReady()`.
- Pour placer quelque chose sur la vue : `toStage(v)` (monde → coordonnées de `#stage`) et `evStage(ev)`, pas le rectangle du canevas. Caméra : utilisez toujours `camera` (jamais `camP`).
- Ne pas confondre `MATIERES` (matières des pièces, scene.js), `MATS` (couleurs du tapis, prefs.js) et `MATERIALS` (Structures).

## Publier
- Le push sur `main` déploie automatiquement sur GitHub Pages, et `.github/workflows/miroirs.yml` copie le dépôt sur la forge GitLab et le site sur technoversailles.alwaysdata.net (réglages : README, « Mise en ligne »).
- `dist/artifact.html` est la même page sans `<html>`/`<head>`. Après chaque push, la republier sur l'artefact existant https://claude.ai/artifact/XoZ1sPmBrX1jkPcmeEoHVf (passer cette adresse en `url` pour garder le même lien ; ne pas créer un nouvel artefact).
- Après tout ajout de tuto, exercice ou exemple : mettre à jour `centrale.json` et `ateliers.json` (voir `docs/centrale.md`).
