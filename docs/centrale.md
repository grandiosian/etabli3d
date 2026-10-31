# Passerelle avec la Centrale (serveur de la classe)

Notes détaillées pour Claude (voir la carte dans `CLAUDE.md`). Le contrat lui-même est dans `PASSERELLE.md` (même plan que NetSim). Test : domaine `centrale` (fausse Centrale : `tests/centrale/js/centrale-client.js`).

## Fichiers
- `centrale.json` à la racine (format `passerelle.atelier` v1), copié dans `dist/` par `build.py` avec `outils/`.
- Code dans `src/centrale.js`.

## Point d'accès
`window.Etabli3D` (point d'accès unique) : `activites()`, `catalogue()`, `progression(id)`, `fusionnerProgression`, `donnees()` = `{projet}`, `estProjet`, `ouvrirProjet`, `resume()`, `fichier(nom)`.

## Connexion
- Chargement du module `js/centrale-client.js` depuis `window.CENTRALE_URL` ou le serveur par défaut ; bouton `#bCentrale` « Mon code » ; entrées `.cz-item` du menu Fichier une fois connecté.
- Le jeton `#centrale=` du portail se repère AVANT `Centrale.init` (le vrai module le retire de l'adresse ; la fausse Centrale des tests aussi).

## Ateliers transversaux
- `atelierArrivee(E)` ouvre le .json déposé (sorties) sinon reçu (entrées), sauf projet plus récent (`CZ.projetMaj` = date du projet serveur avant connexion, repère local `etabli3d.atelier:<parcours>:<étape>`).
- `centraleAvantDeQuitter` (option `avantDeQuitter` de `Centrale.init`) dépose les sorties (`atelierDepot`, triées par `coutSortie`) si le projet a changé (`CZ.depose`).
- Fichiers déclarés par motif d'extension (`*.json`, `*.stl`, `*.png`, `resume.json`) avec `nom_conseille`.

## Activités et progression
- Activités : `tuto-<clé>`, `exo-<clé>`, `ex-<clé>` (clés de `LESSONS` / `SAMPLES`, jamais renommées).
- `commit()` / `restore()` appellent `centraleTravail()` ; `markDone`, `lessonProgress`, `startLesson`, `loadExample` appellent `centraleProgres('type:clé')`.
- **Après tout ajout de tuto, exercice ou exemple** : mettre à jour `activites.liste` (`outils/verifier-descripteur.html` donne la liste, le domaine de test `centrale` vérifie) et augmenter `atelier.version` = `ETABLI_VERSION`.
- Format du projet : `PROJET_FORMAT` (2).
