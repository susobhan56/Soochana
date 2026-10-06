/**
 * ui.js
 * Shared chrome for every Soochana page:
 *   1. restores the reader's saved text size before first paint
 *   2. injects the A / A+ / A++ control into the header
 *   3. injects the grain overlay
 *   4. reveals editorial bands; 5. draws the animated Soochana mark
 *
 * Load this in <head> (not deferred) so step 1 runs before the body
 * paints — otherwise enlarged text visibly snaps into place on load.
 */
(function () {
  var KEY = 'soochana-text';
  var SIZES = ['normal', 'large', 'xlarge'];

  /* ── 1. restore, immediately ───────────────────────────── */
  var saved = 'normal';
  try {
    var v = localStorage.getItem(KEY);
    if (v && SIZES.indexOf(v) !== -1) saved = v;
  } catch (e) { /* private mode — fall back to normal */ }
  if (saved !== 'normal') document.documentElement.setAttribute('data-text', saved);

  function apply(size) {
    var root = document.documentElement;
    /* Suppress transitions for this frame, or every `transition: all` component
       animates its font-size and the page appears to slide rather than snap. */
    root.classList.add('type-switching');

    if (size === 'normal') root.removeAttribute('data-text');
    else root.setAttribute('data-text', size);
    try { localStorage.setItem(KEY, size); } catch (e) {}
    document.querySelectorAll('.type-ctl button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.size === size));
    });

    void root.offsetWidth;                    /* flush the restyle */
    requestAnimationFrame(function () {
      root.classList.remove('type-switching');
    });
  }

  /* ── 2 + 3. build the chrome once the DOM exists ────────── */
  function build() {
    /* grain overlay */
    if (!document.querySelector('.grain')) {
      var g = document.createElement('div');
      g.className = 'grain';
      g.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(g, document.body.firstChild);
    }

    /* text-size control — into the header's last nav-group */
    var header = document.querySelector('header');
    if (!header || header.querySelector('.type-ctl')) return;
    var groups = header.querySelectorAll('.nav-group');
    var host = groups.length ? groups[groups.length - 1] : header;

    var ctl = document.createElement('div');
    ctl.className = 'type-ctl';
    ctl.setAttribute('role', 'group');
    ctl.setAttribute('aria-label', 'Text size');
    ctl.innerHTML =
      '<button type="button" data-size="normal" aria-pressed="false" title="Normal text size">A</button>' +
      '<button type="button" data-size="large"  aria-pressed="false" title="Larger text">A</button>' +
      '<button type="button" data-size="xlarge" aria-pressed="false" title="Largest text">A</button>';
    host.appendChild(ctl);

    ctl.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-size]');
      if (btn) apply(btn.dataset.size);
    });

    apply(saved);
  }

  /* ── 4. editorial bands and the gallery reveal on scroll ── */
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

  /* ── editorial artwork loader ──
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

  /* ── 5. the Soochana mark ──
     Soochana means "information". The mark draws that in one breath: a
     speech bubble (the narrative) holds three rising bars (the numbers);
     a thread links their tops through small nodes (the intelligence that
     connects them) and lands on the orange dot, the insight. It builds
     once on load, then a spark runs the thread into the dot on a slow loop.
     Pages carry only <span class="soo-mark">; the drawing lives here so
     there is one copy of it. Without JS, style.css shows the plain dot. */
  var THREAD = 'M8 25C10.5 23.5 11.5 21 13.75 21S19.5 17 22.25 17S28 13 30.75 13S33.6 12 35.5 12';
  var MARK =
    '<svg class="soo-svg" viewBox="0 0 48 48" focusable="false" aria-hidden="true">' +
      '<path class="soo-frame" pathLength="100" d="M14 5H34A10 10 0 0 1 44 15V27A10 10 0 0 1 34 37H21L12 44L14 37A10 10 0 0 1 4 27V15A10 10 0 0 1 14 5Z"/>' +
      '<rect class="soo-bar soo-b1" x="11" y="25" width="5.5" height="7" rx="1.6"/>' +
      '<rect class="soo-bar soo-b2" x="19.5" y="21" width="5.5" height="11" rx="1.6"/>' +
      '<rect class="soo-bar soo-b3" x="28" y="17" width="5.5" height="15" rx="1.6"/>' +
      '<path class="soo-thread" pathLength="100" d="' + THREAD + '"/>' +
      '<path class="soo-spark" pathLength="100" d="' + THREAD + '"/>' +
      '<circle class="soo-node soo-n1" cx="13.75" cy="21" r="1.6"/>' +
      '<circle class="soo-node soo-n2" cx="22.25" cy="17" r="1.6"/>' +
      '<circle class="soo-node soo-n3" cx="30.75" cy="13" r="1.6"/>' +
      '<circle class="soo-ripple" cx="35.5" cy="12" r="3.2"/>' +
      '<circle class="soo-dot" cx="35.5" cy="12" r="3.3"/>' +
    '</svg>';

  function play(mark) {
    mark.classList.remove('soo-play');
    void mark.offsetWidth;                    /* restart the keyframes */
    mark.classList.add('soo-play');
  }

  function drawMarks() {
    document.querySelectorAll('.soo-mark').forEach(function (mark) {
      if (!mark.firstChild) mark.innerHTML = MARK;
      play(mark);

      var link = mark.closest('a');
      if (!link || link.classList.contains('soo-brand')) return;
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
