# Data model

## AnalyticalSeries (input to the engine)

```ts
interface AnalyticalSeries {
  id: string;
  label: string;                  // "Total fertility rate"
  role?: SeriesRole;              // lets domain rules find the series (below)
  unit?: string;
  unitKind?: 'count' | 'percent' | 'rate' | 'ratio' | 'value';
  format?: UnitFormat;            // how values read in text (below)
  subject?: string;               // "Koraput’s population" — optional sentence subject
  source?: string;                // falls back to the dataset's source
  minChange?: number;             // smallest end-to-end change worth narrating
  references?: { value: number; label: string }[];   // 2.1 replacement, 1000 parity …
  surveyRounds?: boolean;         // NFHS-style rounds: never an annual trend
  polarity?: 'lower_is_better' | 'higher_is_better'; // only where established (mortality)
  values: DataPoint[];
}

interface DataPoint {
  x: number | string;             // 2011, "2015-16 (NFHS-4)", "1970-75"
  label?: string;                 // display text; defaults to the original x
  y: number | string;             // "12,74,000" is accepted and coerced
  status?: 'observed' | 'estimated' | 'computed' | 'projected' | 'modelled';
}

type SeriesRole = 'population' | 'growth_rate' | 'tfr' | 'sex_ratio'
  | 'young_share' | 'working_share' | 'elderly_share' | 'male' | 'female';

type UnitFormat = 'persons' | 'million' | 'percent' | 'growth' | 'sexratio' | 'srb'
  | 'tfr' | 'years' | 'per1000births' | 'per100kbirths' | 'value';
```

`projected` and `modelled` count as projections. `observed`, `estimated` and `computed` are non-projected, but the label is kept, so an NFHS-derived TFR stays "computed".

## StoryDataset (what a story builds)

```ts
interface StoryDataset {
  id: string; title: string; indicator: string; chartType: string;
  geography: { level: 'state' | 'district' | 'block' | 'gp' | 'village'; id: string; name: string };
  source: { name: string | null; note?: string; url?: string };
  dataVersion?: string;           // bump to invalidate cached narrations
  series: AnalyticalSeries[];
  compare?: boolean;              // pairwise comparison; default: only if units match
  groupNoun?: string;             // "child mortality rates"
  pyramid?: { years: Record<string, { age: string; male: number; female: number }[]>;
              statusOf?: (year: string) => string };
  peers?: { items: { id: string; label?: string; value: number }[]; selectedId: string;
            metricLabel: string; format: UnitFormat };
}
```

The geography levels are only labels: a block or gram-panchayat story is built exactly like a district one.

## Profile (output of `trend.analyzeSeries`)

Key fields:
- `direction`: increasing, decreasing, stable or mixed. `netDirection` is up, down or flat.
- `strength` (weak, moderate or strong) and `shape`: `linear_increase`, `accelerating_increase`, `decelerating_decrease`, `plateau`, `u_shaped`, `inverted_u` or `fluctuating`.
- `start`, `end`, `highest`, `lowest`. `peak` and `trough` are set only when interior and meaningful.
- `turningPoints[]`, and `events[]` (`sudden_change`, `levelling_off`).
- `absoluteChange`, `relativeChangePct` (null from a zero or negative start), `percentagePointChange` (percent series only) and `cagrPct` (counts only).
- `pace`: early vs late rate, measured per unit of time so uneven spacing doesn't distort it.
- `dataStatus`: observed, projected, historical_plus_projected or survey_rounds. Also `statusDetail.lastObserved` and `phases.observed` / `phases.projected`.
- `references[]`, with every crossing, the latest crossing, and the end position and distance.
- `confidence` (high, medium or low). Also `warnings[]` (data quality) and `notes[]` (properties such as negative growth).

`SoochanaInsight.analyzeDataset({ indicator, unit, geography, series: [{ year, value, status }] })` returns the same analysis in the flat shape of the specification's example.

## Narration (output of `narrate.buildNarration`)

