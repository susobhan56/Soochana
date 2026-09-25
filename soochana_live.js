/**
 * soochana_live.js — the live population estimate and the district map,
 * shared by the home page welcome screen (index.html) and the guided
 * tour (explore.html).
 *
 * Reads the site's own data:
 *   datasets/district_population_trends.json  population by district, 1951–2036
 *   Orissa.geojson                            district boundaries
 * Needs d3 for the map. Exposes window.SoochanaLive.
 */
(function () {
  'use strict';

  var YEAR_MS = 365.2425 * 864e5;
  /* The boundary file and the data file spell two districts differently. */
  var GEO_TO_DATA = { Balangir: 'Bolangir', Nabarangapur: 'Nabarangpur' };

  var L = {
    data: null,
    geo: null,
    years: [],
    YEAR_MS: YEAR_MS,
    reduce: window.matchMedia('(prefers-reduced-motion: reduce)').matches
  };

  var loading = null;
  L.load = function () {
    if (!loading) {
      loading = Promise.all([
        fetch('datasets/district_population_trends.json').then(function (r) { return r.json(); }),
        fetch('Orissa.geojson').then(function (r) { return r.json(); })
      ]).then(function (res) {
        L.data = res[0];
        L.geo = res[1];
        L.years = Object.keys(L.data[Object.keys(L.data)[0]]).map(Number).sort(function (a, b) { return a - b; });
        return L;
      });
    }
    return loading;
  };

  /* ── numbers ─────────────────────────────────────────── */
  L.fmt = function (n) { return Math.round(n).toLocaleString('en-IN'); };
  L.crore = function (n) { return (n / 1e7).toFixed(2) + ' crore'; };
  L.lakh = function (n, d) { return (n / 1e5).toFixed(d == null ? 1 : d).replace(/\.0$/, '') + ' lakh'; };
  L.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  L.easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  /* Gentle at both ends: no lurch at the start, a long soft landing. */
  L.easeInOut = function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; };

  L.tween = function (from, to, ms, step, done, ease) {
    ease = ease || L.easeOut;
    if (L.reduce || ms <= 0) { step(to); if (done) done(); return function () {}; }
    var start = null, stopped = false;
    function frame(ts) {
      if (stopped) return;
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / ms);
      step(from + (to - from) * ease(t));
      if (t < 1) requestAnimationFrame(frame); else if (done) done();
    }
    requestAnimationFrame(frame);
    return function () { stopped = true; };
  };

  /* ── population ──────────────────────────────────────── */
  /* Population between two data years grows at a steady rate, so
     interpolate geometrically rather than in a straight line. */
  function series(get, y) {
    var ys = L.years;
    y = L.clamp(y, ys[0], ys[ys.length - 1]);
    for (var i = 0; i < ys.length - 1; i++) {
      if (y <= ys[i + 1]) {
        var a = get(ys[i]), b = get(ys[i + 1]);
        var f = (y - ys[i]) / (ys[i + 1] - ys[i]);
        return a * Math.pow(b / a, f);
      }
    }
    return get(ys[ys.length - 1]);
  }

  var stateCache = {};
  L.stateAt = function (yr) {
    if (!(yr in stateCache)) {
      var s = 0;
      for (var d in L.data) s += L.data[d][yr].total;
      stateCache[yr] = s;
    }
    return stateCache[yr];
  };
  L.statePop = function (y) { return series(L.stateAt, y); };
  L.districtPop = function (name, y) {
    var d = L.data[name];
    return d ? series(function (yr) { return d[yr].total; }, y) : 0;
  };
  /* average yearly growth between two data years, in per cent */
  L.rate = function (a, b) { return (Math.log(L.stateAt(b) / L.stateAt(a)) / (b - a) * 100).toFixed(1); };

  /* Census and projection figures refer to 1 March. */
  L.yearNow = function () {
    var now = new Date();
    var y = now.getFullYear();
    return y + (now - new Date(y, 2, 1)) / YEAR_MS;
  };

  /* One sentence on how fast the estimate is rising right now. */
  L.paceNote = function () {
    var y = L.yearNow(), dt = 1 / 12;
    var perYear = (L.statePop(y + dt) - L.statePop(y - dt)) / (2 * dt);
    var secs = Math.round(YEAR_MS / 1000 / perYear);
    var m = Math.floor(secs / 60), s = secs % 60;
    return 'An estimate from district population projections. Odisha gains about one person every ' +
      (m ? m + ' min ' : '') + s + ' sec, around ' + (Math.round(perYear / 365.2425 / 50) * 50) + ' a day.';
  };

  /* The count climbs from 1951 to today, slowly, then keeps ticking. */
  L.countUp = function (el, opts) {
    opts = opts || {};
    var target = L.statePop(L.yearNow());
    var timer = null;
    var stop = L.tween(L.stateAt(L.years[0]), target, opts.ms || 6500, function (v) {
      el.textContent = L.fmt(v);
    }, function () {
      timer = setInterval(function () { el.textContent = L.fmt(L.statePop(L.yearNow())); }, 1000);
      if (opts.done) opts.done();
    }, L.easeInOut);
    return function () { stop(); clearInterval(timer); };
  };

  /* ── the map ─────────────────────────────────────────── */
  L.dataName = function (f) {
    var n = f.properties.Dist_Name;
    return GEO_TO_DATA[n] || n;
  };

  /* Peach to orange: fewer people pale, more people deep orange. */
  var colorScale = null;
  L.color = function () {
    if (!colorScale) {
      var max = 0;
      for (var d in L.data) max = Math.max(max, L.data[d]['2036'].total);
      colorScale = d3.scaleSequential()
        .domain([0, max])
        .interpolator(d3.interpolateRgbBasis(['#fdf1ea', '#f8d3bc', '#f2a372', '#e26b2c']));
    }
    return colorScale;
  };

  /* Draws the districts into an <svg viewBox="0 0 600 600">; returns the paths. */
  L.drawMap = function (svgEl) {
    var proj = d3.geoMercator().fitSize([600, 600], L.geo);
    return d3.select(svgEl).append('g').selectAll('path').data(L.geo.features).join('path')
      .attr('d', d3.geoPath(proj))
      .attr('data-name', L.dataName);
  };

  L.paintMap = function (paths, y) {
    if (!paths) return;
    var c = L.color();
    paths.attr('fill', function (f) { return c(L.districtPop(L.dataName(f), y)); });
  };

  window.SoochanaLive = L;
})();
