# Soochana — Complete Documentation

**Soochana** (ସୂଚନା, Odia: "information; the act of making known") is the
Odisha Demographic Intelligence Portal. Tagline: *from numbers to narrative*.
It is a static, multi-page website (plain HTML, CSS and JavaScript, no
framework, no build step, no server), published with GitHub Pages from
`https://github.com/susobhan56/Soochana` (branch `main`).

*Written 2026-10-12, against commit 765840d plus the uncommitted Tectonics
story 5 work.*

## Contents

1. Overview
2. Setup and publishing
3. Pages
4. The home page in depth
5. Shared JavaScript
6. Data
7. Tectonics (story series)
8. Soochana Learn, the Assistant and the Storyteller
9. Tooling, tests and the optional server
10. Maintenance notes

## Quick start

```bash
python -m http.server 8777
```

Open http://localhost:8777/ . Tests: `node --test tests/`.

## Other documentation in the repository

- `README.md` (root) — publishing rule and short notes per feature
- `storyteller/README.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `NARRATION_RULES.md` — the Storyteller in full
- `data/tectonics/README.md` — Google Trends file names and export steps
- `images/editorial/README.md` — the twelve editorial artworks
- `SOOCHANA_PORTAL_DATA.md` — the "Complete Data Book" of every number on the portal



---

## 1. Overview

### What Soochana is

Soochana gathers Odisha's demographic record from official sources, explains
it in plain language, and puts it in the hands of the people who plan schools,
hospitals, jobs and services: policymakers, researchers, students, journalists
and citizens.

- **Vision:** an Odisha where every plan starts from an honest picture of its people.
- **Four ways in:** Dynamic Dashboards · Analytical Stories · Evidence Repository · Policy Communication.
- **Position on population:** it describes change; it does not argue for fewer or more people. It supports voluntary, rights-based choices and rejects coercion.

### Who runs it

| Role | Organisation |
|---|---|
| Analytical lead | **Demographic Intelligence Unit (DIU)** — an initiative of CYSD, set up with technical support from UNFPA Odisha |
| Founding organisation | **Centre for Youth and Social Development (CYSD)**, Bhubaneswar, a non-profit founded in 1982 |
| Technical partner | **United Nations Population Fund (UNFPA)**, Odisha State Office |
| Knowledge partner | **Odisha Development Initiative (ODI)** — linked from every page header |

The team (names, roles, photos, bios) is in the `TEAM_MEMBERS` array inside
`about.html`; photos are in `images/team/`. The full table is reproduced in
`SOOCHANA_PORTAL_DATA.md`, section 1.

### Data sources

- Census of India (1901–2011)
- National Family Health Survey: NFHS-4 (2015-16), NFHS-5 (2019-21), NFHS-6 (2023-24)
- Sample Registration System (SRS), including abridged life tables and the maternal mortality bulletin
- Periodic Labour Force Survey (PLFS)
- UDISE+ (school education)
- ORGI population projections, and DIU's Bayesian population projections (2021–2036)
- Government of Odisha reports, including the Odisha Economic Survey (OES 2025-26)
- LASI (ageing), NSS 64th round (migration), UN WPP 2024 (on `journeys.html`)
- Google Trends (Tectonics pages only)

### Site map

```
index.html ─────────── Home (hero, story, stats, dossier, rankings)
 ├─ explore.html ────── Guided tour in 8 scenes
 ├─ district.html?id= ─ District Insight (one district)
 ├─ district-health.html  NFHS-5 vs NFHS-6, 102 indicators
 ├─ odisha_compare.html  District Duel (two districts)
 ├─ report.html ─────── Printable report of the home page
 ├─ about.html ──────── About, FAQ, partners, team ── contact.html
 ├─ themes.html ─────── 6 themes ── theme_detail.html?theme= ── article.html?id=
 ├─ repository.html ─── Datasets, reports, sources
 ├─ learn/index.html ── Soochana Learn (12 lessons)
 └─ tectonics.html ──── Tectonics, story 1 → marriage → ageing → health → migration

Not linked from anywhere: odisha.html (older home), compare.html (State Duel),
journeys.html (India vs Odisha).
```

Present on almost every page: the **Soochana Assistant** chat button
(`chatbot.js`) and the **What's new** bell (`whatsnew.js`).

### Themes (`data/themes.json`)

| Slug | Name | About |
|---|---|---|
| demography | Demography | Population statistics and trends |
| health | Health | Healthcare indicators |
| education | Education | Educational metrics and learning outcomes |
| ageing | Ageing | Elderly population and support systems |
| migration | Migration & Urbanization | Population movement and urban growth |
| employment | Employment | Workforce participation |

### Technology at a glance

| Concern | Choice |
|---|---|
| Pages | Hand-written HTML, one file per page |
| Charts | D3 v7 (CDN); Flourish embeds for some timelines and dossier modules |
| 3D hero | Three.js r128 (CDN) |
| Fonts | Fontshare (General Sans), Google Fonts (Outfit; Anton, Hind, Merriweather on editorial pages; Public Sans, Literata on `district-health.html`) |
| Data | JSON in `datasets/` and `data/`, GeoJSON for maps, Excel files offered for download |
| State | `localStorage` / `sessionStorage` only (seen updates, Tectonics calls, intro shown) |
| Build | None for the site. Two small Python scripts regenerate derived data files |
| Tests | Node's built-in test runner, no dependencies |
| Hosting | GitHub Pages, served as-is from the repository root |

---

## 2. Setup and publishing

### Requirements

- Python 3 (to serve the site locally and to run the two data build scripts; standard library only)
- Node 18+ (only for the tests and the optional `server/`)
- A modern browser

Nothing needs installing for the site itself. There is no root `package.json`.

### Run locally

The pages fetch JSON, so they must be served over HTTP, not opened as files.

```bash
python -m http.server 8777
```

Open http://localhost:8777/ . `.claude/launch.json` defines the same server as
`soochana` (port 8777) and a second one, `soochana-alt` (port 8778).
`.vscode/settings.json` sets the VS Code Live Server port to 5501, which also
works.

### Version tags (`?v=`) — the one publishing rule

Every page loads its stylesheets and scripts with a version tag, for example
`style.css?v=20261007-2`. **When you change any `.css` or `.js` file, change
its tag on every page that loads it** (one find-and-replace across the `.html`
files) before you push. Use the date; add `-2`, `-3` for a second or third
update the same day. Browsers then fetch the new file instead of mixing it with
an old cached copy.

Each file has its own tag; there is no single site-wide number. `chatbot.js`
passes its own tag on to `chatbot-engine.js`, which it loads at runtime.
`whatsnew.js` adds a daily cache-buster when it injects `data/updates.js`.

Tags at the time of writing (see section 10 for the
inconsistency in `style.css`):

| File | Tag |
|---|---|
| home_pm.css | 20261007-2 |
| style.css | 20261007-2 on index/odisha, 20261006-3 elsewhere |
| ui.js | 20261006-3 |
| chatbot.js | 20261006-2 |
| whatsnew.js, explore.css | 20261006 |
| dossier.css, dossier.js | 20261005-4 |
| story.css, story.js, report.css | 20261005-3 |
| report.js, icons.js | 20261005-2 |
| dotfield3d.js | 20260930-3 |
| hero_data.js | 20260930-1 |
| chart-download.js, chapter-index.js | 20260928-2 |
| explore.js | 20260926-1 |
| data_loader.js, data/key_stats.js, dotfield.js, soochana_live.js, share_card.js | 20260925-2 |
| Tectonics pages (tectonics.css/js, s1–s5) | 20261008-2 |
| learn/learn.css | 20261005 |
| learn/learn.js | 20260929 |

### Publishing

1. Bump the `?v=` tags for every changed `.css`/`.js`.
2. If you changed source data, rebuild the generated files (see section 6): `python tools/build_hero_data.py` and `python learn/tools/build_learn_data.py`.
3. Run `node --test tests/`.
4. Add an entry to `data/updates.js` if readers should see it in "What's new".
5. Commit and push to `main`. GitHub Pages serves the repository root as-is.

GitHub Pages lets browsers reuse a page for up to 10 minutes, so right after a
push a recent visitor may briefly see the old page; Ctrl + F5 loads the new one.

There is no `.github/` workflow, `CNAME`, `.nojekyll`, `_config.yml` or
`404.html` in the repository.

### Branches

Work happens on feature branches that are merged into `main`. Local branches:
`explore-tour-and-home-restyle`, `hero-data-story`, `home-story-and-dossier`,
`soochana-learn`, `tectonics`, `whats-new-and-animated-logo`.

### Adding to "What's new" (`data/updates.js`)

`window.SOOCHANA_UPDATES` is a hand-written array. Each entry:

| Field | Meaning |
|---|---|
| `id` | Permanent id (readers' "seen" state is keyed on it — never reuse or change it) |
| `date` | `YYYY-MM-DD` |
| `type` | `feature`, `report`, `dataset`, `article`, `learn` or `data` |
| `title`, `text` | What readers see |
| `href` | Where it links |
| `action` | Optional; `"chat"` opens the Assistant |

Items show for 30 days, at most 15 at once. New reports, datasets and articles
also appear automatically from the `added` / `lastUpdated` dates in
`data/reports.json`, `data/datasets.json` and `data/contents.json`.

---

## 3. Pages

Every page is a standalone HTML file in the repository root (plus `learn/`).
This file lists each one: what it is for, its sections in order, the URL
parameters it accepts, what it loads and what data it reads.

### Shared chrome

#### Header (12 of the main pages)

- **Left:** the animated logo (`.soo-mark`), "Soochana" and the tagline "from numbers to narrative", linking to `index.html`; next to it the "Part of" ODI logo (`images/logo_odi.png`) linking to https://odishavikashinitiative.org/ in a new tab.
- **Right** (`.btn-elegant`): About Us → `about.html`, Themes → `themes.html`, Repository → `repository.html`, Learn → `learn/index.html`, Tectonics → `tectonics.html`.
- `index.html` adds a **Report** button → `report.html`; `explore.html` adds an **Explore** link.
- `district-health.html` and `report.html` have their own headers.

#### Scripts nearly every page loads

| Script | Adds |
|---|---|
| `ui.js` | Paper grain overlay, editorial bands revealed on scroll, editorial artwork loader, animated logo |
| `whatsnew.js` | "What's new" bell, unread badge, pop-up, "New"/"Updated" ribbons |
| `chatbot.js` | Floating Soochana Assistant |
| `chart-download.js` | "Download PNG" on charts marked `data-download`; "Open in Flourish" on Flourish embeds |
| `data_loader.js` | Cached JSON loader (`DataLoader`) — on pages that read `datasets/` |
| `chapter-index.js` | Right-hand "On this page" rail from `[data-index]` elements — `index.html`, `about.html` |

#### Footers

There is no single shared footer; wording varies by page (see
section 10). Most use `.footer-brand` plus a `.footer-meta`
line listing data sources.

---

### index.html — Home

The landing page: Odisha's demographic story in scroll chapters, the state in
numbers, a 20-module state dossier and district rankings. Details of the hero,
story, dossier and report are in section 4.

**Sections** (chapter labels from `data-index`):
1. `#intro` — welcome overlay, once per session: live population counter over a faded district map; "Start exploring" (→ `explore.html#growth`) or "Go to the home page".
2. Header.
3. `#lander` "Introduction" — canvas dot-field hero behind "Demography is the tectonic plate beneath civilization…"; buttons to `#story`, `#state-stats`, `explore.html`, `district-health.html`, `odisha_compare.html`; a readout of the current scene, year and 60+ share.
4. `#story` — "Odisha, told in 100 people", six chapters.
5. `#state-stats` — "Odisha in numbers", tiles from `data/key_stats.js`.
6. `#thematicGallery` — "Eight frames on a state in transition".
7. `#milestones` — "Welfare milestones": two Flourish timelines in tabs (Health & Family Welfare; Ageing — lazy-loaded from `data-src`).
8. `#dashboard` — "Odisha, module by module": the state dossier, with an index bar and a link to `report.html`.
9. `#rankings` — district leaderboard; cards link to `district.html?id=`.
10. Footer.

