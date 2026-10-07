/* ═══════════════════════════════════════════════════════════════════
   TECTONICS · story 3, "The ageing aftershock" (tectonics-ageing.html)
   The story's numbers and words; tectonics.js draws them.
   - Share aged 60+: NFHS-5 → NFHS-6 for Odisha (household members).
   - Age pyramid: Census 1991 and 2011, projections 2021–2036, from
     datasets/Age_wise_Odisha_population_1951-2036.xlsx as listed in the
     portal data book (state age–sex pyramids), in lakh.
   - Districts: share aged 60+, Census 2011 and DIU's Bayesian projection
     for 2036 (datasets/district_age_pyramids.json, via hero_data.js).
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
      2021: [18.694, 17.674, 18.372, 20.699, 21.890, 19.621, 18.574, 17.532, 15.165, 14.873, 13.242, 11.184, 8.376, 5.973, 5.212, 2.893, 2.681],
      2026: [18.909, 18.424, 17.613, 18.327, 20.635, 21.807, 19.528, 18.454, 17.356, 14.918, 14.458, 12.625, 10.327, 7.366, 4.889, 3.853, 3.081],
      2031: [18.024, 18.673, 18.368, 17.575, 18.277, 20.565, 21.715, 19.415, 18.287, 17.097, 14.530, 13.819, 11.700, 9.129, 6.081, 3.650, 3.880],
      2036: [16.827, 17.834, 18.625, 18.334, 17.533, 18.223, 20.489, 21.604, 19.257, 18.036, 16.685, 13.927, 12.853, 10.396, 7.591, 4.594, 4.221]
    },
    female: {
      1991: [17.828, 20.348, 17.794, 15.340, 14.072, 13.332, 10.703, 9.562, 7.672, 6.954, 5.994, 4.407, 4.541, 2.593, 2.188, 0.857, 1.099],
      2011: [17.749, 19.894, 21.451, 19.527, 19.126, 18.012, 15.608, 15.225, 13.036, 11.217, 8.903, 7.394, 7.364, 4.917, 3.874, 1.815, 1.931],
      2021: [18.465, 17.411, 17.352, 19.718, 21.287, 19.399, 18.962, 17.822, 15.377, 14.905, 12.606, 10.609, 8.095, 6.285, 5.617, 3.191, 2.784],
      2026: [18.746, 18.223, 17.359, 17.313, 19.665, 21.219, 19.324, 18.864, 17.690, 15.204, 14.630, 12.211, 10.041, 7.373, 5.376, 4.370, 3.353],
      2031: [17.938, 18.536, 18.179, 17.330, 17.276, 19.614, 21.151, 19.239, 18.742, 17.512, 14.949, 14.205, 11.601, 9.196, 6.366, 4.231, 4.405],
      2036: [16.769, 17.764, 18.495, 18.150, 17.296, 17.236, 19.557, 21.067, 19.126, 18.569, 17.241, 14.545, 13.539, 10.678, 8.000, 5.077, 4.935]
    }
  },

  /* each age group against its own size in 2011 (= 100) */
  slope: {
    max: 250,
    decimals: 0,
    sameStart: true,
    axis: ['2011 = 100', '2036'],
    rows: [
      { name: 'Aged 80 and over', short: '80 and over', was: 100, now: 230, color: '#f9dd7f' },
      { name: 'Aged 60–79', short: '60–79', was: 100, now: 203, color: '#f4c534' },
      { name: 'Working age, 15–59', short: '15–59', was: 100, now: 127, color: '#9fd3f0' },
      { name: 'Children, 0–14', short: '0–14', was: 100, now: 88, color: '#f08a4b' }
    ]
  },

  /* share aged 60+, by district: [Census 2011, projected 2036] */
  map: {
    svg: 'tkMap', select: 'mapPick', readout: 'mapReadout', key: 'mapKey',
    geo: 'Orissa.geojson', nameField: 'Dist_Name',
    periods: ['2011', '2036'],
    bigMove: 7,
    pickHint: 'Tap a district, or choose one from the list.',
    hoverHint: 'Point at a district to see how much older it gets.',
    bins: [
      [14, '#fdf3cf', 'Under 14%'],
      [15, '#fbe39a', '14–15%'],
      [16, '#f7cd5e', '15–16%'],
      [17, '#e8a93a', '16–17%'],
      [Infinity, '#c47d1e', '17% or more']
    ],
    values: {
      'Angul': [9.02, 15.93],
      'Balangir': [10.7, 16.11],
      'Baleshwar': [9.2, 15.61],
      'Bargarh': [10.49, 17.15],
      'Bhadrak': [9.53, 15.36],
      'Boudh': [9.41, 14.89],
      'Cuttack': [10.66, 17.49],
      'Debagarh': [9.23, 15.5],
      'Dhenkanal': [10.27, 16.72],
      'Gajapati': [7.7, 14.15],
      'Ganjam': [9.68, 15.58],
      'Jagatsinghapur': [11.99, 17.94],
      'Jajapur': [10.18, 15.79],
      'Jharsuguda': [9.03, 16.2],
      'Kalahandi': [9.52, 15.88],
      'Kandhamal': [8.67, 14.12],
      'Kendrapara': [11.78, 16.27],
      'Kendujhar': [8.02, 15.12],
      'Khordha': [9.13, 17.34],
      'Koraput': [7.91, 14.46],
      'Malkangiri': [7.6, 12.86],
      'Mayurbhanj': [8.47, 15.33],
      'Nabarangapur': [7.38, 13.5],
      'Nayagarh': [11.83, 17.43],
      'Nuapada': [10.6, 16.11],
      'Puri': [10.95, 17.51],
      'Rayagada': [7.53, 14.38],
      'Sambalpur': [9.51, 16.68],
      'Subarnapur': [10.66, 15.31],
      'Sundargarh': [7.86, 15.73]
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
