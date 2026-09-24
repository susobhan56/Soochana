/**
 * storyteller/engine/pyramid.js
 * Population-pyramid perception: shape, base width, working-age bulge,
 * ageing, sex balance by age, and change between years.
 *
 * Input: { years: { "2011": [{ age: "0-4", male, female }, …], … },
 *          statusOf?: year => 'observed' | 'projected' }
 */
(function (root) {
  'use strict';
  var NS = root.SoochanaInsight = root.SoochanaInsight || {};
  function S() { return NS.stats; }

  /* Lower bound of an age band: "0-4" → 0, "80+" → 80, "80 & above" → 80. */
  function bandStart(age) {
    var m = String(age).match(/\d+/);
    return m ? +m[0] : NaN;
  }
  function bandEnd(age) {
    var s = String(age);
    var m = s.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (m) return +m[2] + 1;
    return bandStart(age) + 10; /* open-ended top band: assume ten years */
  }

  var AGE_BAND = /^(\d{1,3}\s*[-–]\s*\d{1,3}|\d{1,3}\s*\+|\d{1,3}\s*(&|and)?\s*(above|over))$/i;

  function normaliseYear(rows) {
    var clean = (rows || []).map(function (r) {
      return {
        age: String(r.age),
        start: bandStart(r.age),
        end: bandEnd(r.age),
        male: S().toNumber(r.male),
        female: S().toNumber(r.female)
      };
    }).filter(function (r) {
      /* Only real age bands: "0-4", "80+", "80 & above". Spreadsheet
         exports sometimes append stray rows whose "age" is a number. */
      return AGE_BAND.test(r.age.trim()) && r.start < 120 &&
        isFinite(r.male) && isFinite(r.female);
    });
    clean.sort(function (a, b) { return a.start - b.start; });
    var total = S().sum(clean.map(function (r) { return r.male + r.female; }));
    clean.forEach(function (r) {
      r.total = r.male + r.female;
      r.share = total ? (r.total / total) * 100 : 0;
      r.maleShare = total ? (r.male / total) * 100 : 0;
      r.femaleShare = total ? (r.female / total) * 100 : 0;
    });
    return { bands: clean, total: total };
  }

  function shareBetween(bands, lo, hi) {
    return S().sum(bands.filter(function (b) { return b.start >= lo && b.start < hi; }).map(function (b) { return b.share; }));
  }

  /* Median age by linear interpolation within the band that holds the
     50th percentile — coarse, but consistent across years, which is what
     a comparison needs. */
  function medianAge(bands) {
    var acc = 0;
    for (var i = 0; i < bands.length; i++) {
      if (acc + bands[i].share >= 50) {
        var within = (50 - acc) / (bands[i].share || 1);
        return bands[i].start + within * (bands[i].end - bands[i].start);
      }
      acc += bands[i].share;
    }
    return NaN;
  }

  /* Shape from the width of the base against the middle:
     expansive (base widest), constrictive (base narrower than the
     middle — the bulge has moved up), stationary (roughly even). */
  function shapeOf(bands) {
    var base = S().mean(bands.filter(function (b) { return b.start < 10; }).map(function (b) { return b.share; }));
    var middle = S().mean(bands.filter(function (b) { return b.start >= 20 && b.start < 45; }).map(function (b) { return b.share; }));
    var ratio = middle ? base / middle : NaN;
    var shape = ratio > 1.1 ? 'expansive' : ratio < 0.9 ? 'constrictive' : 'stationary';
    return { shape: shape, baseToMiddle: ratio };
  }

  function describeYear(year, rows, status) {
    var y = normaliseYear(rows);
    var b = y.bands;
    if (!b.length) return null;
    var modal = b.reduce(function (m, r) { return r.share > m.share ? r : m; }, b[0]);
    var males = S().sum(b.map(function (r) { return r.male; }));
    var females = S().sum(b.map(function (r) { return r.female; }));
    /* Bands where one sex outnumbers the other by more than 8%. Very
       small bands are skipped: a gap of a few hundred people is noise. */
    var imbalances = b.filter(function (r) { return r.share >= 1 && r.male && r.female; })
      .map(function (r) { return { age: r.age, start: r.start, ratio: (r.female / r.male) * 1000 }; })
      .filter(function (r) { return Math.abs(r.ratio - 1000) > 80; });
    var sh = shapeOf(b);
    return {
      year: String(year),
      status: status || 'observed',
      total: y.total,
      youngShare: shareBetween(b, 0, 15),
      workingShare: shareBetween(b, 15, 60),
      elderlyShare: shareBetween(b, 60, 200),
      baseShare: shareBetween(b, 0, 5),
      modalBand: modal.age.replace(/(\d)\s*-\s*(\d)/, '$1–$2'),
      modalStart: modal.start,
      medianAge: medianAge(b),
      shape: sh.shape,
      baseToMiddle: sh.baseToMiddle,
      sexRatio: males ? (females / males) * 1000 : NaN,
      imbalances: imbalances,
      bands: b.map(function (r) { return { age: r.age, share: r.share, maleShare: r.maleShare, femaleShare: r.femaleShare }; })
    };
  }

  function analyzePyramid(input, opts) {
    opts = opts || {};
    var statusOf = input.statusOf || function () { return 'observed'; };
    var years = Object.keys(input.years || {}).sort(function (a, b) { return bandStart(a) - bandStart(b); });
    var described = years.map(function (y) { return describeYear(y, input.years[y], statusOf(y)); }).filter(Boolean);
    if (!described.length) return { insufficient: true };

    var first = described[0], last = described[described.length - 1];
    var focus = opts.focusYear
      ? described.find(function (d) { return d.year === String(opts.focusYear); }) || last
      : last;

    function change(a, b) {
      if (!a || !b || a === b) return null;
      return {
        from: a.year, to: b.year, toStatus: b.status,
        youngPP: b.youngShare - a.youngShare,
        workingPP: b.workingShare - a.workingShare,
        elderlyPP: b.elderlyShare - a.elderlyShare,
        basePP: b.baseShare - a.baseShare,
        medianAgeChange: b.medianAge - a.medianAge,
        modalShift: b.modalStart - a.modalStart,
        shapeChange: a.shape !== b.shape ? [a.shape, b.shape] : null,
        totalChangePct: a.total ? ((b.total - a.total) / a.total) * 100 : null
      };
    }

    var overall = change(first, last);
    var patterns = [];
    if (overall) {
      if (overall.basePP <= -0.5 || overall.youngPP <= -2) patterns.push('narrowing_base');
      if (overall.basePP >= 0.5 || overall.youngPP >= 2) patterns.push('broadening_base');
      if (overall.elderlyPP >= 2) patterns.push('expanding_top');
      if (overall.modalShift >= 10) patterns.push('bulge_moves_up');
      if (overall.medianAgeChange >= 2) patterns.push('ageing');
      if (overall.workingPP >= 2) patterns.push('working_age_bulge');
      if (overall.totalChangePct != null && overall.totalChangePct < -2) patterns.push('contracting');
      if (overall.totalChangePct != null && overall.totalChangePct > 2) patterns.push('expanding');
    }
    var elderlyFemaleSurplus = focus.imbalances.filter(function (r) { return r.start >= 60 && r.ratio > 1000; }).length >= 2;

    return {
      years: described.map(function (d) { return d.year; }),
      first: first,
      last: last,
      focus: focus,
      overall: overall,
      focusChange: change(first, focus),
      patterns: patterns,
      elderlyFemaleSurplus: elderlyFemaleSurplus,
      dataStatus: described.some(function (d) { return d.status === 'projected'; })
        ? (described.some(function (d) { return d.status !== 'projected'; }) ? 'historical_plus_projected' : 'projected')
        : 'observed'
    };
  }

  /* The age-structure story (young / working / elderly shares over time)
     is derived from the same pyramids, so both narrations agree. */
  function toAgeStructureSeries(input, meta) {
    meta = meta || {};
    var statusOf = input.statusOf || function () { return 'observed'; };
    var years = Object.keys(input.years || {});
    var rows = years.map(function (y) { return describeYear(y, input.years[y], statusOf(y)); }).filter(Boolean);
    function series(id, label, key, role) {
      return {
        id: id, label: label, role: role, unit: '%', unitKind: 'percent',
        source: meta.source, geography: meta.geography,
        values: rows.map(function (r) { return { x: +r.year, label: r.year, y: S().round(r[key], 2), status: r.status }; })
      };
    }
    return [
      series('young', 'Young (0–14)', 'youngShare', 'young_share'),
      series('working', 'Working age (15–59)', 'workingShare', 'working_share'),
      series('elderly', 'Elderly (60+)', 'elderlyShare', 'elderly_share')
    ];
  }

  NS.pyramid = {
    analyzePyramid: analyzePyramid,
    describeYear: describeYear,
    toAgeStructureSeries: toAgeStructureSeries,
    bandStart: bandStart
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = NS.pyramid;
})(typeof window !== 'undefined' ? window : globalThis);
