// Checks the maths behind learn/bias-variance.html. The page keeps its pure
// helpers between BV-MATH-START / BV-MATH-END; we evaluate that exact block
// here so the tests exercise the code readers run. Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const SL = require('../learn/learn.js');
const data = require('../learn/data/districts.json');

const html = fs.readFileSync(path.join(__dirname, '../learn/bias-variance.html'), 'utf8');
const block = html.slice(html.indexOf('/* BV-MATH-START'), html.indexOf('/* BV-MATH-END */'));
const BV = new Function('SL', block + '\nreturn BV;')(SL);

const R = SL.rows(data.districts, ['f.tribal_pct', 'nfhs5.underweight']);
const xs = R.map(d => d['f.tribal_pct']), ys = R.map(d => d['nfhs5.underweight']);
const n = R.length;
const polyFit = (deg, lam) => idx => SL.models.polyfit(idx.map(i => xs[i]), idx.map(i => ys[i]), deg, { lo: 0, hi: 60, lambda: lam || 1e-8 });
const sets = (() => { const r = SL.rng(2026), out = []; for (let b = 0; b < 200; b++) out.push(SL.bootstrap(n, r)); return out; })();

test('local linear smoother reproduces a straight line exactly', () => {
  const X = [0, 1, 2, 3, 4, 5], Y = X.map(v => 3 + 2 * v);
  const m = BV.loclin(X, Y, 1.5);
  [0, 2.5, 5].forEach(v => assert.ok(Math.abs(m.predict(v) - (3 + 2 * v)) < 1e-9));
  const df = BV.smootherDf(X, 1e-3);          // tiny width: interpolates, df → n
  assert.ok(Math.abs(df - X.length) < 1e-6);
});

test('Rice noise estimator is zero on a constant and sensible on the districts', () => {
  assert.equal(BV.riceNoise([1, 2, 3], [5, 5, 5]), 0);
  assert.ok(BV.riceNoise(xs, ys) > 5 && BV.riceNoise(xs, ys) < SL.variance(ys));
});

test('decomposition terms add up and match the squared gap to the stand-in', () => {
  const bw = BV.pickBandwidth(xs, ys, [3, 4, 5, 6, 8, 10, 15]);
  const g = BV.loclin(xs, ys, bw.h), gx = xs.map(g.predict);
  const r = BV.decompose(xs, ys, gx, 10, sets, polyFit(2));
  assert.ok(Math.abs(r.total - (r.bias2 + r.vari + 10)) < 1e-9);
  // bias² + variance = average over districts and redraws of (fit − stand-in)²
  let direct = 0;
  sets.forEach(idx => { const m = polyFit(2)(idx); xs.forEach((v, i) => { direct += (m.predict(v) - gx[i]) ** 2; }); });
  direct /= sets.length * n;
  assert.ok(Math.abs(direct - (r.bias2 + r.vari)) < 1e-9);
});

test('the story holds on the real data: a U with its bottom at a gentle curve', () => {
  const bw = BV.pickBandwidth(xs, ys, SL.range(35).map(i => 3 + i * 0.5));
  const g = BV.loclin(xs, ys, bw.h), gx = xs.map(g.predict);
  const noise = SL.sum(ys.map((y, i) => (y - gx[i]) ** 2)) / (n - BV.smootherDf(xs, bw.h));
  const res = SL.range(11).map(d => BV.decompose(xs, ys, gx, noise, sets, polyFit(d)));
  const best = res.reduce((b, r, i) => (r.total < res[b].total ? i : b), 0);
  assert.ok(best >= 2 && best <= 4, 'best degree ' + best);
  assert.ok(res[0].bias2 > 10 * res[best].bias2);          // flat mean: high bias
  assert.ok(res[1].bias2 > 3 * res[best].bias2);           // straight line: still biased
  assert.ok(res[10].vari > 100 * res[1].vari);             // degree 10: huge variance
  assert.ok(res[1].vari < res[best].vari * 1.5);           // line's bundle is tight
  // noise from the smoother and the model-free check agree roughly
  assert.ok(Math.abs(noise - BV.riceNoise(xs, ys)) / noise < 0.25);
  // ridge on degree 10 recovers a total close to the best plain polynomial
  const lamBest = Math.min(...[1e-3, 1e-2, 0.1, 1, 10].map(l => BV.decompose(xs, ys, gx, noise, sets, polyFit(10, l)).total));
  assert.ok(lamBest < res[best].total * 1.05);
});

test('straight-line misses are one-sided in the low and middle tribal-share groups', () => {
  const line = polyFit(1)(SL.range(n));
  const res = ys.map((y, i) => y - line.predict(xs[i]));
  const low = SL.range(n).filter(i => xs[i] < 8), mid = SL.range(n).filter(i => xs[i] >= 8 && xs[i] < 40);
  assert.ok(low.filter(i => res[i] < 0).length / low.length >= 0.75);
  assert.ok(mid.filter(i => res[i] > 0).length / mid.length >= 0.7);
});
