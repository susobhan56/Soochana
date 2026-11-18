// Checks the state dossier's card text (dossier.js) against
// datasets/state_details.json. Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Dz = require('../dossier.js');

const read = f => JSON.parse(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'));
const details = read('datasets/state_details.json').Odisha;
const slides = details.slides_detail;
const byNum = {};
slides.forEach(s => { byNum[s.slide_num] = s; });
const p = Dz.popFacts(read('datasets/state_demographics.json'));
const orgi = read('datasets/orgi_state_projection.json');
const nfhs = read('datasets/nfhs6_state_factsheet.json');
const areaKha = Dz.num(byNum[3].table_data.area_sq_km) / 10;

function cardText(s) {
  const x = { byNum, p, orgi, nfhs, areaKha, tfrState: '1.7', slide: s, t: s.table_data || {} };
  const lead = Dz.LEADS[s.slide_num] ? Dz.LEADS[s.slide_num](x) : null;
  return lead && lead.length ? lead : Dz.splitText(s).body;
}

test('every module in the file is placed in a chapter', () => {
  const listed = Dz.CHAPTERS.flatMap(c => c.mods);
  assert.deepEqual(slides.map(s => s.slide_num).filter(n => !listed.includes(n)), []);
});

test('every module has something to read, with no missing figures', () => {
  for (const s of slides) {
    const text = cardText(s).join(' ');
    assert.ok(text.length > 40, 'module ' + s.slide_num + ' has text');
    assert.doesNotMatch(text, /undefined|NaN|null/, 'module ' + s.slide_num);
  }
});

test('stat strings and the tribe list stay out of the narrative', () => {
  for (const s of slides) {
    for (const para of Dz.splitText(s).body) {
      assert.ok(!para.includes(' | '), 'module ' + s.slide_num + ' figures');
      assert.ok(!/^\s*1\.\s/.test(para), 'module ' + s.slide_num + ' list');
    }
  }
  assert.match(Dz.splitText(byNum[3]).source, /Census 2011/);
});

test('land use adds up to the whole state in 100 squares', () => {
  const L = Dz.landCats(byNum[2].table_data, areaKha);
  assert.equal(L.n.reduce((a, b) => a + b, 0), 100);
  assert.equal(L.cats[1].label, 'Forest');
  assert.equal(L.n[1], Math.round(6120 / areaKha * 100));
});

test('population figures read the real series, not the table after it', () => {
  assert.equal(p.first.year, 1901);
  assert.equal(p.last.year, 2036);
  assert.equal(p.low.year, 1991);         // the sex ratio's lowest point
  assert.equal(Math.round(p.last.total / 1e5), 490);      // 4.90 crore, the ORGI projection
  assert.equal(Math.round(p.last.sex_ratio), 998);
  assert.equal(p.aLast.elder.toFixed(1), '17.0');
});

test('fertility comes from ORGI and the NFHS fact sheets, not a district projection', () => {
  const f = Dz.tfrFacts(orgi, nfhs);
  assert.equal(f.n.o6, 1.7);
  assert.equal(f.n.o5, 1.8);
  assert.equal(f.odisha[0], 2.1);
  assert.equal(f.odisha[f.odisha.length - 1], 1.71);
  const text = cardText(byNum[7]).join(' ');
  assert.match(text, /1\.7\*\* children per woman in NFHS-6 \(2023–24, published May 2026\)/);
  assert.match(text, /1\.8\*\* in NFHS-5 \(2019–21\)/);
  assert.equal(Dz.popFacts.length, 1);
});

test('NFHS-5 figures in the health modules carry NFHS-6 beside them', () => {
  for (const n of [12, 15]) {
    const text = cardText(byNum[n]).join(' ');
    assert.match(text, /NFHS-6 \(2023–24, published May 2026\)/, 'module ' + n);
    assert.match(text, /NFHS-5 \(2019–21\)/, 'module ' + n);
  }
  assert.match(cardText(byNum[15]).join(' '), /26\.8%.*31\.0%/);
});

test('no module cites the retired projection', () => {
  assert.doesNotMatch(JSON.stringify(details), /Bayesian|DIU/);
});
