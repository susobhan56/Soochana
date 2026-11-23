// Checks the Soochana Assistant's answers (chatbot-engine.js) against the
// real data files. Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const Chat = require('../chatbot-engine.js');

const table = require('../learn/data/districts.json');
const engine = Chat.createEngine({
  districts: table,
  population: require('../datasets/district_population_trends.json'),
  nfhs: require('../datasets/nfhs_district_rounds.json'),
  nfhsState: require('../datasets/nfhs6_state_factsheet.json'),
  orgi: require('../datasets/orgi_state_projection.json'),
  national: require('../datasets/national_comparisons.json'),
  contents: require('../data/contents.json').recentContent,
  reports: require('../data/reports.json').reports,
  datasets: require('../data/datasets.json').datasets
});

const D = table.districts;
const text = a => a.blocks.map(b => b.text || (b.items || []).map(i => (typeof i === 'string' ? i : i.label + ' ' + i.text)).join(' ') || (b.rows || []).map(r => r.join(' ')).join(' ')).join(' ');

test('questions containing "hi" inside a word are not greetings', () => {
  for (const q of ['which district has the highest infant mortality?', 'this district', 'children stunted in koraput']) {
    assert.notEqual(engine.answer(q).intent, 'greet', q);
  }
  assert.equal(engine.answer('hi').intent, 'greet');
  assert.equal(engine.answer('Namaste!').intent, 'greet');
});

test('rankings match a direct sort of the table', () => {
  const a = engine.answer('Which district has the highest infant mortality?');
  assert.equal(a.intent, 'rank');
  const top = D.slice().sort((x, y) => y.nfhs5.imr - x.nfhs5.imr)[0];
  assert.match(a.blocks[0].text, new RegExp('^\\*\\*' + top.name + '\\*\\*'));
  const low = engine.answer('lowest literacy');
  const bottom = D.slice().sort((x, y) => x.f.literacy - y.f.literacy)[0];
  assert.match(low.blocks[0].text, new RegExp(bottom.name));
  assert.equal(engine.answer('top 3 districts for institutional births').blocks[1].items.length, 3);
});

test('"best" follows the indicator direction', () => {
  const a = engine.answer('which district is best on child marriage');
  const best = D.slice().sort((x, y) => x.nfhs5.child_marriage - y.nfhs5.child_marriage)[0];
  assert.match(a.blocks[0].text, new RegExp(best.name));
});

test('thresholds count the right districts', () => {
  const a = engine.answer('Which districts have literacy below 60%?');
  const n = D.filter(d => d.f.literacy < 60).length;
  assert.match(a.blocks[0].text, new RegExp('^\\*\\*' + n + '\\*\\*'));
});

test('district names resolve through aliases and typos', () => {
  assert.deepEqual(engine.parse('population of balasore').districts, ['Baleshwar']);
  assert.deepEqual(engine.parse('keonjhar and deogarh').districts, ['Kendujhar', 'Debagarh']);
  assert.deepEqual(engine.parse('koraptu stunting').districts, ['Koraput']);
  assert.deepEqual(engine.parse('what is the literacy rate').districts, []);
});

test('a single value carries its source period and position', () => {
  const a = engine.answer('child marriage in Kendujhar');
  assert.equal(a.intent, 'value');
  const v = D.find(d => d.name === 'Kendujhar').nfhs5.child_marriage;
  assert.ok(text(a).includes(String(v)), 'value shown');
  assert.match(text(a), /NFHS-5/);
  assert.match(text(a), /of 30/);
});

test('comparing two districts builds a side-by-side table', () => {
  const a = engine.answer('compare Koraput and Ganjam');
  assert.equal(a.intent, 'compare');
  const t = a.blocks.find(b => b.type === 'table');
  assert.deepEqual(t.head.slice(1, 3), ['Koraput', 'Ganjam']);
  assert.ok(t.rows.length >= 8);
});

test('follow-ups reuse the previous subject', () => {
  const first = engine.answer('Koraput vs Ganjam literacy');
  const next = engine.answer('what about Puri?', { last: first.memory });
  assert.equal(next.intent, 'value');
  assert.match(text(next), /Puri/);
  assert.match(text(next), /Literacy/);
  const r = engine.answer('which district has the highest stunting');
  const flip = engine.answer('and the lowest?', { last: r.memory });
  assert.equal(flip.intent, 'rank');
  assert.match(text(flip), /lowest stunting/);
});

test('population trend separates Census counts from projections', () => {
  const a = engine.answer("How has Cuttack's population changed?");
  assert.equal(a.intent, 'trend');
  assert.match(text(a), /2011 Census/);
  assert.ok(a.blocks.some(b => b.type === 'note' && /projections/.test(b.text)));
});

test('"why" questions report associations, flagged as not causal', () => {
  const a = engine.answer('Why is stunting high in some districts?');
  assert.equal(a.intent, 'why');
  assert.ok(a.needsLLM);
  assert.match(text(a), /r = /);
  assert.match(text(a), /not proof of cause/);
});

test('a district assessment lists strengths and gaps from the data', () => {
  const a = engine.answer('What should Nabarangpur focus on?');
  assert.equal(a.intent, 'assess');
  assert.match(text(a), /Where it has the most room to gain/);
  assert.match(text(a), /literacy/i);
});

