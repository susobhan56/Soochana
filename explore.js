/**
 * explore.js — the guided tour on explore.html
 *
 * Five chapters, one screen each, moved with the arrows, the dots, the
 * keyboard or a swipe. Each chapter has its own address (#growth, …) so
 * the browser's back button and shared links land in the right place.
 *
 * Every figure is read from the site's own data at load time:
 *   datasets/district_population_trends.json  population by district, 1951–2036
 *   Orissa.geojson                            district boundaries
 * The two ageing shares are the ones the home page quotes (AGE below).
 */
(function () {
  'use strict';

  var SCENES = ['start', 'growth', 'ageing', 'pyramid', 'fastest', 'district', 'more'];
  var LABELS = {
    start:    'Odisha today',
    growth:   'Seven decades of growth',
    ageing:   'Guess: growing older',
    pyramid:  'Watch it happen: the age pyramid',
    fastest:  'Guess: fastest growth',
    district: 'Find your district',
    more:     'Keep exploring'
  };

  /* Chapter grounds, reused by the share cards so an image matches its screen. */
  var GROUND = { ageing: '#7b4f8f', pyramid: '#16587d', fastest: '#0e4c6e', district: '#2a6b54' };

  /* Share of people aged 60+ (per 100). Same source as the home page:
     Population Projections for India and States 2011–2036, ORGI. */
  var AGE = { y2021: 11.0, y2036: 15.9 };

  /* Districts offered in the "fastest growth" guess. */
  var OPTIONS = ['Cuttack', 'Ganjam', 'Khordha', 'Malkangiri'];

  var L = window.SoochanaLive;
  var reduce = L.reduce;

  var $ = function (id) { return document.getElementById(id); };
  var root = $('ex');
  var sceneEls = [].slice.call(root.querySelectorAll('.ex-scene'));

  var data = null;     // { district: { year: { total } } }, once loaded
  var geo = null;
  var current = -1;
  var seen = {};

  /* shared helpers — see soochana_live.js */
  var fmt = L.fmt, crore = L.crore, lakh = L.lakh, clamp = L.clamp, tween = L.tween;
  var stateAt = L.stateAt, statePop = L.statePop, districtPop = L.districtPop;
  var rate = L.rate, yearNow = L.yearNow, dataName = L.dataName;

  /* ── chapters ───────────────────────────────────────── */
  var prevBtn = $('exPrev'), nextBtn = $('exNext'), dots = $('exDots');

  SCENES.forEach(function (name, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', (i + 1) + '. ' + LABELS[name]);
    b.title = LABELS[name];
    b.addEventListener('click', function () { go(i); });
    dots.appendChild(b);
  });

  function go(i, fromHistory) {
    i = clamp(i, 0, SCENES.length - 1);
    if (i === current) return;
    var prev = current;
    current = i;
    var name = SCENES[i];

    sceneEls.forEach(function (el, k) {
      var on = k === i;
      el.classList.toggle('is-active', on);
      el.classList.toggle('is-before', k < i);
      el.setAttribute('aria-hidden', String(!on));
      if (on) el.removeAttribute('inert'); else el.setAttribute('inert', '');
    });
    root.dataset.scene = name;
    document.body.dataset.scene = name;

    prevBtn.hidden = i === 0;
    nextBtn.hidden = i === 0 || i === SCENES.length - 1;
    nextBtn.classList.remove('is-nudging');
    [].forEach.call(dots.children, function (b, k) {
      if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    $('exCount').textContent = (i + 1) + ' / ' + SCENES.length;

    if (!fromHistory && location.hash !== '#' + name) {
      if (prev === -1) history.replaceState(null, '', '#' + name);
      else history.pushState(null, '', '#' + name);
    }
    if (prev !== -1) {
      var h = sceneEls[i].querySelector('[tabindex="-1"]');
      if (h) h.focus({ preventScroll: true });
    }

    if (name !== 'growth') { stopPlay(); hideTip(); }
    if (name !== 'pyramid') stopPyrPlay();
    if (enter[name]) enter[name](!seen[name]);
    seen[name] = true;
  }

  function nudgeNext() { if (!nextBtn.hidden) nextBtn.classList.add('is-nudging'); }

  prevBtn.addEventListener('click', function () { go(current - 1); });
  nextBtn.addEventListener('click', function () { go(current + 1); });
  root.addEventListener('click', function (e) {
    var t = e.target.closest('[data-go]');
    if (t) go(SCENES.indexOf(t.getAttribute('data-go')));
  });

  function fromHash() {
    var i = SCENES.indexOf(location.hash.slice(1));
    return i === -1 ? 0 : i;
  }
  window.addEventListener('popstate', function () { go(fromHash(), true); });
  window.addEventListener('hashchange', function () { go(fromHash(), true); });

  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { go(current + 1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { go(current - 1); e.preventDefault(); }
  });

  /* swipe between chapters, but never while dragging a slider or the map */
  var touch = null;
  root.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1 || e.target.closest('input, select, .ex-map, .ex-options, .ex-dist-map')) { touch = null; return; }
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  root.addEventListener('touchend', function (e) {
    if (!touch) return;
    var dx = e.changedTouches[0].clientX - touch.x;
    var dy = e.changedTouches[0].clientY - touch.y;
    touch = null;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 50) go(current + (dx < 0 ? 1 : -1));
  }, { passive: true });

  var enter = {};

  /* ── 1 · Odisha today: the live count ───────────────── */
  var counterEl = $('exCounter');

  function startCounter() {
    L.countUp(counterEl, { ms: 7000 });
    $('exCounterNote').textContent = L.paceNote();
  }

  enter.start = function () {
    if (data) paintMap(yearNow());
  };

  /* ── 2 · Seven decades: the year slider ─────────────── */
  var yearInput = $('exYear');
  var sliderEl = $('exSlider');
  var bubble = $('exBubble');
  var caption = $('exCaption');
  var year = 1951;
  var captionIdx = -1;
  var stopTween = function () {};
  var playing = false;
  var interacted = false;

  var CAPTIONS = [
    { from: 1951, text: function () {
      return 'In 1951, about ' + crore(stateAt(1951)) + ' people lived in what is now Odisha.';
    } },
    { from: 1961, text: function () {
      return 'Growth sped up after independence. Between 1961 and 1971 the state added ' +
        lakh(stateAt(1971) - stateAt(1961), 0) + ' people, about ' + rate(1961, 1971) + '% a year.';
    } },
    { from: 1981, text: function () {
      var x = stateAt(1991) / stateAt(1951);
      return 'By 1991 Odisha had ' + crore(stateAt(1991)) + ' people, ' +
        (x >= 2 ? 'more than twice' : x.toFixed(1) + ' times') + ' as many as in 1951.';
    } },
    { from: 2001, text: function () {
      return 'The 2011 Census counted ' + crore(stateAt(2011)) +
        ' people. Growth had slowed to about ' + rate(2001, 2011) + '% a year.';
    } },
    { from: 2012, text: function () {
      var perYear = (stateAt(2031) - stateAt(2026)) / 5;
      return 'From here the figures are projections. Growth keeps slowing: about ' + lakh(perYear) +
        ' more people a year in the late 2020s, or roughly ' + (Math.round(perYear / 365.2425 / 50) * 50) + ' a day.';
    } },
    { from: 2031, text: function () {
      return 'By 2036 Odisha is projected to reach ' + crore(stateAt(2036)) +
        ', but growth is nearly flat, at about ' + rate(2031, 2036) + '% a year.';
    } }
  ];

  function frac(y) { return (y - 1951) / (2036 - 1951); }

  function setYear(y) {
    year = y;
    var yi = Math.round(y);
    var pop = statePop(y);
    var proj = yi > 2011;
    var census = yi <= 2011 && L.years.indexOf(yi) !== -1;

    yearInput.value = yi;
    yearInput.setAttribute('aria-valuetext', yi + ': ' + fmt(pop) + ' people' + (proj ? ', projected' : ''));
    $('exYearWord').textContent = yi;
    $('exYearPop').textContent = fmt(pop);

    var kind = $('exYearKind');
    kind.textContent = proj ? 'Projection' : census ? 'Census count' : 'Estimate between censuses';
    kind.classList.toggle('is-proj', proj);

    sliderEl.style.setProperty('--t', frac(y));
    yearInput.style.setProperty('--fill', (frac(y) * 100) + '%');
    bubble.textContent = yi;
    bubble.classList.toggle('is-proj', proj);

    var idx = 0;
    CAPTIONS.forEach(function (c, k) { if (yi >= c.from) idx = k; });
    if (idx !== captionIdx) swapCaption(idx);

    paintMap(y);
    drawHead(y);
  }

  var swapTimer = null;
  function swapCaption(idx) {
    captionIdx = idx;
    clearTimeout(swapTimer);
    if (reduce || !caption.textContent) { caption.textContent = CAPTIONS[idx].text(); return; }
    caption.classList.add('is-swapping');
    swapTimer = setTimeout(function () {
      caption.textContent = CAPTIONS[idx].text();
      caption.classList.remove('is-swapping');
    }, 520);
  }

  function markInteracted() {
    if (interacted) return;
    interacted = true;
    sliderEl.classList.remove('is-hinting');
  }

  yearInput.addEventListener('input', function () {
    stopTween(); stopPlay(); markInteracted();
    setYear(+yearInput.value);
    if (+yearInput.value === 2036) nudgeNext();
  });

  /* play 1951 → 2036 */
  var playBtn = $('exPlay');
  var stopPlayFn = null;
  function stopPlay() {
    if (stopPlayFn) stopPlayFn();
    stopPlayFn = null;
    playing = false;
    playBtn.setAttribute('aria-pressed', 'false');
    playBtn.lastElementChild.textContent = 'Play';
  }
  playBtn.addEventListener('click', function () {
    if (playing) { stopPlay(); return; }
    stopTween(); markInteracted();
    var from = year >= 2035 ? 1951 : year;
    playing = true;
    playBtn.setAttribute('aria-pressed', 'true');
    playBtn.lastElementChild.textContent = 'Pause';
    var start = null, ms = (2036 - from) * 150, stopped = false;
    stopPlayFn = function () { stopped = true; };
    function frame(ts) {
      if (stopped) return;
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / ms);
      setYear(from + (2036 - from) * t);
      if (t < 1) requestAnimationFrame(frame);
      else { stopPlay(); nudgeNext(); }
    }
    if (reduce) { setYear(2036); stopPlay(); nudgeNext(); } else requestAnimationFrame(frame);
  });

  enter.growth = function (first) {
    if (!data) return;
    drawChart();
    if (first) {
      /* The map arrives showing today, then drains back to 1951. */
      setYear(yearNow());
      stopTween = tween(yearNow(), 1951, 3200, setYear, function () {
        if (!interacted) sliderEl.classList.add('is-hinting');
      }, L.easeInOut);
    } else {
      setYear(year);
    }
  };

  /* ticks under the slider */
  function buildTicks() {
    var box = $('exTicks');
    [1951, 1971, 1991, 2011, 2036].forEach(function (y) {
      var s = document.createElement('span');
      s.textContent = y;
      s.style.left = 'calc(var(--thumb) / 2 + (100% - var(--thumb)) * ' + frac(y) + ')';
      if (y > 2011) s.className = 'is-proj';
      box.appendChild(s);
    });
    yearInput.style.setProperty('--proj', (frac(2011) * 100) + '%');
  }

  /* the growth line, drawn across the stage behind the captions */
  var chart = { x: null, y: null, w: 0, h: 0 };

  function drawChart() {
    var svg = d3.select('#exChart');
    var node = svg.node();
    var w = node.clientWidth, h = node.clientHeight;
    if (!w || !h) return;
    if (w === chart.w && h === chart.h) return;
    chart.w = w; chart.h = h;

    var thumb = parseFloat(getComputedStyle(root).getPropertyValue('--thumb')) || 26;
    var x = chart.x = d3.scaleLinear().domain([1951, 2036]).range([thumb / 2, w - thumb / 2]);
    var y = chart.y = d3.scaleLinear().domain([0, 5e7]).range([h, 0]);

    svg.attr('viewBox', '0 0 ' + w + ' ' + h).selectAll('*').remove();

    var defs = svg.append('defs');
    var grad = defs.append('linearGradient').attr('id', 'exGrad')
      .attr('gradientUnits', 'userSpaceOnUse').attr('x1', 0).attr('x2', w).attr('y1', 0).attr('y2', 0);
    grad.append('stop').attr('offset', '0%').attr('stop-color', '#43b05c');
    grad.append('stop').attr('offset', (frac(2011) * 100) + '%').attr('stop-color', '#f4c534');
    grad.append('stop').attr('offset', '100%').attr('stop-color', '#f07b2c');
    defs.append('clipPath').attr('id', 'exClip').append('rect')
      .attr('x', -10).attr('y', -20).attr('height', h + 40).attr('width', 0);

    var grid = svg.append('g').attr('class', 'grid');
    [1e7, 2e7, 3e7, 4e7, 5e7].forEach(function (v) {
      grid.append('line').attr('x1', 0).attr('x2', w).attr('y1', y(v)).attr('y2', y(v));
      grid.append('text').attr('x', 0).attr('y', y(v) - 6).text((v / 1e7) + ' CR');
    });

    var pts = d3.range(1951, 2036.01, 0.5);
    var line = d3.line().x(function (d) { return x(d); }).y(function (d) { return y(statePop(d)); }).curve(d3.curveMonotoneX);
    var g = svg.append('g').attr('clip-path', 'url(#exClip)');
    var past = pts.filter(function (d) { return d <= 2011; });
    var ahead = pts.filter(function (d) { return d >= 2011; });
    g.append('path').attr('class', 'halo').attr('d', line(pts));
    g.append('path').attr('class', 'line').attr('stroke', 'url(#exGrad)').attr('d', line(past));
    g.append('path').attr('class', 'line proj').attr('stroke', 'url(#exGrad)').attr('d', line(ahead));
    svg.append('circle').attr('class', 'head').attr('r', 7);

    drawHead(year);
  }

  function drawHead(y) {
    if (!chart.x) return;
    var svg = d3.select('#exChart');
    svg.select('#exClip rect').attr('width', chart.x(y) + 10);
    svg.select('.head').attr('cx', chart.x(y)).attr('cy', chart.y(statePop(y)));
  }

  window.addEventListener('resize', function () {
    if (SCENES[current] === 'growth') drawChart();
    else chart.w = 0;   // redraw on next visit
  });

  /* ── the map ─────────────────────────────────────────── */
  var paths = null;
  var tip = $('exTip');

  function buildMap() {
    paths = L.drawMap(document.querySelector('#exMap svg'));

    paths.on('pointermove', function (e, f) {
      if (SCENES[current] !== 'growth') return;
      var r = root.getBoundingClientRect();
      paths.classed('is-hover', function (g) { return g === f; });
      tip.hidden = false;
      tip.innerHTML = '<b>' + f.properties.Dist_Name + '</b> · ' + Math.round(year) + '<br>' +
        fmt(districtPop(dataName(f), year)) + ' people';
      tip.style.left = (e.clientX - r.left) + 'px';
      tip.style.top = (e.clientY - r.top) + 'px';
    }).on('pointerleave', hideTip);

    $('exMapStatus').remove();
  }

  function hideTip() {
    tip.hidden = true;
    if (paths) paths.classed('is-hover', false);
  }

  function paintMap(y) { L.paintMap(paths, y); }

  /* On a phone the answer can land below the fold; bring it up. */
  function reveal(el) {
    setTimeout(function () {
      el.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    }, 350);
  }

  /* ── 3 · Guess: growing older ───────────────────────── */
  var people = $('exPeople');
  var ageGuess = $('exAgeGuess');
  var ageCtl = $('exAgeCtl');
  var ageResult = $('exAgeResult');
  var cells = [];
  var PERSON = '<svg viewBox="0 0 20 26"><circle cx="10" cy="5.5" r="5"/><path d="M1.5 25v-6.5a8.5 8.5 0 0 1 17 0V25z"/></svg>';

  for (var c = 0; c < 100; c++) {
    var cell = document.createElement('div');
    cell.className = 'ex-p';
    cell.innerHTML = PERSON;
    people.appendChild(cell);
    cells.push(cell);
  }

  function showGuess(n) {
    $('exAgeGuessOut').textContent = n;
    cells.forEach(function (el, k) {
      el.style.removeProperty('--d');
      el.classList.remove('is-real', 'was-guess');
      el.classList.toggle('is-guess', k < n);
    });
  }

  ageGuess.addEventListener('input', function () { showGuess(+ageGuess.value); });

  var lastAge = null, lastPick = null;

  $('exAgeTell').addEventListener('click', function () {
    var g = +ageGuess.value;
    lastAge = g;
    var real = Math.round(AGE.y2036);
    cells.forEach(function (el, k) {
      el.style.setProperty('--d', (reduce ? 0 : k * 0.028) + 's');
      el.classList.remove('is-guess');
      el.classList.toggle('is-real', k < real);
      el.classList.toggle('was-guess', k < g);
    });
    $('exPeopleKey').innerHTML = '<span><i class="k-real"></i>Real share, 2036</span><span><i class="k-ring"></i>Your guess</span>';

    var diff = g - AGE.y2036;
    $('exAgeVerdict').textContent = Math.abs(diff) <= 1.5
      ? 'You guessed ' + g + '. That is almost exactly right.'
      : 'You guessed ' + g + '. The real figure is ' + (diff < 0 ? 'higher' : 'lower') + ' than that.';

    var older = data ? AGE.y2036 / 100 * stateAt(2036) : 0;
    $('exAgeWhy').textContent = (older ? 'That is about ' + lakh(older, 0) + ' people aged 60 or over. ' : '') +
      'More older people means more demand for pensions, long-term care and health services close to home.';

    ageCtl.classList.add('is-locked');
    ageResult.hidden = false;
    reveal(ageResult);
    nudgeNext();
  });

  $('exAgeAgain').addEventListener('click', function () {
    ageCtl.classList.remove('is-locked');
    ageResult.hidden = true;
    $('exPeopleKey').innerHTML = '<span><i class="k-guess"></i>Your guess</span>';
    showGuess(+ageGuess.value);
    ageGuess.focus();
  });

  showGuess(+ageGuess.value);

  /* ── 5 · Guess: fastest growth ──────────────────────── */
  var optBox = $('exOptions');
  var fastResult = $('exFastResult');

  function growth(name) { return data[name]['2036'].total / data[name]['1951'].total; }

  function buildOptions() {
    OPTIONS.forEach(function (name, i) {
      var f = geo.features.filter(function (g) { return dataName(g) === name; })[0];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ex-opt';
      b.style.setProperty('--i', i);
      b.dataset.name = name;
      var shape = '';
      if (f) {
        var p = d3.geoPath(d3.geoMercator().fitSize([100, 80], f));
        shape = '<svg viewBox="0 0 100 80" aria-hidden="true"><path d="' + p(f) + '"/></svg>';
      }
      b.innerHTML = shape + '<b>' + name + '</b><span class="ex-opt-bar"><i></i></span><span class="ex-opt-val"></span>';
      b.addEventListener('click', function () { pick(name); });
      optBox.appendChild(b);
    });
  }

  function pick(choice) {
    lastPick = choice;
    var best = OPTIONS.slice().sort(function (a, b) { return growth(b) - growth(a); })[0];
    var top = growth(best);
    optBox.classList.add('is-revealed');
    optBox.parentNode.classList.add('is-answered');

    [].forEach.call(optBox.children, function (b) {
      var name = b.dataset.name, gx = growth(name);
      b.disabled = true;
      b.classList.toggle('is-correct', name === best);
      b.classList.toggle('is-wrong', name === choice && name !== best);
      b.querySelector('.ex-opt-bar i').style.width = (gx / top * 100) + '%';
      var val = b.querySelector('.ex-opt-val');
      tween(1, gx, 2000, function (v) { val.textContent = v.toFixed(1) + '× its 1951 size'; }, null, L.easeInOut);
      var old = b.querySelector('.ex-opt-tag');
      if (old) old.remove();
      if (name === choice) {
        var tag = document.createElement('span');
        tag.className = 'ex-opt-tag';
        tag.textContent = name === best ? 'Correct' : 'Your pick';
        b.appendChild(tag);
      }
    });

    var d = data[best];
    var biggest = Object.keys(data).sort(function (a, b) { return data[b]['2036'].total - data[a]['2036'].total; })[0];
    $('exFastBig').innerHTML = (choice === best ? 'Right: ' : 'It is ') + '<b>' + best + '</b>. Its population is projected to be ' +
      top.toFixed(1) + ' times its 1951 size, rising from ' + lakh(d['1951'].total) + ' to ' + lakh(d['2036'].total) + '.';
    $('exFastWhy').textContent = biggest + ' will still be the largest district, home to about ' +
      lakh(data[biggest]['2036'].total, 0) + ' people by 2036. A district can grow fastest because it started small, and still not be the biggest.';
    fastResult.hidden = false;
    reveal(fastResult);
    nudgeNext();
  }

  $('exFastAgain').addEventListener('click', function () {
    optBox.classList.remove('is-revealed');
    optBox.parentNode.classList.remove('is-answered');
    [].forEach.call(optBox.children, function (b) {
      b.disabled = false;
      b.classList.remove('is-correct', 'is-wrong');
      b.querySelector('.ex-opt-bar i').style.width = '0';
      b.querySelector('.ex-opt-val').textContent = '';
      var tag = b.querySelector('.ex-opt-tag');
      if (tag) tag.remove();
    });
    fastResult.hidden = true;
    optBox.firstElementChild.focus();
  });

  /* ── extra district data, for the pyramid and district chapters ── */
  var extra = { age: null, tfr: null, life: null };
  var extraReady = Promise.all([
    fetch('datasets/district_age_pyramids.json').then(function (r) { return r.json(); }),
    fetch('datasets/district_fertility_trends.json').then(function (r) { return r.json(); }),
    fetch('datasets/district_life_expectancy.json').then(function (r) { return r.json(); })
  ]).then(function (res) {
    extra.age = res[0]; extra.tfr = res[1]; extra.life = res[2];
  });

  var OLD_FROM = 12;   // index of the 60–64 band: 60 and over from here
  var KIDS_TO = 3;     // bands 0–4, 5–9, 10–14 are under 15

  var stateAgeCache = {};
  function ageRows(place, yr) {
    if (place) return extra.age[place][yr];
    if (!stateAgeCache[yr]) {
      var sum = [];
      Object.keys(extra.age).forEach(function (d) {
        extra.age[d][yr].forEach(function (r, i) {
          if (!sum[i]) sum[i] = { age: r.age, male: 0, female: 0, total: 0 };
          sum[i].male += r.male; sum[i].female += r.female; sum[i].total += r.total;
        });
      });
      stateAgeCache[yr] = sum;
    }
    return stateAgeCache[yr];
  }

  function ageShares(rows) {
    var tot = 0, kids = 0, old = 0;
    rows.forEach(function (r, i) {
      tot += r.total;
      if (i < KIDS_TO) kids += r.total;
      if (i >= OLD_FROM) old += r.total;
    });
    return { kids: kids / tot * 100, old: old / tot * 100, work: (tot - kids - old) / tot * 100, tot: tot };
  }

  function pct(v) { return v.toFixed(1) + '%'; }

  function districtOptions(select) {
    Object.keys(data).sort().forEach(function (n) {
      var o = document.createElement('option');
      o.value = n; o.textContent = n;
      select.appendChild(o);
    });
  }

  /* ── 4 · Watch it happen: the age pyramid ───────────── */
  var PYR_YEARS = ['2011', '2021', '2026', '2031', '2036'];
  var pyr = { place: '', year: '2011', bars: null, x: null, shown: { kids: 0, work: 0, old: 0 }, stop: [], timer: null, playing: false };
  var pyrBox = $('exPyrYears');
  var pyrPlayBtn = null;

  function buildPyramid() {
    var W = 560, H = 470, top = 14, bottom = 34, gap = 46;
    var svg = d3.select('#exPyr').attr('viewBox', '0 0 ' + W + ' ' + H);
    var ages = extra.age[Object.keys(extra.age)[0]]['2011'].map(function (r) { return r.age; });

    /* one fixed scale for every place and year, so shapes compare honestly */
    var max = 0;
    [''].concat(Object.keys(extra.age)).forEach(function (p) {
      PYR_YEARS.forEach(function (yr) {
        var rows = ageRows(p, yr), tot = ageShares(rows).tot;
        rows.forEach(function (r) { max = Math.max(max, r.male / tot, r.female / tot); });
      });
    });
    max = Math.ceil(max * 100) / 100;

    var half = (W - gap) / 2;
    var x = pyr.x = d3.scaleLinear().domain([0, max]).range([0, half]);
    var y = d3.scaleBand().domain(ages.slice().reverse()).range([top, H - bottom]).padding(0.14);
    pyr.half = half; pyr.gap = gap;

    svg.append('text').attr('class', 'yr').attr('id', 'exPyrYr').attr('x', W - 4).attr('y', top + 58).attr('text-anchor', 'end').text('2011');

    var axis = svg.append('g').attr('class', 'axis');
    d3.range(0, max + 1e-9, 0.02).forEach(function (t) {
      [half - x(t), half + gap + x(t)].forEach(function (xx) {
        axis.append('line').attr('x1', xx).attr('x2', xx).attr('y1', top).attr('y2', H - bottom);
        axis.append('text').attr('x', xx).attr('y', H - bottom + 18).attr('text-anchor', 'middle').text(Math.round(t * 100) + '%');
      });
    });

    var g = svg.append('g');
    pyr.bars = { m: [], f: [] };
    ages.forEach(function (a, i) {
      var old = i >= OLD_FROM ? ' old' : '';
      pyr.bars.m.push(g.append('rect').attr('class', 'bar m' + old).attr('y', y(a)).attr('height', y.bandwidth()).attr('x', half).attr('width', 0).attr('rx', 2));
      pyr.bars.f.push(g.append('rect').attr('class', 'bar f' + old).attr('y', y(a)).attr('height', y.bandwidth()).attr('x', half + gap).attr('width', 0).attr('rx', 2));
      if (i % 2 === 0 || i === ages.length - 1) {
        g.append('text').attr('class', 'age').attr('x', half + gap / 2).attr('y', y(a) + y.bandwidth() / 2 + 4).text(a);
      }
    });

    PYR_YEARS.forEach(function (yr) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = yr;
      b.dataset.year = yr;
      b.setAttribute('aria-pressed', String(yr === pyr.year));
      b.addEventListener('click', function () { stopPyrPlay(); setPyr(pyr.place, yr); });
      pyrBox.appendChild(b);
    });
    pyrPlayBtn = document.createElement('button');
    pyrPlayBtn.type = 'button';
    pyrPlayBtn.className = 'ex-years-play';
    pyrPlayBtn.textContent = '▶ Play';
    pyrPlayBtn.addEventListener('click', function () { if (pyr.playing) stopPyrPlay(); else playPyr(); });
    pyrBox.appendChild(pyrPlayBtn);

    var sel = $('exPyrPlace');
    districtOptions(sel);
    sel.addEventListener('change', function () { setPyr(sel.value, pyr.year); });
  }

  function setPyr(place, yr) {
    pyr.place = place; pyr.year = yr;
    var rows = ageRows(place, yr), s = ageShares(rows);
    var dur = reduce ? 0 : 1800;
    rows.forEach(function (r, i) {
      var wm = pyr.x(r.male / s.tot), wf = pyr.x(r.female / s.tot);
      pyr.bars.m[i].transition().duration(dur).ease(d3.easeCubicInOut).attr('x', pyr.half - wm).attr('width', wm);
      pyr.bars.f[i].transition().duration(dur).ease(d3.easeCubicInOut).attr('width', wf);
    });
    d3.select('#exPyrYr').text(yr);
    [].forEach.call(pyrBox.querySelectorAll('button[data-year]'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.year === yr));
    });

    pyr.stop.forEach(function (f) { f(); });
    pyr.stop = [['kids', 'exPyrKids'], ['work', 'exPyrWork'], ['old', 'exPyrOld']].map(function (k) {
      var el = $(k[1]);
      return tween(pyr.shown[k[0]], s[k[0]], dur, function (v) { pyr.shown[k[0]] = v; el.textContent = pct(v); }, null, L.easeInOut);
    });

    $('exPyrDesc').textContent = 'Age pyramid for ' + (place || 'Odisha') + ', ' + yr + ': ' +
      pct(s.kids) + ' under 15, ' + pct(s.work) + ' aged 15 to 59, ' + pct(s.old) + ' aged 60 and over.';
  }

  function playPyr() {
    pyr.playing = true;
    pyrPlayBtn.textContent = '❚❚ Pause';
    var i = PYR_YEARS.indexOf(pyr.year);
    if (i >= PYR_YEARS.length - 1) i = -1;
    (function step() {
      i++;
      setPyr(pyr.place, PYR_YEARS[i]);
      if (i < PYR_YEARS.length - 1) pyr.timer = setTimeout(step, reduce ? 600 : 2600);
      else pyr.timer = setTimeout(function () { stopPyrPlay(); nudgeNext(); }, 1800);
    })();
  }

  function stopPyrPlay() {
    clearTimeout(pyr.timer);
    pyr.playing = false;
    if (pyrPlayBtn) pyrPlayBtn.textContent = '▶ Play';
  }

  enter.pyramid = function (first) {
    extraReady.then(function () {
      if (!data) return;
      if (!pyr.bars) buildPyramid();
      if (first) {
        setPyr('', '2011');
        /* let the chapter settle, then play the decades through once */
        pyr.timer = setTimeout(function () { if (SCENES[current] === 'pyramid') playPyr(); }, reduce ? 0 : 1800);
      }
    });
  };

  /* ── 6 · Find your district ──────────────────────────── */
  var dist = { name: null, paths: null, built: false, stop: [], card: null };

  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function buildDistrict() {
    dist.built = true;
    var sel = $('exDistSel');
    districtOptions(sel);
    sel.addEventListener('change', function () { if (sel.value) showDistrict(sel.value); });

    dist.paths = L.drawMap($('exDistMap'));
    dist.paths.on('click', function (e, f) { showDistrict(dataName(f)); })
      .append('title').text(function (f) { return f.properties.Dist_Name; });
  }

  function showDistrict(name) {
    dist.name = name;
    $('exDistSel').value = name;
    dist.paths.classed('is-picked', function (f) { return dataName(f) === name; });

    var d = data[name];
    var names = Object.keys(data);
    var byPop = names.slice().sort(function (a, b) { return data[b]['2036'].total - data[a]['2036'].total; });
    var byGrowth = names.slice().sort(function (a, b) { return growth(b) - growth(a); });
    var popRank = byPop.indexOf(name) + 1, growRank = byGrowth.indexOf(name) + 1;

    $('exDcEmpty').hidden = true;
    var body = $('exDcBody');
    body.hidden = false;
    body.style.animation = 'none'; void body.offsetWidth; body.style.animation = '';

    $('exDcName').textContent = name;
    $('exDcRank').textContent = 'The ' + (popRank === 1 ? 'most' : ordinal(popRank) + ' most') + ' populous of Odisha’s ' + names.length +
      ' districts by 2036, and the ' + (growRank === 1 ? 'fastest' : ordinal(growRank) + ' fastest') + '-growing since 1951.';

    dist.stop.forEach(function (f) { f(); });
    var popEl = $('exDcPop'), grEl = $('exDcGrowth');
    dist.stop = [
      tween(d['1951'].total, d['2036'].total, 2200, function (v) { popEl.textContent = lakh(v); }, null, L.easeInOut),
      tween(1, growth(name), 2200, function (v) { grEl.textContent = v.toFixed(1) + '×'; }, null, L.easeInOut)
    ];

    drawSpark(name);

    /* age mix, 2011 and 2036 */
    var box = $('exDcAge');
    box.innerHTML = '';
    var mix = {};
    ['2011', '2036'].forEach(function (yr) {
      var s = mix[yr] = ageShares(extra.age[name][yr]);
      var row = document.createElement('div');
      row.className = 'ex-dc-agerow';
      row.innerHTML = '<span>' + yr + '</span><div class="ex-dc-bar">' +
        '<i class="kid" data-w="' + s.kids + '">' + (s.kids > 9 ? Math.round(s.kids) + '%' : '') + '</i>' +
        '<i class="work" data-w="' + s.work + '">' + (s.work > 9 ? Math.round(s.work) + '%' : '') + '</i>' +
        '<i class="old" data-w="' + s.old + '">' + (s.old > 9 ? Math.round(s.old) + '%' : '') + '</i></div>';
      box.appendChild(row);
    });
    var key = document.createElement('div');
    key.className = 'ex-dc-agekey';
    key.innerHTML = '<span><i style="background:var(--pm-cyan)"></i>Under 15</span><span><i style="background:#d9dee2"></i>15–59</span><span><i style="background:var(--pm-orange)"></i>60 and over</span>';
    box.appendChild(key);
    setTimeout(function () {
      [].forEach.call(box.querySelectorAll('.ex-dc-bar i'), function (i) { i.style.width = i.dataset.w + '%'; });
    }, reduce ? 0 : 120);

    /* facts */
    var state36 = ageShares(ageRows('', '2036'));
    var tfr = extra.tfr[name] || {}, life = extra.life[name] || {};
    var facts = [];
    facts.push(['Aged 60 and over, 2036', '<b>' + pct(mix['2036'].old) + '</b>, against ' + pct(state36.old) + ' for Odisha']);
    facts.push(['Under 15, 2036', '<b>' + pct(mix['2036'].kids) + '</b>, against ' + pct(state36.kids) + ' for Odisha']);
    if (tfr['2015-16 (NFHS-4)'] != null && tfr['2036'] != null) {
      facts.push(['Children per woman', '<b>' + tfr['2015-16 (NFHS-4)'] + '</b> in 2015–16 (NFHS-4), projected <b>' + tfr['2036'] + '</b> by 2036']);
    }
    if (life.female && life.male && life.female.nfhs5 != null && life.male.nfhs5 != null) {
      facts.push(['Life expectancy (NFHS-5)', 'Women <b>' + life.female.nfhs5.toFixed(1) + '</b>, men <b>' + life.male.nfhs5.toFixed(1) + '</b> years']);
    }
    $('exDcFacts').innerHTML = facts.map(function (f) { return '<div><dt>' + f[0] + '</dt><dd>' + f[1] + '</dd></div>'; }).join('');

    $('exDcLink').href = 'district.html?id=' + encodeURIComponent(name);
    dist.card = { name: name, d: d, mix: mix, state36: state36, tfr: tfr };
    reveal($('exDistCard'));
  }

  function drawSpark(name) {
    var svg = d3.select('#exDcSpark');
    var w = svg.node().clientWidth || 480, h = 70;
    svg.attr('viewBox', '0 0 ' + w + ' ' + h).selectAll('*').remove();
    var x = d3.scaleLinear().domain([1951, 2036]).range([4, w - 4]);
    var max = 0;
    L.years.forEach(function (yr) { max = Math.max(max, data[name][yr].total); });
    var y = d3.scaleLinear().domain([0, max]).range([h - 4, 6]);
    var pts = d3.range(1951, 2036.01, 1);
    var line = d3.line().x(function (d) { return x(d); }).y(function (d) { return y(districtPop(name, d)); }).curve(d3.curveMonotoneX);
    var area = d3.area().x(function (d) { return x(d); }).y0(h - 4).y1(function (d) { return y(districtPop(name, d)); }).curve(d3.curveMonotoneX);
    svg.append('defs').append('clipPath').attr('id', 'exSparkClip').append('rect').attr('x', 0).attr('y', 0).attr('height', h).attr('width', 0)
      .transition().duration(reduce ? 0 : 2200).ease(d3.easeCubicInOut).attr('width', w);
    var g = svg.append('g').attr('clip-path', 'url(#exSparkClip)');
    g.append('path').attr('class', 'area').attr('d', area(pts));
    g.append('path').attr('class', 'ln').attr('d', line(pts.filter(function (d) { return d <= 2011; })));
    g.append('path').attr('class', 'pj').attr('d', line(pts.filter(function (d) { return d >= 2011; })));
    $('exDcSparkKey').innerHTML = '<span>1951: ' + lakh(data[name]['1951'].total) + '</span><span>2011 census: ' + lakh(data[name]['2011'].total) +
      '</span><span>2036: ' + lakh(data[name]['2036'].total) + ' (projected)</span>';
  }

  enter.district = function () {
    extraReady.then(function () { if (data && !dist.built) buildDistrict(); });
  };

  /* ── share cards ─────────────────────────────────────── */
  var toast = $('exToast'), toastTimer = null;
  function say(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 3200);
  }

  var CARD_DISPLAY = "'Anton', Impact, sans-serif", CARD_UI = "'Hind', sans-serif";

  function peopleGrid(real, guess) {
    return function (ctx, box) {
      var cols = 10, gap = 8, size = (box.w - gap * (cols - 1)) / cols;
      for (var k = 0; k < 100; k++) {
        var cx = box.x + (k % cols) * (size + gap) + size / 2;
        var cy = box.y + Math.floor(k / cols) * (size + gap) + size / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, size / 2 - 2, 0, Math.PI * 2);
        ctx.fillStyle = k < real ? '#ffffff' : 'rgba(255,255,255,0.2)';
        ctx.fill();
        if (guess != null && k < guess) { ctx.lineWidth = 3; ctx.strokeStyle = '#f08a4b'; ctx.stroke(); }
      }
    };
  }

  function barsPic(items) {
    return function (ctx, box) {
      var max = d3.max(items, function (i) { return i.v; });
      var rowH = box.h / items.length;
      items.forEach(function (it, k) {
        var y = box.y + k * rowH;
        ctx.font = '30px ' + CARD_DISPLAY;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(it.label.toUpperCase(), box.x, y + 30);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(box.x, y + 44, box.w, 20);
        ctx.fillStyle = it.hi ? '#f4c534' : 'rgba(255,255,255,0.75)';
        ctx.fillRect(box.x, y + 44, box.w * it.v / max, 20);
        ctx.font = '600 22px ' + CARD_UI;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.textAlign = 'right';
        ctx.fillText(it.text, box.x + box.w, y + 30);
        ctx.textAlign = 'left';
      });
    };
  }

  function mixPic(mix) {
    return function (ctx, box) {
      ['2011', '2036'].forEach(function (yr, k) {
        var y = box.y + 40 + k * 110, s = mix[yr], x = box.x;
        ctx.font = '34px ' + CARD_DISPLAY;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(yr, box.x, y);
        [['kids', '#9fd3f0'], ['work', '#d9dee2'], ['old', '#f08a4b']].forEach(function (p) {
          var w = box.w * s[p[0]] / 100;
          ctx.fillStyle = p[1];
          ctx.fillRect(x, y + 14, w, 40);
          if (s[p[0]] > 12) {
            ctx.font = '600 20px ' + CARD_UI;
            ctx.fillStyle = '#231f20';
            ctx.fillText(Math.round(s[p[0]]) + '%', x + 8, y + 42);
          }
          x += w;
        });
      });
      ctx.font = '600 19px ' + CARD_UI;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('Under 15  ·  15–59  ·  60 and over', box.x, box.y + 290);
    };
  }

  function cardFor(kind) {
    if (kind === 'ageing' && lastAge != null) {
      var g = lastAge;
      return {
        file: 'soochana-ageing-guess.png',
        text: 'I guessed ' + g + ' of every 100 people in Odisha will be 60 or over by 2036. The answer: 15.9.',
        spec: {
          bg: GROUND.ageing, kicker: 'Guess the number',
          title: 'How many of every 100 people in Odisha will be 60 or over by 2036?',
          big: '15.9', bigNote: 'of every 100',
          lines: ['I guessed ' + g + '. ' + (Math.abs(g - AGE.y2036) <= 1.5 ? 'Almost exactly right.' : 'The real figure is ' + (g < AGE.y2036 ? 'higher.' : 'lower.')),
                  'That is about ' + lakh(AGE.y2036 / 100 * stateAt(2036), 0) + ' people aged 60 or over.'],
          draw: peopleGrid(Math.round(AGE.y2036), g)
        }
      };
    }
    if (kind === 'fastest' && lastPick) {
      var best = OPTIONS.slice().sort(function (a, b) { return growth(b) - growth(a); })[0];
      return {
        file: 'soochana-fastest-district.png',
        text: best + ' is projected to grow to ' + growth(best).toFixed(1) + ' times its 1951 size by 2036.',
        spec: {
          bg: GROUND.fastest, kicker: 'Pick a district',
          title: 'Which district grows the most, 1951 to 2036?',
          big: best.toUpperCase(),
          lines: [growth(best).toFixed(1) + ' times its 1951 size, from ' + lakh(data[best]['1951'].total) + ' to ' + lakh(data[best]['2036'].total) + ' people.',
                  lastPick === best ? 'I got it right.' : 'I picked ' + lastPick + '.'],
          draw: barsPic(OPTIONS.map(function (n) { return { label: n, v: growth(n), text: growth(n).toFixed(1) + '×', hi: n === best }; })
            .sort(function (a, b) { return b.v - a.v; }))
        }
      };
    }
    if (kind === 'district' && dist.card) {
      var c = dist.card;
      return {
        file: 'soochana-' + c.name.toLowerCase().replace(/\W+/g, '-') + '.png',
        text: c.name + ' district: ' + lakh(c.d['2036'].total) + ' people by 2036.',
        spec: {
          bg: GROUND.district, kicker: 'Find your district',
          title: c.name,
          big: (c.d['2036'].total / 1e5).toFixed(1).replace(/\.0$/, ''), bigNote: 'lakh people by 2036',
          lines: [growth(c.name).toFixed(1) + ' times its 1951 size. ' + pct(c.mix['2036'].old) + ' will be 60 or over, against ' + pct(c.state36.old) + ' for Odisha.',
                  c.tfr['2036'] != null ? 'Projected children per woman by 2036: ' + c.tfr['2036'] + '.' : ''].filter(Boolean),
          draw: mixPic(c.mix)
        }
      };
    }
    return null;
  }

  root.addEventListener('click', function (e) {
    var btn = e.target.closest('.ex-share');
    if (!btn || !window.SoochanaShare || !data) return;
    var card = cardFor(btn.dataset.card);
    if (!card) return;
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Preparing…';
    SoochanaShare.make(card.spec).then(function (blob) {
      return SoochanaShare.send(blob, card.file, card.text);
    }).then(function (how) {
      if (how === 'downloaded') say('Image saved: ' + card.file);
      else if (how === 'shared') say('Shared');
    }, function () {
      say('Sorry, the image could not be made in this browser.');
    }).then(function () {
      btn.disabled = false;
      btn.textContent = label;
    });
  });

  /* ── 7 · Keep exploring: share ──────────────────────── */
  var shareBtn = $('exShare');
  shareBtn.addEventListener('click', function () {
    var url = location.href.split('#')[0];
    if (navigator.share) {
      navigator.share({ title: document.title, url: url }).catch(function () {});
      return;
    }
    var done = function () {
      shareBtn.textContent = 'Link copied';
      setTimeout(function () { shareBtn.textContent = 'Share this tour'; }, 2200);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () {});
  });

  /* ── load ────────────────────────────────────────────── */
  go(fromHash(), true);

  L.load().then(function () {
    data = L.data;
    geo = L.geo;

    buildTicks();
    buildMap();
    buildOptions();
    startCounter();

    /* re-run the entry for whichever chapter the page opened on */
    var name = SCENES[current];
    seen[name] = false;
    if (enter[name]) enter[name](true);
    seen[name] = true;
    if (name !== 'start' && name !== 'growth') paintMap(yearNow());
  }).catch(function () {
    counterEl.textContent = '–';
    $('exCounterNote').textContent = 'The data could not be loaded. Open this page through the site (not as a file) and reload.';
    var st = $('exMapStatus');
    if (st) st.textContent = 'The map could not be loaded.';
  });
})();