```ts
{ storyId, title, geography, mode: 'story' | 'data',
  headline, narration, importance, keyPoints[],
  confidence: 'high' | 'medium' | 'low',
  sourceLabel, sourceNote, dataStatus, period: { start, end },
  insights: [{ type, rule, level, priority }],
  generator: 'deterministic' | 'pregenerated' | 'llm',
  cacheKey,       // geography|story|period|filters|dataVersion|mode|dataHash
  evidence }      // the only material a model may use
```

## Where each story's numbers come from

| Story | File / object | Status assumptions | Source shown |
|---|---|---|---|
| district-population | `district_population_trends.json` totals, 1951–2036 | ≤2011 observed (Census); 2016+ projected. Growth rate computed from the levels | Census of India / ORGI; Bayesian projections |
| district-tfr | `district_fertility_trends.json` | 2015-16 and 2020 computed (NFHS-4/5); 2021+ projected | NFHS-4/5 (computed); Bayesian projections |
| district-age-structure | `district_age_pyramids.json` → 0–14 / 15–59 / 60+ shares | 2011 observed; 2021+ projected | Census 2011; projected age–sex distribution |
| district-sex-ratio | female ÷ male × 1000 from the population file | ≤2011 observed; later projected | as population |
| district-pyramid | `district_age_pyramids.json` | as above | as above |
| district-life-expectancy | `district_life_expectancy.json` (NFHS-4, NFHS-5) | estimated; survey rounds | Estimates from NFHS-4/5 |
| district-mortality | `district_mortality.json` NMR, IMR, U5MR | observed; survey rounds | NFHS-4, NFHS-5 |
| state-population | `odishaSlideData.popGrowth` (millions) + growth rates from `state_demographics.json` | >2011 projected | Census (1901–2011); projection source not cited |
| state-pyramid / age-structure / sex-ratio | `odishaSlideData` | >2011 projected | Census (to 2011); projection source not cited |
| state-srb, state-tfr | `odishaSlideData` | >2011 projected | **none cited**, and the narrator says so |

## Iframe charts

The dossier's Flourish embeds (`flo.uri.sh/visualisation/…`) do not expose their data to the page, and the storyteller does not try to scrape them. Each is mapped to a parallel numerical story built from `datasets/*.json` (see `storyIdForSlide()` in `district.html`).

## Known data gaps

These are real properties of the data, not of the engine:

1. **District projections are pro-rata.** Every district's population grows by exactly the same proportion after 2011: ×1.0886 by 2021 and ×1.168 by 2036. The district projections are shares of the state projection, not district-specific models. The narrator detects this, adds it to the source note, and suppresses peer rankings where every district has the same value.
2. **District series start in 1951**, although the dossier charts are titled "1901–2036".
3. **State chart vs state sheet.** `odisha.html`'s inline population differs from `state_demographics.json` for projected years: 45.4 vs 46.25 million in 2021, and 51.2 vs 51.51 million in 2036. The narrator uses the chart's values for the level, so text matches the picture, and the sheet for growth rates. One of the two should be corrected at source.
4. **Uncited sources.** The state TFR and sex-ratio-at-birth charts cite no source. They show "Source information is not available", with lower confidence and hedged wording.
5. **Status boundaries are assumed.** "After 2011 = projected" is applied to the state inline series because the charts don't mark it. If any post-2011 point is an observed estimate (for example SRS 2021 TFR), set its `status` in the story.
6. **Suspicious duplicates.** NFHS-5 U5MR equals IMR exactly in Angul, Baleshwar, Bolangir, Cuttack and Kalahandi, and NFHS-4 IMR equals NMR in Baleshwar and Sambalpur. These look like spreadsheet carry-overs and deserve a check.
7. **`state_demographics.json`** has a second, unrelated table appended after the 2036 row. `stories.adapters.stateRows()` drops it.
8. **Not yet in structured form:** nutrition, education, health infrastructure, irrigation, migration and urbanisation. These live only as slide text or iframes. Each needs a JSON extract before it can be narrated, following the pattern in README.md → Adding a chart.

## Canonical district names

`stories/districts.js` maps official names to the spellings in each file: Balangir/Bolangir, Balasore/Baleshwar, Deogarh/Debagarh, Jagatsinghpur/Jagatsinghapur, Jajpur/Jajapur, Kendujhar/Keonjhar, Subarnapur/Sonepur and so on. Narration uses the name the page shows.
