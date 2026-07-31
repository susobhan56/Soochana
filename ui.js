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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
