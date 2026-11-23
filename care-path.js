/* ═══════════════════════════════════════════════════════════════════
   "A walk through care" on district-health.html (#carewalk).
   A hundred mothers and a hundred children walk down two terraced
   paths. At each stop, the dots the survey counts as reaching that care
   stay on the path; the rest step aside onto a ledge, and may rejoin at
   the next stop. "Walk on" (and, where the page allows, the arrow keys)
   moves the walk one stop at a time.

   The stops and their words live here; the numbers are read from
   datasets/nfhs_district_rounds.json, so Odisha, rural, urban and every
   district come from the same file. The page passes only its element
   ids: CarePath({ scene, svg, keys }).

   Each dot is one in a hundred. The survey counts every stop on its
   own, so a dot is a share, not the same woman or child all the way:
   that is why dots can rejoin.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* The two paths and their stops. Every number is read at run time from
     the district fact-sheet file (which also carries Odisha, rural and
     urban), matched on the indicator's name: an exact name wins, else the
     start of it. tests/care-path.test.js checks each match lands on
     exactly one row. */
  const PATHS = [
    {
      id: 'mother', name: 'Mothers', owner: 'Mothers’', who: 'mothers', start: '100 mothers',
      stops: [
        { match: 'Mothers who had any antenatal care visits', short: 'Any check-up', label: 'met a health worker at least once in pregnancy',
          about: 'The first stop: at least one antenatal check-up during the pregnancy.' },
        { match: 'Mothers who had an antenatal check-up in the first trimester', short: 'First 3 months', label: 'had a check-up in the first three months',
          about: 'An early check-up, in the first three months, is when risks are easiest to spot.' },
        { match: 'Mothers who had at least 4 antenatal care visits', short: '4+ check-ups', label: 'had four or more check-ups',
          about: 'Four or more check-ups across the pregnancy is the standard the survey counts.' },
        { match: 'Mothers who consumed iron folic acid for 100 days or more', short: 'Iron, 100 days', label: 'took iron and folic acid for 100 days or more',
          about: 'Iron and folic acid tablets for 100 days or more guard against anaemia, for mother and baby.' },
        { match: 'Institutional births', short: 'Facility birth', label: 'gave birth in a hospital or health centre',
          about: 'The birth itself: the stop where trained hands matter most.' },
        { match: 'Mothers who received postnatal care', short: 'Check in 2 days', label: 'were checked by a health worker within two days of the birth',
          about: 'A check-up in the first two days after the birth, the days when care matters most for a new mother.' }
      ]
    },
    {
      id: 'child', name: 'Children', owner: 'Children’s', who: 'children', start: '100 children',
      stops: [
        { match: 'Children who received postnatal care', short: 'Check in 2 days', label: 'were checked by a health worker within two days of birth',
          about: 'The first stop for a newborn: a check-up within two days of birth.' },
        { match: 'Children age 12-23 months who have received BCG', short: 'BCG', label: 'received BCG, the first vaccine',
          about: 'BCG, given at birth, protects against severe forms of tuberculosis. Counted among children aged 12 to 23 months.' },
        { match: 'Children age 12-23 months who have received 3 doses of pentavalent', short: '3 pentavalent', label: 'received all three pentavalent doses',
          about: 'Three pentavalent doses protect against five diseases, among them diphtheria and whooping cough.' },
        { match: 'Children age 12-23 months who have received the first dose of measles', short: '1st measles', label: 'received the first measles-containing dose',
          about: 'The first measles-containing vaccine, due at about nine months.' },
        { match: 'Children age 12-23 months fully vaccinated based on information from either', short: 'Fully vaccinated', label: 'were fully vaccinated by their second birthday',
          about: 'Fully vaccinated means BCG, a measles dose, and three doses each of polio and pentavalent (or DPT).' },
        { match: 'Children age 24-35 months who have received a second dose of measles', short: '2nd measles', label: 'received the second measles dose',
          about: 'The second measles dose, due in the second year, completes the set. Counted among children aged 24 to 35 months.' }
      ]
    }
  ];

  /* ── data (pure; tests/care-path.test.js uses these) ─────────── */
  /* an exact name wins; otherwise the rows whose name starts with it */
  function findRows(data, match) {
    const exact = data.indicators.filter(r => r.indicator === match);
    return exact.length ? exact : data.indicators.filter(r => r.indicator.indexOf(match) === 0);
  }

  /* key: 'odisha' | 'rural' | 'urban' | 'd:<district>'; round 6 or 5 */
  function readValue(row, key, round) {
    if (!row) return null;
    const o = row.odisha || {};
    let v = null;
    if (key === 'odisha') v = round === 5 ? o.nfhs5 : o.nfhs6;
    else if (key === 'rural') v = round === 5 ? null : o.nfhs6_rural;
    else if (key === 'urban') v = round === 5 ? null : o.nfhs6_urban;
    else if (key.indexOf('d:') === 0) {
      const d = (row.districts || {})[key.slice(2)];
      v = d ? d[round === 5 ? 1 : 0] : null;
    }
    return typeof v === 'number' ? v : null;
  }

  /* [[six mother values], [six child values]], null where not published */
  function valuesFor(data, cfg, key, round) {
    return (cfg.paths || PATHS).map(p => p.stops.map(s => readValue(findRows(data, s.match)[0], key, round)));
  }

  const of100 = v => (v == null ? null : Math.max(0, Math.min(100, Math.round(v))));

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PATHS, DATA: 'datasets/nfhs_district_rounds.json', findRows, readValue, valuesFor, of100 };
  }
  if (!global.document) return;

  /* ── drawing ─────────────────────────────────────────────────── */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const W = 800, H = 660;
  const CX = [200, 560];             /* mothers, children */
  const STOPS = 6;
  const LAST = 1 + STOPS * 2;        /* 0 start · 1–6 mothers · 7–12 children · 13 the whole walk */
  const HW = 56, HH = 32, THICK = 14; /* a landing */
  const LHW = 44, LHH = 25;          /* the ledge beside it */

  function el(name, attrs, parent) {
    const n = document.createElementNS(SVGNS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  const pts = a => a.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');

  /* where stop k sits on path p (k = 0 is the start) */
  function landing(p, k) { return { x: CX[p] + (k % 2 ? 40 : -40), y: 78 + k * 84 }; }
  /* the ledge sits to the left of each landing, its label to the right,
     so the two paths never crowd each other in the middle */
  function ledge(p, k) {
    const L = landing(p, k);
    return { x: L.x - 112, y: L.y + 20 };
  }

  /* a hundred places on an isometric 10 × 10 grid, nearest the middle
     first, so any count reads as one compact group */
  function slots(step) {
    const out = [];
    for (let a = 0; a < 10; a++) {
      for (let b = 0; b < 10; b++) {
        const u = (a - 4.5) * step, v = (b - 4.5) * step;
        out.push({ x: (u - v) * 0.866, y: (u + v) * 0.5 });
      }
    }
    return out.sort((p, q) => (p.x * p.x + 3 * p.y * p.y) - (q.x * q.x + 3 * q.y * q.y));
  }
  const ON_PATH = slots(6.2);
  const ASIDE = slots(4.9);

  function slab(g, x, y, hw, hh, t, cls) {
    const s = el('g', { class: cls }, g);
    el('polygon', { class: 'side-l', points: pts([[x - hw, y], [x, y + hh], [x, y + hh + t], [x - hw, y + t]]) }, s);
    el('polygon', { class: 'side-r', points: pts([[x, y + hh], [x + hw, y], [x + hw, y + t], [x, y + hh + t]]) }, s);
    el('polyline', { class: 'seam', points: pts([[x - hw, y + t * 0.55], [x, y + hh + t * 0.55], [x + hw, y + t * 0.55]]) }, s);
    return el('polygon', { class: 'top', points: pts([[x, y - hh], [x + hw, y], [x, y + hh], [x - hw, y]]) }, s);
  }

  /* stairs from landing k down to k + 1, leaving by the front edge */
  function stairs(g, A, B) {
    const right = B.x > A.x;
    const P = { x: A.x + (right ? HW : -HW) / 2, y: A.y + HH / 2 };
    const Q = { x: B.x + (right ? -HW : HW) / 2, y: B.y - HH / 2 };
    const e = right ? { x: 0.866 * 15, y: -0.5 * 15 } : { x: 0.866 * 15, y: 0.5 * 15 };
    const s = el('g', { class: 'stairs' }, g);
    el('polygon', { class: 'ramp', points: pts([[P.x - e.x, P.y - e.y], [P.x + e.x, P.y + e.y], [Q.x + e.x, Q.y + e.y], [Q.x - e.x, Q.y - e.y]]) }, s);
    for (let i = 1; i < 9; i++) {
      const f = i / 9;
      const m = { x: P.x + (Q.x - P.x) * f, y: P.y + (Q.y - P.y) * f };
      el('line', { class: 'tread', x1: (m.x - e.x).toFixed(1), y1: (m.y - e.y).toFixed(1), x2: (m.x + e.x).toFixed(1), y2: (m.y + e.y).toFixed(1) }, s);
    }
  }

  function setup(opts, api) {
    const cfg = Object.assign({ data: 'datasets/nfhs_district_rounds.json', paths: PATHS }, opts);
    const svg = document.getElementById(cfg.svg);
    const scene = document.getElementById(cfg.scene);
    if (!svg || !scene) return null;
    const reduce = !!(api && api.reduceMotion);
    const q = sel => scene.querySelector(sel);
    const ui = {
      stop: q('[data-path="stop"]'), big: q('[data-path="big"]'), lead: q('[data-path="lead"]'),
      chip: q('[data-path="chip"]'), table: q('[data-path="table"]'), status: q('[data-path="status"]'),
      who: q('[data-path="who"]'), beside: q('[data-path="beside"]'),
      back: q('[data-path-step="-1"]'), on: q('[data-path-step="1"]'), count: q('[data-path="count"]'),
      live: q('[data-path="live"]')
    };
    const canLeave = !!(api && api.leave);

    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    const world = el('g', { class: 'world' }, svg);
    if (reduce) world.style.transition = 'none';

    /* the two paths: architecture, labels, then the dots on top */
    const P = [0, 1].map(p => {
      const g = el('g', { class: 'path-group path-' + cfg.paths[p].id }, world);
      const arch = el('g', { class: 'arch' }, g);
      const tops = [];
      for (let k = 0; k <= STOPS; k++) {
        const L = landing(p, k), E = ledge(p, k);
        if (k > 0) slab(arch, E.x, E.y, LHW, LHH, 8, 'ledge');
        tops.push(slab(arch, L.x, L.y, HW, HH, THICK, 'landing'));
        if (k < STOPS) stairs(arch, L, landing(p, k + 1));
      }
      const title = el('text', { class: 'path-title', x: CX[p], y: 26, 'text-anchor': 'middle' }, g);
      title.textContent = cfg.paths[p].name;

      const labels = [];
      for (let k = 0; k <= STOPS; k++) {
        const L = landing(p, k);
        const x = L.x + HW + 10;
        const anchor = 'start';
        const lg = el('g', { class: 'plabel' + (k === 0 ? ' is-shown' : '') }, g);
        const t1 = el('text', { class: 'pl-short', x: x, y: L.y - 10, 'text-anchor': anchor }, lg);
        t1.textContent = k === 0 ? 'Start' : cfg.paths[p].stops[k - 1].short;
        const t2 = el('text', { class: 'pl-n', x: x, y: L.y + 16, 'text-anchor': anchor }, lg);
        const n = el('tspan', {}, t2);
        n.textContent = k === 0 ? '100' : '';
        const o = el('tspan', { class: 'pl-of', dx: 4 }, t2);
        o.textContent = k === 0 ? cfg.paths[p].who : 'of 100';
        const c = el('text', { class: 'pl-cmp', x: x, y: L.y + 33, 'text-anchor': anchor }, lg);
        labels.push({ g: lg, n: n, cmp: c });
      }

      const dots = [];
      const dg = el('g', { class: 'dots' }, g);
      for (let i = 0; i < 100; i++) {
        const d = el('circle', { class: 'pd', r: 2.6, cx: 0, cy: 0 }, dg);
        if (!reduce) d.style.transitionDelay = ((i % 20) * 0.018 + Math.floor(i / 20) * 0.05).toFixed(3) + 's';
        dots.push(d);
      }
      return { g, tops, labels, dots, at: -1 };
    });

    /* ── state ── */
    let data = null, failed = false;
    let s = 0;
    let who = 'odisha', beside = '';
    let A = null, B = null;   /* [[mother values], [child values]] */
    let settle = 0;

    function groupName(key) {
      if (key === 'odisha') return 'Odisha';
      if (key === 'rural') return 'Rural Odisha';
      if (key === 'urban') return 'Urban Odisha';
      return key.slice(2);
    }
    function besideName(short) {
      if (!beside) return '';
      if (beside === 'prev') return short ? '2019–21' : groupName(who) + ', 2019–21';
      if (short) return beside === 'odisha' ? 'Odisha' : beside === 'rural' ? 'Rural' : beside === 'urban' ? 'Urban' : beside.slice(2);
      return groupName(beside);
    }

    function load() {
      A = valuesFor(data, cfg, who, 6);
      B = !beside ? null : beside === 'prev' ? valuesFor(data, cfg, who, 5) : valuesFor(data, cfg, beside, 6);
    }

    /* where each path's group stands at walk step s */
    const stopOf = (p, st) => (p === 0 ? Math.min(st, STOPS) : st <= STOPS ? 0 : Math.min(st - STOPS, STOPS));
    const countAt = (p, k) => (k === 0 || !A ? 100 : of100(A[p][k - 1]));

    function place(d, x, y) { d.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)'; }

    function moveDots(p, k, n, split) {
      const L = landing(p, k), E = ledge(p, k);
      P[p].dots.forEach((d, i) => {
        const aside = split && n != null && i >= n;
        if (aside) {
          const o = ASIDE[i - n];
          place(d, E.x + o.x, E.y + o.y);
        } else {
          const o = ON_PATH[i];
          place(d, L.x + o.x, L.y + o.y);
        }
        d.classList.toggle('is-aside', aside);
      });
    }

    function paintPath(p) {
      const k = stopOf(p, s);
      const n = countAt(p, k);
      const moved = P[p].at !== k;
      P[p].at = k;
      if (moved && !reduce && k > 0) {
        /* the whole group arrives, then the ones not counted step aside */
        moveDots(p, k, n, false);
        clearTimeout(P[p].timer);
        P[p].timer = setTimeout(() => moveDots(p, k, n, true), 1250);
      } else {
        clearTimeout(P[p].timer);
        moveDots(p, k, n, true);
      }
      P[p].tops.forEach((t, j) => t.classList.toggle('is-here', j === k && s > 0 && s < LAST));
      P[p].labels.forEach((lb, j) => {
        if (j === 0) return;
        lb.g.classList.toggle('is-shown', j <= k);
        const v = A ? of100(A[p][j - 1]) : null;
        lb.n.textContent = v == null ? '–' : String(v);
        const b = B ? of100(B[p][j - 1]) : null;
        lb.cmp.textContent = B ? besideName(true) + ': ' + (b == null ? 'n/a' : b) : '';
        lb.cmp.classList.toggle('is-ahead', B != null && b != null && v != null && v > b);
      });
      const active = s === 0 || s === LAST || (p === 0 ? s <= STOPS : s > STOPS);
      P[p].g.classList.toggle('is-dim', !active);
    }

    /* the camera: close on the active stop, wide at the start and end */
    function camera() {
      const rw = svg.getBoundingClientRect().width || W;
      let z, cx, cy;
      if (s === 0) { z = 1.28; cx = W / 2; cy = 150; }
      else if (s === LAST) { z = 1; cx = W / 2; cy = H / 2; }
      else {
        const p = s <= STOPS ? 0 : 1;
        const L = landing(p, stopOf(p, s));
        z = rw < 520 ? 2.15 : 1.7;
        cx = L.x + 24;
        cy = L.y + 12;
      }
      const tx = Math.max(W - W * z, Math.min(0, W / 2 - cx * z));
      const ty = Math.max(H - H * z, Math.min(0, H / 2 - cy * z));
      world.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(' + z + ')';
    }

    /* ── the words beside the picture ── */
    function sentence(p, k) {
      const path = cfg.paths[p], stop = path.stops[k - 1];
      const v = A[p][k - 1], n = of100(v);
      if (n == null) return stop.about + ' The survey does not publish this stop for ' + groupName(who) + '.';
      let t = stop.about + ' ' + n + ' of 100 ' + path.who + ' ' + stop.label + ' (' + v.toFixed(1) + '%).';
      const prev = k > 1 ? of100(A[p][k - 2]) : 100;
      if (prev != null && n > prev) t += ' That is ' + (n - prev) + ' more than the last stop: some who missed it are back on the path.';
      else if (n < 100 && (prev == null || n < prev)) t += ' Reaching the other ' + (100 - n) + ' is the focus here.';
      return t;
    }

    function chip(p, k) {
      ui.chip.hidden = true;
      if (!B || k < 1) return;
      const n = of100(A[p][k - 1]), b = of100(B[p][k - 1]);
      const name = besideName(false);
      ui.chip.classList.remove('is-ahead', 'is-focus');
      if (b == null || n == null) ui.chip.textContent = name + ': not published for this stop';
      else if (n > b) { ui.chip.textContent = (n - b) + ' more than ' + name + ' (' + b + ')'; ui.chip.classList.add('is-ahead'); }
      else if (n < b) { ui.chip.textContent = 'Focus area · ' + name + ': ' + b + ' of 100'; ui.chip.classList.add('is-focus'); }
      else ui.chip.textContent = 'Level with ' + name + ' (' + b + ')';
      ui.chip.hidden = false;
    }

    function summary(p) {
      const st = cfg.paths[p].stops;
      const v = A[p].map(of100);
      let hi = -1, lo = -1;
      v.forEach((n, i) => {
        if (n == null) return;
        if (hi < 0 || n > v[hi]) hi = i;
        if (lo < 0 || n < v[lo]) lo = i;
      });
      if (hi < 0) return '';
      return cfg.paths[p].name + ' reach “' + st[hi].short + '” most often (' + v[hi] + ' of 100). “' + st[lo].short + '” has the most room to grow (' + v[lo] + ').';
    }

    function table() {
      const t = ui.table;
      t.innerHTML = '';
      const head = t.createTHead().insertRow();
      ['Stop', groupName(who) + ', 2023–24'].concat(B ? [besideName(false) + (beside === 'prev' ? '' : ', 2023–24')] : []).forEach(h => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = h;
        head.appendChild(th);
      });
      cfg.paths.forEach((path, p) => {
        const body = t.createTBody();
        const r0 = body.insertRow();
        const th = document.createElement('th');
        th.scope = 'rowgroup';
        th.colSpan = B ? 3 : 2;
        th.textContent = path.name;
        r0.appendChild(th);
        path.stops.forEach((stop, k) => {
          const r = body.insertRow();
          const name = document.createElement('th');
          name.scope = 'row';
          name.textContent = stop.short;
          r.appendChild(name);
          const n = of100(A[p][k]), b = B ? of100(B[p][k]) : null;
          const c1 = r.insertCell();
          c1.textContent = n == null ? '–' : n;
          if (B && n != null && b != null && n > b) c1.className = 'is-ahead';
          if (B) r.insertCell().textContent = b == null ? '–' : b;
        });
      });
      t.hidden = false;
    }

    function words() {
      ui.table.hidden = true;
      ui.chip.hidden = true;
      ui.big.hidden = true;
      ui.count.textContent = s === 0 ? '' : s === LAST ? '' : (s <= STOPS ? s : s - STOPS) + ' / ' + STOPS;
      if (s === 0) {
        ui.stop.textContent = 'Two paths · six stops each';
        ui.lead.textContent = 'Picture 100 mothers in ' + groupName(who) + ' setting out on a pregnancy, and 100 children setting out on their first two years. At each stop, the national health survey counts how many get that care. Walk on to follow them.';
      } else if (s === LAST) {
        ui.stop.textContent = 'The whole walk · ' + groupName(who);
        ui.lead.textContent = summary(0) + ' ' + summary(1);
        table();
      } else {
        const p = s <= STOPS ? 0 : 1, k = stopOf(p, s);
        ui.stop.textContent = cfg.paths[p].owner + ' path · stop ' + k + ' of ' + STOPS;
        const n = of100(A[p][k - 1]);
        ui.big.innerHTML = '<b>' + (n == null ? '–' : n) + '</b> of 100';
        ui.big.hidden = false;
        ui.lead.textContent = sentence(p, k);
        chip(p, k);
      }
      ui.back.disabled = s === 0;
      ui.on.textContent = s === 0 ? 'Start walking' : s === LAST ? (canLeave ? cfg.leaveLabel || 'Continue' : 'Walk again') : s === STOPS ? 'On to the children' : 'Walk on';
      const say = ui.stop.textContent + '. ' + (ui.big.hidden ? '' : ui.big.textContent + '. ') + (ui.chip.hidden ? '' : ui.chip.textContent + '.');
      svg.setAttribute('aria-label', say);
      return say;
    }

    function render(speak) {
      if (!data) return;
      paintPath(0);
      paintPath(1);
      camera();
      const say = words();
      if (!speak) return;
      if (api && api.announce) api.announce(say);
      else if (ui.live) { ui.live.textContent = ''; setTimeout(() => { ui.live.textContent = say; }, 60); }
    }

    function step(dir) {
      if (!data) return !failed;   /* hold the reader here while the numbers load */
      const next = s + dir;
      if (next < 0 || next > LAST) return false;
      s = next;
      render(true);
      return true;
    }

    /* ── controls ── */
    function fill(select, withNone) {
      const add = (parent, value, text) => {
        const o = document.createElement('option');
        o.value = value; o.textContent = text;
        parent.appendChild(o);
        return o;
      };
      if (withNone) { add(select, '', 'Nothing beside it'); add(select, 'prev', 'The same place, 2019–21'); }
      add(select, 'odisha', withNone ? 'Odisha, 2023–24' : 'Odisha');
      add(select, 'rural', 'Rural Odisha');
      add(select, 'urban', 'Urban Odisha');
      const og = document.createElement('optgroup');
      og.label = 'Districts';
      Object.keys(data.indicators[0].districts).sort().forEach(d => {
        const ok = cfg.paths.every(p => p.stops.every(st => readValue(findRows(data, st.match)[0], 'd:' + d, 6) != null));
        if (ok) add(og, 'd:' + d, d);
      });
      select.appendChild(og);
    }
    function syncBeside() {
      /* the 2019–21 round has no rural or urban split; and a path beside itself says nothing */
      Array.from(ui.beside.options).forEach(o => {
        o.disabled = (o.value === 'prev' && (who === 'rural' || who === 'urban')) || o.value === who;
      });
      if (ui.beside.selectedOptions[0] && ui.beside.selectedOptions[0].disabled) ui.beside.value = '';
      beside = ui.beside.value;
    }

    scene.addEventListener('click', e => {
      const b = e.target.closest('[data-path-step]');
      if (!b) return;
      walk(+b.dataset.pathStep);
    });

    /* past either end: hand back to the story, or start the walk again */
    function walk(dir) {
      if (step(dir)) return;
      if (canLeave) api.leave(dir);
      else if (dir > 0 && data) { s = 0; render(true); }
    }

    /* on a long page the arrow keys belong to the page, so they walk
       only while focus is inside this section */
    if (cfg.keys) {
      scene.addEventListener('keydown', e => {
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'select' || tag === 'input' || tag === 'textarea') return;
        if (e.key === 'ArrowRight') { e.preventDefault(); walk(1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); walk(-1); }
      });
    }

    let resizeT = 0;
    window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (data) camera(); }, 120); });

    /* the start, before the numbers arrive */
    [0, 1].forEach(p => moveDots(p, 0, 100, false));
    ui.on.disabled = true;

    fetch(cfg.data)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(json => {
        data = json;
        const missing = cfg.paths.some(p => p.stops.some(st => findRows(data, st.match).length !== 1));
        if (missing) throw new Error('indicator names changed');
        fill(ui.who, false);
        fill(ui.beside, true);
        ui.who.addEventListener('change', () => { who = ui.who.value; syncBeside(); load(); render(true); });
        ui.beside.addEventListener('change', () => { syncBeside(); load(); render(true); });
        syncBeside();
        load();
        ui.on.disabled = false;
        ui.status.hidden = true;
        render(false);
      })
      .catch(() => {
        failed = true;
        ui.status.textContent = 'The survey numbers could not be loaded here. The rest of the story still works.';
        ui.status.hidden = false;
        ui.on.disabled = false;
      });

    return { step: step };
  }

  global.CarePath = setup;
})(typeof window !== 'undefined' ? window : globalThis);
