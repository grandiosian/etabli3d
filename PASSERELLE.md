# Passerelle Établi 3D ↔ Centrale

Ce document est le contrat entre **la Centrale** (application centralisatrice : connexion des élèves, sauvegarde, progression, portail, parcours, suivi) et **Établi 3D** (application cible). Il résume les structures de données d’Établi 3D, la façon dont elles sont gérées, et ce que chaque côté s’engage à respecter.

La version lisible par une machine est **[`centrale.json`](centrale.json)**, servi à l’adresse :

```
https://grandiosian.github.io/etabli3d/centrale.json
```

Même modèle que NetSim (`passerelle.atelier` v1) : la Centrale lit toutes les applications de la même façon.

---

## 1. Le descripteur d’atelier (`passerelle.atelier` v1)

Un fichier JSON à la racine du site, nommé `centrale.json`.

| Section | Contenu | Utilisation par la Centrale |
|---|---|---|
| `format`, `version` | `"passerelle.atelier"`, `1` | Reconnaître le fichier. |
| `atelier` | `app` (`etabli3d`), `nom`, `description`, `url`, `urls_secours`, `icone`, `classes`, `version` | Remplir l’onglet **Ateliers**. |
| `centrale` | Module chargé, serveur par défaut, sites à autoriser, connexion, **parcours** (`bouton_suivant`, `avant_de_quitter`, `arrivee`), fonctions du module utilisées | Savoir quoi autoriser et ce que l’application prend en charge. |
| `activites` | 39 activités : tutos (`tuto-…`), exercices (`exo-…`), exemples (`ex-…`), avec `id`, `titre`, `groupe`, `total` et des champs descriptifs | Colonnes du **Suivi**, cartes du **portail**, étapes de **parcours**. |
| `progression` | Quand l’application envoie la progression, ce que veulent dire `faites`, `total`, `statut` | Interpréter l’avancement. |
| `donnees` | Une clé : `projet` | Afficher, valider ou exporter le travail de l’élève. |
| `fichiers` | `dossier_projet: true` ; `recoit` et `produit` : listes de `{ nom, nom_conseille, type, description }`, `nom` étant un motif par extension (`*.json`, `*.stl`…) | Étapes « reçoit / produit » des ateliers transversaux. |
| `stockage_local` | Clés `localStorage` | Dépannage sur un poste. |
| `acces_javascript` | `window.Etabli3D` | Point d’accès unique. |
| `enums` | Niveaux, catégories, matières (masse volumique), cotes de chaque forme | Libellés. |
| `$defs` | Schémas JSON 2020-12 : `Projet`, `Piece`, `Matiere`, `Esquisse`, `Liaison`, `Structure`, `Progression`, `Resume`… | Validation. |

### Règles à respecter

**Côté Établi 3D**
- Les `id` d’activité sont **stables** : `tuto-premiers`, `exo-de`, `ex-maison`… ne sont jamais renommés ; on en ajoute d’autres.
- `Centrale.init({ activites })` envoie exactement `activites.liste` (champs `id`, `titre`, `groupe`, `total`), dans le même ordre.
- La valeur passée à `Centrale.sauver('projet', …)` respecte `$defs/Projet`.
- `atelier.version` (et `ETABLI_VERSION` dans `src/centrale.js`) augmente à chaque changement du descripteur.
- Établi 3D fonctionne sans la Centrale (le module est facultatif).

**Côté Centrale**
- L’application est identifiée par `atelier.app` (`etabli3d`).
- `faites` ne baisse jamais : le meilleur résultat est gardé.
- Les clés et champs inconnus sont ignorés.

---

## 2. Les données d’Établi 3D

### Vue d’ensemble

