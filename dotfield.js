/**
 * dotfield.js
 * Ambient background for the landing hero: a halftone population pyramid
 * that morphs through Odisha's age structure, 1991 → 2036.
 *
 * One dot ≈ 123,000 people. Rows are 5-year age bands; the number of dots
 * in a row is proportional to that band's share of the total population.
 * The pyramid therefore emerges from dot counts, so the morph reads as
 * people appearing and rising through the structure — the 60+ share climbs
 * 7.2% → 15.9% while the 0-4 base narrows 5.8% → 3.3%.
 *
 * Why the data is inlined rather than fetched: it is 1.4 KB, it is purely
 * decorative, and the hero must render instantly on first paint with no
 * network dependency. The live charts elsewhere read the JSON directly.
 *
 * Source: datasets/state_demographics.json → pyramids, converted to
 * percent of total and filtered to the 17 real age bands. That file also
 * carries ~20 spreadsheet-export artefact rows per year (a "Cumulative
 * Frequency" header plus cumulative sums with the value in the `age`
 * field); anything reading it must filter on the band whitelist, the way
 * journeys.html does.
 */
(function (global) {
  'use strict';

  var PYR = {
    '1991': [[5.809,5.659],[6.656,6.46],[5.694,5.649],[4.691,4.869],[4.5,4.467],[4.255,4.232],[3.509,3.398],[3.376,3.036],[2.628,2.435],[2.38,2.208],[2.096,1.903],[1.449,1.399],[1.491,1.441],[0.82,0.823],[0.635,0.663],[0.29,0.29],[0.282,0.316]],
    '2011': [[4.487,4.241],[4.727,4.489],[5.028,4.796],[5.043,4.884],[4.653,4.653],[4.128,4.298],[3.681,3.826],[3.348,3.323],[2.933,2.833],[2.53,2.379],[2.148,2.117],[1.716,1.746],[1.492,1.541],[1.037,1.107],[0.799,0.887],[0.42,0.453],[0.408,0.469]],
    '2021': [[4.041,3.992],[3.821,3.756],[3.971,3.883],[4.475,4.281],[4.732,4.512],[4.242,4.234],[4.015,4.021],[3.79,3.767],[3.278,3.226],[3.215,3.11],[2.863,2.741],[2.418,2.35],[1.811,1.803],[1.291,1.319],[1.127,1.169],[0.626,0.669],[0.58,0.652]],
    '2026': [[3.911,3.877],[3.729,3.694],[3.727,3.677],[3.905,3.833],[4.278,4.126],[4.532,4.363],[4.061,4.099],[3.842,3.895],[3.626,3.653],[3.135,3.126],[3.062,2.995],[2.706,2.62],[2.256,2.213],[1.646,1.657],[1.113,1.15],[0.885,0.94],[0.792,0.882]],
    '2031': [[3.596,3.579],[3.607,3.588],[3.641,3.62],[3.669,3.635],[3.742,3.694],[4.096,3.976],[4.34,4.208],[3.887,3.955],[3.674,3.755],[3.46,3.514],[2.98,2.988],[2.888,2.845],[2.523,2.472],[2.028,2.014],[1.396,1.428],[0.965,1.016],[1.021,1.132]],
    '2036': [[3.267,3.256],[3.323,3.315],[3.365,3.354],[3.408,3.386],[3.529,3.5],[3.601,3.564],[3.939,3.836],[4.171,4.062],[3.732,3.815],[3.518,3.611],[3.301,3.371],[2.826,2.855],[2.71,2.699],[2.317,2.31],[1.759,1.784],[1.152,1.209],[1.204,1.383]]
  };

  var YEARS   = Object.keys(PYR);
  var SHARE60 = { '1991':'7.2%','2011':'9.5%','2021':'11.1%','2026':'12.4%','2031':'14.0%','2036':'15.9%' };

  var MAXV    = 6.9;  /* fixed % scale — the morph must read as change, not rescaling.
                         Widest band across all years is 6.66% (1991, 5-9 male). */
  var MAXDOTS = 26;   /* dots at that widest band */

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} [opts] - {dur, yearEl, shareEl, male, female}
   * @returns {Object} {stop()}
   */
  function dotfield(canvas, opts) {
    opts = opts || {};
    /* Per-decade transition. Five transitions carry 1991 -> 2036, so the
       default runs 4.5s in total: deliberately under the 5s threshold in
       WCAG 2.2.2, which is where auto-playing motion alongside other content
       would otherwise need a pause control. */
    var dur      = opts.dur || 1000;
    var loop     = opts.loop !== false;
    var yearEl   = opts.yearEl  || null;
    var shareEl  = opts.shareEl || null;
    var cMale    = opts.male    || '#1a535c';
    var cFemale  = opts.female  || '#387478';

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0;

    /* Sizing the canvas once at script-parse time is not enough: the box is
       still settling (web fonts, the theme grid filling in, the intro sequence)
       and a stale buffer gets stretched or left blank. Measure whenever the
       element's own box actually changes. Note that assigning width/height
       clears the canvas, so callers must repaint after this. */
    function size() {
      var dpr = Math.min(global.devicePixelRatio || 1, 2);
      var r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      var bw = Math.round(r.width * dpr), bh = Math.round(r.height * dpr);
      W = r.width; H = r.height;
      if (canvas.width === bw && canvas.height === bh) return false; /* no change */
      canvas.width = bw;
      canvas.height = bh;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    }

    var lerp = function (a, b, t) { return a + (b - a) * t; };
    var ease = function (t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; };

    /* Draw one half of the field. dir = -1 for male (left), +1 for female. */
    function half(vals, dir, color) {
      var n = vals.length;
      var bandH = H / (n + 0.6);
      var cx = W / 2;
      var gap = (W * 0.44) / MAXDOTS;
      var r = Math.max(1.15, Math.min(gap * 0.235, 3.1));
      ctx.fillStyle = color;
      for (var i = 0; i < n; i++) {
        var y = H - i * bandH - bandH * 0.8;
        var exact = (vals[i] / MAXV) * MAXDOTS;
        var whole = Math.floor(exact);
        var frac  = exact - whole;
        for (var d = 0; d < whole; d++) {
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.arc(cx + dir * (gap * 0.7 + d * gap), y, r, 0, 6.2832);
          ctx.fill();
        }
        if (frac > 0.02) {          /* fade the partial dot so counts morph smoothly */
          ctx.globalAlpha = frac;
          ctx.beginPath();
          ctx.arc(cx + dir * (gap * 0.7 + whole * gap), y, r, 0, 6.2832);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    function paint(male, female) {
      ctx.clearRect(0, 0, W, H);
      half(male,   -1, cMale);
      half(female,  1, cFemale);
    }

    function still(year) {
      size();
      if (!W) return;
      var A = PYR[year];
      paint(A.map(function (b) { return b[0]; }), A.map(function (b) { return b[1]; }));
      if (yearEl)  yearEl.textContent  = year;
      if (shareEl) shareEl.textContent = SHARE60[year];
    }

    var reduced = global.matchMedia &&
                  global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var raf = null, t0 = null, idx = 0, stopped = false, settled = false;
    var LAST = YEARS[YEARS.length - 1];        /* 2036 — where the field rests */

    size();

    /* Watch the element's own box rather than just the window, so font loads
       and content reflows are picked up too. Resizing clears the canvas, so
       anything already at rest has to be redrawn. */
    function onResize() {
      if (!size()) return;
      if (reduced)      still('2021');
      else if (settled) still(LAST);
    }
    if (global.ResizeObserver) {
      new global.ResizeObserver(onResize).observe(canvas);
    } else {
      global.addEventListener('resize', onResize);
    }

    if (reduced) { still('2021'); return { stop: function () {} }; }

    function frame(ts) {
      if (stopped) return;
      if (t0 === null) t0 = ts;
      var k = (ts - t0) / dur;

      if (k >= 1) {
        k = 0; t0 = ts;
        idx++;
        if (idx >= YEARS.length) {     /* loop continuously */
          if (!loop) {                 /* come to rest on 2036 and stop if explicitly disabled */
            settled = true;
            raf = null;
            still(LAST);
            return;
          }
          idx = 0;
        }
      }

      var nextIdx = (idx + 1) % YEARS.length;
      var A = PYR[YEARS[idx]];
      var B = PYR[YEARS[nextIdx]];
      var e = ease(k);

      paint(
        A.map(function (b, i) { return lerp(b[0], B[i][0], e); }),
        A.map(function (b, i) { return lerp(b[1], B[i][1], e); })
      );

      if (yearEl) {
        var yr = k < 0.5 ? YEARS[idx] : YEARS[nextIdx];
        if (yearEl.textContent !== yr) {
          yearEl.textContent = yr;
          if (shareEl) shareEl.textContent = SHARE60[yr];
        }
      }

      /* Stop burning cycles when the tab is backgrounded. */
      if (document.hidden) { raf = null; return; }
      raf = global.requestAnimationFrame(frame);
    }

    document.addEventListener('visibilitychange', function () {
      /* Resume only if it was paused mid-run — never restart once at rest. */
      if (!document.hidden && raf === null && !stopped) {
        t0 = null;
        raf = global.requestAnimationFrame(frame);
      }
    });

    raf = global.requestAnimationFrame(frame);

    return {
      stop: function () {
        stopped = true;
        if (raf) global.cancelAnimationFrame(raf);
      }
    };
  }

  /* Real decadal totals, for the intro counter. From
     datasets/state_demographics.json → population_trends rows 0-16
     (rows 17-42 of that array are two unrelated indicators). */
  dotfield.TRENDS = [
    [1901, 10302917], [1911, 11378875], [1921, 11158586], [1931, 12491056],
    [1941, 13767988], [1951, 14645946], [1961, 17548846], [1971, 21944615],
    [1981, 26370271], [1991, 31659736], [2001, 36804660], [2011, 41974218],
    [2021, 46254277]
  ];

  global.dotfield = dotfield;
})(window);
