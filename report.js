/* ─────────────────────────────────────────────────────────────────────
   report.js — the printable report of the whole home page (report.html)

   Builds one document from the same data the home page reads: Odisha at
   a glance (data/key_stats.js), the six-chapter story (its figures come
   from story.js), the twenty modules of the state dossier (dossier.js),
   a table of all 30 districts, and the sources. "Save as PDF" prints it;
   the district table can also be downloaded as a CSV file.

   Nothing in it is typed in by hand: change the data and the report
   follows. Styles: report.css.
   ───────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var main = document.getElementById('report');
  var S = window.SoochanaStoryFigures, Dz = window.SoochanaDossier;
  if (!main || !window.d3 || typeof DataLoader === 'undefined' || !S || !Dz) {
    if (main) main.textContent = 'The report could not be built on this browser. Please try another browser.';
    return;
  }

  /* ── helpers ── */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  /* "a **b** c": text with bold runs, built without innerHTML */
  function rich(node, str) {
    String(str).split('**').forEach(function (part, i) {
      if (part) node.appendChild(i % 2 ? el('b', null, part) : document.createTextNode(part));
    });
    return node;
  }
  function para(parent, str, cls) { return parent.appendChild(rich(el('p', cls), str)); }
  function indian(n, d) { return (+n).toLocaleString('en-IN', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function table(parent, head, rows, cls) {
    var t = parent.appendChild(el('table', 'rp-table' + (cls ? ' ' + cls : '')));
    var tr = t.appendChild(el('thead')).appendChild(el('tr'));
    head.forEach(function (h) { tr.appendChild(el('th', null, h)).setAttribute('scope', 'col'); });
    var tb = t.appendChild(el('tbody'));
    rows.forEach(function (r) {
      var row = tb.appendChild(el('tr'));
      r.forEach(function (c, i) {
        var cell = row.appendChild(el(i ? 'td' : 'th', null, c == null ? '–' : String(c)));
        if (!i) cell.setAttribute('scope', 'row');
      });
    });
    return t;
  }
  /* the files spell three districts differently */
  var ALIASES = [['Bolangir', 'Balangir'], ['Jajpur', 'Jajapur'], ['Nabarangpur', 'Nabarangapur']];
  function pick(obj, name) {
    var v = [name];
    ALIASES.forEach(function (a) { if (a.indexOf(name) !== -1) v = a; });
    for (var i = 0; i < v.length; i++) if (obj[v[i]] != null) return obj[v[i]];
    return null;
  }
  function section(id, num, title, intro) {
    var s = main.appendChild(el('section', 'rp-section'));
    s.id = id;
    s.appendChild(el('div', 'rp-num', num));
    s.appendChild(el('h2', null, title));
    if (intro) para(s, intro, 'rp-intro');
    return s;
  }

  /* "Label: value | Label: value" runs in a module's text, as table rows */
  function figurePairs(slide) {
    var t = String(slide.text_content || '');
    t = t.split(/\bSources?:/)[0].split(/\bNote:/)[0];
    if (t.indexOf(' | ') === -1 && !(slide.table_data && /^[^.]{0,90}:\s*[\d.,%]+\s*$/.test(t.trim()))) return [];
    return t.split(/\s*\|\s*/).map(function (seg) {
      var m = seg.trim().replace(/\.$/, '').match(/^(.*?):\s*([^:]+)$/);
      return m ? [m[1].trim(), m[2].trim()] : null;
    }).filter(Boolean);
  }

  /* ── charts, drawn in ink for paper ── */
  function svg(parent, w, h, label) {
    var s = d3.select(parent).append('svg').attr('viewBox', '0 0 ' + w + ' ' + h)
      .attr('class', 'rp-chart').attr('role', 'img').attr('aria-label', label);
    return s;
  }
  function popChart(parent, series) {
    var fig = parent.appendChild(el('figure', 'rp-fig'));
    var W = 720, H = 300, m = { l: 56, r: 24, t: 20, b: 34 };
    var s = svg(fig, W, H, 'Population of Odisha, 1901 to ' + series[series.length - 1].year);
    var x = d3.scaleLinear().domain(d3.extent(series, function (d) { return d.year; })).range([m.l, W - m.r]);
    var y = d3.scaleLinear().domain([0, d3.max(series, function (d) { return d.total; }) * 1.08]).range([H - m.b, m.t]);
    y.ticks(5).forEach(function (v) {
      s.append('line').attr('class', 'g').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(v)).attr('y2', y(v));
      s.append('text').attr('class', 't').attr('x', m.l - 8).attr('y', y(v) + 4).attr('text-anchor', 'end').text(v / 1e7 + ' cr');
    });
    [series[0].year, 1951, 2011, series[series.length - 1].year].forEach(function (v) {
      s.append('text').attr('class', 't').attr('x', x(v)).attr('y', H - 12).attr('text-anchor', 'middle').text(v);
    });
    var ln = d3.line().x(function (d) { return x(d.year); }).y(function (d) { return y(d.total); }).curve(d3.curveMonotoneX);
    s.append('path').attr('class', 'ln').attr('d', ln(series.filter(function (d) { return !d.proj; })));
    s.append('path').attr('class', 'ln proj').attr('d', ln(series.filter(function (d) { return d.year >= 2011; })));
    series.forEach(function (d) {
      s.append('circle').attr('cx', x(d.year)).attr('cy', y(d.total)).attr('r', 3.2).attr('class', d.proj ? 'pt proj' : 'pt');
    });
    var last = series[series.length - 1], c11 = series.filter(function (d) { return d.year === 2011; })[0];
    [[series[0], 'start', 0], [c11, 'end', -8], [last, 'end', 0]].forEach(function (p) {
      if (!p[0]) return;
      s.append('text').attr('class', 'v').attr('x', x(p[0].year) + p[2]).attr('y', y(p[0].total) - 10).attr('text-anchor', p[1])
        .text((p[0].total / 1e7).toFixed(2) + ' cr');
    });
    s.append('text').attr('class', 't').attr('x', x(2021) + 6).attr('y', y(last.total) + 34).text('dashed: projected');
    fig.appendChild(el('figcaption', null, 'Population of Odisha, ' + series[0].year + '–' + last.year +
      '. Census of India to 2011; DIU population projection (Bayesian approach) after.'));
  }
  function ageChart(parent, A, B) {
    var fig = parent.appendChild(el('figure', 'rp-fig'));
    var W = 720, H = 260, m = { l: 20, r: 20, t: 34, b: 40 };
    var s = svg(fig, W, H, 'Share of the population by age group, 2021 and ' + B.year);
    var groups = ['Children (0–14)', 'Working age (15–59)', 'Elders (60+)'];
    var x0 = d3.scaleBand().domain(groups).range([m.l, W - m.r]).padding(0.28);
    var x1 = d3.scaleBand().domain(['a', 'b']).range([0, x0.bandwidth()]).padding(0.12);
    var y = d3.scaleLinear().domain([0, 75]).range([H - m.b, m.t]);
    var years = [['a', '2021', A, '#2a78d6'], ['b', String(B.year), B, '#eb6834']];
    groups.forEach(function (g, gi) {
      years.forEach(function (yr) {
        var v = yr[2].n[gi], bx = x0(g) + x1(yr[0]);
        s.append('rect').attr('x', bx).attr('y', y(v)).attr('width', x1.bandwidth()).attr('height', y(0) - y(v))
          .attr('rx', 3).attr('fill', yr[3]);
        s.append('text').attr('class', 'v').attr('x', bx + x1.bandwidth() / 2).attr('y', y(v) - 6).attr('text-anchor', 'middle').text(v);
      });
      s.append('text').attr('class', 't').attr('x', x0(g) + x0.bandwidth() / 2).attr('y', H - 14).attr('text-anchor', 'middle').text(g);
    });
    s.append('line').attr('class', 'b').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0)).attr('y2', y(0));
    years.forEach(function (yr, i) {
      s.append('rect').attr('x', m.l + i * 90).attr('y', 6).attr('width', 12).attr('height', 12).attr('rx', 2).attr('fill', yr[3]);
      s.append('text').attr('class', 't').attr('x', m.l + 18 + i * 90).attr('y', 16).text(yr[1]);
    });
    fig.appendChild(el('figcaption', null, 'People in every 100, by age group, 2021 and ' + B.year + '. DIU population projection (Bayesian approach).'));
  }

  /* ── a chart for every module ──────────────────────────────────────
     A module with a Flourish chart shows that chart's published image
     (Flourish serves one for every public chart; an iframe would not
     print). The others get a chart drawn here from the module's own
     figures, the same pictures the home page dossier shows. */
  var BLUE = '#2a78d6', ORANGE = '#eb6834', GOOD = '#0ca30c', BAD = '#d03b3b';
  var N = function (v) { return Dz.num(v); };

  function figure(parent, caption) {
    var fig = parent.appendChild(el('figure', 'rp-fig'));
    fig._cap = caption;
    return fig;
  }
  function caption(fig) { if (fig._cap) fig.appendChild(el('figcaption', null, fig._cap)); }

  /* horizontal bars, labelled at both ends: rows are [label, value, text, colour] */
  function hbars(fig, rows, opt) {
    opt = opt || {};
    var W = 720, rowH = 36, m = { l: opt.lw || 230, r: 86, t: opt.title ? 30 : 6, b: 6 };
    var H = m.t + rows.length * rowH + m.b;
    var s = svg(fig, W, H, opt.title || 'Bar chart');
    var max = opt.max || d3.max(rows, function (r) { return r[1]; });
    var x = d3.scaleLinear().domain([0, max]).range([m.l, W - m.r]);
    if (opt.title) s.append('text').attr('class', 'h').attr('x', 0).attr('y', 17).text(opt.title);
    rows.forEach(function (r, i) {
      var y = m.t + i * rowH;
      s.append('text').attr('class', 'lbl').attr('x', m.l - 12).attr('y', y + rowH / 2 + 5).attr('text-anchor', 'end').text(r[0]);
      s.append('rect').attr('class', 'track').attr('x', m.l).attr('y', y + 8).attr('width', W - m.r - m.l).attr('height', rowH - 16).attr('rx', 3);
      s.append('rect').attr('x', m.l).attr('y', y + 8).attr('width', Math.max(3, x(r[1]) - m.l)).attr('height', rowH - 16)
        .attr('rx', 3).attr('fill', r[3] || BLUE);
      s.append('text').attr('class', 'v').attr('x', x(r[1]) + 8).attr('y', y + rowH / 2 + 5).text(r[2]);
    });
    return s;
  }

  var MODULE_CHARTS = {
    /* the 30 districts, named */
    1: function (fig, x) {
      if (!x.geo) return false;
      var W = 720, H = 560, s = svg(fig, W, H, 'Map of Odisha’s districts');
      var proj = d3.geoMercator().fitExtent([[60, 36], [W - 60, H - 30]], x.geo), path = d3.geoPath(proj);
      x.geo.features.forEach(function (f) { s.append('path').attr('class', 'dist').attr('d', path(f)); });
      x.geo.features.forEach(function (f) {
        var c = path.centroid(f);
        s.append('text').attr('class', 'dn').attr('x', c[0]).attr('y', c[1] + 3).attr('text-anchor', 'middle').text(f.properties.Dist_Name);
      });
      [['Jharkhand', W / 2 - 40, 22, 'middle'], ['West Bengal', W - 20, 40, 'end'], ['Chhattisgarh', 14, H / 2 - 40, 'start'],
       ['Andhra Pradesh', 150, H - 10, 'middle'], ['Bay of Bengal', W - 30, H - 90, 'end']].forEach(function (l) {
        s.append('text').attr('class', l[0] === 'Bay of Bengal' ? 'sea' : 'nb').attr('x', l[1]).attr('y', l[2]).attr('text-anchor', l[3]).text(l[0]);
      });
      fig._cap = 'Odisha’s ' + x.geo.features.length + ' districts and its neighbours.';
    },
    /* the state's area as 100 squares */
    2: function (fig, x) {
      var L = Dz.landCats(x.t, x.areaKha), W = 720, H = 300, cell = 26, gap = 3;
      var s = svg(fig, W, H, 'Land use, as 100 squares of the state');
      var k = 0;
      L.cats.forEach(function (c, ci) {
        for (var i = 0; i < L.n[ci]; i++, k++) {
          s.append('rect').attr('x', (k % 10) * (cell + gap)).attr('y', Math.floor(k / 10) * (cell + gap) + 4)
            .attr('width', cell).attr('height', cell).attr('rx', 3).attr('fill', c.color);
        }
      });
      L.cats.forEach(function (c, ci) {
        var y = 22 + ci * 40;
        s.append('rect').attr('x', 330).attr('y', y - 13).attr('width', 16).attr('height', 16).attr('rx', 3).attr('fill', c.color);
        s.append('text').attr('class', 'big').attr('x', 356).attr('y', y + 2).text(L.n[ci]);
        s.append('text').attr('class', 'lbl').attr('x', 392).attr('y', y + 1).text(c.label + ' · ' + (c.v / 100).toFixed(1) + ' lakh ha');
      });
      fig._cap = 'Land use in 2024, each square one-hundredth of the state’s area. Directorate of Economics and Statistics.';
    },
    /* blocks, gram panchayats, villages, as circles to scale */
    3: function (fig, x) {
      var items = [['blocks', N(x.t.blocks)], ['gram panchayats', N(x.t.gram_panchayats)], ['villages', N(x.t.villages)]];
      if (items.some(function (i) { return i[1] == null; })) return false;
      var W = 720, H = 300, R = 120, max = items[2][1], cx = [150, 330, 540];
      var s = svg(fig, W, H, 'Blocks, gram panchayats and villages, as circles drawn to scale');
      items.forEach(function (it, i) {
        var r = Math.max(4, R * Math.sqrt(it[1] / max));
        s.append('circle').attr('cx', cx[i]).attr('cy', 250 - r).attr('r', r).attr('fill', i === 2 ? ORANGE : BLUE);
        s.append('text').attr('class', 'big').attr('x', cx[i]).attr('y', 276).attr('text-anchor', 'middle').text(indian(it[1]));
        s.append('text').attr('class', 'lbl').attr('x', cx[i]).attr('y', 294).attr('text-anchor', 'middle').text(it[0]);
      });
      fig._cap = 'Each circle’s area is drawn to scale with its count. Census 2011; Government of Odisha.';
    },
    4: function (fig, x) {
      var t = x.t;
      hbars(fig, [['Assembly constituencies', N(t.assembly_constituencies), String(N(t.assembly_constituencies)), ORANGE],
                  ['Tehsils', N(t.tehsils), String(N(t.tehsils))], ['Sub-divisions', N(t.sub_divisions), String(N(t.sub_divisions))],
                  ['Municipal corporations', N(t.municipal_corporations), String(N(t.municipal_corporations))]],
                { title: 'Administrative units (count)' });
      fig._cap = 'Government of Odisha.';
    },
    5: function (fig, x) {
      var t = x.t;
      hbars(fig, [['Scheduled Tribes', N(t.tribal_share_pct), t.tribal_share_pct, ORANGE],
                  ['Living in towns and cities', N(t.urban_population_share), t.urban_population_share]],
                { title: 'Share of the population, 2011 (%)', max: 100 });
      hbars(fig, [['Women', N(t.life_expectancy_female_nfhs5), t.life_expectancy_female_nfhs5 + ' years', ORANGE],
                  ['Men', N(t.life_expectancy_male_nfhs5), t.life_expectancy_male_nfhs5 + ' years']],
                { title: 'Life expectancy at birth (computed from NFHS-5)', max: 80 });
      fig._cap = 'Census 2011; NFHS-5.';
    },
    /* the 62 communities, the PVTGs picked out */
    11: function (fig, x) {
      var run = String(x.slide.text_content || '').split(/\n\n+/).filter(function (p) { return /^\s*1\.\s/.test(p); })[0] || '';
      var names = run.split(/,\s*(?=\d+\.\s)/).map(function (q) { return q.replace(/^\s*\d+\.\s*/, '').trim(); }).filter(Boolean);
      if (!names.length) return false;
      var cols = 16, cell = 30, W = 720, H = Math.ceil(names.length / cols) * cell + 50;
      var s = svg(fig, W, H, names.length + ' tribal communities');
      var nP = 0;
      names.forEach(function (n, i) {
        var pv = /\(PVTG\)/.test(n); if (pv) nP++;
        s.append('circle').attr('cx', (i % cols) * cell + 14).attr('cy', Math.floor(i / cols) * cell + 14).attr('r', 11)
          .attr('fill', pv ? ORANGE : BLUE).append('title').text(n.replace(/\s*\(PVTG\)/, ''));
      });
      var ly = H - 14;
      s.append('circle').attr('cx', 8).attr('cy', ly - 4).attr('r', 7).attr('fill', BLUE);
      s.append('text').attr('class', 'lbl').attr('x', 22).attr('y', ly).text(names.length - nP + ' other communities');
      s.append('circle').attr('cx', 230).attr('cy', ly - 4).attr('r', 7).attr('fill', ORANGE);
      s.append('text').attr('class', 'lbl').attr('x', 244).attr('y', ly).text(nP + ' particularly vulnerable tribal groups (PVTGs)');
      fig._cap = 'One dot for each of Odisha’s ' + names.length + ' Scheduled Tribe communities.';
    },
    /* which way each part of the health picture is moving */
    12: function (fig) {
      var rows = [['Child deaths', 'newborn, infant and under-five', false, 'Falling · good news'],
                  ['Undernutrition', 'stunting, wasting, underweight', false, 'Falling · good news'],
                  ['Anaemia', 'young children and pregnant women', true, 'Rising · a concern']];
      var W = 720, H = rows.length * 62, s = svg(fig, W, H, 'Direction of change in health and nutrition');
      rows.forEach(function (r, i) {
        var y = i * 62 + 30;
        s.append('rect').attr('class', 'track').attr('x', 0).attr('y', y - 26).attr('width', W).attr('height', 54).attr('rx', 10);
        s.append('circle').attr('cx', 32).attr('cy', y + 1).attr('r', 17).attr('fill', r[2] ? BAD : GOOD);
        s.append('text').attr('class', 'arrow').attr('x', 32).attr('y', y + 8).attr('text-anchor', 'middle').text(r[2] ? '↑' : '↓');
        s.append('text').attr('class', 'v').attr('x', 64).attr('y', y - 3).text(r[0]);
        s.append('text').attr('class', 'lbl').attr('x', 64).attr('y', y + 16).text(r[1]);
        s.append('text').attr('class', 'v').attr('x', W - 16).attr('y', y + 6).attr('text-anchor', 'end').text(r[3]);
      });
      fig._cap = 'The direction of change, as the state health profile reads it.';
    },
    /* sub-centres, PHCs, CHCs: a pyramid of care */
    13: function (fig, x) {
      var t = x.t, lv = [['Community health centres', N(t.chcs_2024)], ['Primary health centres', N(t.phcs_2024)], ['Sub-centres', N(t.sub_centres_2024)]];
      if (lv.some(function (l) { return l[1] == null; })) return false;
      var W = 720, H = 220, max = lv[2][1], s = svg(fig, W, H, 'Health facilities by level, 2024');
      lv.forEach(function (l, i) {
        var w = Math.max(14, (W - 40) * l[1] / max), y = i * 70 + 8;
        s.append('rect').attr('x', (W - w) / 2).attr('y', y).attr('width', w).attr('height', 30).attr('rx', 5).attr('fill', i === 2 ? ORANGE : BLUE);
        s.append('text').attr('class', 'v').attr('x', W / 2).attr('y', y + 50).attr('text-anchor', 'middle').text(indian(l[1]) + ' ' + l[0]);
      });
      fig._cap = 'Health facilities in 2024, bar widths to scale. ' + N(t.beds_per_100k_2024) + ' hospital beds per 1,00,000 people. Directorate of Economics and Statistics.';
    },
    16: function (fig, x) {
      var e = x.byNum[17] && x.byNum[17].table_data || {};
      var m = N(e.male_literacy_rate_2011), f = N(e.female_literacy_rate_2011);
      if (m == null || f == null) return false;
      hbars(fig, [['Men', m, e.male_literacy_rate_2011], ['Women', f, e.female_literacy_rate_2011, ORANGE]],
            { title: 'Literacy, Census 2011 (%)', max: 100, lw: 120 });
      fig._cap = 'A gap of ' + (m - f).toFixed(1) + ' percentage points between men and women. Census of India 2011.';
    },
    17: function (fig, x) {
      var t = x.t;
      hbars(fig, [['Preparatory → middle', N(t.transition_preparatory_to_middle_2025_26), t.transition_preparatory_to_middle_2025_26],
                  ['Middle → secondary', N(t.transition_middle_to_secondary_2025_26), t.transition_middle_to_secondary_2025_26],
                  ['Dropout, middle school', N(t.middle_dropout_rate_2025_26), t.middle_dropout_rate_2025_26, ORANGE],
                  ['Dropout, secondary school', N(t.secondary_dropout_rate_2025_26), t.secondary_dropout_rate_2025_26, ORANGE]],
            { title: 'Moving up and dropping out, 2025–26 (%)', max: 100 });
      fig._cap = 'UDISE+ 2025–26.';
    },
    20: function (fig, x) {
      var t = x.t;
      var roads = [['Rural roads', N(t.rural_road_length_km)], ['District roads', N(t.district_road_length_km)],
                   ['Forest roads', N(t.forest_road_length_km)], ['National highways', N(t.national_highway_length_km)]]
        .filter(function (r) { return r[1] != null; }).sort(function (a, b) { return b[1] - a[1]; });
      hbars(fig, roads.map(function (r, i) { return [r[0], r[1], indian(Math.round(r[1])) + ' km', i ? BLUE : ORANGE]; }),
            { title: 'Road length, 2024–25 (km)' });
      fig._cap = t.pct_villages_electrified + ' of inhabited villages electrified; ' + N(t.bank_branches_per_100k) + ' bank branches per 1,00,000 people. Government of Odisha.';
    }
  };

  /* the published image of a module's Flourish chart */
  var pendingImages = [];
  function flourishImage(parent, slide) {
    var id = (String(slide.chart_url).match(/visualisation\/(\d+)/) || [])[1];
    if (!id) return false;
    var fig = parent.appendChild(el('figure', 'rp-fig rp-thumb'));
    var img = fig.appendChild(el('img'));
    img.alt = 'Chart: ' + slide.title;
    img.decoding = 'async';
    pendingImages.push(new Promise(function (done) {
      img.onload = done;
      img.onerror = function () { fig.remove(); done(); };   /* the link below still leads to it */
    }));
    img.src = 'https://public.flourish.studio/visualisation/' + id + '/thumbnail';
    fig.appendChild(el('figcaption', null, 'The portal’s interactive chart, as last published.'));
    return true;
  }

  function moduleChart(parent, slide, x) {
    if (slide.chart_url) return flourishImage(parent, slide);
    var draw = MODULE_CHARTS[slide.slide_num];
    if (!draw) return false;
    var fig = figure(parent);
    var ok;
    try { ok = draw(fig, x); } catch (e) { ok = false; if (window.console) console.warn('Report chart', slide.slide_num, e); }
    if (ok === false || !fig.querySelector('svg')) { fig.remove(); return false; }
    caption(fig);
    return true;
  }

  /* ── the document ── */
  function build(D) {
    var F = S.compute({ state: D.state, learn: D.learn, pop: D.pop, fert: D.fert, nat: D.nat, details: D.details,
                        keyStats: window.SOOCHANA_KEY_STATS });
    var T = F.T, today = new Date();
    var dateText = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    main.textContent = '';

    /* cover */
    var cover = main.appendChild(el('section', 'rp-cover'));
    cover.appendChild(el('div', 'rp-kicker', 'Soochana · Demographic Intelligence Unit, CYSD'));
    cover.appendChild(el('h1', null, 'Odisha: a demographic report'));
    para(cover, 'From numbers to narrative: the state’s population, its changing age structure and its thirty districts, in figures drawn from the Soochana portal.', 'rp-deck');
    var heads = cover.appendChild(el('div', 'rp-heads'));
    [[T.pop21, 'people, 2021 (projected)'], [T.tfrState || '–', 'children per woman (NFHS-5)'],
     [T.el36 + ' in 100', 'aged 60+ by ' + T.ageYear], [String(F.districts.length), 'districts']].forEach(function (h) {
      var d = heads.appendChild(el('div', 'rp-head'));
      d.appendChild(el('b', null, h[0]));
      d.appendChild(el('span', null, h[1]));
    });
    cover.appendChild(el('p', 'rp-meta', 'Generated on ' + dateText + ' from the portal’s data files. ' +
      'Data: Census of India; DIU population projections (Bayesian approach); NFHS-4, 5 and 6; SRS; UDISE+; Government of Odisha.'));

    /* contents */
    var toc = cover.appendChild(el('ol', 'rp-toc'));
    [['glance', 'Odisha at a glance'], ['story', 'The story in six chapters'], ['dossier', 'The state dossier: 20 modules'],
     ['districts', 'The 30 districts'], ['sources', 'Notes and sources']].forEach(function (c) {
      var a = toc.appendChild(el('li')).appendChild(el('a', null, c[1]));
      a.href = '#' + c[0];
    });

    /* 1. at a glance */
    var s1 = section('glance', '1', 'Odisha at a glance', 'The headline figures shown on the home page.');
    var ks = window.SOOCHANA_KEY_STATS;
    (ks && ks.groups || []).forEach(function (g) {
      if (!g.tiles || !g.tiles.length) return;
      s1.appendChild(el('h3', null, g.title));
      table(s1, ['Figure', 'Value', 'Source'], g.tiles.map(function (t) {
        var v = t.parts && t.parts.length ? t.parts.map(function (p) { return p.value + ' ' + (p.label || ''); }).join(' · ')
              : (t.value === 'auto' ? '–' : t.value);
        return [[t.label, t.note].filter(Boolean).join(' · ') || '–', v, t.source || ''];
      }));
    });

    /* 2. the story */
    var s2 = section('story', '2', 'The story in six chapters', 'The scroll story “Odisha, told in 100 people”, as text. Every figure is computed from the data.');
    var CH = [
      ['Who', ['About **' + T.pop21 + '** people live in Odisha (2021 projection). If the state were 100 people, **' + T.rural +
               '** would live in villages and **' + T.urban + '** in towns and cities. **' + T.st + '** would belong to a Scheduled Tribe, against about **' +
               T.stIndia + '** in 100 across India. Odisha, with about ' + T.odOfIndia + ' of India’s people, is home to **' + T.stOfIndia + '** of its tribal population.']],
      ['How we got here', ['In ' + F.first.year + ' the land that is Odisha today held **' + T.pop1901 + '** people, and by 1951 only **' + T.pop1951 +
               '**. The population then grew **' + T.mult5111 + '** times in sixty years, to **' + T.pop2011 + '** at the 2011 Census, and is projected to reach **' +
               T.pop2036 + '** by ' + T.lastYear + '.',
               'Growth peaked at **' + T.peakRate + '** a year in ' + T.peakPeriod + '; by ' + T.tailPeriod + ' it is projected at **' + T.tailRate +
               '**. Between 2011 and 2021 Odisha grew **' + T.decOd + '**, against **' + T.decIn + '** for India.'], 'pop'],
      ['Why it is slowing', ['In ' + T.tfrYearA + ', only **' + T.tfrAboveA + '** of the ' + T.tfrN + ' districts had fertility above the replacement level of 2.1 children per woman. The highest was **' +
               T.tfrHiA + '**, the lowest **' + T.tfrLoA + '**. By ' + T.tfrYearB + ', the projections put **' + T.tfrBelowB + '** districts below replacement; the exceptions are **' +
               T.tfrAboveB + '**. The state’s rate is **' + (T.tfrState || '–') + '** (NFHS-5).']],
      ['What it does', ['In 2021, of every 100 people **' + T.ch21 + '** were children under 15, **' + T.wk21 + '** of working age and **' + T.el21 +
               '** aged 60 or more. By ' + T.ageYear + ' the projection is **' + T.ch36 + '**, **' + T.wk36 + '** and **' + T.el36 +
               '**. People aged 60 and over rise from **' + T.el21abs + '** to **' + T.el36abs + '**, an increase of **' + T.elGrow + '**.'], 'age'],
      ['Where', ['Scheduled Tribes make up most of the population in **' + T.stTop + '**, and very little of it in **' + T.stLow + '**. Literacy runs from **' +
               T.litMax + '** to **' + T.litMin + '**, a gap of **' + T.litGap + '** points. By 2036 the oldest district is projected to be **' + T.oldMax +
               '** (share aged 60+), the youngest **' + T.oldMin + '**.']],
      ['What it asks', ['**Fewer children**: schools that compete on quality, not on seats. **A working-age peak**: jobs and skills while the window is open. **More elders**: pensions, health and care, planned from now on.',
               'And because every district runs on its own clock, the plans have to start district by district.']]
    ];
    CH.forEach(function (c, i) {
      var block = s2.appendChild(el('div', 'rp-chapter'));
      block.appendChild(el('h3', null, 'Chapter ' + (i + 1) + ' · ' + c[0]));
      c[1].forEach(function (p) { para(block, p); });
      if (c[2] === 'pop') popChart(block, F.series);
      if (c[2] === 'age') ageChart(block, F.ageA, F.ageB);
    });
    s2.appendChild(el('h3', null, 'The figures behind the story'));
    table(s2, ['Figure', 'Value', 'Source'], F.rows);

    /* 3. the dossier */
    var s3 = section('dossier', '3', 'The state dossier: 20 modules', 'The modules of the home page’s state dossier, chapter by chapter. Interactive charts are linked; open them on the portal.');
    var byNum = {};
    var slides = D.details && D.details.Odisha && D.details.Odisha.slides_detail || [];
    slides.forEach(function (s) { byNum[s.slide_num] = s; });
    var area = Dz.num(byNum[3] && byNum[3].table_data && byNum[3].table_data.area_sq_km) || 155707;
    var ctx = { byNum: byNum, p: Dz.popFacts(D.state, D.fert), areaKha: area / 10, tfrState: T.tfrState, geo: D.geo };
    var listed = [], k = 0;
    Dz.CHAPTERS.forEach(function (c) {
      var mods = c.mods.filter(function (n) { return byNum[n]; });
      if (!mods.length) return;
      s3.appendChild(el('h3', 'rp-chap', c.name));
      mods.forEach(function (n) { listed.push(n); module(s3, byNum[n], ++k); });
    });
    slides.forEach(function (s) { if (listed.indexOf(s.slide_num) === -1) module(s3, s, ++k); });

    function module(parent, s, i) {
      var m = parent.appendChild(el('article', 'rp-module'));
      m.appendChild(el('h4', null, pad(i) + ' · ' + s.title));
      var x = Object.create(ctx); x.slide = s; x.t = s.table_data || {};
      var lead = null;
      try { lead = Dz.LEADS[s.slide_num] ? Dz.LEADS[s.slide_num](x) : null; } catch (e) { lead = null; }
      var txt = Dz.splitText(s);
      (lead && lead.length ? lead : txt.body).forEach(function (p) { para(m, p); });
      moduleChart(m, s, x);
      var pairs = figurePairs(s);
      if (pairs.length) table(m, ['Figure', 'Value'], pairs, 'rp-pairs');
      if (s.table_data && s.table_data.pvtg_names) {
        para(m, '**Particularly vulnerable tribal groups (' + s.table_data.pvtg_count + '):** ' + s.table_data.pvtg_names + '.');
      }
      if (s.chart_url) {
        var c = m.appendChild(el('p', 'rp-link'));
        c.appendChild(document.createTextNode('Interactive chart: '));
        var a = c.appendChild(el('a', null, s.chart_url));
        a.href = s.chart_url; a.target = '_blank'; a.rel = 'noopener';
      }
      var src = [txt.source && 'Source: ' + txt.source, txt.note && 'Note: ' + txt.note].filter(Boolean).join(' · ');
      if (src) m.appendChild(el('p', 'rp-src', src));
    }

    /* 4. districts */
    var s4 = section('districts', '4', 'The 30 districts', 'One row per district, alphabetical. Population 2021 is projected; growth is 2011–21. Fertility is the DIU district projection.');
    var head = ['District', 'Population 2011', 'Population 2021', 'Growth 2011–21', 'TFR 2020', 'TFR 2036', 'Literacy 2011', 'Scheduled Tribes', 'Urban', 'Aged 60+ in 2036'];
    var rows = F.districts.map(function (d) {
      var p = pick(D.pop, d.name) || {}, f = pick(D.fert, d.name) || {};
      var a = p['2011'] && p['2011'].total, b = p['2021'] && p['2021'].total;
      return [d.name, a ? indian(a) : null, b ? indian(b) : null, a && b ? ((b - a) / a * 100).toFixed(1) + '%' : null,
              f['2020'] != null ? (+f['2020']).toFixed(2) : null, f['2036'] != null ? (+f['2036']).toFixed(2) : null,
              d.f.literacy + '%', d.f.tribal_pct + '%', d.f.urban_pct + '%', d.f.elderly_pct_2036 + '%'];
    });
    table(s4, head, rows, 'rp-wide');
    csvRows = [head].concat(rows);

    /* 5. sources */
    var s5 = section('sources', '5', 'Notes and sources');
    [
      'Population 1901–2011: Census of India. 2021–2036: DIU population projection (Bayesian approach), with ORGI projections for the state comparisons.',
      'Age structure: DIU population projection by five-year age group, 2011–2036.',
      'Fertility: NFHS-5 (2019–21) for the state; DIU district projections (Bayesian approach) for 2020–2036. The district file’s NFHS-4 column was not used: it lists Cuttack as the highest district (2.84), which does not match published NFHS-4 figures.',
      'District indicators (literacy, urban and tribal shares): Census of India 2011.',
      'State dossier modules: Directorate of Economics and Statistics, Government of Odisha; UDISE+; NFHS; Census of India, as named under each module.',
      'Prepared by the Demographic Intelligence Unit (DIU), CYSD, with technical support from UNFPA Odisha. The interactive version is at the Soochana portal home page.'
    ].forEach(function (t) { s5.appendChild(el('p', null, t)); });

    document.title = 'Odisha demographic report · ' + dateText + ' · Soochana';
    document.body.classList.add('is-ready');
  }

  /* ── buttons ── */
  var csvRows = null;
  function csv() {
    if (!csvRows) return;
    var text = csvRows.map(function (r) {
      return r.map(function (c) {
        var v = c == null ? '' : String(c).replace(/,(?=\d{2,3}(\D|$))/g, '');   /* 1,23,456 → 123456 */
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }).join('\r\n');
    var url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
    var a = document.createElement('a');
    a.href = url; a.download = 'odisha-districts-soochana.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  var bPrint = document.getElementById('rpPrint'), bCsv = document.getElementById('rpCsv');
  if (bPrint) bPrint.addEventListener('click', function () { window.print(); });
  if (bCsv) bCsv.addEventListener('click', csv);
  /* report.html?print opens the print dialog once the report is built */
  var autoPrint = /[?&]print\b/.test(location.search);

  Promise.all([
    DataLoader.getStateDemographics(),
    DataLoader.loadJSON('learn/data/districts.json'),
    DataLoader.getDistrictPopulationTrends(),
    DataLoader.getDistrictFertilityTrends(),
    DataLoader.getNationalComparisons(),
    DataLoader.getStateDetails(),
    DataLoader.loadJSON('./Orissa.geojson').catch(function () { return null; })
  ]).then(function (r) {
    build({ state: r[0], learn: r[1], pop: r[2], fert: r[3], nat: r[4], details: r[5], geo: r[6] });
    /* print only once the chart images are in, or after 8 seconds at most */
    if (autoPrint) {
      Promise.race([Promise.all(pendingImages), new Promise(function (ok) { setTimeout(ok, 8000); })])
        .then(function () { setTimeout(function () { window.print(); }, 300); });
    }
  }).catch(function (err) {
    if (window.console) console.warn('Report:', err);
    main.textContent = 'The report could not load the portal’s data. Please refresh the page.';
  });
})();
