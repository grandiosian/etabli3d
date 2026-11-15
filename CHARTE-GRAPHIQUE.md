# Charte graphique — Établi 3D

Ce document fixe l'identité visuelle d'Établi 3D. Il s'impose à l'application, au portail de la Centrale (cartes d'atelier, pastille du haut), aux fiches et aux documents qui la présentent.

Pour changer un élément, on modifie d'abord ce document, puis :
- le code d'Établi 3D (`src/head.html` pour les couleurs, `src/body.html` pour le logo) ;
- le portail de la Centrale (`centrale/public/index.php` : `LOGOS.etabli3d` et la classe `.app-etabli3d`).

Règles communes aux applications élèves (barre du haut, mesures) : [SPECIFICATION de la Centrale, §2.6](../centrale/public/passerelle/SPECIFICATION.md).

## 1. Identité

| | |
|---|---|
| Nom | **Établi 3D**, avec l'accent sur le É |
| Identifiant | `etabli3d` (ne change jamais) |
| Rôle | Modeleur 3D : volumes, perçages, esquisses, liaisons, simulation, export STL |
| Univers | L'établi de l'atelier : tapis de découpe vert, ruban jaune de mesure |
| Icône de secours | 🧊 (`centrale.json`, champ `icone`) |

## 2. Logo

Un cube en perspective, dessiné au trait, à la couleur principale.

```svg
<svg viewBox="0 0 32 32" fill="none" stroke="#1d7656" stroke-width="2.2" stroke-linejoin="round">
  <path d="M16 3 28 9.5v13L16 29 4 22.5v-13z"/>
  <path d="M4 9.5 16 16l12-6.5M16 16v13"/>
</svg>
```

- **Où il se trouve** : bouton du logo `button.brand#bFile` (`src/body.html`). Il prend la couleur `--accent`.
- **Thème sombre** : le trait passe en `#4cb889`.
- **Tailles** :
  - barre du haut : 28 px ;
  - tuile du portail : 64 % de la tuile, sur un fond `--app` à 13 %.
- **Épaisseur du trait** : 2,2 dans l'application, 2,4 sur les petites tuiles.
- **Interdits** :
  - remplir le cube ;
  - le colorer face par face ;
  - le faire tourner ;
  - ajouter une ombre.

## 3. Couleurs

| Rôle | Clair | Sombre | Variable |
|---|---|---|---|
| **Couleur principale** (portail : `--app`) | `#1d7656` vert établi | `#4cb889` | `--accent` |
| Fond doux de la couleur principale | `#d3e9de` | `#1c3a2f` | `--accent-soft` |
| **Bande des cartes du portail** (vert) | `#1d7656` | `#4cb889` | portail : `--app-bande` |
| Fond | `#e9eeeb` | `#111816` | `--bg` |
| Panneaux | `#f8faf8` | `#19211e` | `--panel` |
| Texte | `#18231f` | `#e3ece8` | `--ink` |
| Texte secondaire | `#51625b` | `#9bb0a8` | `--ink-2` |
| Traits | `#c9d4ce` | `#33413c` | `--line` |
| Repère jaune (Guide, cotes, sélection) | `#df9a00` | `#f3b733` | `--mark` |
| Danger (supprimer) | `#bf3b28` | `#ff7b64` | `--danger` |
| Scène 3D | `#dde5e1` | `#141c19` | `--scene` |

- **Guide** : il porte le liseré jaune `--mark` de 4 px et un titre « GUIDE · … » en jaune. Ce repère est repris par la consigne de NetSim.

## 4. Typographies

| Usage | Police | Variable |
|---|---|---|
| Titres, logo, onglets | Saira Semi Condensed (600, 700) | `--f-display` |
| Texte | IBM Plex Sans | `--f-body` |
| Cotes, valeurs | IBM Plex Mono | `--f-mono` |

## 5. Règles d'usage

- **Barre du haut** : la référence commune. Sous 860 px, elle se resserre sans jamais élargir la page (`docs/interface.md`).
- **Barres et panneaux** : semi-transparents, la scène 3D continue dessous.
- **Tapis** : vert avec « PLAN DE TRAVAIL » écrit dessus.
- **Textes visibles** : en français, simples, pour des élèves de collège.
