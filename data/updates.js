/**
 * data/updates.js — the "What's new" feed (the bell in every page header).
 *
 * ADD AN ENTRY whenever something new goes on the portal: a feature, a page,
 * a report, a dataset, an article, a Learn lesson, a data refresh. Newest
 * first is easiest to read, but the feed sorts by date anyway.
 *
 *   id     unique and permanent. Never reuse or rename one: a reader's
 *          "already seen" list is kept by id.
 *   date   YYYY-MM-DD, the day it went live. Entries younger than 30 days
 *          count as new: they get a badge on the bell, a dot on the matching
 *          header link, and the newest one a short pop-up on the next visit.
 *   type   feature | report | dataset | article | learn | data
 *   title  a few words.
 *   text   one sentence: what a reader can now do.
 *   href   where it lives, relative to the site root (no leading slash).
 *   action optional. "chat" opens the Soochana Assistant instead of a page.
 *
 * Reports, datasets and theme articles do NOT need an entry here. whatsnew.js
 * reads data/reports.json, data/datasets.json and data/contents.json too:
 * give the item an "added": "YYYY-MM-DD" field there (or bump its
 * "lastUpdated") and it shows up in the feed, and as a "New" ribbon on its
 * card, for 30 days.
 */
window.SOOCHANA_UPDATES = [
  {
    id: 'tectonics-story-3',
    date: '2026-10-07',
    type: 'feature',
    title: 'Tectonics: "The ageing aftershock"',
    text: 'Story 3 plays Odisha’s age pyramid from 1991 to 2036 and maps which districts will grow old first.',
    href: 'tectonics-ageing.html'
  },
  {
    id: 'tectonics-story-2',
    date: '2026-10-07',
    type: 'feature',
    title: 'Tectonics: "When does youth want to marry?"',
    text: 'Story 2 maps marriage before 18 across all 30 districts: guess the highest, then see which districts moved and which way.',
    href: 'tectonics-marriage.html'
  },
  {
    id: 'tectonics-story-1',
    date: '2026-10-07',
    type: 'feature',
    title: 'Tectonics: "Online, but unprotected?"',
    text: 'A new story segment that sets the NFHS record against what people search for. Story 1: women online, contraception and unmet need in Odisha.',
    href: 'tectonics.html'
  },
  {
    id: 'learn-how-we-measure',
    date: '2026-10-05',
    type: 'learn',
    title: 'Learn: "How we measure"',
    text: 'Six plain-language lessons on where the numbers come from, fertility, life expectancy, age structure and projections.',
    href: 'learn/index.html#trackM'
  },
  {
    id: 'printable-report',
    date: '2026-10-05',
    type: 'report',
    title: 'A printable Odisha report',
    text: 'One document of the whole home page, with a chart for every module. Save it as a PDF or print it.',
    href: 'report.html'
  },
  {
    id: 'story-100-people',
    date: '2026-10-05',
    type: 'feature',
    title: 'Odisha, told in 100 people',
    text: 'A six-chapter scroll story: growth, falling fertility, ageing and the thirty districts, drawn in 100 dots.',
    href: 'index.html#story'
  },
  {
    id: 'state-dossier',
    date: '2026-10-05',
    type: 'feature',
    title: 'The state dashboard, as a guided dossier',
    text: 'Twenty modules on Odisha, each with its chart. Click a district on the map to open its profile.',
    href: 'index.html#dashboard'
  },
  {
    id: 'assistant-district-data',
    date: '2026-09-30',
    type: 'feature',
    title: 'Ask the Soochana Assistant',
    text: 'Chat with the district data: compare two districts, rank an indicator, follow a trend.',
    href: 'index.html',
    action: 'chat'
  },
  {
    id: 'learn-machine-learning',
    date: '2026-09-29',
    type: 'learn',
    title: 'Soochana Learn: machine learning',
    text: 'Interactive explainers, from decision trees to neural networks, run on the district data.',
    href: 'learn/index.html#trackML'
  },
  {
    id: 'guided-tour',
    date: '2026-09-25',
    type: 'feature',
    title: 'A guided tour of Odisha',
    text: 'Seven decades of change, one chapter at a time.',
    href: 'explore.html'
  },
  {
    id: 'district-health-revised',
    date: '2026-09-23',
    type: 'data',
    title: 'District health analysis, revised',
    text: 'NFHS indicators for every district: compare two places, urban and rural, women and men.',
    href: 'district-health.html'
  }
];
