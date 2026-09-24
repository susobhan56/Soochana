// LLM-output validator, story registry and voice helper tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Insight = require('./_load.js');
require('../storyteller/narration/prompt.js');
require('../storyteller/narration/voice.js');
require('../storyteller/stories/districts.js');
require('../storyteller/stories/registry.js');
const ST = globalThis.SoochanaStoryteller;
const { validateNarration } = ST.prompt;

const root = path.join(__dirname, '..');
const load = p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, p), 'utf8')));

function tfrEvidence() {
  const ds = {
    id: 'tfr', title: 'TFR', geography: { name: 'Koraput' }, source: { name: 'NFHS' },
    series: [{
      id: 'tfr', label: 'Total fertility rate', role: 'tfr', format: 'tfr', minChange: 0.1,
      references: [{ value: 2.1, label: 'replacement level' }],
      values: [{ x: 2016, label: '2015-16 (NFHS-4)', y: 2.14, status: 'computed' }, { x: 2020, y: 2.16, status: 'computed' },
               { x: 2026, y: 1.6, status: 'projected' }, { x: 2036, y: 1.21, status: 'projected' }]
    }]
  };
  return Insight.narrate.buildNarration(ds).evidence;
}

const good = {
  headline: 'Fertility heads below replacement',
  narration: 'Fertility in Koraput is projected to fall below the replacement level of about 2.1 children per woman, reaching around 1.21 by 2036 after holding near 2.16 in 2020.',
  importance: 'Below replacement, each generation of children is smaller than the one before.',
  key_points: ['Projected decline', 'Below replacement'],
  confidence: 'high'
};

test('validator accepts a faithful narration', () => {
  const r = validateNarration(good, tfrEvidence(), 'story');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.value.headline, 'Fertility heads below replacement');
});

test('validator rejects invented numbers', () => {
  const r = validateNarration(Object.assign({}, good, { narration: good.narration.replace('1.21', '0.95') }), tfrEvidence());
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => /0\.95/.test(e)));
});

test('validator rejects invented years', () => {
  const r = validateNarration(Object.assign({}, good, { narration: good.narration.replace('by 2036', 'by 2045') }), tfrEvidence());
  assert.equal(r.ok, false);
});

test('validator rejects causal claims', () => {
  const r = validateNarration(Object.assign({}, good, { narration: good.narration + ' This is due to better schooling for girls.' }), tfrEvidence());
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => /causal/.test(e)));
});

test('validator rejects markup and links', () => {
  assert.equal(validateNarration(Object.assign({}, good, { narration: '<b>' + good.narration + '</b>' }), tfrEvidence()).ok, false);
  assert.equal(validateNarration(Object.assign({}, good, { importance: 'See https://example.org' }), tfrEvidence()).ok, false);
});

test('validator requires projection language for a projected horizon', () => {
  const r = validateNarration(Object.assign({}, good, {
    narration: 'Fertility in Koraput falls below the replacement level of about 2.1 children per woman, reaching around 1.21 in 2036 after holding near 2.16 in 2020.'
  }), tfrEvidence());
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => /projection language/.test(e)));
});

test('validator rejects the "This graph shows" opening and missing fields', () => {
  assert.equal(validateNarration(Object.assign({}, good, { narration: 'This graph shows ' + good.narration }), tfrEvidence()).ok, false);
  assert.equal(validateNarration({ narration: good.narration }, tfrEvidence()).ok, false);
  assert.equal(validateNarration(null, tfrEvidence()).ok, false);
});

test('district names resolve across spellings', () => {
  const keys = ['Bolangir', 'Baleshwar', 'Debagarh', 'Jajapur', 'Kendujhar', 'Nabarangpur'];
  assert.equal(ST.districts.resolveKey('Balangir', keys), 'Bolangir');
  assert.equal(ST.districts.resolveKey('Balasore', keys), 'Baleshwar');
  assert.equal(ST.districts.resolveKey('Deogarh', keys), 'Debagarh');
  assert.equal(ST.districts.resolveKey('Jajpur', keys), 'Jajapur');
  assert.equal(ST.districts.resolveKey('Keonjhar', keys), 'Kendujhar');
  assert.equal(ST.districts.resolveKey('Nabarangapur', keys), 'Nabarangpur');
  assert.equal(ST.districts.resolveKey('Atlantis', keys), null);
});

