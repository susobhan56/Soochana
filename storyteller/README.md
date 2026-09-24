# Soochana Storyteller

A scroll-aware narrator for the Soochana portal. When a reader stops on a chart, it explains what the chart is showing, working from the numbers behind it rather than a picture of it:

```
DATA → STATISTICAL ANALYSIS → PATTERN DETECTION → INSIGHTS → NARRATION → (optional) VOICE
```

Everything up to the narration is deterministic JavaScript that runs in the browser with no network call and no API key. A language model is an optional last step: it rewrites the text, and its output is used only if a validator can trace every number and year back to the evidence.

- [ARCHITECTURE.md](ARCHITECTURE.md): how the pieces fit, performance, fallback, privacy
- [DATA_MODEL.md](DATA_MODEL.md): the analytical data model, the story registry, data provenance and known data gaps
- [NARRATION_RULES.md](NARRATION_RULES.md): thresholds, rules, wording policy and the LLM contract

## Where it runs today

| Page | Sections narrated | Data source |
|---|---|---|
| `district.html?id=<district>` | scrolly steps: population, TFR, life expectancy, child mortality; dossier: population trends, TFR, age structure, sex ratio, pyramid, mortality | `datasets/district_*.json` (the same files the page already loads) |
| `odisha.html` | sections 04–09: population, pyramid (follows the year buttons), age shares, sex ratio, sex ratio at birth, TFR | the page's inline `odishaSlideData`, plus `datasets/state_demographics.json` for growth rates |

Change district and the narration is recomputed for that district from its own data. No narration text is written into the pages.

## Using it

As soon as the page opens, the card shows a **page overview** ("Koraput at a glance"). It is composed from the page's own charts: the lead finding of the most significant ones, one linking sentence when their insights support it, and a list of every chart that jumps to it. A chart that is already on screen at load is explained straight away. After that, the card follows the reader from chart to chart.

The card sits bottom-left, or docks right away from the chart. It has:

- **Listen / Pause / Resume**: browser text-to-speech. It is off until the reader asks, because browsers block audio without a gesture.
- **Voice on/off** (mute).
- **Overview** (grid icon): back to the page summary.
- **Replay**.
- **Story / Data**: plain explanation, or precise values and dates.
- **Auto**: follow the page as the reader scrolls, or wait to be asked.
- **Why this matters**: a one-line significance note.
- **Transcript**: everything narrated this session, with links back to each chart.
- **Collapse** (Esc) and **Hide**.

The text is always visible. The narrator is never the only way to read a chart.

## Adding a chart

1. **Register a story** in `stories/registry.js`, or from page code with `SoochanaStoryteller.stories.register(...)`:

   ```js
   register({
     id: 'district-literacy', title: 'Literacy', indicator: 'literacy', chartType: 'bar', level: 'district',
     build: ctx => ctx.load('datasets/district_literacy.json').then(all => {
       const key = SoochanaStoryteller.districts.resolveKey(ctx.geography.id, Object.keys(all));
       if (!key) return null;
       return {
         source: { name: 'Census of India 2011', note: 'Census count; not a trend.' },
         compare: true,
         series: [
           { id: 'f', label: 'Female literacy', role: 'female', unitKind: 'percent', format: 'percent',
             values: [{ x: 2001, y: all[key].f2001, status: 'observed' }, { x: 2011, y: all[key].f2011, status: 'observed' }] },
           { id: 'm', label: 'Male literacy', role: 'male', unitKind: 'percent', format: 'percent',
             values: [{ x: 2001, y: all[key].m2001, status: 'observed' }, { x: 2011, y: all[key].m2011, status: 'observed' }] }
         ]
       };
     })
   });
   ```

2. **Mark the section** that shows the chart: `<div data-story-id="district-literacy">…</div>`. Sections added to the page later are picked up automatically.

3. **Declare the unit, source and status** of every value (see DATA_MODEL.md). Never guess a source. Use `name: null` and a note if the chart doesn't cite one.

4. **Check the narration** in Node before shipping:

   ```bash
   node --test tests/
   ```

   If no existing rule tells the story well, add one (see NARRATION_RULES.md). Rules are small, independent and ordered by priority.

5. If the chart has filters (a year, a district, a category), call `SoochanaStoryteller.setState('<story id>', { year: '2036' })` when they change. The narration regenerates for the new state.

## Page integration

```html
<!-- in <head>, after data_loader.js -->
<script src="storyteller/engine/stats.js"></script>
<script src="storyteller/engine/trend.js"></script>
<script src="storyteller/engine/compare.js"></script>
<script src="storyteller/engine/pyramid.js"></script>
<script src="storyteller/engine/language.js"></script>
<script src="storyteller/engine/rules.js"></script>
<script src="storyteller/engine/narrate.js"></script>
<script src="storyteller/narration/prompt.js"></script>
<script src="storyteller/narration/voice.js"></script>
<script src="storyteller/narration/narration-service.js"></script>
<script src="storyteller/stories/districts.js"></script>
<script src="storyteller/stories/registry.js"></script>
<script src="storyteller/ui/storyteller.js"></script>
<link rel="stylesheet" href="storyteller/ui/storyteller.css">
```

```js
SoochanaStoryteller.init({
  geography: { level: 'district', id: 'Koraput', name: 'Koraput' },  // or the state
  load: url => DataLoader.loadJSON(url),                            // reuse the page's cache
  sources: { odishaSlideData },                                     // data already inline, if any
  dock: 'right'                                                     // 'left' | 'right' | 'auto'
});
```

Optional settings go in `window.SOOCHANA_STORYTELLER_CONFIG` before the scripts load: `llmEndpoint`, `pregeneratedUrl`, `dwellMs` (default 1000), `minVisible` (default 0.55).

## The optional language-model layer

The portal is a static site, so nothing here requires a server. Two ways to add model-written narration, both keeping the key off the client:

- **Pre-generated (works on GitHub Pages):** `cd server && npm install && node pregenerate.mjs`, commit `data/narration/narrations.json`, and set `pregeneratedUrl: 'data/narration/narrations.json'`. That's 438 narrations: the state stories plus 30 districts × 7 stories, in both modes. A data change changes the cache key, so stale text is never shown.
- **Live proxy:** run `server/narrate-proxy.mjs` somewhere with `ANTHROPIC_API_KEY`, allow the portal's origin, and set `llmEndpoint`.

In either case the deterministic narration shows first, instantly. A model rewrite replaces it only if it passes validation, and never mid-sentence.

## Tests

```bash
node --test tests/
```

40 tests cover the perception engine and the narration layer:
- increasing, decreasing, stable, noisy and fluctuating series
- peaks, troughs, acceleration and deceleration
- reference-line crossings, crossovers, convergence and divergence, ranking changes and outliers
- percentage-point vs relative change, and population vs growth rate
- observed vs projected, and survey rounds
- pyramids and age structure
- missing, zero, negative, duplicated and irregular data
- the LLM validator, and every story for all 30 districts
