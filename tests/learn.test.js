// Checks the maths behind the Soochana Learn explainers (learn/learn.js)
// against the real district table. Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const SL = require('../learn/learn.js');
const data = require('../learn/data/districts.json');

const D = data.districts;

test('the modelling table has all 30 districts with the core features', () => {
  assert.equal(D.length, 30);
  const rows = SL.rows(D, ['f.female_lit', 'f.tribal_pct', 'f.urban_pct', 'nfhs5.u5mr', 'nfhs5.imr']);
  assert.equal(rows.length, 30);
  assert.equal(SL.rows(D, ['nfhs5.stunted']).length, 30);
});

test('seeded splits are reproducible and partition every index once', () => {
  const a = SL.split(30, { train: 0.6, val: 0.2, test: 0.2 }, SL.rng(42));
  const b = SL.split(30, { train: 0.6, val: 0.2, test: 0.2 }, SL.rng(42));
  assert.deepEqual(a, b);
  assert.deepEqual([a.train.length, a.val.length, a.test.length], [18, 6, 6]);
  assert.deepEqual([...a.train, ...a.val, ...a.test].sort((x, y) => x - y), SL.range(30));
  const folds = SL.kfold(30, 5, SL.rng(1));
  assert.equal(folds.length, 5);
  assert.deepEqual(folds.flatMap(f => f.test).sort((x, y) => x - y), SL.range(30));
});

test('least squares recovers an exact line and polyfit interpolates', () => {
  const X = [[0], [1], [2], [3]], y = [1, 3, 5, 7];
  const m = SL.models.linreg(X, y);
  assert.ok(Math.abs(m.w[0] - 1) < 1e-9 && Math.abs(m.w[1] - 2) < 1e-9);
  const x = [0, 1, 2, 3, 4], yq = x.map(v => v * v - 2 * v + 3);
  const p = SL.models.polyfit(x, yq, 2);
  assert.ok(Math.abs(p.predict(2.5) - (6.25 - 5 + 3)) < 1e-6);
});

test('female literacy predicts stunting with a negative slope', () => {
  const r = SL.rows(D, ['f.female_lit', 'nfhs5.stunted']);
  const m = SL.models.linreg(r.map(d => [d['f.female_lit']]), r.map(d => d['nfhs5.stunted']));
  assert.ok(m.w[1] < 0, 'slope ' + m.w[1]);
  const r2 = SL.metrics.r2(r.map(d => d['nfhs5.stunted']), r.map(d => m.predict([d['f.female_lit']])));
  assert.ok(r2 > 0.5 && r2 < 0.9, 'r2 ' + r2);
});

test('higher polynomial degree always lowers training error', () => {
  const r = SL.rows(D, ['f.female_lit', 'nfhs5.stunted']);
  const x = r.map(d => d['f.female_lit']), y = r.map(d => d['nfhs5.stunted']);
  let prev = Infinity;
  for (const deg of [1, 3, 6, 10]) {
    const p = SL.models.polyfit(x, y, deg);
    const e = SL.metrics.mse(y, x.map(p.predict));
    assert.ok(e <= prev + 1e-6, `deg ${deg}: ${e} > ${prev}`);
    prev = e;
  }
});

test('logistic regression descends and separates high-stunting districts', () => {
  const st = data.meta.state_nfhs5.stunted;
  const r = SL.rows(D, ['f.female_lit', 'nfhs5.stunted']);
  const X0 = r.map(d => [d['f.female_lit']]), sc = SL.scaler(X0), X = X0.map(sc.apply);
  const y = r.map(d => (d['nfhs5.stunted'] >= st ? 1 : 0));
  const m = SL.models.logreg(X, y, { lr: 0.5 });
  const l0 = m.loss();
  m.step(500);
  assert.ok(m.loss() < l0);
  assert.ok(m.w[0] < 0, 'more female literacy → lower odds of high stunting');
  const acc = SL.metrics.accuracy(y, X.map(v => (m.proba(v) >= 0.5 ? 1 : 0)));
  assert.ok(acc >= 0.7, 'accuracy ' + acc);
});

test('an unlimited tree memorises training data; depth caps it', () => {
  const r = SL.rows(D, ['f.female_lit', 'f.tribal_pct', 'f.urban_pct', 'nfhs5.u5mr']);
  const med = SL.median(r.map(d => d['nfhs5.u5mr']));
  const X = r.map(d => [d['f.female_lit'], d['f.tribal_pct'], d['f.urban_pct']]);
  const y = r.map(d => (d['nfhs5.u5mr'] > med ? 1 : 0));
  const deep = SL.models.buildTree(X, y, { maxDepth: 20 });
  assert.equal(SL.metrics.accuracy(y, X.map(deep.predict)), 1);
  const stump = SL.models.buildTree(X, y, { maxDepth: 1 });
  assert.equal(stump.nodes().length, 3);
  assert.ok(stump.root.gain > 0);
});

test('gini and entropy agree at the extremes', () => {
  assert.equal(SL.gini(0, 10), 0);
  assert.equal(SL.entropy(10, 10), 0);
  assert.equal(SL.gini(5, 10), 0.5);
  assert.equal(SL.entropy(5, 10), 1);
});

test('a small network learns XOR, which no straight line can', () => {
  const X = [[-1, -1], [-1, 1], [1, -1], [1, 1]], y = [0, 1, 1, 0];
  const net = SL.models.mlp([2, 4, 1], { seed: 3, lr: 0.05 });
  net.step(X, y, 1500);
  X.forEach((x, i) => assert.equal(net.proba(x) >= 0.5 ? 1 : 0, y[i]));
});

test('confusion rates and ROC behave', () => {
  const c = SL.metrics.confusion([1, 1, 0, 0], [1, 0, 1, 0]);
  assert.deepEqual([c.tp, c.fn, c.fp, c.tn], [1, 1, 1, 1]);
  assert.equal(c.tpr, 0.5);
  assert.equal(c.fpr, 0.5);
  const pts = SL.metrics.roc([1, 1, 0, 0], [0.9, 0.8, 0.3, 0.1]);
  assert.equal(SL.metrics.auc(pts), 1);
});
