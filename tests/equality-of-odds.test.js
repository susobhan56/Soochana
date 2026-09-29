// Checks the scoring and threshold-search maths behind learn/equality-of-odds.html.
// The page's core block (between the eo-core markers) is extracted and run here
// against the real district table, so the test exercises the code readers run.
// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const SL = require('../learn/learn.js');
const data = require('../learn/data/districts.json');

const html = fs.readFileSync(path.join(__dirname, '../learn/equality-of-odds.html'), 'utf8');
const block = html.split('/* eo-core:start')[1].split('/* eo-core:end */')[0].replace(/^[^\n]*\n/, '');
const EO = new Function('SL', block + '\nreturn EO;')(SL);

const P = EO.prepare(data);
const A = P.R.filter(d => d.g === 'a');
const B = P.R.filter(d => d.g === 'b');

test('groups and base rates match what the prose relies on', () => {
  assert.equal(P.R.length, 30);
  assert.equal(A.length, 13);
  assert.equal(B.length, 17);
  assert.equal(A.filter(d => d.need).length, 11);
  assert.equal(B.filter(d => d.need).length, 5);
  assert.equal(A.filter(d => !d.need).length, 2);
});

test('the model leaves tribal share out and its weights point the way the story says', () => {
  assert.deepEqual(P.features, ['f.female_lit', 'nfhs4.stunted']);
  assert.ok(P.full.w[0] < 0, 'more female literacy lowers the score');
  assert.ok(P.full.w[1] > 0, 'more NFHS-4 stunting raises the score');
  P.R.forEach(d => assert.ok(d.score > 0 && d.score < 1));
  const again = EO.prepare(data);
  assert.deepEqual(again.R.map(d => d.score), P.R.map(d => d.score), 'deterministic');
});

test('one bar of 50 serves needy higher-ST districts better than needy others', () => {
  const a = EO.rates(A, 0.5), b = EO.rates(B, 0.5);
  assert.ok(a.tpr > b.tpr, `tpr ${a.tpr} vs ${b.tpr}`);
  assert.ok(a.fpr > b.fpr, `fpr ${a.fpr} vs ${b.fpr}`);
  assert.ok(a.flagged > b.flagged);
});

test('between() gives a slider-safe bar with the same outcome as the cutoff', () => {
  [A, B].forEach(L => EO.cutoffs(L).forEach(t => {
    const bar = EO.between(L, t);
    assert.deepEqual(EO.rates(L, bar), EO.rates(L, t));
    assert.ok(bar >= 0 && bar <= 1);
  }));
});

test('equal opportunity search equalises true-positive rates at some cost', () => {
  const s = EO.search(A, B, 'opp');
  assert.ok(Math.abs(s.a.tpr - s.b.tpr) < 1e-9);
  const one = EO.rates(A, 0.5).fp + EO.rates(B, 0.5).fp;
  assert.ok(s.a.fp + s.b.fp >= one, 'lowering a bar funds more districts not in need');
});

test('equalised odds search is no worse than any pair of bars, and never picks a corner', () => {
  const s = EO.search(A, B, 'odds');
  EO.cutoffs(A).forEach(ta => EO.cutoffs(B).forEach(tb => {
    const a = EO.rates(A, ta), b = EO.rates(B, tb);
    if (a.flagged % 1 === 0 || b.flagged % 1 === 0) return;
    const gap = Math.max(Math.abs(a.tpr - b.tpr), Math.abs(a.fpr - b.fpr));
    assert.ok(s.gap <= gap + 1e-9);
  }));
  [s.a, s.b].forEach(c => assert.ok(c.flagged > 0 && c.flagged < 1));
});

test('demographic parity search matches funded shares as closely as whole districts allow', () => {
  const s = EO.search(A, B, 'parity');
  assert.ok(s.gap <= 1 / (A.length * B.length) + 1e-9, 'gap ' + s.gap);
});

test('the two ROC curves share no operating point except the corners', () => {
  assert.equal(EO.shared(EO.roc(A), EO.roc(B)).length, 0);
});