```
                  ┌──────────────── Établi 3D (navigateur de l’élève) ─────────────────┐
                  │                                                                     │
  Fichier ▸ Enreg.│   state (projet en cours)  ──► localStorage « etabli3d.autosave »   │
  Fichier ▸ Ouvrir│     ├─ parts[]    pièces (volumes, esquisses, groupes, perçages)    │
                  │     │             avec leur matière (mat) et leurs repères          │
                  │     ├─ joints[]   liaisons, moteurs, transmissions                  │
                  │     ├─ struct     treillis / maillage (atelier Structures)          │
                  │     ├─ textures   images de matière                                 │
                  │     └─ note, tp   fiche d’exemple, consignes du professeur          │
                  │                                                                     │
                  │   PROG (avancement) ──► localStorage « etabli3d.progress »          │
                  │     done[tuto:k | exo:k | ex:k], seen[…], part[k]                   │
                  │                                                                     │
                  │   window.Etabli3D  ◄── point d’accès unique                         │
                  └──────────────┬──────────────────────────────────────────────────────┘
                                 │ centrale-client.js (si connecté)
        sauver("projet") ────────┤ charger("projet")
        progression(id, …) ──────┤ mesProgressions()
        init({activites}) ───────┤ activiteDemandee()
        envoyerFichier(stl) ─────┤
        projet.sauver(sorties) ──┤ projet.charger(entrées)     (ateliers transversaux)
        avantDeQuitter ──────────┤ (dépôt des sorties avant « Étape suivante »)
                                 ▼
                             Centrale
```

### Le projet (`projet`)

Le document est décrit en entier par `$defs/Projet`. Exemple réduit :

```json
{
  "app": "etabli3d", "version": 2, "name": "Porte-crayon", "nextId": 4,
  "parts": [
    { "id": 1, "kind": "group", "name": "Porte-crayon", "color": "#c8955a", "mat": { "k": "bois" },
      "hole": false, "pos": [0, 0, 0], "rot": [0, 0, 0], "params": {},
      "children": [
        { "id": 2, "kind": "cylinder", "params": { "d": 60, "h": 90 }, "hole": false, "pos": [0, 0, 0], "rot": [0, 0, 0] },
        { "id": 3, "kind": "cylinder", "params": { "d": 52, "h": 90 }, "hole": true,  "pos": [0, 0, 4], "rot": [0, 0, 0] } ] }
  ],
  "joints": [], "struct": null, "note": null,
  "tp": { "title": "Porte-crayon", "tasks": [{ "t": "Graver ton prénom", "done": false }] },
  "textures": null
}
```

| Champ | Description |
|---|---|
| `parts[].kind` | `box`, `cylinder`, `sphere`, `cone`, `pyramid`, `wedge`, `tube`, `torus`, `text`, `gear`, `rack`, `sketch`, `group`. Cotes dans `params` (mm, voir `enums.formes`). |
| `pos`, `rot` | Position (mm) et rotation (degrés, ordre XYZ) dans le repère du parent. Z vers le haut, base de la pièce à z = 0. |
| `hole` | Perçage : retire la matière des solides **du même groupe**. |
| `children` | Pièces d’un groupe ; la forme du groupe est recalculée par l’application. |
| `mat` | Matière : `pla`, `bois`, `mdf`, `carton`, `acier`, `alu`, `laiton`, `plexi`, `caoutchouc`, `beton`, `pierre`, ou `{ k: "image", img, size }`. Donne l’aspect et la masse volumique. |
| `textures` | Images de matière utilisées (`{ id: { name, src } }`, JPEG de 512 px au plus). |
| `valid`, `locs` | Validation et repères calculés dans l’atelier Valider : à conserver, à ne pas fabriquer. |
| `joints[]` | Liaisons `fixe`, `pivot`, `glissiere` ; `motor`, `driver` (transmission par rapport). |
| `struct` | Atelier Structures (plan vertical, mm / N / MPa). |
| `note`, `tp` | Fiche de l’exemple ouvert, consignes du professeur cochées par l’élève. |

Ce qui **n’est pas** enregistré : les maillages (recalculés), l’état de la simulation, la vue, les préférences d’affichage.

### La progression

Dans Établi 3D (`PROG`, clé locale `etabli3d.progress`) :

```json
{ "done": { "tuto:premiers": 1761900000000, "ex:maison": 1761900100000 },
  "seen": { "tuto:premiers": 1, "exo:de": 1, "ex:maison": 1 },
  "part": { "premiers": 6, "de": 2 } }
```

Envoyée à la Centrale par `Centrale.progression(id, Etabli3D.progression(id))` :

```json
{ "titre": "Dé à jouer", "faites": 2, "total": 3, "statut": "commence" }
```

| Établi 3D | Centrale | Règle |
|---|---|---|
| `part[k]` | `faites` | Tuto : étapes réussies ; exercice : critères réussis (vérifiés automatiquement). Jamais diminué. |
| nombre d’étapes / critères / cases « À essayer » | `total` | |
| `done["type:k"]` | `statut: "termine"` | Sinon `"commence"`. Un exemple compte 0 puis `total` quand toutes ses cases sont cochées. |

