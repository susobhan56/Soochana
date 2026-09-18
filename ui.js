/**
 * ui.js
 * Shared chrome for every Soochana page:
 *   1. restores the reader's saved text size before first paint
 *   2. injects the A / A+ / A++ control into the header
 *   3. injects the grain overlay
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

  function init() {
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
