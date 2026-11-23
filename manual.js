/* ─────────────────────────────────────────────────────────────────────
   manual.js — the portal manual (manual.html)

   1. Line icons: <i data-ic="name"> becomes the drawing from icons.js.
   2. "Who are you?": a card shows that reader's suggested route (ROLES).
   3. The story: as each card reaches the middle of the screen, the drawn
      portal screen beside it redraws (SCENES), the matching item in the
      mini menu bar lights up, and the chapter tab and progress line follow.

   Every drawing below is this file's own constant markup, never data or
   reader input, so it is safe to set as HTML. The words of the manual are
   all in manual.html, so the page reads in full without this file.
   ───────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1. icons and the header height ── */
  var Icons = window.SoochanaIcons;
  $$('i[data-ic]').forEach(function (n) {
    if (Icons) n.replaceWith(Icons.svg(n.getAttribute('data-ic'), 'ic'));
  });

  function topHeight() {
    var h = $('header.site-nav');
    document.documentElement.style.setProperty('--top-h', (h ? h.offsetHeight : 64) + 'px');
  }
  topHeight();
  window.addEventListener('resize', topHeight);
  window.addEventListener('load', topHeight);

  /* ── 2. who are you: one route per reader ── */
  var ROLES = {
    policy: {
      name: 'Policymaker or officer',
      say: 'Start from the big picture, then go district by district.',
      steps: [
        ['The window to 2036', 'What the coming years mean for jobs, skills and care.', 'index.html#window', 3],
        ['A district profile', 'Population, health and schools for one district.', 'district.html', 4],
        ['Planning', 'How many children, young people and elders to plan for.', 'planning.html', 4],
        ['The printable report', 'Everything in one document for a meeting or a file.', 'report.html', 6]
      ]
    },
    planner: {
      name: 'District planner',
      say: 'Know your district’s people, group by group, and how they are changing.',
      steps: [
        ['Find your district', 'Its population now, in 2011 and in 2036.', 'index.html#districts', 3],
        ['Planning', 'Six planning groups for 2021 and 2026, with a CSV download.', 'planning.html', 4],
        ['District health', '102 health indicators, NFHS-5 beside NFHS-6.', 'district-health.html', 4],
        ['Compare two districts', 'See your district beside a neighbour.', 'odisha_compare.html', 4]
      ]
    },
    research: {
      name: 'Researcher or analyst',
      say: 'Go straight to the data, then check the methods behind it.',
      steps: [
        ['The Repository', 'Datasets and more than 100 reports to download.', 'repository.html', 6],
        ['District health', 'All 102 NFHS indicators in a searchable table.', 'district-health.html', 4],
        ['Learn: projections', 'How the figures after 2011 are estimated.', 'learn/projections.html', 5],
        ['The Assistant', 'Rankings, comparisons and trends on request.', null, 7]
      ]
    },
    media: {
      name: 'Journalist or communicator',
      say: 'Find a figure with its source, and a picture to go with it.',
      steps: [
        ['The story', 'Odisha’s population told as 100 dots.', 'index.html#story', 3],
        ['Snapshots', 'Six pictures, each with one figure.', 'index.html#snaps', 3],
        ['Tectonics', 'Illustrated stories on marriage, ageing, health and migration.', 'tectonics.html', 5],
        ['Charts to keep', 'Download PNG under a chart saves it as an image.', null, 6]
      ]
    },
    ngo: {
      name: 'NGO or development partner',
      say: 'See where each district is moving well and where to focus next.',
      steps: [
        ['District direction', 'How the 30 districts moved on six measures.', 'index.html#bearing', 3],
        ['A district profile', 'One district’s strengths and focus areas.', 'district.html', 4],
        ['Themes', 'Briefs on health, education, ageing, migration and work.', 'themes.html', 5],
        ['The Assistant', 'Ask "What should Malkangiri focus on?"', null, 7]
      ]
    },
    student: {
      name: 'Student or teacher',
      say: 'Learn how population numbers work, one picture at a time.',
      steps: [
        ['The guided tour', 'Eight short scenes with quizzes.', 'explore.html', 5],
        ['Learn', 'Twelve lessons, from rates and ratios to projections.', 'learn/index.html', 5],
        ['The story', 'The state’s whole journey in six chapters.', 'index.html#story', 3],
        ['Tectonics', 'Big changes told as illustrated stories.', 'tectonics.html', 5]
      ]
    },
    citizen: {
      name: 'Citizen',
      say: 'Read your state’s story, then look up your own district.',
      steps: [
        ['The story', 'How one crore became five.', 'index.html#story', 3],
        ['Find your district', 'Your district now and in 2036.', 'index.html#districts', 3],
        ['The guided tour', 'Make a shareable card for your district.', 'explore.html', 5],
        ['The Assistant', 'Ask any question in your own words.', null, 7]
      ]
    }
  };

  var routeBox = $('#route');
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function openAssistant() {
    if (window.SoochanaAssistant) window.SoochanaAssistant.open();
  }

  function showRole(key, scroll) {
    var r = ROLES[key];
    if (!r) return;
    $$('.mn-role').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.role === key)); });
    routeBox.textContent = '';
    var head = el('div', 'mn-route-head');
    head.appendChild(el('p', 'mn-hand', 'Your route, as a ' + r.name.toLowerCase()));
    head.appendChild(el('p', 'mn-route-say', r.say));
    routeBox.appendChild(head);
    var ol = el('ol', 'mn-route-steps');
    var chs = {};
    r.steps.forEach(function (s, i) {
      chs[s[3]] = true;
      var li = el('li');
      li.style.setProperty('--i', i);
      var num = el('span', 'mn-step-n', String(i + 1));
      var body = el('div', 'mn-step-b');
      body.appendChild(el('b', null, s[0]));
      body.appendChild(el('span', null, s[1]));
      var links = el('span', 'mn-step-links');
      var go;
      if (s[2]) { go = el('a', 'mn-go', 'Open it'); go.href = s[2]; }
      else { go = el('button', 'mn-go', 'Open it'); go.type = 'button'; go.addEventListener('click', openAssistant); }
      var read = el('a', 'mn-read', 'Read chapter ' + s[3]);
      read.href = '#ch-' + s[3];
      links.appendChild(go); links.appendChild(read);
      body.appendChild(links);
      li.appendChild(num); li.appendChild(body);
      ol.appendChild(li);
    });
    routeBox.appendChild(ol);
    routeBox.hidden = false;
    /* mark the chapters on this route in the tab bar */
    $$('#tabs a').forEach(function (a) { a.classList.toggle('is-route', !!chs[a.dataset.ch]); });
    try { localStorage.setItem('soochana-manual-role', key); } catch (e) {}
    if (scroll) routeBox.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  }
  $$('.mn-role').forEach(function (b) {
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', function () { showRole(b.dataset.role, true); });
  });
  try {
    var saved = localStorage.getItem('soochana-manual-role');
    if (saved && ROLES[saved]) showRole(saved, false);
  } catch (e) {}

  var ask = $('#askBtn');
  if (ask) ask.addEventListener('click', openAssistant);

  /* ── 3. the drawn screen ── */
  function rows(n, cls) {
    var s = '';
    for (var i = 0; i < n; i++) s += '<i class="' + (cls || 'ln') + '" style="--w:' + (55 + ((i * 37) % 40)) + '%"></i>';
    return s;
  }
  function dots(n, fn) {
    var s = '';
    for (var i = 0; i < n; i++) s += '<i class="' + fn(i) + '"></i>';
    return s;
  }
  var HOME_BLOCKS = [
    ['intro', 'Introduction'], ['story', 'The story'], ['shift', 'What changed'], ['gains', 'A generation of gains'],
    ['topic', 'By topic'], ['dir', 'District direction'], ['win', 'The window to 2036'], ['dist', 'Districts'],
    ['snap', 'Snapshots'], ['rpt', 'The report'], ['deep', 'Go deeper'], ['faq', 'Questions']
  ];
  function homeMap(on) {
    var s = '<div class="sc-home"><div class="sc-home-col">';
    HOME_BLOCKS.forEach(function (b, i) {
      s += '<span class="sc-hb' + (on.indexOf(b[0]) > -1 ? ' on' : '') + '" style="--i:' + i + '"><b>' + (i + 1) + '</b>' + b[1] + '</span>';
    });
    s += '</div><div class="sc-rail">';
    HOME_BLOCKS.forEach(function (b) { s += '<i class="' + (on.indexOf(b[0]) > -1 ? 'on' : '') + '"></i>'; });
    return s + '</div></div>';
  }

  var SCENES = {
    word: { url: 'about.html', note: 'ସୂଚନା: information, made known',
      html: '<div class="sc-word"><span class="sc-or">ସୂଚନା</span><span class="sc-say">soo · chuh · naa</span>' +
            '<span class="sc-mean">information; the act of making known</span><span class="sc-tag">from numbers to narrative</span></div>' },
    four: { url: 'index.html', note: 'Four ways in',
      html: '<div class="sc-four">' +
        '<span style="--i:0"><i class="sc-ico-bars"></i><b>Dashboards</b></span>' +
        '<span style="--i:1"><i class="sc-ico-story"></i><b>Stories</b></span>' +
        '<span style="--i:2"><i class="sc-ico-box"></i><b>Repository</b></span>' +
        '<span style="--i:3"><i class="sc-ico-mic"></i><b>Policy communication</b></span></div>' },
    sources: { url: 'repository.html', note: 'Every figure names its source',
      html: '<div class="sc-time"><div class="sc-time-line"></div>' +
        '<span style="--x:2%;--i:0"><b>1901</b>First Census</span>' +
        '<span style="--x:52%;--i:1"><b>2011</b>Last Census</span>' +
        '<span style="--x:72%;--i:2" class="up"><b>2019–21</b>NFHS-5</span>' +
        '<span style="--x:80%;--i:3"><b>2023–24</b>NFHS-6</span>' +
        '<span style="--x:97%;--i:4" class="proj up"><b>2036</b>Projected</span>' +
        '<em class="sc-time-band">projections</em></div>' },
    'nav-logo': { url: 'any page', hot: 'logo', note: 'Click the logo to go home',
      html: '<div class="sc-page">' + rows(6) + '</div>' },
    'nav-main': { url: 'any page', hot: ['about', 'themes', 'repo'], note: 'The three main links',
      html: '<div class="sc-page">' + rows(6) + '</div>' },
    'nav-discover': { url: 'any page', hot: 'discover', note: 'Discover opens four more',
      html: '<div class="sc-pop"><span>Learn<small>Short visual lessons</small></span><span>Tectonics<small>Illustrated stories</small></span>' +
            '<span>Planning<small>Schools, health and care</small></span><span>Guided tour<small>Eight scenes with quizzes</small></span></div>' +
            '<div class="sc-page dim">' + rows(5) + '</div>' },
    'nav-lang': { url: 'index.html', hot: 'lang', note: 'Switch to Odia and back',
      html: '<div class="sc-lang"><span class="en">How one crore became five</span><span class="arrow">⇅</span><span class="or">ଏକ କୋଟିରୁ ପାଞ୍ଚ କୋଟି</span></div>' },
    'nav-report': { url: 'index.html', hot: 'report', note: 'Present, or download the report',
      html: '<div class="sc-pop right"><span>Present<small>Full screen, arrow keys</small></span><span>Download report<small>Ready to print</small></span></div>' +
            '<div class="sc-page dim">' + rows(5) + '</div>' },
    'nav-help': { url: 'any page', hot: 'chat', note: 'Ask the Assistant anything',
      html: '<div class="sc-page">' + rows(4) + '</div><div class="sc-bell"><i></i><b>3</b><span>What’s new</span></div>' },
    welcome: { url: 'index.html', note: 'A live estimate, not a head count',
      html: '<div class="sc-welcome"><span class="sc-k">Odisha right now</span><span class="sc-count">' +
            [1, 1, 0, 1, 1, 0, 1, 1, 1].map(function (d, i) {
              return d ? '<b style="--i:' + i + '"><em>0<br>1<br>2<br>3<br>4<br>5<br>6<br>7<br>8<br>9</em></b>' : '<b class="c">,</b>';
            }).join('') + '</span>' +
            '<span class="sc-k">people, estimated</span><span class="sc-btns"><em class="y">Enter Soochana</em><em>Take the guided tour</em></span></div>' },
    'home-top': { url: 'index.html#story', note: 'Start at the top', html: homeMap(['intro', 'story']) },
    'home-change': { url: 'index.html#shift', note: 'Then and now', html: homeMap(['shift', 'gains', 'topic']) },
    'home-dir': { url: 'index.html#bearing', note: 'Where the districts are heading', html: homeMap(['dir', 'win']) },
    'home-dist': { url: 'index.html#districts', note: 'Pick a district', html: homeMap(['dist']) },
    'home-end': { url: 'index.html#report', note: 'Keep, share and go deeper', html: homeMap(['snap', 'rpt', 'deep', 'faq']) },
    profile: { url: 'district.html?id=Koraput', note: 'Switch district from the picker',
      html: '<div class="sc-prof"><span class="sc-big">K</span><div><b>Koraput</b><span class="sc-pick">Choose a district ▾</span></div>' +
        '<svg viewBox="0 0 200 70" class="sc-line"><path d="M5 62 C40 58 60 50 90 40 S150 18 195 10"/><path class="proj" d="M150 22 L195 10"/></svg>' +
        '<span class="sc-chips"><em>Population</em><em>Fertility</em><em>Life expectancy</em><em>Health</em></span></div>' },
    duel: { url: 'odisha_compare.html', note: 'District A against District B',
      html: '<div class="sc-duel"><div class="hd"><span class="a">District A ▾</span><span class="b">District B ▾</span></div>' +
        [['Population', 70, 55], ['Fertility', 45, 62], ['Life expectancy', 66, 60], ['Sex ratio', 58, 64], ['Infant mortality', 40, 52]].map(function (r, i) {
          return '<span class="row" style="--i:' + i + '"><i class="l" style="--v:' + r[1] + '%"></i><em>' + r[0] + '</em><i class="r" style="--v:' + r[2] + '%"></i></span>';
        }).join('') + '</div>' },
    health: { url: 'district-health.html', note: '102 indicators, one dot each',
      html: '<div class="sc-swarm"><span class="sc-k">NFHS-5 → NFHS-6</span><div class="sc-sw">' +
        dots(102, function (i) { return (i * 7) % 10 < 7 ? 'up' : 'fo'; }) +
        '</div><span class="sc-legend"><i class="up"></i>Moved the right way <i class="fo"></i>Focus area</span></div>' },
    planning: { url: 'planning.html#place=Khordha', note: 'Six groups to plan for',
      html: '<div class="sc-groups">' +
        ['Infants', 'Ages 0–5', 'Ages 6–14', 'Ages 15–24', 'Women 15–49', 'Ages 60+'].map(function (g, i) {
          return '<span style="--i:' + i + '"><i style="--h:' + [30, 55, 80, 70, 90, 60][i] + '%"></i><b>' + g + '</b></span>';
        }).join('') + '</div><span class="sc-csv">⤓ CSV</span>' },
    themes: { url: 'themes.html', note: 'Open a theme, then an article',
      html: '<div class="sc-cards6">' +
        ['Demography', 'Health', 'Education', 'Ageing', 'Migration', 'Employment'].map(function (t, i) {
          return '<span style="--i:' + i + '"><i></i><b>' + t + '</b>' + (i === 1 ? '<em>new</em>' : '') + '</span>';
        }).join('') + '</div>' },
    tectonics: { url: 'tectonics.html', note: 'Four illustrated stories',
      html: '<div class="sc-covers">' +
        ['Marriage', 'Ageing', 'Health', 'Migration'].map(function (t, i) {
          return '<span style="--i:' + i + '"><i></i><b>' + t + '</b></span>';
        }).join('') + '</div>' },
    learn: { url: 'learn/index.html', note: 'Two tracks, twelve lessons',
      html: '<div class="sc-learn"><div><b>How we measure</b>' +
        ['Where numbers come from', 'Rates and ratios', 'Fertility rate', 'Life expectancy', 'Age structure', 'Projections'].map(function (t, i) { return '<span style="--i:' + i + '">' + t + '</span>'; }).join('') +
        '</div><div><b>Machine learning</b>' +
        ['Train, test, validate', 'Bias and variance', 'Logistic regression', 'Decision trees', 'Neural networks', 'Equality of odds'].map(function (t, i) { return '<span style="--i:' + (i + 3) + '">' + t + '</span>'; }).join('') +
        '</div></div>' },
    tour: { url: 'explore.html#ageing', note: 'Arrows, dots, keys or swipe',
      html: '<div class="sc-tour"><span class="sc-k">Scene 4 of 8</span><b>By 2036, how many of every 100 will be 60+?</b>' +
        '<span class="sc-quiz"><em>8</em><em class="y">15</em><em>25</em></span><span class="sc-tdots">' + dots(8, function (i) { return i === 3 ? 'on' : ''; }) + '</span>' +
        '<span class="sc-arr l">‹</span><span class="sc-arr r">›</span></div>' },
    repo: { url: 'repository.html', note: 'View or download',
      html: '<div class="sc-repo"><span class="sc-tabs3"><em class="on">Datasets</em><em>Reports</em><em>Sources of Data</em></span>' +
        ['Population 1901–2036', 'Health indicators', 'Education 2023–24', 'Migration and urbanization'].map(function (t, i) {
          return '<span class="row" style="--i:' + i + '"><b>' + t + '</b><em>View</em><em class="y">Download</em></span>';
        }).join('') + '</div>' },
    report: { url: 'report.html', note: 'Save as PDF, or print',
      html: '<div class="sc-doc"><span class="p p3"></span><span class="p p2"></span><span class="p p1"><b>Odisha in numbers</b>' +
        ['Odisha at a glance', 'The story in six chapters', 'The state dossier', 'The 30 districts', 'Notes and sources'].map(function (t, i) { return '<em>' + (i + 1) + ' ' + t + '</em>'; }).join('') +
        '</span><span class="sc-print">Save as PDF / Print</span></div>' },
    charts: { url: 'any chart', note: 'Hover for the figure; the source is underneath',
      html: '<div class="sc-chart"><div class="bars">' +
        [40, 62, 55, 78, 48, 66].map(function (v, i) { return '<i style="--v:' + v + '%;--i:' + i + '"' + (i === 3 ? ' class="on"' : '') + '></i>'; }).join('') +
        '</div><span class="sc-tip"><b>Khordha</b> 2.4<br><small>NFHS-6, 2023–24</small></span><span class="sc-src">Source: NFHS-6 (2023–24)</span><span class="sc-png">⤓ Download PNG</span></div>' },
    assistant: { url: 'any page', hot: 'chat', note: 'Answers name their source',
      html: '<div class="sc-chat"><span class="me">Population of Ganjam?</span><span class="bot">Ganjam’s projected population, with its source and year, plus how it ranks among the 30 districts.</span>' +
        '<span class="me">and Puri?</span><span class="bot typing"><i></i><i></i><i></i></span></div>' },
    tips: { url: 'any page', note: 'Ctrl + F5 loads the newest page',
      html: '<div class="sc-keys"><kbd>Ctrl</kbd><b>+</b><kbd>F5</kbd><span class="sc-phone"><i></i><i></i><i></i></span></div>' }
  };

  var screen = $('#screen'), urlBox = $('#stageUrl'), noteBox = $('#stageNote'), stage = $('#stage');
  var current = null;
  function setScene(key) {
    if (key === current || !SCENES[key]) return;
    current = key;
    var sc = SCENES[key];
    screen.innerHTML = '<div class="sc sc-' + key + '">' + sc.html + '</div>';
    urlBox.textContent = 'soochana / ' + sc.url;
    noteBox.textContent = sc.note || '';
    var hot = [].concat(sc.hot || []);
    $$('[data-hot]', stage).forEach(function (n) { n.classList.toggle('hot', hot.indexOf(n.dataset.hot) > -1); });
    stage.classList.remove('swap'); void stage.offsetWidth; stage.classList.add('swap');
  }

  /* ── the card in the middle of the screen sets the scene ── */
  var cards = $$('.mn-card');
  var tabs = $$('#tabs a');
  var progress = $('#progress');
  function setChapter(ch) {
    tabs.forEach(function (a) {
      var on = a.dataset.ch === String(ch);
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var c = e.target;
        cards.forEach(function (k) { k.classList.toggle('on', k === c); });
        setScene(c.dataset.scene);
        setChapter(c.dataset.ch);
      });
    }, {
      /* on phones the screen covers the top of the view, so read the card
         just below it */
      rootMargin: window.matchMedia('(max-width: 900px)').matches ? '-68% 0px -24% 0px' : '-45% 0px -45% 0px'
    });
    cards.forEach(function (c) { io.observe(c); });
  }
  if (cards[0]) setScene(cards[0].dataset.scene);

  /* the progress line under the chapter tabs, and the active tab in view */
  var story = $('#story');
  var lastCh = null;
  function onScroll() {
    var r = story.getBoundingClientRect();
    var p = Math.min(1, Math.max(0, (window.innerHeight * 0.5 - r.top) / r.height));
    progress.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    var on = $('#tabs a.on');
    if (on && on !== lastCh) {
      lastCh = on;
      var bar = $('.mn-tabs-in');
      bar.scrollTo({ left: on.offsetLeft - bar.clientWidth / 2 + on.offsetWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
