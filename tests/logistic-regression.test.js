// Checks the maths behind learn/logistic-regression.html: fitting on
// standardised literacy, then converting the weight back to percentage
// points for the odds ratio and the 50% point. Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const SL = require('../learn/learn.js');
const data = require('../learn/data/districts.json');

const THR = data.meta.state_nfhs5.stunted;
const R = SL.rows(data.districts, ['f.female_lit', 'nfhs5.stunted']);
const xs = R.map(d => d['f.female_lit']);
const y = R.map(d => (d['nfhs5.stunted'] >= THR ? 1 : 0));

/* The page's fit: gradient descent on z-scored literacy. */
function pageFit() {
  const sc = SL.scaler(xs.map(v => [v]));
  const m = SL.models.logreg(xs.map(v => sc.apply([v])), y, { lr: 0.5, iters: 3000 });
  const mu = sc.mu[0], sd = sc.sd[0];
  return {
    m, mu, sd,
    wRaw: m.w[0] / sd,                     // log-odds per percentage point
    or10: Math.exp(10 * m.w[0] / sd),      // odds ratio per 10 points
    x50: mu - m.b * sd / m.w[0],           // literacy where the chance is 50%
    w10: m.w[0] * 10 / sd,                 // slider units: log-odds per 10 points
  };
}

/* An independent fit on the raw percentages by Newton–Raphson (IRLS). */
function newtonRaw() {
  let b0 = 0, b1 = 0;
  for (let it = 0; it < 50; it++) {
    let g0 = 0, g1 = 0, h00 = 0, h01 = 0, h11 = 0;
    xs.forEach((x, i) => {
      const p = SL.sigmoid(b0 + b1 * x), r = p - y[i], w = p * (1 - p);
      g0 += r; g1 += r * x; h00 += w; h01 += w * x; h11 += w * x * x;
    });
    const det = h00 * h11 - h01 * h01;
    b0 -= (h11 * g0 - h01 * g1) / det;
    b1 -= (h00 * g1 - h01 * g0) / det;
  }
  return { b0, b1 };
}

test('the task: 16 of 30 districts are at or above the state stunting figure', () => {
  assert.equal(R.length, 30);
  assert.equal(THR, 31);
  assert.equal(SL.sum(y), 16);
});

test('unscaled weight and intercept match a direct fit on raw percentages', () => {
  const f = pageFit(), n = newtonRaw();
  assert.ok(Math.abs(f.wRaw - n.b1) < 1e-4, `slope ${f.wRaw} vs ${n.b1}`);
  const b0Raw = f.m.b - f.m.w[0] * f.mu / f.sd;
  assert.ok(Math.abs(b0Raw - n.b0) < 1e-3, `intercept ${b0Raw} vs ${n.b0}`);
  assert.ok(Math.abs(f.or10 - Math.exp(10 * n.b1)) < 1e-3);
  assert.ok(f.or10 > 0 && f.or10 < 1, 'more literacy, lower odds');
});

test('the 50% point and the odds ratio mean what the page says', () => {
  const f = pageFit();
  const P = x => f.m.proba([(x - f.mu) / f.sd]);
  assert.ok(Math.abs(P(f.x50) - 0.5) < 1e-9);
  const odds = p => p / (1 - p);
  for (const x of [40, 50, 60, 70]) {
    assert.ok(Math.abs(odds(P(x + 10)) / odds(P(x)) - f.or10) < 1e-9, 'odds multiply by the same factor every 10 points');
  }
  // the slider parameterisation z = b + w10 (x − mean) / 10 is the same model
  const Q = x => SL.sigmoid(f.m.b + f.w10 * (x - f.mu) / 10);
  for (const x of [35, 62, 81]) assert.ok(Math.abs(P(x) - Q(x)) < 1e-12);
});

test('a straight line on the 0/1 outcome leaves the 0–100% range', () => {
  const lin = SL.models.linreg(xs.map(v => [v]), y);
  assert.ok(lin.predict([Math.min(...xs)]) > 1);
  assert.ok(-lin.w[0] / lin.w[1] < 90, 'crosses zero inside the chart');
});

test('at a 50% cut-off, confusion counts add up and ROC area beats chance', () => {
  const f = pageFit(), p = xs.map(x => f.m.proba([(x - f.mu) / f.sd]));
  const c = SL.metrics.confusion(y, p.map(q => (q >= 0.5 ? 1 : 0)));
  assert.equal(c.tp + c.fp + c.tn + c.fn, 30);
  assert.equal(c.tp + c.fn, 16);
  assert.ok(c.accuracy >= 0.7);
  assert.ok(SL.metrics.auc(SL.metrics.roc(y, p)) > 0.8);
  assert.ok(f.m.loss() < Math.log(2), 'beats a flat 50% guess');
});