**Parameters:** none. Any URL hash (e.g. `#story`) skips the intro.
**CSS:** style.css, home_pm.css, story.css, dossier.css.
**JS:** data_loader.js, data/key_stats.js, hero_data.js, icons.js, dotfield.js (fallback), dotfield3d.js, soochana_live.js, story.js, dossier.js, chapter-index.js, ui.js, whatsnew.js, chatbot.js, chart-download.js.
**Data:** `datasets/` district_population_trends, national_comparisons, state_demographics, district_fertility_trends, state_details; `learn/data/districts.json`; `Orissa.geojson`.
**External:** D3 v7, Three.js r128, Flourish (visualisations 30361488 and 30383327).

### explore.html — Guided tour

Eight full-screen scenes with quizzes and a shareable district card. Driven by
`explore.js`; scenes are addressed by URL hash and work with the Back button.

| Hash | Scene |
|---|---|
| `#start` | Live population counter |
| `#growth` | Map and chart, year slider 1951–2036 with Play |
| `#iceberg` | "What we count is only the tip" — eight things Odisha must plan for |
| `#ageing` | Guess: how many of every 100 will be 60+ by 2036? (pictogram) |
| `#pyramid` | "Odisha is growing older" — pyramid with place and year controls |
| `#fastest` | Quiz: which district grew most, 1951–2036 |
| `#district` | "How is your district changing?" — mini map, rank, age mix 2011/2036; "Share this card" (1200×630 PNG) and "Full district profile" |
| `#more` | Six theme tiles (→ `theme_detail.html?theme=`), links home and to district-health, "Share this tour", "Start again" |

Navigation: arrows, dots, keyboard, swipe; a "1 / 8" counter.
**JS:** explore.js, soochana_live.js, share_card.js + shared. **CSS:** style.css, explore.css.
**Data:** district_population_trends, district_age_pyramids, district_fertility_trends, district_life_expectancy; `Orissa.geojson`.

### district.html — District Insight

A deep-dive profile of one district.

1. Hero: large initial letter, district name, picker for all 30 districts, figures (residents 2021, female life expectancy NFHS-5, fertility NFHS-4).
2. Scrolly with sticky `#chart-viewport`: I. Expansion (population) · II. Fertility (TFR) · III. Longevity (life expectancy) · IV. Health (mortality, NFHS-4 vs NFHS-5).
3. `#district-pptx-dossier` — "District Executive Dossier" cards (Census 2011, UDISE+ 2024-25, NFHS-5, DES).
4. Footer with "Continue Exploring Odisha".

**Parameters:** `?id=<district>`. Default "Bolangir". Alternative spellings are mapped (e.g. balangir, nabarangpore). The picker navigates to `district.html?id=…`.
**Data:** district_population_trends, district_fertility_trends, district_life_expectancy, district_mortality, district_age_pyramids, districts_detail.

### district-health.html — NFHS-5 vs NFHS-6

"Odisha, four years on: faster access, heavier bodies." A self-contained
analysis of 102 indicators for Odisha and its 30 districts, NFHS-5 (2019-21)
against NFHS-6 (2023-24).

It does not use the shared header, `style.css` or `ui.js`; styles are inline
with an SVG icon sprite. All data is inline in the page (`const DATA = {…}`).
A sticky top nav links back to `index.html` and to each section:

hero (tally and "Every indicator, one dot" beeswarm) · `#simple` the story in
pictures, report card by topic · `#h2hsec` compare two places · `#findings`
plain-words findings · `#state` how each state indicator moved · `#themes`
progress by theme · `#gap` urban–rural gap · `#regions` region comparison ·
`#gender` women vs men · `#explore` district explorer (replay 2019 → 2024,
level/trend quadrant, then-vs-now scatter) · `#rel` what moves together ·
`#score` · `#profile` district profile · `#heat` heatmap · `#xtheme` districts
by theme · `#data` all indicators (search, filter, sortable table).

**JS:** chatbot.js, chart-download.js only. **External:** D3 7.9.0 (cdnjs), Google Fonts (Public Sans, Literata). Animations respect reduced-motion.

### odisha_compare.html — District Duel

Compare two districts side by side.
1. District A vs District B dropdowns.
2. Mirrored bars: population 2021, TFR 2021, female life expectancy (NFHS-5), sex ratio 2021, IMR (NFHS-5), MMR 2017–19.
3. "Dual Cohort Pyramid Duel": year buttons 2011/2021/2026/2031/2036, two pyramids.

**Data:** district_population_trends, district_fertility_trends, district_life_expectancy, district_mortality, district_age_pyramids.

### report.html — Printable report

One document of the whole home page: at a glance, the six-chapter story (with
two charts), all 20 dossier modules, a table of the 30 districts, and sources.
Built entirely by `report.js` from the data files.

