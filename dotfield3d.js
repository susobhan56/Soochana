/**
 * dotfield3d.js
 * The home-page hero: one field of dots that tells Odisha's demographic story
 * in scenes, flowing along curved paths from one chart into the next.
 *
 *   map       a dot map of the state, each district coloured by its 60+ share
 *   growth    population 1901 → 2021 (census) and 2026 → 2036 (projection)
 *   ageing    the age pyramid year by year, over a dashed outline of 1991
 *   cohort    the children of 1991 climbing the pyramid as they age
 *   waffle    100 dots = 100 people: 0–19, 20–59, 60–69, 70+
 *   fertility district fertility (TFR) lines falling past replacement level
 *   pyramid   the plain pyramid, and the default (odisha.html uses it)
 *
 * Every scene draws exact values. Data other than the state pyramid comes
 * from hero_data.js (tools/build_hero_data.py); a scene whose data is not on
 * the page is skipped.
 */
(function (global) {
  'use strict';

  var HERO = global.SOOCHANA_HERO || null;

  /* State age pyramid, % of the whole population as [male, female] per band.
     The same numbers hero_data.js carries (datasets/state_demographics.json),
     kept here so a page without hero_data.js still gets its pyramid. */
  var PYR = (HERO && HERO.pyr) || {
    '1991': [[5.809,5.659],[6.656,6.46],[5.694,5.649],[4.691,4.869],[4.5,4.467],[4.255,4.232],[3.509,3.398],[3.376,3.036],[2.628,2.435],[2.38,2.208],[2.096,1.903],[1.449,1.399],[1.491,1.441],[0.82,0.823],[0.683,0.695],[0.273,0.272],[0.394,0.349]],
    '2011': [[4.487,4.241],[4.982,4.753],[5.265,5.125],[4.713,4.665],[4.47,4.57],[4.236,4.303],[3.685,3.729],[3.652,3.638],[3.316,3.114],[2.897,2.68],[2.288,2.127],[1.778,1.767],[1.762,1.759],[1.166,1.175],[0.909,0.926],[0.438,0.434],[0.489,0.461]],
    '2021': [[4.041,3.992],[3.821,3.764],[3.972,3.751],[4.475,4.263],[4.733,4.602],[4.242,4.194],[4.016,4.1],[3.79,3.853],[3.279,3.324],[3.216,3.222],[2.863,2.725],[2.418,2.294],[1.811,1.75],[1.291,1.359],[1.127,1.214],[0.626,0.69],[0.58,0.602]],
    '2026': [[3.911,3.877],[3.81,3.769],[3.643,3.59],[3.79,3.581],[4.268,4.067],[4.51,4.388],[4.039,3.996],[3.817,3.901],[3.59,3.659],[3.085,3.144],[2.99,3.026],[2.611,2.525],[2.136,2.077],[1.523,1.525],[1.011,1.112],[0.797,0.904],[0.637,0.693]],
    '2031': [[3.596,3.579],[3.725,3.698],[3.664,3.627],[3.506,3.457],[3.646,3.447],[4.103,3.913],[4.332,4.22],[3.873,3.838],[3.648,3.739],[3.411,3.494],[2.899,2.982],[2.757,2.834],[2.334,2.314],[1.821,1.835],[1.213,1.27],[0.728,0.844],[0.774,0.879]],
    '2036': [[3.267,3.256],[3.462,3.449],[3.616,3.591],[3.559,3.524],[3.404,3.358],[3.538,3.346],[3.978,3.797],[4.194,4.09],[3.739,3.713],[3.502,3.605],[3.239,3.347],[2.704,2.824],[2.495,2.629],[2.018,2.073],[1.474,1.553],[0.892,0.986],[0.819,0.958]]
  };

  var AGE_LABELS = [
    '0–4 Yrs (Birth Base)', '5–9 Yrs (Youth)', '10–14 Yrs (Childhood)', '15–19 Yrs (Teens)',
    '20–24 Yrs (Young Adult)', '25–29 Yrs (Workforce)', '30–34 Yrs (Workforce)', '35–39 Yrs (Workforce)',
    '40–44 Yrs (Workforce)', '45–49 Yrs (Workforce)', '50–54 Yrs (Workforce)', '55–59 Yrs (Pre-Retirement)',
    '60–64 Yrs (Senior 60+)', '65–69 Yrs (Senior 60+)', '70–74 Yrs (Senior 60+)', '75–79 Yrs (Elderly 60+)',
    '80+ Yrs (Elderly Apex)'
  ];

  var YEARS   = Object.keys(PYR);
  var Y0 = YEARS[0], Y1 = YEARS[YEARS.length - 1];
  var MAXV    = 6.9;   // largest single-sex band share, sets the pyramid's dot scale
  var MAXDOTS = 22;
  var NUM_BANDS = 17;
  var COLS = MAXDOTS * 2;

  function bandShare(yr, a, b) {
    var s = 0;
    for (var i = a; i <= b; i++) s += PYR[yr][i][0] + PYR[yr][i][1];
    return s;
  }
  function pct(v) { return v.toFixed(1) + '%'; }
  function crore(n) { return (n / 1e7).toFixed(2) + ' crore'; }
  function lakh(n) { return (n / 1e5).toFixed(1) + ' lakh'; }
  function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; }

  /* ─────────────────────────────────────────────────────────────
     SCENES
     Each builds, per step, a list of items {x, y, z, a, c, s, g}: world
     position (y up), alpha, colour, size and hover group. Item i must mean
     the same thing in every step, so steps can glide into one another.
     ───────────────────────────────────────────────────────────── */

  function pyramidScene(C, kind) {
    function bandColor(i) {
      if (i >= 14) return C.eldest;
      if (i >= 12) return C.senior;
      return i < 4 ? C.youth : C.work;
    }
    /* the band a 1991 child (0–14 then) is in, `yr` years on */
    function cohortOffset(yr) {
      var off = (+yr - +Y0) / 5;
      return off === Math.floor(off) && off + 2 < NUM_BANDS ? off : null;
    }
    var born0 = +Y0 - 15, born1 = +Y0;
    var cohortTag = '← BORN ' + born0 + '–' + String(born1).slice(2);

    function items(k) {
      var yr = YEARS[k], d = PYR[yr], out = [], off = cohortOffset(yr);
      for (var i = 0; i < NUM_BANDS; i++) {
        for (var c = 0; c < COLS; c++) {
          var male = c < MAXDOTS, dd = male ? MAXDOTS - 1 - c : c - MAXDOTS;
          var exact = d[i][male ? 0 : 1] / MAXV * MAXDOTS;
          var a = dd >= exact ? 0.08 : (dd > exact - 1 ? Math.max(0.15, exact % 1) : 0.85);
          var x = 16 + dd * 16;
          var it = { x: male ? -x : x, y: (i - NUM_BANDS / 2) * 24,
                     z: ((dd % 2 === 0) === male ? 12 : -12), a: a, c: bandColor(i), s: 1, g: i };
          if (kind === 'cohort' && off !== null) {
            if (i >= off && i <= off + 2) { it.c = C.hover; if (a > 0.1) it.s = 1.25; }
            else if (a > 0.1) it.a = a * 0.3;
          }
          out.push(it);
        }
      }
      return out;
    }

    var links = [];
    for (var i = 0; i < NUM_BANDS; i++) {
      for (var c = 0; c < COLS; c++) {
        if (c < COLS - 1) links.push([i * COLS + c, i * COLS + c + 1]);
        if (i < NUM_BANDS - 1) links.push([i * COLS + c, (i + 1) * COLS + c]);
      }
    }

    function cohortAnchor(k) {
      var yr = YEARS[k], off = cohortOffset(yr);
      if (off === null) return null;
      var m = off + 1, exact = PYR[yr][m][1] / MAXV * MAXDOTS;
      return [8 + exact * 16 + 12, (m - NUM_BANDS / 2) * 24 - 4];
    }

    var s60a = bandShare(Y0, 12, 16), s60b = bandShare(Y1, 12, 16);
    var lastOff = cohortOffset(Y1);
    var INFO = {
      pyramid: { title: 'Odisha Age Pyramid',
                 caption: 'Rows are age bands, youngest at the base; dots show the male (left) and female (right) share.' },
      ageing:  { title: 'Odisha Grows Older',
                 caption: 'Fewer children, more elders: the share aged 60+ rises from ' + pct(s60a) + ' in ' + Y0 +
                          ' to ' + pct(s60b) + ' in ' + Y1 + '. The dashed outline is ' + Y0 + '.' },
      cohort:  { title: 'Children of ' + Y0,
                 caption: 'Follow one generation: aged 0–14 in ' + Y0 + ', they are ' + (lastOff * 5) + '–' +
                          (lastOff * 5 + 14) + ' by ' + Y1 + ' and hold up the middle of the pyramid.' }
    }[kind];

    return {
      id: kind, title: INFO.title, caption: INFO.caption,
      legend: kind === 'cohort'
        ? [[C.hover, 'Born ' + born0 + '–' + born1], [C.work, 'Everyone else']]
        : [[C.youth, '0–19'], [C.work, '20–59'], [C.senior, '60–69'], [C.eldest, '70+']],
      steps: YEARS.length, stepDur: 1500, hold: 1600, wobble: 2.5, stretch: 1.5,
      boundsKey: 'pyramid', timeline: YEARS.map(Number), links: links, items: items,
      labels: function (k, k2, p) {
        var L = [
          ['▲ 80+ ELDERLY APEX', 0, 195, 0, 'center'],
          ['▼ 0–4 YOUTH BASE', 0, -230, 0, 'center'],
          ['← MALE %', -352, 195, 0, 'left'],
          ['FEMALE % →', 352, 195, 0, 'right']
        ];
        if (kind === 'ageing') L.push(['- - ' + Y0 + ' OUTLINE', -352, 172, 0, 'left']);
        if (kind === 'cohort') {
          var a = cohortAnchor(k), b = cohortAnchor(k2);
          if (a && b) L.push([cohortTag, lerp(a[0], b[0], p), lerp(a[1], b[1], p), 0, 'left', 0.95]);
        }
        return L;
      },
      overlay: kind !== 'ageing' ? null : function (g, project, alpha) {
        /* the stepped edge of the 1991 pyramid, both sides */
        var d = PYR[Y0];
        g.save();
        g.setLineDash([3, 4]);
        g.lineWidth = 1;
        g.strokeStyle = C.label;
        g.globalAlpha = 0.45 * alpha;
        [-1, 1].forEach(function (side) {
          g.beginPath();
          var first = true;
          for (var i = 0; i < NUM_BANDS; i++) {
            var x = side * (8 + d[i][side < 0 ? 0 : 1] / MAXV * MAXDOTS * 16);
            var yc = (i - NUM_BANDS / 2) * 24;
            [yc - 12, yc + 12].forEach(function (y) {
              var q = project(x, y, 0);
              if (!q) return;
              if (first) { g.moveTo(q.sx, q.sy); first = false; } else g.lineTo(q.sx, q.sy);
            });
          }
          g.stroke();
        });
        g.restore();
      },
      tip: function (idx, k) {
        var yr = YEARS[k], i = Math.floor(idx / COLS), d = PYR[yr][i];
        return [AGE_LABELS[i], yr + '  ·  Male: ' + d[0].toFixed(1) + '%  |  Female: ' + d[1].toFixed(1) + '%'];
      },
      stats: function (k) {
        var yr = YEARS[k];
        if (kind === 'cohort') {
          var off = cohortOffset(yr);
          return [['YEAR', yr], ['THEIR AGE NOW', off === null ? '–' : (off * 5) + '–' + (off * 5 + 14)]];
        }
        return [['YEAR', yr], ['SHARE AGED 60+', pct(bandShare(yr, 12, 16))]];
      }
    };
  }

  function waffleScene(C) {
    var CATS = [['Aged 0–19', 0, 3, C.youth], ['Aged 20–59', 4, 11, C.work],
                ['Aged 60–69', 12, 13, C.senior], ['Aged 70+', 14, 16, C.eldest]];
    /* Whole dots out of 100. The three big groups (0–19, 20–59, 60+) share
       the 100 by largest remainder, then the 60+ dots split into 60–69 and
       70+, so the count of 60+ dots is the rounded 60+ share itself. */
    function counts(yr) {
      var sh = CATS.map(function (c) { return bandShare(yr, c[1], c[2]); });
      var tot = sh.reduce(function (a, b) { return a + b; }, 0);
      var ex = [sh[0], sh[1], sh[2] + sh[3]].map(function (v) { return v / tot * 100; });
      var n = ex.map(Math.floor), left = 100 - n.reduce(function (a, b) { return a + b; }, 0);
      ex.map(function (v, i) { return [v - Math.floor(v), i]; })
        .sort(function (a, b) { return b[0] - a[0]; })
        .slice(0, left).forEach(function (r) { n[r[1]]++; });
      var old = Math.round(n[2] * sh[3] / (sh[2] + sh[3]));
      return [n[0], n[1], n[2] - old, old];
    }
    var nA = counts(Y0), nB = counts(Y1);
    return {
      id: 'waffle', title: 'Out of Every 100 People',
      caption: 'Out of every 100 people in Odisha, ' + (nA[2] + nA[3]) + ' were aged 60 or more in ' + Y0 +
               '; by ' + Y1 + ' it is ' + (nB[2] + nB[3]) + '.',
      legend: CATS.map(function (c) { return [c[3], c[0].replace('Aged ', '')]; }),
      steps: YEARS.length, stepDur: 1500, hold: 1800, wobble: 1.2, stretch: 1,
      boundsKey: 'waffle', timeline: YEARS.map(Number), links: null,
      items: function (k) {
        var n = counts(YEARS[k]), out = [], cat = 0, used = 0;
        for (var i = 0; i < 100; i++) {
          while (cat < CATS.length - 1 && i >= used + n[cat]) { used += n[cat]; cat++; }
          out.push({ x: (i % 10 - 4.5) * 34, y: (Math.floor(i / 10) - 4.5) * 34, z: 0,
                     a: 0.95, c: CATS[cat][3], s: 2.3, g: cat });
        }
        return out;
      },
      labels: function () { return [['1 DOT = 1 IN EVERY 100 PEOPLE', 0, 5.5 * 34 + 8, 0, 'center']]; },
      tip: function (idx, k, g) {
        var yr = YEARS[k], c = CATS[g];
        return [c[0], yr + '  ·  ' + pct(bandShare(yr, c[1], c[2])) + ' of the population'];
      },
      stats: function (k) { return [['YEAR', YEARS[k]], ['AGED 60+', pct(bandShare(YEARS[k], 12, 16))]]; }
    };
  }

  function growthScene(C) {
    if (!HERO || !HERO.growth) return null;
    var G = HERO.growth.filter(function (r) { return r[1] > 1e6; });
    var PER = 5e5, SP = 11, PITCH = 40, BASE = -190, n = G.length;
    function colX(k) { return (k - (n - 1) / 2) * PITCH; }
    function top(k) { return BASE + Math.ceil(Math.ceil(G[k][1] / PER) / 3) * SP; }
    var first = G[0], lastCensus = G.filter(function (r) { return !r[3]; }).pop();
    var dip = -1;
    G.forEach(function (r, k) { if (k && dip < 0 && r[1] < G[k - 1][1]) dip = k; });
    return {
      id: 'growth', title: 'Odisha Grows 4-Fold',
      caption: 'Odisha’s population grew ' + (lastCensus[1] / first[1]).toFixed(1) + ' times in ' +
               (lastCensus[0] - first[0]) + ' years: ' + crore(first[1]) + ' in ' + first[0] + ', ' +
               crore(lastCensus[1]) + ' in ' + lastCensus[0] + '.',
      legend: [[C.work, 'Census count'], [C.youth, 'Projection']],
      steps: n, stepDur: 520, stepHold: 0.1, hold: 2400, wobble: 0.6, stretch: 1.3,
      boundsKey: 'growth', timeline: null, links: null,
      items: function (k) {
        var out = [];
        G.forEach(function (r, col) {
          var cnt = Math.ceil(r[1] / PER), frac = r[1] / PER - (cnt - 1), vis = col <= k;
          for (var j = 0; j < cnt; j++) {
            var a = (j === cnt - 1 ? Math.max(0.25, frac) : 1) * (r[3] ? 0.55 : 0.9);
            out.push({ x: colX(col) + (j % 3 - 1) * SP, y: vis ? BASE + Math.floor(j / 3) * SP + 6 : BASE + 6,
                       z: 0, a: vis ? a : 0, c: r[3] ? C.youth : C.work, s: 1, g: col });
          }
        });
        return out;
      },
      labels: function (k, k2, p) {
        var L = [['EACH DOT = 5 LAKH PEOPLE', colX(0) - 15, 220, 0, 'left'],
                 ['* PROJECTED', colX(n - 1) + 15, 220, 0, 'right']];
        [0, 5, 10, 12, n - 1].forEach(function (col) {
          if (G[col]) L.push([G[col][0] + (G[col][3] ? '*' : ''), colX(col), BASE - 16, 0, 'center']);
        });
        if (dip > 0) L.push([G[dip][0] + ' DIP', colX(dip), top(dip) + 18, 0, 'center', k >= dip ? 0.9 : 0]);
        return L;
      },
      tip: function (idx, k, g) {
        var r = G[g];
        return [r[0] + (r[3] ? ' · projection' : ' · Census'),
                crore(r[1]) + (r[2] ? '  ·  ' + r[2] + ' women per 1,000 men' : '')];
      },
      stats: function (k) {
        var r = G[k];
        return [['YEAR', r[0] + (r[3] ? ' (projected)' : '')], ['POPULATION', crore(r[1])]];
      }
    };
  }

  function mapScene(C, ramp) {
    if (!HERO || !HERO.dots || !HERO.districts) return null;
    var D = HERO.districts, YRS = HERO.districtYears, last = YRS.length - 1;
    var CUTS = [9, 11, 13, 15, 17];
    function bin(v) { var b = 0; while (b < CUTS.length && v >= CUTS[b]) b++; return b; }
    function extremes(k) {
      var lo = 0, hi = 0;
      D.forEach(function (d, i) { if (d.s60[k] < D[lo].s60[k]) lo = i; if (d.s60[k] > D[hi].s60[k]) hi = i; });
      return [lo, hi];
    }
    var rising = D.filter(function (d) { return d.s60[last] > d.s60[0]; }).length;
    return {
      id: 'map', title: 'Every District Is Ageing',
      caption: (rising === D.length ? 'The share aged 60+ rises in all ' + D.length + ' districts'
                                    : 'The share aged 60+ rises in ' + rising + ' of ' + D.length + ' districts') +
               ' between ' + YRS[0] + ' and ' + YRS[last] + '. Each dot is a patch of the state, coloured by its district.',
      legend: ['under 9%', '9–11%', '11–13%', '13–15%', '15–17%', '17%+'].map(function (t, i) { return [ramp[i], t]; }),
      steps: YRS.length, stepDur: 1900, hold: 1600, wobble: 1, stretch: 1,
      boundsKey: 'map', timeline: YRS, links: null,
      items: function (k) {
        return HERO.dots.map(function (p) {
          return { x: p[0], y: p[1], z: 0, a: 0.9, c: ramp[bin(D[p[2]].s60[k])], s: 1.05, g: p[2] };
        });
      },
      labels: function (k) {
        var e = extremes(k);
        return e.map(function (i) {
          var d = D[i];
          return [d.name + ' ' + pct(d.s60[k]), d.at[0], d.at[1] - 16, 0, d.at[0] < 0 ? 'left' : 'right', 0.95];
        });
      },
      tip: function (idx, k, g) {
        var d = D[g];
        return [d.name, YRS[k] + '  ·  60+ share ' + pct(d.s60[k]) + '  ·  ' + lakh(d.pop[k]) + ' people'];
      },
      stats: function (k) {
        var e = extremes(k);
        return [['YEAR', String(YRS[k])],
                ['60+ SHARE BY DISTRICT', D[e[0]].s60[k].toFixed(1) + '–' + pct(D[e[1]].s60[k])]];
      }
    };
  }

  function fertilityScene(C) {
    if (!HERO || !HERO.fert) return null;
    var F = HERO.fert, FY = HERO.fertYears, PER_LINE = 24;
    var X0 = FY[0], X1 = FY[FY.length - 1], REPL = 2.1;
    var T0 = 0.9, T1 = 2.9;
    function wx(yr) { return -300 + (yr - X0) / (X1 - X0) * 600; }
    function wy(v) { return -170 + (v - T0) / (T1 - T0) * 340; }
    function valueAt(v, yr) {
      for (var j = 0; j < FY.length - 1; j++) {
        if (yr <= FY[j + 1]) return lerp(v[j], v[j + 1], (yr - FY[j]) / (FY[j + 1] - FY[j]));
      }
      return v[v.length - 1];
    }
    function yearLabel(j) { return j === 0 ? HERO.fertFirstLabel + ' (NFHS-4)' : FY[j] + ' (projected)'; }
    var STEPS = [X0];
    for (var y = X0 + 4; y <= X1; y += 2) STEPS.push(y);
    if (STEPS[STEPS.length - 1] !== X1) STEPS.push(X1);
    function above(yr) {
      var j = FY.indexOf(yr);
      return F.filter(function (d) { return (j >= 0 ? d.v[j] : valueAt(d.v, yr)) > REPL; });
    }
    var startAbove = above(X0).length, endAbove = above(X1);

    var links = [];
    F.forEach(function (d, L) {
      for (var s = 0; s < PER_LINE - 1; s++) links.push([L * PER_LINE + s, L * PER_LINE + s + 1]);
    });

    return {
      id: 'fertility', title: 'Fertility Falls',
      caption: 'In ' + HERO.fertFirstLabel + ', ' + startAbove + ' of ' + F.length + ' districts had fertility above ' +
               'replacement level (2.1 children per woman). By ' + X1 + ' only ' + endAbove.length + ' are projected to: ' +
               endAbove.map(function (d) { return d.name; }).join(' and ') + '.',
      legend: [[C.senior, 'Above 2.1 in ' + X1], [C.work, 'Below 2.1 by ' + X1], [C.eldest, 'Replacement level']],
      steps: STEPS.length, stepDur: 820, hold: 2000, wobble: 0.6, stretch: 1.4,
      boundsKey: 'fertility', timeline: STEPS, timelineFirst: HERO.fertFirstLabel, links: links,
      items: function (k) {
        var out = [], upto = STEPS[k];
        F.forEach(function (d, L) {
          var hot = d.v[d.v.length - 1] > REPL;
          for (var s = 0; s < PER_LINE; s++) {
            var yr = X0 + s / (PER_LINE - 1) * (X1 - X0);
            out.push({ x: wx(yr), y: wy(valueAt(d.v, yr)), z: 0,
                       a: yr <= upto + 0.01 ? (hot ? 0.95 : 0.6) : 0, c: hot ? C.senior : C.work, s: hot ? 1.1 : 0.9, g: L });
          }
        });
        return out;
      },
      labels: function () {
        return [['CHILDREN PER WOMAN (TFR)', -300, 195, 0, 'left'],
                ['REPLACEMENT 2.1', 300, wy(REPL) + 7, 0, 'right'],
                ['3', -312, wy(3) - 4, 0, 'right'], ['2', -312, wy(2) - 4, 0, 'right'], ['1', -312, wy(1) - 4, 0, 'right']];
      },
      overlay: function (g, project, alpha) {
        var a = project(-300, wy(REPL), 0), b = project(300, wy(REPL), 0);
        if (!a || !b) return;
        g.save();
        g.setLineDash([5, 4]);
        g.lineWidth = 1.2;
        g.strokeStyle = C.eldest;
        g.globalAlpha = 0.8 * alpha;
        g.beginPath(); g.moveTo(a.sx, a.sy); g.lineTo(b.sx, b.sy); g.stroke();
        g.restore();
      },
      tip: function (idx, k, g) {
        var s = idx % PER_LINE, yr = X0 + s / (PER_LINE - 1) * (X1 - X0), j = 0;
        FY.forEach(function (fy, i) { if (Math.abs(fy - yr) < Math.abs(FY[j] - yr)) j = i; });
        return [F[g].name, yearLabel(j) + '  ·  TFR ' + F[g].v[j].toFixed(2)];
      },
      stats: function (k) {
        var yr = STEPS[k];
        return [['YEAR', k === 0 ? HERO.fertFirstLabel : String(yr)],
                ['DISTRICTS ABOVE 2.1', above(yr).length + ' of ' + F.length]];
      }
    };
  }

  var SCENES = {
    pyramid:   function (C) { return pyramidScene(C, 'pyramid'); },
    ageing:    function (C) { return pyramidScene(C, 'ageing'); },
    cohort:    function (C) { return pyramidScene(C, 'cohort'); },
    waffle:    waffleScene,
    growth:    growthScene,
    map:       mapScene,
    fertility: fertilityScene
  };

  /* ─────────────────────────────────────────────────────────────
     ENGINE
     ───────────────────────────────────────────────────────────── */

  function dotfield3d(canvas, opts) {
    opts = opts || {};
    var yearEl  = opts.yearEl  || null;
    var shareEl = opts.shareEl || null;
    var onScene = opts.onScene || null;
    var onStep  = opts.onStep  || null;
    var glow    = !!opts.glow;

    /* Colours default to the light theme; a page on a dark ground passes
       its own through opts.palette (ripple is an "r, g, b" triple, ramp the
       six colours of the map's 60+ scale, low to high). */
    var pal = opts.palette || {};
    var C = {
      youth:  pal.youth  || '#1a535c',
      work:   pal.work   || '#2b5c68',
      senior: pal.senior || '#bb4500',
      eldest: pal.eldest || '#8e44ad',
      hover:  pal.hover  || '#bb4500',
      ripple: pal.ripple || '26, 83, 92',
      label:  pal.label  || '#1e2530'
    };
    var ramp = pal.ramp || ['#2b7a78', '#5aa9a0', '#9ccfb6', '#e0b000', '#d0700a', '#a33a00'];

    var scenes = (opts.scenes || ['pyramid']).map(function (id) {
      return SCENES[id] ? SCENES[id](C, ramp) : null;
    }).filter(Boolean);
    if (!scenes.length) scenes = [SCENES.pyramid(C, ramp)];

    var ctx = canvas.getContext('2d');
    if (!ctx) return { stop: function () {} };

    /* every scene's steps, built once */
    scenes.forEach(function (sc) {
      sc.layouts = [];
      for (var k = 0; k < sc.steps; k++) sc.layouts.push(sc.items(k));
    });
    var N = Math.max.apply(null, scenes.map(function (sc) { return sc.layouts[0].length; }));

    var W = 0, H = 0, dpr = 1;
    var mouse = { x: -9999, y: -9999, targetX: -9999, targetY: -9999, active: false };
    var rotX = 0, rotY = 0, targetRotX = 0, targetRotY = 0;
    var ripples = [];

    function size() {
      dpr = Math.min(global.devicePixelRatio || 1, 2);
      var rect = canvas.getBoundingClientRect();
      var w = rect.width || window.innerWidth;
      var h = rect.height || window.innerHeight;
      W = w; H = h;
      var bw = Math.round(w * dpr), bh = Math.round(h * dpr);
      if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    }

    function onMouseMove(e) {
      var rect = canvas.getBoundingClientRect();
      mouse.targetX = e.clientX - rect.left;
      mouse.targetY = e.clientY - rect.top;
      mouse.active = true;
      var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      targetRotY = ((e.clientX - cx) / cx) * 0.35;
      targetRotX = -((e.clientY - cy) / cy) * 0.25;
    }
    function onMouseLeave() {
      mouse.active = false;
      mouse.targetX = -9999;
      mouse.targetY = -9999;
    }
    function onClick(e) {
      var rect = canvas.getBoundingClientRect();
      ripples.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, r: 0,
                     maxR: Math.max(W, H) * 0.5, alpha: 1 });
    }
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseleave', onMouseLeave, { passive: true });
    window.addEventListener('click', onClick, { passive: true });

    /* ── nodes: the dots themselves, handed from scene to scene ── */
    var nodes = [];
    for (var n = 0; n < N; n++) {
      nodes.push({ x: 0, y: 0, z: 0, ox: 0, oy: 0, vx: 0, vy: 0, a: 0, s: 1, c: C.work,
                   sx: 0, sy: 0, sc: 1, item: 0, dup: false,
                   p0: null, p1: null, a0: 0, s0: 1, c0: C.work, delay: 0, dur: 1, done: true });
    }
    var inv = [];   // item index -> the node drawing it

    /* Give each node an item of the new scene. Both sides are ranked left to
       right, so the field sweeps across rather than scrambling; nodes beyond
       the scene's item count double up on an item and fade out on the way. */
    function assign(sc) {
      var items = sc.layouts[0], M = items.length;
      var byX = items.map(function (it, i) { return i; }).sort(function (a, b) { return items[a].x - items[b].x; });
      var nodeOrder = nodes.map(function (nd, i) { return i; }).sort(function (a, b) { return nodes[a].x - nodes[b].x; });
      var xs = items.map(function (it) { return it.x; });
      var xmin = Math.min.apply(null, xs), xmax = Math.max.apply(null, xs), span = (xmax - xmin) || 1;
      inv = new Array(M);
      var last = -1;
      nodeOrder.forEach(function (ni, r) {
        var rank = Math.min(M - 1, Math.floor(r * M / N));
        var item = byX[rank], nd = nodes[ni];
        nd.item = item;
        nd.dup = rank === last;
        if (!nd.dup) inv[item] = ni;
        last = rank;
        /* the flight: from where it is now, bowed out to one side */
        var tgt = items[item];
        nd.p0 = { x: nd.x + nd.ox, y: nd.y + nd.oy, z: nd.z };
        var dx = tgt.x - nd.p0.x, dy = tgt.y - nd.p0.y, bow = (Math.random() - 0.5) * 0.9;
        nd.p1 = { x: (nd.p0.x + tgt.x) / 2 - dy * bow, y: (nd.p0.y + tgt.y) / 2 + dx * bow,
                  z: (nd.p0.z + tgt.z) / 2 + (Math.random() - 0.5) * 160 };
        nd.ox = nd.oy = 0;
        nd.a0 = nd.a; nd.s0 = nd.s; nd.c0 = nd.c;
        nd.delay = 650 * (tgt.x - xmin) / span + Math.random() * 180;
        nd.dur = 1150 + Math.random() * 350;
        nd.done = false;
      });
    }
    var MORPH = 2300;

    /* ── fitting the field into the space the page leaves free ── */
    var fov = 460;
    var boundsCache = {};
    var CHAR_W = 11;   // one label character in world units at the smallest fits
    function sceneBounds(sc) {
      var key = sc.boundsKey || sc.id;
      if (boundsCache[key]) return boundsCache[key];
      var b = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 };
      function add(x, y, z) {
        var s = fov / (fov + z), px = x * s, py = -y * s;
        if (px < b.x0) b.x0 = px; if (px > b.x1) b.x1 = px;
        if (py < b.y0) b.y0 = py; if (py > b.y1) b.y1 = py;
      }
      scenes.forEach(function (other) {
        if ((other.boundsKey || other.id) !== key) return;
        other.layouts.forEach(function (L, k) {
          L.forEach(function (it) { add(it.x, it.y, it.z); });
          other.labels(k, k, 0).forEach(function (l) {
            var w = l[0].length * CHAR_W, x = l[1];
            var x0 = l[4] === 'right' ? x - w : l[4] === 'left' ? x : x - w / 2;
            add(x0, l[2] + 8, l[3]); add(x0 + w, l[2] - 4, l[3]);
          });
        });
      });
      return (boundsCache[key] = b);
    }

    var fitBox = opts.fitBox || null;
    var box = null, boxAge = 0, fitted = false;
    var fit = { sx: 1, sy: 1, cx: null, cy: null };
    var PAD = { x: 10, top: 14, bottom: 14, timeline: 40 };

    function updateFit(sc) {
      if (fitBox && (boxAge-- <= 0)) { box = fitBox(); boxAge = box ? 30 : 0; }
      var b = sceneBounds(sc);
      var sx = 1, sy = 1, cx = W >= 1100 ? W * 0.68 : W * 0.5, cy = H * 0.5;
      var was = fitted;
      fitted = !!(box && box.right - box.left > 200 && box.bottom - box.top > 220);
      /* the page may not be laid out on the first frames: when the free
         space first appears, go straight to it rather than easing over */
      if (fitted && !was) fit.cx = null;
      if (fitted) {
        var bottom = box.bottom - PAD.bottom - (sc.timeline ? PAD.timeline : 0);
        var bw = box.right - box.left - 2 * PAD.x, bh = bottom - box.top - PAD.top;
        /* the margins leave room for the damped mouse tilt and the wobble;
           the tilt swings the sides in depth, so width needs the larger one */
        var fx = 0.88 * bw / (b.x1 - b.x0), fy = 0.94 * bh / (b.y1 - b.y0);
        var base = Math.min(fx, fy), k = sc.stretch || 1;
        sx = Math.min(fx, base * k, 1.3);
        sy = Math.min(fy, base * k, 1.3);
        cx = (box.left + box.right) / 2 - sx * (b.x0 + b.x1) / 2;
        cy = (box.top + PAD.top + bottom) / 2 - sy * (b.y0 + b.y1) / 2;
      }
      if (fit.cx === null) { fit.sx = sx; fit.sy = sy; fit.cx = cx; fit.cy = cy; return; }
      fit.sx += (sx - fit.sx) * 0.06;
      fit.sy += (sy - fit.sy) * 0.06;
      fit.cx += (cx - fit.cx) * 0.06;
      fit.cy += (cy - fit.cy) * 0.06;
    }

    /* ── soft glow sprites, one per colour ── */
    var sprites = {};
    function sprite(color) {
      if (sprites[color]) return sprites[color];
      var cv = document.createElement('canvas');
      cv.width = cv.height = 32;
      var g = cv.getContext('2d');
      var gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, color);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 32, 32);
      return (sprites[color] = cv);
    }

    /* ── scene clock ── */
    var sceneIdx = 0, sceneStart = null, lastStepShown = -1;

    function sceneClock(sc, t) {
      /* [step, next step, progress between them, scene finished] at time t */
      var hold0 = sc.stepHold == null ? 0.3 : sc.stepHold;
      var local = t - MORPH;
      if (local < 0) return [0, 0, 0, false];
      var k = Math.floor(local / sc.stepDur);
      if (k >= sc.steps - 1) {
        var over = local - (sc.steps - 1) * sc.stepDur;
        if (over < sc.hold) return [sc.steps - 1, sc.steps - 1, 0, false];
        if (scenes.length === 1 && sc.steps > 1) {
          /* a lone scene loops: glide from the last step back to the first */
          var q = clamp01((over - sc.hold) / sc.stepDur);
          return [sc.steps - 1, 0, ease(q), q >= 1];
        }
        return [sc.steps - 1, sc.steps - 1, 0, true];
      }
      var into = (local - k * sc.stepDur) / sc.stepDur;
      return [k, k + 1, ease(clamp01((into - hold0) / (1 - hold0))), false];
    }

    function report(sc, k) {
      var st = sc.stats(k);
      if (onStep) onStep(st);
      if (yearEl && st[0]) yearEl.textContent = st[0][1];
      if (shareEl && st[1]) shareEl.textContent = st[1][1];
    }

    function startScene(i, ts) {
      var sc = scenes[i];
      sceneIdx = i;
      sceneStart = ts;
      assign(sc);
      if (onScene) onScene({ id: sc.id, title: sc.title, caption: sc.caption, legend: sc.legend });
      lastStepShown = -1;
    }

    /* ── drawing ── */
    function render(ts, snap) {
      var sc = scenes[sceneIdx];
      var t = ts - sceneStart;
      var clock = sceneClock(sc, t);
      var kA = clock[0], kB = clock[1], p = clock[2];
      var LA = sc.layouts[kA], LB = sc.layouts[kB];

      var shown = p > 0.5 ? kB : kA;
      if (shown !== lastStepShown) { lastStepShown = shown; report(sc, shown); }

      size();
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);

      mouse.x += (mouse.targetX - mouse.x) * 0.15;
      mouse.y += (mouse.targetY - mouse.y) * 0.15;

      updateFit(sc);
      /* a fitted field tilts less, so its near side cannot swell into the text */
      var tilt = fitted ? 0.35 : 1;
      rotX += (targetRotX * tilt - rotX) * 0.06;
      rotY += (targetRotY * tilt - rotY) * 0.06;
      var cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      var cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      var centerX = fit.cx, centerY = fit.cy, fsx = fit.sx, fsy = fit.sy;
      var fs = Math.sqrt(fsx * fsy);

      function project(x, y, z) {
        var x1 = x * cosY - z * sinY;
        var z1 = z * cosY + x * sinY;
        var y1 = y * cosX - z1 * sinX;
        var z2 = z1 * cosX + y * sinX;
        var dist = fov + z2;
        if (dist <= 10) return null;
        var s = fov / dist;
        return { sx: centerX + x1 * s * fsx, sy: centerY - y1 * s * fsy, sc: s };
      }

      for (var sw = ripples.length - 1; sw >= 0; sw--) {
        var rip = ripples[sw];
        rip.r += 10;
        rip.alpha *= 0.94;
        if (rip.alpha < 0.01 || rip.r > rip.maxR) { ripples.splice(sw, 1); continue; }
        ctx.strokeStyle = 'rgba(' + C.ripple + ', ' + (rip.alpha * 0.3) + ')';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
        ctx.stroke();
      }

      var morphing = !snap && t < MORPH + 200;
      var hoverDist = 90 * 90, hoverNode = -1;

      for (var i = 0; i < N; i++) {
        var nd = nodes[i];
        var A = LA[nd.item], B = LB[nd.item];
        var tx = lerp(A.x, B.x, p), ty = lerp(A.y, B.y, p), tz = lerp(A.z, B.z, p);
        var ta = nd.dup ? 0 : lerp(A.a, B.a, p), tsz = lerp(A.s, B.s, p);
        var tc = p > 0.5 ? B.c : A.c;
        ty += Math.sin(ts * 0.002 + tx * 0.012 + A.g * 0.3) * sc.wobble;

        if (snap) {
          nd.x = tx; nd.y = ty; nd.z = tz; nd.a = ta; nd.s = tsz; nd.c = tc; nd.done = true;
        } else if (!nd.done) {
          var u = clamp01((t - nd.delay) / nd.dur), e = ease(u), v = 1 - e;
          nd.x = v * v * nd.p0.x + 2 * v * e * nd.p1.x + e * e * tx;
          nd.y = v * v * nd.p0.y + 2 * v * e * nd.p1.y + e * e * ty;
          nd.z = v * v * nd.p0.z + 2 * v * e * nd.p1.z + e * e * tz;
          nd.a = lerp(nd.a0, ta, e);
          nd.s = lerp(nd.s0, tsz, e);
          nd.c = e < 0.5 ? nd.c0 : tc;
          if (u >= 1) nd.done = true;
        } else {
          nd.x = tx; nd.y = ty; nd.z = tz;
          nd.a += (ta - nd.a) * 0.15;
          nd.s += (tsz - nd.s) * 0.15;
          nd.c = tc;
        }

        /* the pointer nudges dots aside; they spring back */
        nd.ox += nd.vx; nd.oy += nd.vy;
        nd.vx *= 0.84; nd.vy *= 0.84;
        nd.ox *= 0.9; nd.oy *= 0.9;

        var q = project(nd.x + nd.ox, nd.y + nd.oy, nd.z);
        if (!q) { nd.sc = 0; continue; }
        nd.sx = q.sx; nd.sy = q.sy; nd.sc = q.sc;

        if (mouse.active && !snap) {
          var dx = q.sx - mouse.x, dy = q.sy - mouse.y, dSq = dx * dx + dy * dy;
          var radius = 120 * Math.min(1, fs);
          if (dSq < radius * radius && dSq > 1) {
            var dLen = Math.sqrt(dSq), force = (1 - dLen / radius) * 4.5 / Math.max(0.4, fs);
            nd.vx += (dx / dLen) * force;
            nd.vy -= (dy / dLen) * force;
          }
          if (!nd.dup && ta > 0.25 && dSq < hoverDist) { hoverDist = dSq; hoverNode = i; }
        }
      }

      var hoverGroup = hoverNode >= 0 ? LA[nodes[hoverNode].item].g : -1;
      var labelA = snap ? 1 : clamp01((t - MORPH + 300) / 700);

      // 1. mesh / line links (once the dots have landed)
      if (sc.links && !morphing) {
        ctx.lineWidth = 0.6;
        for (var li = 0; li < sc.links.length; li++) {
          var n1 = nodes[inv[sc.links[li][0]]], n2 = nodes[inv[sc.links[li][1]]];
          if (!n1 || !n2 || n1.a < 0.05 || n2.a < 0.05 || !n1.sc || !n2.sc) continue;
          var lit = hoverGroup >= 0 && LA[n1.item].g === hoverGroup && LA[n2.item].g === hoverGroup;
          ctx.strokeStyle = lit ? C.hover : n1.c;
          ctx.globalAlpha = Math.min(n1.a, n2.a) * (lit ? 0.7 : 0.26) * labelA;
          ctx.beginPath();
          ctx.moveTo(n1.sx, n1.sy);
          ctx.lineTo(n2.sx, n2.sy);
          ctx.stroke();
        }
      }

      // 2. scene overlay (reference lines)
      if (sc.overlay) sc.overlay(ctx, project, labelA);

      // 3. dots: soft glow behind, crisp core in front; far dots fade a little
      var dotScale = Math.max(0.7, Math.min(1.25, fs));
      if (glow) {
        ctx.globalCompositeOperation = 'lighter';
        for (var gI = 0; gI < N; gI++) {
          var gn = nodes[gI];
          if (gn.a < 0.3 || !gn.sc) continue;
          var gr = 2.6 * gn.s * gn.sc * dotScale * 3.2;
          ctx.globalAlpha = gn.a * 0.22;
          ctx.drawImage(sprite(gn.c), gn.sx - gr, gn.sy - gr, gr * 2, gr * 2);
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      for (var d = 0; d < N; d++) {
        var pn = nodes[d];
        if (pn.a < 0.02 || !pn.sc) continue;
        var lit3 = hoverGroup >= 0 && !pn.dup && pn.a > 0.25 && LA[pn.item].g === hoverGroup;
        var depth = Math.max(0.5, Math.min(1, 0.6 + (pn.sc - 0.9) * 1.6));
        var r = Math.max(1.1, (lit3 ? 1.35 : 1) * 2.6 * pn.s * pn.sc * dotScale);
        ctx.globalAlpha = lit3 ? 1 : pn.a * depth;
        ctx.fillStyle = lit3 ? C.hover : pn.c;
        ctx.beginPath();
        ctx.arc(pn.sx, pn.sy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. labels
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillStyle = C.label;
      var labels = sc.labels(kA, kB, p);
      for (var lb = 0; lb < labels.length; lb++) {
        var L = labels[lb], lq = project(L[1], L[2], L[3]);
        if (!lq) continue;
        ctx.globalAlpha = (L[5] == null ? 0.55 : L[5]) * labelA;
        ctx.textAlign = L[4];
        ctx.fillText(L[0], lq.sx, lq.sy);
      }
      ctx.textAlign = 'left';

      // 5. timeline under the chart
      if (sc.timeline && sc.timeline.length > 1) drawTimeline(sc, kA, kB, p, labelA);

      // 6. tooltip
      if (hoverNode >= 0 && mouse.active) {
        var tip = sc.tip(nodes[hoverNode].item, shown, hoverGroup);
        ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
        var w1 = ctx.measureText(tip[0]).width;
        ctx.font = '11px "JetBrains Mono", monospace';
        var ttW = Math.ceil(Math.max(w1, ctx.measureText(tip[1]).width)) + 24;
        var ttX = Math.min(W - ttW - 10, Math.max(10, mouse.x + 18));
        var ttY = Math.min(H - 70, Math.max(10, mouse.y - 45));
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(ttX, ttY, ttW, 62, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#1a535c';
        ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(tip[0], ttX + 12, ttY + 22);
        ctx.fillStyle = '#4f5664';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.fillText(tip[1], ttX + 12, ttY + 44);
      }

      ctx.globalAlpha = 1;
      ctx.restore();
      return clock[3];
    }

    function drawTimeline(sc, kA, kB, p, alpha) {
      var b = sceneBounds(sc);
      var left = fit.cx + fit.sx * b.x0 + 8, right = fit.cx + fit.sx * b.x1 - 8;
      var y = fit.cy + fit.sy * b.y1 + 28;
      var T = sc.timeline, t0 = +T[0], t1 = +T[T.length - 1];
      function at(i) { return left + (+T[i] - t0) / (t1 - t0) * (right - left); }
      var curX = lerp(at(kA), at(kB), p);
      var cur = p > 0.5 ? kB : kA;

      ctx.globalAlpha = 0.25 * alpha;
      ctx.strokeStyle = C.label;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
      ctx.fillStyle = C.label;
      ctx.globalAlpha = 0.5 * alpha;
      for (var i = 0; i < T.length; i++) {
        ctx.beginPath(); ctx.arc(at(i), y, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      var firstTxt = sc.timelineFirst || String(T[0]);
      if (Math.abs(curX - at(0)) > 34) ctx.fillText(firstTxt, at(0), y + 16);
      if (Math.abs(curX - at(T.length - 1)) > 34) ctx.fillText(String(T[T.length - 1]), at(T.length - 1), y + 16);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = C.hover;
      ctx.beginPath(); ctx.arc(curX, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText(cur === 0 && sc.timelineFirst ? sc.timelineFirst : String(T[cur]), curX, y + 17);
      ctx.textAlign = 'left';
    }

    /* ── run ── */
    var raf = null, stopped = false;
    var reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      /* one still picture: the first scene at its last step */
      startScene(0, 0);
      var sc0 = scenes[0];
      render(MORPH + sc0.stepDur * (sc0.steps - 1) + 1, true);
      return { scenes: scenes.map(function (s) { return s.id; }), stop: function () {} };
    }

    /* The field loops for as long as the page is open, and each frame draws
       every dot. Once the hero has scrolled away nobody can see it, but it
       would keep the main thread busy and make the rest of the page scroll
       unevenly, so it sleeps while it is off screen. */
    var onScreen = true, pausedAt = null;

    function frame(ts) {
      if (stopped) return;
      if (!onScreen) { raf = 0; pausedAt = ts; return; }
      if (pausedAt !== null) {
        if (sceneStart !== null) sceneStart += ts - pausedAt;
        pausedAt = null;
      }
      if (sceneStart === null) startScene(0, ts);
      if (render(ts, false)) {
        if (scenes.length > 1) startScene((sceneIdx + 1) % scenes.length, ts);
        else sceneStart = ts - MORPH;   // a lone scene carries on from its first step
      }
      raf = global.requestAnimationFrame(frame);
    }

    function onResize() { size(); boxAge = 0; }
    if (global.ResizeObserver) new global.ResizeObserver(onResize).observe(canvas);
    else global.addEventListener('resize', onResize);

    if (global.IntersectionObserver) {
      new global.IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
        if (onScreen && !raf && !stopped) raf = global.requestAnimationFrame(frame);
      }).observe(canvas);
    }

    raf = global.requestAnimationFrame(frame);

    return {
      scenes: scenes.map(function (s) { return s.id; }),
      stop: function () {
        stopped = true;
        if (raf) global.cancelAnimationFrame(raf);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseleave', onMouseLeave);
        window.removeEventListener('click', onClick);
      }
    };
  }

  dotfield3d.SCENES = Object.keys(SCENES);
  dotfield3d.TRENDS = [
    [1901, 10302917], [1911, 11378875], [1921, 11158586], [1931, 12491056],
    [1941, 13767988], [1951, 14645946], [1961, 17548846], [1971, 21944615],
    [1981, 26370271], [1991, 31659736], [2001, 36804660], [2011, 41974218],
    [2021, 46254277]
  ];

  global.dotfield3d = dotfield3d;
})(window);
