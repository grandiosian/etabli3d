# Passerelle — contrat de connexion

Ce document décrit comment une **application centralisatrice** (ENT, portail de classe, tableau de bord du professeur…) et une **application cible** (ici Établi 3D) se connectent. Il sert de descripteur commun : chaque côté le respecte, et une nouvelle app cible peut s'y brancher en publiant son propre manifeste.

| Fichier | Rôle |
|---|---|
| `passerelle/manifest.json` | Carte d'identité de l'app cible : formats, unités, requêtes, événements, sécurité. Injecté dans l'app par `build.py`. |
| `passerelle/etabli3d.schema.json` | Schéma JSON (2020-12) du document `etabli3d.project`. |
| `passerelle/passerelle.js` | Client pour le centralisateur (module ES, sans dépendance). |
| `passerelle/hub-exemple.html` | Centralisateur d'essai : intègre l'app et appelle chaque requête. |
| `src/bridge.js` | Implémentation côté Établi 3D. |

En ligne : `https://grandiosian.github.io/etabli3d/passerelle/manifest.json` (et les autres fichiers à côté).

## 1. Principes

- **Transport** : `window.postMessage` entre le centralisateur et l'app ouverte dans une `<iframe>` (ou par `window.open`). Aucun serveur n'est nécessaire.
- **Le document fait foi** : l'app cible possède son format ; le centralisateur le stocke et le renvoie **sans le modifier** (il conserve les champs qu'il ne connaît pas). Pour ses tableaux de bord, il lit le **résumé** (`summary.get`), calculé par l'app, plutôt que d'interpréter la géométrie lui-même.
- **Versions** : `protocolVersion` (enveloppe, ici 1) et `formatVersion` (document, ici 2) évoluent séparément. Un ajout de champ facultatif ne change pas la version ; une rupture l'augmente. L'app refuse un document plus récent qu'elle (`too-new`).
- **Unités et repère** : mm, degrés, N, MPa, g/cm³, g ; Z vers le haut ; rotations d'Euler en ordre XYZ ; chaque pièce a sa base à z = 0 dans son repère.

## 2. Enveloppe des messages

Requête (centralisateur → app) :

```json
{ "protocol": "passerelle", "v": 1, "id": "h12", "type": "project.get", "data": {} }
```

Réponse (app → centralisateur) :

```json
{ "protocol": "passerelle", "v": 1, "app": "etabli3d", "id": "e7", "type": "reply", "replyTo": "h12", "ok": true, "data": { … } }
{ …, "type": "reply", "replyTo": "h12", "ok": false, "error": { "code": "bad-project", "message": "…" } }
```

Événement (app → centralisateur, sans `replyTo`) : `{ "protocol": "passerelle", "v": 1, "app": "etabli3d", "type": "project.changed", "data": { … } }`.

Codes d'erreur : `not-connected`, `refused`, `bad-project`, `too-new`, `empty`, `unknown-type`, `failed` (et `timeout` côté client).

## 3. Déroulement

1. Le centralisateur ouvre l'app : `https://…/etabli3d/?hub=https://mon-ent.fr` (le paramètre `hub` fixe la seule origine acceptée, sans question à l'élève).
2. L'app envoie `ready` (avec son manifeste) à cette origine. Sans `?hub=`, elle n'envoie rien d'elle-même et attend `hello`.
3. Le centralisateur envoie `hello` `{ hub: { name }, protocolVersion }` jusqu'à recevoir la réponse `{ manifest, formatVersion, revision }`.
4. Il s'abonne : `events.subscribe { events: ["project.changed", …], withProject: true }`.
5. Il ouvre le travail de l'élève (`project.load`), écoute les changements, récupère le projet, le STL ou une vignette quand il en a besoin.

```js
import { Passerelle } from './passerelle.js';
const app = await Passerelle.connect(iframe, { origin: 'https://grandiosian.github.io', hub: { name: 'Mon ENT' } });
await app.request('project.load', { project: copieEleve });
app.on('project.changed', ({ revision, project }) => enregistrer(project));
await app.subscribe(['project.changed', 'project.saved'], { withProject: true });
const { totals } = await app.request('summary.get');
```

## 4. Requêtes

| Type | Données envoyées | Réponse |
|---|---|---|
| `hello` | `{ hub: { name }, protocolVersion }` | `{ manifest, formatVersion, revision }` |
| `project.get` | — | `{ project, revision }` |
| `project.load` | `{ project, name? }` | `{ ok, parts, revision }` — historique remis à zéro |
| `project.new` | `{ name? }` | `{ revision }` |
| `summary.get` | — | voir § 6 |
| `export.stl` | `{ selection?: bool }` | `{ name, mime: "model/stl", base64, triangles }` |
| `view.thumbnail` | `{ width?, height? }` | `{ mime: "image/png", dataUrl, width, height }` |
| `selection.get` / `selection.set` | — / `{ ids }` | `{ ids }` |
| `ui.set` | `{ level?: 1\|2\|3, workspace?: "model"\|"check"\|"mech"\|"struct" }` | `{ level, workspace }` |
| `progress.get` | — | `{ done: { "tuto:k" \| "exo:k" \| "ex:k": horodatage } }` |
| `events.subscribe` | `{ events: [], withProject?: bool }` | `{ events }` |

