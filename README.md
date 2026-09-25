# Soochana

## Publishing an update

Every page loads its own stylesheets and scripts with a version tag, e.g. `style.css?v=20260925`. When you change any `.css` or `.js` file, change that number on every page (one find-and-replace across the `.html` files; the date works, with `-2`, `-3` for a second or third update the same day) before you push. Browsers then fetch the new files instead of mixing them with copies they saved earlier.

GitHub Pages still lets a browser reuse a page itself for up to 10 minutes, so right after a push someone who visited recently may see the old version briefly. Ctrl + F5 loads the new one.

## Soochana Storyteller

**Currently switched off:** no page loads it. The code is kept here so it can be turned back on (see storyteller/README.md, "Page integration").

A scroll-aware narrator that explains each chart from the data behind it (trend, turning points, crossings, observed vs projected) and can read the explanation aloud. It runs entirely in the browser. An optional language-model rewrite needs the small server in `server/`.

- Docs: [storyteller/README.md](storyteller/README.md), [ARCHITECTURE](storyteller/ARCHITECTURE.md), [DATA_MODEL](storyteller/DATA_MODEL.md), [NARRATION_RULES](storyteller/NARRATION_RULES.md)
- Tests: `node --test tests/` (Node 18+, no install needed)
