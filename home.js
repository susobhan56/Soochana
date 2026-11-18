/* ═══════════════════════════════════════════════════════════════════
   home.js — the home page (index.html)

     1. theme and language switches
     2. the population clock (needs soochana_live.js, data/key_stats.js)
     3. the story's chapter bar (story.js draws and follows the scroll)
     +  the hero dot field and the welcome screen
     4. topic tabs            (TOPICS below)
     5. the district finder
     6. page dots and presentation mode

   Odia: an element with data-or="…" shows that text when Odia is chosen;
   its English text is kept and put back for English.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  var fmt = function (n) { return Math.round(n).toLocaleString('en-IN'); };

  /* the header's height, for the sticky story picture and the hero */
  function topHeight() {
    document.body.style.setProperty('--top-h', document.querySelector('header.site-nav').offsetHeight + 'px');
  }
  topHeight();
  window.addEventListener('resize', topHeight);
  window.addEventListener('load', topHeight);

  /* line icons from icons.js: <i data-ic="name"></i> becomes the drawing */
  var Icons = window.SoochanaIcons;
  function icon(name, cls) {
    return Icons ? Icons.svg(name, cls) : document.createTextNode('');
  }
  document.querySelectorAll('i[data-ic]').forEach(function (n) {
    n.replaceWith(icon(n.getAttribute('data-ic'), 'ic'));
  });

  /* ── 1. theme and language ─────────────────────────────── */

  var lang = read('soochana-lang') === 'or' ? 'or' : 'en';
  var langListeners = [];
  function applyLang() {
    root.lang = lang;
    document.querySelectorAll('[data-or]').forEach(function (n) {
      if (n.dataset.en == null) n.dataset.en = n.textContent;
      n.textContent = lang === 'or' ? n.dataset.or : n.dataset.en;
    });
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.lang === lang);
    });
    langListeners.forEach(function (f) { f(); });
  }
  document.querySelectorAll('[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () { lang = b.dataset.lang; store('soochana-lang', lang); applyLang(); });
  });
  function T(en, or) { return lang === 'or' && or ? or : en; }

  /* ── 2. the population clock ───────────────────────────── */
  var L = window.SoochanaLive;
  var KS = window.SOOCHANA_KEY_STATS;
  function keyStat(re) {
    var out = null;
    ((KS && KS.groups) || []).forEach(function (g) {
      (g.tiles || []).forEach(function (t) { if (t.label && re.test(t.label)) out = t; });
    });
    return out;
  }
  var CBR = parseFloat((keyStat(/^birth rate/i) || {}).value) || 15.8;
  var CDR = parseFloat((keyStat(/^death rate/i) || {}).value) || 7.9;
  $('mCbr').textContent = CBR; $('mCdr').textContent = CDR;

  var period = 'day';
  var arrived = Date.now();
  function every(perYear) {
    var secs = Math.max(1, Math.round(L.YEAR_MS / 1000 / perYear));
    var m = Math.floor(secs / 60), s = secs % 60;
    return (m ? m + ' min ' : '') + (s || !m ? s + ' sec' : '');
  }
  function periodStart() {
    var d = new Date();
    if (period === 'visit') return arrived;
    if (period === 'year') return new Date(d.getFullYear(), 0, 1).getTime();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }

  function startClock() {
    var numEl = $('clockNum'), barEl = $('clockBar');
    var shown = -1, counting = true;

    function rates() {
      var y = L.yearNow(), dt = 1 / 12, pop = L.statePop(y);
      return {
        pop: pop,
        net: (L.statePop(y + dt) - L.statePop(y - dt)) / (2 * dt),
        births: pop * CBR / 1000,
        deaths: pop * CDR / 1000
      };
    }

    function paint() {
      var r = rates();
      if (!counting) {
        var whole = Math.floor(r.pop);
        if (whole !== shown) {
          if (shown !== -1 && !reduced) {
            numEl.classList.remove('tick'); void numEl.offsetWidth; numEl.classList.add('tick');
          }
          shown = whole;
          numEl.textContent = fmt(whole);
        }
        barEl.style.width = ((r.pop - whole) * 100).toFixed(1) + '%';
      }
      var frac = (Date.now() - periodStart()) / L.YEAR_MS;
      $('vBirths').textContent = fmt(Math.floor(r.births * frac));
      $('vDeaths').textContent = fmt(Math.floor(r.deaths * frac));
      $('vNet').textContent = fmt(Math.floor(r.net * frac));
    }

    function words() {
      var r = rates();
      $('clockCrore').textContent = T('About ' + (r.pop / 1e7).toFixed(2) + ' crore people.',
        'ପ୍ରାୟ ' + (r.pop / 1e7).toFixed(2) + ' କୋଟି ଲୋକ।');
      $('clockPace').textContent = T('The bar fills as the next person is added, about once every ' + every(r.net) + '.',
        'ପ୍ରତି ' + every(r.net) + ' ରେ ପ୍ରାୟ ଜଣେ ଲେଖାଏଁ ବଢ଼ୁଛନ୍ତି।');
      $('vBirthsEvery').textContent = T('about one every ' + every(r.births), 'ପ୍ରତି ' + every(r.births) + ' ରେ ପ୍ରାୟ ଜଣେ');
      $('vDeathsEvery').textContent = T('about one every ' + every(r.deaths), 'ପ୍ରତି ' + every(r.deaths) + ' ରେ ପ୍ରାୟ ଜଣେ');
      $('vNetEvery').textContent = T('about ' + fmt(Math.round(r.net / 365.2425 / 10) * 10) + ' a day',
        'ଦିନକୁ ପ୍ରାୟ ' + fmt(Math.round(r.net / 365.2425 / 10) * 10));
    }
    langListeners.push(words);
    words();

    document.querySelectorAll('[data-period]').forEach(function (b) {
      b.addEventListener('click', function () {
        period = b.dataset.period;
        document.querySelectorAll('[data-period]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        paint();
      });
    });

    /* one opening moment: the count climbs from 1951 to this second */
    L.tween(L.stateAt(L.years[0]), L.statePop(L.yearNow()), 2600, function (v) {
      numEl.textContent = fmt(v);
    }, function () { counting = false; paint(); }, L.easeInOut);

    paint();
    setInterval(paint, 250);
  }

  /* ── 3. the story stepper ──────────────────────────────── */
  var CH = [
    ['who', 'Who we are', 'ଆମେ କିଏ'],
    ['growth', 'How we grew', 'କିପରି ବଢ଼ିଲୁ'],
    ['fert', 'Family size', 'ପରିବାର ଆକାର'],
    ['age', 'Young and old', 'ଯୁବ ଓ ବୟସ୍କ'],
    ['where', 'District by district', 'ଜିଲ୍ଲା ଅନୁସାରେ'],
    ['asks', 'Opportunities', 'ସୁଯୋଗ']
  ];
  var story = (function () {
    var sec = $('story');
    var steps = [].slice.call(sec.querySelectorAll('.story-step'));
    var tabs = $('stTabs');
    function first(ch) { return steps.filter(function (s) { return s.dataset.ch === ch; })[0]; }
    function to(step) { if (step) step.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }); }
    var buttons = CH.map(function (c, k) {
      var b = el('button');
      b.type = 'button';
      var t = el('span', null, c[1]);
      t.dataset.or = c[2];
      b.appendChild(el('span', 'n', String(k + 1)));
      b.appendChild(t);
      b.addEventListener('click', function () { to(first(c[0])); });
      tabs.appendChild(b);
      return b;
    });
    function mark(ch) { buttons.forEach(function (b, j) { b.setAttribute('aria-current', CH[j][0] === ch); }); }
    mark('who');
    var bar = $('stProgress');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          mark(e.target.dataset.ch);
          if (bar) bar.style.width = ((steps.indexOf(e.target) + 1) / steps.length * 100) + '%';
        });
      }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
      steps.forEach(function (s) { io.observe(s); });
    }
    /* the card nearest the middle of the screen, for the presentation keys */
    function at() {
      var mid = innerHeight / 2, best = 0, gap = Infinity;
      steps.forEach(function (s, j) {
        var r = s.getBoundingClientRect(), d = Math.abs((r.top + r.bottom) / 2 - mid);
        if (d < gap) { gap = d; best = j; }
      });
      return best;
    }
    function move(d) {
      var k = at() + d;
      if (k < 0 || k >= steps.length) return false;
      to(steps[k]);
      return true;
    }
    return { next: function () { return move(1); }, prev: function () { return move(-1); }, el: sec };
  })();

  /* ── 4. topic tabs ─────────────────────────────────────── */
  /* Figures also shown in data/key_stats.js are read from there (ks:);
     the rest are typed here with their source, as on the deeper pages. */
  function ks(re, fallback) { var t = keyStat(re); return t ? t.value : fallback; }
  var ORGI = 'Population Projections for India and States 2011–2036, Technical Group on Population Projections, National Commission on Population, MoHFW (July 2020)';
  var ORGI_S = 'ORGI Technical Group projections (2020)';
  var NFHS = 'NFHS-6 (2023–24), IIPS and MoHFW, fact sheets published May 2026; NFHS-5 (2019–21)';
  var NFHS_S = 'NFHS-6 (2023–24, published May 2026) and NFHS-5 (2019–21)';
  var SIIMS = 'South India Interstate Migration Survey 2026 (IIMAD, UNFPA and IOM)';
  var TOPICS = [
    { id: 'people', art: 'population-aerial.jpg', ic: 'users', name: 'Population', or: 'ଜନସଂଖ୍ୟା', tc: '#1e2a78', tf: '#fff',
      num: '4.57 Cr', label: 'people in 2021, projected',
      say: 'Odisha is home to about 3% of India\'s people. Families are smaller than a generation ago and people are living longer.',
      src: ORGI,
      facts: [
        [ks(/total fertility/i, '1.7'), 'children per woman, from 1.8 in NFHS-5', NFHS_S],
        ['987', 'females per 1,000 males in 2021, rising to 998 by 2036', ORGI_S],
        ['64.9%', 'aged 15 to 59, 2021', ORGI_S],
        ['23%', 'belong to a Scheduled Tribe, from 62 communities', 'Census of India 2011']
      ],
      viz: { kind: 'ages', title: 'How the age mix is changing, 2011 to 2036',
             note: 'In every 100 people: children under 15, working ages 15 to 59, and people aged 60 or over.' },
      href: 'theme_detail.html?theme=demography', go: 'Open the demography briefs' },
    { id: 'health', art: 'health-infrastructure.jpg', ic: 'heart', name: 'Health', or: 'ସ୍ୱାସ୍ଥ୍ୟ', tc: '#0b6b50', tf: '#fff',
      num: ks(/life expectancy/i, '70.4'), label: 'years of life expected at birth',
      say: 'More births take place in health facilities, more families have health cover and more children are fully vaccinated than in the previous survey round.',
      src: 'SRS Abridged Life Tables 2020-2024',
      facts: [
        ['93.9%', 'births in a health facility, up from 92.2%', NFHS_S],
        ['82.7%', 'households with health cover, up from 47.9%', NFHS_S],
        [ks(/infant mortality/i, '28'), 'infant deaths per 1,000 live births', 'SRS Statistical Report 2024'],
        ['26.8%', 'children under 5 stunted, down from 31%', NFHS_S]
      ],
      viz: { kind: 'rounds', title: 'From one survey to the next: health',
             rows: [[7, 'Households with health cover'], [35, 'Births in a health facility'],
                    [32, 'Mothers who took iron and folic acid for 100 days or more'],
                    [51, 'Children given the second measles dose'],
                    [94, 'Young women using hygienic period products'],
                    [69, 'Children under 5 who are stunted', -1],
                    [95, 'Married women who have ever faced spousal violence', -1]],
             note: 'A selection of indicators where Odisha gained. Next areas of focus: four or more antenatal visits (73.6%, from 78.1%) and child wasting (22.1%, from 18.1%). All 101 indicators are on the district health page.' },
      href: 'district-health.html', go: 'See health in each district' },
    { id: 'education', art: 'education-classroom.jpg', ic: 'cap', name: 'Education', or: 'ଶିକ୍ଷା', tc: '#ffc629', tf: '#10133a',
      num: '97.6%', label: 'of children move on from preparatory to middle school',
      say: 'Nearly every child enrols and moves up through the middle years. Keeping students through the secondary years is the next area of gain.',
      src: 'UDISE+ 2025-26',
      facts: [
        ['93.3', 'gross enrolment ratio, middle stage', 'UDISE+ 2025-26'],
        ['2.2%', 'dropout rate, middle stage', 'UDISE+ 2025-26'],
        [ks(/literacy/i, '72.9%'), 'literacy rate', 'Census of India 2011'],
        ['43.9%', 'women aged 15 to 49 with ten or more years of schooling, up from 33%', NFHS_S]
      ],
      viz: { kind: 'rounds', title: 'From one survey to the next: schooling and the internet',
             rows: [[12, 'Women with ten or more years of schooling'], [13, 'Men with ten or more years of schooling'],
                    [14, 'Women who have used the internet'], [15, 'Men who have used the internet'],
                    [9, 'Girls and women aged 6 and over who have attended school']],
             note: 'Adults aged 15 to 49 unless stated. Secondary-stage dropout, at 10% (UDISE+ 2025-26), is where the next gains in schooling lie.' },
      href: 'theme_detail.html?theme=education', go: 'Open the education briefs' },
    { id: 'ageing', art: 'ageing-cohort.jpg', ic: 'hourglass', name: 'Ageing', or: 'ବାର୍ଦ୍ଧକ୍ୟ', tc: '#5b2a6e', tf: '#fff',
      num: '11.5%', label: 'of people were aged 60 or over in 2021',
      say: 'Longer lives are a result of better health. By 2036 about 17 in every 100 people are projected to be 60 or older, which gives time to plan pensions, health and care well ahead.',
      src: ORGI,
      facts: [
        ['17.0%', 'projected share aged 60+, 2036', ORGI_S],
        ['52 lakh', 'people aged 60+, 2021', ORGI_S],
        ['84 lakh', 'people aged 60+, projected 2036', ORGI_S],
        ['71.8', 'years of life expected for women; 69.2 for men', 'SRS Abridged Life Tables 2020-2024']
      ],
      viz: { kind: 'elders', title: 'People aged 60 and over, 2011 to 2036',
             note: 'In lakh. The NFHS-6 household survey (2023–24, published May 2026) found 15.6% of people aged 60 or over, from 13.4% in NFHS-5 (2019–21).' },
      href: 'theme_detail.html?theme=ageing', go: 'Open the ageing briefs' },
    { id: 'cities', art: 'urbanization-build.jpg', ic: 'home', name: 'Cities and migration', or: 'ସହର ଓ ପ୍ରବାସ', tc: '#b3202a', tf: '#fff',
      num: '17', of100: 17, label: 'in every 100 people live in a town or city',
      say: 'Odisha is mostly rural, with urban growth centred on the Bhubaneswar and Cuttack corridor.',
      src: 'Census of India 2011',
      facts: [
        ['83', 'in every 100 live in a village', 'Census of India 2011'],
        ['48%', 'urban share in Khordha, the most urban district', 'Census of India 2011'],
        ['30', 'districts in 3 revenue divisions', 'Government of Odisha'],
        ['12%', 'of interstate migrant workers surveyed in Karnataka, Keralam and Tamil Nadu come from Odisha', SIIMS]
      ],
      viz: { kind: 'siims', title: 'Where South India\'s interstate migrant workers come from',
             rows: [['West Bengal', 26.2], ['Bihar', 21.8], ['Assam', 17.1], ['Odisha', 12.0], ['Uttar Pradesh', 9.6], ['Jharkhand', 5.6]],
             note: 'Share of 1,824 workers surveyed in 33 districts of Karnataka, Keralam and Tamil Nadu. Among workers from Odisha, 36.7% are in textiles and Odisha to Tiruppur is the third largest corridor. A sample survey of workers at destination, not a count of all migrants.' },
      href: 'theme_detail.html?theme=migration', go: 'Open the migration briefs' },
    { id: 'work', art: 'employment-cycle.jpg', ic: 'bars', name: 'Work', or: 'କର୍ମନିଯୁକ୍ତି', tc: '#0f5e7a', tf: '#fff',
      num: '69.2%', label: 'of people aged 15 to 59 are working or looking for work',
      say: 'Labour force participation in Odisha is above the national figure of 64.3%, for women as well as overall.',
      src: 'Periodic Labour Force Survey 2023-24',
      facts: [
        ['53.5%', 'women in the labour force; India 45.2%', 'PLFS 2023-24'],
        ['64.9%', 'of the population is of working age, 2021', ORGI_S],
        [ks(/industry/i, '41.3%'), 'of state value added comes from industry', 'OES 2025-26'],
        ['39.1%', 'comes from services; 19.6% from agriculture', 'OES 2025-26']
      ],
      viz: { kind: 'rounds', title: 'From one survey to the next: women\'s money and phones',
             rows: [[92, 'Women with a bank or savings account they use themselves'],
                    [93, 'Women with a mobile phone they use themselves'],
                    [91, 'Women who worked in the last 12 months and were paid in cash'],
                    [10, 'Households where a woman owns a house or land']],
             note: 'Women aged 15 to 49.' },
      href: 'theme_detail.html?theme=employment', go: 'Open the employment briefs' },
    { id: 'economy', art: 'nutrition-strength.jpg', ic: 'landmark', name: 'Economy and land', or: 'ଅର୍ଥନୀତି ଓ ଭୂମି', tc: '#10133a', tf: '#fff',
      num: ks(/gsdp/i, '₹9.88L Cr'), label: 'gross state domestic product, current prices',
      say: 'A third of the state is under forest, and industry is the largest part of the economy.',
      src: 'Odisha Economic Survey 2025-26',
      facts: [
        ['₹1,86,761', 'income per person', 'OES 2025-26'],
        ['155,707 km²', 'geographical area', 'Government of Odisha'],
        ['33.67%', 'of the area under forest', 'Government of Odisha'],
        ['317', 'tehsils', 'Government of Odisha']
      ], href: 'state.html', go: 'Open Odisha in depth' }
  ];
  /* 100 small people, the first n filled: a pictogram for "n in 100" */
  function people100(n) {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 112');
    svg.setAttribute('class', 'tp-people');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', n + ' in every 100 people');
    for (var q = 0; q < 100; q++) {
      var x = (q % 10) * 10, y = Math.floor(q / 10) * 11.2;
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', q < n ? 'on' : 'off');
      var head = document.createElementNS(NS, 'circle');
      head.setAttribute('cx', x + 5); head.setAttribute('cy', y + 2.4); head.setAttribute('r', 1.9);
      var body = document.createElementNS(NS, 'path');
      body.setAttribute('d', 'M' + (x + 2.4) + ' ' + (y + 10) + 'v-3.6a2.6 2.6 0 0 1 5.2 0v3.6z');
      g.appendChild(head); g.appendChild(body);
      svg.appendChild(g);
    }
    return svg;
  }

  /* The pictures under a topic. Figures are read from the two source
     files, so a panel never shows a number the datasets do not hold. */
  var VIZ = { orgi: null, nfhs: null };
  function pctText(v) { return (Math.round(v * 10) / 10).toFixed(1) + '%'; }
  function vizShell(v, src) {
    var fig = el('figure', 'tp-viz tp-anim');
    fig.appendChild(el('h3', 'tp-viz-title', v.title));
    var body = el('div', 'tp-viz-body');
    fig.appendChild(body);
    if (v.note) fig.appendChild(el('p', 'tp-viz-note', v.note));
    fig.appendChild(el('p', 'tp-viz-src', 'Source: ' + src));
    return { fig: fig, body: body };
  }
  var DRAW = {
    /* NFHS-5 (ring) to NFHS-6 (dot) on a 0 to 100 track */
    rounds: function (v) {
      if (!VIZ.nfhs) return null;
      var sh = vizShell(v, NFHS), by = {};
      VIZ.nfhs.indicators.forEach(function (r) { by[r.n] = r.odisha; });
      var key = el('div', 'tp-db-key');
      key.appendChild(el('i', 'r5')); key.appendChild(el('span', null, 'NFHS-5 (2019–21)'));
      key.appendChild(el('i', 'r6')); key.appendChild(el('span', null, 'NFHS-6 (2023–24)'));
      sh.body.appendChild(key);
      v.rows.forEach(function (r) {
        var o = by[r[0]];
        if (!o || o.nfhs5 == null || o.nfhs6 == null) return;
        var a = o.nfhs5, b = o.nfhs6, lower = r[2] === -1;
        var row = el('div', 'tp-db-row');
        row.appendChild(el('span', 'tp-db-lab', r[1]));
        var track = el('div', 'tp-db-track');
        var seg = el('i', 'seg');
        seg.style.left = Math.min(a, b) + '%'; seg.style.width = Math.abs(b - a) + '%';
        var was = el('b', 'r5'), now = el('b', 'r6');
        was.style.left = a + '%'; now.style.left = b + '%';
        track.appendChild(seg); track.appendChild(was); track.appendChild(now);
        row.appendChild(track);
        var val = el('span', 'tp-db-val');
        val.appendChild(document.createTextNode(pctText(a) + ' → '));
        val.appendChild(el('strong', null, pctText(b)));
        row.appendChild(val);
        row.setAttribute('role', 'img');
        row.setAttribute('aria-label', r[1] + ': ' + pctText(a) + ' in NFHS-5, ' + pctText(b) + ' in NFHS-6' + (lower ? ' (lower is better)' : ''));
        if (lower) row.appendChild(el('small', 'tp-db-dir', 'lower is better'));
        sh.body.appendChild(row);
      });
      return sh.fig;
    },
    /* one 100% bar per year: under 15, 15 to 59, 60 and over */
    ages: function (v) {
      if (!VIZ.orgi) return null;
      var o = VIZ.orgi.odisha, sh = vizShell(v, ORGI + ', Odisha, Table 17');
      var key = el('div', 'tp-db-key');
      [['a0', 'Under 15'], ['a1', '15 to 59'], ['a2', '60 and over']].forEach(function (k) {
        key.appendChild(el('i', 'sw ' + k[0])); key.appendChild(el('span', null, k[1]));
      });
      sh.body.appendChild(key);
      o.years.forEach(function (y, j) {
        var parts = [o.age_pct['0_14'][j], o.age_pct['15_59'][j], o.age_pct['60_plus'][j]];
        var row = el('div', 'tp-age-row');
        row.appendChild(el('span', 'tp-age-yr', y + (y > 2011 ? '' : ' Census')));
        var bar = el('div', 'tp-age-bar');
        parts.forEach(function (p, k) {
          var s = el('i', 'a' + k, pctText(p));
          s.style.width = p + '%';
          bar.appendChild(s);
        });
        row.appendChild(bar);
        row.setAttribute('role', 'img');
        row.setAttribute('aria-label', y + ': ' + pctText(parts[0]) + ' under 15, ' + pctText(parts[1]) + ' aged 15 to 59, ' + pctText(parts[2]) + ' aged 60 or over');
        sh.body.appendChild(row);
      });
      return sh.fig;
    },
    /* columns: people aged 60+, in lakh */
    elders: function (v) {
      if (!VIZ.orgi) return null;
      var o = VIZ.orgi.odisha, sh = vizShell(v, ORGI + ', Odisha, Table 17');
      var vals = o.age_000['60_plus'], max = Math.max.apply(null, vals);
      var cols = el('div', 'tp-cols');
      o.years.forEach(function (y, j) {
        var lakh = Math.round(vals[j] / 100);
        var c = el('div', 'tp-col');
        c.appendChild(el('b', null, String(lakh)));
        var bar = el('i');
        bar.style.height = Math.round(vals[j] / max * 170) + 'px';
        if (y > 2021) bar.className = 'proj';
        c.appendChild(bar);
        c.appendChild(el('span', null, String(y)));
        c.setAttribute('role', 'img');
        c.setAttribute('aria-label', y + ': ' + lakh + ' lakh people aged 60 or over');
        cols.appendChild(c);
      });
      sh.body.appendChild(cols);
      return sh.fig;
    },
    /* ranked bars, Odisha marked */
    siims: function (v) {
      var sh = vizShell(v, SIIMS), max = v.rows[0][1];
      v.rows.forEach(function (r) {
        var row = el('div', 'tp-rk-row' + (r[0] === 'Odisha' ? ' on' : ''));
        row.appendChild(el('span', 'tp-rk-lab', r[0]));
        var track = el('div', 'tp-rk-track'), bar = el('i');
        bar.style.width = (r[1] / max * 100) + '%';
        track.appendChild(bar);
        row.appendChild(track);
        row.appendChild(el('span', 'tp-rk-val', pctText(r[1])));
        sh.body.appendChild(row);
      });
      return sh.fig;
    }
  };

  (function topics() {
    var tabs = $('tpTabs'), panel = $('tpPanel'), cur = 0;
    var btns = TOPICS.map(function (t, k) {
      var b = el('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.appendChild(icon(t.ic, 'ic'));
      var nm = el('span', null, t.name);
      nm.dataset.or = t.or;
      b.appendChild(nm);
      b.style.setProperty('--tc', t.tc);
      b.style.setProperty('--tf', t.tf);
      b.addEventListener('click', function () { show(k); });
      b.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault(); e.stopPropagation();
        var n = (k + d + TOPICS.length) % TOPICS.length;
        show(n); btns[n].focus();
      });
      tabs.appendChild(b);
      return b;
    });
    function show(k) {
      cur = k;
      var t = TOPICS[k];
      btns.forEach(function (b, j) { b.setAttribute('aria-selected', j === k); b.tabIndex = j === k ? 0 : -1; });
      panel.style.setProperty('--tc', t.tc);
      panel.style.setProperty('--tf', t.tf);
      panel.textContent = '';
      var a = el('div', 'tp-lead tp-anim');
      var top = el('div', 'tp-lead-top');
      top.appendChild(el('div', 'tp-lead-num', t.num));
      /* a share out of 100 is drawn as 100 dots, like the story above */
      var share = t.of100 != null ? t.of100 : (/%$/.test(t.num) ? parseFloat(t.num) : null);
      if (share != null) {
        top.appendChild(people100(Math.round(share)));
      } else {
        var badge = el('div', 'tp-badge');
        badge.appendChild(icon(t.ic));
        top.appendChild(badge);
      }
      a.appendChild(top);
      a.appendChild(el('div', 'tp-lead-label', t.label));
      a.appendChild(el('p', 'tp-src', 'Source: ' + t.src));
      a.appendChild(el('p', 'tp-say', t.say));
      var go = el('a', 'btn tp-go', t.go);
      go.href = t.href;
      a.appendChild(go);
      var right = el('div', 'tp-right tp-anim');
      if (t.art) {
        /* the topic's illustration, pinned to the panel like a print */
        var fig = el('figure', 'tp-fig');
        var im = el('img');
        im.src = 'images/editorial/' + t.art;
        im.alt = '';
        im.loading = 'lazy';
        im.decoding = 'async';
        fig.appendChild(im);
        right.appendChild(fig);
      }
      var f = el('div', 'tp-facts');
      t.facts.forEach(function (x) {
        var d = el('div', 'tp-fact');
        d.appendChild(el('b', null, x[0]));
        /* a percentage gets a bar; "up from 47.9%" adds a mark at the earlier value */
        if (/^[\d.]+%$/.test(x[0])) {
          var bar = el('div', 'tp-bar'), fill = el('i');
          fill.style.width = Math.min(100, parseFloat(x[0])) + '%';
          bar.appendChild(fill);
          var was = /(?:up|down) from ([\d.]+)%/.exec(x[1]);
          if (was) { var tick = el('u'); tick.style.left = Math.min(100, parseFloat(was[1])) + '%'; bar.appendChild(tick); }
          d.appendChild(bar);
        }
        d.appendChild(el('span', null, x[1]));
        d.appendChild(el('small', null, x[2]));
        f.appendChild(d);
      });
      right.appendChild(f);
      panel.appendChild(a); panel.appendChild(right);
      if (t.viz && DRAW[t.viz.kind]) {
        var chart = DRAW[t.viz.kind](t.viz);
        if (chart) panel.appendChild(chart);
      }
    }
    show(0);
    /* the charts need the two source files; redraw the open topic when they arrive */
    function get(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(url); return r.json(); }); }
    Promise.all([get('datasets/orgi_state_projection.json'), get('datasets/nfhs6_state_factsheet.json')])
      .then(function (r) { VIZ.orgi = r[0]; VIZ.nfhs = r[1]; show(cur); })
      .catch(function (err) { if (window.console) console.warn('Home: topic charts did not load', err); });
    window.SoochanaTopics = { step: function (d) { var n = cur + d; if (n < 0 || n >= TOPICS.length) return false; show(n); return true; } };
  })();

  /* ── 5. the district finder ────────────────────────────── */
  function startDistricts() {
    var sel = $('dsSelect'), paths = L.drawMap($('dsMap'));
    var names = Object.keys(L.data).sort();
    var max = d3.max(names, function (n) { return L.districtPop(n, L.yearNow()); });
    var shade = d3.scaleLinear().domain([0, max]).range(['#c9cff2', '#1e2a78']);
    paths.attr('fill', function (f) { return shade(L.districtPop(L.dataName(f), L.yearNow())); })
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', function (f) { return L.dataName(f); });
    paths.append('title').text(function (f) { return L.dataName(f); });

    var all = el('option', null, 'All of Odisha'); all.value = '';
    sel.appendChild(all);
    names.forEach(function (n) { var o = el('option', null, n); o.value = n; sel.appendChild(o); });

    function show(name) {
      var y = L.yearNow();
      var now = name ? L.districtPop(name, y) : L.statePop(y);
      var at = function (yr) { return name ? L.data[name][yr].total : L.stateAt(yr); };
      $('dsName').textContent = name || 'Odisha';
      $('dsNow').textContent = L.lakh(now) + ' (estimate)';
      $('ds2011').textContent = L.lakh(at(2011));
      $('ds2036').textContent = L.lakh(at(2036));
      $('dsShare').textContent = name ? (now / L.statePop(y) * 100).toFixed(1) + '%' : '100%';
      $('dsOpen').href = name ? 'district.html?id=' + encodeURIComponent(name) : 'district-health.html';
      paths.classed('on', function (f) { return L.dataName(f) === name; });
    }
    function pick(name) { sel.value = name; show(name); }
    sel.addEventListener('change', function () { show(sel.value); });
    paths.on('mouseenter focus', function (ev, f) { show(L.dataName(f)); })
      .on('mouseleave blur', function () { show(sel.value); })
      .on('click', function (ev, f) { pick(L.dataName(f)); })
      .on('keydown', function (ev, f) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(L.dataName(f)); } });
    show('');
  }

  /* ── the hero's dot field ──────────────────────────────── */
  var fieldStarted = false;
  function startField() {
    if (fieldStarted) return;
    fieldStarted = true;
    var canvas = $('dotfield');
    if (!canvas || !window.dotfield3d) return;
    var titleEl = $('dfTitle'), hintEl = $('dfHint'), legendEl = $('dfLegend');
    var inner = document.querySelector('.lander-inner');
    var readout = document.querySelector('.lander-readout');
    var field = window.dotfield3d(canvas, {
      yearEl: $('dfYear'),
      shareEl: $('dfShare'),
      glow: true,
      /* bright dots for the indigo ground; ramp runs low to high */
      palette: {
        youth: '#7fd6b6', work: '#c9d4ff', senior: '#ff9a5c', eldest: '#ffc629',
        hover: '#ffc629', ripple: '255, 255, 255', label: '#ffffff',
        ramp: ['#3f57c9', '#7088ec', '#b3c1ff', '#ffe9a6', '#ffc629', '#ff9a5c']
      },
      scenes: ['map', 'growth', 'ageing', 'cohort', 'waffle', 'fertility'],
      onScene: function (sc) {
        titleEl.textContent = sc.title;
        hintEl.textContent = sc.caption;
        legendEl.textContent = '';
        (sc.legend || []).forEach(function (l) {
          var item = el('span'), dot = el('i');
          dot.style.background = l[0];
          item.appendChild(dot);
          item.appendChild(document.createTextNode(l[1]));
          legendEl.appendChild(item);
        });
      },
      onStep: function (stats) {
        if (stats[0]) $('dfStat1').textContent = stats[0][0];
        if (stats[1]) $('dfStat2').textContent = stats[1][0];
      },
      /* keep the shapes right of the words and above the readout */
      fitBox: function () {
        var c = canvas.getBoundingClientRect();
        if (c.width < 1101) return null;
        var bottom = c.bottom - 16;
        if (readout.offsetParent) bottom = Math.min(bottom, readout.getBoundingClientRect().top - 12);
        return {
          left: inner.getBoundingClientRect().right + 16 - c.left,
          right: c.width - 28,
          top: 20,
          bottom: bottom - c.top
        };
      }
    });

    /* play, pause and step through the pictures */
    var playBtn = $('dfPlay'), total = (field.scenes || []).length;
    var PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
    var PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z" fill="currentColor"/></svg>';
    var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    if (!field.play || total < 2) { $('dfCtrl').hidden = true; return; }
    $('dfNext').innerHTML = ARROW;
    $('dfPrev').innerHTML = ARROW;
    function paintPlay() {
      var p = field.paused();
      playBtn.innerHTML = p ? PLAY : PAUSE;
      playBtn.setAttribute('aria-pressed', p);
      playBtn.setAttribute('aria-label', p ? 'Play the animation' : 'Pause the animation');
    }
    function count() { $('dfCount').textContent = (field.index() + 1) + ' / ' + total; }
    playBtn.addEventListener('click', function () { if (field.paused()) field.play(); else field.pause(); paintPlay(); });
    $('dfNext').addEventListener('click', function () { field.step(1); count(); });
    $('dfPrev').addEventListener('click', function () { field.step(-1); count(); });
    setInterval(count, 500);
    paintPlay(); count();
  }

  /* ── the welcome screen ────────────────────────────────── */
  /* Once per browser session. "Enter Soochana" (or Esc) parts the panels
     onto the page; the guided-tour link leaves for explore.html. */
  (function welcome() {
    var KEY = 'soochana-welcome-seen';
    var intro = $('intro'), lander = $('lander');
    var seen = false;
    try { seen = sessionStorage.getItem(KEY) === '1'; } catch (e) {}
    function remember() { try { sessionStorage.setItem(KEY, '1'); } catch (e) {} }
    function openPage() { lander.classList.add('in'); startField(); }

    if (!intro || seen || location.hash.length > 1) {
      if (intro) intro.classList.add('done');
      openPage();
      return;
    }
    root.classList.add('welcome-open');
    var enter = $('introSkip'), tour = $('welcomeGo');
    var stopCount = function () {}, closed = false;
    setTimeout(function () {
      intro.classList.add('go');
      try { enter.focus({ preventScroll: true }); } catch (e) {}
    }, 30);

    if (L) {
      L.load().then(function () {
        if (closed) return;
        L.paintMap(L.drawMap($('welcomeMap')), L.yearNow());
        $('welcomeNote').textContent = L.paceNote();
        /* start counting as the number fades in, after the logo has built */
        setTimeout(function () {
          if (!closed) stopCount = L.countUp($('welcomeCount'), { ms: 5200 });
        }, reduced ? 0 : 3200);
      }).catch(function () { $('welcomeCount').textContent = '4.7 crore'; });
    }

    function dismiss() {
      if (closed) return;
      closed = true;
      remember();
      document.removeEventListener('keydown', onKey);
      intro.classList.add('clear');
      setTimeout(function () {
        stopCount();
        root.classList.remove('welcome-open');
        intro.classList.add('part');
        openPage();
        setTimeout(function () { intro.classList.add('done'); }, 1600);
      }, reduced ? 0 : 600);
    }
    function onKey(e) {
      if (e.key === 'Escape') { dismiss(); return; }
      if (e.key === 'Tab') {          /* keep Tab inside the welcome screen */
        if (e.shiftKey && document.activeElement === enter) { tour.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === tour) { enter.focus(); e.preventDefault(); }
      }
    }
    document.addEventListener('keydown', onKey);
    enter.addEventListener('click', dismiss);
    tour.addEventListener('click', remember);
  })();

  if (L) {
    L.load().then(function () { startClock(); startDistricts(); }).catch(function (err) {
      $('clockPace').textContent = 'The live estimate could not load. The figure shown is the 2026 projection, rounded.';
      if (window.console) console.warn('Home: live data did not load', err);
    });
  }

  /* ── 7. what changed, and which way the districts moved ──
     Both read datasets/nfhs_district_rounds.json: per indicator, the state
     value in each round and every district as [NFHS-6, NFHS-5], with a
     polarity (1 higher is better, -1 lower is better, 0 neither). Figures
     and district counts are computed here; only the sentences are typed. */
  var bearing = { step: function () { return false; } };
  (function () {
    var shiftList = $('shiftList'), brSteps = $('brSteps');
    if (!shiftList || !brSteps) return;
    var NS = 'http://www.w3.org/2000/svg';
    function svgEl(tag, attrs, parent) {
      var n = document.createElementNS(NS, tag);
      Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
      if (parent) parent.appendChild(n);
      return n;
    }
    function num(v, unit) {
      return (Math.round(v * 10) / 10).toFixed(1) + (unit === '%' ? '%' : '');
    }
    /* how many districts moved the right way, and which */
    function tally(ind) {
      var better = [], worse = [], same = [];
      Object.keys(ind.districts || {}).forEach(function (name) {
        var v = ind.districts[name];
        if (!v || v[0] == null || v[1] == null) return;
        var s = (v[0] - v[1]) * ind.polarity;
        var row = { name: name, now: v[0], was: v[1] };
        (s > 0 ? better : s < 0 ? worse : same).push(row);
      });
      return { better: better, worse: worse, same: same, n: better.length + worse.length + same.length };
    }
    function names(list) {
      var a = list.map(function (d) { return d.name; });
      return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
    }

    /* the From → to rows */
    var SHIFT = [
      { n: 7,  name: 'Health cover', say: 'Households where someone is covered by a health insurance or financing scheme.' },
      { n: 12, name: 'Women with ten years of school', say: 'A generation of girls who stayed in school is now grown up.' },
      { n: 94, name: 'Women with their own phone', say: 'Women who have a mobile phone that they use themselves.' },
      { n: 33, name: 'Iron and folic acid in pregnancy', say: 'Mothers who took iron and folic acid for at least 100 days while pregnant, the first guard against anaemia.' },
      { n: 18, name: 'Children per woman', say: 'The total fertility rate, already below the replacement level of 2.1 and still easing. Neither survey publishes it by district.' },
      { n: 26, name: 'Unmet need for family planning', say: 'Women who would like to space or limit births and are not yet using a method, a need that services are well placed to meet.' }
    ];
    /* the six measures under the arrow */
    var BEAR = [
      { n: 14, name: 'Women online', say: 'More than half of women have now used the internet, about twice the share of five years earlier.' },
      { n: 70, name: 'Stunting', say: 'Fewer children are short for their age, the long-run mark of better nutrition.' },
      { n: 16, name: 'Marriage before 18', say: 'Marriage before 18 is becoming rarer, and the shift is still under way in many districts.' },
      { n: 71, name: 'Child wasting', say: 'Helping young children reach a healthy weight for their height is a focus for the years ahead, and several districts are already showing the way.' },
      { n: 31, name: 'Four antenatal visits', say: 'Almost every mother now has at least one check-up in pregnancy; the next step is reaching the four that are advised.' },
      { n: 81, name: 'Blood sugar in women', say: 'Blood sugar is a growing health focus, and an opportunity to bring screening and care closer to home.' }
    ];

    var arrowSvg = '<svg viewBox="0 0 64 24" aria-hidden="true"><path d="M2 12h54M44 3l14 9-14 9" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    function buildShift(byN, src) {
      SHIFT.forEach(function (s) {
        var ind = byN[s.n];
        if (!ind || !ind.odisha || ind.odisha.nfhs5 == null || ind.odisha.nfhs6 == null) return;
        var a = ind.odisha.nfhs5, b = ind.odisha.nfhs6;
        var dir = ind.polarity === 0 || a === b ? 'flat' : (b - a) * ind.polarity > 0 ? 'better' : 'worse';
        var li = el('li', 'shift-row is-' + dir);
        li.appendChild(el('div', 'shift-what', s.name));
        var from = el('div', 'shift-from');
        from.appendChild(el('span', null, 'NFHS-5'));
        from.appendChild(el('s', null, num(a, ind.unit)));
        li.appendChild(from);
        var ar = el('span', 'shift-arrow');
        ar.innerHTML = arrowSvg;
        li.appendChild(ar);
        var to = el('div', 'shift-to');
        to.appendChild(el('span', null, 'NFHS-6'));
        to.appendChild(el('b', null, num(b, ind.unit)));
        to.appendChild(el('em', null, dir === 'better' ? 'Better' : dir === 'worse' ? 'Focus area' : b < a ? 'Lower' : b > a ? 'Higher' : 'No change'));
        li.appendChild(to);
        var say = el('p', 'shift-say', s.say);
        var t = tally(ind);
        if (ind.polarity !== 0 && t.n) {
          say.appendChild(document.createTextNode(' '));
          say.appendChild(el('b', null, (t.better.length === t.n ? 'Improving in all ' + t.n : 'Improving in ' + t.better.length + ' of ' + t.n) + ' districts.'));
        }
        li.appendChild(say);
        shiftList.appendChild(li);
      });
      $('shiftSrc').textContent = 'Source: ' + src + '. Percentages unless marked; children per woman for the fertility rate.';
      /* draw the strike and the arrow as each row comes into view */
      if (!('IntersectionObserver' in window) || reduced) {
        shiftList.querySelectorAll('.shift-row').forEach(function (r) { r.classList.add('in'); });
        return;
      }
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -15% 0px' });
      shiftList.querySelectorAll('.shift-row').forEach(function (r) { io.observe(r); });
    }

    /* the dial: pivot at (120, 200); all districts better turns the arrow
       60° up, none turns it 60° down, an even split leaves it level */
    var PX = 120, PY = 200, R = 230, SWING = 60;
    function angleFor(k, n) { return -((k / n) - 0.5) * 2 * SWING; }
    function polar(a, r) { var t = a * Math.PI / 180; return [PX + r * Math.cos(t), PY + r * Math.sin(t)]; }
    function verdict(p) {
      return p >= 0.8 ? ['up', 'Improving widely'] : p >= 0.6 ? ['up', 'Improving'] :
             p > 0.4 ? ['mid', 'Mixed progress'] : p > 0.2 ? ['down', 'Focus area'] : ['down', 'Shared focus'];
    }

    function buildBearing(byN, src) {
      var dial = $('brDial');
      var p0 = polar(-SWING, R), p1 = polar(SWING, R);
      svgEl('path', { 'class': 'br-arc', d: 'M' + p0 + 'A' + R + ' ' + R + ' 0 0 1 ' + p1 }, dial);
      svgEl('line', { 'class': 'br-level', x1: PX, y1: PY, x2: PX + R, y2: PY }, dial);
      for (var k = 0; k <= 30; k++) {
        var a = angleFor(k, 30), major = k % 15 === 0, q = polar(a, R), w = polar(a, R + (major ? 22 : k % 5 === 0 ? 14 : 8));
        svgEl('line', { 'class': major ? 'br-tick br-major' : 'br-tick', x1: q[0], y1: q[1], x2: w[0], y2: w[1] }, dial);
      }
      [[30, 'All 30 improving'], [15, 'Even split'], [0, 'Focus in all 30']].forEach(function (l) {
        var q = polar(angleFor(l[0], 30), R + 32);
        var t = svgEl('text', { 'class': 'br-lab', x: q[0], y: q[1] + 6 }, dial);
        t.textContent = l[1];
      });
      /* the dial's own hatch, so the stripes take the arrow's colour */
      var pat = svgEl('pattern', { id: 'brHatch', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(40)' },
        svgEl('defs', {}, dial));
      svgEl('line', { 'class': 'br-hatch', x1: 0, y1: 0, x2: 0, y2: 8 }, pat);
      var arrow = svgEl('g', { 'class': 'br-arrow' }, dial);
      svgEl('path', { 'class': 'br-arrow-fill', d: 'M' + PX + ' 184H288V156L350 200L288 244V216H' + PX + 'Z', fill: 'url(#brHatch)' }, arrow);
      svgEl('path', { 'class': 'br-arrow-line', d: 'M' + PX + ' 184H288V156L350 200L288 244V216H' + PX + 'Z' }, arrow);
      svgEl('circle', { 'class': 'br-pivot', cx: PX, cy: PY, r: 14 }, dial);

      var items = BEAR.map(function (b) {
        var ind = byN[b.n];
        if (!ind) return null;
        var t = tally(ind);
        if (!t.n) return null;
        var v = verdict(t.better.length / t.n);
        var card = el('article', 'br-card is-' + v[0]);
        card.appendChild(el('div', 'br-kick', v[1] + ' · ' + (v[0] === 'down' ? (t.better.length === 0 ? 'all ' + t.n + ' districts' : (t.n - t.better.length) + ' of ' + t.n + ' districts') : t.better.length + ' of ' + t.n + ' districts improving')));
        card.appendChild(el('h3', 'br-name', b.name));
        var fig = el('div', 'br-fig');
        fig.appendChild(el('s', null, num(ind.odisha.nfhs5, ind.unit)));
        var ar = el('span', 'shift-arrow'); ar.innerHTML = arrowSvg; fig.appendChild(ar);
        fig.appendChild(el('b', null, num(ind.odisha.nfhs6, ind.unit)));
        fig.appendChild(el('span', 'br-fig-note', 'Odisha, NFHS-5 to NFHS-6'));
        card.appendChild(fig);
        card.appendChild(el('p', 'br-say', b.say));
        /* name the few that went against the tide */
        var few = t.better.length > t.n / 2 ? t.worse : t.better;
        if (few.length && few.length <= 3) {
          card.appendChild(el('div', 'br-few', (few === t.worse ? 'Room to grow in ' : 'Already improving in ') + names(few) + '.'));
        }
        card.appendChild(el('div', 'br-def', ind.indicator + (ind.unit === '%' ? ' (%)' : '')));
        var step = el('div', 'br-step');
        step.appendChild(card);
        brSteps.appendChild(step);
        return { step: step, t: t, ind: ind, dir: v[0] };
      }).filter(Boolean);
      if (!items.length) return;

      var dotsEl = $('brDots');
      function show(j) {
        var it = items[j];
        items.forEach(function (x, i) { x.step.classList.toggle('on', i === j); });
        dial.setAttribute('data-dir', it.dir);
        arrow.style.transform = 'rotate(' + angleFor(it.t.better.length, it.t.n) + 'deg)';
        var focus = it.dir === 'down';
        $('brCount').textContent = focus ? it.t.n - it.t.better.length : it.t.better.length;
        $('brCountText').textContent = 'of ' + it.t.n + (focus ? ' districts where this is a focus' : ' districts improving');
        dotsEl.textContent = '';
        it.t.better.concat(it.t.same, it.t.worse).forEach(function (d) {
          var good = it.t.better.indexOf(d) !== -1, bad = it.t.worse.indexOf(d) !== -1;
          var i = el('i', good ? 'up' : bad ? 'down' : 'flat');
          i.title = d.name + ': ' + num(d.was, it.ind.unit) + ' → ' + num(d.now, it.ind.unit);
          dotsEl.appendChild(i);
        });
        cur = j;
      }
      var cur = 0;
      show(0);
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            if (e.isIntersecting) show(items.map(function (x) { return x.step; }).indexOf(e.target));
          });
        }, { rootMargin: '-45% 0px -45% 0px' });
        items.forEach(function (x) { io.observe(x.step); });
      }
      bearing.step = function (d) {
        var k = cur + d;
        if (k < 0 || k >= items.length) return false;
        items[k].step.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
        show(k);
        return true;
      };
      $('brSrc').textContent = 'Source: ' + src + '. A district counts as improving when its NFHS-6 figure moved in the desired direction from NFHS-5; districts without a figure in both rounds are left out.';
    }

    fetch('datasets/nfhs_district_rounds.json')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        var byN = {};
        data.indicators.forEach(function (i) { byN[i.n] = i; });
        var src = 'National Family Health Survey, NFHS-5 (2019–21) and NFHS-6 (2023–24, fact sheets published ' + ((data.meta && data.meta.published) || 'May 2026') + '), IIPS and MoHFW';
        buildShift(byN, src);
        buildBearing(byN, src);
      })
      .catch(function (err) {
        shiftList.appendChild(el('li', 'shift-err', 'The survey figures could not load.'));
        if (window.console) console.warn('Home: NFHS rounds did not load', err);
      });
  })();

  /* ── 8. snapshots, and the straight answers ──────────────
     Six prints start as a loose pile and deal themselves into a grid as
     the section scrolls past. Each figure is read from the data files;
     only the short captions are typed. All framed as progress or plain
     fact, as everywhere on the portal. */
  (function () {
    var stage = $('snapStage'), run = $('snapRun');
    if (!stage || !run) return;
    function pct(v) { return (Math.round(v * 10) / 10).toFixed(1) + '%'; }
    Promise.all([
      fetch('datasets/nfhs_district_rounds.json').then(function (r) { return r.json(); }),
      fetch('datasets/orgi_state_projection.json').then(function (r) { return r.json(); })
    ]).then(function (res) {
      var byN = {};
      res[0].indicators.forEach(function (i) { byN[i.n] = i; });
      var O = res[1].odisha, yi = function (y) { return O.years.indexOf(y); };
      function nf(n) { return byN[n] && byN[n].odisha; }
      var SNAPS = [
        { art: 'population-aerial.jpg', tag: 'Population', href: 'theme_detail.html?theme=demography',
          big: (O.population_000.total[yi(2021)] / 1e4).toFixed(2) + ' crore',
          line: 'people in 2021, ' + (O.population_000.total[yi(2036)] / 1e4).toFixed(2) + ' crore by 2036', src: 'ORGI projections' },
        { art: 'health-infrastructure.jpg', tag: 'Health', href: 'theme_detail.html?theme=health',
          big: pct(nf(36).nfhs6), line: 'of births now take place in a health facility', src: 'NFHS-6' },
        { art: 'education-classroom.jpg', tag: 'Education', href: 'theme_detail.html?theme=education',
          big: pct(nf(12).nfhs6), line: 'of women have ten or more years of school, from ' + pct(nf(12).nfhs5), src: 'NFHS-6 and NFHS-5' },
        { art: 'nutrition-strength.jpg', tag: 'Nutrition', href: 'theme_detail.html?theme=health',
          big: pct(nf(70).nfhs6), line: 'of young children are stunted, down from ' + pct(nf(70).nfhs5), src: 'NFHS-6 and NFHS-5' },
        { art: 'ageing-cohort.jpg', tag: 'Ageing', href: 'theme_detail.html?theme=ageing',
          big: Math.round(O.age_pct['60_plus'][yi(2036)]) + ' in 100', line: 'people will be 60 or over by 2036, from ' + Math.round(O.age_pct['60_plus'][yi(2021)]) + ' in 2021', src: 'ORGI projections' },
        { art: 'data-collective.gif', tag: 'Connected', href: 'district-health.html',
          big: pct(nf(14).nfhs6), line: 'of women have used the internet, from ' + pct(nf(14).nfhs5), src: 'NFHS-6 and NFHS-5' }
      ];
      /* a fixed, slightly untidy pile */
      var PILE = [[-7, -18, 10], [5, 14, -6], [-3, -6, 22], [9, 20, 4], [-11, 4, -14], [2, -12, -2]];
      var cards = SNAPS.map(function (s, k) {
        var a = el('a', 'snap');
        a.href = s.href;
        var img = el('img');
        img.src = 'images/editorial/' + s.art; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
        a.appendChild(img);
        var cap = el('div', 'snap-cap');
        cap.appendChild(el('span', 'snap-tag', s.tag));
        cap.appendChild(el('b', null, s.big));
        cap.appendChild(el('span', 'snap-line', s.line));
        cap.appendChild(el('span', 'snap-src', s.src));
        a.appendChild(cap);
        a.setAttribute('aria-label', s.tag + ': ' + s.big + ' ' + s.line + ' (' + s.src + ')');
        stage.appendChild(a);
        return { el: a, pile: PILE[k] };
      });
      $('snapSrc').textContent = 'Sources: ' + res[0].meta.short.replace(/�/g, '–') + '; ' + res[1].meta.short.replace(/�/g, '–') + '.';

      var spread = !(window.matchMedia && matchMedia('(min-width: 900px)').matches) || reduced;
      function layout(p) {
        /* p = 0: the pile; p = 1: the grid. Measured from the stage so it
           holds at any width. */
        var W = stage.clientWidth, H = stage.clientHeight;
        var cw = cards[0].el.offsetWidth, ch = cards[0].el.offsetHeight;
        /* a compact grid, centred, rather than one stretched to the edges */
        var cols = 3, gx = Math.min(56, (W - cols * cw) / (cols + 1)), gy = Math.min(40, Math.max(16, (H - 2 * ch) / 3));
        var ox = (W - cols * cw - (cols - 1) * gx) / 2, oy = (H - 2 * ch - gy) / 2;
        cards.forEach(function (c, k) {
          var tx = ox + (k % cols) * (cw + gx), ty = oy + Math.floor(k / cols) * (ch + gy);
          var px = (W - cw) / 2 + c.pile[1] * 3, py = (H - ch) / 2 + c.pile[2] * 2;
          var e = p < 0 ? 0 : p > 1 ? 1 : p;
          e = e * e * (3 - 2 * e);
          var x = px + (tx - px) * e, y = py + (ty - py) * e, r = c.pile[0] * (1 - e);
          c.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + r.toFixed(2) + 'deg)';
          c.el.style.zIndex = String(10 + k);
        });
      }
      if (spread) { run.classList.add('is-grid'); return; }
      var ticking = false;
      function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          ticking = false;
          var r = run.getBoundingClientRect(), span = r.height - innerHeight;
          layout(span > 0 ? (-r.top) / (span * 0.75) : 1);
        });
      }
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      Promise.all([].map.call(stage.querySelectorAll('img'), function (i) {
        return i.decode ? i.decode().catch(function () {}) : null;
      })).then(onScroll);
      onScroll();
    }).catch(function (err) {
      run.classList.add('is-grid');
      if (window.console) console.warn('Home: snapshots did not load', err);
    });
  })();

  /* straight answers: opening one closes the others */
  (function () {
    var list = $('faqList');
    if (!list) return;
    var items = [].slice.call(list.querySelectorAll('details'));
    items.forEach(function (d) {
      d.addEventListener('toggle', function () {
        if (d.open) items.forEach(function (o) { if (o !== d) o.open = false; });
      });
    });
  })();

  /* ── 9. a generation of gains, and the window to 2036 ─────
     Long-run gains come from datasets/odisha_long_run.json, which records
     each figure as reported in the CYSD and UNFPA roadmap (2026) with the
     primary source it cites. The window's shares and the FAQ growth rates
     are computed from the ORGI projection, the portal's headline series. */
  (function () {
    var list = $('gainsList');
    var arrowSvg = '<svg viewBox="0 0 64 24" aria-hidden="true"><path d="M2 12h54M44 3l14 9-14 9" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    function show(v, unit) {
      var s = (Math.round(v * 10) / 10).toLocaleString('en-IN');
      return unit === '%' ? s + '%' : s;
    }
    function reveal(rows) {
      if (!('IntersectionObserver' in window) || reduced) { rows.forEach(function (r) { r.classList.add('in'); }); return; }
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -15% 0px' });
      rows.forEach(function (r) { io.observe(r); });
    }

    if (list) {
      fetch('datasets/odisha_long_run.json').then(function (r) { return r.json(); }).then(function (data) {
        var rows = data.gains.map(function (g) {
          var a = g.from.value, b = g.to.value;
          var dir = g.polarity === 0 ? 'flat' : (b - a) * g.polarity > 0 ? 'better' : 'worse';
          var li = el('li', 'shift-row is-' + dir);
          li.appendChild(el('div', 'shift-what', g.name));
          var from = el('div', 'shift-from');
          from.appendChild(el('span', null, g.from.year));
          from.appendChild(el('s', null, show(a, g.unit)));
          li.appendChild(from);
          var ar = el('span', 'shift-arrow'); ar.innerHTML = arrowSvg; li.appendChild(ar);
          var to = el('div', 'shift-to');
          to.appendChild(el('span', null, g.to.year));
          to.appendChild(el('b', null, show(b, g.unit)));
          to.appendChild(el('em', null, g.unit && g.unit !== '%' ? g.unit : dir === 'better' ? 'Better' : 'Lower'));
          li.appendChild(to);
          var say = el('p', 'shift-say', g.say + ' ');
          say.appendChild(el('span', 'gain-src', g.source + '.'));
          li.appendChild(say);
          list.appendChild(li);
          return li;
        });
        $('gainsSrc').textContent = 'Figures as reported in ' + data.meta.short + ', with the primary source named on each row.';
        reveal(rows);
      }).catch(function (err) { if (window.console) console.warn('Home: long-run gains did not load', err); });
    }

    fetch('datasets/orgi_state_projection.json').then(function (r) { return r.json(); }).then(function (data) {
      var O = data.odisha, Y = O.years, at = function (k, y) { return O.age_pct[k][Y.indexOf(y)]; };
      var P = function (y) { return O.population_000.total[Y.indexOf(y)]; };
      var src = (data.meta.short || 'ORGI Technical Group projections (2020)').replace(/�/g, '–');
      /* the FAQ: average yearly growth over each period */
      if ($('faqGrowA')) {
        $('faqGrowA').textContent = ((P(2021) - P(2011)) / P(2011) / 10 * 100).toFixed(1);
        $('faqGrowB').textContent = ((P(2036) - P(2031)) / P(2031) / 5 * 100).toFixed(1);
      }
      var stats = $('winStats');
      if (!stats) return;
      var wa = [2021, 2026, 2031, 2036].map(function (y) { return at('15_59', y); });
      $('winWa').textContent = Math.round(Math.max.apply(null, wa));
      var e21 = O.age_000['60_plus'][Y.indexOf(2021)], e36 = O.age_000['60_plus'][Y.indexOf(2036)];
      [
        { k: 'Working age, 15 to 59', a: at('15_59', 2021), b: at('15_59', 2036), note: 'About two in every three people, through 2036.' },
        { k: 'Children under 15', a: at('0_14', 2021), b: at('0_14', 2036), note: 'Fewer children, and more to invest in each one.' },
        { k: 'People aged 60 and over', a: at('60_plus', 2021), b: at('60_plus', 2036),
          note: 'Longer lives: from about ' + Math.round(e21 / 100) + ' lakh to ' + Math.round(e36 / 100) + ' lakh people.' }
      ].forEach(function (s) {
        var c = el('div', 'win-stat');
        c.appendChild(el('span', 'win-stat-k', s.k));
        var f = el('div', 'win-stat-f');
        f.appendChild(el('b', null, s.a.toFixed(1) + '%'));
        var ar = el('span', 'shift-arrow'); ar.innerHTML = arrowSvg; f.appendChild(ar);
        f.appendChild(el('b', null, s.b.toFixed(1) + '%'));
        c.appendChild(f);
        c.appendChild(el('span', 'win-stat-y', '2021 to 2036'));
        c.appendChild(el('span', 'win-stat-n', s.note));
        stats.appendChild(c);
      });
      $('winSrc').textContent = 'Shares: ' + src + '. Framing: Mohanty, Kundu and Jagadananda (2026), Population Dynamics and Development Prospects of Odisha: A Roadmap to 2036 and 2047, CYSD and UNFPA.';
    }).catch(function (err) { if (window.console) console.warn('Home: ORGI projection did not load', err); });
  })();

  /* ── 6. page dots and presentation mode ────────────────── */
  var sections = [].slice.call(document.querySelectorAll('[data-nav]'));
  var dots = $('dots');
  var dotLinks = sections.map(function (s) {
    var a = el('a');
    a.href = '#' + s.id;
    var lab = el('span', null, s.dataset.nav);
    lab.dataset.or = s.dataset.navOr;
    a.appendChild(lab);
    a.setAttribute('aria-label', s.dataset.nav);
    dots.appendChild(a);
    return a;
  });
  var active = 0;
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        active = sections.indexOf(e.target);
        dotLinks.forEach(function (a, j) { a.classList.toggle('on', j === active); });
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    sections.forEach(function (s) { io.observe(s); });
  }

  /* the section under the middle of the screen, measured when asked, so
     the keys do not depend on the observer having fired */
  function current() {
    var mid = innerHeight / 2, best = active;
    sections.forEach(function (s, j) {
      var r = s.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) best = j;
    });
    return (active = best);
  }

  var hud = $('presentHud');
  function goSection(k) {
    if (k < 0 || k >= sections.length) return;
    sections[k].scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }
  function present(on) {
    current();
    document.body.classList.toggle('present', on);
    hud.hidden = !on;
    if (on && root.requestFullscreen) root.requestFullscreen().catch(function () {});
    if (!on && document.fullscreenElement) document.exitFullscreen().catch(function () {});
    setTimeout(function () {
      window.dispatchEvent(new Event('resize'));
      goSection(on ? 0 : active);
    }, 250);
  }
  $('presentBtn').addEventListener('click', function () {
    var menu = this.closest('details');
    if (menu) menu.open = false;
    present(!document.body.classList.contains('present'));
  });
  $('presentExit').addEventListener('click', function () { present(false); });
  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement && document.body.classList.contains('present')) present(false);
  });
  document.addEventListener('keydown', function (e) {
    if (!document.body.classList.contains('present')) return;
    if (e.target.closest && e.target.closest('select, input, textarea')) return;
    current();
    var id = sections[active] && sections[active].id;
    if (e.key === 'Escape') { present(false); return; }
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault();
      if (id === 'story' && story.next()) return;
      if (id === 'topics' && window.SoochanaTopics.step(1)) return;
      if (id === 'bearing' && bearing.step(1)) return;
      goSection(active + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      if (id === 'story' && story.prev()) return;
      if (id === 'topics' && window.SoochanaTopics.step(-1)) return;
      if (id === 'bearing' && bearing.step(-1)) return;
      goSection(active - 1);
    } else if (e.key === 'ArrowDown') { e.preventDefault(); goSection(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); goSection(active - 1); }
  });

  applyLang();
})();
