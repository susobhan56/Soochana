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