Événements : `ready`, `project.changed { revision, project? }` (300 ms après la dernière modification), `project.saved { name }`, `selection.changed { ids }`, `progress.changed { done }`.

## 5. Le document `etabli3d.project` (format 2)

```text
{ app: "etabli3d", version: 2, name, nextId,
  parts:   [Part],              pièces de premier niveau
  joints:  [Joint],             liaisons (Mécanique)
  struct:  Struct | null,       atelier Structures (treillis, maillage)
  note:    { observe[], try[] } | null,   fiche d'exemple
  tp:      { title, tasks: [{ t, done }] } | null,   consignes du professeur
  textures:{ id: { name, src: dataURL } } | null }   images de matière
```

**Part** — `{ id, kind, name, params, color, hole, pos[3], rot[3], mat?, children?, hidden?, locked?, valid?, locs? }`

- `kind` : `box`, `cylinder`, `sphere`, `cone`, `pyramid`, `wedge`, `tube`, `torus`, `text`, `gear`, `rack`, `sketch`, `group`. Les cotes de chaque forme sont dans `params` (liste complète dans le schéma).
- `hole: true` : perçage ; il retire la matière des solides **du même groupe**. Un `group` porte ses pièces dans `children`, positionnées dans le repère du groupe ; la géométrie du groupe est recalculée par l'app (CSG).
- `mat` : matière `{ k }` parmi `pla`, `bois`, `mdf`, `carton`, `acier`, `alu`, `laiton`, `plexi`, `caoutchouc`, `beton`, `pierre`, ou `{ k: "image", img, size }` (image de `textures`, projetée sur trois plans, motif de `size` mm). La matière donne l'aspect et la masse volumique.
- `valid` et `locs` sont produits par l'atelier Valider : à conserver, à ne pas fabriquer.
- `sketch` : `params = { sk: { pts, lines, circles, beziers, cons }, mode: "extrude"|"revolve", h, plane: "xy"|"xz"|"yz" }`.

**Joint** — `{ id, name, type: "fixe"|"pivot"|"glissiere", child, parent|null, origin[3], axis[3], min, max, motor: { mode: "continu"|"alternatif", speed } | null, driver: { joint, ratio } | null, loc }`. Une pièce mobile n'a qu'une liaison ; `parent: null` = le bâti.

**Identifiants** : entiers partagés par pièces, enfants et liaisons ; `nextId` est le prochain libre. Un centralisateur qui fusionne deux projets doit renuméroter.

## 6. Résumé (`summary.get`)

```json
{ "name": "Porte-crayon", "revision": 3, "level": 1, "workspace": "model",
  "units": { "length": "mm", "volume": "cm3", "mass": "g" },
  "parts": [{ "id": 1, "name": "Porte-crayon", "kind": "group", "hole": false, "material": "bois",
              "size": [60, 60, 90], "volume": 71.71, "mass": 35.86, "validation": "none", "children": 2 }],
  "joints": [], "totals": { "parts": 1, "solids": 1, "holes": 0, "joints": 0, "mass": 35.86, "mechReady": false },
  "struct": { "module": "treillis", "nodes": 0, "bars": 0 } }
```

`validation` : `none` (jamais validée), `stale` (modifiée depuis), `ok`, `warn`, `err`.

## 7. Sécurité

- L'app n'écoute que sa fenêtre parente (ou d'ouverture) et répond à l'origine exacte de l'expéditeur, jamais à `*`.
- Origines acceptées : celle passée dans `?hub=` (alors seule acceptée), celles de `security.trustedHubs` du manifeste, celles que l'utilisateur a autorisées (bandeau « Connexion demandée », mémorisé dans le navigateur, clé `etabli3d.hubs`).
- Avant `hello` accepté, toute requête reçoit `not-connected`. Un projet reçu est vérifié (`id`, `kind`, `pos`, `rot`, `children` des groupes) avant d'être ouvert.
- Le centralisateur doit lui aussi vérifier `event.origin` et `event.source` (le client `passerelle.js` le fait).

## 8. Brancher une autre app cible

1. Publier un `manifest.json` de même forme (`protocol`, `protocolVersion`, `app`, `document`, `requests`, `events`, `security`) et le schéma de son document.
2. Implémenter au minimum `hello`, `project.get`, `project.load`, `summary.get` et l'événement `project.changed`, avec la même enveloppe et les mêmes codes d'erreur.
3. Donner dans le résumé des grandeurs simples et nommées (unités dans `units`) : c'est ce que le centralisateur affiche.

## 9. Liste de contrôle

**App cible** : manifeste à jour à chaque nouvelle requête ; `formatVersion` augmenté si le document change de façon incompatible ; tests (`npm test` vérifie la passerelle via `hub-exemple.html`).

**Centralisateur** : `?hub=` dans l'adresse de l'iframe ; vérifier l'origine ; stocker le document tel quel ; comparer `revision` pour éviter d'écraser une version plus récente ; prévoir `timeout` et les codes d'erreur.
