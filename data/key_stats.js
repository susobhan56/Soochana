/* ─────────────────────────────────────────────────────────────────────
   data/key_stats.js — the headline figures on the home page (index.html)

   Edit the numbers here; the page draws itself from this file.

   A tile can show several figures side by side instead of one value:
     parts: [ { value: '23.3%', label: '0–14 years' }, … ]

   Every tile has:
     value   the big number, exactly as it should appear   e.g. '15.8'
     label   what it measures (optional)                   e.g. 'Birth Rate'
     note    optional second line (unit, year, detail)     e.g. 'per 1,000 population'
     source  optional source line, shown under the tile    e.g. 'SRS 2020'
             leave '' to show no source
     color   teal · orange · purple · blue · green · red

   Groups appear on the page in the order listed here. Layout is automatic:
   every row fills the page width with equal tiles. Delete a tile (or a
   whole group) and the rest re-flow by themselves; add one and it takes
   its place. Keep each figure in one place only.

   After editing, reload with Ctrl + F5.
   ───────────────────────────────────────────────────────────────────── */
window.SOOCHANA_KEY_STATS = {
  groups: [
    {
      title: 'People',
      tiles: [
        { value: '4.6 Cr', label: '2021', note: '',
          source: 'Census of India, Population Projection using the Bayesian Approach', color: 'teal' },
        { value: '1.8',    label: 'Total Fertility Rate (TFR)', note: '',
          source: 'NFHS-5 (2019-21)', color: 'orange' },
        { parts: [
            { value: '23.3%', label: '0–14 years' },
            { value: '65.6%', label: '15–59 years' },
            { value: '11.0%', label: '60+ years' }
          ],
          label: 'Population by age group', note: '',
          source: 'Census of India, Population Projection using the Bayesian Approach', color: 'purple', wide: true },
        { value: '72.9%',  label: 'Literacy Rate', note: 'Census 2011',
          source: 'Census of India 2011', color: 'orange' },
        { value: '988',    label: 'Females per 1,000 males, 2021', note: '',
          source: 'Census of India, Population Projection using the Bayesian Approach', color: 'purple' }
      ]
    },
    {
      title: 'Vital rates',
      tiles: [
        { value: '15.8', label: 'Birth Rate', note: 'per 1,000 population',
          source: 'SRS Statistical Report 2024', color: 'teal' },
        { value: '7.9',  label: 'Death Rate', note: 'per 1,000 population',
          source: 'SRS Statistical Report 2024', color: 'blue' },
        { value: '28',   label: 'Infant Mortality (IMR)', note: 'per 1,000 live births',
          source: 'SRS Statistical Report 2024', color: 'orange' },
        { value: '124',  label: 'Maternal Mortality (MMR)', note: 'per 100,000 live births',
          source: 'SRS Special Bulletin on Maternal Mortality in India 2022-2024', color: 'red' },
        { value: '70.4', label: 'Life Expectancy', note: 'M: 69.2 | F: 71.8 years',
          source: 'SRS Abridged Life Tables 2020-2024', color: 'green' }
      ]
    },
    {
      title: 'Economy & administration',
      tiles: [
        { value: '₹9.88L Cr',   label: 'GSDP (Current Prices)', note: 'Per capita: ₹1,86,761',
          source: 'OES 2025-26', color: 'teal' },
        { value: '155,707 km²', label: 'Geographical Area', note: 'Forest cover: 33.67% (52.4k km²)',
          source: 'Govt of Odisha', color: 'green' },
        { value: '30 Districts', label: 'Administration', note: '314 blocks (118 tribal) · 317 tehsils · 3 divisions',
          source: 'Govt of Odisha', color: 'blue' },
        { value: '41.3%',       label: 'Industry contribution to GSVA, 2025-26', note: 'Agriculture & allied 19.6% · Services 39.1%',
          source: 'OES 2025-26', color: 'blue' }
      ]
    }
  ]
};
