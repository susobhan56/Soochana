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

  function init() {
    drawMarks();
    build();
    guardFigures();
    revealBands();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
