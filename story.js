/* ─────────────────────────────────────────────────────────────────────
   story.js — "Odisha, told in 100 people": the home page scroll story

   One sticky SVG holds 100 dots. Each card (.story-step, data-step="…")
   names a scene. When a card crosses the middle of the screen the same
   dots re-form into that scene: a waffle of 100 people, the population
   line 1901–2036, the growth-rate bars, a strip of the 30 districts by
   fertility, the district map. Dots keep their identity from scene to
   scene (dot 7 is always the 7th point of the line, the 7th district),
   so the reader can follow them as they move.

   Every number in the cards is computed here from the portal's data and
   written into its <b data-f="key">. The figures typed in index.html are
   only what shows before this script runs.

   Data: datasets/state_demographics.json, district_population_trends.json,
   district_fertility_trends.json, national_comparisons.json,
   state_details.json, learn/data/districts.json, Orissa.geojson and
   data/key_stats.js. Styles: story.css.
   ───────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* Children, working age and elders. Validated as a set against the
     off-white paper of the stage (#f3efe6): colour-blind separation, and
     each at 3:1 or more against the paper. Orange also marks "the ones
     this card is about" in the single-highlight scenes. */
  var C = {
    child: '#0f9466', work: '#2a78d6', elder: '#e05524',
    dot: '#3d5068', dim: '#cfd5dc'
  };
  /* One-hue ramp for the maps: low values pale into the paper, high
     values deep. */
  var RAMP = ['#e1ecf9', '#b7d3f6', '#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281'];
  /* the six chapters: names and icons for the cards (colours in story.css) */
  var CHAPTERS = {
    who:    { n: 1, name: 'Who',               icon: 'users' },
    growth: { n: 2, name: 'How we got here',   icon: 'trend' },
    fert:   { n: 3, name: 'Why it is slowing', icon: 'family' },
    age:    { n: 4, name: 'What it does',      icon: 'hourglass' },
    where:  { n: 5, name: 'Where',             icon: 'map' },
    asks:   { n: 6, name: 'What it asks',      icon: 'signpost' }
  };
  var REPLACEMENT = 2.1;
  var N = 100;

  /* ── names ──────────────────────────────────────────────────────────
     The files spell three districts differently. The first spelling of
     each set is the one shown. */
  var ALIASES = [['Bolangir', 'Balangir'], ['Jajpur', 'Jajapur'], ['Nabarangpur', 'Nabarangapur']];
  function variants(name) {
    for (var i = 0; i < ALIASES.length; i++) if (ALIASES[i].indexOf(name) !== -1) return ALIASES[i];
    return [name];
  }
  function canon(name) { return variants(name)[0]; }
  function pick(obj, name) {
    var v = variants(name);
    for (var i = 0; i < v.length; i++) if (obj[v[i]] != null) return obj[v[i]];
    return null;
  }

  /* ── formatting ── */
  function crore(n) { return (n / 1e7).toFixed(2) + ' crore'; }
  function lakh(n) { return Math.round(n / 1e5) + ' lakh'; }
  function fix(v, d) { return (+v).toFixed(d); }
  function pct(v, d) { return fix(v, d == null ? 1 : d) + '%'; }
  function period(a, b) { return a + '–' + String(b).slice(-2); }
  function listAnd(items) {
    return items.length < 2 ? items.join('') : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }
  /* shares → whole dots that add up to exactly 100 (largest remainder) */
  function to100(shares) {
    var sum = shares.reduce(function (a, b) { return a + b; }, 0);
    var raw = shares.map(function (s) { return s / sum * N; });
    var out = raw.map(Math.floor);
    var left = N - out.reduce(function (a, b) { return a + b; }, 0);
    raw.map(function (r, i) { return [r - Math.floor(r), i]; })
       .sort(function (a, b) { return b[0] - a[0]; })
       .slice(0, left).forEach(function (p) { out[p[1]] += 1; });
    return out;
  }

  /* ═════════════════════════════════════════════════════════════════
     1. FIGURES — everything the cards quote
     ═════════════════════════════════════════════════════════════════ */
  function compute(D) {
    var F = {}, T = {}, rows = [];
    function put(key, text, label, source) {
      T[key] = text;
      if (label) rows.push([label, text, source]);
    }

    /* population, 1901–2036 */
    /* The file holds a second, smaller table after the population series
       (the years start again at 1901). Only the first run of rising years
       is the population. */
    var trends = [];
    D.state.population_trends.some(function (r) {
      if (trends.length && r.year <= trends[trends.length - 1].year) return true;
      if (r.total) trends.push(r);
      return false;
    });
    function at(y) { return trends.filter(function (r) { return r.year === y; })[0]; }
    F.series = trends.map(function (r) { return { year: r.year, total: r.total, proj: r.year > 2011 }; });
    F.periods = [];
    for (var i = 1; i < trends.length; i++) {
      F.periods.push({ from: trends[i - 1].year, to: trends[i].year, rate: trends[i].annual_growth_rate });
    }
    var first = trends[0], last = trends[trends.length - 1];
    var p51 = at(1951), p11 = at(2011), p21 = at(2021);
    F.first = first; F.last = last;
    var SRC_POP = 'Census of India 1901–2011; population projection using the Bayesian approach (DIU), 2021–' + last.year;
    put('pop21', crore(p21.total), 'Population, 2021 (projected)', SRC_POP);
    put('dotLakh', fix(p21.total / N / 1e5, 1) + ' lakh');
    put('pop1901', crore(first.total), 'Population, ' + first.year, SRC_POP);
    put('pop1951', crore(p51.total), 'Population, 1951', SRC_POP);
    put('add0151', lakh(p51.total - first.total));
    put('pop2011', crore(p11.total), 'Population, 2011', SRC_POP);
    put('mult5111', fix(p11.total / p51.total, 1));
    put('pop2036', crore(last.total), 'Population, ' + last.year + ' (projected)', SRC_POP);
    put('add1136', lakh(last.total - p11.total));
    put('lastYear', String(last.year));

    var rated = F.periods.filter(function (p) { return p.rate != null; });
    var peak = rated.reduce(function (a, b) { return b.rate > a.rate ? b : a; });
    var tail = rated[rated.length - 1];
    F.peak = peak; F.tail = tail;
    put('peakRate', pct(peak.rate), 'Fastest growth, ' + period(peak.from, peak.to) + ' (per year)', SRC_POP);
    put('peakPeriod', period(peak.from, peak.to));
    put('tailRate', pct(tail.rate, 2), 'Growth, ' + period(tail.from, tail.to) + ' (per year, projected)', SRC_POP);
    put('tailPeriod', period(tail.from, tail.to));

    function nat(re) { return D.nat.filter(function (r) { return re.test(r.indicator); })[0]; }
    var dec = nat(/^Decadal Population Growth/i);
    if (dec) {
      put('decOd', pct(dec.odisha), 'Population growth 2011–21, Odisha', dec.source + ' (ORGI projections)');
      put('decIn', pct(dec.india), 'Population growth 2011–21, India', dec.source + ' (ORGI projections)');
    }

    /* age structure */
    function ages(y) {
      var list = (D.state.pyramids[y] || []).filter(function (r) { return /^\d+(-\d+|\+)$/.test(r.age); });
      var tot = 0, ch = 0, el = 0;
      list.forEach(function (r) {
        var lo = parseInt(r.age, 10);
        tot += r.total;
        if (lo < 15) ch += r.total; else if (lo >= 60) el += r.total;
      });
      return { year: y, child: ch, work: tot - ch - el, elder: el, total: tot,
               n: to100([ch, tot - ch - el, el]) };
    }
    var years = Object.keys(D.state.pyramids).sort();
    F.ageA = ages('2021');
    F.ageB = ages(years[years.length - 1]);
    var SRC_AGE = 'Population projection using the Bayesian approach (DIU)';
    put('ch21', String(F.ageA.n[0]), 'Children under 15 in every 100, 2021', SRC_AGE);
    put('wk21', String(F.ageA.n[1]), 'Aged 15–59 in every 100, 2021', SRC_AGE);
    put('el21', String(F.ageA.n[2]), 'Aged 60+ in every 100, 2021', SRC_AGE);
    put('ch36', String(F.ageB.n[0]), 'Children under 15 in every 100, ' + F.ageB.year, SRC_AGE);
    put('wk36', String(F.ageB.n[1]), 'Aged 15–59 in every 100, ' + F.ageB.year, SRC_AGE);
    put('el36', String(F.ageB.n[2]), 'Aged 60+ in every 100, ' + F.ageB.year, SRC_AGE);
    put('el21abs', lakh(F.ageA.elder), 'People aged 60+, 2021', SRC_AGE);
    put('el36abs', lakh(F.ageB.elder), 'People aged 60+, ' + F.ageB.year, SRC_AGE);
    put('elGrow', Math.round((F.ageB.elder / F.ageA.elder - 1) * 100) + '%');
    put('ageYear', F.ageB.year);

    /* districts */
    F.districts = D.learn.districts.map(function (d) {
      var pop = pick(D.pop, d.name);
      var tfr = pick(D.fert, d.name) || {};
      return {
        name: canon(d.name), f: d.f,
        pop11: pop && pop['2011'] ? pop['2011'].total : 0,
        tfr: tfr
      };
    }).sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    var byName = {};
    F.districts.forEach(function (d) { byName[d.name] = d; });
    F.byName = byName;

    var popSum = 0, urbSum = 0;
    F.districts.forEach(function (d) { popSum += d.pop11; urbSum += d.pop11 * d.f.urban_pct / 100; });
    var urbanShare = urbSum / popSum * 100;
    F.rural = to100([100 - urbanShare, urbanShare]);
    put('rural', String(F.rural[0]), 'Living in villages, per 100 (Census 2011)', 'Census of India 2011');
    put('urban', String(F.rural[1]), 'Living in towns and cities, per 100 (Census 2011)', 'Census of India 2011');
    function ends(key, d) {
      var s = F.districts.slice().sort(function (a, b) { return b.f[key] - a.f[key]; });
      function one(x) { return x.name + ' (' + pct(x.f[key], d) + ')'; }
      return { top: s, hi: s[0], lo: s[s.length - 1], one: one };
    }
    var u = ends('urban_pct', 0);
    put('urbMax', u.one(u.hi), 'Most urban district', 'Census of India 2011');
    put('urbMin', u.one(u.lo), 'Least urban district', 'Census of India 2011');

    var st = nat(/^ST Population Share/i);
    F.st = st ? to100([100 - st.odisha, st.odisha])[1] : 23;
    F.stIndia = st ? to100([100 - st.india, st.india])[1] : 9;
    put('st', String(F.st), 'Scheduled Tribes, per 100 (Census 2011)', 'Census of India 2011');
    put('stIndia', String(F.stIndia), 'Scheduled Tribes per 100, India (Census 2011)', 'Census of India 2011');
    var stPop = nat(/^ST Population$/i), popAct = nat(/^Population \(Actual\)/i);
    if (stPop) put('stOfIndia', pct(stPop.odisha / stPop.india * 100, 1), "Odisha's share of India's tribal population", 'Census of India 2011');
    if (popAct) put('odOfIndia', Math.round(popAct.odisha / popAct.india * 100) + '%', "Odisha's share of India's population", 'Census of India 2011');
    var tribes = null, pvtg = null;
    var slides = D.details && D.details.Odisha && D.details.Odisha.slides_detail || [];
    slides.forEach(function (s) {
      var t = s.table_data || {};
      if (t.tribal_groups_count != null) tribes = t.tribal_groups_count;
      if (t.pvtg_count != null) pvtg = t.pvtg_count;
    });
    if (tribes != null) put('stComm', String(tribes), 'Tribal communities', 'Government of Odisha');
    if (pvtg != null) put('pvtg', String(pvtg), 'Particularly vulnerable tribal groups (PVTGs)', 'Government of Odisha');

    /* fertility, district projections */
    var fy = Object.keys(D.fert[Object.keys(D.fert)[0]]).filter(function (k) { return /^\d{4}$/.test(k); }).sort();
    F.tfrA = fy.indexOf('2020') !== -1 ? '2020' : fy[0];
    F.tfrB = fy[fy.length - 1];
    var SRC_TFR = 'District fertility projection using the Bayesian approach (DIU)';
    function tfrAt(y) {
      var v = F.districts.filter(function (d) { return d.tfr[y] != null; })
        .map(function (d) { return { name: d.name, v: d.tfr[y] }; })
        .sort(function (a, b) { return b.v - a.v; });
      return { list: v, above: v.filter(function (x) { return x.v > REPLACEMENT; }), hi: v[0], lo: v[v.length - 1] };
    }
    var ta = tfrAt(F.tfrA), tb = tfrAt(F.tfrB);
    F.tfrStats = {}; F.tfrStats[F.tfrA] = ta; F.tfrStats[F.tfrB] = tb;
    put('tfrYearA', F.tfrA); put('tfrYearB', F.tfrB);
    put('tfrAboveA', String(ta.above.length), 'Districts above replacement fertility, ' + F.tfrA, SRC_TFR);
    put('tfrN', String(ta.list.length));
    put('tfrHiA', ta.hi.name + ' (' + fix(ta.hi.v, 2) + ')', 'Highest district fertility, ' + F.tfrA, SRC_TFR);
    put('tfrLoA', ta.lo.name + ' (' + fix(ta.lo.v, 2) + ')', 'Lowest district fertility, ' + F.tfrA, SRC_TFR);
    put('tfrBelowB', String(tb.list.length - tb.above.length), 'Districts below replacement fertility, ' + F.tfrB + ' (projected)', SRC_TFR);
    put('tfrAboveB', listAnd(tb.above.map(function (x) { return x.name + ' (' + fix(x.v, 2) + ')'; })) || 'none');
    put('tfrLoB', fix(tb.lo.v, 1));
    var ks = D.keyStats, tfrTile = null;
    (ks && ks.groups || []).forEach(function (g) {
      (g.tiles || []).forEach(function (t) { if (/fertility/i.test(t.label || '')) tfrTile = t; });
    });
    if (tfrTile) put('tfrState', tfrTile.value, 'Total fertility rate, Odisha', tfrTile.source);

    /* the three maps */
    var t = ends('tribal_pct', 0);
    put('stTop', listAnd(t.top.slice(0, 3).map(t.one)), 'Highest tribal share', 'Census of India 2011');
    put('stLow', t.lo.name + ' (' + pct(t.lo.f.tribal_pct, 1) + ')', 'Lowest tribal share', 'Census of India 2011');
    var l = ends('literacy', 1);
    put('litMax', l.one(l.hi), 'Highest literacy', 'Census of India 2011');
    put('litMin', l.one(l.lo), 'Lowest literacy', 'Census of India 2011');
    put('litGap', String(Math.round(l.hi.f.literacy - l.lo.f.literacy)));
    var o = ends('elderly_pct_2036', 1);
    put('oldMax', o.one(o.hi), 'Oldest district, ' + F.ageB.year + ' (share aged 60+)', SRC_AGE);
    put('oldMin', o.one(o.lo), 'Youngest district, ' + F.ageB.year + ' (share aged 60+)', SRC_AGE);

    F.T = T; F.rows = rows;
    return F;
  }

  /* ═════════════════════════════════════════════════════════════════
     2. STAGE — sizes, persistent layers, dots
     ═════════════════════════════════════════════════════════════════ */
  /* Under Node (tests/story.test.js) only the figures are wanted. */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { compute: compute, to100: to100 };
    return;
  }

  var root = document.getElementById('story');
  /* data_loader.js declares DataLoader with const, so it is a global
     binding but not a property of window */
  if (!root || !window.d3 || typeof DataLoader === 'undefined') return;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var stage = root.querySelector('.story-stage');
  var tipEl = root.querySelector('.story-tip');
  var steps = [].slice.call(root.querySelectorAll('.story-step'));

  /* Each card wears its chapter's icon. A chapter's first card gets the
     icon as a badge beside its kicker; the cards after it get a small
     line naming the chapter, so a reader who jumps in knows where they are. */
  (function decorate() {
    var I = window.SoochanaIcons;
    if (!I) return;
    steps.forEach(function (st) {
      var ch = CHAPTERS[st.getAttribute('data-ch')], card = st.querySelector('.story-card');
      if (!ch || !card) return;
      var k = card.querySelector('.sc-kicker');
      if (k) {
        var head = document.createElement('div');
        head.className = 'sc-head';
        var badge = head.appendChild(document.createElement('span'));
        badge.className = 'sc-badge';
        badge.appendChild(I.svg(ch.icon));
        card.insertBefore(head, k);
        head.appendChild(k);
      } else {
        k = document.createElement('div');
        k.className = 'sc-kicker sc-kicker-sm';
        k.appendChild(I.svg(ch.icon, 'sc-ic-sm'));
        k.appendChild(document.createTextNode('Chapter ' + ch.n + ' · ' + ch.name));
        var art = card.querySelector('.sc-art');
        card.insertBefore(k, art ? art.nextSibling : card.firstChild);
      }
    });
  })();

  var F = null, geo = null;
  var svg = d3.select(stage).select('svg');
  var gLine = svg.append('g').attr('class', 's-line').attr('opacity', 0);
  var gBars = svg.append('g').attr('class', 's-bars').attr('opacity', 0);
  var gTfr  = svg.append('g').attr('class', 's-tfr').attr('opacity', 0);
  var gMap  = svg.append('g').attr('class', 's-map').attr('opacity', 0);
  var gDots = svg.append('g').attr('class', 's-dots');
  var gAnn  = svg.append('g').attr('class', 's-ann');
  var W = 0, H = 0, B = null, wide = true;
  var X = {};          /* scales and geometry of the current size */
  var current = null, pending = null, mapKey = null;

  function measure() {
    var r = stage.getBoundingClientRect();
    W = r.width; H = r.height;
    wide = W >= 900;
    svg.attr('viewBox', '0 0 ' + W + ' ' + H);
    if (wide) {
      /* right of the cards, left of the chapter rail */
      var card = root.querySelector('.story-card');
      var left = card ? card.getBoundingClientRect().right - r.left + 56 : W * 0.42;
      var right = W - 40;
      var rail = document.querySelector('.chapter-index');
      /* the rail sits on the right only on wide screens; below that it is a
         pill in the bottom-left corner and needs no room here */
      var rr = rail && rail.getBoundingClientRect();
      if (rr && rr.width && rr.left > W * 0.6) right = Math.min(right, W - 230);
      B = { x: left, y: H * 0.13, w: Math.max(260, right - left), h: H * 0.74 };
    } else {
      B = { x: 16, y: H * 0.07, w: W - 32, h: H * 0.48 };
    }
  }

  function fade(g, on, dur) {
    g.style('pointer-events', on ? null : 'none')
     .transition().duration(dur).attr('opacity', on ? 1 : 0);
  }

  function text(g, x, y, str, cls, anchor) {
    return g.append('text').attr('x', x).attr('y', y)
      .attr('class', cls || 's-lab').attr('text-anchor', anchor || 'start').text(str);
  }

  /* a bar with only its data end rounded */
  function bar(x, y0, y1, w, r) {
    var up = y1 < y0, h = Math.abs(y1 - y0);
    r = Math.min(r, h, w / 2);
    if (h < 0.5) return 'M' + x + ',' + y0 + 'h' + w + 'v0h' + (-w) + 'Z';
    if (up) {
      return 'M' + x + ',' + y0 + 'V' + (y1 + r) + 'Q' + x + ',' + y1 + ' ' + (x + r) + ',' + y1 +
             'H' + (x + w - r) + 'Q' + (x + w) + ',' + y1 + ' ' + (x + w) + ',' + (y1 + r) + 'V' + y0 + 'Z';
    }
    return 'M' + x + ',' + y0 + 'V' + (y1 - r) + 'Q' + x + ',' + y1 + ' ' + (x + r) + ',' + y1 +
           'H' + (x + w - r) + 'Q' + (x + w) + ',' + y1 + ' ' + (x + w) + ',' + (y1 - r) + 'V' + y0 + 'Z';
  }

  /* ── the population line ── */
  function buildLine() {
    gLine.selectAll('*').remove();
    var m = { l: wide ? 58 : 46, r: 18, t: 18, b: 30 };
    var x = d3.scaleLinear().domain([F.first.year, F.last.year]).range([B.x + m.l, B.x + B.w - m.r]);
    var y = d3.scaleLinear().domain([0, F.last.total * 1.08]).range([B.y + B.h - m.b, B.y + m.t]);
    X.lx = x; X.ly = y;
    var axis = gLine.append('g').attr('class', 's-axis');
    y.ticks(5).filter(function (v) { return v > 0; }).forEach(function (v) {
      axis.append('line').attr('x1', x.range()[0]).attr('x2', x.range()[1]).attr('y1', y(v)).attr('y2', y(v)).attr('class', 's-grid');
      text(axis, x.range()[0] - 10, y(v) + 4, (v / 1e7) + ' cr', 's-tick', 'end');
    });
    axis.append('line').attr('x1', x.range()[0]).attr('x2', x.range()[1]).attr('y1', y(0)).attr('y2', y(0)).attr('class', 's-base');
    [F.first.year, 1951, 2011, F.last.year].forEach(function (v) {
      text(axis, x(v), y(0) + 20, String(v), 's-tick', 'middle');
    });
    var clipId = 'storyClip';
    gLine.append('clipPath').attr('id', clipId).append('rect')
      .attr('x', x.range()[0] - 8).attr('y', B.y - 20).attr('height', B.h + 40).attr('width', 0);
    var obs = F.series.filter(function (d) { return !d.proj; });
    var proj = F.series.filter(function (d) { return d.year >= 2011; });
    var ln = d3.line().x(function (d) { return x(d.year); }).y(function (d) { return y(d.total); }).curve(d3.curveMonotoneX);
    var ar = d3.area().x(function (d) { return x(d.year); }).y0(y(0)).y1(function (d) { return y(d.total); }).curve(d3.curveMonotoneX);
    var body = gLine.append('g').attr('clip-path', 'url(#' + clipId + ')');
    body.append('path').attr('class', 's-area').attr('d', ar(F.series));
    body.append('path').attr('class', 's-path').attr('d', ln(obs));
    body.append('path').attr('class', 's-path is-proj').attr('d', ln(proj));
  }
  function setCut(year, dur) {
    var x = X.lx;
    gLine.select('clipPath rect').interrupt().transition().duration(dur).ease(d3.easeCubicInOut)
      .attr('width', year ? x(year) - x.range()[0] + 16 : 0);
  }

  /* ── growth-rate bars ── */
  function buildBars() {
    gBars.selectAll('*').remove();
    var m = { l: wide ? 58 : 46, r: 18, t: 30, b: 30 };
    var P = F.periods.filter(function (p) { return p.rate != null; });
    var x = d3.scaleBand().domain(P.map(function (p) { return p.to; })).range([B.x + m.l, B.x + B.w - m.r]).padding(0.28);
    var lo = Math.min(0, d3.min(P, function (p) { return p.rate; }));
    var y = d3.scaleLinear().domain([lo - 0.15, d3.max(P, function (p) { return p.rate; }) + 0.35]).range([B.y + B.h - m.b, B.y + m.t]);
    X.bx = x; X.by = y; X.bars = P;
    var axis = gBars.append('g').attr('class', 's-axis');
    [1, 2].forEach(function (v) {
      axis.append('line').attr('x1', x.range()[0]).attr('x2', x.range()[1]).attr('y1', y(v)).attr('y2', y(v)).attr('class', 's-grid');
      text(axis, x.range()[0] - 10, y(v) + 4, v + '%', 's-tick', 'end');
    });
    axis.append('line').attr('x1', x.range()[0]).attr('x2', x.range()[1]).attr('y1', y(0)).attr('y2', y(0)).attr('class', 's-base');
    text(axis, x.range()[0] - 10, y(0) + 4, '0%', 's-tick', 'end');
    gBars.append('g').attr('class', 's-barset').selectAll('path').data(P).join('path')
      .attr('class', 's-bar')
      .attr('fill', function (p) { return p === F.peak ? C.elder : C.work; })
      .attr('d', function (p) { return bar(x(p.to), y(0), y(0), x.bandwidth(), 4); });
  }
  function setBars(on, dur) {
    var x = X.bx, y = X.by;
    gBars.selectAll('.s-bar').interrupt().transition().duration(dur).delay(function (p, i) { return on && dur ? i * 40 : 0; })
      .ease(d3.easeCubicOut)
      .attr('d', function (p) { return bar(x(p.to), y(0), on ? y(p.rate) : y(0), x.bandwidth(), 4); });
  }

  /* ── fertility strip ── */
  function buildTfr() {
    gTfr.selectAll('*').remove();
    var m = { l: 18, r: 18 };
    var all = [];
    [F.tfrA, F.tfrB].forEach(function (y) { F.tfrStats[y].list.forEach(function (d) { all.push(d.v); }); });
    var x = d3.scaleLinear().domain([Math.floor(d3.min(all) * 10) / 10 - 0.05, Math.ceil(d3.max(all) * 10) / 10 + 0.05])
      .range([B.x + m.l, B.x + B.w - m.r]);
    var cy = B.y + B.h * 0.56;
    X.tx = x; X.tcy = cy;
    X.tr = Math.max(5, Math.min(9, B.w / 64));
    var axis = gTfr.append('g').attr('class', 's-axis');
    var base = B.y + B.h * 0.9;
    axis.append('line').attr('x1', x.range()[0]).attr('x2', x.range()[1]).attr('y1', base).attr('y2', base).attr('class', 's-base');
    x.ticks(wide ? 6 : 4).forEach(function (v) {
      axis.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', base).attr('y2', base + 5).attr('class', 's-base');
      text(axis, x(v), base + 20, fix(v, 1), 's-tick', 'middle');
    });
    text(axis, x.range()[1], base + 40, 'children per woman →', 's-tick', 'end');
    axis.append('line').attr('class', 's-rep').attr('x1', x(REPLACEMENT)).attr('x2', x(REPLACEMENT))
      .attr('y1', B.y + B.h * 0.16).attr('y2', base);
    /* left of the line; the count of districts above it goes on the right */
    text(axis, x(REPLACEMENT) - 8, B.y + B.h * 0.16 + 12, 'Replacement level ' + REPLACEMENT, 's-lab', 'end');
    text(axis, x(REPLACEMENT) - 8, B.y + B.h * 0.16 + 30, 'each generation replaces itself', 's-tick', 'end');
  }
  /* dodge: place each district dot on its x, nudged up or down until it
     touches no other */
  function swarm(year) {
    var x = X.tx, r = X.tr, gap = 2 * r + 2;
    var placed = [], out = {};
    F.tfrStats[year].list.slice().sort(function (a, b) { return a.v - b.v; }).forEach(function (d) {
      var px = x(d.v), k = 0, py;
      for (;;) {
        var off = k === 0 ? 0 : Math.ceil(k / 2) * gap * 0.9 * (k % 2 ? -1 : 1);
        py = X.tcy + off;
        var hit = placed.some(function (p) { return Math.hypot(p[0] - px, p[1] - py) < gap; });
        if (!hit) break;
        k++;
      }
      placed.push([px, py]);
      out[d.name] = [px, py, d.v];
    });
    return out;
  }

  /* ── district map ── */
  function buildMap() {
    gMap.selectAll('*').remove();
    var proj = d3.geoMercator().fitExtent([[B.x, B.y], [B.x + B.w, B.y + B.h * (wide ? 0.88 : 0.86)]], geo);
    var path = d3.geoPath(proj);
    X.cent = {};
    gMap.selectAll('path').data(geo.features).join('path')
      .attr('class', 's-dist')
      .attr('d', path)
      .attr('fill', RAMP[1])
      .each(function (f) { X.cent[canon(f.properties.Dist_Name)] = path.centroid(f); })
      .on('mousemove', function (ev, f) {
        if (!mapKey) return;
        var d = F.byName[canon(f.properties.Dist_Name)];
        if (d) showTip(ev, d.name, MAPS[mapKey].label + ': ' + pct(d.f[mapKey], 1), 'Click to open the district');
      })
      .on('mouseleave', hideTip)
      .on('click', function (ev, f) {
        window.location.href = 'district.html?id=' + encodeURIComponent(f.properties.Dist_Name);
      });
  }
  var MAPS = {
    tribal_pct:       { label: 'Scheduled Tribes', unit: '% of population, Census 2011' },
    literacy:         { label: 'Literacy', unit: '% literate, Census 2011' },
    elderly_pct_2036: { label: 'Aged 60+', unit: '% of population, projected 2036' }
  };
  function mapScale(key) {
    var ext = d3.extent(F.districts, function (d) { return d.f[key]; });
    return d3.scaleSequential(d3.interpolateRgbBasis(RAMP)).domain(ext);
  }
  function setMap(key, dur) {
    mapKey = key;
    if (!key) return;
    var s = mapScale(key);
    gMap.selectAll('.s-dist').interrupt().transition().duration(dur)
      .attr('fill', function (f) {
        var d = F.byName[canon(f.properties.Dist_Name)];
        return d ? s(d.f[key]) : RAMP[0];
      });
  }

  /* ── the dots ── */
  var dots = gDots.selectAll('circle').data(d3.range(N)).join('circle')
    .attr('r', 0).attr('opacity', 0)
    .on('mousemove', function (ev) {
      var t = d3.select(this).datum();
      if (t && t.tip) showTip(ev, t.tip[0], t.tip[1], t.tip[2]);
    })
    .on('mouseleave', hideTip);

  function D(x, y, r, c, o, tip) { return { x: x, y: y, r: r, c: c, o: o == null ? 1 : o, tip: tip || null }; }
  function gone(x, y) { return D(x, y, 0, C.dim, 0); }

  function moveDots(arr, dur) {
    /* the index, not the datum: the datum becomes the dot's current target */
    dots.each(function (_, i) {
      var t = arr[i] || gone(null, null);
      var s = d3.select(this);
      s.datum(t).attr('pointer-events', t.o > 0 && t.tip ? 'all' : 'none');
      var tr = s.interrupt().transition()
        .delay(dur ? ((i * 37) % N) * 4 : 0)
        .duration(dur).ease(d3.easeCubicInOut);
      if (t.x != null) tr.attr('cx', t.x).attr('cy', t.y);
      tr.attr('r', t.r).attr('fill', t.c).attr('opacity', t.o);
    });
  }

  /* ── tooltip ── */
  function showTip(ev, title, line, hint) {
    var r = stage.getBoundingClientRect();
    tipEl.textContent = '';
    var b = document.createElement('b'); b.textContent = title; tipEl.appendChild(b);
    if (line) { tipEl.appendChild(document.createElement('br')); tipEl.appendChild(document.createTextNode(line)); }
    if (hint) { var s = document.createElement('span'); s.textContent = hint; tipEl.appendChild(document.createElement('br')); tipEl.appendChild(s); }
    var x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14;
    var w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    if (x + w > W - 8) x = ev.clientX - r.left - w - 14;
    if (y + h > H - 8) y = ev.clientY - r.top - h - 14;
    tipEl.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    tipEl.classList.add('on');
  }
  function hideTip() { tipEl.classList.remove('on'); }

  /* ═════════════════════════════════════════════════════════════════
     3. SCENES — where the 100 dots go, and what is written around them
     ═════════════════════════════════════════════════════════════════ */

  /* a 10 × 10 grid; `share` of the box width */
  function grid100(share, cx) {
    var cell = Math.min(B.w * (share || 1), B.h * 0.8) / 10;
    var x0 = (cx != null ? cx : B.x + B.w / 2) - cell * 5, y0 = B.y + B.h / 2 - cell * 5 + (wide ? 0 : cell * 0.4);
    var pts = d3.range(N).map(function (i) { return [x0 + (i % 10 + 0.5) * cell, y0 + (Math.floor(i / 10) + 0.5) * cell]; });
    return { pts: pts, r: cell * 0.36, cell: cell, x0: x0, y0: y0 };
  }

  /* groups of dots in columns ten tall, side by side, a gap between groups */
  function blocks(groups) {
    var rows = 10, gapCols = 1.4;
    var cols = groups.map(function (g) { return Math.ceil(g.n / rows); });
    var total = cols.reduce(function (a, b) { return a + b; }, 0) + gapCols * (groups.length - 1);
    var cell = Math.min(B.w / total, (B.h * 0.66) / rows);
    var x = B.x + (B.w - total * cell) / 2, y0 = B.y + B.h / 2 - rows * cell / 2 + cell * 1.2;
    var pts = [], heads = [];
    groups.forEach(function (g, gi) {
      heads.push({ x: x, y: y0 - cell * 0.9, w: cols[gi] * cell, g: g });
      for (var i = 0; i < g.n; i++) {
        pts.push(D(x + (Math.floor(i / rows) + 0.5) * cell, y0 + (i % rows + 0.5) * cell, cell * 0.36, g.c, 1,
                   [g.label, g.n + ' in every 100', g.hint]));
      }
      x += (cols[gi] + gapCols) * cell;
    });
    return { pts: pts, heads: heads, cell: cell };
  }
  function blockHeads(a, heads, deltas) {
    heads.forEach(function (h, i) {
      var big = Math.max(26, Math.min(54, h.w * 0.9));
      if (h.w < 46) big = Math.min(big, 34);
      /* Anton's figures stand about 0.8 of the font size tall */
      /* a label wider than the space left of the edge right-aligns to it */
      var room = B.x + B.w - h.x, long = h.g.label.length * 7 > room;
      var d = deltas && deltas[i], dStr = d ? (d > 0 ? '+' : '−') + Math.abs(d) : '';
      /* the change sits beside the number; where the edge leaves no room
         for it, it joins the label line instead */
      var dx = h.x + String(h.g.n).length * big * 0.45 + 8, fits = dx + 26 <= B.x + B.w;
      var label = h.g.label + (d && !fits ? '  ' + dStr : '');
      text(a, long ? B.x + B.w : h.x, h.y - big * 0.8 - 10, label, 's-lab', long ? 'end' : 'start');
      text(a, h.x, h.y, String(h.g.n), 's-big').style('font-size', big + 'px');
      if (d && fits) text(a, dx, h.y, dStr, 's-delta');
    });
  }

  function ageGroups(A, hints) {
    return [
      { n: A.n[0], c: C.child, label: 'Children (0–14)', hint: hints && hints[0] },
      { n: A.n[1], c: C.work,  label: 'Working age (15–59)', hint: hints && hints[1] },
      { n: A.n[2], c: C.elder, label: 'Elders (60+)', hint: hints && hints[2] }
    ];
  }

  function lineDots(cut) {
    var x = X.lx, y = X.ly, n = F.series.length;
    return d3.range(N).map(function (i) {
      var s = F.series[i % n], px = x(s.year), py = y(s.total);
      if (i >= n || s.year > cut) return gone(px, py);
      return D(px, py, 4.5, s.proj ? C.work : C.dot, 1,
               [String(s.year), crore(s.total), s.proj ? 'Projected' : 'Census']);
    });
  }

  function callout(a, year, value, str, side) {
    var x = X.lx(year), y = X.ly(value), up = side !== 'below';
    a.append('line').attr('class', 's-lead').attr('x1', x).attr('x2', x).attr('y1', y + (up ? -8 : 8)).attr('y2', y + (up ? -30 : 30));
    var anchor = x > B.x + B.w - 90 ? 'end' : (x < B.x + 120 ? 'start' : 'middle');
    var ty = y + (up ? -38 : 46);
    str.split('\n').forEach(function (s, k) {
      text(a, x, ty + (up ? -(str.split('\n').length - 1 - k) * 17 : k * 17), s, k ? 's-tick' : 's-lab', anchor);
    });
  }

  function tfrDots(year) {
    var pos = swarm(year);
    return d3.range(N).map(function (i) {
      var d = F.districts[i];
      if (!d || !pos[d.name]) return gone(null, null);
      var p = pos[d.name], hi = p[2] > REPLACEMENT;
      return D(p[0], p[1], X.tr, hi ? C.elder : C.work, 1,
               [d.name, 'Fertility ' + fix(p[2], 2) + ' children per woman', year === F.tfrB ? 'Projected ' + year : year]);
    });
  }
  function tfrAnn(a, year) {
    var st = F.tfrStats[year], pos = swarm(year);
    text(a, B.x + 18, B.y + B.h * 0.16 + 4, String(year), 's-year');
    /* name the two ends, above the top of their column of dots */
    [st.hi, st.lo].forEach(function (d) {
      var p = pos[d.name], top = p[1];
      Object.keys(pos).forEach(function (k) {
        if (Math.abs(pos[k][0] - p[0]) < X.tr * 2.2) top = Math.min(top, pos[k][1]);
      });
      a.append('line').attr('class', 's-lead').attr('x1', p[0]).attr('x2', p[0])
        .attr('y1', top - X.tr - 3).attr('y2', top - X.tr - 14);
      text(a, p[0], top - X.tr - 20, d.name, 's-lab s-halo', 'middle');
    });
    var right = X.tx.range()[1];
    text(a, right, B.y + B.h * 0.16 + 12, st.above.length + ' of ' + st.list.length, 's-lab', 'end');
    text(a, right, B.y + B.h * 0.16 + 30, 'above replacement', 's-tick', 'end');
  }

  function mapDots() {
    return d3.range(N).map(function (i) {
      var d = F.districts[i], c = d && X.cent[d.name];
      return c ? D(c[0], c[1], 2, C.dot, 0) : gone(null, null);
    });
  }
  function mapAnn(a, key, picks) {
    var s = mapScale(key), dom = s.domain(), info = MAPS[key];
    var lw = Math.min(220, B.w * 0.5), lx = B.x + (wide ? 0 : (B.w - lw) / 2), ly = B.y + B.h * 0.94;
    var gid = 'storyRamp';
    var grad = a.append('defs').append('linearGradient').attr('id', gid);
    RAMP.forEach(function (c, i) { grad.append('stop').attr('offset', (i / (RAMP.length - 1) * 100) + '%').attr('stop-color', c); });
    text(a, lx, ly - 10, info.label + ' · ' + info.unit, 's-tick');
    a.append('rect').attr('x', lx).attr('y', ly).attr('width', lw).attr('height', 8).attr('rx', 2).attr('fill', 'url(#' + gid + ')');
    text(a, lx, ly + 24, pct(dom[0], key === 'tribal_pct' ? 1 : 1), 's-tick');
    text(a, lx + lw, ly + 24, pct(dom[1], 1), 's-tick', 'end');
    picks.forEach(function (d) {
      var c = X.cent[d.name];
      if (!c) return;
      a.append('circle').attr('cx', c[0]).attr('cy', c[1]).attr('r', 3.5).attr('class', 's-pin');
      text(a, c[0] + 7, c[1] - 6, d.name, 's-lab s-halo');
      text(a, c[0] + 7, c[1] + 10, pct(d.f[key], 1), 's-tick s-halo');
    });
  }
  function extremes(key, top, bottom) {
    var s = F.districts.slice().sort(function (a, b) { return b.f[key] - a.f[key]; });
    return s.slice(0, top).concat(s.slice(s.length - bottom));
  }

  var SCENES = {
    people: function () {
      var g = grid100(wide ? 0.62 : 0.9);
      return {
        dots: g.pts.map(function (p) { return D(p[0], p[1], g.r, C.dot, 1, ['One dot', 'about ' + F.T.dotLakh + ' people']); }),
        ann: function (a) {
          text(a, g.x0, g.y0 - 16, '1 dot ≈ ' + F.T.dotLakh + ' people', 's-lab');
        }
      };
    },
    rural: function () {
      var b = blocks([
        { n: F.rural[0], c: C.child, label: 'In villages', hint: 'Census 2011' },
        { n: F.rural[1], c: C.work,  label: 'In towns and cities', hint: 'Census 2011' }
      ]);
      return { dots: b.pts, ann: function (a) { blockHeads(a, b.heads); } };
    },
    tribal: function () {
      var g = grid100(wide ? 0.56 : 0.66, B.x + B.w * (wide ? 0.36 : 0.38));
      var mini = g.cell * 0.42, mx = g.x0 + g.cell * 10 + Math.max(24, g.cell * 1.2), my = g.y0 + g.cell * 10 - mini * 10;
      return {
        dots: g.pts.map(function (p, i) {
          var st = i < F.st;
          return D(p[0], p[1], g.r, st ? C.elder : C.dim, 1,
                   st ? ['Scheduled Tribes', F.st + ' in every 100 people in Odisha'] : ['Everyone else', (N - F.st) + ' in every 100']);
        }),
        ann: function (a) {
          text(a, g.x0, g.y0 - 16, 'Odisha · ' + F.st + ' in 100', 's-lab');
          text(a, mx, my - 12, 'India · ' + F.stIndia + ' in 100', 's-lab');
          d3.range(N).forEach(function (i) {
            a.append('circle').attr('cx', mx + (i % 10 + 0.5) * mini).attr('cy', my + (Math.floor(i / 10) + 0.5) * mini)
              .attr('r', mini * 0.34).attr('fill', i < F.stIndia ? C.elder : C.dim);
          });
        }
      };
    },
    line1: lineScene(1951),
    line2: lineScene(2011),
    line3: lineScene(null),
    growth: function () {
      var x = X.bx, y = X.by;
      var at = {};
      X.bars.forEach(function (p) { at[p.to] = p; });
      return {
        bars: true,
        dots: d3.range(N).map(function (i) {
          var s = F.series[i], p = s && at[s.year];
          if (!p) return gone(s ? x(X.bars[0].to) : null, s ? y(0) : null);
          return D(x(p.to) + x.bandwidth() / 2, y(p.rate), 3.5, C.dot, 1,
                   [period(p.from, p.to), fix(p.rate, 2) + '% a year', p.to > 2011 ? 'Projected' : 'Census']);
        }),
        ann: function (a) {
          text(a, x.range()[0], B.y + 6, 'Average growth per year, by period', 's-lab');
          [F.peak, F.tail].forEach(function (p) {
            var cx = x(p.to) + x.bandwidth() / 2;
            text(a, cx, y(p.rate) - 14, fix(p.rate, 2) + '%', 's-lab', 'middle');
            text(a, cx, y(0) + 20, period(p.from, p.to), 's-tick', 'middle');
          });
          var neg = X.bars.filter(function (p) { return p.rate < 0; })[0];
          if (neg) {
            var nx = x(neg.to) + x.bandwidth() / 2;
            text(a, nx, y(neg.rate) + 20, period(neg.from, neg.to), 's-tick', 'middle');
          }
        }
      };
    },
    tfrA: function () { return { tfr: true, dots: tfrDots(F.tfrA), ann: function (a) { tfrAnn(a, F.tfrA); } }; },
    tfrB: function () { return { tfr: true, dots: tfrDots(F.tfrB), ann: function (a) { tfrAnn(a, F.tfrB); } }; },
    ageA: function () {
      var b = blocks(ageGroups(F.ageA));
      return { dots: b.pts, ann: function (a) { text(a, B.x + B.w / 2, B.y + 4, '2021', 's-year', 'middle'); blockHeads(a, b.heads); } };
    },
    ageB: function () {
      var b = blocks(ageGroups(F.ageB));
      var delta = [0, 1, 2].map(function (k) { return F.ageB.n[k] - F.ageA.n[k]; });
      return { dots: b.pts, ann: function (a) { text(a, B.x + B.w / 2, B.y + 4, String(F.ageB.year), 's-year', 'middle'); blockHeads(a, b.heads, delta); } };
    },
    mapST:  mapScene('tribal_pct', 3, 1),
    mapLit: mapScene('literacy', 1, 2),
    mapOld: mapScene('elderly_pct_2036', 1, 1),
    close: function () {
      var b = blocks(ageGroups(F.ageB, ['They need schools that teach well', 'They need work and skills', 'They need care, health and pensions']));
      return {
        dots: b.pts,
        ann: function (a) {
          blockHeads(a, b.heads);
          var asks = ['→ better schools', '→ jobs', '→ care'];
          b.heads.forEach(function (h, i) {
            text(a, h.x, h.y + b.cell * 10 + b.cell * 0.6 + 18, asks[i], 's-lab');
          });
        }
      };
    }
  };
  function lineScene(cut) {
    return function () {
      var c = cut || F.last.year;
      return {
        line: c,
        dots: lineDots(c),
        ann: function (a) {
          var s = {};
          F.series.forEach(function (d) { s[d.year] = d.total; });
          if (c === 1951) {
            callout(a, F.first.year, s[F.first.year], crore(F.first.total) + '\n' + F.first.year);
            if (s[1921]) callout(a, 1921, s[1921], 'Shrank\n1911–21', 'below');
            callout(a, 1951, s[1951], crore(s[1951]) + '\n1951');
          } else if (c === 2011) {
            callout(a, 1951, s[1951], crore(s[1951]) + '\n1951', 'below');
            callout(a, 2011, s[2011], crore(s[2011]) + '\nCensus 2011');
          } else {
            callout(a, 1951, s[1951], crore(s[1951]) + '\n1951', 'below');
            callout(a, F.last.year, F.last.total, crore(F.last.total) + '\nprojected ' + F.last.year);
            text(a, X.lx(2011) + 10, X.ly(s[2011]) + 24, 'projected from here', 's-tick', 'start');
          }
        }
      };
    };
  }
  function mapScene(key, top, bottom) {
    return function () {
      return { map: key, dots: mapDots(), ann: function (a) { mapAnn(a, key, extremes(key, top, bottom)); } };
    };
  }

  /* ═════════════════════════════════════════════════════════════════
     4. RUNNING IT
     ═════════════════════════════════════════════════════════════════ */
  function apply(id, animate) {
    var make = SCENES[id];
    if (!make || !F) return;
    var dur = animate && !reduced ? 1000 : 0;
    var sc = make();
    hideTip();

    fade(gLine, sc.line != null, dur);
    if (sc.line != null) setCut(sc.line, animate && !reduced ? 1600 : 0);
    else setCut(null, dur);
    fade(gBars, !!sc.bars, dur);
    setBars(!!sc.bars, dur);
    fade(gTfr, !!sc.tfr, dur);
    fade(gMap, !!sc.map, dur);
    setMap(sc.map || null, dur);

    moveDots(sc.dots, dur);

    gAnn.selectAll('g.s-layer').interrupt().transition().duration(dur / 3).attr('opacity', 0).remove();
    var layer = gAnn.append('g').attr('class', 's-layer').attr('opacity', 0);
    if (sc.ann) sc.ann(layer);
    layer.transition().delay(dur * 0.6).duration(dur * 0.6).attr('opacity', 1);
  }

  function activate(id) {
    steps.forEach(function (s) { s.classList.toggle('is-active', s.getAttribute('data-step') === id); });
    if (id === current) return;
    current = id;
    if (!F) { pending = id; return; }
    apply(id, true);
  }

  function layout() {
    measure();
    buildLine(); buildBars(); buildTfr(); buildMap();
    if (current) apply(current, false);
  }

  /* a card is current while it crosses the middle of the screen */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) activate(e.target.getAttribute('data-step')); });
  }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
  steps.forEach(function (s) { io.observe(s); });

  function fillText() {
    root.querySelectorAll('[data-f]').forEach(function (el) {
      var v = F.T[el.getAttribute('data-f')];
      if (v != null) el.textContent = v;
    });
    var body = root.querySelector('#storyFigures tbody');
    if (body) {
      body.textContent = '';
      F.rows.forEach(function (r) {
        var tr = document.createElement('tr');
        r.forEach(function (c) { var td = document.createElement('td'); td.textContent = c || ''; tr.appendChild(td); });
        body.appendChild(tr);
      });
    }
  }

  Promise.all([
    DataLoader.getStateDemographics(),
    DataLoader.loadJSON('learn/data/districts.json'),
    DataLoader.getDistrictPopulationTrends(),
    DataLoader.getDistrictFertilityTrends(),
    DataLoader.getNationalComparisons(),
    DataLoader.loadJSON('./Orissa.geojson'),
    DataLoader.getStateDetails().catch(function () { return null; })
  ]).then(function (r) {
    F = compute({ state: r[0], learn: r[1], pop: r[2], fert: r[3], nat: r[4], details: r[6],
                 keyStats: window.SOOCHANA_KEY_STATS });
    geo = r[5];
    fillText();
    measure();
    /* dots start gathered in the middle, then form the first scene */
    dots.attr('cx', B.x + B.w / 2).attr('cy', B.y + B.h / 2);
    buildLine(); buildBars(); buildTfr(); buildMap();
    root.classList.add('is-ready');
    var first = pending || current;
    current = null;
    activate(first || 'people');
  }).catch(function (err) {
    /* the cards still read on their own, with the figures typed in the page */
    root.classList.add('is-static');
    if (window.console) console.warn('Story: data did not load', err);
  });

  var lastW = 0, lastH = 0, timer = null;
  window.addEventListener('resize', function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (!F) return;
      var r = stage.getBoundingClientRect();
      /* a phone's address bar showing and hiding changes only the height a
         little; redrawing for that would make the picture jump */
      if (Math.abs(r.width - lastW) < 1 && Math.abs(r.height - lastH) < 120) return;
      lastW = r.width; lastH = r.height;
      layout();
    }, 160);
  });
  window.addEventListener('load', function () {
    var r = stage.getBoundingClientRect(); lastW = r.width; lastH = r.height;
  });
})();
