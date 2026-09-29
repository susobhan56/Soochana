// Checks the claims the Decision Trees explainer (learn/decision-tree.html) builds its
// story on, using the same learn.js core, data, features and seeds as the page.
// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const SL = require('../learn/learn.js');
const data = require('../learn/data/districts.json');

const KX = 'f.female_lit', KY = 'f.tribal_pct', TARGET = 'nfhs5.u5mr';
const R = SL.rows(data.districts, [KX, KY, TARGET]);
const MED = SL.median(R.map(d => d[TARGET]));
const Y = R.map(d => (d[TARGET] > MED ? 1 : 0));
const X = R.map(d => [d[KX], d[KY]]);
const ALL = SL.range(R.length);
const acc = (t, XX = X, yy = Y) => SL.metrics.accuracy(yy, XX.map(t.predict));

// the page's threshold sweep: weighted impurity for every candidate cut on one feature
function sweep(j, crit) {
  const imp = crit === 'entropy' ? SL.entropy : SL.gini, n = R.length, P = SL.sum(Y);
  const s = ALL.slice().sort((a, b) => X[a][j] - X[b][j]);
  const pts = [];
  let posL = 0;
  for (let k = 0; k < n - 1; k++) {
    posL += Y[s[k]];
    if (X[s[k]][j] === X[s[k + 1]][j]) continue;
    const nL = k + 1, nR = n - nL;
    pts.push({ t: (X[s[k]][j] + X[s[k + 1]][j]) / 2, imp: (nL * imp(posL, nL) + nR * imp(P - posL, nR)) / n });
  }
  return pts.reduce((a, b) => (b.imp < a.imp - 1e-12 ? b : a));
}

// repeated 5-fold cross-validation with the page's seeds
function cv(opts, reps = 10, seed = 404) {
  let tot = 0;
  for (let r = 0; r < reps; r++) {
    let c = 0;
    for (const f of SL.kfold(R.length, 5, SL.rng(seed + r))) {
      const t = SL.models.buildTree(f.train.map(i => X[i]), f.train.map(i => Y[i]), opts);
      for (const i of f.test) if (t.predict(X[i]) === Y[i]) c++;
    }
    tot += c / R.length;
  }
  return tot / reps;
}

test('the median split gives two equal classes', () => {
  assert.equal(R.length, 30);
  assert.equal(SL.sum(Y), 15);
});

test('the sweep finds the same best cut as bestSplit, and literacy beats tribal share', () => {
  const lit = sweep(0, 'gini'), tri = sweep(1, 'gini');
  const best = SL.models.bestSplit(X, Y, ALL, [0, 1], 'gini');
  assert.equal(best.feature, 0);
  assert.ok(Math.abs(best.threshold - lit.t) < 1e-9);
  assert.ok(Math.abs(best.child - lit.imp) < 1e-12);
  assert.ok(lit.imp < tri.imp);
  const ent = SL.models.bestSplit(X, Y, ALL, [0, 1], 'entropy');
  assert.equal(ent.feature, 0, 'the page says entropy picks the same line');
  assert.ok(Math.abs(ent.threshold - best.threshold) < 1e-9);
});

test('training accuracy never falls with depth and reaches 100% when fully grown', () => {
  let prev = 0;
  for (let d = 1; d <= 6; d++) {
    const a = acc(SL.models.buildTree(X, Y, { maxDepth: d }));
    assert.ok(a >= prev - 1e-12, `depth ${d}`);
    prev = a;
  }
  const full = SL.models.buildTree(X, Y, { maxDepth: 50 });
  assert.equal(acc(full), 1);
  assert.ok(full.nodes().filter(n => !n.left && n.n === 1).length >= 2, 'several one-district leaves');
});

test('cross-validated accuracy is best shallow and worse for the fully grown tree', () => {
  const curve = [1, 2, 3, 4, 5, 6].map(d => cv({ maxDepth: d }));
  const best = curve.indexOf(Math.max(...curve)) + 1;
  assert.ok(best <= 2, 'best depth ' + best);
  assert.ok(curve[5] < Math.max(...curve) - 0.05, 'deep tree does clearly worse on unseen districts');
  assert.ok(cv({ maxDepth: 6, minLeaf: 3 }) > curve[5], 'a minimum leaf size helps the deep tree');
});

test('leaving out one district changes some depth-3 trees', () => {
  const sig = n => (n.left ? `(${n.feature}:${n.threshold}${sig(n.left)}${sig(n.right)})` : 'L' + n.prediction);
  const base = sig(SL.models.buildTree(X, Y, { maxDepth: 3 }).root);
  const changed = ALL.filter(k => {
    const idx = ALL.filter(i => i !== k);
    return sig(SL.models.buildTree(idx.map(i => X[i]), idx.map(i => Y[i]), { maxDepth: 3 }).root) !== base;
  }).length;
  assert.ok(changed > 0 && changed < 30, 'changed ' + changed);
});