### Les compétences

Établi 3D s’appuie sur le référentiel de la Centrale (`/passerelle/competences.json`, codes `OST…`, `SFC…`, `CCRI…`).

- **Déclaration** : chaque activité de `activites()` porte `competences`, les capacités qu’elle travaille (5e, 4e, 3e), d’après sa catégorie (`COMP_CAT` dans `centrale.js`, recopié dans `centrale.competences.par_categorie` du descripteur) : modéliser et esquisser → `CCRI16.x.1` ; mouvement → `SFC11` + `CCRI16` ; structures → `CCRI21.x.1`.
- **Constats** : à la réussite d’un tuto ou d’un exercice (une fois par session), la progression envoyée contient `constats` : une ligne par capacité **du niveau de l’élève** (chiffre au début de sa classe, 5e par défaut).

```json
{ "titre": "Plaque percée", "faites": 3, "total": 3, "statut": "termine",
  "constats": [{ "competence": "CCRI16.5.1", "reussi": true, "indices": 1, "essais": 1,
                 "preuve": "Exercice « Plaque percée » : 3/3" }] }
```

| Situation | `indices` | Niveau calculé par la Centrale |
|---|---|---|
| Exercice réussi sans ouvrir « Un indice ? » | 0 | 4 (très bonne maîtrise) |
| Exercice réussi après l’indice, ou tuto guidé terminé | 1 | 3 (maîtrise satisfaisante) |

Les exemples n’envoient pas de constat (rien n’y est vérifié). Le bilan (moyenne haute de tous les constats et des notes du professeur) est calculé par la Centrale.

### Les fichiers

Pour les ateliers transversaux (`fichiers` dans `centrale.json`). Établi 3D reconnaît un fichier à son **extension** : le professeur peut nommer les fichiers d’une étape comme il veut. Le descripteur déclare donc des **motifs** (`nom`), avec un `nom_conseille` ; la Centrale vérifie l’enchaînement des étapes avec ces motifs.

| Sens | Motif (`nom`) | Nom conseillé | Type | Contenu |
|---|---|---|---|---|
| reçoit | `*.json` | `projet.etabli3d.json` | `application/json` | Projet de départ (`$defs/Projet`). Un `.json` qui n’est pas un projet est ignoré. |
| produit | `*.json` | `projet.etabli3d.json` | `application/json` | Projet de l’élève (sauf `resume.json`). |
| produit | `resume.json` | `resume.json` | `application/json` | Résumé : pièces, tailles, volumes, matières, masses, liaisons (`$defs/Resume`). Le nom doit finir par `resume.json`. |
| produit | `*.stl` | `piece.stl` | `model/stl` | Maillage en mm des pièces solides, pour l’impression 3D. |
| produit | `*.png` | `apercu.png` | `image/png` | Image de la vue 3D. |

### Quand les données circulent

| Moment | Établi 3D fait |
|---|---|
| Chargement de la page | Lit `etabli3d.autosave` et `etabli3d.progress` ; charge le module de la Centrale (sans effet s’il est injoignable). |
| Connexion (« Mon code » ou jeton `#centrale=`, repéré **avant** `Centrale.init` qui le retire de l’adresse) | `mesProgressions()` → fusion (le meilleur gagne) → renvoie ce qui est meilleur localement. `charger("projet")` → remplace le projet local s’il diffère (Annuler pour revenir), sinon `sauver("projet")`. Puis ouvre `activiteDemandee()` si l’élève n’y est pas déjà. |
| Arrivée dans une étape d’atelier transversal | Ouvre le `.json` déjà déposé par l’élève ou son équipe (sorties de l’étape), sinon le `.json` reçu (entrées, ou fichier fourni par le professeur). Garde le projet en cours s’il est plus récent : projet du serveur modifié après ce dépôt, ou étape déjà commencée sur ce poste sans dépôt (repère local `etabli3d.atelier:<parcours>:<étape>`). L’ancien projet reste dans Annuler. |
| Chaque modification (et Annuler / Rétablir) | `etabli3d.autosave` après 400 ms, puis `sauver("projet")` (regroupé par la Centrale). |
| Ouverture d’un tuto, d’un exercice ou d’un exemple ; étape réussie ; activité terminée | `progression(id, …)`. |
| Fichier → Envoyer le STL au professeur | `envoyerFichier(stl, nomFichier("stl", nom du projet))`. |
| « Étape suivante → » ou « ← Mes ateliers » (bouton du module) | `avantDeQuitter` : dépose chaque sortie de l’étape (`.json`, `resume.json`, `.stl`, puis `.png`), si le projet a changé depuis le dernier dépôt. C’est ce dépôt qui termine l’étape et ouvre la suivante en mode « dans l’ordre ». |
| Fichier → Reprendre le fichier de l’atelier / Déposer dans le dossier de l’atelier | `projet.charger(…)` (dépôt de l’élève, sinon entrée) / `projet.sauver(sortie, fichier)` pour chaque sortie de l’étape. En équipe, un conflit (coéquipier plus récent) est signalé au lieu d’écraser. |
| Déconnexion | Le module envoie ce qui reste ; Établi 3D continue dans le navigateur. |

