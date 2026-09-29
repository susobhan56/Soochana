// Guards the claims made in prose on learn/neural-networks.html (explainer 05).
// The page computes every number live; these tests check that the story it
// tells still holds on the real district table. Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const SL = require('../learn/learn.js');
const data = require('../learn/data/districts.json');

const EPOCHS = 3000, SEED = 7, LR = 0.03;
const ST = data.meta.state_nfhs5.stunted;
const R = SL.rows(data.districts, ['f.female_lit', 'f.urban_pct', 'nfhs5.stunted']);
const X0 = R.map(d => [d['f.female_lit'], d['f.urban_pct']]);
const Y = R.map(d => (d['nfhs5.stunted'] >= ST ? 1 : 0));
const sc = SL.scaler(X0), X = X0.map(sc.apply);
const net = (sizes) => SL.models.mlp(sizes, { seed: SEED, lr: LR, activation: 'tanh' }).step(X, Y, EPOCHS);
const right = (n) => X.filter((z, i) => (n.proba(z) >= 0.5 ? 1 : 0) === Y[i]).length;

test('16 of the 30 districts are at or above the state stunting average', () => {
  assert.equal(R.length, 30);
  assert.equal(Y.reduce((a, b) => a + b, 0), 16);
});

test('a hidden layer bends the boundary: it catches Sambalpur, one neuron cannot', () => {
  const n1 = net([2, 1]), n3 = net([2, 3, 1]);
  const sb = R.findIndex(d => d.name === 'Sambalpur');
  assert.equal(Y[sb], 1);
  assert.ok(n1.proba(X[sb]) < 0.5, 'single neuron should miss Sambalpur');
  assert.ok(n3.proba(X[sb]) >= 0.5, 'three hidden neurons should catch it');
  assert.ok(right(n3) > right(n1));
});

test('eight hidden neurons memorise the training districts', () => {
  const n8 = net([2, 8, 1]), n3 = net([2, 3, 1]);
  assert.equal(right(n8), 30);
  assert.ok(n8.loss(X, Y) < n3.loss(X, Y));
});

test('held out, eight neurons do worse than a single neuron', () => {
  function cvAcc(h) {
    let c = 0, n = 0;
    for (const rep of [1, 2, 3]) {
      for (const f of SL.kfold(30, 5, SL.rng(rep))) {
        const s = SL.scaler(f.train.map(i => X0[i]));
        const m = SL.models.mlp(h ? [2, h, 1] : [2, 1], { seed: SEED, lr: LR, activation: 'tanh' });
        m.step(f.train.map(i => s.apply(X0[i])), f.train.map(i => Y[i]), EPOCHS);
        for (const i of f.test) { n++; if ((m.proba(s.apply(X0[i])) >= 0.5 ? 1 : 0) === Y[i]) c++; }
      }
    }
    return c / n;
  }
  const lin = cvAcc(0), big = cvAcc(8);
  assert.ok(big < lin, `8 neurons ${big} vs one neuron ${lin}`);
});
