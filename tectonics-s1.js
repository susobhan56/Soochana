/* ═══════════════════════════════════════════════════════════════════
   TECTONICS · story 1, "Online, but unprotected?" (tectonics.html)
   The story's numbers and words; tectonics.js draws them. Every
   official value is NFHS-5 (2019–21) → NFHS-6 (2023–24) for Odisha,
   the same values as district-health.html.
   ═══════════════════════════════════════════════════════════════════ */
window.TK_STORY = {
  number: 1,

  /* guess-first islands of a hundred, keyed by data-guess */
  guesses: {
    online: {
      island: 'islandOnline', key: 'keyOnline', input: 'guessOnline',
      was: 24.9, now: 51.8,
      keyRevealed: [
        ['var(--tk-record)', 'Online by 2019–21'],
        ['var(--tk-land)', 'Came online by 2023–24'],
        ['rgba(255,255,255,0.14)', 'Never online']
      ]
    },
    methods: {
      island: 'islandMethods', key: 'keyMethods', input: 'guessMethods',
      was: 48.8, now: 40.8,
      keyRevealed: [
        ['var(--tk-record)', 'Using a modern method, 2023–24'],
        ['var(--tk-lost)', 'Fewer users than in 2019–21'],
        ['rgba(255,255,255,0.14)', 'No modern method']
      ]
    }
  },

  slope: {
    max: 80,
    rows: [
      { name: 'Married women using any method', short: 'Any method', was: 74.1, now: 66.2, color: '#f9d5bf' },
      { name: 'Women who have used the internet', short: 'Women online', was: 24.9, now: 51.8, color: '#9fd3f0' },
      { name: 'Married women using a modern method', short: 'Modern method', was: 48.8, now: 40.8, color: '#f08a4b' },
      { name: 'Women 20–24 married before 18', short: 'Married before 18', was: 20.5, now: 18.6, color: 'rgba(255,255,255,0.7)' },
      { name: 'Unmet need for spacing', short: 'Unmet need, spacing', was: 2.6, now: 4.7, color: '#f4c534' }
    ]
  },

  /* one Google Trends export per search group (see data/tectonics/README.md) */
  signals: [
    { name: 'Emergency pills', terms: 'such as “i-pill”, “unwanted 72”', file: 'data/tectonics/s1-emergency-pills.csv' },
    { name: 'Pregnancy worries', terms: 'such as “pregnancy test”, “period late”', file: 'data/tectonics/s1-pregnancy-worries.csv' },
    { name: 'Side effects', terms: 'such as “Copper-T side effects”', file: 'data/tectonics/s1-side-effects.csv' },
    { name: 'Delaying a child', terms: 'such as “how to avoid pregnancy”', file: 'data/tectonics/s1-delaying.csv' }
  ],

  /* the reader's calls at the collision; survey is the record's direction */
  callsKey: 'soochana-tectonics-s1-calls',
  calls: [
    {
      id: 'modern', name: 'Modern contraceptive use', survey: -1, surveyText: 'Survey: 48.8% → 40.8%',
      q: 'Search interest in contraception will…',
      says: {
        '1': 'Interest rises while use falls. People may be looking for something they are not getting.',
        '0': 'Use falls and no one searches. The change would be happening offline.',
        '-1': 'Interest and use fall together. Contraception would be slipping out of mind.'
      }
    },
    {
      id: 'spacing', name: 'Unmet need for spacing', survey: 1, surveyText: 'Survey: 2.6% → 4.7%',
      q: 'Searches about delaying a pregnancy will…',
      says: {
        '1': 'More women want to wait, and they go online to find out how.',
        '0': 'The wish to wait grows quietly, away from search.',
        '-1': 'The need rises while searches fall. The questions may be going elsewhere: friends, chemists, ASHAs.'
      }
    }
  ]
};
