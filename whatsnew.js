/**
 * whatsnew.js
 * "What's new" for every Soochana page:
 *   1. builds the feed: data/updates.js (hand-written: features, pages,
 *      lessons) plus any report, dataset or theme article whose "added" or
 *      "lastUpdated" date is recent (read from the registries in data/)
 *   2. a bell in the header with an unread count, opening the feed
 *   3. once per visit, a small pop-up for the newest unread item
 *   4. a dot on the header link whose section has something unread
 *   5. SoochanaNews.ribbon(item) — the "New" / "Updated" ribbon that the
 *      repository, theme and article cards put on recent items
 *
 * "Unread" is kept per reader in localStorage, by item id. Opening the feed
 * marks everything in it read; visiting an item's own page marks that item.
 */
(function () {
  if (window.SoochanaNews) return;

  var SELF = (document.currentScript && document.currentScript.src) || location.href;
  var ROOT = new URL('.', SELF).href;
  var NEW_DAYS = 30;
  var MAX_ITEMS = 15;
  var SEEN_KEY = 'soochana-seen-updates';
  var TOAST_KEY = 'soochana-news-toast';
  var DAY = 86400000;

  var TYPES = {
    feature: 'Feature', report: 'Report', dataset: 'Dataset',
    article: 'Article', learn: 'Learn', data: 'Data'
  };

  /* ── dates ─────────────────────────────────────────────── */
  function parse(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function ageDays(d) {
    var t = parse(d);
    if (!t) return Infinity;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((today - t) / DAY);
  }
  function isRecent(d) {
    var a = ageDays(d);
    return a >= -1 && a < NEW_DAYS;
  }
  function when(d) {
    var a = ageDays(d);
    if (a <= 0) return 'Today';
    if (a === 1) return 'Yesterday';
    if (a < 7) return a + ' days ago';
    var t = parse(d);
    return t ? t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  }

  /* ── read / unread ─────────────────────────────────────── */
  var seen = {};
  try {
    (JSON.parse(localStorage.getItem(SEEN_KEY)) || []).forEach(function (id) { seen[id] = 1; });
  } catch (e) { /* storage blocked: everything recent reads as unread */ }

  function saveSeen() {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(Object.keys(seen).slice(-300))); } catch (e) {}
  }

  /* ── the registries' own items ─────────────────────────── */
  /* An item is New while its "added" date is recent, and Updated while only
     its "lastUpdated" is. Older items do not appear. */
  function stamp(item) {
    if (item.added && isRecent(item.added)) return { date: item.added, status: 'New' };
    if (item.lastUpdated && isRecent(item.lastUpdated)) return { date: item.lastUpdated, status: 'Updated' };
    return null;
  }

  function ribbon(item) {
    var s = item && stamp(item);
    if (!s) return '';
    return '<span class="wn-ribbon' + (s.status === 'Updated' ? ' wn-ribbon-upd' : '') + '">' + s.status + '</span>';
  }

  function getJSON(path) {
    return fetch(ROOT + path, { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; });
  }

  function fromRegistries() {
    return Promise.all([
      getJSON('data/reports.json'),
      getJSON('data/datasets.json'),
      getJSON('data/contents.json')
    ]).then(function (res) {
      var out = [];
      function add(list, type, map) {
        (list || []).forEach(function (it) {
          var s = stamp(it);
          if (!s) return;
          var entry = map(it);
          entry.id = type + ':' + it.id;
          entry.type = type;
          entry.date = s.date;
          entry.status = s.status;
          out.push(entry);
        });
      }
      add(res[0].reports, 'report', function (r) {
        return { title: r.name, text: r.description, href: 'repository.html', section: 'repository.html', theme: r.theme };
      });
      add(res[1].datasets, 'dataset', function (d) {
        return { title: d.name, text: d.description, href: 'repository.html', section: 'repository.html' };
      });
      add(res[2].recentContent, 'article', function (a) {
        return { title: a.title, text: a.abstract, href: 'article.html?id=' + encodeURIComponent(a.id), section: 'themes.html', theme: a.theme };
      });
      return out;
    });
  }

  /* data/updates.js is a script, so it is editable with comments. The date
     stamp refreshes it daily at most, whatever the server's caching. */
  function fromUpdatesFile() {
    return new Promise(function (resolve) {
      if (window.SOOCHANA_UPDATES) { resolve(window.SOOCHANA_UPDATES); return; }
      var s = document.createElement('script');
      var d = new Date();
      s.src = ROOT + 'data/updates.js?d=' + (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate());
      s.onload = function () { resolve(window.SOOCHANA_UPDATES || []); };
      s.onerror = function () { resolve([]); };
      document.head.appendChild(s);
    });
  }

  var ready = Promise.all([fromUpdatesFile(), fromRegistries()]).then(function (parts) {
    var byId = {};
    var feed = [];
    parts[0].concat(parts[1]).forEach(function (it, i) {
      if (!it || !it.id || byId[it.id] || !parse(it.date)) return;
      byId[it.id] = 1;
      feed.push({
        id: it.id,
        date: it.date,
        type: TYPES[it.type] ? it.type : 'feature',
        title: it.title || '',
        text: it.text || '',
        href: it.href || '',
        action: it.action || '',
        section: it.section || '',
        theme: it.theme || '',
        status: it.status || 'New',
        order: i
      });
    });
    feed.sort(function (a, b) { return parse(b.date) - parse(a.date) || a.order - b.order; });
    return feed.slice(0, MAX_ITEMS);
  });

  /* ── helpers ───────────────────────────────────────────── */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function abs(href) { return new URL(href || 'index.html', ROOT); }
  function samePage(href, url) {
    var a = abs(href), b = url || location;
    return a.pathname.replace(/\/$/, '/index.html') === b.pathname.replace(/\/$/, '/index.html');
  }
  function unread(item) { return isRecent(item.date) && !seen[item.id]; }

  function screenClear() {
    var intro = document.querySelector('.intro');
    return !intro || intro.classList.contains('done') || getComputedStyle(intro).display === 'none';
  }

  function follow(item) {
    seen[item.id] = 1;
    saveSeen();
    if (item.action === 'chat' && window.SoochanaAssistant) {
      close();
      hideToast();
      window.SoochanaAssistant.open();
      return true;
    }
    return false;
  }

  var BELL = '<svg class="wn-bell-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg>';

  /* ── 2. bell and panel ─────────────────────────────────── */
  var feed = [];
  var bell, count, panel, list, lastFocus;

  function buildBell() {
    var header = document.querySelector('header');
    if (!header || header.querySelector('.wn-bell')) return false;
    var groups = header.querySelectorAll('.nav-group');
    var host = groups.length ? groups[groups.length - 1] : header;

    bell = document.createElement('button');
    bell.type = 'button';
    bell.className = 'wn-bell';
    bell.setAttribute('aria-haspopup', 'dialog');
    bell.setAttribute('aria-expanded', 'false');
    bell.setAttribute('aria-controls', 'wnPanel');
    bell.title = "What's new";
    bell.innerHTML = BELL + '<span class="wn-count" aria-hidden="true"></span>';
    count = bell.querySelector('.wn-count');
    host.appendChild(bell);

    /* The panel hangs off <body>: on phones the header's link row scrolls
       sideways and would clip anything positioned inside it. */
    panel = document.createElement('div');
    panel.id = 'wnPanel';
    panel.className = 'wn-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', "What's new on Soochana");
    panel.hidden = true;
    panel.innerHTML =
      '<div class="wn-head"><div><div class="wn-kicker">Soochana</div><h2 class="wn-title">What’s new</h2></div>' +
      '<button type="button" class="wn-x" aria-label="Close">×</button></div>' +
      '<ul class="wn-list"></ul>' +
      '<div class="wn-foot">New features, reports, datasets and articles appear here as they are added.</div>';
    list = panel.querySelector('.wn-list');
    document.body.appendChild(panel);

    bell.addEventListener('click', function () { panel.hidden ? open() : close(); });
    panel.querySelector('.wn-x').addEventListener('click', function () { close(); });
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(true); });
    list.addEventListener('click', function (e) {
      var a = e.target.closest('[data-wn]');
      if (!a) return;
      var item = feed.filter(function (f) { return f.id === a.getAttribute('data-wn'); })[0];
      if (item && follow(item)) e.preventDefault();
      else if (item && samePage(item.href)) close();
    });
    document.addEventListener('pointerdown', function (e) {
      if (!panel.hidden && !panel.contains(e.target) && !bell.contains(e.target)) close();
    });
    window.addEventListener('resize', function () { if (!panel.hidden) place(); });
    /* the header scrolls away with the page; the panel goes with it */
    window.addEventListener('scroll', function () {
      if (panel.hidden) return;
      if (bell.getBoundingClientRect().bottom < 0) close(); else place();
    }, { passive: true });
    return true;
  }

  function place() {
    var r = bell.getBoundingClientRect();
    var w = Math.min(380, window.innerWidth - 24);
    var left = Math.max(12, Math.min(r.right - w, window.innerWidth - w - 12));
    panel.style.width = w + 'px';
    panel.style.left = left + 'px';
    panel.style.top = Math.max(12, r.bottom + 10) + 'px';
  }

  function renderList() {
    if (!feed.length) {
      list.innerHTML = '<li class="wn-empty">Nothing new just yet. Check back soon.</li>';
      return;
    }
    list.innerHTML = feed.map(function (it) {
      var fresh = isRecent(it.date);
      var un = unread(it);
      var tag = it.action === 'chat' ? 'button type="button"' : 'a href="' + esc(abs(it.href).href) + '"';
      var end = it.action === 'chat' ? 'button' : 'a';
      return '<li>' +
        '<' + tag + ' class="wn-item' + (un ? ' wn-unread' : '') + '" data-wn="' + esc(it.id) + '">' +
          '<span class="wn-meta">' +
            '<span class="wn-type wn-t-' + it.type + '">' + TYPES[it.type] + '</span>' +
            (fresh ? '<span class="wn-state">' + esc(it.status) + '</span>' : '') +
            '<span class="wn-date">' + esc(when(it.date)) + '</span>' +
            (un ? '<span class="wn-udot" aria-label="unread"></span>' : '') +
          '</span>' +
          '<span class="wn-item-title">' + esc(it.title) + '</span>' +
          (it.text ? '<span class="wn-item-text">' + esc(it.text) + '</span>' : '') +
        '</' + end + '>' +
      '</li>';
    }).join('');
  }

  function open() {
    lastFocus = document.activeElement;
    hideToast();
    renderList();                      /* unread marks show for this viewing */
    panel.hidden = false;
    place();
    bell.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(function () { panel.classList.add('in'); });
    var first = list.querySelector('.wn-item');
    if (first) first.focus({ preventScroll: true });
    feed.forEach(function (it) { seen[it.id] = 1; });
    saveSeen();
    refresh();
  }

  function close(restore) {
    if (!panel || panel.hidden) return;
    panel.classList.remove('in');
    panel.hidden = true;
    bell.setAttribute('aria-expanded', 'false');
    if (restore && lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ── 4. badge and header-link dots ─────────────────────── */
  function refresh() {
    var n = feed.filter(unread).length;
    if (bell) {
      count.textContent = n > 9 ? '9+' : String(n);
      bell.classList.toggle('wn-has', n > 0);
      bell.setAttribute('aria-label', n ? "What's new, " + n + ' unread' : "What's new");
    }

    document.querySelectorAll('header a[href]').forEach(function (link) {
      if (link.classList.contains('soo-brand') || link.classList.contains('brand-partner')) return;
      var url = new URL(link.getAttribute('href'), location.href);
      var hit = feed.some(function (it) {
        if (!unread(it)) return false;
        var target = it.section ? abs(it.section) : abs(it.href);
        return target.pathname === url.pathname;
      });
      var dot = link.querySelector('.wn-navdot');
      if (hit && !dot) {
        dot = document.createElement('span');
        dot.className = 'wn-navdot';
        dot.title = 'Something new here';
        link.appendChild(dot);
      } else if (!hit && dot) {
        dot.remove();
      }
    });
  }

  /* ── 3. the pop-up ─────────────────────────────────────── */
  var toast, toastTimer;

  function showToast(item) {
    toast = document.createElement('div');
    toast.className = 'wn-toast';
    toast.setAttribute('role', 'status');
    var more = feed.filter(unread).length - 1;
    toast.innerHTML =
      '<div class="wn-toast-k"><span class="wn-pulse" aria-hidden="true"></span>New on Soochana' +
        '<span class="wn-type wn-t-' + item.type + '">' + TYPES[item.type] + '</span></div>' +
      '<div class="wn-toast-t">' + esc(item.title) + '</div>' +
      (item.text ? '<div class="wn-toast-p">' + esc(item.text) + '</div>' : '') +
      '<div class="wn-toast-row">' +
        (item.action === 'chat'
          ? '<button type="button" class="wn-go">Try it</button>'
          : '<a class="wn-go" href="' + esc(abs(item.href).href) + '">Take a look</a>') +
        (bell ? '<button type="button" class="wn-all">' + (more > 0 ? 'See ' + more + ' more' : "All updates") + '</button>' : '') +
      '</div>' +
      '<button type="button" class="wn-x wn-toast-x" aria-label="Dismiss">×</button>';
    document.body.appendChild(toast);

    toast.querySelector('.wn-go').addEventListener('click', function (e) {
      if (follow(item)) e.preventDefault();
    });
    var all = toast.querySelector('.wn-all');
    if (all) all.addEventListener('click', function () { open(); });
    toast.querySelector('.wn-toast-x').addEventListener('click', hideToast);

    /* stays while the reader is looking at it */
    function arm() { clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, 11000); }
    toast.addEventListener('pointerenter', function () { clearTimeout(toastTimer); });
    toast.addEventListener('pointerleave', arm);
    toast.addEventListener('focusin', function () { clearTimeout(toastTimer); });
    requestAnimationFrame(function () { requestAnimationFrame(function () { toast.classList.add('in'); }); });
    arm();
  }

  function hideToast() {
    if (!toast) return;
    clearTimeout(toastTimer);
    var t = toast;
    toast = null;
    t.classList.remove('in');
    setTimeout(function () { t.remove(); }, 400);
  }

  function maybeToast() {
    var first = feed.filter(unread)[0];
    if (!first) return;
    try {
      if (sessionStorage.getItem(TOAST_KEY)) return;
      sessionStorage.setItem(TOAST_KEY, '1');
    } catch (e) { return; }
    var tries = 0;
    (function wait() {
      if (screenClear() && !document.hidden) { showToast(first); return; }
      if (++tries < 90) setTimeout(wait, 1000);
    })();
  }

  /* ── start ─────────────────────────────────────────────── */
  function start() {
    buildBell();
    ready.then(function (f) {
      feed = f;
      /* reading an item's own page counts as seeing it */
      feed.forEach(function (it) {
        var u = abs(it.href);
        if (it.href && !it.action && samePage(it.href) && u.search === location.search && (!u.hash || u.hash === location.hash)) {
          seen[it.id] = 1;
        }
      });
      saveSeen();
      refresh();
      if (bell && bell.classList.contains('wn-has')) bell.classList.add('wn-ring');
      setTimeout(maybeToast, 2200);
    });
  }

  window.SoochanaNews = { ready: ready, ribbon: ribbon, isRecent: isRecent };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
