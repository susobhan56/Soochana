/* ═══════════════════════════════════════════════════════════════════
   planning.js — District Planning Lens (planning.html)
   Data: datasets/unfpa_district_projections.json (tools/build_unfpa_projections.py)
         Orissa.geojson
   One place is shown at a time, Odisha or a district; the map's group
   switch is separate. Both are kept in the address (#place=…&group=…)
   so a view can be shared.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var YEARS = ['2021', '2026'];
  var SEXES = ['total', 'male', 'female'];
  var ODISHA = 'Odisha';
  // boundary file spellings -> dataset spellings
  var GEO_NAMES = { Balangir: 'Bolangir', Nabarangapur: 'Nabarangpur' };

  /* The six planning groups. `get` reads one year of a place. */
  var GROUPS = {
    u1:    { name: 'Infants, under 1', short: 'Under 1', serves: 'Immunisation, institutional births, maternity benefits',
             get: function (y) { return y.age['0'].total; } },
    u6:    { name: 'Anganwadi age, 0–5', short: 'Under 6', serves: 'Anganwadi centres, ICDS nutrition, pre-school',
             get: function (y) { return sumAges(y, 0, 5); } },
    s614:  { name: 'School age, 6–14', short: 'School age 6–14', serves: 'Elementary schools, teachers, mid-day meals',
             get: function (y) { return y.groups['6-14'].total; } },
    youth: { name: 'Young people, 15–24', short: 'Young people 15–24', serves: 'Higher secondary, colleges, skills, first jobs',
             get: function (y) { return y.age['15-19'].total + y.age['20-24'].total; } },
    ew:    { name: 'Eligible women, 15–49', short: 'Eligible women', serves: 'Family planning and maternal health services',
             get: function (y) { return y.eligible; } },
    e60:   { name: 'Older people, 60+', short: 'Aged 60+', serves: 'Pensions, geriatric and chronic-disease care',
             get: function (y) { return y.groups['60+'].total; } },
    all:   { name: 'Everyone', short: 'Everyone', serves: '',
             get: function (y) { return y.total.total; } }
  };
  var TILE_KEYS = ['u1', 'u6', 's614', 'youth', 'ew', 'e60'];
  var MAP_KEYS = ['u6', 's614', 'youth', 'ew', 'e60', 'all'];

  var STAGES = [
    { name: 'Anganwadi', a: 0, b: 5 },
    { name: 'Primary', a: 6, b: 10 },
    { name: 'Upper primary', short: 'Upper pr.', a: 11, b: 13 },
    { name: 'Class 9', short: '9', a: 14, b: 14 }
  ];
  var ENTRY = { 6: 'class 1 entry age', 11: 'class 6 entry age', 14: 'class 9 entry age' };

  var $ = function (id) { return document.getElementById(id); };
  var css = getComputedStyle(document.documentElement);
  var C = {
    fall: css.getPropertyValue('--pl-fall').trim() || '#c2570c',
    mid: css.getPropertyValue('--pl-mid').trim() || '#e5e3dc',
    rise: css.getPropertyValue('--pl-rise').trim() || '#009490'
  };

  var places = {};   // name -> { '2021': year, '2026': year }
  var names = [];    // district names, sorted
  var geo = null;
  var state = { place: ODISHA, group: 'e60' };

  /* ── formatting ── */
  function fmt(n) { return Math.round(n).toLocaleString('en-IN'); }
  function change(a, b) { return (b - a) / a * 100; }
  function pct(v, dp) {
    var s = Math.abs(v).toFixed(dp == null ? 1 : dp);
    if (+s === 0) return '0%';
    return (v > 0 ? '+' : '−') + s + '%';
  }
  function signed(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n)); }
  function sumAges(y, lo, hi) {
    var s = 0;
    for (var a = lo; a <= hi; a++) s += y.age[String(a)].total;
    return s;
  }

  /* ── data: one year of a place, keyed by age label ── */
  function yearOf(p) {
    var age = {};
    p.ages.forEach(function (r) { age[r.age] = r; });
    return { age: age, ages: p.ages, groups: p.groups, eligible: p.eligible_women_15_49 };
  }

  function addInto(acc, row) {
    SEXES.forEach(function (s) { acc[s] = (acc[s] || 0) + row[s]; });
    return acc;
  }

  function prepare(data) {
    names = Object.keys(data.districts).sort();
    var sum = {};
    YEARS.forEach(function (yr) {
      sum[yr] = { ages: [], groups: {}, eligible_women_15_49: 0, total: {} };
    });
    names.forEach(function (d) {
      var src = data.districts[d];
      places[d] = {};
      YEARS.forEach(function (yr) {
        var p = src.projection[yr];
        var y = yearOf(p);
        y.total = src.series[yr];
        places[d][yr] = y;
        // Odisha = the 30 districts added up
        var o = sum[yr];
        p.ages.forEach(function (r, i) {
          if (!o.ages[i]) o.ages[i] = { age: r.age };
          addInto(o.ages[i], r);
        });
        Object.keys(p.groups).forEach(function (g) { o.groups[g] = addInto(o.groups[g] || {}, p.groups[g]); });
        o.eligible_women_15_49 += p.eligible_women_15_49;
        addInto(o.total, src.series[yr]);
      });
    });
    places[ODISHA] = {};
    YEARS.forEach(function (yr) {
      var y = yearOf(sum[yr]);
      y.total = sum[yr].total;
      places[ODISHA][yr] = y;
    });
  }

  function value(place, key, yr) { return GROUPS[key].get(places[place][yr]); }
  function changeOf(place, key) { return change(value(place, key, '2021'), value(place, key, '2026')); }

  /* ── the address ── */
  function readHash() {
    var q = new URLSearchParams(location.hash.slice(1));
    var p = q.get('place'), g = q.get('group');
    if (p && places[p]) state.place = p;
    if (g && GROUPS[g] && MAP_KEYS.indexOf(g) !== -1) state.group = g;
  }
  function writeHash() {
    var q = new URLSearchParams();
    if (state.place !== ODISHA) q.set('place', state.place);
    if (state.group !== 'e60') q.set('group', state.group);
    var h = q.toString();
    history.replaceState(null, '', h ? '#' + h : location.pathname + location.search);
  }

  /* ── tooltip ── */
  var tip = $('plTip');
  function showTip(ev, html) {
    tip.innerHTML = html;
    tip.hidden = false;
    var r = tip.getBoundingClientRect();
    var x = ev.clientX + 14, y = ev.clientY + 14;
    if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14;
    if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 14;
    tip.style.left = Math.max(8, x) + 'px';
    tip.style.top = Math.max(8, y) + 'px';
  }
  function hideTip() { tip.hidden = true; }

  /* ── place picker ── */
  function buildPicker() {
    var sel = $('plPlace');
    var opt = document.createElement('option');
    opt.value = ODISHA;
    opt.textContent = 'Odisha (all 30 districts)';
    sel.appendChild(opt);
    var grp = document.createElement('optgroup');
    grp.label = 'Districts';
    names.forEach(function (d) {
      var o = document.createElement('option');
      o.value = d;
      o.textContent = d;
      grp.appendChild(o);
    });
    sel.appendChild(grp);
    sel.addEventListener('change', function () { pick(sel.value); });
  }

  function pick(place) {
    if (!places[place] || place === state.place) return;
    state.place = place;
    writeHash();
    renderPlace();
    renderMap();
    renderRank();
  }

  /* ── 1 · tiles ── */
  function delta(v) {
    var cls = Math.abs(v) < 0.05 ? 'flat' : v > 0 ? 'up' : 'down';
    var word = cls === 'flat' ? 'no change' : v > 0 ? 'more' : 'fewer';
    return '<span class="pl-delta ' + cls + '"><i aria-hidden="true"></i>' + pct(v) + ' <span>' + word + '</span></span>';
  }

  function renderTiles() {
    var p = state.place;
    $('plTiles').innerHTML = TILE_KEYS.map(function (k) {
      var g = GROUPS[k], a = value(p, k, '2021'), b = value(p, k, '2026');
      return '<div class="pl-tile">' +
        '<div class="pl-tile-k">' + g.name + '</div>' +
        '<div class="pl-tile-for">' + g.serves + '</div>' +
        '<div class="pl-tile-v">' + fmt(b) + '</div>' +
        '<div class="pl-tile-was">from ' + fmt(a) + ' in 2021</div>' +
        delta(change(a, b)) +
      '</div>';
    }).join('');
  }

  /* ── 2 · cohort pipeline ── */
  function pipelineRows(place) {
    var rows = [];
    for (var a = 0; a <= 14; a++) {
      rows.push({ age: a, v21: places[place]['2021'].age[String(a)].total, v26: places[place]['2026'].age[String(a)].total });
    }
    return rows;
  }

  function renderPipeline() {
    var box = $('plPipe');
    var rows = pipelineRows(state.place);
    var W = Math.max(300, box.clientWidth);
    var H = W < 560 ? 300 : 340;
    var m = { t: 46, r: 6, b: 40, l: W < 560 ? 40 : 52 };
    var ages = rows.map(function (r) { return r.age; });
    // Dots, not bars, so the axis can leave out zero and show the change.
    var x = d3.scaleBand(ages, [m.l, W - m.r]).paddingInner(0.2).paddingOuter(0.04);
    var lo = d3.min(rows, function (r) { return Math.min(r.v21, r.v26); });
    var hi = d3.max(rows, function (r) { return Math.max(r.v21, r.v26); });
    var pad = (hi - lo) * 0.12 || hi * 0.05;
    var y = d3.scaleLinear([Math.max(0, lo - pad), hi + pad], [H - m.b, m.t]).nice();
    var bw = x.bandwidth(), cx = function (r) { return x(r.age) + bw / 2; };
    var R = W < 560 ? 4.5 : 5.5;

    var svg = d3.select(box).selectAll('svg').data([0]).join('svg');
    svg.attr('viewBox', '0 0 ' + W + ' ' + H).selectAll('*').remove();

    // grid and y axis
    var ticks = y.ticks(4);
    svg.append('g').selectAll('line').data(ticks).join('line')
      .attr('class', 'pl-gridline').attr('x1', m.l).attr('x2', W - m.r)
      .attr('y1', function (d) { return y(d); }).attr('y2', function (d) { return y(d); });
    svg.append('g').attr('class', 'pl-axis').selectAll('text').data(ticks).join('text')
      .attr('x', m.l - 8).attr('y', function (d) { return y(d); }).attr('dy', '0.32em').attr('text-anchor', 'end')
      .text(function (d) { return d === 0 ? '0' : d3.format('~s')(d); });

    // school stages, as brackets over the columns
    var st = svg.append('g').attr('class', 'pl-stage');
    STAGES.forEach(function (s) {
      var x0 = x(s.a) + 1, x1 = x(s.b) + bw - 1, yy = m.t - 18;
      st.append('line').attr('x1', x0).attr('x2', x1).attr('y1', yy).attr('y2', yy);
      st.append('line').attr('x1', x0).attr('x2', x0).attr('y1', yy).attr('y2', yy + 5);
      st.append('line').attr('x1', x1).attr('x2', x1).attr('y1', yy).attr('y2', yy + 5);
      var t = st.append('text').attr('x', (x0 + x1) / 2).attr('y', yy - 6).attr('text-anchor', 'middle').text(s.name);
      if (s.short && t.node().getComputedTextLength() > x1 - x0 + 8) t.text(s.short);
    });

    // columns: highlight, bars, hit area
    var hl = svg.append('rect').attr('class', 'pl-col-hl').attr('y', m.t - 4).attr('height', H - m.b - m.t + 4)
      .attr('width', bw + 6).attr('rx', 6).attr('opacity', 0);
    var marks = svg.append('g');
    marks.selectAll('.pl-stem').data(rows).join('line').attr('class', 'pl-stem')
      .attr('x1', cx).attr('x2', cx)
      .attr('y1', function (r) { return y(r.v21); }).attr('y2', function (r) { return y(r.v26); });
    var b21 = marks.selectAll('.pl-dot21').data(rows).join('circle').attr('class', 'pl-dot21')
      .attr('cx', cx).attr('cy', function (r) { return y(r.v21); }).attr('r', R);
    marks.selectAll('.pl-dot26').data(rows).join('circle').attr('class', 'pl-dot26')
      .attr('cx', cx).attr('cy', function (r) { return y(r.v26); }).attr('r', R);

    // direct labels on the first age, beside its two dots
    var first = rows[0], up = first.v26 < first.v21;
    [['2021', first.v21, up ? -1 : 1], ['2026', first.v26, up ? 1 : -1]].forEach(function (l) {
      svg.append('text').attr('class', 'pl-direct').attr('x', cx(first) + R + 5)
        .attr('y', y(l[1]) + l[2] * 4).attr('dy', l[2] < 0 ? '-0.1em' : '0.8em').text(l[0]);
    });

    // x axis
    svg.append('g').attr('class', 'pl-axis').selectAll('text').data(rows).join('text')
      .attr('x', function (r) { return x(r.age) + bw / 2; }).attr('y', H - m.b + 16).attr('text-anchor', 'middle')
      .text(function (r) { return r.age; });
    svg.append('g').attr('class', 'pl-axis').append('text').attr('x', W - m.r).attr('y', H - 2)
      .attr('text-anchor', 'end').text('Age in completed years');

    var link = svg.append('path').attr('class', 'pl-cohort-link').attr('opacity', 0);

    svg.append('g').selectAll('rect').data(rows).join('rect').attr('class', 'pl-col-hit')
      .attr('x', function (r) { return x(r.age) - (x.step() - bw) / 2; }).attr('width', x.step())
      .attr('y', m.t - 20).attr('height', H - m.b - m.t + 20 + 22)
      .on('pointerenter pointermove', function (ev, r) {
        hl.attr('x', x(r.age) - 3).attr('opacity', 1);
        var back = r.age >= 5 ? rows[r.age - 5] : null;
        b21.classed('is-cohort', function (d) { return back && d.age === back.age; });
        if (back) {
          var sx = cx(back), sy = y(back.v21) - R - 2;
          var ex = cx(r), ey = y(r.v26) - R - 2;
          var top = Math.max(m.t - 6, Math.min(sy, ey) - 30);
          link.attr('d', 'M' + sx + ',' + sy + 'C' + sx + ',' + top + ' ' + ex + ',' + top + ' ' + ex + ',' + ey).attr('opacity', 1);
        } else {
          link.attr('opacity', 0);
        }
        var html = '<b>Age ' + r.age + '</b>' + (ENTRY[r.age] ? ' · ' + ENTRY[r.age] : '') +
          '<br><span class="k">2021</span> ' + fmt(r.v21) +
          '<br><span class="k">2026</span> ' + fmt(r.v26) + ' (' + pct(change(r.v21, r.v26)) + ')<hr>';
        html += back
          ? 'In 2021 these children were aged ' + back.age + ': ' + fmt(back.v21) + '. Five years on: ' + pct(change(back.v21, r.v26)) + '.'
          : 'Born after the 2021 projection date, so not yet counted then.';
        showTip(ev, html);
      })
      .on('pointerleave', function () {
        hl.attr('opacity', 0);
        link.attr('opacity', 0);
        b21.classed('is-cohort', false);
        hideTip();
      });

    renderPipeTable(rows);
    renderInsight(rows);
  }

  function renderPipeTable(rows) {
    var fig = $('plPipe').parentNode;
    var det = fig.querySelector('details') || fig.appendChild(document.createElement('details'));
    det.className = 'pl-details';
    det.innerHTML = '<summary>Show these numbers as a table</summary><div class="pl-tablewrap"><table class="pl-table">' +
      '<thead><tr><th scope="col">Age</th><th scope="col">2021</th><th scope="col">2026</th><th scope="col">Change %</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><th scope="row">' + r.age + (ENTRY[r.age] ? ' <small>' + ENTRY[r.age] + '</small>' : '') + '</th><td>' + fmt(r.v21) + '</td><td>' + fmt(r.v26) +
          '</td><td>' + pct(change(r.v21, r.v26)) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderInsight(rows) {
    var six = rows[6], u6a = value(state.place, 'u6', '2021'), u6b = value(state.place, 'u6', '2026');
    var c = change(six.v21, six.v26);
    var where = state.place === ODISHA ? 'Odisha' : state.place;
    var more = c >= 0 ? 'more than' : 'fewer than';
    $('plPipeInsight').innerHTML = 'In ' + where + ', <b>' + fmt(six.v26) + '</b> children will be six and ready for class 1 in 2026, ' +
      more + ' the ' + fmt(six.v21) + ' of 2021 (' + pct(c) + '). Children under six change by <b>' + pct(change(u6a, u6b)) + '</b>.';
  }

  /* ── 3 · need-gap map ── */
  function buildMetric() {
    var seg = $('plMetric');
    seg.innerHTML = MAP_KEYS.map(function (k) {
      return '<button type="button" role="radio" data-k="' + k + '">' + GROUPS[k].short + '</button>';
    }).join('');
    seg.addEventListener('click', function (ev) {
      var b = ev.target.closest('button');
      if (b) setGroup(b.getAttribute('data-k'), false);
    });
    seg.addEventListener('keydown', function (ev) {
      var dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[ev.key];
      if (!dir) return;
      ev.preventDefault();
      var i = (MAP_KEYS.indexOf(state.group) + dir + MAP_KEYS.length) % MAP_KEYS.length;
      setGroup(MAP_KEYS[i], true);
    });
  }

  function setGroup(k, focus) {
    state.group = k;
    writeHash();
    syncMetric(focus);
    renderMap();
    renderRank();
  }

  function syncMetric(focus) {
    Array.prototype.forEach.call($('plMetric').children, function (b) {
      var on = b.getAttribute('data-k') === state.group;
      b.setAttribute('aria-checked', on);
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    $('plMetricName').textContent = GROUPS[state.group].name;
  }

  function colorScale() {
    var vals = names.map(function (d) { return changeOf(d, state.group); });
    var m = Math.max(2, d3.max(vals, Math.abs));
    m = Math.ceil(m);
    var interp = d3.piecewise(d3.interpolateLab, [C.fall, C.mid, C.rise]);
    return { scale: d3.scaleDiverging([-m, 0, m], interp), m: m, vals: vals };
  }

  function renderMap() {
    if (!geo) return;
    var box = $('plMap');
    var W = Math.max(280, box.clientWidth), H = Math.round(W * 0.92);
    var proj = d3.geoMercator().fitExtent([[6, 6], [W - 6, H - 6]], geo);
    var path = d3.geoPath(proj);
    var cs = colorScale();

    var svg = d3.select(box).selectAll('svg').data([0]).join('svg').attr('viewBox', '0 0 ' + W + ' ' + H);
    var key = function (f) { var n = f.properties.Dist_Name; return GEO_NAMES[n] || n; };

    svg.selectAll('path').data(geo.features, key).join('path')
      .attr('d', path)
      .attr('fill', function (f) { var d = key(f); return places[d] ? cs.scale(changeOf(d, state.group)) : '#ddd'; })
      .classed('is-picked', function (f) { return key(f) === state.place; })
      .on('pointerenter pointermove', function (ev, f) {
        var d = key(f), g = state.group;
        var a = value(d, g, '2021'), b = value(d, g, '2026');
        showTip(ev, '<b>' + d + '</b><br><span class="k">' + GROUPS[g].name + '</span><br>' +
          fmt(a) + ' → ' + fmt(b) + ' (' + pct(change(a, b)) + ')<hr>Click to see this district.');
      })
      .on('pointerleave', hideTip)
      .on('click', function (ev, f) { hideTip(); pick(key(f)); });
    svg.selectAll('path.is-picked').raise();

    var stops = d3.range(0, 1.01, 0.1).map(function (t) { return cs.scale(-cs.m + 2 * cs.m * t) + ' ' + (t * 100) + '%'; });
    $('plRamp').innerHTML = '<div class="pl-ramp-bar" style="background:linear-gradient(90deg,' + stops.join(',') + ')"></div>' +
      '<div class="pl-ramp-k"><span>' + pct(-cs.m, 0) + ' fewer</span><span>0</span><span>' + pct(cs.m, 0) + ' more</span></div>';
  }

  function renderRank() {
    var cs = colorScale();
    var rows = names.map(function (d, i) { return { d: d, v: cs.vals[i] }; })
      .sort(function (a, b) { return b.v - a.v; });
    var lo = Math.min(0, d3.min(rows, function (r) { return r.v; }));
    var hi = Math.max(0, d3.max(rows, function (r) { return r.v; }));
    var pos = function (v) { return (v - lo) / (hi - lo) * 100; };
    var z = pos(0);
    var od = changeOf(ODISHA, state.group);
    $('plMetricName').textContent = GROUPS[state.group].name + ' (Odisha ' + pct(od) + ')';
    $('plRank').innerHTML = rows.map(function (r) {
      var left = Math.min(pos(r.v), z), width = Math.abs(pos(r.v) - z);
      return '<li><button type="button" data-d="' + r.d + '" aria-pressed="' + (r.d === state.place) + '">' +
        '<span class="pl-rank-name">' + r.d + '</span>' +
        '<span class="pl-rank-track" aria-hidden="true"><span class="pl-rank-zero" style="left:' + z + '%"></span>' +
        '<span class="pl-rank-bar' + (r.v < 0 ? ' neg' : '') + '" style="left:' + left + '%;width:' + width + '%;background:' + cs.scale(r.v) + '"></span></span>' +
        '<span class="pl-rank-v">' + pct(r.v) + '</span></button></li>';
    }).join('');
  }

  /* ── 4 · table and CSV ── */
  function tableRows(place) {
    var Y = places[place];
    function women(yr) {
      return ['15-19', '20-24', '25-29', '30-34', '35-39', '40-44', '45-49']
        .reduce(function (s, a) { return s + Y[yr].age[a].female; }, 0);
    }
    function g(label, f, total) { return { label: label, a: f(Y['2021']), b: f(Y['2026']), total: !!total }; }
    return [
      g('Infants, under 1', GROUPS.u1.get),
      g('Anganwadi age, 0–5', GROUPS.u6.get),
      g('Children, 0–14', function (y) { return y.groups['0-14'].total; }),
      g('School age, 6–14', GROUPS.s614.get),
      g('Young people, 15–24', GROUPS.youth.get),
      g('Working age, 15–59', function (y) { return y.groups['15-59'].total; }),
      { label: 'All women, 15–49', a: women('2021'), b: women('2026') },
      g('Eligible women, 15–49', GROUPS.ew.get),
      g('Older people, 60+', GROUPS.e60.get),
      g('Everyone', GROUPS.all.get, true)
    ];
  }

  function renderTable() {
    $('plTable').tBodies[0].innerHTML = tableRows(state.place).map(function (r) {
      return '<tr' + (r.total ? ' class="is-total"' : '') + '><th scope="row">' + r.label + '</th><td>' + fmt(r.a) + '</td><td>' + fmt(r.b) +
        '</td><td>' + signed(r.b - r.a) + '</td><td>' + pct(change(r.a, r.b)) + '</td></tr>';
    }).join('');
  }

  function downloadCsv() {
    var p = state.place;
    var q = function (s) { return '"' + String(s).replace(/"/g, '""') + '"'; };
    var lines = [['Place', 'Group', '2021', '2026', 'Change', 'Change %'].map(q).join(',')];
    tableRows(p).forEach(function (r) {
      lines.push([q(p), q(r.label), r.a, r.b, r.b - r.a, (change(r.a, r.b)).toFixed(2)].join(','));
    });
    pipelineRows(p).forEach(function (r) {
      lines.push([q(p), q('Age ' + r.age), r.v21, r.v26, r.v26 - r.v21, change(r.v21, r.v26).toFixed(2)].join(','));
    });
    lines.push('');
    lines.push(q('Source: UNFPA, District Level Population Projections in Selected States of India – 2021 & 2026 (2022). Odisha = sum of 30 districts.'));
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'soochana-planning-' + p.toLowerCase().replace(/\s+/g, '-') + '-2021-2026.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  /* ── put it together ── */
  function renderPlace() {
    var label = state.place === ODISHA ? 'Odisha' : state.place;
    $('plPlace').value = state.place;
    $('plPlaceHead').textContent = label;
    $('plPlaceTable').textContent = label;
    renderTiles();
    renderPipeline();
    renderTable();
  }

  function start(data, geoData) {
    prepare(data);
    geo = geoData;
    readHash();
    buildPicker();
    buildMetric();
    syncMetric(false);
    renderPlace();
    renderMap();
    renderRank();
    $('plStatus').textContent = '';

    $('plRank').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-d]');
      if (b) pick(b.getAttribute('data-d'));
    });
    $('plCsv').addEventListener('click', downloadCsv);
    addEventListener('hashchange', function () {
      var before = state.place + state.group;
      readHash();
      if (state.place + state.group === before) return;
      syncMetric(false);
      renderPlace();
      renderMap();
      renderRank();
    });
    var t;
    addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () { renderPipeline(); renderMap(); }, 150);
    });
  }

  Promise.all([
    d3.json('datasets/unfpa_district_projections.json'),
    d3.json('Orissa.geojson').catch(function () { return null; })
  ]).then(function (r) {
    start(r[0], r[1]);
    if (!r[1]) $('plStatus').textContent = 'The district map could not be loaded; the ranking below still works.';
  }).catch(function (err) {
    var s = $('plStatus');
    s.textContent = 'The projections could not be loaded. If you opened this file directly, serve the folder over http instead.';
    s.classList.add('is-error');
    if (window.console) console.error(err);
  });
})();