- On-screen bar: "Save as PDF / Print", "Download district table (CSV)", "Back to the home page". No shared header, footer, Assistant or What's new.
- **Parameter:** `?print` opens the print dialog on load.
- **JS:** data_loader.js, data/key_stats.js, story.js and dossier.js (for their figures), report.js. **CSS:** report.css (screen + A4 print).
- Linked from the home header ("Report"), the story's last card and the dossier heading.

### themes.html — Themes

The six themes from `data/themes.json` as cards (icon or artwork, name,
description, "Explore indicators") linking to `theme_detail.html?theme=<slug>`.
Images: editorial artwork, falling back to `icons/*.gif`, then
`images/dem1.png`. Themes with recent articles get an "N new" ribbon.

### theme_detail.html — One theme

**Parameter:** `?theme=<slug>` (required; missing or unknown → redirects to `themes.html`).
Hero with name, description and artwork; a grid of that theme's articles from
`data/contents.json` (thumbnail, type badge, abstract, last updated, "new"
ribbon) linking to `article.html?id=`.

### article.html — Article reader

**Parameter:** `?id=<article id>` (required; missing → `themes.html`; unknown → "Brief Not Found").
Back link to the theme, kicker, title, abstract, date, then the article HTML
from `data/contents.json` (fetched with `cache:'no-cache'`). `markNumbers()`
finds figures in the text and animates them as they scroll into view.

### repository.html — Data Repository

Three tabs:
- **Datasets** — search and format filter over `data/datasets.json` (the Excel files in `excel/`).
- **Reports** — search and theme filter over `data/reports.json` (101 reports, mostly Google Drive links).
- **Sources of Data** — a hard-coded table of sources.

View and download buttons; Google Drive links are turned into direct downloads
by `DataLoader.toDirectDownloadUrl` / `triggerDirectDownload`.

### about.html — About

Chapters: "The word" (ସୂଚନା, pronunciation, meaning) · "What we do" (vision,
mission) · "What we offer" · "Questions" (FAQ, `<details>`) · call to action ·
"Partners" (DIU, CYSD, UNFPA, ODI) · "The team" (timed spotlight carousel with
skip/replay, then "Everyone at once" grid; data in the inline `TEAM_MEMBERS`
array, photos in `images/team/`) · "Keep exploring" (Contact us, themes, data).

### contact.html — Contact

Feedback form (name, email, subject, message). **The form does not send
anything**: `handleFormSubmit` only hides the form and shows a success message.
Linked only from `about.html`.

### tectonics*.html — Tectonics

Five story pages. See section 7.

### learn/*.html — Soochana Learn

Hub plus twelve lessons. See section 8.

---

### Pages not linked from anywhere

These still work if opened directly, but no page links to them.

#### odisha.html — older home page

Hero dot field; a scrolly D3 district map in four steps (30 districts, one
state / where the millions live / education and the capital belt / the southern
frontier); benchmark strip; two Flourish policy timelines; an 11-tab "Strategic
Demographic Dashboard" (overview, admin, demographics, growth 1901–2036,
pyramids, age cohorts, sex ratio, SRB, TFR, tribal scale, 62 tribes and PVTGs);
district rankings. Map districts open `district.html?id=<Dist_Name>`.

#### compare.html — State Duel

Two Indian states head to head (projected population 2021, density, decadal
growth 2011–21, ST share 2011, sex ratio and more) from
`datasets/national_comparisons.json`.

#### journeys.html — Parallel journeys

"A Nation & A State": India vs Odisha in scroll steps (scale, transition below
replacement, regional disparity, labour force), India and Odisha pyramids
2011–2036, and a zoomable India map. Reads state_demographics,
national_comparisons and `india.geojson`.

---

## 4. The home page in depth

`index.html` is built from five parts, each with its own files.

| Part | Files |
|---|---|
| Welcome overlay and live counter | `soochana_live.js` |
| Hero dot field | `dotfield3d.js` (Three.js), `dotfield.js` (2D fallback), `hero_data.js` (generated) |
| Story "Odisha, told in 100 people" | `story.js`, `story.css`, copy in `index.html` `#story` |
| Odisha in numbers | `data/key_stats.js` (hand-edited) |
| State dossier "Odisha, module by module" | `dossier.js`, `dossier.css`, `icons.js` |
| Printable report | `report.html`, `report.js`, `report.css` |

### Welcome overlay (`#intro`)

Shown once per browser session (skipped if the URL has a hash). It shows a
live estimate of Odisha's population, interpolated between projection years by
`soochana_live.js` from `datasets/district_population_trends.json`, over a
faded district map (`Orissa.geojson`). `soochana_live.js` is shared with the
explore tour and maps GeoJSON spellings to dataset spellings
(Balangir → Bolangir, Nabarangapur → Nabarangpur).

### Hero dot field (`#lander`)

