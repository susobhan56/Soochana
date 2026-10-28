/* ═══════════════════════════════════════════════════════════════════
   TECTONICS · story 5, "Leaving home" (tectonics-migration.html)
   The story's numbers and words; tectonics.js draws them. Sources, all
   in excel/Migration and Urbanization.xlsx and DIU's migration notes:
   Census 1991–2011, NSS 64th round (2007–08), PLFS 2020–21, and the
   CMLS–Aajeevika Bureau field survey (2014) quoted in those notes.
   ═══════════════════════════════════════════════════════════════════ */
window.TK_STORY = {
  number: 5,

  guesses: {
    returning: {
      island: 'islandReturn', key: 'keyReturn', input: 'guessReturn',
      was: 24.3, now: 66.5,
      keyRevealed: [
        ['var(--tk-record)', 'Returning Odias, 2007–08'],
        ['var(--tk-land)', 'More returning by 2020–21'],
        ['rgba(255,255,255,0.14)', 'Newcomers from other states']
      ]
    }
  },

  slope: {
    max: 90,
    axis: ['NSS · 2007–08', 'PLFS · 2020–21'],
    rows: [
      { name: 'Returning Odias, in-migrants to villages', short: 'Returning, villages', was: 44.3, now: 83.4, color: '#8fd19e' },
      { name: 'Male out-migrants in salaried jobs', short: 'Salaried, men leaving', was: 56.4, now: 70.9, color: '#9fd3f0' },
      { name: 'Returning Odias, all in-migrants', short: 'Returning, all', was: 24.3, now: 66.5, color: '#5fb6ec' },
      { name: 'Town out-migrants with a degree', short: 'Degree, town leavers', was: 25.9, now: 40.3, color: '#f4c534' },
      { name: 'Share of Odisha living in another state', short: 'Living in another state', was: 2.9, now: 2.2, color: '#f08a4b' }
    ]
  },

  /* share of people living in towns, Census 2011; the reader hunts for
     the least urban district. One figure per district (single). */
  map: {
    svg: 'tkMap', select: 'mapPick', readout: 'mapReadout', key: 'mapKey',
    geo: 'Orissa.geojson', nameField: 'Dist_Name',
    rank: 'low',
    single: true,
    periods: ['2011', '2011'],
    pickHint: 'Tap a district, or choose one from the list.',
    hoverHint: 'Point at a district to see how urban it is.',
    bins: [
      [8, '#fde3cf', 'Under 8%'],
      [12, '#cfe8f8', '8–12%'],
      [16, '#9fd3f0', '12–16%'],
      [25, '#5fb6ec', '16–25%'],
      [Infinity, '#1f78c1', '25% or more']
    ],
    values: {
      'Angul': [16.2, 16.2],
      'Balangir': [12.0, 12.0],
      'Baleshwar': [10.9, 10.9],
      'Bargarh': [10.1, 10.1],
      'Bhadrak': [12.3, 12.3],
      'Boudh': [4.6, 4.6],
      'Cuttack': [28.0, 28.0],
      'Debagarh': [7.2, 7.2],
      'Dhenkanal': [9.9, 9.9],
      'Gajapati': [12.2, 12.2],
      'Ganjam': [21.8, 21.8],
      'Jagatsinghapur': [10.2, 10.2],
      'Jajapur': [7.4, 7.4],
      'Jharsuguda': [39.9, 39.9],
      'Kalahandi': [7.7, 7.7],
      'Kandhamal': [9.9, 9.9],
      'Kendrapara': [5.8, 5.8],
      'Kendujhar': [14.0, 14.0],
      'Khordha': [48.2, 48.2],
      'Koraput': [16.4, 16.4],
      'Malkangiri': [8.1, 8.1],
      'Mayurbhanj': [7.7, 7.7],
      'Nabarangapur': [7.2, 7.2],
      'Nayagarh': [8.3, 8.3],
      'Nuapada': [5.6, 5.6],
      'Puri': [15.6, 15.6],
      'Rayagada': [15.2, 15.2],
      'Sambalpur': [29.6, 29.6],
      'Subarnapur': [8.2, 8.2],
      'Sundargarh': [35.3, 35.3]
    },
    layers: {
      urgd: {
        label: 'a year: urban growth minus rural growth, 2001–11',
        unit: ' points',
        signed: true,
        bins: [
          [0, '#f08a4b', 'Towns grew slower than villages'],
          [1, '#f6c58f', 'Towns ahead by under 1 point'],
          [2, '#cfe8f8', '1–2 points'],
          [Infinity, '#5fb6ec', '2 points or more']
        ],
        values: { 'Angul': 1.8, 'Balangir': 0.4, 'Baleshwar': 0.0, 'Bargarh': 3.0, 'Bhadrak': 1.7, 'Boudh': -0.4, 'Cuttack': 0.3, 'Debagarh': -0.2, 'Dhenkanal': 1.4, 'Gajapati': 2.1, 'Ganjam': 2.6, 'Jagatsinghapur': 0.4, 'Jajapur': 5.3, 'Jharsuguda': 1.5, 'Kalahandi': 0.3, 'Kandhamal': 4.0, 'Kendrapara': 0.2, 'Kendujhar': 0.3, 'Khordha': 2.1, 'Koraput': -0.3, 'Malkangiri': 1.8, 'Mayurbhanj': 1.0, 'Nabarangapur': 2.3, 'Nayagarh': 7.0, 'Nuapada': -0.2, 'Puri': 1.6, 'Rayagada': 1.0, 'Sambalpur': 1.2, 'Subarnapur': 1.1, 'Sundargarh': 0.4 }
      }
    }
  },

  signals: [
    { name: 'Jobs far away', terms: 'such as “jobs in Surat”, “Kerala job”', file: 'data/tectonics/s5-jobs-away.csv' },
    { name: 'Advances and contractors', terms: 'such as “dadan”, “labour contractor”', file: 'data/tectonics/s5-dadan.csv' },
    { name: 'Trains out', terms: 'such as “train to Surat”, “tatkal ticket”', file: 'data/tectonics/s5-trains.csv' },
    { name: 'Jobs at home', terms: 'such as “jobs in Bhubaneswar”, “Odisha job”', file: 'data/tectonics/s5-jobs-home.csv' }
  ],

  callsKey: 'soochana-tectonics-s5-calls',
  calls: [
    {
      id: 'return', name: 'Odias coming home', survey: 1, surveyText: 'Survey: 24.3% → 66.5% of in-migrants',
      q: 'Searches for jobs inside Odisha will…',
      says: {
        '1': 'People are coming home and looking for work here.',
        '0': 'They come home, but not to search: work found through family and contractors, offline.',
        '-1': 'More come home, fewer look for local work. Many may be planning to leave again.'
      }
    },
    {
      id: 'seasonal', name: 'Leaving for the season', survey: 0, surveyText: 'Last official count: 2007–08',
      q: 'Searches for work outside Odisha after the harvest will…',
      says: {
        '1': 'Seasonal departures are growing, and no official count is watching.',
        '0': 'Neither plate moves, so there is nothing to see yet.',
        '-1': 'Fewer people are leaving each season, before any survey can confirm it.'
      }
    }
  ]
};