test('state and national questions use the national table', () => {
  const a = engine.answer('which state has the highest sex ratio at birth');
  assert.equal(a.intent, 'national');
  assert.match(text(a), /Odisha is \d+(st|nd|rd|th)/);
  assert.equal(engine.answer('Odisha vs Kerala sex ratio').intent, 'national');
});

test('the page district answers "this district"', () => {
  const a = engine.answer('literacy in this district', { pageDistrict: 'Balangir' });
  assert.equal(a.intent, 'value');
  assert.match(text(a), /Bolangir/);
});

test('answers are plain data and never echo the question as markup', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const a = engine.answer(evil);
  assert.ok(!JSON.stringify(a.blocks).includes('<img'));
});

test('a broad battery of questions never throws', () => {
  const qs = ['', 'help', 'thanks', 'reports on migration', 'policy schemes', 'coastal districts', 'health in koraput',
    'elderly population in 2036 in puri', 'fertility in Malkangiri by 2036', 'which district improved most in stunting',
    'compare cuttack with odisha', 'KBK districts vs the rest on stunting', 'Odisha vs India', 'education',
    'female labour force participation in odisha vs india', 'rainfall in sundargarh', 'anaemia in NFHS-6 for Angul',
    'tell me about balangir and kalahandi', 'most densely populated district', 'xyz blah', 'how can koraput improve'];
  let ctx = {};
  for (const q of qs) {
    const a = engine.answer(q, ctx);
    assert.ok(Array.isArray(a.blocks) && a.blocks.length, q);
    ctx = { last: a.memory };
  }
});

test('district survey answers lead with NFHS-6 and give NFHS-5 for change', () => {
  const R = require('../datasets/nfhs_district_rounds.json');
  const ib = R.indicators.find(i => i.n === 36).districts.Koraput;
  const t = text(engine.answer('institutional births in Koraput'));
  assert.match(t, /NFHS-6/);
  assert.ok(t.includes(ib[0].toFixed(1)), 'NFHS-6 value shown');
  assert.ok(t.includes(ib[1].toFixed(1)), 'NFHS-5 value shown');
});

test('fertility questions answer from the state figures, not a district projection', () => {
  const a = engine.answer('fertility in Malkangiri by 2036');
  assert.equal(a.intent, 'fertility');
  assert.match(text(a), /1\.7/);
  assert.match(text(a), /do not publish a fertility rate for each district/);
});

test('misspelt indicator names are corrected, and the answer says so', () => {
  for (const [q, key, typo] of [['child marrige in koraput', 'child_marriage', 'marrige'], ['stuntng in ganjam', 'stunted', 'stuntng'],
    ['litracy in puri', 'literacy', 'litracy'], ['infnt mortalty in rayagada', 'imr', 'mortalty']]) {
    const a = engine.answer(q);
    assert.equal(a.intent, 'value', q);
    assert.deepEqual(engine.parse(q).indicators.map(i => i.key), [key], q);
    assert.match(text(a), new RegExp('Reading .*' + typo), q);
  }
  // ordinary words stay as typed
  for (const q of ['rankings for literacy', 'where is the lowest sex ratio', 'compare koraput and ganjam', 'women working in odisha']) {
    assert.deepEqual(engine.parse(q).corrected, [], q);
  }
});

test('topics the portal has no figures on are named, not quietly swapped', () => {
  const p = engine.answer('what is the poverty rate in koraput');
  assert.match(text(p), /doesn’t carry figures on poverty/);
  assert.match(text(p), /Koraput/);
  const c = engine.answer('who is the chief minister');
  assert.equal(c.intent, 'gap');
  assert.match(text(c), /elections and politics/);
  const mix = engine.answer('poverty and literacy in koraput');
  assert.equal(mix.intent, 'value');
  assert.match(text(mix), /rest of your question/);
  assert.equal(engine.parse('literacy in koraput').gaps.length, 0);
});

test('towns resolve to their district, with a note', () => {
  const a = engine.answer('literacy in bhubaneswar');
  assert.equal(a.intent, 'value');
  assert.match(text(a), /Bhubaneswar is in Khordha district/);
  assert.deepEqual(engine.parse('compare rourkela and berhampur').districts, ['Sundargarh', 'Ganjam']);
  assert.deepEqual(engine.parse('stunting in bhubaneshwar').districts, ['Khordha']);
});

test('"excluding" leaves districts out of a ranking', () => {
  const a = engine.answer('which district has the lowest literacy excluding nabarangpur');
  assert.equal(a.intent, 'rank');
  const second = D.slice().sort((x, y) => x.f.literacy - y.f.literacy).filter(d => d.name !== 'Nabarangpur')[0];
  assert.match(a.blocks.find(b => b.type === 'p').text, new RegExp('^\\*\\*' + second.name + '\\*\\*.* of 29 districts'));
  assert.match(text(a), /Leaving out Nabarangpur/);
  const two = engine.answer('top 5 literacy except khordha and cuttack');
  assert.ok(!two.blocks.find(b => b.type === 'bars').items.some(i => /Khordha|Cuttack/.test(i.label)));
  // the exclusion lasts for that question only
  assert.match(engine.answer('which district has the highest literacy').blocks[0].text, /of 30 districts/);
});
