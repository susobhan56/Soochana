/* ═══════════════════════════════════════════════════════════════════
   TECTONICS — the story engine, shared by every story page.
   A page loads its own tectonics-sN.js first (window.TK_STORY: the
   numbers and words), then this file, which draws whatever the page
   has room for: the plates, guess-first islands, multiple-choice
   guesses, a slope chart, an age pyramid, a district map, a district
   scatter, search traces, the collision and the season list.
   Scenes move with the arrows, the chapter rail, the keyboard and the
   URL hash. The search traces read Google Trends CSV exports from
   data/tectonics/; until a file is there, its trace says so instead
   of drawing anything.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const SVGNS = 'http://www.w3.org/2000/svg';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* the story's numbers and words come from tectonics-sN.js */
  const STORY = window.TK_STORY || {};
  const GUESSES = STORY.guesses || {};
  const SLOPE = STORY.slope || null;
  const SIGNALS = STORY.signals || [];
  const CALLS = STORY.calls || [];
  const CALLS_KEY = STORY.callsKey || 'soochana-tectonics-calls';

  const SURVEY_BANDS = [
    { label: 'NFHS-5', from: '2019-01-01', to: '2021-12-31' },
    { label: 'NFHS-6', from: '2023-01-01', to: '2024-12-31' }
  ];

  /* the season: every story, live or coming */
  const SEASON = [
    { title: 'Online, but unprotected?', href: 'tectonics.html' },
    { title: 'When does youth want to marry?', href: 'tectonics-marriage.html' },
    { title: 'The ageing aftershock', href: 'tectonics-ageing.html' },
    { title: 'Covered, but connected?', href: 'tectonics-health.html' },
    { title: 'Leaving home' }
  ];

  /* ── the four collisions; arrows are [record, signal] ── */
  const QUADS = [
    { id: 'confirmed', name: 'Confirmed shift', arrows: [1, 1], text: 'Both plates move the same way. The change is real.' },
    { id: 'tremor', name: 'Early tremor', arrows: [0, 1], text: 'Searches move before the survey does. Something new is starting.' },
    { id: 'hidden', name: 'Hidden change', arrows: [1, 0], text: 'The survey moves, searches stay quiet. The change is happening offline, often among people the internet misses.' },
    { id: 'fault', name: 'Fault line', arrows: [-1, 1], text: 'They pull opposite ways. The survey may be missing something, or measuring it differently.' }
  ];

  const CHAPTERS = [
    { short: 'Start', full: 'Start' },
    { short: 'Plate', full: '<span>The </span>plate' },
    { short: 'Tremor', full: '<span>The </span>tremor' },
    { short: 'Collision', full: '<span>The </span>collision' },
    { short: 'New land', full: '<span>The </span>new land' },
    { short: 'Aftershock', full: '<span>The </span>aftershock' }
  ];

  /* ── helpers ─────────────────────────────────────── */
  function el(name, attrs, parent) {
    const node = document.createElementNS(SVGNS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    /* style.css styles every <path> for the maps, which beats a stroke
       attribute; inline style beats that rule */
    if (attrs && attrs.stroke) node.style.stroke = attrs.stroke;
    if (attrs && attrs['stroke-width']) node.style.strokeWidth = attrs['stroke-width'] + 'px';
    if (parent) parent.appendChild(node);
    return node;
  }
  function svgText(parent, x, y, text, attrs) {
    const t = el('text', Object.assign({ x: x, y: y }, attrs || {}), parent);
    t.textContent = text;
    return t;
  }
  const fmt = v => (Math.round(v * 10) / 10).toFixed(1);
  const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);

  /* ═══ cover: two plates and a ridge ═══════════════ */
  function drawPlates() {
    const svg = document.getElementById('tkPlates');
    if (!svg) return;
    const seam = y => 300 + (Math.floor((y - 262) / 16) % 2 ? 6 : -6);
    const band = (x0, x1, yTop, yBot, k, inner) => {
      const pts = [];
      const step = x1 > x0 ? 10 : -10;
      for (let x = x0; step > 0 ? x <= x1 : x >= x1; x += step) pts.push([x, yTop + 3 * Math.sin(x / 37 + k)]);
      for (let y = yTop; y <= yBot; y += 8) pts.push([inner(y), y]);
      for (let x = x1; step > 0 ? x >= x0 : x <= x0; x -= step) pts.push([x, yBot + 3 * Math.sin(x / 41 + k + 1)]);
      return 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z';
    };
    const RECORD = ['#5fb6ec', '#3f8fc6', '#2a6e9f', '#1d4f75'];
    const SIGNAL = ['#f4a63a', '#d9852a', '#b4661f', '#8a4c18'];
    const tops = [262, 296, 330, 364, 400];

    const left = el('g', { class: 'plate plate-l' }, svg);
    const right = el('g', { class: 'plate plate-r' }, svg);
    for (let i = 0; i < 4; i++) {
      el('path', { d: band(10, 296, tops[i], tops[i + 1], i, seam), fill: RECORD[i] }, left);
      el('path', { d: band(590, 304, tops[i], tops[i + 1], i + 2, seam), fill: SIGNAL[i] }, right);
    }

    /* the ridge carries both plates' strata, folded together */
    const defs = el('defs', {}, svg);
    const clip = el('clipPath', { id: 'tkRidgeClip' }, defs);
    const ridgeD = 'M196 266 C226 236 244 210 262 176 C272 160 280 168 288 140 C294 122 300 112 306 118 C314 128 318 150 330 160 C344 174 356 208 372 232 C380 246 392 258 404 266 Z';
    el('path', { d: ridgeD }, clip);
    const ridge = el('g', { class: 'ridge' }, svg);
    el('path', { d: ridgeD, fill: '#6fbf86' }, ridge);
    const folds = el('g', { 'clip-path': 'url(#tkRidgeClip)' }, ridge);
    for (let i = 0; i < 7; i++) {
      const y = 150 + i * 18;
      el('path', {
        d: 'M190 ' + (y + 30) + ' Q300 ' + (y - 34) + ' 410 ' + (y + 30),
        fill: 'none', stroke: i % 2 ? '#f4a63a' : '#5fb6ec', 'stroke-width': 3, opacity: 0.55
      }, folds);
    }
    el('path', { d: ridgeD, fill: 'none', stroke: 'rgba(255,255,255,0.5)', 'stroke-width': 1.5 }, ridge);
    svgText(svg, 300, 96, 'New questions', { class: 'plate-name ridge-label', 'text-anchor': 'middle' });

    svgText(svg, 100, 186, 'The record', { class: 'plate-name', 'text-anchor': 'middle' });
    svgText(svg, 100, 206, 'Census · NFHS · SRS', { class: 'plate-sub', 'text-anchor': 'middle' });
    svgText(svg, 500, 186, 'The signals', { class: 'plate-name', 'text-anchor': 'middle' });
    svgText(svg, 500, 206, 'Searches · markets', { class: 'plate-sub', 'text-anchor': 'middle' });

    /* what sits on the plates: homes, a school, a clinic */
    const towns = [[40, 0], [78, 1], [150, 2], [452, 2], [520, 0], [560, 1]];
    towns.forEach((t, i) => {
      const spot = el('g', { transform: 'translate(' + t[0] + ' 238)' }, svg);
      const g = el('g', { class: 'town', style: '--i:' + i }, spot);
      if (t[1] === 0) el('path', { d: 'M0 22V10L9 2l9 8v12Z', fill: 'rgba(255,255,255,0.85)' }, g);
      if (t[1] === 1) el('path', { d: 'M0 22V8h22v14ZM-2 9L11 0l13 9', fill: 'rgba(255,255,255,0.75)' }, g);
      if (t[1] === 2) {
        el('rect', { x: 0, y: 4, width: 20, height: 18, fill: 'rgba(255,255,255,0.85)' }, g);
        el('path', { d: 'M10 8v10M5 13h10', stroke: '#1d2430', 'stroke-width': 3 }, g);
      }
    });
  }

  /* ═══ the island of a hundred ═════════════════════ */
  function buildIsland(id) {
    const svg = document.getElementById(id);
    const pts = [];
    for (let i = 0; i < 100; i++) {
      const r = 21 * Math.sqrt(i + 0.5);
      const a = i * 2.39996;
      pts.push({ x: 250 + r * Math.cos(a), y: 250 + r * Math.sin(a) });
    }
    /* fill from the bottom up, like a rising tide */
    pts.sort((p, q) => (q.y + 0.45 * q.x) - (p.y + 0.45 * p.x));

    const shore = [];
    for (let k = 0; k < 180; k++) {
      const a = (k / 180) * Math.PI * 2;
      const R = 236 + 7 * Math.sin(3 * a + 1) + 5 * Math.sin(5 * a + 2) + 3 * Math.sin(8 * a);
      shore.push((250 + R * Math.cos(a)).toFixed(1) + ' ' + (250 + R * Math.sin(a)).toFixed(1));
    }
    el('path', { class: 'shore', d: 'M' + shore.join('L') + 'Z' }, svg);
    return pts.map(p => el('circle', { class: 'dot', cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: 11 }, svg));
  }

  function paintGuess(dots, n) {
    dots.forEach((d, i) => {
      d.setAttribute('class', 'dot' + (i < n ? ' is-guess' : ''));
    });
  }

  /* tone 'concern': the share is something that should fall (child
     marriage), so it is coloured as the concern and a fall as new land */
  function paintReveal(dots, was, now, tone) {
    const a = Math.round(was);
    const b = Math.round(now);
    const keep = Math.min(a, b);
    const extra = Math.abs(b - a);
    const concern = tone === 'concern';
    const keptCls = concern ? ' is-concern' : ' is-was';
    const extraCls = concern ? (b < a ? ' is-gain' : ' is-worse') : (b > a ? ' is-gain' : ' is-lost');
    const pops = concern ? b < a : b > a;
    dots.forEach((d, i) => {
      let cls = 'dot';
      if (i < keep) cls += keptCls;
      else if (i < keep + extra) cls += extraCls;
      d.setAttribute('class', cls);
      if (i >= keep && i < keep + extra && pops && !reduceMotion) {
        setTimeout(() => d.classList.add('is-pop'), (i - keep) * 45);
      }
    });
  }

  function setKey(id, items) {
    const ul = document.getElementById(id);
    ul.innerHTML = '';
    items.forEach(([color, label]) => {
      const li = document.createElement('li');
      const sw = document.createElement('i');
      sw.style.background = color;
      if (color === 'var(--tk-lost)') { sw.style.background = 'transparent'; sw.style.border = '2px solid ' + color; }
      li.append(sw, label);
      ul.appendChild(li);
    });
  }

  function verdict(g, was, now) {
    const actual = Math.round(now);
    const word = d => (d > 0 ? 'rise' : d < 0 ? 'fall' : 'stay put');
    const past = d => (d > 0 ? 'rose' : 'fell');
    const realDir = sign(now - was);
    if (Math.abs(g - actual) <= 3) return 'Close. You guessed ' + g + '.';
    if (sign(g - Math.round(was)) !== realDir) {
      return 'You guessed ' + g + ', expecting it to ' + word(sign(g - Math.round(was))) + '. It ' + past(realDir) + '.';
    }
    const further = Math.abs(actual - was) > Math.abs(g - was);
    return 'You guessed ' + g + '. It ' + past(realDir) + (further ? ' further than you thought.' : ', but not as far as you thought.');
  }

  function setupGuess(name) {
    const cfg = GUESSES[name];
    const dots = buildIsland(cfg.island);
    const box = document.querySelector('[data-guess="' + name + '"]');
    const input = document.getElementById(cfg.input);
    const out = box.querySelector('output b');
    const reveal = document.querySelector('[data-reveal-for="' + name + '"]');

    const sync = () => {
      out.textContent = input.value;
      paintGuess(dots, +input.value);
    };
    input.addEventListener('input', sync);
    sync();
    setKey(cfg.key, [['rgba(255,255,255,0.55)', 'Your guess'], ['rgba(255,255,255,0.14)', 'Everyone else']]);

    box.querySelector('[data-reveal]').addEventListener('click', () => {
      const g = +input.value;
      reveal.querySelector('[data-verdict]').textContent = verdict(g, cfg.was, cfg.now);
      box.classList.add('is-done');
      reveal.hidden = false;
      paintReveal(dots, cfg.was, cfg.now, cfg.tone);
      setKey(cfg.key, cfg.keyRevealed);
      announce(reveal.querySelector('.tk-big').textContent + '. ' + reveal.querySelector('[data-verdict]').textContent);
      nudgeNext();
    });
  }

  /* ═══ the slope: two lines pulling apart ══════════ */
  /* labels are nudged apart when two values sit close together */
  function dodge(ys, gap) {
    const order = ys.map((y, i) => i).sort((a, b) => ys[a] - ys[b]);
    const out = ys.slice();
    for (let k = 1; k < order.length; k++) {
      const prev = out[order[k - 1]];
      if (out[order[k]] - prev < gap) out[order[k]] = prev + gap;
    }
    return out;
  }

  function drawSlope() {
    const svg = document.getElementById('tkSlope');
    if (!svg || !SLOPE) return;
    const rows = SLOPE.rows;
    const max = SLOPE.max || 80;
    const x1 = 70, x2 = 300;
    const y = v => 410 - v * (360 / max);
    const step = max / 4;
    for (let v = 0; v <= max; v += step) el('line', { class: 'grid', x1: x1, x2: x2, y1: y(v), y2: y(v) }, svg);
    const axis = SLOPE.axis || ['NFHS-5 · 2019–21', 'NFHS-6 · 2023–24'];
    const num = v => (SLOPE.decimals === 0 ? String(Math.round(v)) : fmt(v));
    svgText(svg, 4, 26, axis[0], { class: 'axis-label' });
    svgText(svg, x2, 26, axis[1], { class: 'axis-label', 'text-anchor': 'middle' });
    /* every row starting from the same value (an index) gets one label */
    if (SLOPE.sameStart) svgText(svg, x1 - 12, y(rows[0].was) + 5, num(rows[0].was), { class: 'val', 'text-anchor': 'end' });

    const leftY = dodge(rows.map(r => y(r.was)), 20);
    const rightY = dodge(rows.map(r => y(r.now)), 20);
    rows.forEach((s, i) => {
      const g = el('g', { class: 'series', style: '--i:' + i }, svg);
      const line = el('line', { class: 'line', x1: x1, y1: y(s.was), x2: x2, y2: y(s.now), stroke: s.color }, g);
      const len = Math.hypot(x2 - x1, y(s.now) - y(s.was));
      line.style.setProperty('--len', len.toFixed(1));
      el('circle', { cx: x1, cy: y(s.was), r: 5, fill: s.color }, g);
      el('circle', { class: 'val-r', cx: x2, cy: y(s.now), r: 5, fill: s.color }, g);
      if (!SLOPE.sameStart) svgText(g, x1 - 12, leftY[i] + 5, num(s.was), { class: 'val', 'text-anchor': 'end' });
      svgText(g, x2 + 12, rightY[i] + 5, num(s.now), { class: 'val val-r' });
      svgText(g, x2 + 56, rightY[i] + 5, s.name, { class: 'name name-long' });
      svgText(g, x2 + 56, rightY[i] + 7, s.short, { class: 'name name-short' });
      g.addEventListener('mouseenter', () => { svg.classList.add('has-focus'); g.classList.add('is-focus'); });
      g.addEventListener('mouseleave', () => { svg.classList.remove('has-focus'); g.classList.remove('is-focus'); });
    });
  }

  /* ═══ the tremor: one trace per search group ══════ */
  function parseTrends(text) {
    const lines = text.replace(/\r/g, '').split('\n');
    const dateRe = /^"?(\d{4}-\d{2}(?:-\d{2})?)/;
    let head = -1;
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i].includes(',') && dateRe.test(lines[i + 1]) && !dateRe.test(lines[i])) { head = i; break; }
    }
    if (head < 0) return null;
    const rows = [];
    for (let i = head + 1; i < lines.length; i++) {
      const m = lines[i].match(dateRe);
      if (!m) continue;
      const cells = lines[i].split(',').slice(1);
      const sum = cells.reduce((acc, c) => {
        const v = c.replace(/"/g, '').trim();
        return acc + (v === '<1' ? 0.5 : (parseFloat(v) || 0));
      }, 0);
      rows.push({ t: new Date(m[1].length === 7 ? m[1] + '-01' : m[1]), v: sum });
    }
    const max = Math.max.apply(null, rows.map(r => r.v));
    if (!rows.length || !(max > 0)) return null;
    return rows.map(r => ({ t: r.t, v: (r.v / max) * 100 }));
  }

  function drawTrace(host, sig, series) {
    const W = 640, L = 8, R = 632, T = 10, B = 70;
    const t0 = new Date('2019-01-01').getTime();
    const t1 = Date.now();
    const x = t => L + ((t - t0) / (t1 - t0)) * (R - L);
    const yv = v => B - (v / 100) * (B - T);

    const svg = el('svg', { viewBox: '0 0 ' + W + ' 92', role: 'img' });
    const title = el('title', {}, svg);
    title.textContent = series
      ? 'Search interest in Odisha for ' + sig.name.toLowerCase() + ', 2019 to today.'
      : 'No search data has been added for ' + sig.name.toLowerCase() + ' yet.';

    SURVEY_BANDS.forEach(b => {
      const a = x(new Date(b.from).getTime());
      const z = x(new Date(b.to).getTime());
      el('rect', { class: 'band', x: a.toFixed(1), y: T, width: (z - a).toFixed(1), height: B - T }, svg);
      svgText(svg, a + 5, T + 13, b.label, { class: 'band-label' });
    });
    for (let yr = 2019; yr <= new Date().getFullYear(); yr++) {
      svgText(svg, x(new Date(yr + '-01-01').getTime()), 88, String(yr), { class: 'year' });
    }

    if (series) {
      const pts = series.filter(p => p.t.getTime() >= t0).map(p => x(p.t.getTime()).toFixed(1) + ' ' + yv(p.v).toFixed(1));
      if (pts.length > 1) {
        el('path', { class: 'signal-area', d: 'M' + pts[0].split(' ')[0] + ' ' + B + 'L' + pts.join('L') + 'L' + pts[pts.length - 1].split(' ')[0] + ' ' + B + 'Z' }, svg);
        el('path', { class: 'signal', d: 'M' + pts.join('L') }, svg);
      }
    } else {
      el('line', { class: 'baseline', x1: L, x2: R, y1: B - 6, y2: B - 6 }, svg);
      svgText(svg, W / 2, B - 16, 'No reading yet', { class: 'wait', 'text-anchor': 'middle' });
    }
    host.appendChild(svg);
  }

  function setupSeismo() {
    const wrap = document.getElementById('tkSeismo');
    const status = document.getElementById('tkSeismoStatus');
    if (!wrap) return;
    let loaded = 0;
    const jobs = SIGNALS.map(sig => {
      const row = document.createElement('div');
      row.className = 'tk-trace';
      row.innerHTML = '<div class="tk-trace-head"><span class="tk-trace-name"></span><span class="tk-trace-state">Awaiting data</span></div><div class="tk-trace-terms"></div>';
      row.querySelector('.tk-trace-name').textContent = sig.name;
      row.querySelector('.tk-trace-terms').textContent = 'Searches ' + sig.terms + ', in Odia and English';
      wrap.appendChild(row);
      return fetch(sig.file, { cache: 'no-cache' })
        .then(r => (r.ok ? r.text() : null))
        .catch(() => null)
        .then(text => {
          const series = text ? parseTrends(text) : null;
          if (series) {
            loaded++;
            row.querySelector('.tk-trace-state').textContent = 'Live';
          }
          drawTrace(row, sig, series);
        });
    });
    Promise.all(jobs).then(() => {
      status.textContent = loaded
        ? loaded + ' of ' + SIGNALS.length + ' traces are in. The rest fill in as the data arrives.'
        : 'The search data is being gathered. These traces fill in as it arrives; until then nothing is drawn, so nothing here is guessed.';
    });
  }

  /* ═══ the collision: four kinds, and your call ════ */
  function arrowSvg(dir, color) {
    const s = el('svg', { viewBox: '0 0 30 36', 'aria-hidden': 'true' });
    const d = dir > 0 ? 'M15 32V6M7 14l8-8 8 8' : dir < 0 ? 'M15 4v26M7 22l8 8 8-8' : 'M4 18h22';
    el('path', { d: d, fill: 'none', stroke: color, 'stroke-width': 3.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s);
    return s;
  }

  /* survey 0: the record does not measure it, so any move in search is
     an early tremor, and no move at all is no collision */
  function collisionOf(survey, signal) {
    if (survey === 0) return signal === 0 ? null : 'tremor';
    if (signal === 0) return 'hidden';
    return signal === survey ? 'confirmed' : 'fault';
  }

  function setupCollision() {
    const quads = document.getElementById('tkQuads');
    if (!quads) return;
    const qEls = {};
    QUADS.forEach(q => {
      const li = document.createElement('li');
      li.className = 'tk-quad tk-rise';
      li.style.setProperty('--i', QUADS.indexOf(q) + 2);
      const arrows = document.createElement('div');
      arrows.className = 'tk-quad-arrows';
      arrows.append(arrowSvg(q.arrows[0], '#5fb6ec'), arrowSvg(q.arrows[1], '#f4a63a'));
      const h = document.createElement('h3');
      h.textContent = q.name;
      const p = document.createElement('p');
      p.textContent = q.text;
      const c = document.createElement('p');
      c.className = 'tk-quad-count';
      li.append(arrows, h, p, c);
      quads.appendChild(li);
      qEls[q.id] = li;
    });

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(CALLS_KEY) || '{}') || {}; } catch (e) { saved = {}; }

    const host = document.getElementById('tkPredict');
    const results = {};
    const refresh = () => {
      const counts = {};
      CALLS.forEach(call => {
        if (saved[call.id] === undefined) return;
        const k = collisionOf(call.survey, saved[call.id]);
        if (k) counts[k] = (counts[k] || 0) + 1;
      });
      QUADS.forEach(q => {
        const n = counts[q.id] || 0;
        qEls[q.id].classList.toggle('is-hit', n > 0);
        qEls[q.id].querySelector('.tk-quad-count').textContent = n ? 'Your call' + (n > 1 ? 's: ' + n : '') : '';
      });
    };

    CALLS.forEach(call => {
      const box = document.createElement('div');
      box.className = 'tk-call';
      box.innerHTML = '<div class="tk-call-head"><span class="tk-call-name"></span><span class="tk-call-survey"></span></div><p class="tk-call-q"></p><div class="tk-call-opts" role="group"></div><p class="tk-call-result" aria-live="polite"></p>';
      box.querySelector('.tk-call-name').textContent = call.name;
      box.querySelector('.tk-call-survey').textContent = call.surveyText;
      box.querySelector('.tk-call-q').textContent = call.q;
      const opts = box.querySelector('.tk-call-opts');
      opts.setAttribute('aria-label', call.q);
      const result = box.querySelector('.tk-call-result');
      results[call.id] = result;

      const show = v => {
        opts.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v === v)));
        const q = QUADS.find(x => x.id === collisionOf(call.survey, v));
        result.innerHTML = '';
        const b = document.createElement('b');
        b.textContent = (q ? q.name : 'No collision') + '. ';
        result.append(b, call.says[String(v)]);
      };

      [[1, 'Rise'], [0, 'Stay flat'], [-1, 'Fall']].forEach(([v, label]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.v = v;
        btn.textContent = label;
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', () => {
          saved[call.id] = v;
          try { localStorage.setItem(CALLS_KEY, JSON.stringify(saved)); } catch (e) { /* private mode: keep it for this visit */ }
          show(v);
          refresh();
        });
        opts.appendChild(btn);
      });
      if (saved[call.id] !== undefined) show(saved[call.id]);
      host.appendChild(box);
    });
    refresh();
  }

  /* ═══ scenes, rail, keys and hash ═════════════════ */
  const scenes = Array.from(document.querySelectorAll('.tk-scene'));
  const prevBtn = document.querySelector('.tk-arrow.prev');
  const nextBtn = document.querySelector('.tk-arrow.next');
  const steps = document.getElementById('tkSteps');
  const live = document.getElementById('tkLive');
  let current = -1;

  function announce(text) {
    live.textContent = '';
    setTimeout(() => { live.textContent = text; }, 60);
  }

  function nudgeNext() {
    nextBtn.classList.remove('is-nudging');
    void nextBtn.offsetWidth;
    nextBtn.classList.add('is-nudging');
  }

  function buildRail() {
    CHAPTERS.forEach((c, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = c.full;
      b.setAttribute('aria-label', c.short);
      b.addEventListener('click', () => {
        const first = scenes.findIndex(s => +s.dataset.chapter === i);
        if (first >= 0) go(first);
      });
      li.appendChild(b);
      steps.appendChild(li);
    });
  }

  function go(i, opts) {
    i = Math.max(0, Math.min(scenes.length - 1, i));
    if (i === current) return;
    const first = current < 0;
    current = i;
    scenes.forEach((s, k) => {
      s.classList.toggle('is-active', k === i);
      s.classList.toggle('is-before', k < i);
      s.setAttribute('aria-hidden', String(k !== i));
      s.inert = k !== i;
    });
    const scene = scenes[i];
    document.body.dataset.scene = scene.dataset.scene;
    scene.scrollTop = 0;
    scene.parentElement.scrollLeft = 0;
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === scenes.length - 1;
    nextBtn.classList.remove('is-nudging');

    const ch = +scene.dataset.chapter;
    steps.querySelectorAll('button').forEach((b, k) => {
      if (k === ch) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.classList.toggle('is-past', k < ch);
    });

    if (!(opts && opts.noHash)) {
      try { history.replaceState(null, '', '#' + scene.id); } catch (e) { /* file:// */ }
    }
    if (!first) {
      const h = scene.querySelector('h2');
      if (h) setTimeout(() => h.focus({ preventScroll: true }), 300);
      announce(h ? h.textContent : '');
    }
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-go]');
    if (!t) return;
    const v = t.dataset.go;
    go(v === 'next' ? current + 1 : v === 'prev' ? current - 1 : +v);
  });

  document.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(current + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(current - 1); }
  });

  window.addEventListener('hashchange', () => {
    const k = scenes.findIndex(s => '#' + s.id === location.hash);
    if (k >= 0) go(k, { noHash: true });
  });

  /* ═══ the district map: guess, reveal, then see it move ═══
     cfg.values is { district (as in Orissa.geojson): [NFHS-5, NFHS-6] }.
     The reader picks a district on the map (or from the list), then
     the map fills in, and can switch to how far each district moved. */
  function setupMap(cfg) {
    const svg = document.getElementById(cfg.svg);
    const pick = document.getElementById(cfg.select);
    const btn = document.querySelector('[data-map-reveal]');
    const panel = document.querySelector('[data-map-panel]');
    const readout = document.getElementById(cfg.readout);
    const key = document.getElementById(cfg.key);
    const views = document.querySelectorAll('[data-map-view]');
    if (!svg) return;

    const names = Object.keys(cfg.values).sort();
    /* rank 'low': the reader hunts for the lowest district instead */
    const low = cfg.rank === 'low';
    const ranked = names.slice().sort((a, b) => (low ? 1 : -1) * (cfg.values[a][1] - cfg.values[b][1]));
    const extreme = low ? 'lowest' : 'highest';
    /* cfg.layers: other indicators the reader can lay over the same map,
       { view: { label, values: { district: v }, bins } } */
    const layers = cfg.layers || {};
    const change = n => cfg.values[n][1] - cfg.values[n][0];
    const big = cfg.bigMove || 5;
    let chosen = null;
    let revealed = false;
    let view = 'now';
    const paths = {};

    names.forEach(n => {
      const o = document.createElement('option');
      o.value = n;
      o.textContent = n;
      pick.appendChild(o);
    });

    const binColor = (v, bins) => {
      const stops = bins || cfg.bins;
      for (let i = 0; i < stops.length; i++) if (v < stops[i][0]) return stops[i][1];
      return stops[stops.length - 1][1];
    };
    const changeColor = d => (d <= -big ? '#36b4ee' : d < 0 ? '#9fd3f0' : d < big ? '#f6c58f' : '#f08a4b');

    function paint() {
      names.forEach(n => {
        const p = paths[n];
        if (!p) return;
        let fill = 'rgba(255,255,255,0.12)';
        if (revealed) {
          if (layers[view]) fill = binColor(layers[view].values[n], layers[view].bins);
          else fill = view === 'now' ? binColor(cfg.values[n][1]) : changeColor(change(n));
        }
        else if (n === chosen) fill = 'rgba(255,255,255,0.7)';
        p.style.fill = fill;
        p.classList.toggle('is-chosen', n === chosen);
      });
      const arrows = svg.querySelector('.map-arrows');
      if (arrows) arrows.style.opacity = revealed && view === 'change' ? 1 : 0;
      const tops = svg.querySelector('.map-tops');
      if (tops) tops.style.opacity = revealed && view === 'now' ? 1 : 0;
      paintKey();
    }

    function paintKey() {
      key.innerHTML = '';
      let items;
      if (!revealed) items = [['rgba(255,255,255,0.7)', 'Your pick'], ['rgba(255,255,255,0.12)', 'Other districts']];
      else if (layers[view]) items = layers[view].bins.map(b => [b[1], b[2]]);
      else if (view === 'now') items = cfg.bins.map(b => [b[1], b[2]]);
      else {
        /* only the kinds of move that actually happened */
        const moves = names.map(change);
        items = [
          ['#36b4ee', 'Fell ' + big + '+ points', moves.some(d => d <= -big)],
          ['#9fd3f0', 'Fell a little', moves.some(d => d < 0 && d > -big)],
          ['#f6c58f', 'Rose less than ' + big, moves.some(d => d >= 0 && d < big)],
          ['#f08a4b', 'Rose ' + big + '+ points', moves.some(d => d >= big)]
        ].filter(x => x[2]);
      }
      items.forEach(([c, label]) => {
        const li = document.createElement('li');
        const sw = document.createElement('i');
        sw.style.background = c;
        sw.style.borderRadius = '3px';
        li.append(sw, label);
        key.appendChild(li);
      });
    }

    function tell(n) {
      if (!n) { readout.textContent = revealed ? cfg.hoverHint : cfg.pickHint; return; }
      if (!revealed) { readout.textContent = n; return; }
      if (layers[view]) { readout.textContent = n + ': ' + fmt(layers[view].values[n]) + '% ' + layers[view].label; return; }
      const [a, b] = cfg.values[n];
      const d = b - a;
      const per = cfg.periods || ['2019–21', '2023–24'];
      readout.textContent = n + ': ' + fmt(a) + '% in ' + per[0] + ' → ' + fmt(b) + '% in ' + per[1] + ' (' + (d > 0 ? '+' : d < 0 ? '−' : '±') + fmt(Math.abs(d)) + ')';
    }

    function choose(n) {
      if (revealed) { tell(n); return; }
      chosen = n;
      pick.value = n || '';
      btn.disabled = !n;
      tell(n);
      paint();
    }

    pick.addEventListener('change', () => choose(pick.value || null));

    btn.addEventListener('click', () => {
      if (!chosen) return;
      revealed = true;
      const rank = ranked.indexOf(chosen) + 1;
      const top = ranked[0];
      const verdict = panel.querySelector('[data-verdict]');
      verdict.textContent = rank === 1
        ? 'Right first time: ' + top + ', at ' + fmt(cfg.values[top][1]) + '%.'
        : 'You picked ' + chosen + ': ' + fmt(cfg.values[chosen][1]) + '%, ranked ' + rank + ' of ' + names.length + ', counting from the ' + extreme + '. The ' + extreme + ' is ' + top + ', at ' + fmt(cfg.values[top][1]) + '%.';
      btn.closest('.tk-guess').classList.add('is-done');
      panel.hidden = false;
      paint();
      tell(null);
      announce(verdict.textContent);
      nudgeNext();
    });

    views.forEach(b => b.addEventListener('click', () => {
      view = b.dataset.mapView;
      views.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      paint();
    }));

    paintKey();
    if (!window.d3) { readout.textContent = 'The map could not load. The list still works.'; return; }
    fetch(cfg.geo)
      .then(r => r.json())
      .then(geo => {
        const W = 520, H = 520;
        const proj = d3.geoMercator().fitExtent([[12, 12], [W - 12, H - 12]], geo);
        const path = d3.geoPath(proj);
        const land = el('g', { class: 'map-land' }, svg);
        const centre = {};
        geo.features.forEach(f => {
          const n = f.properties[cfg.nameField];
          if (!cfg.values[n]) return;
          const p = el('path', { class: 'dist', d: path(f) }, land);
          const t = el('title', {}, p);
          t.textContent = n;
          paths[n] = p;
          centre[n] = path.centroid(f);
          p.addEventListener('mouseenter', () => tell(n));
          p.addEventListener('mouseleave', () => tell(chosen && !revealed ? chosen : null));
          p.addEventListener('click', () => choose(n));
        });

        /* the movers: an arrow on each district that moved big+ points */
        const arrows = el('g', { class: 'map-arrows' }, svg);
        names.filter(n => Math.abs(change(n)) >= big && centre[n]).forEach(n => {
          const [x, y0] = centre[n];
          const d = change(n);
          const len = Math.min(70, Math.abs(d) * (cfg.arrowScale || 4));
          const up = d > 0;
          const col = up ? '#f08a4b' : '#36b4ee';
          const yTip = up ? y0 - len / 2 : y0 + len / 2;
          const yTail = up ? y0 + len / 2 : y0 - len / 2;
          const h = up ? -1 : 1;
          const shaft = 'M' + x + ' ' + yTail + 'V' + yTip;
          const head = 'M' + (x - 7) + ' ' + (yTip - h * 8) + 'L' + x + ' ' + yTip + 'L' + (x + 7) + ' ' + (yTip - h * 8);
          el('path', { d: shaft + head, stroke: '#0d2b45', 'stroke-width': 8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }, arrows);
          el('path', { d: shaft + head, stroke: col, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }, arrows);
          svgText(arrows, x + 11, y0 + 4, n + ' ' + (up ? '+' : '−') + fmt(Math.abs(d)), { class: 'map-label' });
        });

        /* the three at the extreme the reader was hunting for, named */
        const tops = el('g', { class: 'map-tops' }, svg);
        ranked.slice(0, 3).forEach(n => {
          if (!centre[n]) return;
          const [x, y] = centre[n];
          el('circle', { cx: x, cy: y, r: 4, fill: '#ffffff' }, tops);
          svgText(tops, x + 8, y + 4, n + ' ' + fmt(cfg.values[n][1]) + '%', { class: 'map-label' });
        });
        /* crop the frame to the state, with room on the right for labels */
        const b = path.bounds(geo);
        svg.setAttribute('viewBox', [b[0][0] - 8, b[0][1] - 8, b[1][0] - b[0][0] + 96, b[1][1] - b[0][1] + 16].map(v => v.toFixed(0)).join(' '));
        paint();
        tell(null);
      })
      .catch(() => { readout.textContent = 'The map could not load. The list still works.'; });
  }

  /* ═══ the scatter: does one move go with another? ═══
     cfg.x.values and cfg.y.values are { district: [NFHS-5, NFHS-6] }.
     First each district sits on the line, placed only by how far x
     moved; the reader says how strongly they expect y to follow, then
     the dots drop into place. View 'change' plots how far each moved,
     view 'now' where each stands. r and ρ are worked out here, from the
     same numbers the dots are drawn with. */
  function pearson(xs, ys) {
    const n = xs.length;
    const mx = xs.reduce((a, v) => a + v, 0) / n;
    const my = ys.reduce((a, v) => a + v, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; syy += (ys[i] - my) ** 2; });
    return { r: sxy / Math.sqrt(sxx * syy), slope: sxy / sxx, mx: mx, my: my };
  }
  /* ranks for Spearman's ρ; tied values share their average rank */
  function ranks(v) {
    const order = v.map((x, i) => i).sort((a, b) => v[a] - v[b]);
    const out = [];
    for (let i = 0; i < order.length;) {
      let j = i;
      while (j + 1 < order.length && v[order[j + 1]] === v[order[i]]) j++;
      for (let k = i; k <= j; k++) out[order[k]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    return out;
  }
  const signed = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + fmt(Math.abs(v));
  const coef = v => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2);

  function setupScatter(cfg) {
    const svg = document.getElementById(cfg.svg);
    if (!svg) return;
    const readout = document.getElementById(cfg.readout);
    const key = document.getElementById(cfg.key);
    const panel = document.querySelector('[data-scatter-panel]');
    const guesses = document.querySelectorAll('[data-scatter-guess]');
    const views = document.querySelectorAll('[data-scatter-view]');
    const X = cfg.x.values, Y = cfg.y.values;
    const names = Object.keys(Y).filter(n => X[n]).sort();
    const per = cfg.periods || ['2019–21', '2023–24'];
    const L = 40, R = 466, T = 34, B = 346;
    let revealed = false;
    let view = 'change';
    let focus = null;

    /* changes are rounded to the data's one decimal, so equal moves tie
       (46.3 − 33.7 is 12.599… in floating point) */
    const move = p => Math.round((p[1] - p[0]) * 10) / 10;
    const at = (n, v) => (v === 'change' ? [move(X[n]), move(Y[n])] : [X[n][1], Y[n][1]]);
    /* the frame comes from the story, widened if any value falls outside it */
    const domain = (axis, v, k) => {
      const [lo, hi, step] = cfg.views[v][axis];
      const vals = names.map(n => at(n, v)[k]);
      return [Math.min(lo, Math.floor(Math.min.apply(null, vals) / step) * step),
        Math.max(hi, Math.ceil(Math.max.apply(null, vals) / step) * step), step];
    };
    const stats = {};
    ['change', 'now'].forEach(v => {
      const xs = names.map(n => at(n, v)[0]);
      const ys = names.map(n => at(n, v)[1]);
      const p = pearson(xs, ys);
      stats[v] = { r: p.r, rho: pearson(ranks(xs), ranks(ys)).r, slope: p.slope, mx: p.mx, my: p.my };
    });

    const defs = el('defs', {}, svg);
    const clip = el('clipPath', { id: cfg.svg + 'Clip' }, defs);
    el('rect', { x: L, y: T, width: R - L, height: B - T }, clip);
    const frame = el('g', { class: 'sc-frame' }, svg);
    const trend = el('g', { class: 'sc-trend', 'clip-path': 'url(#' + cfg.svg + 'Clip)' }, svg);
    const dotsG = el('g', { class: 'sc-dots' }, svg);
    const labelsG = el('g', { class: 'sc-labels' }, svg);

    const dots = {};
    const labels = {};
    names.forEach((n, i) => {
      const c = el('circle', { class: 'sc-dot', r: 7, cx: 0, cy: 0, style: '--i:' + i }, dotsG);
      const t = el('title', {}, c);
      t.textContent = n;
      c.addEventListener('mouseenter', () => tell(n));
      c.addEventListener('mouseleave', () => tell(focus));
      c.addEventListener('click', () => { focus = focus === n ? null : n; tell(focus); paint(); });
      dots[n] = c;
      labels[n] = svgText(labelsG, 0, 0, n, { class: 'sc-label' });
    });

    let sx, sy;
    function drawFrame() {
      frame.innerHTML = '';
      trend.innerHTML = '';
      const V = cfg.views[view];
      const [x0, x1, xs] = domain('x', view, 0);
      const [y0, y1, ys] = domain('y', view, 1);
      sx = v => L + ((v - x0) / (x1 - x0)) * (R - L);
      sy = v => B - ((v - y0) / (y1 - y0)) * (B - T);
      for (let v = y0; v <= y1 + 1e-9; v += ys) {
        el('line', { class: 'grid' + (v === 0 ? ' zero' : ''), x1: L, x2: R, y1: sy(v), y2: sy(v) }, frame);
        svgText(frame, L - 8, sy(v) + 4, (v > 0 && view === 'change' ? '+' : '') + String(v).replace('-', '−'), { class: 'tick', 'text-anchor': 'end' });
      }
      for (let v = x0; v <= x1 + 1e-9; v += xs) {
        el('line', { class: 'grid', x1: sx(v), x2: sx(v), y1: T, y2: B }, frame);
        svgText(frame, sx(v), B + 18, (v > 0 && view === 'change' ? '+' : '') + v, { class: 'tick', 'text-anchor': 'middle' });
      }
      if (view === 'change' && y0 < 0 && y1 > 0) svgText(frame, R - 4, sy(0) + 20, 'No change', { class: 'tick zero-label', 'text-anchor': 'end' });
      svgText(frame, L - 30, T - 16, '↑ ' + V.yLabel, { class: 'axis-label' });
      svgText(frame, R, B + 42, V.xLabel + ' →', { class: 'axis-label', 'text-anchor': 'end' });

      /* the least-squares line, and the two coefficients */
      const s = stats[view];
      const fy = x => s.my + s.slope * (x - s.mx);
      el('line', { class: 'sc-fit', x1: sx(x0), y1: sy(fy(x0)), x2: sx(x1), y2: sy(fy(x1)) }, trend);
      svgText(frame, R - 4, T + 18, 'Pearson r ' + coef(s.r), { class: 'sc-stat', 'text-anchor': 'end' });
      svgText(frame, R - 4, T + 38, 'Spearman ρ ' + coef(s.rho), { class: 'sc-stat', 'text-anchor': 'end' });
    }

    function colorOf(n) {
      const bins = cfg.views[view].bins;
      if (!bins) return '#ffffff';
      const v = at(n, view)[1];
      for (let i = 0; i < bins.length; i++) if (v < bins[i][0]) return bins[i][1];
      return bins[bins.length - 1][1];
    }

    function paint() {
      svg.classList.toggle('is-revealed', revealed);
      const named = cfg.views[view].labels || [];
      names.forEach(n => {
        const [vx, vy] = at(n, view);
        const px = sx(vx);
        /* before the reveal every district waits on the no-change line */
        const py = revealed ? sy(vy) : sy(0);
        const d = dots[n];
        d.style.transform = 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px)';
        d.style.fill = revealed ? colorOf(n) : 'rgba(255,255,255,0.6)';
        d.classList.toggle('is-focus', n === focus);
        const t = labels[n];
        const right = px > R - 90;
        t.setAttribute('text-anchor', right ? 'end' : 'start');
        t.style.transform = 'translate(' + (px + (right ? -11 : 11)).toFixed(1) + 'px,' + (py + 4).toFixed(1) + 'px)';
        t.classList.toggle('is-on', revealed && (named.includes(n) || n === focus));
      });
      paintKey();
    }

    function paintKey() {
      key.innerHTML = '';
      let items;
      if (!revealed) items = [['rgba(255,255,255,0.6)', 'A district, placed by how far its schooling rose']];
      else {
        const bins = cfg.views[view].bins;
        items = bins ? bins.map(b => [b[1], b[2]]) : [['#ffffff', 'A district']];
        items.push(['line', 'Straight-line fit']);
      }
      items.forEach(([c, label]) => {
        const li = document.createElement('li');
        const sw = document.createElement('i');
        if (c === 'line') sw.className = 'sc-key-line';
        else sw.style.background = c;
        li.append(sw, label);
        key.appendChild(li);
      });
    }

    function tell(n) {
      if (!n) { readout.textContent = revealed ? cfg.hoverHint : cfg.pickHint; return; }
      const [xa, xb] = X[n];
      const [ya, yb] = Y[n];
      if (!revealed) { readout.textContent = n + ': ' + cfg.x.short + ' ' + fmt(xa) + '% → ' + fmt(xb) + '% (' + signed(xb - xa) + ')'; return; }
      readout.textContent = view === 'change'
        ? n + ': ' + cfg.x.short + ' ' + signed(xb - xa) + ' points, ' + cfg.y.short + ' ' + signed(yb - ya) + ' (' + fmt(ya) + '% → ' + fmt(yb) + '%)'
        : n + ', ' + per[1] + ': ' + fmt(xb) + '% ' + cfg.x.short + ', ' + fmt(yb) + '% ' + cfg.y.short;
    }

    guesses.forEach(b => b.addEventListener('click', () => {
      guesses.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      if (revealed) return;
      revealed = true;
      const verdict = panel.querySelector('[data-verdict]');
      verdict.textContent = cfg.says[b.dataset.scatterGuess] || '';
      panel.hidden = false;
      guesses.forEach(x => { x.disabled = true; });
      paint();
      tell(focus);
      announce(verdict.textContent + ' Pearson r ' + coef(stats.change.r) + ', Spearman ρ ' + coef(stats.change.rho) + '.');
      nudgeNext();
    }));

    views.forEach(b => b.addEventListener('click', () => {
      view = b.dataset.scatterView;
      views.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      document.querySelectorAll('[data-scatter-text]').forEach(p => { p.hidden = p.dataset.scatterText !== view; });
      drawFrame();
      paint();
      tell(focus);
    }));

    drawFrame();
    paint();
    tell(null);
  }

  /* ═══ the age pyramid, scrubbed through the years ═══
     cfg.male / cfg.female: { year: [lakh per 5-year group, youngest first] }.
     Groups from cfg.highlightFrom up are coloured as the old. */
  let setPyramidYear = null;

  function setupPyramid(cfg) {
    const svg = document.getElementById(cfg.svg);
    const range = document.getElementById(cfg.range);
    const out = document.getElementById(cfg.out);
    const play = document.getElementById(cfg.play);
    const readout = document.getElementById(cfg.readout);
    if (!svg) return;

    const n = cfg.groups.length;
    const mid = 280, gap = 30, half = 228, top = 44, rowH = 400 / n;
    let max = 0;
    cfg.years.forEach(y => { max = Math.max(max, ...cfg.male[y], ...cfg.female[y]); });

    svgText(svg, mid - gap, 26, 'Men', { class: 'pyr-head', 'text-anchor': 'end' });
    svgText(svg, mid + gap, 26, 'Women', { class: 'pyr-head' });
    const bars = [];
    for (let i = 0; i < n; i++) {
      const row = n - 1 - i;              /* oldest at the top */
      const y = top + row * rowH;
      const old = i >= cfg.highlightFrom;
      const m = el('rect', { class: 'pyr-m' + (old ? ' is-old' : ''), x: mid - gap - half, y: y.toFixed(1), width: half, height: (rowH - 4).toFixed(1), rx: 2 }, svg);
      const f = el('rect', { class: 'pyr-f' + (old ? ' is-old' : ''), x: mid + gap, y: y.toFixed(1), width: half, height: (rowH - 4).toFixed(1), rx: 2 }, svg);
      if (i % 2 === 0 || i === n - 1) svgText(svg, mid, y + rowH / 2 + 2, cfg.groups[i], { class: 'pyr-age', 'text-anchor': 'middle' });
      bars.push([m, f]);
    }

    const lakh = v => (Math.round(v * 10) / 10).toFixed(1);
    function show(k) {
      const year = cfg.years[k];
      const m = cfg.male[year], f = cfg.female[year];
      bars.forEach(([bm, bf], i) => {
        bm.style.transform = 'scaleX(' + (m[i] / max).toFixed(4) + ')';
        bf.style.transform = 'scaleX(' + (f[i] / max).toFixed(4) + ')';
      });
      const sum = (a, b) => m.slice(a, b).reduce((s, v) => s + v, 0) + f.slice(a, b).reduce((s, v) => s + v, 0);
      const old = sum(cfg.highlightFrom, n);
      const young = sum(0, 2);
      range.value = k;
      out.textContent = year + (year >= cfg.projectedFrom ? ' (projected)' : ' (Census)');
      readout.innerHTML = '';
      const a = document.createElement('span');
      a.className = 'pyr-old';
      a.textContent = 'Aged 60 and over: ' + lakh(old) + ' lakh';
      const b = document.createElement('span');
      b.textContent = 'Children under 10: ' + lakh(young) + ' lakh';
      readout.append(a, b);
    }
    setPyramidYear = year => {
      stop();
      const k = cfg.years.indexOf(year);
      if (k >= 0) show(k);
    };

    range.min = 0;
    range.max = cfg.years.length - 1;
    range.step = 1;
    range.addEventListener('input', () => { stop(); show(+range.value); });

    let timer = null;
    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
      play.textContent = 'Play';
      play.setAttribute('aria-pressed', 'false');
    }
    play.addEventListener('click', () => {
      if (timer) { stop(); return; }
      let k = +range.value >= cfg.years.length - 1 ? 0 : +range.value;
      show(k);
      play.textContent = 'Pause';
      play.setAttribute('aria-pressed', 'true');
      timer = setInterval(() => {
        k++;
        if (k >= cfg.years.length) { stop(); return; }
        show(k);
      }, reduceMotion ? 2000 : 1400);
    });
    show(cfg.start !== undefined ? cfg.years.indexOf(cfg.start) : 0);
  }

  /* ═══ a multiple-choice guess ═══════════════════
     <div class="tk-guess tk-choice" data-choice="x" data-answer="v"> with
     buttons carrying data-value; the panel [data-choice-for="x"] opens
     after a pick. data-pyramid-year moves the pyramid there too. */
  function setupChoices() {
    document.querySelectorAll('.tk-choice').forEach(box => {
      const name = box.dataset.choice;
      const panel = document.querySelector('[data-choice-for="' + name + '"]');
      box.querySelectorAll('button[data-value]').forEach(btn => {
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', () => {
          const right = btn.dataset.value === box.dataset.answer;
          const verdict = panel.querySelector('[data-verdict]');
          verdict.textContent = right ? 'Right: ' + btn.textContent.toLowerCase() + '.' : 'Not quite. You picked “' + btn.textContent + '”.';
          box.classList.add('is-done');
          panel.hidden = false;
          if (box.dataset.pyramidYear && setPyramidYear) setPyramidYear(+box.dataset.pyramidYear);
          announce(verdict.textContent);
          nudgeNext();
        });
      });
    });
  }

  /* ═══ the season list on the cover ══════════════ */
  function buildSeason() {
    document.querySelectorAll('[data-season]').forEach(ol => {
      SEASON.forEach((st, i) => {
        const li = document.createElement('li');
        const n = document.createElement('span');
        n.textContent = i + 1;
        li.appendChild(n);
        if (i + 1 === STORY.number) {
          li.className = 'is-live';
          li.setAttribute('aria-current', 'page');
          li.append(st.title);
        } else if (st.href) {
          const a = document.createElement('a');
          a.href = st.href;
          a.textContent = st.title;
          li.appendChild(a);
        } else {
          const em = document.createElement('em');
          em.textContent = 'coming';
          li.append(st.title + ' ', em);
        }
        ol.appendChild(li);
      });
    });
  }

  /* ── start ── */
  drawPlates();
  buildSeason();
  Object.keys(GUESSES).forEach(setupGuess);
  drawSlope();
  if (STORY.map) setupMap(STORY.map);
  if (STORY.scatter) setupScatter(STORY.scatter);
  if (STORY.pyramid) setupPyramid(STORY.pyramid);
  setupChoices();
  setupSeismo();
  setupCollision();
  buildRail();
  const start = scenes.findIndex(s => '#' + s.id === location.hash);
  go(start >= 0 ? start : 0, { noHash: true });
})();
