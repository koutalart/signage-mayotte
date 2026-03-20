# Mayotte la 1ère — Digital Signage

Écran d'affichage interne diffusé via **OptiSigns** sur le réseau Mayotte la 1ère.

---

## 📺 URL de diffusion

| Hébergement | URL |
|-------------|-----|
| Cloudflare Pages | `https://signage-mayotte.pages.dev/01_lundi_info_sport.html` |
| GitHub Pages (backup) | `https://koutalart.github.io/signage-mayotte/01_lundi_info_sport.html` |

---

## 📝 Comment mettre à jour le contenu chaque matin

Toute la partie éditoriale se trouve dans **`programme.json`**. C'est le seul fichier à modifier quotidiennement.

### Étapes :

1. Ouvrir [`programme.json`](./programme.json) sur GitHub
2. Cliquer sur le **crayon ✏️** (bouton "Edit this file") en haut à droite
3. Modifier les champs nécessaires (voir guide ci-dessous)
4. Cliquer sur **"Commit changes"** → valider

Les changements sont en ligne en moins de **2 minutes** (Cloudflare se synchronise automatiquement).

---

## 📋 Guide de `programme.json`

```json
{
  "jour": "LUNDI",          ← Jour affiché dans la barre de thème et le ticker
  "theme": "INFO & SPORT",  ← Thème affiché à côté du jour

  "agenda": [               ← Chips "Au programme" sur la slide d'intro
    { "emoji": "🏥", "label": "Santé" },
    { "emoji": "🌤️", "label": "Météo" }
  ],

  "stories": {
    "iran": {
      "actif": true,                     ← false = masque la slide
      "titre": "Conflit en Iran",        ← Titre affiché sur la slide
      "compteur_debut": "2026-02-28",    ← Calcule "Jour X" automatiquement
      "flash": [                         ← 3 points flash sur la slide
        { "icon": "💥", "titre": "...", "desc": "..." }
      ],
      "card_label": "🇫🇷 Position de la France",
      "card_body": "Texte de la card info...",
      "source": "France Info — 20 mars 2026",
      "data_expires": "2026-03-28",      ← La slide disparaît après cette date
      "ticker": "🌍 Conflit en Iran · Jour {X} · ..."  ← {X} remplacé par le compteur
    }
  },

  "ticker_extra": [          ← Infos permanentes dans le ticker
    "📺 Le 19h à Mayotte 19h00"
  ]
}
```

### Désactiver une story (ex : après la fin du conflit Iran)
```json
"iran": { "actif": false }
```

### Calculateur Jour X
Le champ `compteur_debut` (format `YYYY-MM-DD`) calcule automatiquement le numéro du jour.
Exemple : `"compteur_debut": "2026-02-28"` → le 20 mars 2026 affiche **Jour 21**.

---

## 🔄 Mise à jour automatique (GitHub Actions)

Le fichier `data.json` (météo + actus RSS) est **régénéré automatiquement toutes les heures** par GitHub Actions.

- Météo : open-meteo.com (coordonnées Mayotte)
- Actus Mayotte : `rss.app/feeds/GcKEWQW6TsvCtxKv.xml`
- Actus Outre-mer : `rss.app/feeds/vaBBXsAOb8cXY80B.xml`

Pour forcer une mise à jour immédiate : [Actions → "Mise à jour météo & actus" → "Run workflow"](../../actions)

---

## 🗂 Structure des fichiers

```
signage-mayotte/
├── 01_lundi_info_sport.html   ← Page principale (ne pas modifier sauf structure)
├── signage.js                 ← Toute la logique JS
├── signage.css                ← Tous les styles
├── programme.json             ← ✏️ ÉDITER CHAQUE MATIN
├── data.json                  ← Généré automatiquement (ne pas modifier)
├── fonts/                     ← Police FranceTVBrown (ne pas modifier)
└── .github/workflows/
    └── update-data.yml        ← GitHub Actions (ne pas modifier)
```

---

## 🖥 Slides et leur expiration automatique

| Slide | Contenu | Expire |
|-------|---------|--------|
| `s0` | Horloge + Agenda | Jamais |
| `s1` | Santé / ARS | Jamais |
| `s2` | Météo | Jamais |
| `s3–s6` | Élections municipales | Défini dans `programme.json` → `stories.elections.data_expires` |
| `s7` | International (Iran) | Défini dans `programme.json` → `stories.iran.data_expires` |
| `s7b` | International (Soudan) | Défini dans `programme.json` → `stories.soudan.data_expires` |
| `s7c` | Outre-mer RSS | Jamais |
| `s-radio` | Radio Mayotte la 1ère | Jamais |
| `s-rdv` | Rendez-vous TV | Jamais |
| `s-colocs` | Colocs Saison 3 | `2026-04-02` |
| `s9` | Bonne semaine | Jamais |

Les slides actus Mayotte (dynamiques) sont injectées automatiquement avant `s3`.
