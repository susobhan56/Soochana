# Architecture

## The portal it extends

Soochana is a static, multi-page HTML site with no framework and no build step. It is served as plain files (locally `python -m http.server 8777`, publicly GitHub Pages). D3 v7 draws its charts. `data_loader.js` fetches and caches the JSON in `datasets/`. The district dossier embeds Flourish iframes. There is no server and no existing AI integration; `chatbot.js` is a local keyword search.

The storyteller follows the same conventions:
- plain `<script>` files attached to one global namespace
- no bundler and no runtime dependencies
- the pages' own design tokens (`--teal`, `--surface`, `--ink-*`)
- the existing data files, read through `DataLoader`

The same engine files also load under Node for the tests and the build script.

## Layers

```
 page (district.html, odisha.html)
   │  data-story-id="district-tfr" on each chart section
   ▼
 ui/storyteller.js ─── IntersectionObserver → dwell → activate(section)
   │                     session memory, controls, transcript, docking
   ▼
 stories/registry.js ── story id → StoryDataset (adapters over the existing JSON / inline data)
   │  stories/districts.js: canonical district names across spellings
   ▼
 engine/  (window.SoochanaInsight, pure functions, no DOM)
   stats.js     cleaning, regression, interval rates, interpolation, hashing
   trend.js     one series → profile: direction, strength, shape, extremes,
                turning points, pace, reference crossings, observed/projected phases
   compare.js   pairs and groups: crossovers, gaps, convergence/divergence,
                rank changes; peer ranking and outliers
   pyramid.js   age–sex structure: shape, base, bulge, median age, sex balance
   rules.js     insight registry: pattern → Insight (typed, prioritised)
   language.js  units (lakh/crore, pp vs %), tense for projections, hedging
   narrate.js   profiles → insights → composed narration, evidence, cache key
   ▼
 narration/
   narration-service.js  optional model rewrite: memory → localStorage →
                         pre-generated file → live endpoint; cancellable
   prompt.js             system prompt, output schema, validator (shared with Node)
   voice.js              NarrationVoiceService + BrowserSpeechAdapter
   ▼
 server/ (optional, Node)
   narrator.mjs          Claude call with structured output, validated
   narrate-proxy.mjs     POST /api/narrate: key stays server-side, cached, rate-limited
   pregenerate.mjs       build-time narrations for static hosting
```

The UI never computes a statistic, and the engine never touches the DOM.

## Flow when the page opens

Every story section on the page is built and narrated, which takes milliseconds from JSON the page has already loaded. `narrate.buildOverview()` then combines them:
- the lead sentence of up to three charts, one per kind of pattern and chosen by insight priority, in page order;
- a linking sentence ("Read together, these charts describe a demographic transition: …"), only when those charts' own insights include at least two of slowing growth, falling fertility and ageing.

If a chart is already on screen, the first visibility check narrates it immediately with no dwell, and the overview is superseded.

## Flow when a reader scrolls

1. **Eligibility.** A section counts as in view when about 55% of it is visible, or 55% of the viewport for sections taller than the screen. Scores come from an `IntersectionObserver` with 5% thresholds. There are no scroll listeners.
2. **Dwell.** The best-scoring section must stay in view for `dwellMs` (1 s) and is re-measured before it counts. Fast scrolling narrates nothing.
3. **Build.** `stories.build(id, ctx)` returns a `StoryDataset`. It is cached per story, geography and filter state, and reuses `DataLoader`'s cached JSON.
4. **Analyse and compose.** `buildNarration(dataset, { mode, focusYear })` runs the engine and composes 1–3 sentences in story mode or up to 4 in data mode. This takes a few milliseconds and is cached per story, mode and state.
5. **Render.** The card updates, and the badge shows Observed, Observed + projected, Projected or Survey rounds.
6. **Memory.** A section already narrated this session (story + geography + filter state, kept in `sessionStorage`) updates the card silently. It is not spoken or announced again unless the reader presses Replay or changes mode or filter.
7. **Voice.** Speech plays only if the reader has turned voice on and hasn't paused. Moving to another chart cancels speech about the previous one.
8. **Refinement (optional).** If an endpoint or pre-generated file is configured, `NarrationService.refine()` looks for a validated model rewrite. A reader who moves on cancels the in-flight request with `AbortController`. The rewrite is shown only if it validates and only when not speaking.

## Performance

- Narration is deterministic and local, so it feels instant and costs nothing.
- Nothing is called on scroll; the dwell gate and memory stop repeat work.
- Datasets, narrations and model rewrites are all cached, the rewrites in memory and `localStorage` too.
- In-flight model requests are de-duplicated and cancellable.
- Pre-generation makes model text available before the reader arrives.
- The engine is about 60 KB of unminified plain JS with no dependencies. It loads with the page scripts and adds no network requests beyond the JSON the page already fetches.

## Fallback

| Failure | What the reader sees |
|---|---|
| No LLM configured, or the endpoint is down, slow (8 s timeout), rate-limited or refusing | Deterministic narration (the default path anyway) |
| Model output with an untraceable number or year, causal wording, markup, missing projection language or bad length | Rejected; deterministic narration stays |
| A story's data missing for a district | That section isn't narrated; the chart is unaffected |
| A rule throws | That rule is skipped and logged; the others still run |
| No `speechSynthesis` | Listen and voice controls disabled; text unaffected |
| Browser blocks audio | Note: "Press Listen to hear the narration" |
| No `IntersectionObserver` (very old browsers) | The storyteller doesn't start; the page works as before |
| `localStorage` or `sessionStorage` blocked | Preferences and memory last for the page view only |

## Accessibility

- All controls are native `<button>`s with labels and `aria-pressed`/`aria-expanded` state.
- A visible focus ring, and Esc collapses the card or closes the transcript.
- New narrations are announced once through a polite live region. Silent updates are not announced, so scrolling doesn't flood a screen reader.
- Text uses the portal's AA-checked ink tokens.
- `prefers-reduced-motion` removes the transitions and the pulse.
- On phones the card is a bottom sheet with 40 px touch targets, collapsed to a one-line headline by default and placed clear of the chatbot button.
- Voice is optional, and the text is always shown.

## Privacy

No login, microphone, camera, analytics or identifiers:
- Preferences (voice, mode, auto, collapsed, hidden) stay in this browser's `localStorage`.
- Session memory stays in `sessionStorage`.
- The only data that ever leaves the browser is the evidence object for a chart, and only when a live endpoint is configured. It holds aggregate statistics with no visitor data.

## Security

- The API key lives only on the proxy or the build machine, never in page JavaScript.
- The proxy allow-lists origins, caps the body at 64 KB, rate-limits by address and caches validated answers.
- Model text is inserted with `textContent` only, never as HTML, and the validator also rejects markup and links.
