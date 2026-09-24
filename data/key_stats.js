/* ─────────────────────────────────────────────────────────────────────
   data/key_stats.js — the headline figures on the home page (index.html)

   Edit the numbers here; the page draws itself from this file.

   Every tile has:
     value   the big number, exactly as it should appear   e.g. '15.8'
     label   what it measures                              e.g. 'Birth Rate'
     note    optional second line (unit, year, detail)     e.g. 'per 1,000 population'
     source  optional source line, shown under the tile    e.g. 'SRS 2020'
             leave '' to show no source
     color   teal · orange · purple · blue · green · red

   Layout is automatic: every row fills the page width with equal tiles.
   Delete a tile (or a whole group) and the rest re-flow by themselves;
   add one and it takes its place. Keep each figure in one place only.

   Special value: 'auto' on the sex-ratio tile reads the 2021 projection
   row from datasets/state_demographics.json instead of a fixed number.

   After editing, reload with Ctrl + F5.
   ───────────────────────────────────────────────────────────────────── */
window.SOOCHANA_KEY_STATS = {
  groups: [
    {
      title: 'People',
      tiles: [
        { value: '4.6 Cr', label: 'Projected Population', note: '2021',
          source: 'Census of India; ORGI population projections', color: 'teal' },
        { value: '1.8',    label: 'Total Fertility Rate (TFR)', note: 'NFHS-5, 2019-21',
          source: 'NFHS-5 (2019-21)', color: 'orange' },
        { value: '15.9%',  label: 'Aged 60 and over', note: 'Projected 2036',
          source: '', color: 'purple' },
        { value: '72.9%',  label: 'Literacy Rate', note: 'Census 2011',
          source: 'Census of India 2011', color: 'orange' },
        { value: 'auto',   label: 'Sex Ratio', note: 'Females per 1,000 males, 2021',
          source: 'Census of India; ORGI population projections', color: 'purple' }
      ]
    },
    {
      title: 'Economy & administration',
      tiles: [
        { value: '₹9.88L Cr',   label: 'GSDP (Current Prices)', note: 'Per capita: ₹1,86,761',
          source: '', color: 'teal' },
        { value: '155,707 km²', label: 'Geographical Area', note: 'Forest cover: 33.67% (52.4k km²)',
          source: '', color: 'green' },
        { value: '30 Districts', label: 'Administration', note: '314 blocks (118 tribal) · 317 tehsils · 3 divisions',
          source: '', color: 'blue' },
        { value: '4.83 Cr',     label: 'Projected Population 2026', note: '81.5% rural · 18.5% urban',
          source: 'Census of India; ORGI population projections', color: 'blue' }
      ]
    },
    {
      title: 'Vital rates',
      tiles: [
        { value: '15.8', label: 'Birth Rate', note: 'per 1,000 population',
          source: '', color: 'teal' },
        { value: '7.9',  label: 'Death Rate', note: 'per 1,000 population',
          source: '', color: 'blue' },
        { value: '28',   label: 'Infant Mortality (IMR)', note: 'per 1,000 live births',
          source: '', color: 'orange' },
        { value: '124',  label: 'Maternal Mortality (MMR)', note: 'per 100,000 live births',
          source: '', color: 'red' },
        { value: '70.4', label: 'Life Expectancy', note: 'M: 69.2 | F: 71.8 years',
          source: '', color: 'green' }
      ]
    }
  ]
};
