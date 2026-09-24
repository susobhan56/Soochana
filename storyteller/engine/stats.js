/**
 * storyteller/engine/stats.js
 * Numeric primitives for the Soochana insight engine.
 *
 * Every engine file attaches itself to one global namespace,
 * `SoochanaInsight`, so the same source runs as a plain <script> in the
 * portal and under `node --test` without a build step.
 */
(function (root) {
  'use strict';
  var NS = root.SoochanaInsight = root.SoochanaInsight || {};

  /* "12,74,000", " 45.4 ", 45.4 all become numbers; null, "", "--" and
     booleans do not. Numbers stored as strings are a known hazard in the
     district sheets, so the coercion is explicit rather than implicit. */
  function toNumber(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    if (typeof v !== 'string') return NaN;
    var s = v.replace(/,/g, '').trim();
    if (!s || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
    return parseFloat(s);
  }

  /* Periods arrive as 2011, "2011", "2015-16 (NFHS-4)" or "1970-75".
     The numeric position is the first four-digit year; the original text
     is kept as the display label so narration never rewrites a period. */
  function parsePeriod(x) {
    if (typeof x === 'number' && isFinite(x)) return { x: x, label: String(x) };
    var s = String(x == null ? '' : x).trim();
    var m = s.match(/(1[89]\d\d|20\d\d)/);
    if (m) return { x: +m[1], label: s };
    var n = toNumber(s);
    return isFinite(n) ? { x: n, label: s } : { x: NaN, label: s };
  }

  /* Validate and normalise a list of {x, y, status, label} points.
     Returns the clean, x-sorted points plus human-readable warnings, so a
     narration built on doubtful data can say so rather than hide it. */
  function cleanPoints(points) {
    var warnings = [];
    var byX = new Map();
    var dropped = 0;

    (points || []).forEach(function (p) {
      if (!p) { dropped++; return; }
      var per = p.x != null && typeof p.x === 'number' && p.label
        ? { x: p.x, label: String(p.label) }
        : parsePeriod(p.x);
      var y = toNumber(p.y);
      if (!isFinite(per.x) || !isFinite(y)) { dropped++; return; }
      if (byX.has(per.x)) warnings.push('duplicate period ' + per.label + ' (last value kept)');
      byX.set(per.x, {
        x: per.x,
        y: y,
        label: per.label,
        status: p.status || 'observed'
      });
    });

    if (dropped) warnings.push(dropped + ' missing or non-numeric value' + (dropped > 1 ? 's' : '') + ' skipped');
    var clean = Array.from(byX.values()).sort(function (a, b) { return a.x - b.x; });
    if (clean.some(function (p) { return p.y < 0; })) warnings.push('series contains negative values');
    return { points: clean, warnings: warnings };
  }

  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function mean(a) { return a.length ? sum(a) / a.length : NaN; }

  function quantile(sorted, q) {
    if (!sorted.length) return NaN;
    var pos = (sorted.length - 1) * q;
    var lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  function median(a) {
    return quantile(a.slice().sort(function (x, y) { return x - y; }), 0.5);
  }

  function stdev(a) {
    if (a.length < 2) return 0;
    var m = mean(a);
    return Math.sqrt(sum(a.map(function (v) { return (v - m) * (v - m); })) / (a.length - 1));
  }

  /* Ordinary least squares on (x, y). r2 is the share of variance the
     straight line explains — a cheap "how linear is this" signal. */
  function linearRegression(points) {
    var n = points.length;
    if (n < 2) return { slope: 0, intercept: n ? points[0].y : NaN, r2: 0 };
    var mx = mean(points.map(function (p) { return p.x; }));
    var my = mean(points.map(function (p) { return p.y; }));
    var sxx = 0, sxy = 0, syy = 0;
    points.forEach(function (p) {
      sxx += (p.x - mx) * (p.x - mx);
      sxy += (p.x - mx) * (p.y - my);
      syy += (p.y - my) * (p.y - my);
    });
    var slope = sxx ? sxy / sxx : 0;
    var r2 = (sxx && syy) ? (sxy * sxy) / (sxx * syy) : (syy === 0 ? 1 : 0);
    return { slope: slope, intercept: my - slope * mx, r2: r2 };
  }

  /* Change per unit of x between consecutive points. Dividing by the gap
     keeps irregular spacing (1901…1931, 1936, 1941…) from reading as a
     sudden jump or stall. */
  function intervalRates(points) {
    var out = [];
    for (var i = 1; i < points.length; i++) {
      var dx = points[i].x - points[i - 1].x;
      out.push({
        from: points[i - 1], to: points[i],
        delta: points[i].y - points[i - 1].y,
        rate: dx ? (points[i].y - points[i - 1].y) / dx : 0
      });
    }
    return out;
  }

  /* Linear interpolation of the x at which y crosses `level` between two
     points. Used for "falls below replacement around 2019". */
  function crossingX(a, b, level) {
    if (a.y === b.y) return a.x;
    return a.x + (level - a.y) * (b.x - a.x) / (b.y - a.y);
  }

  function round(v, dp) {
    if (!isFinite(v)) return v;
    var f = Math.pow(10, dp == null ? 2 : dp);
    return Math.round(v * f) / f;
  }

  /* Tiny stable hash (FNV-1a). Used for cache keys and for choosing a
     narration opening deterministically, so the same chart always reads
     the same way. */
  function hash(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(36);
  }

  NS.stats = {
    toNumber: toNumber,
    parsePeriod: parsePeriod,
    cleanPoints: cleanPoints,
    sum: sum,
    mean: mean,
    median: median,
    quantile: quantile,
    stdev: stdev,
    linearRegression: linearRegression,
    intervalRates: intervalRates,
    crossingX: crossingX,
    round: round,
    hash: hash
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = NS.stats;
})(typeof window !== 'undefined' ? window : globalThis);
