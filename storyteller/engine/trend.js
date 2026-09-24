/**
 * storyteller/engine/trend.js
 * Single-series perception: direction, strength, shape, extremes,
 * turning points, pace, reference-line crossings and data status.
 *
 * Input is an AnalyticalSeries (see DATA_MODEL.md). Output is a plain,
 * JSON-serialisable profile. Nothing here writes prose — that is the job
 * of rules.js and narrate.js — so the same profile can feed the template
 * narrator, the LLM prompt and the tests.
 */
(function (root) {
  'use strict';
  var NS = root.SoochanaInsight = root.SoochanaInsight || {};

  var PROJECTED = { projected: 1, modelled: 1 };

  function S() { return NS.stats; }

  /* The smallest end-to-end change that counts as a real movement.
     Per-indicator thresholds belong in the story registry (a sex ratio
     moving 5 points is noise; a TFR moving 0.3 is not). The defaults are
     1 percentage point for shares and 3% of the series' typical level for
     everything else. */
  function meaningfulThreshold(series, points) {
    if (isFinite(series.minChange)) return series.minChange;
    if (series.unitKind === 'percent') return 1;
    var typical = S().mean(points.map(function (p) { return Math.abs(p.y); }));
    return Math.max(typical * 0.03, 1e-9);
  }

  function sign(v, eps) { return v > eps ? 1 : v < -eps ? -1 : 0; }

  /* Collapse the step-by-step movement into "runs" of rising or falling,
     then fold away runs too small to matter. What survives is the
     structure a reader would actually see: up, then down, then up. */
  function buildRuns(points, threshold) {
    var eps = threshold * 0.1;
    var runs = [];
    for (var i = 1; i < points.length; i++) {
      var s = sign(points[i].y - points[i - 1].y, eps);
      var last = runs[runs.length - 1];
      if (last && (s === 0 || s === last.sign)) {
        last.end = i;
      } else if (s === 0) {
        /* flat before any movement: hold it until a direction appears */
        if (!last) runs.push({ sign: 0, start: i - 1, end: i });
        else last.end = i;
      } else if (last && last.sign === 0) {
        last.sign = s; last.end = i;
      } else {
        runs.push({ sign: s, start: i - 1, end: i });
      }
    }
    function mag(r) { return points[r.end].y - points[r.start].y; }

    var materiality = threshold * 0.5;
    var changed = true;
    while (changed && runs.length > 1) {
      changed = false;
      var smallest = -1, smallMag = Infinity;
      runs.forEach(function (r, k) {
        var m = Math.abs(mag(r));
        if (m < materiality && m < smallMag) { smallest = k; smallMag = m; }
      });
      if (smallest === -1) break;
      var prev = runs[smallest - 1], next = runs[smallest + 1], cur = runs[smallest];
      if (prev && next && prev.sign === next.sign) {
        prev.end = next.end;
        runs.splice(smallest, 2);
      } else if (prev && (!next || Math.abs(mag(prev)) >= Math.abs(mag(next)))) {
        prev.end = cur.end;
        runs.splice(smallest, 1);
      } else if (next) {
        next.start = cur.start;
        runs.splice(smallest, 1);
      }
      changed = true;
    }
    runs.forEach(function (r) {
      r.magnitude = mag(r);
      r.sign = sign(r.magnitude, 0);
    });
    return runs.filter(function (r) { return r.sign !== 0 || runs.length === 1; });
  }

  function turningPointsFrom(points, runs) {
    var out = [];
    for (var k = 0; k < runs.length - 1; k++) {
      var a = runs[k], b = runs[k + 1];
      if (a.sign === b.sign || !a.sign || !b.sign) continue;
      var isPeak = a.sign > 0;
      var best = a.start;
      for (var i = a.start; i <= b.end; i++) {
        if (isPeak ? points[i].y > points[best].y : points[i].y < points[best].y) best = i;
      }
      out.push({
        x: points[best].x,
        label: points[best].label,
        value: points[best].y,
        status: points[best].status,
        type: isPeak ? 'peak' : 'trough',
        from: isPeak ? 'increase' : 'decrease',
        to: isPeak ? 'decrease' : 'increase'
      });
    }
    return out;
  }

  function valueAt(points, x) {
    for (var i = 1; i < points.length; i++) {
      if (x <= points[i].x) {
        var a = points[i - 1], b = points[i];
        return a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
      }
    }
    return points[points.length - 1].y;
  }

  /* Early-half vs late-half average rate, measured in x units so uneven
     spacing does not distort it. */
  function pace(points) {
    if (points.length < 3) return null;
    var x0 = points[0].x, x1 = points[points.length - 1].x;
    var xm = (x0 + x1) / 2;
    var ym = valueAt(points, xm);
    var early = (ym - points[0].y) / (xm - x0);
    var late = (points[points.length - 1].y - ym) / (x1 - xm);
    var ratio = early !== 0 ? late / early : null;
    return { earlyRate: early, lateRate: late, ratio: ratio, midpoint: xm };
  }

  function classifyStatus(points) {
    var projected = points.filter(function (p) { return PROJECTED[p.status]; });
    var others = points.filter(function (p) { return !PROJECTED[p.status]; });
    var kind = !projected.length ? 'observed'
      : !others.length ? 'projected'
      : 'historical_plus_projected';
    var lastObserved = others.length ? others[others.length - 1] : null;
    var firstProjected = projected.length ? projected[0] : null;
    return {
      dataStatus: kind,
      lastObserved: lastObserved && { x: lastObserved.x, label: lastObserved.label, value: lastObserved.y, status: lastObserved.status },
      firstProjected: firstProjected && { x: firstProjected.x, label: firstProjected.label, value: firstProjected.y },
      statuses: Array.from(new Set(points.map(function (p) { return p.status; })))
    };
  }

  function phase(points, threshold) {
    if (points.length < 2) return null;
    var a = points[0], b = points[points.length - 1];
    var d = b.y - a.y;
    return {
      start: { x: a.x, label: a.label, value: a.y },
      end: { x: b.x, label: b.label, value: b.y },
      absoluteChange: d,
      direction: Math.abs(d) < threshold ? 'stable' : d > 0 ? 'increasing' : 'decreasing'
    };
  }

  /* Crossings of each declared reference line (replacement fertility
     2.1, sex-ratio parity 1000 …). A crossing is a sign change of
     (value − reference) between consecutive points. */
  function referenceCrossings(points, references) {
    return (references || []).map(function (ref) {
      var crossings = [];
      for (var i = 1; i < points.length; i++) {
        var a = points[i - 1].y - ref.value, b = points[i].y - ref.value;
        if (a !== 0 && b !== 0 && (a > 0) !== (b > 0)) {
          var cx = S().crossingX(points[i - 1], points[i], ref.value);
          crossings.push({
            x: cx,
            approxYear: Math.round(cx),
            between: [points[i - 1].label, points[i].label],
            direction: b < a ? 'below' : 'above',
            status: PROJECTED[points[i].status] ? 'projected' : points[i].status
          });
        }
      }
      var first = points[0].y, last = points[points.length - 1].y;
      return {
        label: ref.label,
        value: ref.value,
        /* the most recent crossing is the one that explains where the
           series ends up; all of them are kept for the evidence */
        crossing: crossings.length ? crossings[crossings.length - 1] : null,
        crossings: crossings,
        startPosition: first > ref.value ? 'above' : first < ref.value ? 'below' : 'at',
        endPosition: last > ref.value ? 'above' : last < ref.value ? 'below' : 'at',
        endDistance: last - ref.value
      };
    });
  }

  function confidenceFor(n, series, warnings, direction) {
    var level = n >= 5 ? 2 : n >= 3 ? 1 : (n === 2 && series.surveyRounds ? 1 : 0);
    if (!series.source) level--;
    if (warnings.length) level--;
    if (direction === 'mixed' && n < 5) level--;
    level = Math.max(0, Math.min(2, level));
    return ['low', 'medium', 'high'][level];
  }

  function analyzeSeries(series, opts) {
    opts = opts || {};
    var cleaned = S().cleanPoints(series.values);
    var pts = cleaned.points;
    /* `warnings` are data-quality problems and lower confidence;
       `notes` are properties of the data (a growth rate may be negative). */
    var warnings = cleaned.warnings.filter(function (w) { return !/negative/.test(w); });
    var notes = cleaned.warnings.filter(function (w) { return /negative/.test(w); });
    var base = {
      id: series.id,
      label: series.label,
      role: series.role || null,
      unit: series.unit || '',
      unitKind: series.unitKind || 'value',
      format: series.format || (series.unitKind === 'percent' ? 'percent' : 'value'),
      subject: series.subject || null,
      polarity: series.polarity || null,
      geography: series.geography || null,
      source: series.source || null,
      n: pts.length,
      warnings: warnings,
      notes: notes
    };

    if (pts.length < 2) {
      base.insufficient = true;
      base.direction = null;
      base.confidence = 'low';
      if (pts.length === 1) base.start = base.end = { x: pts[0].x, label: pts[0].label, value: pts[0].y, status: pts[0].status };
      return base;
    }

    var first = pts[0], last = pts[pts.length - 1];
    var threshold = meaningfulThreshold(series, pts);
    var abs = last.y - first.y;
    var values = pts.map(function (p) { return p.y; });
    var maxV = Math.max.apply(null, values), minV = Math.min.apply(null, values);
    var iMax = values.indexOf(maxV), iMin = values.indexOf(minV);
    var range = maxV - minV;

    var relative = null;
    if (Math.abs(first.y) < 1e-9) notes.push('relative change undefined: series starts at zero');
    else if (first.y < 0 || last.y < 0) notes.push('relative change not meaningful across negative values');
    else relative = (abs / first.y) * 100;

    var runs = buildRuns(pts, threshold);
    var turningPoints = turningPointsFrom(pts, runs);
    var reg = S().linearRegression(pts);

    var direction;
    if (Math.abs(abs) < threshold) {
      direction = range < threshold * 1.5 ? 'stable' : 'mixed';
    } else if (runs.length <= 1) {
      direction = abs > 0 ? 'increasing' : 'decreasing';
    } else {
      var along = 0, against = 0;
      runs.forEach(function (r) {
        if ((r.magnitude > 0) === (abs > 0)) along += Math.abs(r.magnitude);
        else against += Math.abs(r.magnitude);
      });
      direction = against <= along * 0.25 ? (abs > 0 ? 'increasing' : 'decreasing') : 'mixed';
    }
    /* A direction that "wins" despite a real reversal keeps the reversal
       visible to the narrator via turningPoints and `interrupted`. */
    var interrupted = (direction === 'increasing' || direction === 'decreasing') && turningPoints.length > 0;

    var effect = Math.abs(abs) / threshold;
    var strength = direction === 'stable' ? 'weak'
      : effect >= 4 && (runs.length === 1 || reg.r2 >= 0.7) ? 'strong'
      : effect >= 2 ? 'moderate' : 'weak';

    var pc = pace(pts);
    var shape;
    if (direction === 'stable') shape = 'plateau';
    else if (turningPoints.length === 1) shape = turningPoints[0].type === 'peak' ? 'inverted_u' : 'u_shaped';
    else if (turningPoints.length >= 2) shape = 'fluctuating';
    else {
      var kind = abs > 0 ? 'increase' : 'decrease';
      var r = pc && pc.ratio;
      if (r == null || pts.length < 3) shape = 'linear_' + kind;
      else if (r > 1.3) shape = 'accelerating_' + kind;
      else if (r < 0.75) shape = 'decelerating_' + kind;
      else shape = 'linear_' + kind;
    }

    var events = [];
    var rates = S().intervalRates(pts);
    if (pts.length >= 4) {
      var totalMove = S().sum(rates.map(function (q) { return Math.abs(q.delta); }));
      var medRate = S().median(rates.map(function (q) { return Math.abs(q.rate); }));
      var medGap = S().median(rates.map(function (q) { return q.to.x - q.from.x; }));
      rates.forEach(function (q) {
        /* Sudden = a large jump within a normal-length interval. A big
           change across a long gap in the data is not "sudden". */
        if (totalMove && Math.abs(q.delta) >= totalMove * 0.5 && medRate && Math.abs(q.rate) >= medRate * 3 &&
            (q.to.x - q.from.x) <= medGap * 1.5) {
          events.push({ type: 'sudden_change', from: q.from.label, to: q.to.label, delta: q.delta });
        }
      });
    }
    if ((direction === 'increasing' || direction === 'decreasing') && rates.length >= 3) {
      var lastRate = Math.abs(rates[rates.length - 1].rate);
      var typicalRate = S().median(rates.slice(0, -1).map(function (q) { return Math.abs(q.rate); }));
      if (typicalRate && lastRate < typicalRate * 0.35) events.push({ type: 'levelling_off', at: rates[rates.length - 1].from.label });
    }

    var peak = (iMax > 0 && iMax < pts.length - 1 && maxV - Math.max(first.y, last.y) >= threshold * 0.5)
      ? { x: pts[iMax].x, label: pts[iMax].label, value: maxV, status: pts[iMax].status } : null;
    var trough = (iMin > 0 && iMin < pts.length - 1 && Math.min(first.y, last.y) - minV >= threshold * 0.5)
      ? { x: pts[iMin].x, label: pts[iMin].label, value: minV, status: pts[iMin].status } : null;

    var status = classifyStatus(pts);
    var observedPts = pts.filter(function (p) { return !PROJECTED[p.status]; });
    var projectedPts = pts.filter(function (p) { return PROJECTED[p.status]; });
    if (status.lastObserved && projectedPts.length) {
      projectedPts = [observedPts[observedPts.length - 1]].concat(projectedPts);
    }

    var cagr = null;
    if (series.unitKind === 'count' && first.y > 0 && last.y > 0 && last.x > first.x) {
      cagr = (Math.pow(last.y / first.y, 1 / (last.x - first.x)) - 1) * 100;
    }

    base.threshold = threshold;
    base.start = { x: first.x, label: first.label, value: first.y, status: first.status };
    base.end = { x: last.x, label: last.label, value: last.y, status: last.status };
    base.absoluteChange = abs;
    base.relativeChangePct = relative;
    base.percentagePointChange = series.unitKind === 'percent' ? abs : null;
    base.cagrPct = cagr;
    base.direction = direction;
    base.netDirection = Math.abs(abs) < threshold ? 'flat' : abs > 0 ? 'up' : 'down';
    base.interrupted = interrupted;
    base.strength = strength;
    base.shape = shape;
    base.slope = reg.slope;
    base.r2 = reg.r2;
    base.pace = pc;
    base.highest = { x: pts[iMax].x, label: pts[iMax].label, value: maxV, status: pts[iMax].status };
    base.lowest = { x: pts[iMin].x, label: pts[iMin].label, value: minV, status: pts[iMin].status };
    base.peak = peak;
    base.trough = trough;
    base.turningPoints = turningPoints;
    base.events = events;
    base.dataStatus = series.surveyRounds && status.dataStatus === 'observed' ? 'survey_rounds' : status.dataStatus;
    base.statusDetail = status;
    base.phases = {
      observed: phase(observedPts, threshold),
      projected: phase(projectedPts, threshold)
    };
    base.references = referenceCrossings(pts, series.references);
    base.surveyRounds = !!series.surveyRounds;
    base.confidence = confidenceFor(pts.length, series, warnings, direction);
    return base;
  }

  NS.trend = { analyzeSeries: analyzeSeries, meaningfulThreshold: meaningfulThreshold };
  if (typeof module !== 'undefined' && module.exports) module.exports = NS.trend;
})(typeof window !== 'undefined' ? window : globalThis);
