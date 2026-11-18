/**
 * ui.js
 * Shared chrome for every Soochana page:
 *   1. injects the grain overlay
 *   2. reveals editorial bands on scroll
 *   3. resolves editorial artwork
 *   4. draws the animated Soochana logo
 */
(function () {
  /* The header used to carry an A / A+ / A++ text-size control. It is gone,
     so clear any size a reader saved with it; otherwise they would be left
     with enlarged text and no way to change it back. */
  try { localStorage.removeItem('soochana-text'); } catch (e) {}

  /* ── 1. build the chrome once the DOM exists ───────────── */
  function build() {
    /* grain overlay */
    if (!document.querySelector('.grain')) {
      var g = document.createElement('div');
      g.className = 'grain';
      g.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(g, document.body.firstChild);
    }
  }

  /* ── 1b. the header menus (nav.css): one open at a time; an outside
     click, Esc or choosing an item closes them ── */
  function navMenus() {
    var menus = [].slice.call(document.querySelectorAll('header details.nav-menu'));
    if (!menus.length) return;
    function closeAll(except) { menus.forEach(function (m) { if (m !== except) m.open = false; }); }
    menus.forEach(function (m) {
      m.addEventListener('toggle', function () { if (m.open) closeAll(m); });
      m.querySelectorAll('.nav-pop a, .nav-pop button').forEach(function (it) {
        it.addEventListener('click', function () { m.open = false; });
      });
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest || !e.target.closest('header details.nav-menu')) closeAll(null);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var open = menus.filter(function (m) { return m.open; })[0];
      if (open) { open.open = false; open.querySelector('summary').focus(); }
    });
  }

  /* ── 2. editorial bands and the gallery reveal on scroll ── */
  function revealBands() {
    var targets = document.querySelectorAll('.editorial-band, .editorial-gallery');
    if (!targets.length) return;

    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (t) { t.classList.add('in'); });
      return;
    }

    var pending = [].slice.call(targets);

    function show(el) {
      var i = pending.indexOf(el);
      if (i === -1) return;
      pending.splice(i, 1);
      obs.unobserve(el);
      if (el.classList.contains('editorial-gallery')) stagger(el);
      el.classList.add('in');
      if (!pending.length) window.removeEventListener('scroll', sweep);
    }

    /* A jump — an anchor link, a restored scroll position, a find-in-page —
       can carry a section from below the viewport to above it without the
       observer ever reporting it as intersecting, which would leave it blank
       for good. This sweep catches anything already scrolled past. */
    var ticking = false;
    function sweep() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        pending.slice().forEach(function (el) {
          if (el.getBoundingClientRect().bottom < 0) show(el);
        });
      });
    }

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) show(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    pending.forEach(function (t) { obs.observe(t); });
    window.addEventListener('scroll', sweep, { passive: true });
  }

  /* Stagger the frames so they slide on one after another rather than as a
     block: across each row left to right, matching both reading order and
     the direction the cards travel from. Rows are read off the live layout
     rather than assumed, so it holds at any column count. */
  function stagger(gallery) {
    var cards = [].slice.call(gallery.querySelectorAll('.editorial-frame'));
    if (!cards.length) return;

    cards.map(function (card) {
      var r = card.getBoundingClientRect();
      return { card: card, row: Math.round(r.top / 40), x: r.left };
    }).sort(function (a, b) {
      return a.row - b.row || a.x - b.x;
    }).forEach(function (item, i) {
      item.card.style.setProperty('--d', (i * 95) + 'ms');
    });
  }

  /* ── 3. editorial artwork loader ──
     An <img data-art="name"> is resolved against images/editorial/, trying
     each common extension in turn, so saving a .jpg where a .png was expected
     still works. When every candidate fails the figure removes itself: inside
     a band the copy stands on its own, so the band reflows to one column
     rather than sitting half empty. Nothing here leaves a broken-image box. */
  var ART_DIR = 'images/editorial/';
  var ART_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

  function giveUp(img) {
    var fig = img.closest ? img.closest('.editorial-figure') : null;
    if (!fig) { img.remove(); return; }
    /* In the gallery the picture is the point, so the whole card goes.
       In a band the copy stands alone, so only the figure goes. */
    var frame = fig.closest('.editorial-frame');
    if (frame) frame.remove(); else fig.remove();
  }

  function loadArt(img) {
    var base = img.getAttribute('data-art');
    if (!base) return;
    var i = 0;
    function attempt() {
      if (i >= ART_EXT.length) { giveUp(img); return; }
      img.src = ART_DIR + base + ART_EXT[i++];
    }
    img.addEventListener('error', attempt);
    img.addEventListener('load', function () {
      var fig = img.closest && img.closest('.editorial-figure');
      if (!fig) return;
      fig.style.display = 'flex';
      /* A band stays one column until its picture genuinely decodes. */
      var band = fig.closest('.editorial-band');
      if (band) band.classList.add('has-art');
    });
    /* loading="lazy" would defer the whole extension walk until the figure
       nears the viewport; these are small and the walk must finish for the
       layout to settle, so resolve eagerly. */
    img.loading = 'eager';
    attempt();
  }

  function guardFigures() {
    document.querySelectorAll('img[data-art]').forEach(loadArt);

    /* Plain src images (not using data-art) still fail closed — but an
       <img> with no src yet is waiting for the page to fill it in, not
       broken. Removing those took the element out from under code that
       was still about to use it, which surfaced only once real network
       latency let this run first. */
    document.querySelectorAll('.editorial-figure img:not([data-art])').forEach(function (img) {
      if (!img.getAttribute('src')) return;
      img.addEventListener('error', function () { giveUp(img); });
    });
    document.querySelectorAll('img.editorial-ghost:not([data-art])').forEach(function (img) {
      img.addEventListener('error', function () { img.remove(); });
    });
  }

  window.SoochanaArt = { dir: ART_DIR, load: loadArt };

  /* ── 4. the Soochana logo ──
     Soochana means "information". Three dots, Numbers, Narratives and
     Intelligence, sit in a row like a sentence still being written, then
     run together into one orange circle (the old brand dot, grown up) and
     SOOCHANA lands across it: dark where it hangs outside the circle,
     knocked out to white where it crosses it. In the header a droplet
     buds off the circle now and then and is drawn back in.

     The merge is a "gooey" filter: blur everything, then crank the alpha
     contrast so overlapping blurs read as one solid shape with a smooth
     neck between them.

     Pages carry only <span class="soo-mark">; the drawing lives here so
     there is one copy of it. Add soo-mark--hero for the large, labelled
     version (the home page's welcome screen). Without JS, style.css shows
     the plain orange dot and the page's own "Soochana" heading. */
  var logoCount = 0;

  /* geometry, in the SVG's own units: the circle and the word are shared;
     the hero only differs in where the three dots start and in its labels */
  var DISC = { x: 340, y: 86, r: 92 };
  /* Whole letters take one colour each, SOOCH in ink and ANA knocked out,
     with ANA sized to sit wholly inside the circle. Cutting glyphs at the
     circle's edge looked bolder but read poorly at header size. */
  var WORD = '<text x="40" y="136" textLength="372" lengthAdjust="spacing" transform="rotate(-8 225 104)">' +
    '<tspan class="soo-ink">SOOCH</tspan><tspan class="soo-knock">ANA</tspan></text>';
  var DOTS = {
    header: { box: '30 -10 408 192', start: [-200, -100, 0], scale: 0.45 },
    hero:   { box: '14 -14 440 200', start: [-256, -106, 44], scale: 1.4 }
  };
  var LABELS = ['Numbers', 'Narratives', 'Intelligence'];

  function logoSVG(hero) {
    var n = ++logoCount;
    var g = hero ? DOTS.hero : DOTS.header;
    var goo = 'sooGoo' + n;
    var dots = g.start.map(function (dx, i) {
      return '<circle class="soo-blob soo-bl' + (i + 1) + '" cx="' + DISC.x + '" cy="' + DISC.y + '" r="40"' +
        ' style="--x:' + dx + 'px;--s:' + g.scale + '"/>';
    }).join('');
    var labels = hero ? '<g class="soo-labels">' + g.start.map(function (dx, i) {
      return '<text class="soo-lb soo-lb' + (i + 1) + '" x="' + (DISC.x + dx) + '" y="' + (DISC.y + 6) + '">' + LABELS[i] + '</text>';
    }).join('') + '</g>' : '';

    return '<svg class="soo-svg" viewBox="' + g.box + '" focusable="false" aria-hidden="true">' +
      '<defs>' +
        '<filter id="' + goo + '" x="-60%" y="-60%" width="220%" height="220%" color-interpolation-filters="sRGB">' +
          '<feGaussianBlur in="SourceGraphic" stdDeviation="9" result="b"/>' +
          '<feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -11"/>' +
        '</filter>' +
      '</defs>' +
      '<g class="soo-goo" filter="url(#' + goo + ')">' +
        dots +
        '<circle class="soo-bud soo-bud1" cx="' + DISC.x + '" cy="' + DISC.y + '" r="22"/>' +
        '<circle class="soo-bud soo-bud2" cx="' + DISC.x + '" cy="' + DISC.y + '" r="18"/>' +
        '<circle class="soo-disc" cx="' + DISC.x + '" cy="' + DISC.y + '" r="' + DISC.r + '"/>' +
      '</g>' +
      /* the finished circle again, outside the filter, so its edge is a
         crisp vector rather than a blurred-and-thresholded bitmap */
      '<circle class="soo-disc" cx="' + DISC.x + '" cy="' + DISC.y + '" r="' + DISC.r + '"/>' +
      labels +
      '<g class="soo-word">' + WORD + '</g>' +
    '</svg>';
  }

  /* The wordmark is set in Anton, which most pages do not load yet.
     textLength above keeps its width fixed while the font arrives. */
  function loadDisplayFont() {
    var has = [].some.call(document.querySelectorAll('link[rel="stylesheet"]'), function (l) {
      return /family=Anton/.test(l.href);
    });
    if (has) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Anton&display=swap';
    document.head.appendChild(link);
  }

  function play(mark) {
    mark.classList.remove('soo-play');
    void mark.offsetWidth;                    /* restart the keyframes */
    mark.classList.add('soo-play');
  }

  function drawMarks() {
    var marks = document.querySelectorAll('.soo-mark');
    if (!marks.length) return;
    loadDisplayFont();

    marks.forEach(function (mark) {
      if (!mark.firstChild) mark.innerHTML = logoSVG(mark.classList.contains('soo-mark--hero'));
      play(mark);

      var link = mark.closest('a');
      if (!link || link.classList.contains('soo-brand')) return;
      /* the logo carries the name now; the heading stays for screen readers */
      link.classList.add('soo-brand');

      /* the tagline's two words underline in step with the drawing */
      var tag = link.querySelector('.brand-tag');
      if (tag && tag.textContent.trim() === 'from numbers to narrative') {
        tag.innerHTML = 'from <span class="soo-w soo-w1">numbers</span> to <span class="soo-w soo-w2">narrative</span>';
      }

      /* hover replays the build, at most once every few seconds */
      var last = Date.now();
      link.addEventListener('pointerenter', function () {
        if (Date.now() - last < 4000) return;
        last = Date.now();
        play(mark);
      });
    });
  }

  /* ── 5. motion: cards rise into view, headline figures count up ──
     The same treatment as the district profile, for every content page.
     Only blocks that start below the fold are hidden first, so nothing
     already on screen flickers; blocks a page draws later fade up as they
     arrive. The home page, the district profile, Tectonics and the guided
     tour run their own animation and are left alone. Off for readers who
     ask for reduced motion. */
  var MOTION_CARDS = [
    '.feature-card', '.institution-card', '.next-card', '.team-card-unit',
    '.theme-card', '.article-card', '.dataset-card', '.report-card',
    '.report-section-card', '.stat-cell', '.band-cell', '.policy-panel',
    '.editorial-figure', '.flourish-figure', '.pyramid-panel', '.contact-form-card',
    '.ln-figure', '.fr-card', '.ln-recipe-box', '.comp-row', 'main section.panel', '.pl-tile', '.pl-card'
  ].join(', ');
  var MOTION_NUMS = '.stat-value, .meta-val, .big-num, .band-val:not([data-to])';
  var MOTION_SKIP = 'header, nav, #soochana-chatbot, .chatbot-window, .dp-card, .dp-hero, [data-count], [data-no-motion]';

  function motion() {
    var body = document.body;
    if (!body || body.classList.contains('home') || body.classList.contains('tk-body') || body.classList.contains('ex-body')) return;
    if (document.querySelector('.dp-hero')) return;              /* the district profile has its own */
    var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) return;

    var css = document.createElement('style');
    css.textContent =
      '.mo-reveal{opacity:0;transform:translateY(24px);transition:opacity .7s ease,transform .8s cubic-bezier(.16,1,.3,1)!important;transition-delay:var(--mo-d,0s)!important}' +
      '.mo-reveal.mo-in{opacity:1;transform:none}';
    document.head.appendChild(css);

    var seen = typeof WeakSet === 'function' ? new WeakSet() : null;
    function done(el) {
      /* hand the element back its own transitions once it has landed */
      setTimeout(function () { el.classList.remove('mo-reveal', 'mo-in'); el.style.removeProperty('--mo-d'); }, 1300);
    }
    var io = new IntersectionObserver(function (entries) {
      var k = 0;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.style.setProperty('--mo-d', Math.min(k++, 6) * 0.08 + 's');
        e.target.classList.add('mo-in');
        io.unobserve(e.target);
        countIn(e.target);
        done(e.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

    function take(el, fresh) {
      if (seen) { if (seen.has(el)) return; seen.add(el); }
      else { if (el.__mo) return; el.__mo = 1; }
      if (el.closest(MOTION_SKIP)) return;
      var r = el.getBoundingClientRect();
      if (!r.width && !r.height) { io.observe(el); el.classList.add('mo-reveal'); return; }
      if (r.top < window.innerHeight * 0.92 && !fresh) { countIn(el); return; }   /* already on screen */
      el.classList.add('mo-reveal');
      io.observe(el);
    }
    function scan(root, fresh) {
      if (!root.querySelectorAll) return;
      if (root.matches && root.matches(MOTION_CARDS)) take(root, fresh);
      root.querySelectorAll(MOTION_CARDS).forEach(function (el) { take(el, fresh); });
    }
    scan(document, false);

    /* blocks the page draws after loading (dataset cards, themes, charts) */
    var queued = [];
    new MutationObserver(function (list) {
      list.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) queued.push(n); }); });
      if (queued.length === 1) requestAnimationFrame(function () {
        var q = queued; queued = [];
        q.forEach(function (n) { if (n.isConnected) scan(n, true); });
      });
    }).observe(body, { childList: true, subtree: true });
  }

  /* a headline figure counts up from zero, keeping its words and unit;
     if the page rewrites the figure meanwhile, the count gives way */
  var NUM_RE = /^(\D{0,3}?)(\d[\d,]*(?:\.\d+)?)(.*)$/;
  function countIn(root) {
    var nodes = [];
    if (root.matches && root.matches(MOTION_NUMS)) nodes.push(root);
    if (root.querySelectorAll) root.querySelectorAll(MOTION_NUMS).forEach(function (n) { nodes.push(n); });
    nodes.forEach(function (n) {
      if (n.__counted || n.closest(MOTION_SKIP) || n.children.length) return;
      var text = (n.textContent || '').trim(), m = NUM_RE.exec(text);
      if (!m) return;
      n.__counted = 1;
      var raw = m[2], target = parseFloat(raw.replace(/,/g, '')), dec = (raw.split('.')[1] || '').length;
      if (!(target > 0)) return;
      var grouped = raw.indexOf(',') !== -1, t0 = performance.now(), dur = 1100, last = null;
      function fmt(v) {
        var s = v.toFixed(dec);
        if (grouped) s = Number(s).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
        return m[1] + s + m[3];
      }
      (function tick(now) {
        if (last !== null && n.textContent !== last) return;       /* the page changed it */
        var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        last = n.textContent = p < 1 ? fmt(target * e) : text;
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
      setTimeout(function () { if (n.textContent === last) n.textContent = text; }, dur + 500);
    });
  }

  /* ── 6. Flourish charts report the height they need; size each frame
     to it so axes and legends are never cut (not the state dossier,
     which scales its charts itself) ── */
  window.addEventListener('message', function (e) {
    if (!/flo\.uri\.sh|flourish\.studio/.test(e.origin || '')) return;
    var d = e.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (err) { return; } }
    var h = d && +(d.height || (d.args && d.args.height));
    if (!h || h < 150 || h > 2400) return;
    document.querySelectorAll('iframe').forEach(function (f) {
      if (f.contentWindow !== e.source || f.closest('.dz-scene')) return;
      f.style.setProperty('--flh', Math.ceil(h) + 'px');
      if (!f.closest('.dp-card')) f.style.setProperty('height', Math.ceil(h) + 'px', 'important');
    });
  });

  function init() {
    drawMarks();
    build();
    navMenus();
    guardFigures();
    revealBands();
    motion();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
