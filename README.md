# Soochana

## Publishing an update

Every page loads its own stylesheets and scripts with a version tag, e.g. `style.css?v=20260925`. When you change any `.css` or `.js` file, change that number on every page (one find-and-replace across the `.html` files; the date works, with `-2`, `-3` for a second or third update the same day) before you push. Browsers then fetch the new files instead of mixing them with copies they saved earlier.

GitHub Pages still lets a browser reuse a page itself for up to 10 minutes, so right after a push someone who visited recently may see the old version briefly. Ctrl + F5 loads the new one.

## Soochana Learn

Visual machine-learning explainers in the style of [MLU-Explain](https://mlu-explain.github.io/), built on the portal's own data for the 30 districts. Linked from every page header as **Learn**; start at `learn/index.html`.

- Pages: `learn/train-test-validation.html`, `bias-variance.html`, `logistic-regression.html`, `decision-tree.html`, `neural-networks.html`, `equality-of-odds.html`, plus the hub `learn/index.html` (cards and an indicator correlation matrix).
- Shared code: `learn/learn.js` (models, metrics, seeded splits, the scroll engine) and `learn/learn.css`. Every model runs in the browser, so no number in the prose is typed in by hand.
- Data: `learn/data/districts.json`, one row per district with about 40 indicators. It is generated. After the source files in `datasets/` or `excel/` change, rebuild it with `python learn/tools/build_learn_data.py` (standard library only). The script prints any value it could not find.
- Tests: `tests/learn.test.js` checks the maths against the real table.

## Soochana Storyteller

**Currently switched off:** no page loads it. The code is kept here so it can be turned back on (see storyteller/README.md, "Page integration").

A scroll-aware narrator that explains each chart from the data behind it (trend, turning points, crossings, observed vs projected) and can read the explanation aloud. It runs entirely in the browser. An optional language-model rewrite needs the small server in `server/`.

- Docs: [storyteller/README.md](storyteller/README.md), [ARCHITECTURE](storyteller/ARCHITECTURE.md), [DATA_MODEL](storyteller/DATA_MODEL.md), [NARRATION_RULES](storyteller/NARRATION_RULES.md)
- Tests: `node --test tests/` (Node 18+, no install needed)
