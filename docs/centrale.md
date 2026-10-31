# Passerelle avec la Centrale (serveur de la classe)

Notes détaillées pour Claude (voir la carte dans `CLAUDE.md`). Le contrat lui-même est dans `PASSERELLE.md` (même plan que NetSim). Test : domaine `centrale` (fausse Centrale : `tests/centrale/js/centrale-client.js`).

## Fichiers
- `centrale.json` et `ateliers.json` (catalogue des ateliers, `Etabli3D.ateliers()`) à la racine, copiés dans `dist/` par `build.py` avec `outils/`.
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
- **Après tout ajout de tuto, exercice ou exemple** : mettre à jour `activites.liste` et `ateliers.json` (`outils/verifier-descripteur.html` donne les deux, le domaine de test `centrale` vérifie) et augmenter `atelier.version` = `ETABLI_VERSION`.

## Sans serveur
- `etabliOuvrirAdresse()` (au démarrage et sur `hashchange`) : `#activite=<id>` ouvre l'activité sans la Centrale ; ignoré si `centrale=` est dans l'adresse.
- `deposerSurNuage()` (Fichier → Déposer sur Nuage, `#bNuage`) : `offerFile` du projet, puis lien Nuage de la session Centrale ou `etabli3d.nuage` ; sinon `nuageFenetre()` demande le lien au professeur.
- Test : domaine `centrale` (« Sans serveur »).
- Format du projet : `PROJET_FORMAT` (2).

## Compétences
- `COMP_CAT` (catégorie → capacités par niveau) donne `competences` de chaque activité ; à changer aussi dans `centrale.competences.par_categorie` de `centrale.json` (le vérificateur compare les listes).
- `centraleProgres` ajoute `constats` (via `constatsActivite`) quand un tuto ou un exercice vient d'être terminé : capacités du niveau de la classe (`niveauEleve()`), `indices` = 1 si « Un indice ? » a été ouvert (`CZ.indices`) ou pour un tuto, une seule fois par session (`CZ.constate`).
- Test : domaine `centrale` (« constats envoyés à la réussite »).
