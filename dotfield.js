/**
 * dotfield.js
 * Ambient background for the landing hero: a halftone population pyramid
 * that morphs through Odisha's age structure, 1991 → 2036.
 *
 * One dot ≈ 123,000 people. Rows are 5-year age bands; the number of dots
 * in a row is proportional to that band's share of the total population.
 * The pyramid therefore emerges from dot counts, so the morph reads as
 * people appearing and rising through the structure — the 60+ share climbs
 * 7.2% → 17.0% while the 0-4 base narrows 5.8% → 3.1% (male side).
 *
 * Why the data is inlined rather than fetched: it is 1.4 KB, it is purely
 * decorative, and the hero must render instantly on first paint with no
 * network dependency. The live charts elsewhere read the JSON directly.
 *
 * Source: datasets/state_demographics.json → pyramids (Census of India to
 * 2011; ORGI Technical Group projection, July 2020, after), converted to
 * percent of total and filtered to the 17 real age bands. That file also
 * carries ~20 spreadsheet-export artefact rows per year (a "Cumulative
 * Frequency" header plus cumulative sums with the value in the `age`
 * field); anything reading it must filter on the band whitelist, the way
 * journeys.html does.
 */
(function (global) {
  'use strict';

  var PYR = {
    '1991': [[5.809,5.659],[6.656,6.46],[5.694,5.649],[4.691,4.869],[4.5,4.467],[4.255,4.232],[3.509,3.398],[3.376,3.036],[2.628,2.435],[2.38,2.208],[2.096,1.903],[1.449,1.399],[1.491,1.441],[0.82,0.823],[0.683,0.695],[0.273,0.272],[0.394,0.349]],
    '2011': [[4.487,4.241],[4.982,4.753],[5.265,5.125],[4.713,4.665],[4.47,4.57],[4.236,4.303],[3.685,3.729],[3.652,3.638],[3.316,3.114],[2.897,2.68],[2.288,2.127],[1.778,1.767],[1.762,1.759],[1.166,1.175],[0.909,0.926],[0.438,0.434],[0.489,0.461]],
    '2021': [[3.906,3.681],[4.009,3.773],[4.248,4.024],[4.436,4.25],[4.519,4.381],[4.256,4.235],[3.968,4.062],[3.679,3.797],[3.364,3.453],[3.132,3.14],[2.836,2.744],[2.377,2.274],[1.834,1.819],[1.407,1.464],[1.09,1.151],[0.713,0.772],[0.565,0.643]],
    '2026': [[3.619,3.409],[3.729,3.519],[3.852,3.631],[4.07,3.854],[4.23,4.041],[4.31,4.198],[4.06,4.062],[3.78,3.896],[3.5,3.64],[3.184,3.29],[2.934,2.965],[2.611,2.569],[2.132,2.098],[1.589,1.618],[1.16,1.239],[0.812,0.901],[0.681,0.819]],
    '2031': [[3.33,3.146],[3.485,3.289],[3.612,3.415],[3.717,3.504],[3.912,3.691],[4.068,3.904],[4.146,4.061],[3.902,3.933],[3.628,3.769],[3.342,3.498],[3.013,3.135],[2.729,2.806],[2.371,2.397],[1.873,1.894],[1.332,1.395],[0.885,0.995],[0.808,1.015]],
    '2036': [[3.078,2.905],[3.233,3.058],[3.4,3.217],[3.512,3.321],[3.598,3.378],[3.792,3.594],[3.945,3.808],[4.02,3.963],[3.78,3.833],[3.496,3.653],[3.192,3.366],[2.831,2.994],[2.507,2.646],[2.113,2.195],[1.597,1.662],[1.036,1.142],[0.928,1.208]]
  };

  var YEARS   = Object.keys(PYR);
  var SHARE60 = { '1991':'7.2%','2011':'9.5%','2021':'11.5%','2026':'13.0%','2031':'15.0%','2036':'17.0%' };

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
    [2021, 45696000]
  ];

  global.dotfield = dotfield;
})(window);
