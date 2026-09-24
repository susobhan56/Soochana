# Soochana

## Soochana Storyteller

**Currently switched off:** no page loads it. The code is kept here so it can be turned back on (see storyteller/README.md, "Page integration").

A scroll-aware narrator that explains each chart from the data behind it (trend, turning points, crossings, observed vs projected) and can read the explanation aloud. It runs entirely in the browser. An optional language-model rewrite needs the small server in `server/`.

- Docs: [storyteller/README.md](storyteller/README.md), [ARCHITECTURE](storyteller/ARCHITECTURE.md), [DATA_MODEL](storyteller/DATA_MODEL.md), [NARRATION_RULES](storyteller/NARRATION_RULES.md)
- Tests: `node --test tests/` (Node 18+, no install needed)
