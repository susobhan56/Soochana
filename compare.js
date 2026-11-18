/* ═══════════════════════════════════════════════════════════════════
   compare.js — Compare two districts (odisha_compare.html)

     1. the two district cards (profile, sparkline, swap)
     2. strengths at a glance
     3. measure-by-measure strips: all 30 districts, Odisha, and each
        chosen district's move from the earlier survey to the latest
     4. population, 1951 to 2036
     5. one age pyramid for both districts, with a year player

   Data: district_population_trends.json, nfhs_district_rounds.json,
   district_life_expectancy.json, district_mortality.json and
   district_age_pyramids.json, through data_loader.js. Every figure is
   computed here; only labels and short sentences are typed. Wording is
   kept positive or neutral, as on the rest of the portal.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  var fmt = function (n) { return Math.round(n).toLocaleString('en-IN'); };
  var lakh = function (n) { return (n / 1e5).toFixed(1) + ' lakh'; };
  var NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* the measures, in groups. src: which file; n: NFHS indicator number;
     pol: 1 higher is better, -1 lower is better, 0 neither. lead: the
     phrase used in "strengths" when a district is ahead. */
  var GROUPS = [
    { name: 'Health and care', rows: [
      { src: 'nfhs', n: 36, label: 'Births in a health facility', lead: 'More births in a health facility' },
      { src: 'nfhs', n: 45, label: 'Children aged 12–23 months fully vaccinated', lead: 'More children fully vaccinated' },
      { src: 'nfhs', n: 31, label: 'Mothers with four or more antenatal visits', lead: 'More mothers with four antenatal visits' },
      { src: 'nfhs', n: 7, label: 'Households with health cover', lead: 'More households with health cover' }
    ] },
    { name: 'Women and girls', rows: [
      { src: 'nfhs', n: 12, label: 'Women with ten or more years of school', lead: 'More women with ten years of school' },
      { src: 'nfhs', n: 14, label: 'Women who have used the internet', lead: 'More women online' },
      { src: 'nfhs', n: 94, label: 'Women with a mobile phone of their own', lead: 'More women with their own phone' },
      { src: 'nfhs', n: 16, label: 'Women aged 20–24 married before 18', lead: 'Fewer girls married before 18' }
    ] },
    { name: 'Children and nutrition', rows: [
      { src: 'nfhs', n: 70, label: 'Children under five who are stunted', lead: 'Fewer children stunted' },
      { src: 'nfhs', n: 71, label: 'Children under five who are wasted', lead: 'Fewer children wasted' },
      { src: 'nfhs', n: 5, label: 'People with an improved drinking-water source', lead: 'More homes with safe drinking water' }
    ] },
    { name: 'Survival, across three survey rounds', rows: [
      { src: 'le', sex: 'female', label: 'Life expectancy at birth, women', unit: ' yrs', pol: 1, lead: 'Longer lives for women' },
      { src: 'le', sex: 'male', label: 'Life expectancy at birth, men', unit: ' yrs', pol: 1, lead: 'Longer lives for men' },
      { src: 'mort', key: 'infant_mortality_rate', label: 'Infant deaths per 1,000 live births', unit: '', pol: -1, lead: 'Fewer infant deaths' }
    ] },
    { name: 'People', rows: [
      { src: 'pop', key: 'sexratio', label: 'Women per 1,000 men, 2011 to 2021', unit: '', pol: 0 },
      { src: 'pop', key: 'growth', label: 'Yearly population growth, %, 2001–11 to 2011–21', unit: '%', pol: 0 }
    ] }
  ];

  Promise.all([
    DataLoader.getDistrictPopulationTrends(),
    DataLoader.loadJSON('datasets/nfhs_district_rounds.json'),
    DataLoader.getDistrictLifeExpectancy(),
    DataLoader.getDistrictMortality(),
    DataLoader.getDistrictAgePyramids()
  ]).then(function (res) {
    var POP = res[0], NFHS = res[1], LE = res[2], MORT = res[3], PYR = res[4];
    var DISTS = Object.keys(POP).sort();
    var byN = {};
    NFHS.indicators.forEach(function (i) { byN[i.n] = i; });
    var YEARS = Object.keys(POP[DISTS[0]]).map(Number).sort(function (a, b) { return a - b; });
    var stateAt = function (y) { return DISTS.reduce(function (s, d) { return s + POP[d][y].total; }, 0); };
    function growth(d, a, b) { return (Math.pow(POP[d][b].total / POP[d][a].total, 1 / (b - a)) - 1) * 100; }

    /* one accessor per row: values in the earlier and the latest round,
       the round names, the unit, the polarity, and Odisha's figure */
    function spec(r) {
      if (r.src === 'nfhs') {
        var ind = byN[r.n];
        return { pol: ind.polarity, unit: ind.unit === '%' ? '%' : '', rounds: ['NFHS-5', 'NFHS-6'],
          get: function (d) { var v = ind.districts[d]; return v ? [v[1], v[0]] : [null, null]; },
          state: ind.odisha && ind.odisha.nfhs6 != null ? ind.odisha.nfhs6 : null };
      }
      if (r.src === 'le') {
        return { pol: 1, unit: r.unit, rounds: ['NFHS-4', 'NFHS-5'], state: null,
          get: function (d) { var v = LE[d] && LE[d][r.sex]; return v ? [v.nfhs4, v.nfhs5] : [null, null]; } };
      }
      if (r.src === 'mort') {
        return { pol: -1, unit: '', rounds: ['NFHS-4', 'NFHS-5'], state: null,
          get: function (d) { var v = MORT[d] && MORT[d][r.key]; return v ? [v.nfhs4, v.nfhs5] : [null, null]; } };
      }
      if (r.key === 'sexratio') {
        var sr = function (d, y) { var p = POP[d][y]; return p.female / p.male * 1000; };
        return { pol: 0, unit: '', rounds: ['2011', '2021'], get: function (d) { return [sr(d, 2011), sr(d, 2021)]; },
          state: DISTS.reduce(function (s, d) { return s + POP[d][2021].female; }, 0) / DISTS.reduce(function (s, d) { return s + POP[d][2021].male; }, 0) * 1000 };
      }
      return { pol: 0, unit: '%', rounds: ['2001–11', '2011–21'], get: function (d) { return [growth(d, 2001, 2011), growth(d, 2011, 2021)]; },
        state: (Math.pow(stateAt(2021) / stateAt(2011), 0.1) - 1) * 100 };
    }
    GROUPS.forEach(function (g) { g.rows.forEach(function (r) { r.s = spec(r); }); });
    function show(v, unit) {
      if (v == null || isNaN(v)) return '–';
      var dec = unit === ' yrs' || unit === '%' ? 1 : (Math.abs(v) >= 100 ? 0 : 1);
      return (+v).toFixed(dec) + (unit === ' yrs' ? '' : unit);
    }

    /* ── state of the page ── */
    var params = new URLSearchParams(location.search);
    var A = DISTS.indexOf(params.get('a')) >= 0 ? params.get('a') : 'Khordha';
    var B = DISTS.indexOf(params.get('b')) >= 0 ? params.get('b') : 'Ganjam';
    var year = '2021', playing = null;

    /* ── 1. the cards ── */
    ['A', 'B'].forEach(function (side) {
      var sel = $('sel' + side);
      DISTS.forEach(function (d) { var o = el('option', null, d); o.value = d; sel.appendChild(o); });
      sel.addEventListener('change', function () {
        if (side === 'A') A = sel.value; else B = sel.value;
        update();
      });
    });
    $('swap').addEventListener('click', function () { var t = A; A = B; B = t; update(); });

    var rank = DISTS.slice().sort(function (a, b) { return POP[b][2021].total - POP[a][2021].total; });
    function card(side, d) {
      var p21 = POP[d][2021].total, share = p21 / stateAt(2021) * 100;
      $('pop' + side).textContent = lakh(p21);
      $('meta' + side).textContent = share.toFixed(1) + '% of Odisha · ' + ordinal(rank.indexOf(d) + 1) + ' largest of 30';
      $('grow' + side).textContent = growth(d, 2011, 2021).toFixed(2) + '% a year, 2011–21';
      $('proj' + side).textContent = lakh(POP[d][2036].total) + ' projected for 2036';
      $('link' + side).href = 'district.html?id=' + encodeURIComponent(d);
      spark($('spark' + side), d);
    }
    function ordinal(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
    function spark(svg, d) {
      svg.textContent = '';
      var W = 240, H = 54, vals = YEARS.map(function (y) { return POP[d][y].total; });
      var mx = Math.max.apply(null, vals) * 1.05;
      var x = function (y) { return 4 + (y - YEARS[0]) / (YEARS[YEARS.length - 1] - YEARS[0]) * (W - 8); };
      var yv = function (v) { return H - 6 - v / mx * (H - 14); };
      var line = function (ys) { return ys.map(function (y, i) { return (i ? 'L' : 'M') + x(y).toFixed(1) + ' ' + yv(POP[d][y].total).toFixed(1); }).join(''); };
      svgEl('path', { 'class': 'sp-area', d: line(YEARS) + 'L' + x(YEARS[YEARS.length - 1]) + ' ' + (H - 6) + 'L' + x(YEARS[0]) + ' ' + (H - 6) + 'Z' }, svg);
      svgEl('path', { 'class': 'sp-line', d: line(YEARS.filter(function (y) { return y <= 2011; })) }, svg);
      svgEl('path', { 'class': 'sp-line sp-proj', d: line(YEARS.filter(function (y) { return y >= 2011; })) }, svg);
      svgEl('circle', { 'class': 'sp-dot', cx: x(2021), cy: yv(POP[d][2021].total), r: 3.5 }, svg);
      var t1 = svgEl('text', { 'class': 'sp-lab', x: 4, y: H }, svg); t1.textContent = YEARS[0];
      var t2 = svgEl('text', { 'class': 'sp-lab', x: W - 4, y: H, 'text-anchor': 'end' }, svg); t2.textContent = YEARS[YEARS.length - 1];
    }

    /* ── 3. the strips (built once, moved on every change) ── */
    var rowsEl = $('cmpRows'), ROWS = [];
    GROUPS.forEach(function (g) {
      var sec = el('section', 'cs-group');
      sec.appendChild(el('h3', 'cs-gname', g.name));
      g.rows.forEach(function (r) {
        var s = r.s, row = el('div', 'cs-row');
        var lab = el('div', 'cs-label');
        lab.appendChild(el('span', 'cs-lname', r.label));
        lab.appendChild(el('span', 'cs-lnote', s.rounds[0] + ' → ' + s.rounds[1] + (s.pol === 1 ? ' · higher is better' : s.pol === -1 ? ' · lower is better' : '')));
        row.appendChild(lab);
        var va = el('div', 'cs-val cs-a'), vb = el('div', 'cs-val cs-b');
        var strip = el('div', 'cs-strip');
        strip.appendChild(el('i', 'cs-track'));
        /* the domain: every district in both rounds, and Odisha */
        var all = [];
        DISTS.forEach(function (d) { s.get(d).forEach(function (v) { if (v != null) all.push(v); }); });
        if (s.state != null) all.push(s.state);
        var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), pad = (hi - lo) * 0.06 || 1;
        r.lo = lo - pad; r.hi = hi + pad;
        r.pos = function (v) { return ((v - r.lo) / (r.hi - r.lo) * 100).toFixed(2) + '%'; };
        DISTS.forEach(function (d) {
          var v = s.get(d)[1];
          if (v == null) return;
          var dot = el('i', 'cs-all');
          dot.style.left = r.pos(v);
          dot.title = d + ': ' + show(v, s.unit) + ' (' + s.rounds[1] + ')';
          strip.appendChild(dot);
        });
        if (s.state != null) {
          var st = el('i', 'cs-state');
          st.style.left = r.pos(s.state);
          st.title = 'Odisha: ' + show(s.state, s.unit);
          st.appendChild(el('span', null, 'Odisha'));
          strip.appendChild(st);
        }
        var mk = function (side) {
          var m = { arrow: el('i', 'cs-move cs-move-' + side), was: el('i', 'cs-was cs-was-' + side), now: el('i', 'cs-now cs-now-' + side) };
          strip.appendChild(m.arrow); strip.appendChild(m.was); strip.appendChild(m.now);
          return m;
        };
        var mA = mk('a'), mB = mk('b');
        row.appendChild(va); row.appendChild(strip); row.appendChild(vb);
        var ends = el('div', 'cs-ends');
        ends.appendChild(el('span', null, show(lo, s.unit)));
        ends.appendChild(el('span', null, show(hi, s.unit)));
        row.appendChild(ends);
        sec.appendChild(row);
        ROWS.push({ r: r, va: va, vb: vb, mA: mA, mB: mB });
      });
      rowsEl.appendChild(sec);
    });

    function place(m, r, pair, d) {
      var s = r.s, was = pair[0], now = pair[1];
      [m.arrow, m.was, m.now].forEach(function (n) { n.hidden = now == null; });
      if (now == null) return;
      m.now.style.left = r.pos(now);
      m.now.title = d + ', ' + s.rounds[1] + ': ' + show(now, s.unit);
      if (was == null) { m.was.hidden = m.arrow.hidden = true; return; }
      m.was.style.left = r.pos(was);
      m.was.title = d + ', ' + s.rounds[0] + ': ' + show(was, s.unit);
      var a = parseFloat(r.pos(was)), b = parseFloat(r.pos(now));
      m.arrow.style.left = Math.min(a, b) + '%';
      m.arrow.style.width = Math.abs(b - a) + '%';
      m.arrow.classList.toggle('is-left', b < a);
    }
    function valCell(cell, r, pair, other, side) {
      var s = r.s;
      cell.textContent = '';
      cell.appendChild(el('b', null, show(pair[1], s.unit)));
      cell.appendChild(el('small', null, pair[0] != null ? 'from ' + show(pair[0], s.unit) : ''));
      var leads = s.pol !== 0 && pair[1] != null && other[1] != null && (pair[1] - other[1]) * s.pol > 0;
      cell.classList.toggle('leads', !!leads);
    }

    /* ── 2. strengths ── */
    function strengths(dX, dY) {
      var out = [];
      ROWS.forEach(function (row) {
        var r = row.r, s = r.s;
        if (!s.pol || !r.lead) return;
        var x = s.get(dX)[1], y = s.get(dY)[1];
        if (x == null || y == null) return;
        var gap = (x - y) * s.pol / (r.hi - r.lo);
        if (gap > 0.02) out.push({ gap: gap, text: r.lead, x: x, y: y, unit: s.unit });
      });
      return out.sort(function (a, b) { return b.gap - a.gap; });
    }
    function strengthList(ul, list, dX, dY) {
      ul.textContent = '';
      list.slice(0, 4).forEach(function (it) {
        var li = el('li');
        li.appendChild(el('b', null, it.text));
        li.appendChild(el('span', null, show(it.x, it.unit) + ' in ' + dX + ', ' + show(it.y, it.unit) + ' in ' + dY));
        ul.appendChild(li);
      });
      if (!list.length) ul.appendChild(el('li', 'cs-none', 'Close to ' + dY + ' on every measure here.'));
    }

    /* ── 4. population over time ── */
    function popChart() {
      var svg = $('popChart');
      svg.textContent = '';
      var W = 760, H = 300, m = { l: 56, r: 92, t: 16, b: 34 };
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      var vals = [];
      [A, B].forEach(function (d) { YEARS.forEach(function (y) { vals.push(POP[d][y].total); }); });
      var mx = Math.max.apply(null, vals) * 1.08;
      var x = d3.scaleLinear([YEARS[0], YEARS[YEARS.length - 1]], [m.l, W - m.r]);
      var y = d3.scaleLinear([0, mx], [H - m.b, m.t]).nice();
      y.ticks(5).forEach(function (t) {
        svgEl('line', { 'class': 'pc-grid', x1: m.l, x2: W - m.r, y1: y(t), y2: y(t) }, svg);
        svgEl('text', { 'class': 'pc-tick', x: m.l - 8, y: y(t) + 4, 'text-anchor': 'end' }, svg).textContent = (t / 1e5).toFixed(0) + 'L';
      });
      [1951, 1971, 1991, 2011, 2036].forEach(function (t) {
        svgEl('text', { 'class': 'pc-tick', x: x(t), y: H - 10, 'text-anchor': 'middle' }, svg).textContent = t;
      });
      svgEl('rect', { 'class': 'pc-proj', x: x(2011), y: m.t, width: x(YEARS[YEARS.length - 1]) - x(2011), height: H - m.b - m.t }, svg);
      svgEl('text', { 'class': 'pc-projlab', x: x(2011) + 8, y: m.t + 16 }, svg).textContent = 'projected';
      [[A, 'a'], [B, 'b']].forEach(function (p) {
        var d = p[0], cls = p[1];
        var path = function (ys) { return ys.map(function (yy, i) { return (i ? 'L' : 'M') + x(yy).toFixed(1) + ' ' + y(POP[d][yy].total).toFixed(1); }).join(''); };
        var l1 = svgEl('path', { 'class': 'pc-line pc-' + cls, d: path(YEARS.filter(function (yy) { return yy <= 2011; })) }, svg);
        svgEl('path', { 'class': 'pc-line pc-dash pc-' + cls, d: path(YEARS.filter(function (yy) { return yy >= 2011; })) }, svg);
        YEARS.forEach(function (yy) {
          var c = svgEl('circle', { 'class': 'pc-pt pc-' + cls, cx: x(yy), cy: y(POP[d][yy].total), r: 3.5 }, svg);
          svgEl('title', {}, c).textContent = d + ', ' + yy + ': ' + fmt(POP[d][yy].total);
        });
        var last = YEARS[YEARS.length - 1];
        svgEl('text', { 'class': 'pc-end pc-' + cls, x: x(last) + 8, y: y(POP[d][last].total) + 4 }, svg).textContent = d;
        if (!reduced) {
          var len = l1.getTotalLength();
          l1.style.strokeDasharray = len; l1.style.strokeDashoffset = len;
          l1.getBoundingClientRect();
          l1.style.transition = 'stroke-dashoffset 1.2s ease';
          l1.style.strokeDashoffset = 0;
        }
      });
      var gA = (POP[A][2021].total / POP[A][1951].total), gB = (POP[B][2021].total / POP[B][1951].total);
      $('popNote').textContent = A + ' has grown ' + gA.toFixed(1) + ' times since 1951, ' + B + ' ' + gB.toFixed(1) + ' times. Census to 2011, projected after.';
    }

    /* ── 5. the age pyramid ── */
    var AGES = ['0-4','5-9','10-14','15-19','20-24','25-29','30-34','35-39','40-44','45-49','50-54','55-59','60-64','65-69','70-74','75-79','80+'];
    var PY = { W: 640, H: 420, m: { t: 30, b: 28, side: 24 }, mid: 46 };
    var pyr = $('pyrChart');
    pyr.setAttribute('viewBox', '0 0 ' + PY.W + ' ' + PY.H);
    var cx = PY.W / 2, half = (PY.W - 2 * PY.m.side - PY.mid) / 2, rowH = (PY.H - PY.m.t - PY.m.b) / AGES.length;
    svgEl('text', { 'class': 'py-head', x: cx - PY.mid / 2 - 4, y: 18, 'text-anchor': 'end' }, pyr).textContent = 'MEN';
    svgEl('text', { 'class': 'py-head', x: cx + PY.mid / 2 + 4, y: 18 }, pyr).textContent = 'WOMEN';
    var gBars = svgEl('g', {}, pyr), gOut = svgEl('g', {}, pyr);
    AGES.forEach(function (a, i) {
      var yy = PY.H - PY.m.b - (i + 1) * rowH;
      svgEl('text', { 'class': 'py-age', x: cx, y: yy + rowH / 2 + 4 }, pyr).textContent = a;
    });
    var gridX = svgEl('g', { 'class': 'py-grid' }, pyr);
    function shares(d, y) {
      var rows = (PYR[d] && PYR[d][y]) || [];
      var tot = rows.reduce(function (s, r) { return s + r.male + r.female; }, 0);
      var map = {}; rows.forEach(function (r) { map[r.age] = r; });
      return { tot: tot, get: function (a, sx) { var r = map[a]; return r ? r[sx] / tot * 100 : 0; },
        band: function (from, to) {
          var s = 0; AGES.slice(from, to).forEach(function (a) { var r = map[a]; if (r) s += r.male + r.female; }); return s / tot * 100;
        } };
    }
    function drawPyr() {
      var sA = shares(A, year), sB = shares(B, year);
      var mxv = 0;
      [sA, sB].forEach(function (s) { AGES.forEach(function (a) { mxv = Math.max(mxv, s.get(a, 'male'), s.get(a, 'female')); }); });
      mxv = Math.ceil(mxv + 0.5);
      var sc = function (v) { return v / mxv * half; };
      gridX.textContent = '';
      [2, 4, 6, 8].filter(function (t) { return t < mxv; }).forEach(function (t) {
        [-1, 1].forEach(function (sg) {
          var xx = cx + sg * (PY.mid / 2 + sc(t));
          svgEl('line', { x1: xx, x2: xx, y1: PY.m.t, y2: PY.H - PY.m.b }, gridX);
          svgEl('text', { x: xx, y: PY.H - 8, 'text-anchor': 'middle' }, gridX).textContent = t + '%';
        });
      });
      function bars(g, s, cls, d) {
        AGES.forEach(function (a, i) {
          ['male', 'female'].forEach(function (sx) {
            var key = cls + i + sx, r = g.querySelector('[data-k="' + key + '"]');
            if (!r) {
              r = svgEl('rect', { 'data-k': key, 'class': 'py-bar ' + cls, height: Math.max(2, rowH - (cls === 'py-a' ? 3 : 5)) }, g);
              svgEl('title', {}, r);
            }
            var w = sc(s.get(a, sx)), yy = PY.H - PY.m.b - (i + 1) * rowH + (cls === 'py-a' ? 1.5 : 2.5);
            r.setAttribute('y', yy.toFixed(1));
            r.setAttribute('width', w.toFixed(1));
            r.setAttribute('x', (sx === 'male' ? cx - PY.mid / 2 - w : cx + PY.mid / 2).toFixed(1));
            r.firstChild.textContent = d + ', ' + (sx === 'male' ? 'men' : 'women') + ' ' + a + ': ' + s.get(a, sx).toFixed(1) + '% of the district';
          });
        });
      }
      bars(gBars, sA, 'py-a', A);
      bars(gOut, sB, 'py-b', B);
      $('pyrYear').textContent = year + (+year > 2011 ? ' (projected)' : ' (Census)');
      [['A', sA, A], ['B', sB, B]].forEach(function (p) {
        $('pyrName' + p[0]).textContent = p[2];
        $('pyrKid' + p[0]).textContent = p[1].band(0, 3).toFixed(1) + '%';
        $('pyrWork' + p[0]).textContent = p[1].band(3, 12).toFixed(1) + '%';
        $('pyrOld' + p[0]).textContent = p[1].band(12, 17).toFixed(1) + '%';
      });
      document.querySelectorAll('#pyrYears button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.year === year); });
    }
    var PYEARS = Object.keys(PYR[DISTS[0]]).sort();
    PYEARS.forEach(function (y) {
      var b = el('button', null, y); b.type = 'button'; b.dataset.year = y;
      b.addEventListener('click', function () { stop(); year = y; drawPyr(); });
      $('pyrYears').appendChild(b);
    });
    function stop() { if (playing) { clearInterval(playing); playing = null; $('pyrPlay').textContent = '▶ Play'; } }
    $('pyrPlay').addEventListener('click', function () {
      if (playing) { stop(); return; }
      var i = 0; year = PYEARS[0]; drawPyr();
      $('pyrPlay').textContent = '❚❚ Pause';
      playing = setInterval(function () {
        i++;
        if (i >= PYEARS.length) { stop(); return; }
        year = PYEARS[i]; drawPyr();
      }, 1300);
    });

    /* ── everything that depends on the pair ── */
    function update() {
      $('selA').value = A; $('selB').value = B;
      document.querySelectorAll('[data-name="A"]').forEach(function (n) { n.textContent = A; });
      document.querySelectorAll('[data-name="B"]').forEach(function (n) { n.textContent = B; });
      card('A', A); card('B', B);
      ROWS.forEach(function (row) {
        var pa = row.r.s.get(A), pb = row.r.s.get(B);
        place(row.mA, row.r, pa, A); place(row.mB, row.r, pb, B);
        valCell(row.va, row.r, pa, pb, 'a'); valCell(row.vb, row.r, pb, pa, 'b');
      });
      var sa = strengths(A, B), sb = strengths(B, A);
      strengthList($('strA'), sa, A, B); strengthList($('strB'), sb, B, A);
      $('strNote').textContent = A + ' leads on ' + sa.length + ' of these measures and ' + B + ' on ' + sb.length + '; the rest are close.';
      popChart();
      drawPyr();
      var q = new URLSearchParams(location.search); q.set('a', A); q.set('b', B);
      history.replaceState(null, '', '?' + q.toString());
    }
    update();
    document.body.classList.add('cmp-ready');
  }).catch(function (err) {
    var m = $('cmpRows');
    if (m) m.textContent = 'The district figures could not load.';
    if (window.console) console.error('Compare: data did not load', err);
  });
})();
