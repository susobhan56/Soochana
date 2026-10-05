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
const p = Dz.popFacts(read('datasets/state_demographics.json'), read('datasets/district_fertility_trends.json'));
const areaKha = Dz.num(byNum[3].table_data.area_sq_km) / 10;

function cardText(s) {
  const x = { byNum, p, areaKha, tfrState: '1.8', slide: s, t: s.table_data || {} };
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
  assert.ok(p.allFall, 'every district is projected lower in 2036 than 2020');
});
