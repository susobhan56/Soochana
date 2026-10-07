/* ═══════════════════════════════════════════════════════════════════
   TECTONICS · story 2, "When does youth want to marry?"
   (tectonics-marriage.html). The story's numbers and words;
   tectonics.js draws them. Official values are NFHS-5 (2019–21) →
   NFHS-6 (2023–24) for Odisha and its districts, the same values as
   district-health.html. District names follow Orissa.geojson
   (Angul = Anugul, Debagarh = Deogarh, Nabarangapur = Nabarangpur,
   Subarnapur = Sonepur).
   ═══════════════════════════════════════════════════════════════════ */
window.TK_STORY = {
  number: 2,

  guesses: {
    brides: {
      island: 'islandBrides', key: 'keyBrides', input: 'guessBrides',
      was: 20.5, now: 18.6,
      keyRevealed: [
        ['var(--tk-concern)', 'Married before 18, 2023–24'],
        ['var(--tk-land)', 'Fewer than in 2019–21'],
        ['rgba(255,255,255,0.14)', 'Married at 18 or later']
      ],
      /* a share that should fall: colour it as the concern, and a fall
         as new land */
      tone: 'concern'
    },
    grooms: {
      island: 'islandGrooms', key: 'keyGrooms', input: 'guessGrooms',
      was: 13.3, now: 12.5,
      keyRevealed: [
        ['var(--tk-concern)', 'Married before 21, 2023–24'],
        ['rgba(255,255,255,0.14)', 'Married at 21 or later']
      ],
      tone: 'concern'
    }
  },

  /* women aged 20–24 married before 18, by district: [NFHS-5, NFHS-6] */
  map: {
    svg: 'tkMap', select: 'mapPick', readout: 'mapReadout', key: 'mapKey',
    geo: 'Orissa.geojson', nameField: 'Dist_Name',
    bigMove: 5,
    pickHint: 'Tap a district, or choose one from the list.',
    hoverHint: 'Point at a district to see how it moved.',
    bins: [
      [10, '#fbe7cf', 'Under 10%'],
      [15, '#f7c99a', '10–15%'],
      [20, '#f2a766', '15–20%'],
      [25, '#e57f3d', '20–25%'],
      [30, '#c9552a', '25–30%'],
      [Infinity, '#9c3320', '30% or more']
    ],
    values: {
      'Angul': [25.0, 30.2],
      'Balangir': [14.0, 14.8],
      'Baleshwar': [26.4, 23.0],
      'Bargarh': [8.6, 14.9],
      'Bhadrak': [10.4, 13.1],
      'Boudh': [25.3, 15.0],
      'Cuttack': [14.2, 12.7],
      'Debagarh': [19.2, 14.3],
      'Dhenkanal': [23.7, 24.0],
      'Gajapati': [28.1, 18.7],
      'Ganjam': [22.3, 18.0],
      'Jagatsinghapur': [12.0, 12.5],
      'Jajapur': [11.4, 11.0],
      'Jharsuguda': [8.5, 9.7],
      'Kalahandi': [16.3, 13.6],
      'Kandhamal': [20.0, 19.8],
      'Kendrapara': [9.4, 11.6],
      'Kendujhar': [29.0, 22.6],
      'Khordha': [17.1, 13.2],
      'Koraput': [35.5, 20.9],
      'Malkangiri': [32.4, 33.1],
      'Mayurbhanj': [31.3, 26.9],
      'Nabarangapur': [39.4, 27.1],
      'Nayagarh': [35.7, 25.0],
      'Nuapada': [15.6, 12.5],
      'Puri': [10.2, 12.1],
      'Rayagada': [33.2, 34.0],
      'Sambalpur': [7.4, 10.4],
      'Subarnapur': [16.9, 12.3],
      'Sundargarh': [12.9, 12.8]
    }
  },

  slope: {
    max: 60,
    rows: [
      { name: 'Women who have used the internet', short: 'Women online', was: 24.9, now: 51.8, color: '#9fd3f0' },
      { name: 'Women with 10+ years of school', short: 'Women, 10+ yrs school', was: 33.0, now: 43.9, color: '#8fd19e' },
      { name: 'Women 20–24 married before 18', short: 'Married before 18', was: 20.5, now: 18.6, color: '#f08a4b' },
      { name: 'Men 25–29 married before 21', short: 'Men married before 21', was: 13.3, now: 12.5, color: '#f9d5bf' },
      { name: 'Girls 15–19 already mothers or pregnant', short: 'Teen mothers', was: 7.5, now: 6.5, color: '#f4c534' }
    ]
  },

  signals: [
    { name: 'Finding a match', terms: 'such as “Odia matrimony”, “bride for marriage”', file: 'data/tectonics/s2-matrimony.csv' },
    { name: 'Love and court marriage', terms: 'such as “love marriage”, “court marriage”', file: 'data/tectonics/s2-love-court.csv' },
    { name: 'The legal age', terms: 'such as “marriage age for girls”, “child marriage”', file: 'data/tectonics/s2-legal-age.csv' },
    { name: 'Paying for a wedding', terms: 'such as “marriage loan”, “wedding cost”', file: 'data/tectonics/s2-wedding-costs.csv' }
  ],

  callsKey: 'soochana-tectonics-s2-calls',
  calls: [
    {
      id: 'early', name: 'Women married before 18', survey: -1, surveyText: 'Survey: 20.5% → 18.6%',
      q: 'Searches about child marriage and the legal age will…',
      says: {
        '1': 'Talk rises while the practice falls. Awareness may be spreading, or some marriages may be hidden from the survey.',
        '0': 'The practice falls quietly, with no one searching. The change is offline: schools, families, local officials.',
        '-1': 'The practice and the talk fade together.'
      }
    },
    {
      id: 'choice', name: 'Marrying by choice', survey: 0, surveyText: 'Survey: not measured',
      q: 'Searches about love and court marriage will…',
      says: {
        '1': 'Choice is moving before any survey can see it.',
        '0': 'Neither plate moves, so there is nothing to see yet.',
        '-1': 'Interest in choosing a partner is fading, and no survey would have noticed.'
      }
    }
  ]
};
