/**
 * chapter-index.js — the right-hand "on this page" rail
 *
 * Any element carrying data-index="Label" becomes a chapter, in document
 * order. The rail names the chapter under the reading line and the one
 * after it, fills a progress bar as the page is read, and opens for a few
 * seconds each time a new chapter arrives. On narrow screens it becomes a
 * pill in the bottom-left corner that opens the full list.
 *
 * Styles: style.css (.chapter-index). Pages restyle it through the --ci-*
 * custom properties (home_pm.css, about.html).
 */
(function () {
  'use strict';

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function slug(text) {
    return 'ch-' + text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function build() {
    var chapters = [].slice.call(document.querySelectorAll('[data-index]'))
      .filter(function (el) { return !el.closest('.chapter-index'); });
    if (chapters.length < 2) return;

    chapters.forEach(function (c) { if (!c.id) c.id = slug(c.getAttribute('data-index')); });
    var names = chapters.map(function (c) { return c.getAttribute('data-index'); });

    var nav = document.createElement('nav');
    nav.className = 'chapter-index';
    nav.setAttribute('aria-label', 'On this page');
    nav.innerHTML =
      '<button type="button" class="ci-toggle" aria-expanded="false">' +
        '<span class="ci-count"><b class="ci-now">01</b> / <span class="ci-total"></span></span>' +
        '<span class="ci-stack"><span class="ci-current"></span><span class="ci-upnext"></span></span>' +
        '<span class="ci-sr">Show all sections</span>' +
      '</button>' +
      '<ol class="ci-list"></ol>' +
      '<a class="ci-next" href="#">' +
        '<span class="ci-next-text"><span class="ci-next-k">Up next</span><b class="ci-next-name"></b></span>' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="M6 13l6 6 6-6"/></svg>' +
      '</a>';
    document.body.appendChild(nav);

    var $ = function (sel) { return nav.querySelector(sel); };
    var toggle = $('.ci-toggle'), list = $('.ci-list'), next = $('.ci-next');
    list.id = 'ciList';
    toggle.setAttribute('aria-controls', list.id);
    $('.ci-total').textContent = pad(chapters.length);

    list.innerHTML = chapters.map(function (c, i) {
      return '<li><a class="ci-link" href="#' + c.id + '">' +
        '<span class="ci-label">' + names[i] + '</span>' +
        '<span class="ci-num">' + pad(i + 1) + '</span>' +
        '<span class="ci-tick" aria-hidden="true"></span></a></li>';
    }).join('');
    var links = [].slice.call(list.querySelectorAll('.ci-link'));

    var current = -1, peekTimer = null;

    function setCurrent(i) {
      if (i === current) return;
      var first = current === -1;
      current = i;

      links.forEach(function (l, j) {
        l.classList.toggle('is-current', j === i);
        l.classList.toggle('is-past', j < i);
        if (j === i) l.setAttribute('aria-current', 'location');
        else l.removeAttribute('aria-current');
      });

      $('.ci-now').textContent = pad(i + 1);
      $('.ci-current').textContent = names[i];

      if (i < chapters.length - 1) {
        next.href = '#' + chapters[i + 1].id;
        $('.ci-next-k').textContent = 'Up next';
        $('.ci-next-name').textContent = names[i + 1];
        $('.ci-upnext').textContent = 'Next · ' + names[i + 1];
        next.classList.remove('is-end');
      } else {
        next.href = '#' + chapters[0].id;
        $('.ci-next-k').textContent = 'The end';
        $('.ci-next-name').textContent = 'Back to top';
        $('.ci-upnext').textContent = 'Last section';
        next.classList.add('is-end');
      }

      /* open the labels briefly, so each new chapter announces itself */
      if (!first) {
        nav.classList.add('is-peek');
        clearTimeout(peekTimer);
        peekTimer = setTimeout(function () { nav.classList.remove('is-peek'); }, 2600);
      }
    }

    function update() {
      /* The reading line sits a quarter of the way down. Lower, a short
         section jumped to from the rail (which lands at the top of the
         screen) would already have the next one across the line. */
      var line = window.innerHeight * 0.25;
      var idx = 0;
      chapters.forEach(function (c, i) { if (c.getBoundingClientRect().top <= line) idx = i; });
      var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      /* the last chapter may be short: once the page bottoms out, it has arrived */
      if (window.scrollY >= max - 4) idx = chapters.length - 1;
      setCurrent(idx);
      nav.style.setProperty('--ci-progress', Math.min(1, Math.max(0, window.scrollY / max)).toFixed(4));
    }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; update(); });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    function setOpen(open) {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    }
    toggle.addEventListener('click', function () { setOpen(!nav.classList.contains('is-open')); });
    list.addEventListener('click', function (e) { if (e.target.closest('.ci-link')) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    document.addEventListener('click', function (e) { if (!nav.contains(e.target)) setOpen(false); });

    update();
    requestAnimationFrame(function () { nav.classList.add('ready'); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
