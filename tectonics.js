/* ═══════════════════════════════════════════════════════════════════
   TECTONICS — story 1, "Online, but unprotected?"
   Scenes move with the arrows, the chapter rail, the keyboard and the
   URL hash. Every official number here is NFHS-5 → NFHS-6 for Odisha
   (the same values as district-health.html). The search traces read
   Google Trends CSV exports from data/tectonics/; until a file is
   there, its trace says so instead of drawing anything.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const SVGNS = 'http://www.w3.org/2000/svg';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── the record: NFHS-5 (2019–21) → NFHS-6 (2023–24), Odisha ── */
  const GUESSES = {
    online: {
      island: 'islandOnline', key: 'keyOnline', input: 'guessOnline',
      was: 24.9, now: 51.8,
      keyRevealed: [
        ['var(--tk-record)', 'Online by 2019–21'],
        ['var(--tk-land)', 'Came online by 2023–24'],
        ['rgba(255,255,255,0.14)', 'Never online']
      ]
    },
    methods: {
      island: 'islandMethods', key: 'keyMethods', input: 'guessMethods',
      was: 48.8, now: 40.8,
      keyRevealed: [
        ['var(--tk-record)', 'Using a modern method, 2023–24'],
        ['var(--tk-lost)', 'Fewer users than in 2019–21'],
        ['rgba(255,255,255,0.14)', 'No modern method']
      ]
    }
  };

  const SLOPE = [
    { name: 'Married women using any method', short: 'Any method', was: 74.1, now: 66.2, color: '#f9d5bf' },
    { name: 'Women who have used the internet', short: 'Women online', was: 24.9, now: 51.8, color: '#9fd3f0' },
    { name: 'Married women using a modern method', short: 'Modern method', was: 48.8, now: 40.8, color: '#f08a4b' },
    { name: 'Women 20–24 married before 18', short: 'Married before 18', was: 20.5, now: 18.6, color: 'rgba(255,255,255,0.7)' },
    { name: 'Unmet need for spacing', short: 'Unmet need, spacing', was: 2.6, now: 4.7, color: '#f4c534' }
  ];

  /* ── the signals: one Google Trends export per search group ── */
  const SIGNALS = [
    { name: 'Emergency pills', terms: 'such as “i-pill”, “unwanted 72”', file: 'data/tectonics/s1-emergency-pills.csv' },
    { name: 'Pregnancy worries', terms: 'such as “pregnancy test”, “period late”', file: 'data/tectonics/s1-pregnancy-worries.csv' },
    { name: 'Side effects', terms: 'such as “Copper-T side effects”', file: 'data/tectonics/s1-side-effects.csv' },
    { name: 'Delaying a child', terms: 'such as “how to avoid pregnancy”', file: 'data/tectonics/s1-delaying.csv' }
  ];
  const SURVEY_BANDS = [
    { label: 'NFHS-5', from: '2019-01-01', to: '2021-12-31' },
    { label: 'NFHS-6', from: '2023-01-01', to: '2024-12-31' }
  ];

  /* ── the four collisions; arrows are [record, signal] ── */
  const QUADS = [
    { id: 'confirmed', name: 'Confirmed shift', arrows: [1, 1], text: 'Both plates move the same way. The change is real.' },
    { id: 'tremor', name: 'Early tremor', arrows: [0, 1], text: 'Searches move before the survey does. Something new is starting.' },
    { id: 'hidden', name: 'Hidden change', arrows: [1, 0], text: 'The survey moves, searches stay quiet. The change is happening offline, often among people the internet misses.' },
    { id: 'fault', name: 'Fault line', arrows: [-1, 1], text: 'They pull opposite ways. The survey may be missing something, or measuring it differently.' }
  ];

  const CALLS = [
    {
      id: 'modern', name: 'Modern contraceptive use', survey: -1, surveyText: 'Survey: 48.8% → 40.8%',
      q: 'Search interest in contraception will…',
      says: {
        '1': 'Interest rises while use falls. People may be looking for something they are not getting.',
        '0': 'Use falls and no one searches. The change would be happening offline.',
        '-1': 'Interest and use fall together. Contraception would be slipping out of mind.'
      }
    },
    {
      id: 'spacing', name: 'Unmet need for spacing', survey: 1, surveyText: 'Survey: 2.6% → 4.7%',
      q: 'Searches about delaying a pregnancy will…',
      says: {
        '1': 'More women want to wait, and they go online to find out how.',
        '0': 'The wish to wait grows quietly, away from search.',
        '-1': 'The need rises while searches fall. The questions may be going elsewhere: friends, chemists, ASHAs.'
      }
    }
  ];
  const CALLS_KEY = 'soochana-tectonics-s1-calls';

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

  function paintReveal(dots, was, now) {
    const a = Math.round(was);
    const b = Math.round(now);
    const keep = Math.min(a, b);
    const extra = Math.abs(b - a);
    dots.forEach((d, i) => {
      let cls = 'dot';
      if (i < keep) cls += ' is-was';
      else if (i < keep + extra) cls += b > a ? ' is-gain' : ' is-lost';
      d.setAttribute('class', cls);
      if (i >= keep && i < keep + extra && b > a && !reduceMotion) {
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
      paintReveal(dots, cfg.was, cfg.now);
      setKey(cfg.key, cfg.keyRevealed);
      announce(reveal.querySelector('.tk-big').textContent + '. ' + reveal.querySelector('[data-verdict]').textContent);
      nudgeNext();
    });
  }

  /* ═══ the slope: two lines pulling apart ══════════ */
  function drawSlope() {
    const svg = document.getElementById('tkSlope');
    const x1 = 70, x2 = 300;
    const y = v => 410 - v * (360 / 80);
    [0, 20, 40, 60, 80].forEach(v => el('line', { class: 'grid', x1: x1, x2: x2, y1: y(v), y2: y(v) }, svg));
    svgText(svg, 4, 26, 'NFHS-5 · 2019–21', { class: 'axis-label' });
    svgText(svg, x2, 26, 'NFHS-6 · 2023–24', { class: 'axis-label', 'text-anchor': 'middle' });

    SLOPE.forEach((s, i) => {
      const g = el('g', { class: 'series', style: '--i:' + i }, svg);
      const line = el('line', { class: 'line', x1: x1, y1: y(s.was), x2: x2, y2: y(s.now), stroke: s.color }, g);
      const len = Math.hypot(x2 - x1, y(s.now) - y(s.was));
      line.style.setProperty('--len', len.toFixed(1));
      el('circle', { cx: x1, cy: y(s.was), r: 5, fill: s.color }, g);
      el('circle', { class: 'val-r', cx: x2, cy: y(s.now), r: 5, fill: s.color }, g);
      svgText(g, x1 - 12, y(s.was) + 5, fmt(s.was), { class: 'val', 'text-anchor': 'end' });
      svgText(g, x2 + 12, y(s.now) + 5, fmt(s.now), { class: 'val val-r' });
      svgText(g, x2 + 56, y(s.now) + 5, s.name, { class: 'name name-long' });
      svgText(g, x2 + 56, y(s.now) + 7, s.short, { class: 'name name-short' });
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

  function collisionOf(survey, signal) {
    if (signal === 0) return 'hidden';
    return signal === survey ? 'confirmed' : 'fault';
  }

  function setupCollision() {
    const quads = document.getElementById('tkQuads');
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
        counts[k] = (counts[k] || 0) + 1;
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
        b.textContent = q.name + '. ';
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

  /* ── start ── */
  drawPlates();
  setupGuess('online');
  setupGuess('methods');
  drawSlope();
  setupSeismo();
  setupCollision();
  buildRail();
  const start = scenes.findIndex(s => '#' + s.id === location.hash);
  go(start >= 0 ? start : 0, { noHash: true });
})();
