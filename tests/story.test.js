// Checks the home page story's figures (story.js compute) against the real
// data files, and that every number slot in index.html has a figure.
// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Story = require('../story.js');

const root = path.join(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));

function keyStats() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'data/key_stats.js'), 'utf8'), sandbox);
  return sandbox.window.SOOCHANA_KEY_STATS;
}

const state = read('datasets/state_demographics.json');
const learn = read('learn/data/districts.json');
const F = Story.compute({
  state,
  learn,
  pop: read('datasets/district_population_trends.json'),
  fert: read('datasets/district_fertility_trends.json'),
  nat: read('datasets/national_comparisons.json'),
  details: read('datasets/state_details.json'),
  keyStats: keyStats()
});

test('every data-f slot in index.html is filled by story.js', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const keys = [...html.matchAll(/data-f="([^"]+)"/g)].map(m => m[1]);
  assert.ok(keys.length > 40, 'found the story slots');
  const missing = keys.filter(k => F.T[k] == null);
  assert.deepEqual(missing, []);
});

test('the population line stops at the end of the real series', () => {
  // the file carries a second table after 2036 that restarts at 1901
  const years = F.series.map(d => d.year);
  assert.equal(years[0], 1901);
  assert.equal(years[years.length - 1], 2036);
  for (let i = 1; i < years.length; i++) assert.ok(years[i] > years[i - 1], 'years rise');
  assert.ok(F.series.every(d => d.total > 1e7), 'every point is a real state total');
});

test('dot counts always add up to 100', () => {
  for (const n of [F.rural, F.ageA.n, F.ageB.n]) {
    assert.equal(n.reduce((a, b) => a + b, 0), 100);
  }
  assert.deepEqual(Story.to100([1, 1, 1]).reduce((a, b) => a + b, 0), 100);
});

test('age shares match the 2021 pyramid', () => {
  const rows = state.pyramids['2021'].filter(r => /^\d+(-\d+|\+)$/.test(r.age));
  const total = rows.reduce((a, r) => a + r.total, 0);
  const elders = rows.filter(r => parseInt(r.age, 10) >= 60).reduce((a, r) => a + r.total, 0);
  assert.equal(F.ageA.total, total);
  assert.equal(F.ageA.n[2], Math.round(elders / total * 100));
});

test('the map extremes are the real highest and lowest districts', () => {
  const by = k => learn.districts.slice().sort((a, b) => b.f[k] - a.f[k]);
  assert.ok(F.T.litMax.startsWith(by('literacy')[0].name));
  assert.ok(F.T.litMin.startsWith(by('literacy').at(-1).name));
  assert.ok(F.T.stLow.startsWith(by('tribal_pct').at(-1).name));
});

test('fertility counts use the projection years, not the NFHS-4 column', () => {
  assert.equal(F.tfrA, '2020');
  assert.equal(F.tfrB, '2036');
  const fert = read('datasets/district_fertility_trends.json');
  const above = Object.values(fert).filter(d => d['2020'] > 2.1).length;
  assert.equal(F.T.tfrAboveA, String(above));
});
