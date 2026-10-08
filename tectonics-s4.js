/* ═══════════════════════════════════════════════════════════════════
   TECTONICS · story 4, "Covered, but connected?" (tectonics-health.html)
   The story's numbers and words; tectonics.js draws them. Official
   values are NFHS-5 (2019–21) → NFHS-6 (2023–24) for Odisha and its
   districts, the same values as district-health.html.
   ═══════════════════════════════════════════════════════════════════ */
window.TK_STORY = {
  number: 4,

  guesses: {
    cover: {
      island: 'islandCover', key: 'keyCover', input: 'guessCover',
      was: 47.9, now: 82.7,
      keyRevealed: [
        ['var(--tk-record)', 'Covered in 2019–21'],
        ['var(--tk-land)', 'Newly covered by 2023–24'],
        ['rgba(255,255,255,0.14)', 'No member covered']
      ]
    },
    sugar: {
      island: 'islandSugar', key: 'keySugar', input: 'guessSugar',
      was: 17.0, now: 26.6,
      keyRevealed: [
        ['var(--tk-concern)', 'High blood sugar in 2019–21'],
        ['var(--tk-worse)', 'More by 2023–24'],
        ['rgba(255,255,255,0.14)', 'Normal blood sugar']
      ],
      tone: 'concern'
    }
  },

  slope: {
    max: 90,
    rows: [
      { name: 'Households with health cover', short: 'Health cover', was: 47.9, now: 82.7, color: '#9fd3f0' },
      { name: 'Births in a public facility', short: 'Public-facility births', was: 78.7, now: 75.0, color: '#8fd19e' },
      { name: 'Births by caesarean section', short: 'Caesarean births', was: 21.6, now: 29.4, color: '#f08a4b' },
      { name: 'Women overweight or obese', short: 'Women overweight', was: 23.0, now: 29.7, color: '#f9d5bf' },
      { name: 'Men with high blood sugar', short: 'Men, high sugar', was: 17.0, now: 26.6, color: '#f4c534' }
    ]
  },

  /* households with any member covered by a health scheme, by district:
     [NFHS-5, NFHS-6]; the reader hunts for the least covered */
  map: {
    svg: 'tkMap', select: 'mapPick', readout: 'mapReadout', key: 'mapKey',
    geo: 'Orissa.geojson', nameField: 'Dist_Name',
    rank: 'low',
    bigMove: 42,
    arrowScale: 1.3,
    pickHint: 'Tap a district, or choose one from the list.',
    hoverHint: 'Point at a district to see how its cover moved.',
    bins: [
      [76, '#fde3cf', 'Under 76%'],
      [80, '#cfe8f8', '76–80%'],
      [84, '#9fd3f0', '80–84%'],
      [87, '#5fb6ec', '84–87%'],
      [Infinity, '#1f78c1', '87% or more']
    ],
    values: {
      'Angul': [63.1, 83.6],
      'Balangir': [44.0, 88.1],
      'Baleshwar': [40.6, 84.0],
      'Bargarh': [45.5, 85.6],
      'Bhadrak': [44.9, 85.5],
      'Boudh': [44.7, 87.6],
      'Cuttack': [42.3, 76.5],
      'Debagarh': [57.5, 87.5],
      'Dhenkanal': [55.2, 84.2],
      'Gajapati': [39.6, 88.3],
      'Ganjam': [51.9, 82.7],
      'Jagatsinghapur': [56.8, 84.9],
      'Jajapur': [53.9, 85.5],
      'Jharsuguda': [37.7, 76.0],
      'Kalahandi': [48.6, 85.0],
      'Kandhamal': [54.5, 88.4],
      'Kendrapara': [50.0, 82.6],
      'Kendujhar': [43.3, 81.8],
      'Khordha': [43.2, 71.9],
      'Koraput': [54.6, 86.3],
      'Malkangiri': [47.0, 85.2],
      'Mayurbhanj': [46.5, 79.4],
      'Nabarangapur': [48.4, 89.6],
      'Nayagarh': [49.3, 86.2],
      'Nuapada': [45.3, 87.1],
      'Puri': [61.5, 81.3],
      'Rayagada': [45.5, 86.4],
      'Sambalpur': [49.3, 77.2],
      'Subarnapur': [45.8, 84.7],
      'Sundargarh': [39.3, 76.9]
    },
    layers: {
      sugar: {
        label: 'of women aged 15+ have high blood sugar or take medicine for it (2023–24)',
        bins: [
          [16, '#fdf3cf', 'Under 16%'],
          [20, '#f7cd5e', '16–20%'],
          [24, '#f2a766', '20–24%'],
          [28, '#e57f3d', '24–28%'],
          [Infinity, '#b4441f', '28% or more']
        ],
        values: { 'Angul': 24.6, 'Balangir': 19.2, 'Baleshwar': 24.8, 'Bargarh': 20.1, 'Bhadrak': 22.9, 'Boudh': 19.7, 'Cuttack': 30.4, 'Debagarh': 19.7, 'Dhenkanal': 24.9, 'Gajapati': 15.8, 'Ganjam': 20.7, 'Jagatsinghapur': 27.9, 'Jajapur': 20.9, 'Jharsuguda': 22.8, 'Kalahandi': 18.6, 'Kandhamal': 14.5, 'Kendrapara': 23.0, 'Kendujhar': 17.5, 'Khordha': 27.8, 'Koraput': 14.0, 'Malkangiri': 17.6, 'Mayurbhanj': 19.6, 'Nabarangapur': 14.4, 'Nayagarh': 22.9, 'Nuapada': 17.9, 'Puri': 27.7, 'Rayagada': 14.8, 'Sambalpur': 20.6, 'Subarnapur': 26.1, 'Sundargarh': 21.4 }
      }
    }
  },

  signals: [
    { name: 'Using the card', terms: 'such as “BSKY card”, “Ayushman card hospital list”', file: 'data/tectonics/s4-health-card.csv' },
    { name: 'Private hospitals', terms: 'such as “best hospital in Bhubaneswar”, “hospital near me”', file: 'data/tectonics/s4-private-hospitals.csv' },
    { name: 'Diabetes', terms: 'such as “sugar test”, “diabetes diet”', file: 'data/tectonics/s4-diabetes.csv' },
    { name: 'Caesarean births', terms: 'such as “caesarean delivery cost”, “normal delivery hospital”', file: 'data/tectonics/s4-caesarean.csv' }
  ],

  callsKey: 'soochana-tectonics-s4-calls',
  calls: [
    {
      id: 'cover', name: 'Households with health cover', survey: 1, surveyText: 'Survey: 47.9% → 82.7%',
      q: 'Searches about using a health card (which hospitals take it) will…',
      says: {
        '1': 'People are learning to use the cover, not just to hold it.',
        '0': 'Cover on paper, not in mind: cards held but never looked up.',
        '-1': 'More cards, fewer questions. People may already know how to use them, or have given up asking.'
      }
    },
    {
      id: 'sugar', name: 'High blood sugar', survey: 1, surveyText: 'Survey (men): 17.0% → 26.6%',
      q: 'Searches about diabetes will…',
      says: {
        '1': 'People are noticing the disease spreading among them.',
        '0': 'Diabetes spreads quietly. If no one searches, many may not know they have it.',
        '-1': 'More diabetes, fewer questions: a disease growing out of sight.'
      }
    }
  ]
};
