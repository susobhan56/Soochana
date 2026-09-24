/**
 * storyteller/engine/compare.js
 * Multi-series and cross-entity perception: crossovers, gaps,
 * convergence/divergence, rank changes, peer ranking and outliers.
 */
(function (root) {
  'use strict';
  var NS = root.SoochanaInsight = root.SoochanaInsight || {};
  function S() { return NS.stats; }

  /* Pair the two series on the periods they share. Comparing values at
     different periods would invent a relationship the data don't show. */
  function align(a, b) {
    var ca = S().cleanPoints(a.values).points;
    var mb = new Map(S().cleanPoints(b.values).points.map(function (p) { return [p.x, p]; }));
    return ca.filter(function (p) { return mb.has(p.x); }).map(function (p) {
      var q = mb.get(p.x);
      return { x: p.x, label: p.label, a: p.y, b: q.y, status: p.status === 'projected' || q.status === 'projected' ? 'projected' : p.status };
    });
  }

  function detectCrossovers(a, b) {
    var rows = align(a, b);
    var out = [];
    var lastSign = 0, lastRow = null;
    rows.forEach(function (r) {
      var g = r.a - r.b;
      var s = g > 0 ? 1 : g < 0 ? -1 : 0;
      if (s === 0) return;
      if (lastSign && s !== lastSign) {
        var ga = lastRow.a - lastRow.b;
        var t = ga / (ga - g);
        out.push({
          x: lastRow.x + t * (r.x - lastRow.x),
          between: [lastRow.label, r.label],
          leaderBefore: lastSign > 0 ? a.id : b.id,
          leaderAfter: s > 0 ? a.id : b.id,
          status: r.status
        });
      }
      lastSign = s; lastRow = r;
    });
    return out;
  }

  /* Gap between two series at the start and end of their shared period.
     `threshold` is the smallest change in the gap worth narrating. */
  function analyzeGap(a, b, threshold) {
    var rows = align(a, b);
    if (rows.length < 2) return null;
    var first = rows[0], last = rows[rows.length - 1];
    var g0 = Math.abs(first.a - first.b), g1 = Math.abs(last.a - last.b);
    var th = isFinite(threshold) ? threshold
      : Math.max(S().mean(rows.map(function (r) { return (Math.abs(r.a) + Math.abs(r.b)) / 2; })) * 0.03, 1e-9);
    var crossovers = detectCrossovers(a, b);
    var direction = crossovers.length ? 'crossover'
      : g1 - g0 > th ? 'widening' : g0 - g1 > th ? 'narrowing' : 'stable';
    return {
      seriesA: a.id, seriesB: b.id,
      labelA: a.label, labelB: b.label,
      start: { x: first.x, label: first.label, gap: g0, leader: first.a >= first.b ? a.id : b.id },
      end: { x: last.x, label: last.label, gap: g1, leader: last.a >= last.b ? a.id : b.id, status: last.status },
      change: g1 - g0,
      relativeChangePct: g0 ? ((g1 - g0) / g0) * 100 : null,
      direction: direction,
      crossovers: crossovers
    };
  }

  /* Several series: does the spread between them shrink or grow, and
     does their order change between the first and last shared period? */
  function compareGroup(seriesList, opts) {
    opts = opts || {};
    var pairs = [];
    for (var i = 0; i < seriesList.length; i++) {
      for (var j = i + 1; j < seriesList.length; j++) {
        var gap = analyzeGap(seriesList[i], seriesList[j], opts.gapThreshold);
        if (gap) pairs.push(gap);
      }
    }

    var common = null;
    var maps = seriesList.map(function (s) {
      var m = new Map(S().cleanPoints(s.values).points.map(function (p) { return [p.x, p]; }));
      common = common ? common.filter(function (x) { return m.has(x); }) : Array.from(m.keys());
      return m;
    });
    common = (common || []).sort(function (x, y) { return x - y; });

    var spread = null, ranking = null;
    if (common.length >= 2 && seriesList.length >= 2) {
      var x0 = common[0], x1 = common[common.length - 1];
      var v0 = maps.map(function (m) { return m.get(x0).y; });
      var v1 = maps.map(function (m) { return m.get(x1).y; });
      var s0 = S().stdev(v0), s1 = S().stdev(v1);
      spread = {
        start: s0, end: s1,
        direction: s1 < s0 * 0.85 ? 'converging' : s1 > s0 * 1.15 && s1 > 1e-9 ? 'diverging' : 'stable'
      };
      function order(vals) {
        return vals.map(function (v, k) { return { id: seriesList[k].id, v: v }; })
          .sort(function (p, q) { return q.v - p.v; }).map(function (p) { return p.id; });
      }
      var o0 = order(v0), o1 = order(v1);
      ranking = {
        start: o0, end: o1,
        changed: o0.join('|') !== o1.join('|'),
        startLabel: maps[0].get(x0).label, endLabel: maps[0].get(x1).label
      };
    }
    return { pairs: pairs, spread: spread, ranking: ranking };
  }

  /* Rank one entity (a district) among its peers. Position words stay
     descriptive — "among the higher values" — never "best" or "worst". */
  function rankEntities(items, selectedId) {
    var clean = (items || []).filter(function (d) { return d && isFinite(d.value); });
    if (!clean.length) return null;
    var sorted = clean.slice().sort(function (a, b) { return b.value - a.value; });
    var vals = sorted.map(function (d) { return d.value; }).slice().sort(function (a, b) { return a - b; });
    var q1 = S().quantile(vals, 0.25), q3 = S().quantile(vals, 0.75), iqr = q3 - q1;
    var lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
    var outliers = sorted.filter(function (d) { return d.value < lo || d.value > hi; })
      .map(function (d) { return { id: d.id, label: d.label || d.id, value: d.value, side: d.value > hi ? 'high' : 'low' }; });

    var idx = sorted.findIndex(function (d) { return d.id === selectedId; });
    var n = sorted.length;
    var selected = null;
    if (idx !== -1) {
      var rank = idx + 1;
      var band = rank <= Math.ceil(n * 0.2) ? 'among_highest'
        : rank > n - Math.ceil(n * 0.2) ? 'among_lowest' : 'middle';
      selected = {
        id: selectedId, rank: rank, of: n, value: sorted[idx].value, band: band,
        vsMedian: sorted[idx].value - S().median(vals),
        isOutlier: outliers.some(function (o) { return o.id === selectedId; })
      };
    }
    return {
      n: n,
      highest: { id: sorted[0].id, label: sorted[0].label || sorted[0].id, value: sorted[0].value },
      lowest: { id: sorted[n - 1].id, label: sorted[n - 1].label || sorted[n - 1].id, value: sorted[n - 1].value },
      median: S().median(vals),
      mean: S().mean(vals),
      outliers: outliers,
      selected: selected
    };
  }

  NS.compare = {
    align: align,
    detectCrossovers: detectCrossovers,
    analyzeGap: analyzeGap,
    compareGroup: compareGroup,
    rankEntities: rankEntities
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = NS.compare;
})(typeof window !== 'undefined' ? window : globalThis);