test('every district story builds and narrates for all 30 districts', async () => {
  const districts = Object.keys(await load(ST.stories.PATHS.districtPopulation));
  assert.equal(districts.length, 30);
  const ids = ST.stories.list().filter(id => id.startsWith('district-'));
  for (const d of districts) {
    for (const id of ids) {
      const ds = await ST.stories.build(id, { geography: { level: 'district', id: d, name: d }, load });
      assert.ok(ds, `${id} for ${d}`);
      for (const mode of ['story', 'data']) {
        const n = Insight.narrate.buildNarration(ds, { mode });
        assert.doesNotMatch(n.narration, /undefined|NaN|null|n\/a/, `${id} ${d} ${mode}: ${n.narration}`);
        assert.ok(n.narration.split(/\s+/).length <= 110, `${id} ${d} ${mode} too long`);
        assert.ok(n.sourceLabel);
      }
    }
  }
});

test('district narration changes with the district', async () => {
  const build = d => ST.stories.build('district-tfr', { geography: { level: 'district', id: d, name: d }, load })
    .then(ds => Insight.narrate.buildNarration(ds).narration);
  const [a, b] = await Promise.all([build('Nabarangpur'), build('Khordha')]);
  assert.notEqual(a, b);
  assert.match(a, /above the replacement level/);
  assert.match(b, /below the replacement level/);
});

test('the state population story reads growth rates from the cleaned state rows', async () => {
  const rows = ST.stories.adapters.stateRows(await load('datasets/state_demographics.json'));
  assert.equal(rows[0].year, 1901);
  assert.equal(rows[rows.length - 1].year, 2036);
  assert.ok(rows.every((r, i) => i === 0 || r.year > rows[i - 1].year), 'appended junk rows are dropped');
});

test('growth rate derived from levels is labelled computed or projected, never observed', () => {
  const g = ST.stories.adapters.growthRateFromLevels([
    { x: 2001, y: 100, status: 'observed' }, { x: 2011, y: 110, status: 'observed' }, { x: 2021, y: 115, status: 'projected' }
  ]);
  assert.deepEqual(g.map(p => p.status), ['computed', 'projected']);
  assert.ok(Math.abs(g[0].y - 0.953) < 0.01);
});

test('speech is split into sentences', () => {
  assert.deepEqual(ST.splitSentences('One. Two! Three?').map(s => s.trim()), ['One.', 'Two!', 'Three?']);
});

test('the deterministic narrations pass the model-output validator (it is not over-strict)', async () => {
  const districts = ['Koraput', 'Khordha', 'Nabarangpur', 'Malkangiri', 'Cuttack'];
  const failures = [];
  for (const d of districts) {
    for (const id of ST.stories.list().filter(i => i.startsWith('district-'))) {
      const ds = await ST.stories.build(id, { geography: { level: 'district', id: d, name: d }, load });
      for (const mode of ['story', 'data']) {
        const n = Insight.narrate.buildNarration(ds, { mode });
        const r = validateNarration({ headline: n.headline, narration: n.narration, importance: n.importance || '', key_points: n.keyPoints, confidence: n.confidence }, n.evidence, mode);
        if (!r.ok) failures.push(`${d} ${id} ${mode}: ${r.errors.join('; ')}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test('page overview combines the charts on the page, in order, without causal claims', async () => {
  const ids = ['district-population', 'district-tfr', 'district-age-structure', 'district-sex-ratio', 'district-pyramid'];
  const list = [];
  for (const id of ids) {
    const ds = await ST.stories.build(id, { geography: { level: 'district', id: 'Koraput', name: 'Koraput' }, load });
    list.push(Insight.narrate.buildNarration(ds));
  }
  const o = Insight.narrate.buildOverview(list, { geography: 'Koraput' });
  assert.equal(o.headline, 'Koraput at a glance');
  assert.equal(o.links.length, 5);
  assert.deepEqual(o.links.map(l => l.storyId), ids);
  assert.match(o.narration, /^Koraput’s population keeps growing/);
  assert.match(o.narration, /demographic transition: slowing population growth, falling fertility and a gradually older population\.$/);
  assert.doesNotMatch(o.narration, /because|due to|caused|leads to/i);
  assert.equal(Insight.narrate.buildOverview([], {}), null);
});
