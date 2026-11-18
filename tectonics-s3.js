/* ═══════════════════════════════════════════════════════════════════
   TECTONICS · story 3, "The ageing aftershock" (tectonics-ageing.html)
   The story's numbers and words; tectonics.js draws them.
   - Share aged 60+: NFHS-5 → NFHS-6 for Odisha (household members).
   - Age pyramid: Census 1991 and 2011; 2021–2036 from the ORGI
     Technical Group projections (2020), as held in
     datasets/state_demographics.json (state age–sex pyramids), in lakh.
   - Districts: share aged 60+, Census 2011 and 2036
     (datasets/district_age_pyramids.json: UNFPA district projections
     (2022) for 2021 and 2026; 2031 and 2036 carried forward with the
     ORGI state projection).
   Rebuild the pyramid rows and the district values from those two
   files when they change; do not type them by hand.
   ═══════════════════════════════════════════════════════════════════ */
window.TK_STORY = {
  number: 3,

  guesses: {
    elders: {
      island: 'islandElders', key: 'keyElders', input: 'guessElders',
      was: 13.4, now: 15.6,
      keyRevealed: [
        ['#f4c534', 'Aged 60+ in 2019–21'],
        ['var(--tk-land)', 'Added by 2023–24'],
        ['rgba(255,255,255,0.14)', 'Under 60']
      ]
    }
  },

  pyramid: {
    svg: 'tkPyramid', range: 'pyrYear', out: 'pyrYearOut', play: 'pyrPlay', readout: 'pyrReadout',
    years: [1991, 2011, 2021, 2026, 2031, 2036],
    projectedFrom: 2021,
    start: 2011,
    groups: ['0–4', '5–9', '10–14', '15–19', '20–24', '25–29', '30–34', '35–39', '40–44', '45–49', '50–54', '55–59', '60–64', '65–69', '70–74', '75–79', '80+'],
    highlightFrom: 12,
    male: {
      1991: [18.299, 20.967, 17.938, 14.778, 14.177, 13.405, 11.054, 10.634, 8.279, 7.498, 6.603, 4.565, 4.697, 2.582, 2.151, 0.859, 1.242],
      2011: [18.781, 20.853, 22.035, 19.727, 18.709, 17.729, 15.422, 15.287, 13.879, 12.124, 9.575, 7.443, 7.376, 4.878, 3.806, 1.833, 2.049],
      2021: [17.85, 18.32, 19.41, 20.27, 20.65, 19.45, 18.13, 16.81, 15.37, 14.31, 12.96, 10.86, 8.38, 6.43, 4.98, 3.26, 2.58],
      2026: [17.06, 17.58, 18.16, 19.19, 19.94, 20.32, 19.14, 17.82, 16.50, 15.01, 13.83, 12.31, 10.05, 7.49, 5.47, 3.83, 3.21],
      2031: [16.07, 16.82, 17.43, 17.94, 18.88, 19.63, 20.01, 18.83, 17.51, 16.13, 14.54, 13.17, 11.44, 9.04, 6.43, 4.27, 3.90],
      2036: [15.09, 15.85, 16.67, 17.22, 17.64, 18.59, 19.34, 19.71, 18.53, 17.14, 15.65, 13.88, 12.29, 10.36, 7.83, 5.08, 4.55]
    },
    female: {
      1991: [17.828, 20.348, 17.794, 15.340, 14.072, 13.332, 10.703, 9.562, 7.672, 6.954, 5.994, 4.407, 4.541, 2.593, 2.188, 0.857, 1.099],
      2011: [17.749, 19.894, 21.451, 19.527, 19.126, 18.012, 15.608, 15.225, 13.036, 11.217, 8.903, 7.394, 7.364, 4.917, 3.874, 1.815, 1.931],
      2021: [16.82, 17.24, 18.39, 19.42, 20.02, 19.35, 18.56, 17.35, 15.78, 14.35, 12.54, 10.39, 8.31, 6.69, 5.26, 3.53, 2.94],
      2026: [16.07, 16.59, 17.12, 18.17, 19.05, 19.79, 19.15, 18.37, 17.16, 15.51, 13.98, 12.11, 9.89, 7.63, 5.84, 4.25, 3.86],
      2031: [15.18, 15.87, 16.48, 16.91, 17.81, 18.84, 19.60, 18.98, 18.19, 16.88, 15.13, 13.54, 11.57, 9.14, 6.73, 4.80, 4.90],
      2036: [14.24, 14.99, 15.77, 16.28, 16.56, 17.62, 18.67, 19.43, 18.79, 17.91, 16.50, 14.68, 12.97, 10.76, 8.15, 5.60, 5.92]
    }
  },

  /* each age group against its own size in 2011 (= 100) */
  slope: {
    max: 280,
    decimals: 0,
    sameStart: true,
    axis: ['2011 = 100', '2036'],
    rows: [
      { name: 'Aged 80 and over', short: '80 and over', was: 100, now: 263, color: '#f9dd7f' },
      { name: 'Aged 60–79', short: '60–79', was: 100, now: 204, color: '#f4c534' },
      { name: 'Working age, 15–59', short: '15–59', was: 100, now: 122, color: '#9fd3f0' },
      { name: 'Children, 0–14', short: '0–14', was: 100, now: 77, color: '#f08a4b' }
    ]
  },

  /* share aged 60+, by district: [Census 2011, projected 2036] */
  map: {
    svg: 'tkMap', select: 'mapPick', readout: 'mapReadout', key: 'mapKey',
    geo: 'Orissa.geojson', nameField: 'Dist_Name',
    periods: ['2011', '2036'],
    bigMove: 8.5,
    pickHint: 'Tap a district, or choose one from the list.',
    hoverHint: 'Point at a district to see how much older it gets.',
    bins: [
      [14, '#fdf3cf', 'Under 14%'],
      [16, '#fbe39a', '14–16%'],
      [18, '#f7cd5e', '16–18%'],
      [20, '#e8a93a', '18–20%'],
      [Infinity, '#c47d1e', '20% or more']
    ],
    values: {
      'Angul': [9.02, 16.22],
      'Balangir': [10.7, 18.7],
      'Baleshwar': [9.2, 16.71],
      'Bargarh': [10.49, 18.82],
      'Bhadrak': [9.53, 17.39],
      'Boudh': [9.41, 16.56],
      'Cuttack': [10.66, 19.29],
      'Debagarh': [9.23, 16.41],
      'Dhenkanal': [10.27, 18.15],
      'Gajapati': [7.7, 13.92],
      'Ganjam': [9.68, 17.51],
      'Jagatsinghapur': [11.99, 21.51],
      'Jajapur': [10.18, 18.39],
      'Jharsuguda': [9.03, 16.56],
      'Kalahandi': [9.52, 16.92],
      'Kandhamal': [8.67, 15.0],
      'Kendrapara': [11.78, 21.13],
      'Kendujhar': [8.02, 14.37],
      'Khordha': [9.13, 16.62],
      'Koraput': [7.91, 13.68],
      'Malkangiri': [7.6, 12.99],
      'Mayurbhanj': [8.47, 15.33],
      'Nabarangapur': [7.38, 13.52],
      'Nayagarh': [11.83, 20.6],
      'Nuapada': [10.6, 17.84],
      'Puri': [10.95, 19.7],
      'Rayagada': [7.53, 13.47],
      'Sambalpur': [9.51, 17.04],
      'Subarnapur': [10.66, 18.82],
      'Sundargarh': [7.86, 14.08]
    }
  },

  signals: [
    { name: 'Care at home', terms: 'such as “home nurse”, “caretaker for elderly”', file: 'data/tectonics/s3-care-at-home.csv' },
    { name: 'Old-age homes', terms: 'such as “old age home”, “briddhashram”', file: 'data/tectonics/s3-old-age-homes.csv' },
    { name: 'Pensions', terms: 'such as “Madhu Babu pension”, “old age pension”', file: 'data/tectonics/s3-pensions.csv' },
    { name: 'Ailments of age', terms: 'such as “knee replacement”, “dementia”', file: 'data/tectonics/s3-ailments.csv' }
  ],

  callsKey: 'soochana-tectonics-s3-calls',
  calls: [
    {
      id: 'elders', name: 'Share of people aged 60+', survey: 1, surveyText: 'Survey: 13.4% → 15.6%',
      q: 'Searches for paid elder care (home nurses, old-age homes) will…',
      says: {
        '1': 'Care is becoming something families look for and pay for.',
        '0': 'More old people, no more searching. Families are absorbing it at home, unpaid and out of sight.',
        '-1': 'More old people, less searching. Care may be moving to other channels, such as government schemes.'
      }
    },
    {
      id: 'alone', name: 'Old people living alone', survey: 0, surveyText: 'NFHS: not reported',
      q: 'Searches about caring for parents from far away will…',
      says: {
        '1': 'Children who moved away are trying to care from a distance, before any survey has counted them.',
        '0': 'Neither plate moves, so there is nothing to see yet.',
        '-1': 'Interest is fading; perhaps families are moving back together.'
      }
    }
  ]
};