One field of dots behind the headline moves through scenes. `dotfield3d.js`
exposes `window.dotfield3d(canvas, opts)`; its scene ids are listed in
`dotfield3d.SCENES` and include the district map ("Every District Is Ageing"),
growth ("Odisha Grows 4-Fold"), ageing, cohort, waffle ("Out of Every 100
People"), fertility and pyramid. A scene whose data is missing is skipped.
`dotfield.js` is the older 2D halftone pyramid (one dot ≈ 123,000 people) and
is kept as a fallback. A readout box shows each scene's title, year and the 60+
share.

The hero's data comes from `hero_data.js` (`window.SOOCHANA_HERO`), which is
**generated** — rebuild it with `python tools/build_hero_data.py` after
changing `state_demographics.json`, `district_age_pyramids.json`,
`district_fertility_trends.json` or `Orissa.geojson`.

### Story — "Odisha, told in 100 people" (`#story`)

One sticky picture of 100 dots; cards scroll over it and each card re-forms
the same dots. Cards on the left on wide screens; on phones the picture sits on
top and cards come up from the bottom.

| Chapter (`data-ch`) | Cards (`data-step`) | Picture |
|---|---|---|
| who — "100 people" | people, rural, tribal | Waffle of 100 people |
| growth — "125 years of growth" | line1, line2, line3, growth | Population line 1901–2036, growth-rate bars |
| fert — "Fewer children" | tfrA, tfrB | 30 districts by fertility |
| age — "Young and old" | ageA, ageB | Age split, 2021 and 2036 |
| where — "Thirty Odishas" | mapST, mapLit, mapOld | District maps (tribal share, literacy, older people) |
| asks — "What it asks" | close | Closing card, link to the report |

- **Copy** lives in `index.html`. A number inside `<b data-f="key">` is filled from the data on load — change the data, not the number.
- Each card's `data-step` names its scene in `SCENES` in `story.js`; `CHAPTERS` in `story.js` picks each chapter's icon from `icons.js`.
- `story.js` exposes `window.SoochanaStoryFigures.compute` (and `module.exports` for Node) so the report and tests reuse the same figures.
- **Data:** state_demographics, `learn/data/districts.json`, district_population_trends, district_fertility_trends, national_comparisons, state_details, `Orissa.geojson`, `SOOCHANA_KEY_STATS`.
- **Look:** rough off-white paper (the site's grain and wash textures), charts in ink, each chapter's cards in their own muted colour (`data-ch` in `index.html`; colours under "one card colour and one accent per chapter" in `story.css`).
- **Fertility caveat:** the chapter uses the district projection years (2020 → 2036), not the file's NFHS-4 column, which looks wrong (it lists Cuttack highest at 2.84 and 22 of 30 districts above 2.1 against a state rate of about 2.05). Check it against the NFHS-4 district factsheets before using it.
- **Tests:** `tests/story.test.js` checks the figures against the real files and that every `data-f` slot gets one.

### Odisha in numbers (`#state-stats`)

Tiles from `window.SOOCHANA_KEY_STATS` in `data/key_stats.js`, which is edited
by hand: `{groups:[{title, tiles:[{value, label, note, source, color} | {parts:[…]}]}]}`.
Groups: People, Vital rates, Economy & administration. Each tile names its
source (Census, NFHS-5, SRS 2024, OES 2025-26, Government of Odisha).

### Welfare milestones (`#milestones`)

Two Flourish timelines in tabs (Health & Family Welfare; Ageing). The second
iframe loads only when its tab is opened (`data-src`).

### State dossier — "Odisha, module by module" (`#dashboard`)

The 20 modules of `datasets/state_details.json` read as a scroll story. Cards
scroll on the left; a sticky white panel on the right shows each module's
picture as its card reaches the middle of the screen. The index bar above
("Analytics index") shows the chapter and module, fills as you read, and has a
"Jump to a module" menu.

| Chapter | Modules |
|---|---|
| Land | 1, 2 |
| Governance | 3, 4 |
| People | 5–10 |
| Tribal heritage | 11 |
| Health | 12–15 |
| Education | 16–18 |
| Infrastructure | 19, 20 |

- A module with a `chart_url` shows its Flourish chart, loaded when you reach it or its neighbour. Others get a picture drawn from their own figures (`PICTURES` in `dossier.js`): map, land-use waffle, scale circles, the assembly, the 62 communities, a pyramid of care, bar rows.
- Card text: the module's own narrative if it has one, otherwise the lead in `LEADS`.
- To regroup modules edit `CHAPTERS`; a module not listed appears in a final "More" chapter. `MODULE_ICONS` picks each module's icon.
- Exposes `window.SoochanaDossier` / `module.exports` = `{splitText, popFacts, landCats, LEADS, CHAPTERS, num}`.
- Look: same paper as the story; chapter colours under "one ground and one accent per chapter" and the paper under "THE PAPER LOOK" in `dossier.css`.
- Tests: `tests/dossier.test.js`.

### District rankings (`#rankings`)

A leaderboard of district cards, each linking to `district.html?id=<district>`.

### Printable report (`report.html`)

One document of the whole home page: at a glance, the six-chapter story (with
two charts), all 20 dossier modules, a 30-district table and the sources.
`report.js` builds it from the same data files and reuses
`SoochanaStoryFigures` and `SoochanaDossier`, so nothing is typed in by hand.
"Save as PDF / Print" prints it (choose "Save as PDF" as the printer); the
district table also downloads as CSV. `report.html?print` opens the print
dialog on load. `report.css` holds the screen and A4 print styles.

---

## 5. Shared JavaScript

All scripts are plain `<script>` files that attach to a global (no modules, no
bundler). Several also set `module.exports` so the Node tests can load them.

### Page chrome

| File | Purpose | Globals | Used by |
|---|---|---|---|
| `ui.js` | Paper grain overlay, editorial bands revealed on scroll, editorial artwork loader, animated logo. Clears the old `soochana-text` localStorage key | `window.SoochanaArt = {dir, load}` | All main pages, all `learn/` pages |
| `whatsnew.js` | "What's new" bell: unread badge, feed, one pop-up per visit, dots on header links, "New"/"Updated" ribbons on cards. 30-day window, max 15 items. Seen state in localStorage (`soochana-seen-updates`, `soochana-news-toast`) | `SoochanaNews = {ready, ribbon, isRecent}` | Same set as `ui.js` |
| `chapter-index.js` | "On this page" rail built from `[data-index]` elements; a pill on mobile; styled by `--ci-*` variables | none (IIFE) | index, about |
| `chart-download.js` | "Download PNG" for SVG charts marked `data-download` (styles inlined, fonts embedded, 2× with title and source line); "Open in Flourish" for Flourish iframes | `SoochanaDownload = {scan, render, renderFlourish}` | article, district-health, district, explore, index, journeys, odisha, odisha_compare |
| `icons.js` | 24×24 line icons shared by the story and dossier | `SoochanaIcons.svg(name, cls)` | index |

#### Editorial artwork (`SoochanaArt`)

`ui.js` resolves a base name against `images/editorial/` and tries `.png`,
`.jpg`, `.jpeg`, `.webp`, `.gif` in turn. To swap an artwork, drop in a file
with the same base name. If it is missing, theme cards fall back to the GIFs in
`icons/`. The twelve slots are listed in `images/editorial/README.md`.

### Data access

| File | Purpose | Globals |
|---|---|---|
| `data_loader.js` | Fetches and caches JSON (via `d3.json`). One getter per `datasets/*.json` file. Also turns Google Drive links into direct downloads | `DataLoader` — `loadJSON(url)`, `getDistrictPopulationTrends`, `getDistrictFertilityTrends`, `getDistrictLifeExpectancy`, `getDistrictMortality`, `getDistrictAgePyramids`, `getNationalComparisons`, `getStateDemographics`, `getDistrictDetails`, `getStateDetails`, `toDirectDownloadUrl`, `triggerDirectDownload` |
| `soochana_live.js` | Live population estimate and district map for the welcome screen and the tour; maps GeoJSON spellings to dataset spellings | `window.SoochanaLive` — `load()`, `data`, `geo`, `years`, `YEAR_MS`, `reduce`, helpers |
| `hero_data.js` | **Generated** by `tools/build_hero_data.py`. Do not edit | `window.SOOCHANA_HERO = {pyr, growth, districtYears, districts, dots, fertYears, fertFirstLabel, fert}` |
| `data/key_stats.js` | Hand-edited home tiles | `window.SOOCHANA_KEY_STATS` |
| `data/updates.js` | Hand-written "What's new" feed; injected by `whatsnew.js` | `window.SOOCHANA_UPDATES` |

### Feature scripts

| File | Feature | Globals | Notes |
|---|---|---|---|
| `dotfield3d.js` | Home hero dot field (Three.js) | `window.dotfield3d(canvas, opts)`, `dotfield3d.SCENES` | Reads `SOOCHANA_HERO`; built-in state pyramid fallback |
| `dotfield.js` | Older 2D halftone pyramid hero | `window.dotfield(canvas, opts)` | Fallback on index |
| `story.js` | Home story "Odisha, told in 100 people" | `SoochanaStoryFigures = {compute}`; Node: `{compute, to100}` | See section 4 |
| `dossier.js` | Home state dossier | `SoochanaDossier` | See section 4 |
| `report.js` | `report.html` | none (IIFE) | Needs d3, DataLoader, SoochanaStoryFigures, SoochanaDossier |
| `explore.js` | Guided tour, 8 hash-routed scenes | none (IIFE) | Needs SoochanaLive, SoochanaShare. Ageing shares hard-coded (60+ is 11.0% in 2021, 15.9% in 2036) |
| `share_card.js` | 1200×630 PNG share cards on canvas; Web Share where available, otherwise download | `SoochanaShare = {make(spec) → Promise<Blob>, send(blob, filename, text)}` | explore |
| `chatbot.js` | Soochana Assistant window | `window.SoochanaAssistant` | See section 8 |
| `chatbot-engine.js` | Assistant question answering | `SoochanaChat` / `module.exports = {createEngine, words, stems, clean, indian}` | Loaded by chatbot.js on first open |
| `tectonics.js`, `tectonics-s1…s5.js` | Tectonics engine and story configs | `window.TK_STORY` | See section 7 |
| `learn/learn.js` | Learn models, metrics, seeded splits, scroll engine | `SL` (e.g. `SL.loadData`) | See section 8 |

### Not loaded by any page

| File | What it was |
|---|---|
| `script.js` | Early D3 India → Odisha drill-down map with placeholder figures |
| `national_data.js` | Hard-coded figures for 11 states (`indiaStatesData`) |
| `odisha_data.js` | Hard-coded district figures, 1991–2021 (`odishaDistrictsData`) |
| `storyteller/**` | The Storyteller — switched off; only `tests/` and `server/` load it |

---

## 6. Data

All data is static files in the repository. Pages fetch JSON at runtime; a few
derived files are generated by Python scripts.

Every number on the portal, laid out as tables, is in `SOOCHANA_PORTAL_DATA.md`
(the "Complete Data Book"). This file describes the files themselves.

### Folders

| Folder | Contents |
|---|---|
| `datasets/` | The main JSON data (district and state) read by the pages, plus source Excel files that no code reads |
| `data/` | Portal content: articles, reports, datasets catalogue, themes, home tiles, "What's new" |
| `data/tectonics/` | Google Trends CSVs for the Tectonics pages (none added yet) |
| `excel/` | Excel files offered for download in the Repository |
| `learn/data/` | `districts.json`, the generated 30-district modelling table |
| root | `Orissa.geojson` (district boundaries, name field `Dist_Name`), `india.geojson` (state boundaries) |

### `datasets/*.json`

District files are keyed by the 30 district names. **Spellings differ between
files** (e.g. Jajapur/Jajpur, Bolangir/Balangir, Nabarangpur/Nabarangapur,
Debagarh/Deogarh). Pages and scripts carry their own alias maps.

| File | Shape | Content | Read by |
|---|---|---|---|
| `district_population_trends.json` | `{District: {year: {male, female, total}}}` — 12 years, 1951–2036 incl. 2016 and projections | District population, census + projections | DataLoader (district, index, odisha, odisha_compare), soochana_live, explore, story, report, chatbot, learn, build_learn_data.py, storyteller |
| `district_fertility_trends.json` | `{District: {"2020".."2036": TFR, "2015-16 (NFHS-4)": TFR}}` | District TFR, Bayesian projection + NFHS-4 (see the NFHS-4 caveat in section 4) | DataLoader, explore, story, dossier, report, chatbot, learn, both build scripts |
| `district_age_pyramids.json` (305 KB) | `{District: {2011, 2021, 2026, 2031, 2036: [17 × {age, male, female, total}]}}` | District age–sex structure | DataLoader (district, odisha_compare), explore, learn/age-structure, build scripts; Tectonics story 3 values were taken from it |
| `district_life_expectancy.json` | `{District: {male: {nfhs4, nfhs5}, female: {…}}}` | Life expectancy by sex | DataLoader, explore, learn/life-expectancy, build_learn_data.py |
| `district_mortality.json` | `{District: {maternal_mortality_ratio_2017_19, neonatal_mortality_rate, infant_mortality_rate, under_five_mortality_rate}}` | Mortality | DataLoader (district, odisha_compare), learn/rates-and-ratios, build_learn_data.py |
| `districts_detail.json` (591 KB) | `{District: {name, tagline, flags, slides_detail, basic_stats, admin_stats, charts, uniques_raw, *_narrative, *_stats}}` for demography, tribal, health, education, geography, infra | Full district profiles | district.html (`getDistrictDetails`), build_learn_data.py |
| `state_details.json` | `{Odisha: {same 19 keys}}` | The 20 state dossier modules | dossier, story, report, index, tests |
| `state_demographics.json` | `{population_trends: [43 × {year, male, female, total, sex_ratio, annual_growth_rate}] 1901–2036, pyramids: {1991, 2011, 2021, 2026, 2031, 2036: [rows]}}` | State population series and pyramids | DataLoader (index, odisha, journeys), story, dossier, report, dotfield/dotfield3d, learn, build_hero_data.py, tests |
| `national_comparisons.json` | Array of 10 `{indicator, year, india, odisha, <14 other states>, source}` | Odisha vs India and peer states: population, growth, density, ST share, sex ratio, SRB, LFPR, FLFPR | DataLoader (compare, index, journeys, odisha), story, report, chatbot, tests |

**Caveat — `state_demographics.json` pyramids:** each year has 17 real age
bands (0-4 … 80+) followed by about 20 junk rows from a spreadsheet export
("Cumulative Frequency" and cumulative sums). Read only the first 17 rows or
whitelist the bands. `build_hero_data.py` takes `rows[:17]` and asserts on the
first and last band.

### `data/`

| File | Shape | Content | Read by |
|---|---|---|---|
| `contents.json` (130 KB) | `{recentContent: [38 × {id, title, theme, abstract, thumbnail, type, lastUpdated, images[], graphs[], article}]}` — `article` is an HTML string | Theme articles and briefs | theme_detail, article, chatbot, whatsnew, tests |
| `reports.json` (47 KB) | `{reports: [101 × {id, name, theme, description, thumbnail, file, lastUpdated}]}` — `file` mostly Google Drive links | Report library | repository, chatbot, whatsnew, tests |
| `datasets.json` | `{datasets: [8 × {id, name, description, type, size, lastUpdated, file}]}` — `file` points to `excel/*.xlsx` | Downloadable datasets | repository, chatbot, whatsnew, tests |
| `themes.json` | `{themes: [6 × {id, name, slug, icon, description}]}` | The six themes | themes, theme_detail |
| `key_stats.js` | `window.SOOCHANA_KEY_STATS` | Home "Odisha in numbers" tiles (hand-edited) | index, report, tests |
| `updates.js` | `window.SOOCHANA_UPDATES` | "What's new" feed (hand-written; see section 2) | whatsnew.js |
| `factsheets.json` | empty | — | nothing |
| `factsheets.ts`, `portalContent.ts` | TypeScript from an earlier React version (`portalContent.ts` is empty) | — | nothing |

#### Adding content

- **Article:** add a record to `contents.json` `recentContent` with a theme slug from `themes.json`. It appears on `theme_detail.html?theme=<slug>` and at `article.html?id=<id>`, and in "What's new" via `lastUpdated`.
- **Report:** add a record to `reports.json`. Drive links download directly.
- **Dataset:** put the file in `excel/` and add a record to `datasets.json`.

### `learn/data/districts.json` — generated

One row per district with about 40 indicators, used by Soochana Learn, the
home story, the report and the Assistant.

```
{ meta: { title, n: 30, features, state_nfhs5, groups, built_from },
  districts: [ { name, division, kbk, coastal, f: {…}, nfhs4: {…}, nfhs5: {…} } × 30 ] }
```

Features: literacy, female_lit, male_lit, density, urban_pct, tribal_pct,
sex_ratio, growth_01_11, elderly_pct, child_pct, elderly_pct_2036, tfr_2020,
beds_per_100k, mmr, forest_pct, sown_pct, rainfall_mm, bank_per_100k,
sec_dropout, mid_dropout, sec_ptr, smart_class_pct, computer_pct, imr, nmr,
u5mr, stunted, wasted, underweight, anaemic_child, tfr, le_female, le_male,
srb, insurance, women_lit, child_marriage, fp_any, unmet_need, anc4,
inst_births, full_vax, adequate_diet.

Groups: `division` (Revenue Divisional Commissioner division), `kbk`
(Koraput–Bolangir–Kalahandi region, 8 districts), `coastal`.

Rebuild after any source change:

```bash
python learn/tools/build_learn_data.py
```

It reads districts_detail, district_mortality, district_life_expectancy,
district_fertility_trends, district_population_trends, district_age_pyramids,
`excel/Health.xlsx` and `excel/Migration and Urbanization.xlsx`; renames
Jajapur to Jajpur; and prints any value it could not find.

### `hero_data.js` — generated

```bash
python tools/build_hero_data.py
```

Reads state_demographics, district_age_pyramids, district_fertility_trends and
`Orissa.geojson`; writes `hero_data.js`.

### Data embedded in pages (not in data files)

| Where | What |
|---|---|
| `district-health.html` | All 102 NFHS-5/NFHS-6 indicators for the state and 30 districts (`const DATA`) |
| `odisha.html` | `odishaSlideData` (state slides) |
| `about.html` | `TEAM_MEMBERS` |
| `tectonics-s1…s5.js` | Every official figure in the Tectonics stories |
| `explore.js` | Ageing shares for the guessing game |

### Excel files

**`excel/`** (all eight are downloads listed in `data/datasets.json`):
District Level Education Data 2023-24 UDISE+, District-wise Population Figures
1901-2036, Education Data DistrciWise, Elderly_pop & M&CH_Odisha_need_literature
review, Employment, Health, Migration and Urbanization, Population Ageing.
Only `Health.xlsx` and `Migration and Urbanization.xlsx` are also read by code
(`build_learn_data.py`).

**`datasets/`**: Age_wise_Odisha_population_1951-2036, Dist level population-
1951-2036, District wise Age distribution-2011.2031,2036, Gajanan, Odisha_Demography,
Population Projection for States and Unionteries_2021-51, Regional Demographic
Framework Data, and `importantdatasets.zip`. **No code reads these.** They
appear to be the sources of the JSON files, but there is no conversion script
in the repository — the JSON was produced outside it.

---

## 7. Tectonics (story series)

Tectonics is a season of one-scene-per-screen story pages that set Odisha's
official record against what people search for online.

### The idea

Two "plates":

- **The record** (blue, `--tk-record`, `#5fb6ec`): official data — Census, NFHS, SRS.
- **The signals** (amber, `--tk-signal`, `#f4a63a`): what people search for, from Google Trends.

Where the plates meet is "new land": new questions. Every story moves through
six chapters (`CHAPTERS` in `tectonics.js`):

| # | Chapter | What the reader does |
|---|---|---|
| 0 | Start | Cover with the plates drawing |
| 1 | The plate | Guess the official numbers first, then see them (100-dot islands, slope charts, maps, scatter, pyramid) |
| 2 | The tremor | Search traces from Google Trends |
| 3 | The collision | Predict which way searches move against the survey |
| 4 | The new land | Three open questions, each with "Holds if / Falls if" tests |
| 5 | The aftershock | What else shakes, "This story still needs", and "How sure is each number?" |

Every number carries a reliability badge: `tk-badge--official`, `--admin`,
`--signal`, `--voice`, `--model` (projection).

#### Collision outcomes (`QUADS`, `collisionOf(survey, signal)`)

| Outcome | Meaning |
|---|---|
| Confirmed shift | Survey and searches move the same way |
| Early tremor | Searches move, the survey does not |
| Hidden change | The survey moves, searches stay quiet |
| Fault line | They move in opposite directions |

When `survey === 0` (the survey does not measure the thing), any move in
searches is a tremor and no move is no collision.

### The five stories (`SEASON` in `tectonics.js`)

| # | Title | Page | Config |
|---|---|---|---|
| 1 | Online, but unprotected? | `tectonics.html` (also the landing page) | `tectonics-s1.js` |
| 2 | When does youth want to marry? | `tectonics-marriage.html` | `tectonics-s2.js` |
| 3 | The ageing aftershock | `tectonics-ageing.html` | `tectonics-s3.js` |
| 4 | Covered, but connected? | `tectonics-health.html` | `tectonics-s4.js` |
| 5 | Leaving home | `tectonics-migration.html` | `tectonics-s5.js` |

#### Scenes per story

**Story 1 — Online, but unprotected? (8 scenes)**
cover · `#online` women ever online, 24.9 → 51.8 (guess) · `#methods` modern
contraception, 48.8 → 40.8 (guess) · `#apart` slope of five NFHS rows plus a
towns/villages "Beneath the average" table · `#tremor` · `#collision` (modern
use, unmet spacing need) · `#newland` · `#aftershock`.

**Story 2 — When does youth want to marry? (10 scenes)**
cover · `#brides` married before 18, 20.5 → 18.6 (concern tone) · `#grooms` men
married before 21, 13.3 → 12.5 · `#districts` map, guess the highest district,
views "2023–24" and "How far each moved" · `#school` scatter of schooling vs
marriage before 18 (guess strong / weak / none; shows Pearson r and Spearman ρ;
views "change" and "now") · `#apart` slope · tremor · collision (early marriage;
marrying by choice, survey 0) · newland · aftershock.

**Story 3 — The ageing aftershock (9 scenes)**
cover · `#elders` share aged 60+, 13.4 → 15.6 · `#pillar` animated age pyramid
1991, 2011, 2021–2036 with play button and "When will 60+ outnumber children
under 10?" (answer 2036) · `#apart` index slope, 2011 = 100 (80+ → 230,
60–79 → 203, 15–59 → 127, 0–14 → 88) · `#districts` share aged 60+, 2011 vs
projected 2036 · tremor · collision · newland · aftershock.

**Story 4 — Covered, but connected? (9 scenes)**
cover · `#cover-share` households with health cover, 47.9 → 82.7 · `#sugar` men
with high blood sugar, 17.0 → 26.6 (concern) · `#apart` "Where the care goes"
slope · `#districts` map, `rank:'low'` (find the least-covered district), views
now / change / women's blood sugar · tremor · collision · newland · aftershock.

**Story 5 — Leaving home (9 scenes)**
cover · `#returning` share of in-migrants who are Odias coming home,
24.3 → 66.5 · `#uncounted` "How many households had someone away for the
season?" (about 1 in 3), revealing 15.3 lakh found by a field survey against
4.8 lakh in the official count · `#apart` "From outflow to inflow", NSS 2007-08
to PLFS 2020-21 · `#districts` urbanisation map, Census 2011, `single:true`,
`rank:'low'`, extra layer urban-minus-rural growth · tremor · collision ·
newland · aftershock.

### How the code is split

Each page loads its own `tectonics-sN.js` **before** `tectonics.js` (both
`defer`; order matters). Pages with a map also load d3 v7 from a CDN.

#### `tectonics-sN.js` — configuration only

Sets `window.TK_STORY = { … }`:

| Key | Shape / purpose |
|---|---|
| `number` | Highlights the current story in the season list |
| `guesses` | `{name: {island, key, input, was, now, keyRevealed, tone?:'concern'}}`, matched to `data-guess="name"` |
| `slope` | `{max, rows:[{name, short, was, now, color}], axis?, decimals?, sameStart?}` |
| `map` | `{svg, select, readout, key, geo:'Orissa.geojson', nameField:'Dist_Name', values:{district:[a,b]}, bins:[[upper,color,label]], bigMove, arrowScale?, rank?:'low', periods?, single?, layers?:{view:{label, values, bins, unit?, signed?}}, pickHint, hoverHint}` |
| `scatter` | `{x, y:{short, values}, views:{change, now:{x:[lo,hi,step], y, xLabel, yLabel, bins?, labels[]}}, says:{strong, weak, none}}` |
| `pyramid` | `{years, projectedFrom, start, groups, highlightFrom, male, female:{year:[lakh…]}}` |
| `signals` | `[{name, terms, file}]` — the Google Trends CSVs |
| `callsKey` | localStorage key; the reader's calls are saved per device |
| `calls` | `[{id, name, survey:-1/0/1, surveyText, q, says:{'1','0','-1'}}]` |

#### `tectonics.js` — the shared engine (one IIFE, ~1,120 lines)

| Function | Draws / does |
|---|---|
| `drawPlates()` | Cover SVG |
| `buildIsland`, `setupGuess`, `paintGuess`, `paintReveal`, `verdict` | 100-dot guess islands |
| `drawSlope()`, `dodge()` | Slope charts with non-overlapping labels |
| `parseTrends`, `drawTrace`, `setupSeismo` | Search traces |
| `setupCollision()`, `collisionOf()` | The reader's calls and the four outcomes |
| `setupMap(cfg)` | d3 Mercator map: guess, reveal, change arrows, top-3 labels, layers |
| `setupScatter(cfg)` | Scatter with `pearson`, `ranks`, least-squares line |
| `setupPyramid(cfg)`, `setPyramidYear` | Animated pyramid |
| `setupChoices()` | `.tk-choice` multiple-choice blocks (`data-choice-show` / `data-choice-hide`) |
| `buildSeason()` | Season list |
| `buildRail()`, `go(i)` | Navigation: arrows, ←/→ and PgUp/PgDn, `[data-go]` links, URL hash via `history.replaceState` |
| `announce()`, `nudgeNext()` | aria-live announcements; hidden scenes get `inert` |

A component is drawn only if its config and its DOM ids are present. Fixed ids
the engine looks for: `tkSlope`, `tkSeismo`, `tkSeismoStatus`, `tkQuads`,
`tkPredict`, `tkMap`, `mapPick`, `mapReadout`, `mapKey`.

#### `tectonics.css`

Design tokens `--tk-record`, `--tk-signal`, `--tk-land`, `--tk-concern`,
`--tk-worse`; fonts Anton, Merriweather, Hind.

### Google Trends data (`data/tectonics/`)

Expected files (four per story) and export steps are in
`data/tectonics/README.md`: `s1-emergency-pills.csv`, `s1-pregnancy-worries.csv`,
`s1-side-effects.csv`, `s1-delaying.csv`, `s2-matrimony.csv`,
`s2-love-court.csv`, `s2-legal-age.csv`, `s2-wedding-costs.csv`,
`s3-care-at-home.csv`, `s3-old-age-homes.csv`, `s3-pensions.csv`,
`s3-ailments.csv`, `s4-health-card.csv`, `s4-private-hospitals.csv`,
`s4-diabetes.csv`, `s4-caesarean.csv`, `s5-jobs-away.csv`, `s5-dadan.csv`,
`s5-trains.csv`, `s5-jobs-home.csv`.

Export: trends.google.com/trends/explore, up to five terms for one group in one
export, region India › Odisha, custom range 1 Jan 2019 to today, All
categories, Web Search; download "Interest over time" (`multiTimeline.csv`) and
rename it.

**`parseTrends`:**
1. Strips `\r`; finds the header row (the first line with a comma, not itself a date, whose next line starts with `YYYY-MM` or `YYYY-MM-DD`), which skips Google's "Category:" preamble.
2. For each date row, adds up all term columns. `<1` counts as 0.5; anything unparseable as 0.
3. Monthly dates get `-01` appended.
4. Rescales so the busiest point is 100. No rows or a max of 0 → `null`.

`drawTrace` plots 2019-01-01 to today on a 640×92 SVG with shaded NFHS-5
(2019–21) and NFHS-6 (2023–24) bands (`SURVEY_BANDS`). Files are fetched with
`cache:'no-cache'`. A missing or unparseable file draws "No reading yet"; the
status line says "N of M traces are in".

**Status:** no CSVs have been added yet, so every trace shows the empty state.

### Other data per story

All official values are hard-coded in the `tectonics-sN.js` files; only
`Orissa.geojson` (field `Dist_Name`) and the Trends CSVs are fetched.

| Story | Sources |
|---|---|
| 1 | NFHS-5 → NFHS-6 Odisha state values (same as `district-health.html`) |
| 2 | NFHS-5/6 district tables: `MARRIED_BEFORE_18`, `SCHOOLING` (women with 10+ years of school) for 30 districts |
| 3 | NFHS-5/6 share 60+; pyramid from Census 1991/2011 and projections 2021–2036 (`datasets/Age_wise_Odisha_population_1951-2036.xlsx`, lakh); district 60+ share 2011 vs DIU Bayesian 2036 (`datasets/district_age_pyramids.json`) |
| 4 | NFHS-5/6 state and district health cover; NFHS-6 women's blood sugar layer |
| 5 | `excel/Migration and Urbanization.xlsx`; Census 1991–2011, NSS 64th round (2007-08), PLFS 2020-21, CMLS–Aajeevika Bureau 2014 field survey; Census 2011 % urban and 2001–11 urban-minus-rural growth |

District names follow `Orissa.geojson` spellings (Angul, Debagarh,
Nabarangapur, Subarnapur).

### Adding a story

1. Copy an existing story page; keep the scene ids and data attributes (`data-guess`, `data-reveal-for`, `data-map-*`, `data-scatter-*`, `data-choice*`) and the fixed ids above. Point its script tag at the new `tectonics-sN.js`.
2. Create `tectonics-sN.js` setting `window.TK_STORY` with `number`, the components you need, and a unique `callsKey`.
3. Add `{title, href}` to `SEASON` in `tectonics.js` (an entry without `href` shows as "coming").
4. Add the CSV names to `data/tectonics/README.md`.
5. Point the previous story's last "Next" link at the new page.
6. Add an entry to `data/updates.js` ("What's new").
7. Bump the `?v=` tag on every Tectonics page.
8. For a new chart type, add `setupX(cfg)` to the engine and call it from the start block at the end of `tectonics.js`.

### Open items

- The collision scene says the page will show where the plates really met once the search data arrives. No code does this yet; the page shows only the reader's own calls.
- The search terms in `data/tectonics/README.md` are placeholders until the DIU team supplies the Odia and English terms people actually use.
- Refresh the exports every few months with the same terms.
- Trends values are relative (100 = busiest week in that export): compare shapes over time, not heights across groups.
- Each story's "This story still needs" list: S1 HMIS contraceptive supply, ASHA/ANM voices; S2 district records of child marriages stopped, young people's accounts; S3 LASI living arrangements, pensions by sex, older people's and carers' voices; S4 scheme claims by district, cover vs public-facility births, patient voices; S5 inter-state migrant registrations, train bookings, seasonal migrants' voices.
- S5: NSS 2007-08 and the 2014 field survey use different methods and cannot be matched exactly.
- If d3 or the geojson fails to load, maps fall back to the district dropdown alone.

---

## 8. Soochana Learn, the Assistant and the Storyteller

### Soochana Learn (`learn/`)

Simple, visual lessons built on the portal's own data. Linked from every page
header as **Learn**; the hub is `learn/index.html` (both tracks' cards plus an
indicator correlation matrix).

#### Track 1 — How we measure

| Page | Topic |
|---|---|
| `where-numbers-come-from.html` | Census, NFHS, SRS; samples and margin of error |
| `rates-and-ratios.html` | Per 1,000, IMR, MMR, sex ratio, growth rate |
| `fertility-rate.html` | TFR, replacement level |
| `life-expectancy.html` | Life expectancy |
| `age-structure.html` | Pyramids, dependency ratio |
| `projections.html` | Cohort-component method, the Bayesian approach |

These read `datasets/*.json` directly. Pictures that are illustrations rather
than real data say so in their captions.

#### Track 2 — Machine learning (in the style of MLU-Explain)

`train-test-validation.html`, `bias-variance.html`, `logistic-regression.html`,
`decision-tree.html`, `neural-networks.html`, `equality-of-odds.html` — all
trained in the browser on the 30-district table.

#### Lesson pattern

Every lesson reads the same way:
- the idea in one picture (`.ln-gist`) and "Words to know" (`.ln-words`) at the top;
- one plain question per section, each with one chart;
- a "Remember" box (`.ln-remember`) at the end;
- technical detail only in "Data and method".

The components are at the end of `learn/learn.css`.

#### Code and data

- `learn/learn.js` (`SL`): models, metrics, seeded splits, the scroll engine; also `module.exports` for the tests. Every model runs in the browser, so no number in the prose is typed in by hand.
- `learn/data/districts.json`: generated — `python learn/tools/build_learn_data.py` (see section 6).
- Tests: `tests/learn.test.js` and one test file per ML lesson (see section 9). Some tests pull the maths out of the lesson HTML between markers (e.g. `BV-MATH-START`/`BV-MATH-END`, the `eo-core` block) — keep those markers when editing.

### Soochana Assistant (chatbot)

The floating chat on every page. It answers from the portal's own data,
entirely in the browser — no server, no API key.

#### Files

- **`chatbot.js`** — the chat window (`window.SoochanaAssistant`). On first open it loads `chatbot-engine.js` and the data. Paths resolve against the script's own URL, so it works from `learn/` too. Answers are built with `textContent` only, so nothing typed is run as HTML. Avatar: `icons/assistant-96.png`, `assistant-192.png`.
- **`chatbot-engine.js`** — question answering. `createEngine({districts, population, fertility, national, contents, reports, datasets})` returns an engine whose answers are `{blocks, links, suggestions}`.

#### What it understands

- **Districts**, including other spellings (Balasore, Keonjhar, Sonepur…) and small typos (edit-distance matching).
- **About 40 indicators** by everyday names ("child marriage", "IMR", "stunting").
- **Groups**: KBK, coastal, revenue divisions; and **states**.

#### What it answers

A single value; a ranking; a threshold list; a comparison of districts or
groups; a trend (population 1951–2036, fertility to 2036, NFHS-4 → NFHS-5);
associations between indicators ("why…"); a district's strengths and gaps
("what should … focus on?"); and pointers to articles, reports and datasets.
Every answer names its source and year. Follow-ups ("and Puri?", "and the
lowest?") reuse the previous subject.

#### Data

`learn/data/districts.json`, `datasets/district_population_trends.json`,
`district_fertility_trends.json`, `national_comparisons.json`,
`data/contents.json`, `data/reports.json`, `data/datasets.json`. After
rebuilding `districts.json` the Assistant uses the new figures automatically.

#### Extending

To add a phrase people use for an indicator, add it to that indicator's list in
`TABLE` in `chatbot-engine.js`. Tests: `tests/chatbot.test.js` checks answers
against the real files.

### Soochana Storyteller (`storyteller/`) — switched off

**No page loads it at present.** The code is kept so it can be turned back on.

A scroll-aware narrator that explains each chart from the data behind it
(trend, turning points, crossings, observed vs projected) and can read the
explanation aloud:

```
DATA → STATISTICAL ANALYSIS → PATTERN DETECTION → INSIGHTS → NARRATION → (optional) VOICE
```

Everything up to narration is deterministic browser JavaScript. A language
model is an optional last step whose rewrite is used only if a validator can
trace every number and year back to the evidence.

| Layer | Files |
|---|---|
| Engine (`window.SoochanaInsight`, pure functions, no DOM) | `engine/stats.js`, `trend.js`, `compare.js`, `pyramid.js`, `rules.js`, `language.js`, `narrate.js` |
| Narration | `narration/narration-service.js` (optional model rewrite, cached, cancellable), `prompt.js` (system prompt, schema, validator — shared with Node), `voice.js` (browser speech) |
| Stories | `stories/registry.js` (story id → dataset), `stories/districts.js` (canonical district names) |
| UI | `ui/storyteller.js`, `ui/storyteller.css` |
| Optional server | `server/` (see section 9) |

It was written for `district.html?id=` (population, TFR, life expectancy,
child mortality, dossier charts) and `odisha.html` (sections 04–09). To turn it
on, add the script tags and `SoochanaStoryteller.init({...})` call given in
`storyteller/README.md` → "Page integration", and mark chart sections with
`data-story-id`.

Full documentation in the folder:
- `storyteller/README.md` — using it, adding a chart, page integration, the model layer
- `storyteller/ARCHITECTURE.md` — layers, page and scroll flow, performance, fallback, privacy
- `storyteller/DATA_MODEL.md` — AnalyticalSeries, StoryDataset, Profile, Narration; provenance; known data gaps; canonical district names
- `storyteller/NARRATION_RULES.md` — thresholds, level vs rate, observed vs projected, hedging, rule registry, composition, what it must never do, the model contract

---

## 9. Tooling, tests and the optional server

### Build scripts (Python, standard library only)

Run from the repository root.

| Command | Reads | Writes | Run when |
|---|---|---|---|
| `python tools/build_hero_data.py` | state_demographics, district_age_pyramids, district_fertility_trends, `Orissa.geojson` | `hero_data.js` | Any of those change |
| `python learn/tools/build_learn_data.py` | districts_detail, district_mortality, district_life_expectancy, district_fertility_trends, district_population_trends, district_age_pyramids, `excel/Health.xlsx`, `excel/Migration and Urbanization.xlsx` | `learn/data/districts.json` | Any of those change; it prints any value it could not find |

`learn/tools/xlsx_reader.py` is a minimal `.xlsx` reader (zipfile +
ElementTree) so pandas/openpyxl aren't needed: `read(path)` returns each
sheet's rows, `col(ref)` turns a column letter into an index.
`learn/tools/.gitignore` ignores `__pycache__/`.

### Tests

```bash
node --test tests/
```

Node 18+, nothing to install (`node:test`, `node:assert/strict`). Tests run
against the real data files, so a data change that breaks a figure quoted in
prose fails a test.

`tests/_load.js` is a helper, not a test: it loads the Storyteller engine files
in dependency order and exposes `globalThis.SoochanaInsight`.

| File | Covers | Tests |
|---|---|---|
| `engine.test.js` | Storyteller engine: trends, peaks, crossings, pyramids, messy data | 26 |
| `narration.test.js` | LLM-output validator, voice, story registry, every story for all 30 districts | 15 |
| `chatbot.test.js` | Assistant answers against the real files | 15 |
| `learn.test.js` | `learn/learn.js` maths on districts.json | 10 |
| `equality-of-odds.test.js` | The `eo-core` block in learn/equality-of-odds.html | 8 |
| `bias-variance.test.js` | The block between `BV-MATH-START` and `BV-MATH-END` | 5 |
| `decision-tree.test.js` | Claims on the decision-tree page | 5 |
| `logistic-regression.test.js` | Standardised literacy fit, odds ratio, 50% point | 5 |
| `neural-networks.test.js` | Claims in the neural-networks prose | 4 |
| `dossier.test.js` | dossier.js card text against state_details | 5 |
| `story.test.js` | `story.js compute()` against the data and key_stats; every `data-f` slot in index.html gets a figure | 6 |

There are no tests for the Tectonics pages, explore, district or
district-health.

### `server/` — optional, not deployed

Only for the Storyteller's optional language-model narration. GitHub Pages
does not run it. `node_modules` is not installed.

`package.json`: name `soochana-narrator`, ESM, Node ≥ 18, one dependency
`@anthropic-ai/sdk`. Scripts:

```bash
cd server && npm install
npm start                # node narrate-proxy.mjs
npm run pregenerate      # node pregenerate.mjs
npm run pregenerate:dry  # same, --dry-run
```

| File | Does |
|---|---|
| `narrator.mjs` | `generateNarration(evidence, mode: 'story'|'data')` — calls Claude with structured output and checks it with the browser's validator (`storyteller/narration/prompt.js`); anything that fails is dropped |
| `narrate-proxy.mjs` | HTTP: `POST /api/narrate {cacheKey, mode, evidence}`, `GET /health`. In-memory cache (1,000 entries), de-duplicates in-flight requests, 30 requests/min per IP, 64 KB body limit |
| `pregenerate.mjs` | Writes narrations for the state and 30 districts to `data/narration/narrations.json` (not created yet). Flags `--dry-run`, `--stories`, `--districts`, `--modes`. Cache keys include a data hash, so stale text is never shown |

Environment:

| Variable | Default | Used by |
|---|---|---|
| `ANTHROPIC_API_KEY` | — (or an `ant auth login` profile) | narrator |
| `SOOCHANA_NARRATOR_MODEL` | `claude-opus-5` | narrator |
| `PORT` | 8787 | proxy |
| `ALLOWED_ORIGINS` | `http://localhost:8777` | proxy |

Pages would switch it on with `window.SOOCHANA_STORYTELLER_CONFIG =
{llmEndpoint}` (live proxy) or `{pregeneratedUrl:
'data/narration/narrations.json'}` (static), set before the Storyteller scripts
load. The API key never reaches the browser.

### Editor and dev-server config

- `.claude/launch.json`: `soochana` → `python -m http.server 8777`; `soochana-alt` → port 8778.
- `.vscode/settings.json`: Live Server port 5501.

---

## 10. Maintenance notes

Known issues, loose ends and things to watch, as of 2026-10-12.

### Bugs and inconsistencies

- **Contact form sends nothing.** `contact.html` `handleFormSubmit` only hides the form and shows a success message. Wire it to a form service or a `mailto:` before relying on it.
- **`style.css` version tag differs:** `20261007-2` on index/odisha, `20261006-3` on every other page. Bump them all together next time.
- **`journeys.html`** opens `<footer>` twice (around line 288).
- **Footers vary:** some say "Odisha Welfare Portal · Static Client Explorer" (themes, theme_detail, article, repository, contact) — an older name. Others: "Soochana · Odisha Demographic Intelligence Unit, CYSD" (index, odisha), "Soochana · Demographic Intelligence Unit (CYSD & UNFPA Odisha)" (about), "Report Finalized · 2025" (district). compare, odisha_compare, explore and report have none.
- **Gallery label:** `#thematicGallery` heading says "Eight frames" but its `data-index` says "Nine frames".
- **`district.html`** loads Flourish `embed.js` but has no Flourish embed.
- **`odisha.html`** refers to `dotfield` but does not load `dotfield.js`.

### Data caveats

- `state_demographics.json` pyramids carry ~20 junk rows after the 17 real age bands per year (see section 6).
- The NFHS-4 column in `district_fertility_trends.json` looks wrong (Cuttack highest at 2.84; 22 of 30 districts above 2.1 vs a state rate of ~2.05). Verify against the NFHS-4 district factsheets before using it.
- District name spellings differ between files; every consumer keeps its own alias map. A single shared map would remove a class of bugs.
- The JSON in `datasets/` was converted from Excel outside the repository; there is no script to regenerate it.

### Unused or orphan files

| File | Status |
|---|---|
| `odisha.html`, `compare.html`, `journeys.html` | Work, but no page links to them |
| `script.js`, `national_data.js`, `odisha_data.js` | Not loaded by any page |
| `data/factsheets.json`, `data/portalContent.ts` | Empty |
| `data/factsheets.ts` | Leftover TypeScript from an earlier React version |
| `datasets/*.xlsx`, `datasets/importantdatasets.zip` | Not read by any code |
| `storyteller/`, `server/` | Switched off; kept for later |

Decide whether to link, delete or archive these.

### Open work

- **Tectonics:** no Google Trends CSVs yet, so every trace shows "No reading yet"; search terms are placeholders awaiting the DIU team's Odia/English list; the collision scene's promised "where the plates really met" view is not built. See section 7.
- **Tectonics story 5 ("Leaving home") is uncommitted**: `tectonics-migration.html`, `tectonics-s5.js` (new) and edits to `tectonics.js`, `tectonics.css`, the other Tectonics pages, `data/tectonics/README.md` and `data/updates.js`.
- `SOOCHANA_PORTAL_DATA.md` (the data book) is also uncommitted.
- No tests cover Tectonics, explore, district or district-health.
- `data/narration/narrations.json` (Storyteller pre-generated text) has not been produced.

### Checklist for any change

1. Bump `?v=` for each changed `.css`/`.js` on every page that loads it.
2. Rebuild generated data if sources changed (`tools/build_hero_data.py`, `learn/tools/build_learn_data.py`).
3. `node --test tests/`.
4. Add a `data/updates.js` entry if readers should notice.
5. Commit, push to `main`; Ctrl + F5 to check.