---

### Le catalogue des ateliers et le travail sans serveur

- **`ateliers.json`** (format `catalogue.ateliers` v1 de la Centrale), à côté de `centrale.json` : un tuto, un exercice ou un exemple = un atelier, tous niveaux, avec ses compétences et son activité. Produit par `Etabli3D.ateliers()`, vérifié par `outils/verifier-descripteur.html` et par `npm test`, copié dans `dist/` par `build.py`. La Centrale l’importe dans Ateliers → « Ateliers des applications ».
- **Ouvrir par l’adresse** : `…/etabli3d/#activite=exo-plaque` ouvre l’activité, même sans la Centrale. Depuis le portail (`#centrale=…&activite=…`), c’est la connexion qui ouvre l’activité demandée.
- **Sauvegarde de secours** : Fichier → « Déposer sur Nuage » enregistre le projet (`5A-07-mon-projet.json` si l’élève est connecté) puis ouvre le dossier Nuage de la classe : lien de la Centrale, sinon lien collé une fois sur le poste par le professeur (clé locale `etabli3d.nuage`).

Règles communes à toutes les applications : [Données, bonnes pratiques et compatibilité](https://technoversailles.alwaysdata.net/passerelle/?doc=donnees).

## 3. Point d’accès JavaScript

`window.Etabli3D` est le seul endroit où le code de connexion à la Centrale lit les données d’Établi 3D. Un test, l’outil de vérification ou une autre application s’en servent de la même façon.

| Membre | Rôle |
|---|---|
| `Etabli3D.app`, `Etabli3D.version`, `Etabli3D.descripteur` | `"etabli3d"`, la version (identique à `centrale.json`), `"centrale.json"`. |
| `Etabli3D.activites()` | Liste envoyée à `Centrale.init`. |
| `Etabli3D.catalogue()` | Catalogue détaillé : type, niveau, catégorie, résumé. |
| `Etabli3D.ateliers()` | Contenu de `ateliers.json` (catalogue des ateliers). |
| `Etabli3D.progression(id)` | `{titre, faites, total, statut}` ou `null` (les `constats` sont ajoutés à l’envoi). |
| `Etabli3D.fusionnerProgression(serveur)` | Fusionne le résultat de `Centrale.mesProgressions()`. |
| `Etabli3D.donnees()` | `{projet}`. |
| `Etabli3D.estProjet(objet)` | Vérifie qu’un objet est un projet chargeable. |
| `Etabli3D.ouvrirProjet(objet)` | Ouvre un projet (l’ancien reste dans Annuler). |
| `Etabli3D.resume()` | Résumé calculé. |
| `Etabli3D.fichier(nom)` | `Promise<Blob>` du fichier produit d’après l’extension. |

---

## 4. Faire évoluer Établi 3D sans casser la Centrale

1. Ajouter un tuto, un exercice ou un exemple : nouvelle clé dans `LESSONS` ou `SAMPLES`, jamais réutilisée.
2. Ouvrir [`outils/verifier-descripteur.html`](outils/verifier-descripteur.html) (en ligne : `…/etabli3d/outils/verifier-descripteur.html`) : la page compare `centrale.json` et `ateliers.json` avec l’application et donne leur contenu à jour. `npm test` fait la même vérification.
3. Augmenter `atelier.version` et `ETABLI_VERSION` (`src/centrale.js`).
4. Changer la forme du projet : mettre à jour `$defs/Projet`, augmenter `PROJET_FORMAT`, et garder la lecture de l’ancienne forme (les élèves ont du travail enregistré).
