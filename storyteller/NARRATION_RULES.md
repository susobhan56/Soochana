# Narration rules

## 1. Movement vs pattern: thresholds

A change is narrated only if it clears a **meaningful threshold**:

- the series' `minChange`, if set; otherwise
- **1 percentage point** for shares (`unitKind: 'percent'`); otherwise
- **3% of the series' typical level**.

| Story | `minChange` |
|---|---|
| TFR | 0.1 |
| sex ratio | 10 per 1,000 |
| sex ratio at birth | 8 |
| growth rate | 0.15 points |
| life expectancy | 0.5 years |
| mortality rates | 1 per 1,000 |

| Test | Result |
|---|---|
| \|end − start\| < threshold and range < 1.5 × threshold | **stable**, narrated as "broadly stable" (51.1 → 51.2 is not "increased") |
| \|end − start\| < threshold but range is large | **mixed** |
| one run of movement after noise is folded away | **increasing / decreasing** |
| several runs, and moves against the net direction total ≤ 25% of moves with it | increasing / decreasing, with the reversal kept as a turning point |
| otherwise | **mixed** |

**Noise folding.** Step movements under 10% of the threshold count as flat. Runs whose total move is under 50% of the threshold are merged into their neighbours. What survives is what a reader would see.

**Strength.** Strong needs a change ≥ 4× the threshold and a monotone or fairly linear path (r² ≥ 0.7). Moderate is ≥ 2×. Everything else is weak, and weak moves read "edges up" or "edges down".

**Shape**, from early-half vs late-half rates measured per unit of time:

| Late ÷ early rate | Shape |
|---|---|
| > 1.3 | accelerating |
| < 0.75 | decelerating |
| otherwise | linear |

One turning point gives a U or an inverted U; two or more give fluctuating.

**Peak and trough** are reported only when interior and at least half a threshold beyond both ends. An endpoint maximum is "the highest value", not a peak.

**Sudden change** means one interval carries ≥ 50% of all movement at ≥ 3× the median rate, within a normal-length interval. A big change across a long gap in the data is not sudden.

**Reference crossings** (replacement fertility 2.1, sex-ratio parity 1,000) use the latest crossing. When the two points around a crossing are more than five years apart, the text says "between 2011 and 2021", not an interpolated "around 2013".

## 2. Level vs rate, points vs per cent

- A population level and its growth rate are separate series with separate roles, and a falling growth rate is never read as a falling population (`population_growth_slowdown`). The growth rate is recomputed from the chart's own levels wherever the chart has none.
- Shares change by **percentage points**. A relative change is only stated when computed as such. Counts with large growth read "about 5 times its 1901 level" or "roughly double".
- No relative change is given from a zero or negative start.
- Values keep their display unit: 12.74 lakh, 5.15 crore, 51.2 million, 1,022 females per 1,000 males, 1.21 children per woman.

## 3. Observed vs projected

- Projected values are never described as fact. The wording changes to "is projected to…", "a projected 18.2% by 2036", "(projected)", "In the projections, …".
- When an observed phase moves differently from the projection (Koraput TFR: 2.14 → 2.16 observed, then projected to fall), each phase gets its own verb.
- The card badge always shows Observed, Observed + projected, Projected or Survey rounds.
- Survey rounds (NFHS-4 → NFHS-5) read "Between the NFHS-4 and NFHS-5 survey rounds…". No intermediate years are invented.

## 4. Confidence and hedging

| Condition | Effect |
|---|---|
| Starting level | high with ≥ 5 points; medium with 3–4 (or 2 survey rounds); low otherwise |
| Missing source | −1 |
| Data-quality warnings (duplicates, missing values) | −1 |
| Mixed direction with fewer than 5 points | −1 |

In story mode, the first sentence is prefixed:

| Confidence | Prefix |
|---|---|
| medium | "The available figures suggest that…" |
| low | "The limited observations indicate that…" |

## 5. Rule registry (insight types)

`rules.js` holds the rules, highest priority first. Each returns a typed insight with `covers`, the series it explains. A lower-priority insight whose series are already covered is dropped, so one combined story replaces several single-series sentences.

