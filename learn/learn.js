/**
 * learn.js — shared core for the Soochana Learn explainers.
 *
 *   SL.loadData()            the district modelling table (data/districts.json)
 *   SL.rng / shuffle / split seeded randomness, so every reader sees the same split
 *   SL.models                least squares, polynomial, logistic, CART tree, small MLP
 *   SL.metrics               error, accuracy, confusion counts, ROC
 *   SL.scrolly               sticky-graphic scroll steps (the MLU-Explain pattern)
 *   SL.tooltip / fmt / color chart helpers
 *
 * Everything the models do runs here in the browser on the 30 districts, so the
 * numbers on each page are computed, never typed in. Works in Node too
 * (module.exports) so tests/learn.test.js can check the maths.
 */
(function (root) {
  'use strict';

  /* ── data ─────────────────────────────────────────────── */

  var dataPromise = null;
  function loadData(url) {
    if (!dataPromise) {
      dataPromise = fetch(url || 'data/districts.json').then(function (r) {
        if (!r.ok) throw new Error('districts.json: ' + r.status);
        return r.json();
      });
    }
    return dataPromise;
  }

  /** get(d, 'nfhs5.stunted') → d.nfhs5.stunted */
  function get(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }

  /** Districts that have every listed path, each flattened to {name, ...values, d}. */
  function rows(districts, paths) {
    return districts.filter(function (d) {
      return paths.every(function (p) { var v = get(d, p); return v != null && !isNaN(v); });
    }).map(function (d) {
      var r = { name: d.name, d: d };
      paths.forEach(function (p) { r[p] = +get(d, p); });
      return r;
    });
  }

  /* ── randomness ───────────────────────────────────────── */

  /** mulberry32: small, fast, seedable. */
  function rng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rand) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }

  /** Split indices 0..n-1 by fractions, e.g. {train:.6, val:.2, test:.2}. */
  function split(n, fracs, rand) {
    var idx = shuffle(range(n), rand), keys = Object.keys(fracs), out = {}, at = 0;
    keys.forEach(function (k, i) {
      var take = i === keys.length - 1 ? n - at : Math.round(fracs[k] * n);
      out[k] = idx.slice(at, at + take);
      at += take;
    });
    return out;
  }

  /** k folds of indices: [{train:[…], test:[…]}, …]. */
  function kfold(n, k, rand) {
    var idx = shuffle(range(n), rand), folds = [];
    for (var f = 0; f < k; f++) {
      var test = idx.filter(function (_, i) { return i % k === f; });
      var train = idx.filter(function (_, i) { return i % k !== f; });
      folds.push({ train: train, test: test });
    }
    return folds;
  }

  /** Bootstrap resample of indices (with replacement). */
  function bootstrap(n, rand) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(Math.floor(rand() * n));
    return out;
  }

  /* ── statistics ───────────────────────────────────────── */

  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function mean(a) { return a.length ? sum(a) / a.length : NaN; }
  function variance(a) {
    var m = mean(a), s = 0;
    for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m);
    return a.length > 1 ? s / (a.length - 1) : 0;
  }
  function std(a) { return Math.sqrt(variance(a)); }
  function corr(a, b) {
    var ma = mean(a), mb = mean(b), c = 0, va = 0, vb = 0;
    for (var i = 0; i < a.length; i++) {
      c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) * (a[i] - ma); vb += (b[i] - mb) * (b[i] - mb);
    }
    return c / Math.sqrt(va * vb);
  }
  function quantile(a, q) {
    var s = a.slice().sort(function (x, y) { return x - y; });
    var pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return s[lo] + (s[hi] - s[lo]) * (pos - lo);
  }
  function median(a) { return quantile(a, 0.5); }

  /** Column-wise z-scoring fitted on X; returns {apply(row), invert…, mu, sd}. */
  function scaler(X) {
    var p = X[0].length, mu = [], sd = [];
    for (var j = 0; j < p; j++) {
      var col = X.map(function (r) { return r[j]; });
      mu.push(mean(col));
      sd.push(std(col) || 1);
    }
    return {
      mu: mu, sd: sd,
      apply: function (r) { return r.map(function (v, j) { return (v - mu[j]) / sd[j]; }); },
    };
  }

  /* ── linear algebra (small, dense) ────────────────────── */

  /** Solve A x = b by Gaussian elimination with partial pivoting. */
  function solve(A, b) {
    var n = A.length, M = A.map(function (r, i) { return r.concat([b[i]]); });
    for (var c = 0; c < n; c++) {
      var piv = c;
      for (var r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      var t = M[c]; M[c] = M[piv]; M[piv] = t;
      var d = M[c][c];
      if (Math.abs(d) < 1e-12) d = 1e-12;
      for (var r2 = c + 1; r2 < n; r2++) {
        var f = M[r2][c] / d;
        for (var k = c; k <= n; k++) M[r2][k] -= f * M[c][k];
      }
    }
    var x = new Array(n);
    for (var i = n - 1; i >= 0; i--) {
      var s = M[i][n];
      for (var j = i + 1; j < n; j++) s -= M[i][j] * x[j];
      x[i] = s / (Math.abs(M[i][i]) < 1e-12 ? 1e-12 : M[i][i]);
    }
    return x;
  }

  /* ── models ───────────────────────────────────────────── */

  /**
   * Ordinary / ridge least squares. X: rows of features (no intercept column).
   * lambda penalises the weights, not the intercept.
   */
  function linreg(X, y, opts) {
    var lambda = (opts && opts.lambda) || 0;
    var Xb = X.map(function (r) { return [1].concat(r); }), p = Xb[0].length;
    var A = [], b = [];
    for (var i = 0; i < p; i++) {
      A.push(new Array(p).fill(0)); b.push(0);
    }
    for (var n = 0; n < Xb.length; n++) {
      for (var i2 = 0; i2 < p; i2++) {
        b[i2] += Xb[n][i2] * y[n];
        for (var j = 0; j < p; j++) A[i2][j] += Xb[n][i2] * Xb[n][j];
      }
    }
    for (var k = 1; k < p; k++) A[k][k] += lambda;
    var w = solve(A, b);
    return {
      w: w,
      predict: function (r) { var s = w[0]; for (var q = 0; q < r.length; q++) s += w[q + 1] * r[q]; return s; },
    };
  }

  /**
   * Polynomial fit of y on a single x. x is rescaled to [-1, 1] over [lo, hi]
   * so high degrees stay numerically sane; predict() takes raw x.
   */
  function polyfit(x, y, degree, opts) {
    var lo = (opts && opts.lo != null) ? opts.lo : Math.min.apply(null, x);
    var hi = (opts && opts.hi != null) ? opts.hi : Math.max.apply(null, x);
    var half = (hi - lo) / 2 || 1, mid = (hi + lo) / 2;
    function feats(v) {
      var u = (v - mid) / half, out = [], p = 1;
      for (var d = 1; d <= degree; d++) { p *= u; out.push(p); }
      return out;
    }
    var m = linreg(x.map(feats), y, { lambda: (opts && opts.lambda) || 1e-8 });
    return { degree: degree, w: m.w, predict: function (v) { return m.predict(feats(v)); } };
  }

  function sigmoid(z) { return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z)); }

  /**
   * Logistic regression by full-batch gradient descent. Returns a model whose
   * .step(n) advances training, so pages can animate the descent.
   * X should already be scaled for sensible learning rates.
   */
  function logreg(X, y, opts) {
    opts = opts || {};
    var p = X[0].length, lr = opts.lr || 0.5, lambda = opts.lambda || 0;
    var m = {
      w: opts.w ? opts.w.slice() : new Array(p).fill(0),
      b: opts.b || 0,
      epoch: 0,
      proba: function (r) { var z = m.b; for (var j = 0; j < p; j++) z += m.w[j] * r[j]; return sigmoid(z); },
      loss: function (XX, yy) {
        XX = XX || X; yy = yy || y;
        var s = 0;
        for (var i = 0; i < XX.length; i++) {
          var q = Math.min(Math.max(m.proba(XX[i]), 1e-9), 1 - 1e-9);
          s -= yy[i] * Math.log(q) + (1 - yy[i]) * Math.log(1 - q);
        }
        return s / XX.length;
      },
      step: function (n) {
        for (var e = 0; e < (n || 1); e++) {
          var gw = new Array(p).fill(0), gb = 0;
          for (var i = 0; i < X.length; i++) {
            var err = m.proba(X[i]) - y[i];
            gb += err;
            for (var j = 0; j < p; j++) gw[j] += err * X[i][j];
          }
          for (var j2 = 0; j2 < p; j2++) m.w[j2] -= lr * (gw[j2] / X.length + lambda * m.w[j2]);
          m.b -= lr * gb / X.length;
          m.epoch++;
        }
        return m;
      },
    };
    if (opts.iters) m.step(opts.iters);
    return m;
  }

  /* CART decision tree (binary classification, numeric features). */

  function gini(pos, n) { if (!n) return 0; var q = pos / n; return 2 * q * (1 - q); }
  function entropy(pos, n) {
    if (!n || pos === 0 || pos === n) return 0;
    var q = pos / n;
    return -(q * Math.log2(q) + (1 - q) * Math.log2(1 - q));
  }

  /**
   * Best single split of rows (indices into X/y) over features.
   * Thresholds sit halfway between neighbouring distinct values, as in CART.
   */
  function bestSplit(X, y, idx, features, criterion) {
    var imp = criterion === 'entropy' ? entropy : gini;
    var n = idx.length, posAll = 0;
    idx.forEach(function (i) { posAll += y[i]; });
    var parent = imp(posAll, n), best = null;
    features.forEach(function (f) {
      var s = idx.slice().sort(function (a, b) { return X[a][f] - X[b][f]; });
      var posL = 0;
      for (var k = 0; k < n - 1; k++) {
        posL += y[s[k]];
        var v0 = X[s[k]][f], v1 = X[s[k + 1]][f];
        if (v0 === v1) continue;
        var nL = k + 1, nR = n - nL, posR = posAll - posL;
        var child = (nL * imp(posL, nL) + nR * imp(posR, nR)) / n;
        var gain = parent - child;
        if (!best || gain > best.gain + 1e-12) {
          best = { feature: f, threshold: (v0 + v1) / 2, gain: gain, impurity: parent, child: child };
        }
      }
    });
    return best;
  }

  /**
   * Grow a tree. Nodes: {id, depth, idx, n, pos, impurity, prediction,
   * feature?, threshold?, gain?, left?, right?}. Features are column indices.
   */
  function buildTree(X, y, opts) {
    opts = opts || {};
    var maxDepth = opts.maxDepth == null ? 4 : opts.maxDepth;
    var minLeaf = opts.minLeaf || 1, criterion = opts.criterion || 'gini';
    var features = opts.features || range(X[0].length), nextId = 0;
    var imp = criterion === 'entropy' ? entropy : gini;
    function grow(idx, depth) {
      var pos = 0;
      idx.forEach(function (i) { pos += y[i]; });
      var node = {
        id: nextId++, depth: depth, idx: idx, n: idx.length, pos: pos,
        impurity: imp(pos, idx.length), prediction: pos * 2 >= idx.length ? 1 : 0,
        proba: idx.length ? pos / idx.length : 0,
      };
      if (depth >= maxDepth || node.impurity === 0 || idx.length < 2 * minLeaf) return node;
      var s = bestSplit(X, y, idx, features, criterion);
      if (!s || s.gain <= 1e-12) return node;
      var L = idx.filter(function (i) { return X[i][s.feature] <= s.threshold; });
      var R = idx.filter(function (i) { return X[i][s.feature] > s.threshold; });
      if (L.length < minLeaf || R.length < minLeaf) return node;
      node.feature = s.feature; node.threshold = s.threshold; node.gain = s.gain;
      node.left = grow(L, depth + 1);
      node.right = grow(R, depth + 1);
      return node;
    }
    var rootNode = grow(range(X.length).filter(function (i) { return !opts.rows || opts.rows.indexOf(i) !== -1; }), 0);
    return {
      root: rootNode,
      predict: function (r) { return treeLeaf(rootNode, r).prediction; },
      proba: function (r) { return treeLeaf(rootNode, r).proba; },
      leaf: function (r) { return treeLeaf(rootNode, r); },
      nodes: function () { var out = []; walk(rootNode, function (nd) { out.push(nd); }); return out; },
    };
  }
  function treeLeaf(node, r) {
    while (node.left) node = r[node.feature] <= node.threshold ? node.left : node.right;
    return node;
  }
  function walk(node, fn) { fn(node); if (node.left) { walk(node.left, fn); walk(node.right, fn); } }

  /**
   * A small fully connected network for binary classification.
   * sizes e.g. [2, 4, 1]; hidden activation 'tanh' | 'relu' | 'sigmoid';
   * output is a sigmoid. Trained full-batch with Adam; .step(n) animates.
   */
  function mlp(sizes, opts) {
    opts = opts || {};
    var rand = opts.rand || rng(opts.seed || 7), act = opts.activation || 'tanh';
    var lr = opts.lr || 0.03, lambda = opts.lambda || 0;
    var L = sizes.length - 1, W = [], B = [], mW = [], vW = [], mB = [], vB = [], t = 0;
    for (var l = 0; l < L; l++) {
      var fanIn = sizes[l], fanOut = sizes[l + 1], sc = Math.sqrt(2 / (fanIn + fanOut));
      W.push([]); mW.push([]); vW.push([]);
      for (var o = 0; o < fanOut; o++) {
        var row = [];
        for (var i = 0; i < fanIn; i++) row.push((rand() * 2 - 1) * sc * 1.7);
        W[l].push(row); mW[l].push(new Array(fanIn).fill(0)); vW[l].push(new Array(fanIn).fill(0));
      }
      B.push(new Array(fanOut).fill(0)); mB.push(new Array(fanOut).fill(0)); vB.push(new Array(fanOut).fill(0));
    }
    function f(z) { return act === 'relu' ? Math.max(0, z) : act === 'sigmoid' ? sigmoid(z) : Math.tanh(z); }
    function df(a) { return act === 'relu' ? (a > 0 ? 1 : 0) : act === 'sigmoid' ? a * (1 - a) : 1 - a * a; }
    function forward(x) {
      var acts = [x];
      for (var l2 = 0; l2 < L; l2++) {
        var prev = acts[l2], out = [];
        for (var o2 = 0; o2 < W[l2].length; o2++) {
          var z = B[l2][o2];
          for (var i2 = 0; i2 < prev.length; i2++) z += W[l2][o2][i2] * prev[i2];
          out.push(l2 === L - 1 ? sigmoid(z) : f(z));
        }
        acts.push(out);
      }
      return acts;
    }
    var net = {
      sizes: sizes, W: W, B: B, epoch: 0, activation: act,
      forward: forward,
      proba: function (x) { var a = forward(x); return a[a.length - 1][0]; },
      loss: function (X, y) {
        var s = 0;
        for (var n = 0; n < X.length; n++) {
          var q = Math.min(Math.max(net.proba(X[n]), 1e-9), 1 - 1e-9);
          s -= y[n] * Math.log(q) + (1 - y[n]) * Math.log(1 - q);
        }
        return s / X.length;
      },
      step: function (X, y, epochs) {
        for (var e = 0; e < (epochs || 1); e++) {
          var gW = W.map(function (m) { return m.map(function (r) { return r.map(function () { return 0; }); }); });
          var gB = B.map(function (b) { return b.map(function () { return 0; }); });
          for (var n = 0; n < X.length; n++) {
            var acts = forward(X[n]);
            var delta = [acts[L][0] - y[n]];                   // dLoss/dz at the sigmoid-output
            for (var l3 = L - 1; l3 >= 0; l3--) {
              var prev = acts[l3], next = l3 > 0 ? new Array(prev.length).fill(0) : null;
              for (var o3 = 0; o3 < W[l3].length; o3++) {
                gB[l3][o3] += delta[o3];
                for (var i3 = 0; i3 < prev.length; i3++) {
                  gW[l3][o3][i3] += delta[o3] * prev[i3];
                  if (next) next[i3] += delta[o3] * W[l3][o3][i3];
                }
              }
              if (next) delta = next.map(function (g, k) { return g * df(prev[k]); });
            }
          }
          t++;
          var b1 = 0.9, b2 = 0.999, eps = 1e-8, c1 = 1 - Math.pow(b1, t), c2 = 1 - Math.pow(b2, t);
          for (var l4 = 0; l4 < L; l4++) {
            for (var o4 = 0; o4 < W[l4].length; o4++) {
              for (var i4 = 0; i4 < W[l4][o4].length; i4++) {
                var g = gW[l4][o4][i4] / X.length + lambda * W[l4][o4][i4];
                mW[l4][o4][i4] = b1 * mW[l4][o4][i4] + (1 - b1) * g;
                vW[l4][o4][i4] = b2 * vW[l4][o4][i4] + (1 - b2) * g * g;
                W[l4][o4][i4] -= lr * (mW[l4][o4][i4] / c1) / (Math.sqrt(vW[l4][o4][i4] / c2) + eps);
              }
              var gb = gB[l4][o4] / X.length;
              mB[l4][o4] = b1 * mB[l4][o4] + (1 - b1) * gb;
              vB[l4][o4] = b2 * vB[l4][o4] + (1 - b2) * gb * gb;
              B[l4][o4] -= lr * (mB[l4][o4] / c1) / (Math.sqrt(vB[l4][o4] / c2) + eps);
            }
          }
          net.epoch++;
        }
        return net;
      },
    };
    return net;
  }

  /** k-nearest-neighbour regression on one x (used by bias–variance). */
  function knn1d(x, y, k) {
    return {
      k: k,
      predict: function (v) {
        var d = x.map(function (xi, i) { return [Math.abs(xi - v), y[i]]; });
        d.sort(function (a, b) { return a[0] - b[0]; });
        var kk = Math.min(k, d.length), s = 0;
        for (var i = 0; i < kk; i++) s += d[i][1];
        return s / kk;
      },
    };
  }

  /* ── metrics ──────────────────────────────────────────── */

  function mse(y, yhat) { var s = 0; for (var i = 0; i < y.length; i++) s += (y[i] - yhat[i]) * (y[i] - yhat[i]); return s / y.length; }
  function rmse(y, yhat) { return Math.sqrt(mse(y, yhat)); }
  function mae(y, yhat) { var s = 0; for (var i = 0; i < y.length; i++) s += Math.abs(y[i] - yhat[i]); return s / y.length; }
  function r2(y, yhat) {
    var m = mean(y), ss = 0, sr = 0;
    for (var i = 0; i < y.length; i++) { ss += (y[i] - m) * (y[i] - m); sr += (y[i] - yhat[i]) * (y[i] - yhat[i]); }
    return 1 - sr / ss;
  }
  function accuracy(y, yhat) { var c = 0; for (var i = 0; i < y.length; i++) if (y[i] === yhat[i]) c++; return c / y.length; }

  /** Confusion counts plus the rates people actually quote. */
  function confusion(y, yhat) {
    var tp = 0, fp = 0, tn = 0, fn = 0;
    for (var i = 0; i < y.length; i++) {
      if (yhat[i] === 1) { if (y[i] === 1) tp++; else fp++; }
      else { if (y[i] === 1) fn++; else tn++; }
    }
    var div = function (a, b) { return b ? a / b : NaN; };
    return {
      tp: tp, fp: fp, tn: tn, fn: fn, n: y.length,
      tpr: div(tp, tp + fn), fpr: div(fp, fp + tn), tnr: div(tn, tn + fp), fnr: div(fn, fn + tp),
      precision: div(tp, tp + fp), accuracy: div(tp + tn, y.length), flagged: div(tp + fp, y.length),
    };
  }

  /** ROC points (fpr, tpr, threshold), from strict to lenient. */
  function roc(y, scores) {
    var th = Array.from(new Set(scores)).sort(function (a, b) { return b - a; });
    var pts = [{ fpr: 0, tpr: 0, threshold: Infinity }];
    th.forEach(function (t) {
      var c = confusion(y, scores.map(function (s) { return s >= t ? 1 : 0; }));
      pts.push({ fpr: c.fpr, tpr: c.tpr, threshold: t });
    });
    return pts;
  }
  function auc(pts) {
    var a = 0;
    for (var i = 1; i < pts.length; i++) a += (pts[i].fpr - pts[i - 1].fpr) * (pts[i].tpr + pts[i - 1].tpr) / 2;
    return a;
  }

  /* ── page helpers (browser only) ──────────────────────── */

  /**
   * The MLU-Explain scroll pattern: a sticky graphic beside a column of
   * .ln-step cards. onStep(index, stepEl, direction) fires when a card's
   * top crosses the trigger line (55% down the viewport; 82% on phones).
   * Also fires onProgress(index, 0..1) while a card is on screen, for
   * scrubbed animations.
   */
  function scrolly(container, opts) {
    if (typeof container === 'string') container = document.querySelector(container);
    var steps = Array.prototype.slice.call(container.querySelectorAll('.ln-step'));
    var current = -1;
    /* On phones the graphic pins to the top half, so a card should take over
       as it enters the lower half rather than halfway up the screen. */
    function trigger() {
      if (opts.offset != null) return opts.offset;
      return window.innerWidth <= 860 ? 0.82 : 0.55;
    }
    function activate(i) {
      if (i === current) return;
      var dir = i > current ? 'down' : 'up';
      current = i;
      steps.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
      if (opts.onStep) opts.onStep(i, steps[i], dir);
    }
    function check() {
      var line = window.innerHeight * trigger(), pick = -1;
      steps.forEach(function (s, k) {
        var r = (s.querySelector('.ln-card') || s).getBoundingClientRect();
        if (r.top <= line) pick = k;
        if (opts.onProgress && r.top <= line && r.bottom >= line) {
          opts.onProgress(k, Math.min(1, Math.max(0, (line - r.top) / r.height)));
        }
      });
      activate(Math.max(0, pick));
    }
    /* Browsers already fire scroll at most once per frame; a rAF throttle
       would only add a frame of lag (and stalls in background tabs). */
    function onScroll() { check(); }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    check();
    return { steps: steps, current: function () { return current; }, refresh: check };
  }

  /** One shared tooltip element. */
  var tipEl = null;
  function tooltip() {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'ln-tip';
      tipEl.setAttribute('role', 'tooltip');
      document.body.appendChild(tipEl);
    }
    return {
      show: function (evt, html) {
        tipEl.innerHTML = html;
        tipEl.classList.add('is-on');
        var pad = 14, w = tipEl.offsetWidth, h = tipEl.offsetHeight;
        var x = evt.clientX + pad, y = evt.clientY + pad;
        if (x + w > window.innerWidth - 8) x = evt.clientX - w - pad;
        if (y + h > window.innerHeight - 8) y = evt.clientY - h - pad;
        tipEl.style.transform = 'translate(' + Math.max(8, x) + 'px,' + Math.max(8, y) + 'px)';
      },
      hide: function () { tipEl.classList.remove('is-on'); },
    };
  }

  /** Role colours, read from learn.css custom properties. */
  function color(name) {
    return getComputedStyle(document.documentElement).getPropertyValue('--ln-' + name).trim();
  }

  function fmt(v, d) {
    if (v == null || isNaN(v)) return '–';
    return (+v).toLocaleString('en-IN', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  }
  function pct(v, d) { return fmt(100 * v, d == null ? 0 : d) + '%'; }

  /** Feature label with unit from the data meta, e.g. "Female literacy (%)". */
  function label(meta, key, withUnit) {
    var k = key.split('.').pop(), f = meta.features[k];
    if (!f) return key;
    return withUnit === false ? f.label : f.label + ' (' + f.unit + ')';
  }

  /** Respect reduced-motion for any transition duration. */
  function dur(ms) {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms;
  }

  var SL = {
    loadData: loadData, get: get, rows: rows,
    rng: rng, shuffle: shuffle, range: range, split: split, kfold: kfold, bootstrap: bootstrap,
    sum: sum, mean: mean, variance: variance, std: std, corr: corr, quantile: quantile, median: median,
    scaler: scaler, solve: solve, sigmoid: sigmoid, gini: gini, entropy: entropy,
    models: { linreg: linreg, polyfit: polyfit, logreg: logreg, buildTree: buildTree, bestSplit: bestSplit, mlp: mlp, knn1d: knn1d },
    metrics: { mse: mse, rmse: rmse, mae: mae, r2: r2, accuracy: accuracy, confusion: confusion, roc: roc, auc: auc },
    scrolly: scrolly, tooltip: tooltip, color: color, fmt: fmt, pct: pct, label: label, dur: dur,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SL;
  else root.SL = SL;
})(typeof window !== 'undefined' ? window : this);
