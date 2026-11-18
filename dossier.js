/* ─────────────────────────────────────────────────────────────────────
   dossier.js — the state dashboard as a scroll story (index.html, #dashboard)

   The twenty modules of datasets/state_details.json, read in seven
   chapters. The cards scroll on the left; a sticky panel on the right
   shows each module's picture as its card reaches the middle of the
   screen: the module's Flourish chart where it has one, otherwise a
   picture drawn here from the module's own figures (the map, a land-use
   waffle, the 147-seat assembly, the 62 tribal communities, a pyramid
   of care…). The index bar above names the chapter and module being
   read, shows how far through you are, and jumps to any module.

   Every number in a card or a picture is read from state_details.json,
   state_demographics.json (the ORGI projection) for the population
   modules, orgi_state_projection.json for the fertility path and
   nfhs6_state_factsheet.json for NFHS-6 beside NFHS-5. Change the
   data, not this file. Styles: dossier.css.
   ───────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* the order modules are read in; a module the file adds later and that
     is not listed here joins a last chapter of its own */
  /* `key` picks the chapter's ground and accent colours in dossier.css */
  var CHAPTERS = [
    { key: 'land',   icon: 'mountain', name: 'Land',            mods: [1, 2] },
    { key: 'gov',    icon: 'landmark', name: 'Governance',      mods: [3, 4] },
    { key: 'people', icon: 'users',    name: 'People',          mods: [5, 6, 7, 8, 9, 10] },
    { key: 'tribal', icon: 'drum',     name: 'Tribal heritage', mods: [11] },
    { key: 'health', icon: 'heart',    name: 'Health',          mods: [12, 13, 14, 15] },
    { key: 'edu',    icon: 'cap',      name: 'Education',       mods: [16, 17, 18] },
    { key: 'infra',  icon: 'road',     name: 'Infrastructure',  mods: [19, 20] }
  ];
  /* one icon per module; a module not listed takes its chapter's */
  var MODULE_ICONS = {
    1: 'map', 2: 'sprout', 3: 'home', 4: 'landmark', 5: 'users', 6: 'trend', 7: 'family',
    8: 'bars', 9: 'gender', 10: 'pyramid', 11: 'drum', 12: 'heart', 13: 'hospital',
    14: 'pulse', 15: 'apple', 16: 'book', 17: 'cap', 18: 'monitor', 19: 'drop', 20: 'zap'
  };

  /* Colours, validated on the white panel. Blue is the default mark,
     orange the one to look at. Status colours always come with an arrow
     and a word. */
  var C = { blue: '#2a78d6', orange: '#eb6834', grey: '#d6d3cc', good: '#0ca30c', bad: '#d03b3b' };
  /* land use, in an order whose neighbours stay apart for colour-blind
     readers; every cell is labelled in the legend beside it */
  var LAND = [
    ['net_sown_area_000ha_2024',         'Sown with crops',              '#eda100'],
    ['forest_area_000ha_2024',           'Forest',                       '#008300'],
    ['barren_unculturable_000ha_2024',   'Barren and unculturable',      '#e87ba4'],
    ['non_agricultural_uses_000ha_2024', 'Towns, roads, other non-farm', '#2a78d6'],
    ['current_fallow_000ha_2024',        'Fallow this year',             '#eb6834']
  ];

  /* ── helpers ── */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svgEl(tag, attrs) {
    var n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  /* an icon from icons.js; decorative, so hidden from screen readers */
  function icon(name, cls) {
    var I = window.SoochanaIcons;
    return I ? I.svg(name, 'dz-ic' + (cls ? ' ' + cls : '')) : el('span');
  }
  function num(s) {
    var m = String(s == null ? '' : s).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  function indian(n, d) {
    return n.toLocaleString('en-IN', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  }
  function crore(n) { return (n / 1e7).toFixed(2) + ' crore'; }
  function lakhHa(thousandHa) { return (thousandHa / 100).toFixed(1) + ' lakh ha'; }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function shortTitle(t) { return t.split(':')[0].split('–')[0].trim(); }
  /* "a **b** c": plain text with bold runs, built without innerHTML */
  function rich(node, str) {
    String(str).split('**').forEach(function (part, i) {
      if (part) node.appendChild(i % 2 ? el('b', null, part) : document.createTextNode(part));
    });
    return node;
  }
  /* largest-remainder rounding to exactly `total` whole units */
  function shares(values, total) {
    var sum = values.reduce(function (a, b) { return a + b; }, 0);
    var raw = values.map(function (v) { return v / sum * total; });
    var out = raw.map(Math.floor);
    var left = total - out.reduce(function (a, b) { return a + b; }, 0);
    raw.map(function (r, i) { return [r - Math.floor(r), i]; })
       .sort(function (a, b) { return b[0] - a[0]; })
       .slice(0, left).forEach(function (p) { out[p[1]] += 1; });
    return out;
  }

  /* the state's area by land use, in whole squares of 100 (LAND order,
     then whatever the listed uses leave over) */
  function landCats(t, areaKha) {
    var vals = LAND.map(function (l) { return num(t[l[0]]) || 0; });
    var other = Math.max(0, areaKha - vals.reduce(function (a, b) { return a + b; }, 0));
    var cats = LAND.map(function (l, i) { return { label: l[1], color: l[2], v: vals[i] }; })
      .concat(other > 0 ? [{ label: 'Everything else', color: C.grey, v: other }] : []);
    return { cats: cats, n: shares(cats.map(function (c) { return c.v; }), 100) };
  }

  /* A module's text is narrative, a run of "Label: value | …" figures,
     a source and sometimes a note. Only the narrative is read out in the
     card; the figures are drawn, the source and note go underneath. */
  function splitText(slide) {
    var t = String(slide.text_content || '');
    var note = '', source = '';
    var n = t.search(/\bNote:/);
    if (n !== -1) { note = t.slice(n + 5).trim(); t = t.slice(0, n); }
    var s = t.search(/\bSources?:/);
    if (s !== -1) { source = t.slice(s).replace(/^Sources?:\s*/, '').trim(); t = t.slice(0, s); }
    var body = t.split(/\n\n+/).map(function (p) { return p.trim(); }).filter(function (p) {
      if (!p) return false;
      if (p.indexOf(' | ') !== -1 || /^[^.]{0,80}:\s*[\d.,]+$/.test(p)) return false;   /* figures */
      if (/^\s*1\.\s/.test(p) && (p.match(/,\s*\d+\.\s/g) || []).length >= 4) return false; /* the tribe list */
      return true;
    });
    return { body: body, source: source.replace(/\.$/, ''), note: note };
  }

  /* ═════════════════════════════════════════════════════════════════
     FIGURES the population modules quote, from state_demographics.json
     ═════════════════════════════════════════════════════════════════ */
  function popFacts(state) {
    var trends = [];
    /* the file carries a second table after the series; stop where the
       years start again */
    state.population_trends.some(function (r) {
      if (trends.length && r.year <= trends[trends.length - 1].year) return true;
      if (r.total) trends.push(r);
      return false;
    });
    function at(y) { return trends.filter(function (r) { return r.year === y; })[0]; }
    function ages(y) {
      var rows = (state.pyramids[y] || []).filter(function (r) { return /^\d+(-\d+|\+)$/.test(r.age); });
      var tot = 0, ch = 0, el60 = 0, u5 = 0;
      rows.forEach(function (r) {
        var lo = parseInt(r.age, 10);
        tot += r.total;
        if (lo < 15) ch += r.total;
        if (lo < 5) u5 += r.total;
        if (lo >= 60) el60 += r.total;
      });
      return { year: +y, child: ch / tot * 100, elder: el60 / tot * 100, work: (tot - ch - el60) / tot * 100, under5: u5, rows: rows, total: tot };
    }
    var years = Object.keys(state.pyramids).sort();
    var first = trends[0], last = trends[trends.length - 1];
    var low = trends.reduce(function (a, b) { return b.sex_ratio < a.sex_ratio ? b : a; });
    return {
      first: first, last: last, p2011: at(2011), p2021: at(2021), low: low, series: trends,
      a2011: ages('2011'), aLast: ages(years[years.length - 1]), lastAgeYear: years[years.length - 1],
      ageSeries: years.filter(function (y) { return +y >= 2011; }).map(ages)
    };
  }

  /* ═════════════════════════════════════════════════════════════════
     FERTILITY and the NFHS rounds. The projected path is ORGI's
     (orgi_state_projection.json); the surveyed rates are the state fact
     sheet's (nfhs6_state_factsheet.json), NFHS-6 beside NFHS-5.
     ═════════════════════════════════════════════════════════════════ */
  var SRC = {
    orgi: 'Population Projections for India and States 2011–2036, Report of the Technical Group on Population Projections, National Commission on Population, MoHFW (July 2020)',
    orgiShort: 'ORGI Technical Group projections (2020)',
    nfhs6: 'NFHS-6 (2023–24), IIPS and MoHFW, fact sheets published May 2026',
    nfhs5: 'NFHS-5 (2019–21), IIPS and MoHFW'
  };
  /* one row of the state fact sheet: Odisha and India, both rounds */
  function nfhsRow(nfhs, re) {
    var r = ((nfhs && nfhs.indicators) || []).filter(function (i) { return re.test(i.indicator); })[0];
    if (!r || !r.odisha || r.odisha.nfhs6 == null || r.odisha.nfhs5 == null) return null;
    return { o6: r.odisha.nfhs6, o5: r.odisha.nfhs5, urban: r.odisha.nfhs6_urban, rural: r.odisha.nfhs6_rural,
             i6: r.india && r.india.nfhs6, i5: r.india && r.india.nfhs5 };
  }
  function tfrFacts(orgi, nfhs) {
    var n = nfhsRow(nfhs, /^Total fertility rate/i);
    var o = orgi && orgi.odisha, s = orgi && orgi.tfr_states;
    if (!n || !o || !o.tfr || !s) return null;
    return {
      n: n, periods: o.periods.map(function (p) { return p.replace('-', '–'); }),
      odisha: o.tfr, india: s.india
    };
  }
  function one(v) { return (+v).toFixed(1); }

  /* ═════════════════════════════════════════════════════════════════
     LEADS — the card text for modules whose data carries no narrative.
     Each is written around the module's own figures (x.t: its table,
     x.p: the population figures above).
     ═════════════════════════════════════════════════════════════════ */
  var LEADS = {
    2: function (x) {
      var t = x.t, L = landCats(t, x.areaKha);
      return ['Picture the state as 100 squares. **' + L.n[1] + '** are forest and **' +
              L.n[0] + '** are sown with crops. Towns, roads, fallow and barren land share most of the rest.',
              '**' + indian(num(t.annual_rainfall_mm_2024)) + ' mm** of rain fell in 2024. Farming here is mostly rain-fed, so one weak or violent monsoon reaches every household that farms.'];
    },
    3: function (x) {
      var t = x.t;
      return ['Odisha’s **' + t.population_2011 + '** people (2011) live in **' + indian(num(t.villages)) + '** villages, grouped into **' +
              indian(num(t.gram_panchayats)) + '** gram panchayats and **' + num(t.blocks) + '** blocks.',
              'That is about **' + Math.round(num(t.density_2011)) + '** people per square kilometre, across **' + t.area_sq_km + ' sq km**. The circles are drawn to scale: each one is the count beside it.'];
    },
    4: function (x) {
      var t = x.t;
      return ['The state is administered through **' + num(t.sub_divisions) + '** sub-divisions and **' + num(t.tehsils) +
              '** tehsils, with **' + num(t.municipal_corporations) + '** municipal corporations in its towns.',
              'Its laws are made by a **' + num(t.assembly_constituencies) + '**-member assembly: one dot for each constituency.'];
    },
    5: function (x) {
      var t = x.t;
      return ['Almost one in four people belongs to a Scheduled Tribe (**' + t.tribal_share_pct + '**), and about one in six lives in a town (**' +
              t.urban_population_share + '**).',
              'There were **' + num(t.sex_ratio_2011) + '** women for every 1,000 men in 2011, and women outlive men: **' +
              t.life_expectancy_female_nfhs5 + '** years at birth against **' + t.life_expectancy_male_nfhs5 + '** (computed from NFHS-5, 2019–21).'];
    },
    6: function (x) {
      var p = x.p;
      return ['From **' + crore(p.first.total) + '** in ' + p.first.year + ' to **' + crore(p.p2011.total) + '** at the 2011 Census, and a projected **' +
              crore(p.last.total) + '** by ' + p.last.year + '.',
              'Hover the chart to read any year. The points after 2011 are the official projections, which see growth easing to **' +
              p.last.annual_growth_rate.toFixed(2) + '%** a year by ' + p.last.year + '.'];
    },
    7: function (x) {
      var f = tfrFacts(x.orgi, x.nfhs);
      if (!f) return ['Odisha’s fertility rate is **' + (x.tfrState || '1.7') + '** children per woman in NFHS-6 (2023–24, published May 2026), below the replacement level of 2.1.'];
      var k = f.periods.length - 1;
      return ['Odisha’s fertility rate is **' + one(f.n.o6) + '** children per woman in NFHS-6 (2023–24, published May 2026), from **' + one(f.n.o5) +
              '** in NFHS-5 (2019–21). Both are below the replacement level of 2.1; India is at ' + one(f.n.i6) + ' in NFHS-6.',
              'The official projection follows the same path: **' + f.odisha[0].toFixed(2) + '** in ' + f.periods[0] + ', easing to **' + f.odisha[k].toFixed(2) + '** by ' + f.periods[k] +
              '. Smaller families give each child a larger share of a household’s time and resources.',
              'Neither NFHS round publishes a district fertility rate, so this module stays with the state.'];
    },
    8: function (x) {
      var a = x.p.a2011, b = x.p.aLast;
      return ['Children under 15 were **' + a.child.toFixed(1) + '%** of the population in 2011; by ' + x.p.lastAgeYear + ' they are projected at **' + b.child.toFixed(1) + '%**.',
              'People aged 60 and over rise from **' + a.elder.toFixed(1) + '%** to **' + b.elder.toFixed(1) + '%** over the same years.'];
    },
    9: function (x) {
      var p = x.p;
      return ['In ' + p.first.year + ' there were **' + indian(Math.round(p.first.sex_ratio)) + '** women for every 1,000 men. The ratio fell to **' +
              Math.round(p.low.sex_ratio) + '** by ' + p.low.year + ' and is projected to recover to **' + indian(Math.round(p.last.sex_ratio)) + '** by ' + p.last.year + '.'];
    },
    10: function (x) {
      var a = x.p.a2011, b = x.p.aLast;
      return ['The base of the pyramid is narrowing. There were **' + Math.round(a.under5 / 1e5) + ' lakh** children under five in 2011; the projection for ' +
              x.p.lastAgeYear + ' is **' + Math.round(b.under5 / 1e5) + ' lakh**.',
              'Meanwhile the bars above 60 widen, as more people live into old age.'];
    },
    13: function (x) {
      var t = x.t;
      return ['**' + indian(num(t.sub_centres_2024)) + '** sub-centres, **' + indian(num(t.phcs_2024)) + '** primary health centres and **' +
              num(t.chcs_2024) + '** community health centres make a pyramid of care, widest closest to the village.',
              'There are **' + num(t.beds_per_100k_2024) + '** hospital beds for every 1,00,000 people.'];
    },
    14: function (x) {
      return ['The maternal mortality ratio was estimated at **' + num(x.t.mmr_2017_19) + '** per 1,00,000 live births in 2017–19.',
              'The chart follows child deaths up to NFHS-5 (2019–21), which fell on every measure: in the first month, the first year and the first five years.',
              'The NFHS-6 fact sheets (published May 2026) do not carry mortality rates, so NFHS-5 remains the latest survey figure here.'];
    },
    12: function (x) {
      var R = function (re) { return nfhsRow(x.nfhs, re); };
      var ib = R(/^Institutional births \(/i), hc = R(/health insurance/i), ifa = R(/iron folic acid for 100 days/i),
          st = R(/who are stunted/i), fv = R(/fully vaccinated based on information from either/i), anc = R(/at least 4 antenatal/i);
      if (!ib || !hc || !ifa || !st || !fv || !anc) return null;
      var pair = function (r) { return '**' + one(r.o6) + '%** in NFHS-6 (2023–24, published May 2026), from **' + one(r.o5) + '%** in NFHS-5 (2019–21)'; };
      var short = function (r) { return '**' + one(r.o6) + '%**, from ' + one(r.o5) + '%'; };
      return ['Care is reaching more households. Births in a health facility stand at ' + pair(ib) + '. Households with health cover rose to ' + short(hc) +
              ', and mothers taking iron and folic acid for 100 days or more to ' + short(ifa) + '.',
              'Children are growing better too: stunting under five is down to ' + short(st) + ', and full vaccination holds at ' + short(fv) + '.',
              'The next area of focus is care during pregnancy: four or more antenatal visits stand at ' + short(anc) +
              '. Anaemia and mortality are not in the NFHS-6 fact sheets; for those, NFHS-5 (2019–21) remains the latest survey.'];
    },
    15: function (x) {
      var R = function (re) { return nfhsRow(x.nfhs, re); };
      var st = R(/who are stunted/i), wa = R(/who are wasted/i), uw = R(/who are underweight/i), sw = R(/severely wasted/i);
      if (!st || !wa || !uw || !sw) return null;
      return ['Fewer children are stunted: **' + one(st.o6) + '%** of children under five in NFHS-6 (2023–24, published May 2026), from **' + one(st.o5) +
              '%** in NFHS-5 (2019–21). Severe wasting also eased, to **' + one(sw.o6) + '%** from ' + one(sw.o5) + '%.',
              'Wasting (**' + one(wa.o6) + '%**, from ' + one(wa.o5) + '%) and underweight (**' + one(uw.o6) + '%**, from ' + one(uw.o5) +
              '%) moved the other way, and are the next area of focus for nutrition programmes.',
              'The NFHS-6 fact sheets do not report anaemia; for that, NFHS-5 (2019–21) remains the latest survey.'];
    },
    17: function (x) {
      var t = x.t;
      return ['Almost every child moves up a stage: **' + t.transition_preparatory_to_middle_2025_26 + '** go on from preparatory to middle school, and **' +
              t.transition_middle_to_secondary_2025_26 + '** from middle to secondary.',
              'The leak is at secondary level, where dropout reaches **' + t.secondary_dropout_rate_2025_26 + '**, against **' + t.middle_dropout_rate_2025_26 + '** in middle school.'];
    },
    18: function (x) {
      var t = x.t;
      return ['There are **' + num(t.middle_ptr) + '** pupils per teacher in middle school and **' + num(t.secondary_ptr) + '** in secondary.',
              '**' + t.pct_computer_facility + '** of schools have a working computer, but only **' + t.pct_smart_classrooms + '** a smart classroom.'];
    },
    19: function (x) {
      var t = x.t;
      return ['Irrigation reaches **' + lakhHa(num(t.ipc_total_000ha_2024)) + '** of farmland: **' + lakhHa(num(t.ipc_kharif_000ha_2024)) +
              '** in the monsoon (kharif) season and **' + lakhHa(num(t.ipc_rabi_000ha_2024)) + '** in the dry (rabi) season.'];
    },
    20: function (x) {
      var t = x.t;
      return ['**' + t.pct_villages_electrified + '** of inhabited villages have electricity.',
              'The state has **' + indian(Math.round(num(t.rural_road_length_km))) + ' km** of rural road against **' + indian(Math.round(num(t.national_highway_length_km))) +
              ' km** of national highway, and **' + num(t.bank_branches_per_100k) + '** bank branches for every 1,00,000 people.'];
    }
  };

  /* ═════════════════════════════════════════════════════════════════
     PICTURES — one per module without a chart. Each fills `box` and may
     return an onEnter function, run each time the module comes up.
     ═════════════════════════════════════════════════════════════════ */
  function tile(parent, value, label, sub) {
    var d = el('div', 'dz-tile');
    d.appendChild(el('div', 'dz-tile-v', value)).setAttribute('data-count', value);
    d.appendChild(el('div', 'dz-tile-l', label));
    if (sub) d.appendChild(el('div', 'dz-tile-s', sub));
    parent.appendChild(d);
    return d;
  }
  function tiles(box) { return box.appendChild(el('div', 'dz-tiles')); }
  function barRow(parent, label, valueText, frac, color) {
    var r = el('div', 'dz-row');
    var top = r.appendChild(el('div', 'dz-row-top'));
    top.appendChild(el('span', 'dz-row-l', label));
    top.appendChild(el('span', 'dz-row-v', valueText)).setAttribute('data-count', valueText);
    var bar = r.appendChild(el('div', 'dz-bar'));
    var fill = bar.appendChild(el('i'));
    fill.style.setProperty('--w', Math.max(0, Math.min(1, frac)) * 100 + '%');
    fill.style.background = color || C.blue;
    parent.appendChild(r);
    return r;
  }
  function group(box, title) {
    var g = box.appendChild(el('div', 'dz-group'));
    if (title) g.appendChild(el('div', 'dz-group-t', title));
    return g;
  }

  /* ── charts drawn here, for the modules whose figures come from the
     ORGI projection and the NFHS fact sheets. Plain SVG in a 600-wide
     box; marks carry data-tip for the panel's tooltip. ── */
  var T_MUTED = 'font:500 15px var(--pm-ui);fill:var(--dz-muted)';
  var T_INK = 'font:700 16px var(--pm-ui);fill:var(--dz-ink)';
  function put(svg, tag, attrs, text) {
    var n = svgEl(tag, attrs);
    if (text != null) n.textContent = text;
    svg.appendChild(n);
    return n;
  }
  function chartSvg(box, h, label) {
    var s = box.appendChild(svgEl('svg', { viewBox: '0 0 600 ' + h, role: 'img', 'aria-label': label }));
    s.style.width = '100%';
    s.style.flex = '0 1 auto';
    return s;
  }
  /* o: { label, h, series: [{ name, color, pts: [{ x, y, proj, tip }], end }],
          xTicks: [[x, text]], yTicks: [..], yFmt, yDomain, ref: { y, text }, r } */
  function lineChart(box, o) {
    var W = 600, H = o.h || 330, m = { l: 58, r: o.r || 110, t: 18, b: 36 };
    var svg = chartSvg(box, H, o.label);
    var all = [].concat.apply([], o.series.map(function (s) { return s.pts; }));
    var x = d3.scaleLinear().domain(d3.extent(all, function (p) { return p.x; })).range([m.l, W - m.r]);
    var y = d3.scaleLinear().domain(o.yDomain || [0, d3.max(all, function (p) { return p.y; }) * 1.1]).range([H - m.b, m.t]);
    (o.yTicks || y.ticks(5)).forEach(function (v) {
      put(svg, 'line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: '#e3e6ea', 'stroke-width': 1 });
      put(svg, 'text', { x: m.l - 8, y: y(v) + 5, 'text-anchor': 'end', style: T_MUTED }, o.yFmt ? o.yFmt(v) : String(v));
    });
    o.xTicks.forEach(function (t) {
      put(svg, 'text', { x: x(t[0]), y: H - 10, 'text-anchor': 'middle', style: T_MUTED }, t[1]);
    });
    if (o.ref) {
      put(svg, 'line', { x1: m.l, x2: W - m.r, y1: y(o.ref.y), y2: y(o.ref.y), stroke: '#8a8f98', 'stroke-width': 1.5, 'stroke-dasharray': '3 5' });
      put(svg, 'text', { x: m.l + 6, y: y(o.ref.y) - 7, style: T_MUTED }, o.ref.text);
    }
    var line = d3.line().x(function (p) { return x(p.x); }).y(function (p) { return y(p.y); });
    var ends = [];
    o.series.forEach(function (s) {
      var solid = s.pts.filter(function (p) { return !p.proj; });
      var firstProj = s.pts.findIndex(function (p) { return p.proj; });
      var dashed = firstProj === -1 ? [] : s.pts.slice(Math.max(0, firstProj - 1));
      if (solid.length > 1) put(svg, 'path', { d: line(solid), fill: 'none', stroke: s.color, 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
      if (dashed.length > 1) put(svg, 'path', { d: line(dashed), fill: 'none', stroke: s.color, 'stroke-width': 3, 'stroke-dasharray': '7 6', 'stroke-linecap': 'round' });
      s.pts.forEach(function (p) {
        put(svg, 'circle', { cx: x(p.x), cy: y(p.y), r: 5, fill: p.proj ? '#fff' : s.color, stroke: s.color, 'stroke-width': 2.5,
                             'data-tip': p.tip });
      });
      var last = s.pts[s.pts.length - 1];
      ends.push({ y: y(last.y), text: s.end, color: s.color });
    });
    /* end labels, nudged apart where two lines finish close together */
    ends.sort(function (a, b) { return a.y - b.y; });
    for (var i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 19) ends[i].y = ends[i - 1].y + 19;
    ends.forEach(function (e) {
      put(svg, 'text', { x: W - m.r + 12, y: e.y + 5, style: 'font:700 15px var(--pm-ui);fill:' + e.color }, e.text);
    });
    return svg;
  }
  /* NFHS-5 beside NFHS-6: a ring for the earlier round, a dot for the
     later one, both values written out at the end of the row.
     rows: [label, nfhs5, nfhs6]; o: { label, max, unit } */
  function dumbbell(box, rows, o) {
    o = o || {};
    var W = 600, rowH = 44, top = 34, lw = 212, x1 = 432;
    var svg = chartSvg(box, top + rows.length * rowH + 6, o.label || 'NFHS-5 and NFHS-6 compared');
    var max = o.max || 100, unit = o.unit == null ? '%' : o.unit;
    var x = d3.scaleLinear().domain([0, max]).range([lw, x1]);
    put(svg, 'text', { x: 478, y: 16, 'text-anchor': 'middle', style: 'font:600 13px var(--pm-ui);fill:var(--dz-muted)' }, 'NFHS-5');
    put(svg, 'text', { x: 556, y: 16, 'text-anchor': 'middle', style: 'font:700 13px var(--pm-ui);fill:' + C.blue }, 'NFHS-6');
    put(svg, 'text', { x: lw, y: 16, style: 'font:500 12px var(--pm-ui);fill:var(--dz-muted)' }, '0');
    put(svg, 'text', { x: x1, y: 16, 'text-anchor': 'end', style: 'font:500 12px var(--pm-ui);fill:var(--dz-muted)' }, max + unit);
    rows.forEach(function (r, i) {
      var cy = top + i * rowH + rowH / 2 - 4, a = r[1], b = r[2];
      var tip = r[0] + ' · ' + one(b) + unit + ' in NFHS-6 (2023–24), ' + one(a) + unit + ' in NFHS-5 (2019–21)';
      put(svg, 'text', { x: lw - 14, y: cy + 5, 'text-anchor': 'end', style: 'font:600 14px var(--pm-ui);fill:var(--dz-ink)' }, r[0]);
      put(svg, 'line', { x1: lw, x2: x1, y1: cy, y2: cy, stroke: '#e3e6ea', 'stroke-width': 2, 'stroke-linecap': 'round' });
      put(svg, 'line', { x1: x(a), x2: x(b), y1: cy, y2: cy, stroke: C.blue, 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0.45 });
      put(svg, 'circle', { cx: x(a), cy: cy, r: 7, fill: '#fff', stroke: '#8a8f98', 'stroke-width': 2.5, 'data-tip': tip });
      put(svg, 'circle', { cx: x(b), cy: cy, r: 8, fill: C.blue, 'data-tip': tip });
      put(svg, 'text', { x: 478, y: cy + 5, 'text-anchor': 'middle', style: T_MUTED }, one(a) + unit);
      put(svg, 'text', { x: 517, y: cy + 5, 'text-anchor': 'middle', style: T_MUTED }, '→');
      put(svg, 'text', { x: 556, y: cy + 5, 'text-anchor': 'middle', style: T_INK }, one(b) + unit).setAttribute('data-count', one(b) + unit);
    });
    return svg;
  }
  function nfhsRows(x, list) {
    return list.map(function (l) {
      var r = nfhsRow(x.nfhs, l[1]);
      return r ? [l[0], r.o5, r.o6] : null;
    }).filter(Boolean);
  }
  function nfhsHint(box, extra) {
    box.appendChild(el('p', 'dz-hint', 'Ring: NFHS-5 (2019–21). Dot: NFHS-6 (2023–24). ' + (extra || '') + 'Source: ' + SRC.nfhs6 + '; ' + SRC.nfhs5 + '.'));
  }

  var PICTURES = {
    /* the outline of the state, drawn in, with its neighbours */
    1: function (box, x) {
      var svg = box.appendChild(svgEl('svg', { viewBox: '0 0 600 470', class: 'dz-map', role: 'img',
        'aria-label': 'Map of Odisha’s 30 districts' }));
      var proj = d3.geoMercator().fitExtent([[60, 40], [540, 420]], x.geo);
      var path = d3.geoPath(proj);
      x.geo.features.forEach(function (f, i) {
        var name = f.properties.Dist_Name;
        var p = svgEl('path', { d: path(f), pathLength: 1, class: 'dz-draw', 'data-tip': name + ' · click to open its profile' });
        p.style.setProperty('--d', (i * 35) + 'ms');
        p.addEventListener('click', function () {
          window.location.href = 'district.html?id=' + encodeURIComponent(name);
        });
        svg.appendChild(p);
      });
      [['Jharkhand', 250, 26, 'middle'], ['West Bengal', 520, 40, 'end'], ['Chhattisgarh', 18, 200, 'start'],
       ['Andhra Pradesh', 120, 452, 'middle'], ['Bay of Bengal', 560, 380, 'end']].forEach(function (l) {
        var t = svgEl('text', { x: l[1], y: l[2], 'text-anchor': l[3], class: l[0] === 'Bay of Bengal' ? 'dz-sea' : 'dz-nb' });
        t.textContent = l[0];
        svg.appendChild(t);
      });
      var hint = box.appendChild(el('p', 'dz-hint dz-click'));
      hint.appendChild(icon('pointer'));
      hint.appendChild(document.createTextNode('Click any district to open its full profile.'));
      var ts = tiles(box), s3 = x.byNum[3] && x.byNum[3].table_data || {};
      if (s3.area_sq_km) tile(ts, s3.area_sq_km, 'square kilometres');
      var coast = String(x.slide.text_content || '').match(/~?\s*([\d,]+)\s*km coastline/);
      if (coast) tile(ts, coast[1], 'km of coastline');
      tile(ts, String(x.geo.features.length), 'districts');
    },

    /* the state as 100 squares of land */
    2: function (box, x) {
      var t = x.t, L = landCats(t, x.areaKha), cats = L.cats, n = L.n;
      var wrap = box.appendChild(el('div', 'dz-waffle-wrap'));
      var grid = wrap.appendChild(el('div', 'dz-waffle'));
      var k = 0;
      cats.forEach(function (c, ci) {
        for (var i = 0; i < n[ci]; i++, k++) {
          var cell = grid.appendChild(el('i', 'dz-cell'));
          cell.style.background = c.color;
          cell.style.setProperty('--d', (k * 9) + 'ms');
          cell.setAttribute('data-tip', c.label + ' · ' + n[ci] + ' of 100 · ' + lakhHa(c.v));
        }
      });
      var leg = wrap.appendChild(el('ul', 'dz-legend'));
      cats.forEach(function (c, ci) {
        var li = leg.appendChild(el('li'));
        li.appendChild(el('i')).style.background = c.color;
        li.appendChild(el('b', null, String(n[ci])));
        li.appendChild(el('span', null, c.label + ' · ' + lakhHa(c.v)));
      });
      var ts = tiles(box);
      tile(ts, indian(num(t.annual_rainfall_mm_2024)), 'mm of rain, 2024');
    },

    /* blocks, gram panchayats and villages as circles drawn to scale */
    3: function (box, x) {
      var t = x.t;
      var items = [['blocks', num(t.blocks)], ['gram panchayats', num(t.gram_panchayats)], ['villages', num(t.villages)]];
      var max = items[2][1], R = 120;
      var svg = box.appendChild(svgEl('svg', { viewBox: '0 0 600 330', class: 'dz-circles', role: 'img',
        'aria-label': items.map(function (i) { return indian(i[1]) + ' ' + i[0]; }).join(', ') }));
      var cx = [110, 250, 440];
      items.forEach(function (it, i) {
        var r = Math.max(4, R * Math.sqrt(it[1] / max));
        var c = svgEl('circle', { cx: cx[i], cy: 250 - r, r: r, class: 'dz-circle', fill: i === 2 ? C.orange : C.blue });
        c.style.setProperty('--d', (i * 220) + 'ms');
        svg.appendChild(c);
        var v = svgEl('text', { x: cx[i], y: 284, 'text-anchor': 'middle', class: 'dz-cv' });
        v.textContent = indian(it[1]); v.setAttribute('data-count', indian(it[1]));
        svg.appendChild(v);
        var l = svgEl('text', { x: cx[i], y: 306, 'text-anchor': 'middle', class: 'dz-cl' });
        l.textContent = it[0];
        svg.appendChild(l);
      });
      var ts = tiles(box);
      tile(ts, String(Math.round(num(t.density_2011))), 'people per sq km, 2011');
      tile(ts, t.literacy_rate, 'literate, 2011');
      if (t.uninhabited_villages) tile(ts, indian(num(t.uninhabited_villages)), 'villages with no one living in them');
    },

    /* the assembly, one dot a seat */
    4: function (box, x) {
      var t = x.t, seats = num(t.assembly_constituencies) || 0, rows = 7;
      var svg = box.appendChild(svgEl('svg', { viewBox: '0 0 600 330', class: 'dz-hemi', role: 'img',
        'aria-label': seats + ' assembly constituencies' }));
      var R = 270, r0 = 110, cx = 300, cy = 300;
      var radii = d3.range(rows).map(function (i) { return r0 + (R - r0) * i / (rows - 1); });
      var per = shares(radii, seats), pts = [];
      radii.forEach(function (rad, i) {
        for (var j = 0; j < per[i]; j++) {
          var a = Math.PI - (per[i] === 1 ? Math.PI / 2 : j / (per[i] - 1) * Math.PI);
          pts.push([cx + rad * Math.cos(a), cy - rad * Math.sin(a), a]);
        }
      });
      pts.sort(function (p, q) { return q[2] - p[2]; }).forEach(function (p, i) {
        var c = svgEl('circle', { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 8.5, class: 'dz-seat' });
        c.style.setProperty('--d', (i * 8) + 'ms');
        svg.appendChild(c);
      });
      var big = svgEl('text', { x: cx, y: cy - 22, 'text-anchor': 'middle', class: 'dz-hemi-n' });
      big.textContent = String(seats); big.setAttribute('data-count', String(seats));
      svg.appendChild(big);
      var lab = svgEl('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', class: 'dz-cl' });
      lab.textContent = 'assembly constituencies';
      svg.appendChild(lab);
      var ts = tiles(box);
      tile(ts, String(num(t.sub_divisions)), 'sub-divisions');
      tile(ts, String(num(t.tehsils)), 'tehsils');
      tile(ts, String(num(t.municipal_corporations)), 'municipal corporations');
    },

    5: function (box, x) {
      var t = x.t;
      var g1 = group(box, 'Share of the population, 2011');
      barRow(g1, 'Scheduled Tribes', t.tribal_share_pct, num(t.tribal_share_pct) / 100, C.orange);
      barRow(g1, 'Living in towns and cities', t.urban_population_share, num(t.urban_population_share) / 100, C.blue);
      var g2 = group(box, 'Life expectancy at birth, years (computed from NFHS-5, 2019–21)');
      var top = Math.max(num(t.life_expectancy_female_nfhs5), num(t.life_expectancy_male_nfhs5));
      barRow(g2, 'Women', t.life_expectancy_female_nfhs5, num(t.life_expectancy_female_nfhs5) / (top * 1.1), C.orange);
      barRow(g2, 'Men', t.life_expectancy_male_nfhs5, num(t.life_expectancy_male_nfhs5) / (top * 1.1), C.blue);
      var ts = tiles(box);
      tile(ts, t.population_2011, 'people, Census 2011');
      tile(ts, String(num(t.sex_ratio_2011)), 'women per 1,000 men, 2011');
    },

    /* the population since 1901, the ORGI projection dashed */
    6: function (box, x) {
      var p = x.p;
      lineChart(box, {
        label: 'Population of Odisha, ' + p.first.year + ' to ' + p.last.year, r: 96,
        series: [{ name: 'Population', color: C.blue, end: crore(p.last.total).replace(' crore', ' cr'),
                   pts: p.series.map(function (r) {
                     return { x: r.year, y: r.total, proj: r.year > 2011,
                              tip: r.year + ' · ' + crore(r.total) + (r.year > 2011 ? ' (projected)' : '') };
                   }) }],
        xTicks: [p.first.year, 1951, 2011, p.last.year].map(function (v) { return [v, String(v)]; }),
        yTicks: [0, 1e7, 2e7, 3e7, 4e7, 5e7], yDomain: [0, 5.4e7],
        yFmt: function (v) { return v / 1e7 + ' cr'; }
      });
      box.appendChild(el('p', 'dz-hint', 'Hollow points and the dashed line are projections. Source: Census of India 1901–2011; ' + SRC.orgi + '.'));
      var ts = tiles(box);
      if (p.p2021) tile(ts, crore(p.p2021.total), 'people in 2021 (projected)');
      tile(ts, crore(p.last.total), 'people by ' + p.last.year + ' (projected)');
    },

    /* the ORGI fertility path, with the two NFHS rounds beside it */
    7: function (box, x) {
      var f = tfrFacts(x.orgi, x.nfhs);
      if (!f) return;
      var k = f.periods.length - 1;
      function pts(arr, who) {
        return arr.map(function (v, i) {
          return { x: i, y: v, proj: i > 0, tip: who + ', ' + f.periods[i] + ' · ' + v.toFixed(2) + ' children per woman' + (i > 0 ? ' (projected)' : '') };
        });
      }
      lineChart(box, {
        label: 'Total fertility rate, Odisha and India, ' + f.periods[0] + ' to ' + f.periods[k], h: 300, r: 120,
        series: [{ color: '#8a8f98', end: 'India ' + f.india[k].toFixed(2), pts: pts(f.india, 'India') },
                 { color: C.orange, end: 'Odisha ' + f.odisha[k].toFixed(2), pts: pts(f.odisha, 'Odisha') }],
        xTicks: f.periods.map(function (p, i) { return [i, p]; }),
        yTicks: [1.5, 2.0, 2.5], yDomain: [1.4, 2.6], yFmt: function (v) { return v.toFixed(1); },
        ref: { y: 2.1, text: 'Replacement level 2.1' }
      });
      box.appendChild(el('p', 'dz-hint', 'Children per woman. Source: ' + SRC.orgi + ', Table 3.'));
      var ts = tiles(box);
      tile(ts, one(f.n.o6), 'children per woman, NFHS-6 (2023–24, published May 2026)');
      tile(ts, one(f.n.o5), 'in NFHS-5 (2019–21)');
      if (f.n.urban != null && f.n.rural != null) tile(ts, one(f.n.urban) + ' · ' + one(f.n.rural), 'urban · rural, NFHS-6');
      box.appendChild(el('p', 'dz-hint', 'Surveyed rates: ' + SRC.nfhs6 + '; ' + SRC.nfhs5 + '. Neither round publishes a district fertility rate.'));
    },

    /* children, working age and elders as shares, 2011 to 2036 */
    8: function (box, x) {
      var a = x.p.ageSeries, last = a[a.length - 1];
      function s(key, name, color) {
        return { color: color, end: last[key].toFixed(1) + '% ' + name,
                 pts: a.map(function (r) {
                   return { x: r.year, y: r[key], proj: r.year > 2011, tip: r.year + ' · ' + name + ' ' + r[key].toFixed(1) + '%' + (r.year > 2011 ? ' (projected)' : '') };
                 }) };
      }
      lineChart(box, {
        label: 'Share of the population by age group, 2011 to ' + last.year, r: 170,
        series: [s('work', 'aged 15–59', '#5b6470'), s('child', 'under 15', C.blue), s('elder', 'aged 60+', C.orange)],
        xTicks: a.map(function (r) { return [r.year, String(r.year)]; }),
        yTicks: [0, 20, 40, 60], yDomain: [0, 72], yFmt: function (v) { return v + '%'; }
      });
      box.appendChild(el('p', 'dz-hint', 'Source: Census of India 2011; ' + SRC.orgi + '.'));
      var ts = tiles(box);
      tile(ts, Math.round(x.p.a2011.elder / 100 * x.p.a2011.total / 1e5) + ' lakh', 'people aged 60+, 2011');
      tile(ts, Math.round(last.elder / 100 * last.total / 1e5) + ' lakh', 'people aged 60+, ' + last.year + ' (projected)');
    },

    /* women per 1,000 men since 1901 */
    9: function (box, x) {
      var p = x.p;
      lineChart(box, {
        label: 'Sex ratio of Odisha, ' + p.first.year + ' to ' + p.last.year, r: 70,
        series: [{ color: C.orange, end: String(Math.round(p.last.sex_ratio)),
                   pts: p.series.map(function (r) {
                     return { x: r.year, y: r.sex_ratio, proj: r.year > 2011,
                              tip: r.year + ' · ' + indian(Math.round(r.sex_ratio)) + ' women per 1,000 men' + (r.year > 2011 ? ' (projected)' : '') };
                   }) }],
        xTicks: [p.first.year, 1951, p.low.year, 2011, p.last.year].map(function (v) { return [v, String(v)]; }),
        yTicks: [950, 1000, 1050, 1100], yDomain: [940, 1100], yFmt: function (v) { return indian(v); },
        ref: { y: 1000, text: 'As many women as men' }
      });
      box.appendChild(el('p', 'dz-hint', 'Women per 1,000 men. Hollow points are projections. Source: Census of India 1901–2011; ' + SRC.orgi + '.'));
      var ts = tiles(box);
      tile(ts, String(Math.round(p.p2011.sex_ratio)), 'women per 1,000 men, Census 2011');
      if (p.p2021) tile(ts, String(Math.round(p.p2021.sex_ratio)), 'in 2021 (projected)');
      tile(ts, String(Math.round(p.last.sex_ratio)), 'by ' + p.last.year + ' (projected)');
    },

    /* the age pyramid: 2011 as an outline, the last projected year filled */
    10: function (box, x) {
      var a = x.p.a2011, b = x.p.aLast, n = b.rows.length;
      var W = 600, rowH = 19, top = 30, H = top + n * rowH + 30, mid = W / 2, gap = 30;
      var svg = chartSvg(box, H, 'Age pyramid of Odisha, 2011 and ' + b.year);
      var max = 0;
      [a, b].forEach(function (s) { s.rows.forEach(function (r) { max = Math.max(max, r.male / s.total * 100, r.female / s.total * 100); }); });
      var w = d3.scaleLinear().domain([0, max * 1.05]).range([0, mid - gap - 16]);
      put(svg, 'text', { x: mid - gap - 4, y: 16, 'text-anchor': 'end', style: 'font:700 14px var(--pm-ui);fill:' + C.blue }, 'Men');
      put(svg, 'text', { x: mid + gap + 4, y: 16, style: 'font:700 14px var(--pm-ui);fill:' + C.orange }, 'Women');
      b.rows.forEach(function (r, i) {
        var y = top + (n - 1 - i) * rowH, o = a.rows[i] || r;
        var m = r.male / b.total * 100, f = r.female / b.total * 100;
        var tip = 'Age ' + r.age + ' · ' + b.year + ': men ' + m.toFixed(1) + '%, women ' + f.toFixed(1) + '% · 2011: men ' +
                  (o.male / a.total * 100).toFixed(1) + '%, women ' + (o.female / a.total * 100).toFixed(1) + '%';
        put(svg, 'rect', { x: mid - gap - w(m), y: y + 2, width: w(m), height: rowH - 4, rx: 2, fill: C.blue, 'data-tip': tip });
        put(svg, 'rect', { x: mid + gap, y: y + 2, width: w(f), height: rowH - 4, rx: 2, fill: C.orange, 'data-tip': tip });
        var wm = w(o.male / a.total * 100), wf = w(o.female / a.total * 100);
        put(svg, 'rect', { x: mid - gap - wm, y: y + 2, width: wm, height: rowH - 4, rx: 2, fill: 'none', stroke: '#30343a', 'stroke-width': 1.4, 'pointer-events': 'none' });
        put(svg, 'rect', { x: mid + gap, y: y + 2, width: wf, height: rowH - 4, rx: 2, fill: 'none', stroke: '#30343a', 'stroke-width': 1.4, 'pointer-events': 'none' });
        put(svg, 'text', { x: mid, y: y + rowH - 5, 'text-anchor': 'middle', style: 'font:600 11.5px var(--pm-ui);fill:var(--dz-muted)' }, r.age);
      });
      var ly = H - 10;
      put(svg, 'rect', { x: 150, y: ly - 11, width: 22, height: 12, rx: 2, fill: 'none', stroke: '#30343a', 'stroke-width': 1.4 });
      put(svg, 'text', { x: 178, y: ly, style: 'font:500 13px var(--pm-ui);fill:var(--dz-muted)' }, '2011 (Census)');
      put(svg, 'rect', { x: 310, y: ly - 11, width: 22, height: 12, rx: 2, fill: C.blue });
      put(svg, 'text', { x: 338, y: ly, style: 'font:500 13px var(--pm-ui);fill:var(--dz-muted)' }, b.year + ' (projected)');
      box.appendChild(el('p', 'dz-hint', 'Each bar is a five-year age group as a share of everyone. Source: Census of India 2011; ' + SRC.orgi + '.'));
    },

    /* the health picture, NFHS-5 beside NFHS-6 */
    12: function (box, x) {
      var rows = nfhsRows(x, [
        ['Births in a health facility', /^Institutional births \(/i],
        ['Households with health cover', /health insurance/i],
        ['Iron and folic acid, 100+ days', /iron folic acid for 100 days/i],
        ['Children fully vaccinated', /fully vaccinated based on information from either/i],
        ['Four or more antenatal visits', /at least 4 antenatal/i],
        ['Children under 5 stunted', /who are stunted/i]
      ]);
      if (!rows.length) return;
      dumbbell(box, rows, { label: 'Health indicators for Odisha in NFHS-5 and NFHS-6' });
      nfhsHint(box, 'Per cent. ');
    },

    /* child nutrition, NFHS-5 beside NFHS-6 */
    15: function (box, x) {
      var rows = nfhsRows(x, [
        ['Stunted (short for age)', /who are stunted/i],
        ['Wasted (thin for height)', /who are wasted/i],
        ['Severely wasted', /severely wasted/i],
        ['Underweight', /who are underweight/i],
        ['Breastfed only, under 6 months', /under age 6 months exclusively breastfed \(/i]
      ]);
      if (!rows.length) return;
      dumbbell(box, rows, { label: 'Child nutrition in Odisha in NFHS-5 and NFHS-6', max: 80 });
      nfhsHint(box, 'Children under five, per cent. ');
    },

    /* the 62 communities, the 13 particularly vulnerable ones picked out */
    11: function (box, x) {
      var run = String(x.slide.text_content || '').split(/\n\n+/).filter(function (p) { return /^\s*1\.\s/.test(p); })[0] || '';
      var names = run.split(/,\s*(?=\d+\.\s)/).map(function (s) { return s.replace(/^\s*\d+\.\s*/, '').trim(); }).filter(Boolean);
      var nP = names.filter(function (s) { return /\(PVTG\)/.test(s); }).length;
      var head = box.appendChild(el('div', 'dz-tribe-head'));
      rich(head.appendChild(el('span')), '**' + names.length + '** communities');
      var sw = head.appendChild(el('span', 'dz-key'));
      sw.appendChild(el('i')).style.background = C.orange;
      rich(sw, '**' + nP + '** particularly vulnerable (PVTG)');
      var grid = box.appendChild(el('div', 'dz-tribes'));
      names.forEach(function (s, i) {
        var pv = /\(PVTG\)/.test(s);
        var d = grid.appendChild(el('i', 'dz-tribe' + (pv ? ' is-pvtg' : '')));
        d.style.setProperty('--d', (i * 14) + 'ms');
        d.setAttribute('data-tip', s.replace(/\s*\(PVTG\)/, '') + (pv ? ' · PVTG' : ''));
      });
      box.appendChild(el('p', 'dz-hint', 'Hover a dot for the community’s name.'));
      var ts = tiles(box);
      if (x.t.tribal_population) tile(ts, x.t.tribal_population, 'tribal people, Census 2011');
      if (x.t.tribal_share_pct) tile(ts, x.t.tribal_share_pct, 'of the state’s population');
    },

    /* sub-centres → PHCs → CHCs, bar widths to scale */
    13: function (box, x) {
      var t = x.t;
      var levels = [['Community health centres', num(t.chcs_2024)], ['Primary health centres', num(t.phcs_2024)], ['Sub-centres', num(t.sub_centres_2024)]];
      var max = levels[2][1];
      var py = box.appendChild(el('div', 'dz-pyr'));
      levels.forEach(function (l, i) {
        var row = py.appendChild(el('div', 'dz-pyr-row'));
        var b = row.appendChild(el('div', 'dz-pyr-bar'));
        b.style.setProperty('--w', (l[1] / max * 100) + '%');
        b.style.setProperty('--d', ((2 - i) * 200) + 'ms');
        b.style.background = i === 2 ? C.orange : C.blue;
        var lab = row.appendChild(el('div', 'dz-pyr-l'));
        lab.appendChild(el('b', null, indian(l[1]))).setAttribute('data-count', indian(l[1]));
        lab.appendChild(document.createTextNode(' ' + l[0]));
      });
      box.appendChild(el('p', 'dz-hint', 'Narrowest at the top: fewer, bigger centres serve the many sub-centres below them.'));
      var ts = tiles(box);
      tile(ts, String(num(t.beds_per_100k_2024)), 'hospital beds per 1,00,000 people');
    },

    /* the literacy gap between men and women */
    16: function (box, x) {
      var e = x.byNum[17] && x.byNum[17].table_data || {};
      var m = num(e.male_literacy_rate_2011), f = num(e.female_literacy_rate_2011);
      if (m == null || f == null) return;
      var g = group(box, 'Literacy, Census 2011');
      barRow(g, 'Men', e.male_literacy_rate_2011, m / 100, C.blue);
      barRow(g, 'Women', e.female_literacy_rate_2011, f / 100, C.orange);
      var ts = tiles(box);
      tile(ts, (m - f).toFixed(1), 'percentage points between men and women');
    },

    17: function (box, x) {
      var t = x.t;
      var g1 = group(box, 'Moving up, 2025–26');
      barRow(g1, 'Preparatory → middle', t.transition_preparatory_to_middle_2025_26, num(t.transition_preparatory_to_middle_2025_26) / 100, C.blue);
      barRow(g1, 'Middle → secondary', t.transition_middle_to_secondary_2025_26, num(t.transition_middle_to_secondary_2025_26) / 100, C.blue);
      var g2 = group(box, 'Dropping out, 2025–26');
      barRow(g2, 'Middle school', t.middle_dropout_rate_2025_26, num(t.middle_dropout_rate_2025_26) / 100, C.orange);
      barRow(g2, 'Secondary school', t.secondary_dropout_rate_2025_26, num(t.secondary_dropout_rate_2025_26) / 100, C.orange);
      var ts = tiles(box);
      tile(ts, t.preparatory_ger_2025_26, 'gross enrolment, preparatory');
      tile(ts, t.middle_ger_2025_26, 'gross enrolment, middle');
    },

    20: function (box, x) {
      var t = x.t;
      var roads = [['Rural roads', num(t.rural_road_length_km)], ['District roads', num(t.district_road_length_km)],
                   ['Forest roads', num(t.forest_road_length_km)], ['National highways', num(t.national_highway_length_km)]]
        .filter(function (r) { return r[1] != null; }).sort(function (a, b) { return b[1] - a[1]; });
      var g = group(box, 'Road length, km (2024–25)');
      roads.forEach(function (r, i) { barRow(g, r[0], indian(Math.round(r[1])), r[1] / roads[0][1], i ? C.blue : C.orange); });
      var ts = tiles(box);
      tile(ts, t.pct_villages_electrified, 'of inhabited villages electrified');
      tile(ts, String(num(t.bank_branches_per_100k)), 'bank branches per 1,00,000 people');
    }
  };

  /* ═════════════════════════════════════════════════════════════════
     BUILD
     ═════════════════════════════════════════════════════════════════ */
  var sec = typeof document !== 'undefined' && document.getElementById('dashboard');
  var API = { splitText: splitText, popFacts: popFacts, landCats: landCats, LEADS: LEADS, CHAPTERS: CHAPTERS, num: num,
              tfrFacts: tfrFacts, nfhsRow: nfhsRow, SRC: SRC };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  /* the same, for the printable report (report.js) */
  if (typeof window !== 'undefined') window.SoochanaDossier = API;
  if (!sec || !window.d3 || typeof DataLoader === 'undefined') return;

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nav = sec.querySelector('.dz-index');
  var stepsBox = sec.querySelector('.dz-steps');
  var panel = sec.querySelector('.dz-panel');
  var tip = el('div', 'dz-tip');
  var order = [], chapterOf = {}, scenes = {}, steps = {}, current = null, CH = [];
  function modIcon(n) { return MODULE_ICONS[n] || CH[chapterOf[n]].icon; }

  function build(details, state, geo, orgi, nfhs) {
    var d = details && details.Odisha;
    if (!d || !d.slides_detail) return;
    var byNum = {};
    d.slides_detail.forEach(function (s) { byNum[s.slide_num] = s; });

    var chapters = CHAPTERS.map(function (c) {
      return { key: c.key, icon: c.icon, name: c.name, mods: c.mods.filter(function (n) { return byNum[n]; }) };
    }).filter(function (c) { return c.mods.length; });
    var listed = [].concat.apply([], chapters.map(function (c) { return c.mods; }));
    var extra = d.slides_detail.map(function (s) { return s.slide_num; }).filter(function (n) { return listed.indexOf(n) === -1; });
    if (extra.length) chapters.push({ key: 'more', icon: 'bars', name: 'More', mods: extra });
    CH = chapters;
    chapters.forEach(function (c, ci) { c.mods.forEach(function (n) { order.push(n); chapterOf[n] = ci; }); });

    var s3 = byNum[3] && byNum[3].table_data || {};
    var ctxBase = {
      byNum: byNum, geo: geo,
      p: popFacts(state), orgi: orgi, nfhs: nfhs,
      areaKha: (num(s3.area_sq_km) || 155707) / 10,      /* sq km → thousand hectares */
      tfrState: keyTfr()
    };

    buildNav(chapters, byNum);

    order.forEach(function (n, i) {
      var s = byNum[n], ch = chapters[chapterOf[n]];
      var x = Object.create(ctxBase);
      x.slide = s; x.t = s.table_data || {};
      var txt = splitText(s);

      /* the card */
      var step = el('div', 'dz-step');
      step.id = 'module-' + n;
      step.setAttribute('data-mod', n);
      step.setAttribute('data-ch', ch.key);
      var card = step.appendChild(el('article', 'dz-card'));
      var head = card.appendChild(el('div', 'dz-card-head'));
      head.appendChild(el('span', 'dz-badge')).appendChild(icon(modIcon(n)));
      var kick = head.appendChild(el('div', 'dz-kicker'));
      kick.appendChild(icon(ch.icon, 'dz-ic-sm'));
      kick.appendChild(document.createTextNode(ch.name + ' · ' + pad(i + 1) + ' / ' + pad(order.length)));
      card.appendChild(el('h3', 'dz-title', s.title));
      var lead = LEADS[n] ? safe(function () { return LEADS[n](x); }) : null;
      var paras = lead && lead.length ? lead : txt.body;
      paras.forEach(function (p) { rich(card.appendChild(el('p')), p); });
      if (!paras.length && txt.note) card.appendChild(el('p', null, txt.note));
      var src = [txt.source && 'Source: ' + txt.source, txt.note && paras.length && 'Note: ' + txt.note].filter(Boolean).join(' · ');
      if (src) card.appendChild(el('p', 'dz-src', src));
      stepsBox.appendChild(step);
      steps[n] = step;

      /* its picture */
      var scene = el('div', 'dz-scene');
      scene.setAttribute('data-mod', n);
      scene.setAttribute('data-ch', ch.key);
      var sk = scene.appendChild(el('div', 'dz-scene-k'));
      sk.appendChild(icon(modIcon(n)));
      sk.appendChild(el('span', 'dz-scene-t', pad(i + 1) + ' · ' + shortTitle(s.title)));
      var body = scene.appendChild(el('div', 'dz-scene-b'));
      if (s.chart_url) {
        scene.classList.add('is-chart');
        body.setAttribute('data-embed', s.chart_url.indexOf('?') !== -1 ? s.chart_url : s.chart_url + '?auto=1');
        body.appendChild(el('div', 'dz-loading', 'Preparing chart…'));
      } else if (PICTURES[n]) {
        safe(function () { PICTURES[n](body, x); });
      }
      if (!body.childNodes.length) {
        scene.classList.add('is-quote');
        body.appendChild(el('p', 'dz-quote', shortTitle(s.title)));
      }
      panel.appendChild(scene);
      scenes[n] = scene;
    });
    panel.appendChild(tip);
    /* before the first card is reached, the panel already shows its picture */
    if (order.length) scenes[order[0]].classList.add('is-on');
    wireTips();
    observe();
  }

  function safe(fn) {
    try { return fn(); } catch (e) { if (window.console) console.warn('Dossier:', e); return null; }
  }
  function keyTfr() {
    var ks = window.SOOCHANA_KEY_STATS, v = null;
    (ks && ks.groups || []).forEach(function (g) {
      (g.tiles || []).forEach(function (t) { if (/fertility/i.test(t.label || '')) v = t.value; });
    });
    return v;
  }

  /* ── the index bar ── */
  var navNow, navBar, navChips = [];
  function buildNav(chapters, byNum) {
    nav.textContent = '';
    var row = nav.appendChild(el('div', 'dz-index-row'));
    row.appendChild(el('div', 'dz-index-k', 'Analytics index'));
    var list = row.appendChild(el('ol', 'dz-chapters'));
    chapters.forEach(function (c, ci) {
      var li = list.appendChild(el('li'));
      var b = li.appendChild(el('button', 'dz-chip'));
      b.type = 'button';
      b.setAttribute('data-ch', c.key);
      var nm = b.appendChild(el('span', 'dz-chip-n'));
      nm.appendChild(icon(c.icon, 'dz-ic-sm'));
      nm.appendChild(document.createTextNode(c.name));
      var ticks = b.appendChild(el('span', 'dz-ticks'));
      ticks.setAttribute('aria-hidden', 'true');
      c.mods.forEach(function (n) { ticks.appendChild(el('i')).setAttribute('data-mod', n); });
      b.addEventListener('click', function () { jump(c.mods[0]); });
      navChips.push({ btn: b, ci: ci });
    });
    navNow = row.appendChild(el('div', 'dz-now'));
    navNow.setAttribute('aria-live', 'polite');
    var jumpBox = row.appendChild(el('details', 'dz-jump'));
    jumpBox.appendChild(el('summary', null, 'Jump to a module'));
    var menu = jumpBox.appendChild(el('div', 'dz-menu'));
    chapters.forEach(function (c) {
      var mh = menu.appendChild(el('div', 'dz-menu-h'));
      mh.setAttribute('data-ch', c.key);
      mh.appendChild(icon(c.icon, 'dz-ic-sm'));
      mh.appendChild(document.createTextNode(c.name));
      c.mods.forEach(function (n) {
        var b = menu.appendChild(el('button', 'dz-menu-i'));
        b.type = 'button';
        b.setAttribute('data-ch', c.key);
        b.appendChild(icon(modIcon(n)));
        b.appendChild(el('span', 'dz-menu-n', pad(order.indexOf(n) + 1)));
        b.appendChild(document.createTextNode(shortTitle(byNum[n].title)));
        b.addEventListener('click', function () { jumpBox.open = false; jump(n); });
      });
    });
    document.addEventListener('click', function (e) { if (jumpBox.open && !jumpBox.contains(e.target)) jumpBox.open = false; });
    navBar = nav.appendChild(el('div', 'dz-progress')).appendChild(el('i'));
    setNavHeight();
  }
  function setNavHeight() {
    sec.style.setProperty('--dz-nav', nav.offsetHeight + 'px');
  }
  function jump(n) {
    var s = steps[n];
    if (!s) return;
    var r = s.getBoundingClientRect();
    var line = innerHeight * activeLine();
    window.scrollTo({ top: scrollY + r.top + Math.min(r.height / 2, 80) - line + 40, behavior: reduced ? 'auto' : 'smooth' });
  }
  function activeLine() { return matchMedia('(max-width: 899px)').matches ? 0.72 : 0.5; }

  /* ── which module is being read ── */
  function activate(n) {
    if (n === current) return;
    current = n;
    var i = order.indexOf(n);
    /* the section takes the chapter's ground; the colour eases across */
    sec.setAttribute('data-ch', CH[chapterOf[n]].key);
    Object.keys(steps).forEach(function (k) { steps[k].classList.toggle('is-active', +k === n); });
    Object.keys(scenes).forEach(function (k) {
      var on = +k === n;
      scenes[k].classList.toggle('is-on', on);
      scenes[k].setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    /* load this chart and its neighbours, so the next one is ready */
    [order[i - 1], n, order[i + 1]].forEach(function (k) { if (k != null) loadChart(scenes[k]); });
    countUp(scenes[n]);
    countUp(steps[n]);
    /* the index */
    nav.querySelectorAll('.dz-ticks i').forEach(function (t) {
      var j = order.indexOf(+t.getAttribute('data-mod'));
      t.className = j < i ? 'is-done' : (j === i ? 'is-on' : '');
    });
    navChips.forEach(function (c) {
      var on = c.ci === chapterOf[n];
      c.btn.classList.toggle('is-on', on);
      if (on) c.btn.setAttribute('aria-current', 'true'); else c.btn.removeAttribute('aria-current');
    });
    var title = scenes[n].querySelector('.dz-scene-t').textContent.replace(/^\d+ · /, '');
    navNow.textContent = '';
    navNow.appendChild(el('b', null, pad(i + 1)));
    navNow.appendChild(document.createTextNode(' / ' + pad(order.length) + ' '));
    navNow.appendChild(el('span', null, title));
    navBar.style.width = ((i + 1) / order.length * 100) + '%';
    /* on a narrow bar, bring the current chapter into view */
    var on = nav.querySelector('.dz-chip.is-on'), box = on && on.closest('.dz-chapters');
    if (box && box.scrollWidth > box.clientWidth) {
      box.scrollTo({ left: on.parentNode.offsetLeft - 8, behavior: reduced ? 'auto' : 'smooth' });
    }
  }

  function observe() {
    var io = null;
    function make() {
      if (io) io.disconnect();
      var line = activeLine() * 100;
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) activate(+e.target.getAttribute('data-mod')); });
      }, { rootMargin: '-' + line + '% 0px -' + (100 - line) + '% 0px', threshold: 0 });
      Object.keys(steps).forEach(function (k) { io.observe(steps[k]); });
    }
    make();
    var wasNarrow = matchMedia('(max-width: 899px)').matches;
    window.addEventListener('resize', function () {
      setNavHeight();
      var narrow = matchMedia('(max-width: 899px)').matches;
      if (narrow !== wasNarrow) { wasNarrow = narrow; make(); }
    });
  }

  /* A Flourish chart tells its host how tall it wants to be. The panel is
     often shorter than that on a laptop, which used to cut the bottom of
     the chart (usually the year axis). The frame now takes the height it
     asks for and is fitted to the panel. */
  window.addEventListener('message', function (e) {
    if (!/^https:\/\/(flo\.uri\.sh|public\.flourish\.studio)$/.test(e.origin)) return;
    var d = e.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (err) { return; } }
    if (!d || d.sender !== 'Flourish' || !(d.height > 0)) return;
    var frames = document.querySelectorAll('iframe');
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow !== e.source) continue;
      var f = frames[i], h = Math.ceil(d.height);
      var body = f.closest('.dz-scene-b');
      if (!body) { f.style.height = h + 'px'; return; }       /* the policy timelines */
      /* A little too tall: shrink the whole chart to fit, so nothing needs
         scrolling. Much too tall (it would be unreadably small): keep its
         size and let the panel scroll. */
      var room = body.clientHeight, k = room / h;
      var fit = h > room + 4 && k >= 0.62, tall = h > room + 4 && !fit;
      var mode = fit ? 'fit' : tall ? 'tall' : 'plain';
      /* Flourish repeats this message, and a chart that has been resized
         may ask for a slightly different height. Decide once for a given
         panel size and then hold, or the chart flips between sizes and
         flickers. */
      var key = Math.round(room / 10) + 'x' + Math.round(body.clientWidth / 10);
      if (f._dzKey === key && f._dzMode !== 'plain') {   /* the first report is often a placeholder */
        if (f._dzMode !== 'tall' || Math.abs(h - f._dzH) < 2) return;
        f._dzH = h; f.style.height = h + 'px';      /* a scrolling chart may still grow */
        return;
      }
      f._dzKey = key; f._dzMode = mode; f._dzH = h;
      f.style.height = (fit || tall) ? h + 'px' : '';
      f.style.width = fit ? (body.clientWidth / k) + 'px' : '';
      f.style.transform = fit ? 'scale(' + k + ')' : '';
      body.classList.toggle('is-fit', fit);
      body.classList.toggle('is-tall', tall);
      return;
    }
  });

  function loadChart(scene) {
    if (!scene || !scene.classList.contains('is-chart')) return;
    var body = scene.querySelector('.dz-scene-b');
    if (body.querySelector('iframe')) return;
    var f = document.createElement('iframe');
    f.src = body.getAttribute('data-embed');
    f.title = scene.querySelector('.dz-scene-t').textContent;
    f.setAttribute('frameborder', '0');
    f.setAttribute('scrolling', 'no');
    f.allow = 'autoplay; fullscreen';
    f.setAttribute('sandbox', 'allow-same-origin allow-forms allow-scripts allow-downloads allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation');
    f.addEventListener('load', function () { var l = body.querySelector('.dz-loading'); if (l) l.remove(); });
    body.appendChild(f);
  }

  /* figures count up each time their module comes up; the text is put
     back exactly as written at the end, so "4.2 Crores" stays as it is */
  var NUM = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/;
  function countUp(root) {
    if (!root || reduced) return;
    root.querySelectorAll('[data-count]').forEach(function (n) {
      var text = n.getAttribute('data-count'), m = text.match(NUM);
      if (!m) return;
      var raw = m[2], target = parseFloat(raw.replace(/,/g, ''));
      var dec = (raw.split('.')[1] || '').length, grouped = raw.indexOf(',') !== -1;
      var start = null, ms = 900;
      cancelAnimationFrame(n._raf);
      function frame(ts) {
        if (start === null) start = ts;
        var k = Math.min(1, (ts - start) / ms), v = target * (1 - Math.pow(1 - k, 3));
        n.textContent = k < 1 ? m[1] + (grouped ? indian(v, dec) : v.toFixed(dec)) + m[3] : text;
        if (k < 1) n._raf = requestAnimationFrame(frame);
      }
      n._raf = requestAnimationFrame(frame);
    });
  }

  /* one tooltip for every [data-tip] mark in the panel */
  function wireTips() {
    panel.addEventListener('mousemove', function (e) {
      var t = e.target.closest && e.target.closest('[data-tip]');
      if (!t || !panel.contains(t)) { tip.classList.remove('on'); return; }
      tip.textContent = t.getAttribute('data-tip');
      var r = panel.getBoundingClientRect();
      var x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
      if (x + tip.offsetWidth > r.width - 8) x = e.clientX - r.left - tip.offsetWidth - 14;
      if (y + tip.offsetHeight > r.height - 8) y = e.clientY - r.top - tip.offsetHeight - 14;
      tip.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      tip.classList.add('on');
    });
    panel.addEventListener('mouseleave', function () { tip.classList.remove('on'); });
  }

  Promise.all([
    DataLoader.getStateDetails(),
    DataLoader.getStateDemographics(),
    DataLoader.loadJSON('./Orissa.geojson'),
    DataLoader.loadJSON('datasets/orgi_state_projection.json').catch(function () { return null; }),
    DataLoader.loadJSON('datasets/nfhs6_state_factsheet.json').catch(function () { return null; })
  ]).then(function (r) {
    build(r[0], r[1], r[2], r[3], r[4]);
    sec.classList.add('is-ready');
  }).catch(function (err) {
    if (window.console) console.warn('Dossier: data did not load', err);
    stepsBox.appendChild(el('p', 'dz-fail', 'The state dossier could not load. Please refresh the page.'));
  });
})();