| Rule | Type | Fires when | Says (story mode) |
|---|---|---|---|
| age_structure_shift | ageing | young share ↓ and elderly share ↑ | "The age structure is shifting towards older ages…", plus the elderly–children crossover and the working-age peak |
| population_growth_slowdown | population_growth_slowdown | level ↑ and growth rate ↓ (or ≤ 60% of its peak) | "…keeps growing, but the pace of that growth has slowed since the 1970s." |
| pyramid_transition | ageing | narrowing base with a fuller top, an upward bulge or a rising median age | "…the pyramid narrows at the base while the middle and older age groups fill out…", with the selected year's shape |
| fertility_transition | fertility_decline | TFR ↓ (a separate branch handles TFR not falling) | replacement-level crossing, projected continuation, easing pace |
| sex_ratio_path | sex_ratio_shift | any sex-ratio series | long dip and recovery, parity crossing in neutral words ("more females than males") |
| population_decline | population_decline | level ↓ | "…is projected to decline" |
| gender_gap | gender_gap | paired male/female series | both rise or fall; gap widens, narrows or holds |
| shared_direction | decrease / increase / health_improvement | ≥ 3 series all moving the same way | "…all three child mortality rates fall. The steepest relative drop is in…" |
| crossover | crossover | two comparable series swap order | "…lines cross between X and Y; after that, B is higher." |
| gap_change | convergence / divergence | two comparable series, gap changes by more than the threshold | "The gap … becomes progressively wider" / "…gradually narrows." |
| series_trend | increase, decrease, stable, peak, trough, acceleration, deceleration, mixed | any series not already covered | generic description |
| pyramid_sex_balance | gender_gap | women outnumber men in most 60+ bands | "Women outnumber men in most of the older age groups." |
| peer_ranking | ranking | a district among its 30 peers, unless all values are nearly equal | "…is among the highest / close to the middle / among the lowest" |

More types are reserved for future rules: `ranking_change`, `outlier`, `urbanisation`, `migration`, `nutrition_change`. `rules.register({ id, type, priority, evaluate(ctx) })` adds a rule. Registering an existing id replaces it.

## 6. Composition

- **Story mode:** at most 3 sentences and about 70 words. The top insight is always included, and then others while they fit.
- **Data mode:** at most 4 sentences and about 95 words, with precise values and dates.
- A peer ranking (priority 30) never leads.
- The headline comes from the top insight. "Why this matters" comes from the first insight that has one.

## 7. What the narrator must never do

It is enforced by the rules themselves and by the model-output validator:

- invent a number, year, source, district value or trend
- present a projection as observed
- turn survey rounds into an annual series
- claim causation ("because", "due to", "driven by", "leads to" and similar are rejected)
- label a district or value good or bad, best or worst
- give policy advice
- use markup or links

Significance notes are definitional ("Replacement level … is the rate at which each generation just replaces itself") or descriptive. The one polarity used is "lower mortality means fewer deaths per 1,000 live births", and only because mortality series declare `polarity: 'lower_is_better'`.

## 8. The model contract

- **System prompt:** `narration/prompt.js → SYSTEM_PROMPT`, versioned as `narrator-v1`.
- **Input:** the `evidence` object only. That is the computed profiles, comparisons, pyramid summary, peer position, status, source and the deterministic draft, never raw rows.
- **Output**, via a JSON schema passed as `output_config.format`:

  ```json
  { "headline": "…", "narration": "…", "importance": "…", "key_points": ["…"], "confidence": "high|medium|low" }
  ```

**Validation**, the same code in the browser and on the server:
- Every number must equal an evidence value rounded to the precision it is written at. Lakh, crore and million rescalings of head-counts are allowed, plus a few constants (2.1, 1,000, 100,000, age bounds).
- Every year must be within a year of one in the evidence.
- Forbidden: causal phrases, markup or links, and "This graph shows".
- Length: 10–90 words in story mode, up to 120 in data mode.
- A projected horizon named in the text requires projection language.

The deterministic narrations themselves pass this validator, and a test checks that they do.

**Model.** `claude-opus-5` at low effort, with server-side refusal fallback. Override it with `SOOCHANA_NARRATOR_MODEL`.
