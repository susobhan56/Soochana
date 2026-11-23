// Checks "A walk through care" (care-path.js) on district-health.html: every
// stop finds exactly one indicator in the district fact-sheet file, and the
// figures it reads match the state fact sheet.
// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Path = require('../care-path.js');

const root = path.join(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));

const cfg = { paths: Path.PATHS };
const data = read(Path.DATA);
const state = read('datasets/nfhs6_state_factsheet.json');

test('two paths of six stops each, wired into district-health.html', () => {
  assert.deepEqual(Array.from(cfg.paths, p => p.stops.length), [6, 6]);
  const dh = fs.readFileSync(path.join(root, 'district-health.html'), 'utf8');
  assert.match(dh, /id="carewalk"/);
  assert.match(dh, /id="cpPath"/);
  assert.match(dh, /care-path\.js/);
});

test('every stop matches exactly one indicator', () => {
  for (const p of cfg.paths) {
    for (const s of p.stops) {
      assert.equal(Path.findRows(data, s.match).length, 1, s.match);
    }
  }
});

test('Odisha figures match the state fact sheet, both rounds', () => {
  const v6 = Path.valuesFor(data, cfg, 'odisha', 6);
  const v5 = Path.valuesFor(data, cfg, 'odisha', 5);
  cfg.paths.forEach((p, i) => p.stops.forEach((s, k) => {
    const hits = state.indicators.filter(r => r.indicator.indexOf(s.match) === 0 &&
      (s.match !== 'Institutional births' || /^Institutional births \(%\)$/.test(r.indicator)));
    assert.equal(hits.length, 1, s.match);
    assert.equal(v6[i][k], hits[0].odisha.nfhs6, s.match);
    assert.equal(v5[i][k], hits[0].odisha.nfhs5, s.match);
  }));
});

test('rural and urban come from NFHS-6 only', () => {
  const row = Path.findRows(data, cfg.paths[0].stops[1].match)[0];
  assert.equal(Path.readValue(row, 'rural', 6), row.odisha.nfhs6_rural);
  assert.equal(Path.readValue(row, 'urban', 6), row.odisha.nfhs6_urban);
  assert.equal(Path.readValue(row, 'rural', 5), null);
});

test('every district has a figure at every stop', () => {
  const districts = Object.keys(data.indicators[0].districts);
  assert.equal(districts.length, 30);
  for (const d of districts) {
    const v = Path.valuesFor(data, cfg, 'd:' + d, 6).flat();
    assert.ok(v.every(x => typeof x === 'number' && x >= 0 && x <= 100), d);
  }
});

test('counts are whole dots out of 100', () => {
  assert.equal(Path.of100(70.6), 71);
  assert.equal(Path.of100(93.9), 94);
  assert.equal(Path.of100(null), null);
  assert.equal(Path.of100(100.4), 100);
});
