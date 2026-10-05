# Soochana

## Publishing an update

Every page loads its own stylesheets and scripts with a version tag, e.g. `style.css?v=20260925`. When you change any `.css` or `.js` file, change that number on every page (one find-and-replace across the `.html` files; the date works, with `-2`, `-3` for a second or third update the same day) before you push. Browsers then fetch the new files instead of mixing them with copies they saved earlier.

GitHub Pages still lets a browser reuse a page itself for up to 10 minutes, so right after a push someone who visited recently may see the old version briefly. Ctrl + F5 loads the new one.

## Home page story ("Odisha, told in 100 people")

The scroll story under the home page hero. One sticky picture of 100 dots; the cards scroll over it, and each card re-forms the same dots: a waffle of 100 people, the population line 1901–2036, the growth-rate bars, the 30 districts by fertility, the age split in 2021 and 2036, the district maps.

- `story.js`: computes every figure the cards quote from the data files and draws the scenes. `story.css`: the layout (cards on the left on wide screens; picture on top and cards from the bottom on phones).
- Copy lives in `index.html` (`#story`). A number inside `<b data-f="key">` is filled in from the data when the page loads, so change the data, not the number. Each card's `data-step` names its scene in `SCENES` in `story.js`.
- The look: rough off-white paper (the site's own grain and wash textures) with the charts drawn in ink, and each chapter's cards in their own muted colour (`data-ch` on each card in `index.html`; colours under "one card colour and one accent per chapter" in `story.css`). The chart colours were checked against the paper. Icons come from `icons.js`, which the dossier shares; `CHAPTERS` in `story.js` picks each chapter's icon.
- The fertility chapter uses the district projection years (2020 → 2036), not the file's NFHS-4 column, which looks wrong (it lists Cuttack as the highest district, at 2.84, and 22 of 30 districts above 2.1 against a state rate of about 2.05). Check it against the NFHS-4 district factsheets before using it.
- Tests: `tests/story.test.js` checks the figures against the real files, and that every `data-f` slot has one.

## Home page state dossier ("Odisha, module by module")

The 20 modules of `datasets/state_details.json`, read as a scroll story in seven chapters (Land, Governance, People, Tribal heritage, Health, Education, Infrastructure). Cards scroll on the left; a sticky white panel on the right shows each module's picture as its card reaches the middle of the screen. The index bar above them ("Analytics index") shows the chapter and module being read, fills as you go, and has a "Jump to a module" menu.

- `dossier.js` builds the cards, the panel and the index from the data. `dossier.css` holds the layout (two columns on wide screens; on phones the panel sticks under the bar and the cards scroll beneath).
- A module with a `chart_url` shows its Flourish chart in the panel, loaded when you reach it or the module next to it. The others get a picture drawn from their own figures, set in `PICTURES` in `dossier.js`: the map, a land-use waffle, scale circles, the assembly, the 62 communities, a pyramid of care, bar rows.
- Card text: a module's own narrative where it has one; otherwise the lead in `LEADS`, written around the module's figures. To regroup modules, edit `CHAPTERS`. A module added to the file and not listed there appears in a last "More" chapter.
- The look matches the story: rough off-white paper, with each chapter's colour on its cards, its index chip and the progress line (in `dossier.css`: the chapter colours under "one ground and one accent per chapter", the paper under "THE PAPER LOOK"). Icons are line drawings in `icons.js` (shared with the story): `CHAPTERS` picks each chapter's icon and `MODULE_ICONS` each module's.
- Tests: `tests/dossier.test.js`.

## Soochana Learn

Visual machine-learning explainers in the style of [MLU-Explain](https://mlu-explain.github.io/), built on the portal's own data for the 30 districts. Linked from every page header as **Learn**; start at `learn/index.html`.

- Pages: `learn/train-test-validation.html`, `bias-variance.html`, `logistic-regression.html`, `decision-tree.html`, `neural-networks.html`, `equality-of-odds.html`, plus the hub `learn/index.html` (cards and an indicator correlation matrix).
- Shared code: `learn/learn.js` (models, metrics, seeded splits, the scroll engine) and `learn/learn.css`. Every model runs in the browser, so no number in the prose is typed in by hand.
- Data: `learn/data/districts.json`, one row per district with about 40 indicators. It is generated. After the source files in `datasets/` or `excel/` change, rebuild it with `python learn/tools/build_learn_data.py` (standard library only). The script prints any value it could not find.
- Tests: `tests/learn.test.js` checks the maths against the real table.

## Soochana Assistant (chatbot)

The floating chat on every page. It answers from the portal's own data, entirely in the browser, so it works on GitHub Pages with no server or API key.

- `chatbot.js`: the chat window. It loads the engine and data the first time someone opens the chat, and builds answers with `textContent` only, so nothing typed is ever run as HTML.
- `chatbot-engine.js`: the question answering. It recognises districts (including other spellings such as Balasore, Keonjhar and Sonepur, and small typos), about 40 indicators by their everyday names ("child marriage", "IMR", "stunting"), groups (KBK, coastal, divisions) and states. It then answers with a single value, a ranking, a threshold list, a comparison of districts or groups, a trend (population 1951–2036, fertility to 2036, NFHS-4 → NFHS-5), associations between indicators ("why…"), or a reading of a district's strengths and gaps ("what should … focus on?"). Every answer names its source and year, and follow-ups ("and Puri?", "and the lowest?") reuse the previous subject.
- Data: `learn/data/districts.json`, `datasets/district_population_trends.json`, `district_fertility_trends.json`, `national_comparisons.json`, and the indexes in `data/`. After rebuilding `districts.json`, the assistant picks up the new figures automatically.
- To add a phrase people use for an indicator, add it to that indicator's list in `TABLE` in `chatbot-engine.js`.
- Tests: `tests/chatbot.test.js` checks answers against the real files.

## Soochana Storyteller

**Currently switched off:** no page loads it. The code is kept here so it can be turned back on (see storyteller/README.md, "Page integration").

A scroll-aware narrator that explains each chart from the data behind it (trend, turning points, crossings, observed vs projected) and can read the explanation aloud. It runs entirely in the browser. An optional language-model rewrite needs the small server in `server/`.

- Docs: [storyteller/README.md](storyteller/README.md), [ARCHITECTURE](storyteller/ARCHITECTURE.md), [DATA_MODEL](storyteller/DATA_MODEL.md), [NARRATION_RULES](storyteller/NARRATION_RULES.md)
- Tests: `node --test tests/` (Node 18+, no install needed)
