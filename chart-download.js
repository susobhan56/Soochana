/**
 * chart-download.js — "Download PNG" for the charts Soochana draws itself,
 * and "Open in Flourish" for the ones embedded from Flourish.
 *
 * Soochana charts (D3/SVG). Mark the element the chart is drawn into:
 *   data-download                 turns the button on
 *   data-download-title="…"       literal title, or CSS selectors (starting
 *                                 with # or .; several joined by commas) read
 *                                 when the button is pressed, so a title that
 *                                 changes with the chart is right
 *   data-download-slot="sel"      put the button in that element instead of a
 *                                 bar just after the chart
 *   data-download-place="overlay" with a slot: pin it to the slot's top-right
 * The element may be the <svg> itself or hold one. Nothing is added inside it,
 * so charts that clear and redraw their container keep the button.
 *
 * The saved image is the chart as it looks on screen, not the bare SVG: the
 * site's stylesheet (colours set as var(--teal), fonts, classes) does not
 * travel with an SVG, so every computed style is written inline first, the
 * web fonts in use are embedded, and shared <use> icons are copied in. It is
 * drawn at twice its size, with the title above and a source line below.
 *
 * Flourish charts are iframes from flo.uri.sh. A page cannot read another
 * site's frame, so these get "Download image", which saves the image
 * Flourish publishes for each public chart (its first view), and a link to
 * the chart's public Flourish page. They are found on their own: lazy
 * wrappers carrying data-embed-url, and any flo.uri.sh iframe, including
 * ones added later.
 */
(function (root) {
  'use strict';

  var doc = root.document;
  var SCALE = 2;
  var PAD = 24;

  /* ── styles, carried here so pages without style.css get them too ── */
  var CSS =
    '.dl-bar{display:flex;justify-content:flex-end;gap:8px;margin:8px 0 0}' +
    '.dl-slot-btns{display:inline-flex;gap:8px;margin-left:auto}' +
    '.dl-overlay{position:absolute;top:10px;right:12px;z-index:5}' +
    '.dl-btn{display:inline-flex;align-items:center;gap:6px;padding:5px 12px 4px;border-radius:999px;' +
      'border:1px solid rgba(0,0,0,.18);background:rgba(255,255,255,.9);color:#1e2530;cursor:pointer;' +
      'font:600 12px/1.2 var(--font-sans,system-ui,sans-serif);letter-spacing:.02em;text-decoration:none;' +
      'white-space:nowrap;transition:background .2s ease,border-color .2s ease,transform .2s ease}' +
    '.dl-btn:hover{border-color:#0879ad;background:#fff;transform:translateY(-1px)}' +
    '.dl-btn:focus-visible{outline:2px solid #0879ad;outline-offset:2px}' +
    '.dl-btn[disabled]{opacity:.6;cursor:progress;transform:none}' +
    '.dl-btn svg{width:13px;height:13px;flex:none}' +
    '.dl-btn svg path{fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;filter:none}' +
    '.dl-dark .dl-btn{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.4);color:#fff}' +
    '.dl-dark .dl-btn:hover{background:rgba(255,255,255,.16);border-color:#fff}' +
    '.dl-dark .dl-btn:focus-visible{outline-color:#fff}' +
    '@media print{.dl-bar,.dl-slot-btns,.dl-overlay{display:none}}';

  var ICON_DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/></svg>';
  var ICON_OUT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';

  function injectCSS() {
    if (doc.getElementById('dl-css')) return;
    var s = doc.createElement('style');
    s.id = 'dl-css';
    s.textContent = CSS;
    doc.head.appendChild(s);
  }

  /* ── colour helpers ─────────────────────────────────────── */
  function parseRGB(c) {
    var m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/.exec(c || '');
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  }

  /* the colour actually behind an element: the nearest ancestor that paints one */
  function backdrop(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var c = parseRGB(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.5) return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
    }
    return '#ffffff';
  }

  function isDark(colour) {
    var c = parseRGB(colour);
    if (!c) return false;
    return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255 < 0.5;
  }

  /* ── building the image ─────────────────────────────────── */
  var PROPS = ['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity',
    'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'opacity',
    'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-transform',
    'text-anchor', 'dominant-baseline', 'alignment-baseline', 'paint-order', 'visibility',
    'display', 'text-decoration', 'mix-blend-mode', 'vector-effect', 'filter'];

  /* write each element's computed style onto its copy, walking both trees in step */
  function inlineStyles(src, dst) {
    if (src.nodeType !== 1) return;
    var cs = getComputedStyle(src);
    var out = '';
    for (var i = 0; i < PROPS.length; i++) {
      var v = cs.getPropertyValue(PROPS[i]);
      if (v !== '' && v !== 'normal' || PROPS[i] === 'font-weight') out += PROPS[i] + ':' + v + ';';
    }
    /* a CSS transform (not a transform attribute) only survives inline */
    if (cs.transform && cs.transform !== 'none' && !src.hasAttribute('transform')) {
      out += 'transform:' + cs.transform + ';transform-origin:' + cs.transformOrigin + ';';
    }
    dst.setAttribute('style', out);
    var a = src.children, b = dst.children;
    for (var k = 0; k < a.length && k < b.length; k++) inlineStyles(a[k], b[k]);
  }

  /* icons drawn with <use href="#id"> point into a sprite elsewhere on the page */
  function copyUsedSymbols(clone) {
    var ids = {};
    clone.querySelectorAll('use').forEach(function (u) {
      var h = u.getAttribute('href') || u.getAttribute('xlink:href') || '';
      if (h.charAt(0) === '#') ids[h.slice(1)] = true;
    });
    var names = Object.keys(ids);
    if (!names.length) return;
    var defs = doc.createElementNS('http://www.w3.org/2000/svg', 'defs');
    names.forEach(function (id) {
      if (clone.querySelector('[id="' + id + '"]')) return;
      var src = doc.getElementById(id);
      if (!src) return;
      var copy = src.cloneNode(true);
      inlineStyles(src, copy);
      defs.appendChild(copy);
    });
    clone.insertBefore(defs, clone.firstChild);
  }

  /* web fonts: an SVG drawn as an image cannot load them, so they go in as data */
  var fontData = {};
  function toDataURL(url) {
    if (!fontData[url]) {
      fontData[url] = fetch(url).then(function (r) { return r.blob(); }).then(function (b) {
        return new Promise(function (res) {
          var fr = new FileReader();
          fr.onload = function () { res(fr.result); };
          fr.readAsDataURL(b);
        });
      });
    }
    return fontData[url];
  }

  var cssText = {};
  function fontFaces(families) {
    var want = families.map(function (f) { return f.toLowerCase(); });
    var links = [].slice.call(doc.querySelectorAll('link[rel="stylesheet"]')).filter(function (l) {
      return /fonts\.googleapis\.com|fontshare\.com/.test(l.href);
    });
    return Promise.all(links.map(function (l) {
      if (!cssText[l.href]) cssText[l.href] = fetch(l.href).then(function (r) { return r.text(); }).catch(function () { return ''; });
      return cssText[l.href];
    })).then(function (sheets) {
      var blocks = [];
      sheets.join('\n').replace(/@font-face\s*\{[^}]*\}/g, function (b) {
        var fam = /font-family:\s*['"]?([^;'"]+)/.exec(b);
        if (!fam || want.indexOf(fam[1].trim().toLowerCase()) === -1) return b;
        /* the Latin subset only: the others are for scripts these charts don't use */
        var range = /unicode-range:\s*([^;]+)/.exec(b);
        if (range && !/U\+0000-00FF/i.test(range[1])) return b;
        blocks.push(b);
        return b;
      });
      return Promise.all(blocks.map(function (b) {
        var u = /url\((['"]?)([^)'"]+)\1\)/.exec(b);
        if (!u) return '';
        return toDataURL(u[2]).then(function (data) {
          return b.replace(u[0], 'url("' + data + '")');
        }).catch(function () { return ''; });
      }));
    }).then(function (faces) { return faces.join('\n'); });
  }

  function withTimeout(p, ms, fallback) {
    return Promise.race([p, new Promise(function (res) { setTimeout(function () { res(fallback); }, ms); })]);
  }

  function svgFor(el) {
    if (el.tagName && el.tagName.toLowerCase() === 'svg') return el;
    return el.querySelector('svg');
  }

  /* a literal title, or selectors read when pressed; several selectors
     ("#dist-title, #hud-title") are joined, e.g. place · metric */
  function titleFor(el) {
    var t = el.getAttribute('data-download-title') || '';
    if (/^[#.]/.test(t)) {
      t = t.split(',').map(function (sel) {
        var n = doc.querySelector(sel.trim());
        return n ? n.textContent.replace(/\s+/g, ' ').trim() : '';
      }).filter(Boolean).join(' · ');
    }
    t = t.replace(/\s+/g, ' ').trim();
    return t || doc.title.split('·')[0].trim();
  }

  function slug(t) {
    return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'chart';
  }

  function wrapLines(ctx, text, maxW, maxLines) {
    var words = text.split(' '), lines = [], line = '';
    words.forEach(function (w) {
      var test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
      else line = test;
    });
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
    }
    return lines;
  }

  function render(el) {
    var svg = svgFor(el);
    if (!svg) return Promise.reject(new Error('no chart'));
    var box = svg.getBoundingClientRect();
    var w = Math.round(box.width), h = Math.round(box.height);
    if (!w || !h) return Promise.reject(new Error('chart not visible'));

    var clone = svg.cloneNode(true);
    inlineStyles(svg, clone);
    copyUsedSymbols(clone);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    clone.setAttribute('width', w);
    clone.setAttribute('height', h);
    if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    /* the root keeps its drawing styles but not layout ones (margins, max-width) */
    clone.style.removeProperty('display');
    clone.style.removeProperty('transform');

    var families = {};
    [svg].concat([].slice.call(svg.querySelectorAll('text, tspan'))).forEach(function (t) {
      var f = getComputedStyle(t).fontFamily.split(',')[0].replace(/["']/g, '').trim();
      if (f) families[f] = true;
    });

    var bg = backdrop(svg);
    var title = titleFor(el);

    return withTimeout(fontFaces(Object.keys(families)), 5000, '').then(function (faces) {
      if (faces) {
        var style = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.textContent = faces;
        clone.insertBefore(style, clone.firstChild);
      }
      var xml = new XMLSerializer().serializeToString(clone);
      var src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);

      return new Promise(function (res, rej) {
        var img = new Image();
        img.onload = function () { res(img); };
        img.onerror = function () { rej(new Error('image failed')); };
        img.src = src;
      });
    }).then(function (img) {
      return compose(img, w, h, title, bg, SCALE, 'Source: Soochana · Odisha demographic portal');
    });
  }

  /* every download shares one layout: title above, the picture, then the
     source and the date below */
  function compose(img, w, h, title, bg, scale, source) {
    var dark = isDark(bg);
    var ink = dark ? '#ffffff' : '#1e2530';
    var faint = dark ? 'rgba(255,255,255,0.72)' : '#5b6472';
    var uiFont = getComputedStyle(doc.body).fontFamily || 'system-ui, sans-serif';

    var probe = doc.createElement('canvas').getContext('2d');
    probe.font = '600 20px ' + uiFont;
    var lines = wrapLines(probe, title, w, 2);
    var titleH = lines.length * 26 + 12;
    var footH = 34;
    var cw = w + PAD * 2, ch = PAD + titleH + h + footH;

    var c = doc.createElement('canvas');
    c.width = cw * scale;
    c.height = ch * scale;
    var ctx = c.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);

    ctx.fillStyle = ink;
    ctx.font = '600 20px ' + uiFont;
    ctx.textBaseline = 'top';
    lines.forEach(function (l, i) { ctx.fillText(l, PAD, PAD + i * 26); });

    ctx.drawImage(img, PAD, PAD + titleH, w, h);

    ctx.font = '500 12px ' + uiFont;
    ctx.fillStyle = faint;
    ctx.textBaseline = 'alphabetic';
    var y = PAD + titleH + h + 24;
    ctx.fillText(source, PAD, y);
    var date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    ctx.textAlign = 'right';
    ctx.fillText(date, cw - PAD, y);

    return new Promise(function (res, rej) {
      c.toBlob(function (blob) { blob ? res({ blob: blob, name: 'soochana-' + slug(title) + '.png' }) : rej(new Error('export failed')); }, 'image/png');
    });
  }

  /* Flourish charts: their frame cannot be read, but Flourish publishes an
     image of every public chart at /visualisation/<id>/thumbnail and serves
     it to other sites, so it can be fetched and saved here. It shows the
     chart as published (its first view), at about 1020px wide. */
  function flourishImage(url) {
    var m = /flo\.uri\.sh\/(visualisation|story)\/(\d+)/.exec(url || '');
    return m ? 'https://public.flourish.studio/' + m[1] + '/' + m[2] + '/thumbnail' : null;
  }

  function nearbyTitle(box) {
    for (var n = box.parentElement, k = 0; n && k < 4; n = n.parentElement, k++) {
      var heads = [].slice.call(n.querySelectorAll('h2, h3')).filter(function (hd) {
        return hd.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING;
      });
      if (heads.length) return heads[heads.length - 1].textContent.replace(/\s+/g, ' ').trim();
    }
    var art = doc.getElementById('artTitle');
    return (art && art.textContent.trim()) || doc.title.split('·')[0].trim();
  }

  function renderFlourish(box, url) {
    var src = flourishImage(url);
    if (!src) return Promise.reject(new Error('not a Flourish chart'));
    return fetch(src, { mode: 'cors' }).then(function (r) {
      if (!r.ok) throw new Error('no published image');
      return r.blob();
    }).then(function (blob) {
      return new Promise(function (res, rej) {
        var img = new Image();
        img.onload = function () { res(img); };
        img.onerror = function () { rej(new Error('image failed')); };
        img.src = URL.createObjectURL(blob);
      });
    }).then(function (img) {
      return compose(img, img.naturalWidth, img.naturalHeight, nearbyTitle(box), '#ffffff', 1,
        'Source: Soochana · chart made with Flourish');
    });
  }

  function save(file) {
    var url = URL.createObjectURL(file.blob);
    var a = doc.createElement('a');
    a.href = url;
    a.download = file.name;
    doc.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  /* ── buttons ────────────────────────────────────────────── */
  function makeButton(text, nameFn, make) {
    var b = doc.createElement('button');
    b.type = 'button';
    b.className = 'dl-btn';
    b.innerHTML = ICON_DOWN + '<span>' + text + '</span>';
    function label() { b.setAttribute('aria-label', 'Download “' + nameFn() + '” as a PNG image'); }
    b.addEventListener('mouseenter', label);
    b.addEventListener('focus', label);
    b.addEventListener('click', function () {
      if (b.disabled) return;
      var span = b.querySelector('span');
      b.disabled = true;
      span.textContent = 'Preparing…';
      make().then(function (file) {
        save(file);
        span.textContent = text;
      }).catch(function () {
        span.textContent = 'Could not create image';
        setTimeout(function () { span.textContent = text; }, 2600);
      }).then(function () { b.disabled = false; });
    });
    return b;
  }

  function flourishPage(url) {
    var m = /flo\.uri\.sh\/(visualisation|story)\/(\d+)/.exec(url || '');
    return m ? 'https://public.flourish.studio/' + m[1] + '/' + m[2] + '/' : null;
  }

  function makeLink(href) {
    var a = doc.createElement('a');
    a.className = 'dl-btn';
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.innerHTML = '<span>Open in Flourish</span>' + ICON_OUT;
    a.setAttribute('aria-label', 'Open this chart on Flourish (opens in a new tab)');
    return a;
  }

  function barAfter(el, btn, more) {
    var bar = doc.createElement('div');
    bar.className = 'dl-bar';
    bar.appendChild(btn);
    if (more) bar.appendChild(more);
    el.parentNode.insertBefore(bar, el.nextSibling);
    if (isDark(backdrop(bar))) bar.classList.add('dl-dark');
  }

  function attachChart(el) {
    el.setAttribute('data-dl-done', '');
    var btn = makeButton('Download PNG', function () { return titleFor(el); }, function () { return render(el); });
    var slotSel = el.getAttribute('data-download-slot');
    var slot = slotSel ? doc.querySelector(slotSel) : null;
    if (!slot) { barAfter(el, btn); return; }
    var wrap = doc.createElement('div');
    if (el.getAttribute('data-download-place') === 'overlay') {
      if (getComputedStyle(slot).position === 'static') slot.style.position = 'relative';
      wrap.className = 'dl-overlay';
    } else {
      wrap.className = 'dl-slot-btns';
    }
    wrap.appendChild(btn);
    slot.appendChild(wrap);
    if (isDark(backdrop(wrap))) wrap.classList.add('dl-dark');
  }

  function attachFlourish(frameOrWrapper) {
    var box = frameOrWrapper;
    if (box.tagName === 'IFRAME') {
      box = box.closest('.lazy-chart-wrapper, .flourish-figure') || box.parentElement || box;
    }
    if (box.hasAttribute('data-dl-done')) return;
    var url = box.getAttribute('data-embed-url') ||
      (box.tagName === 'IFRAME' ? box.src : (box.querySelector('iframe') || {}).src);
    var href = flourishPage(url);
    box.setAttribute('data-dl-done', '');
    if (!href) return;
    var dl = makeButton('Download image', function () { return nearbyTitle(box); }, function () { return renderFlourish(box, url); });
    barAfter(box, dl, makeLink(href));
  }

  function scan() {
    doc.querySelectorAll('[data-download]:not([data-dl-done])').forEach(attachChart);
    doc.querySelectorAll('.lazy-chart-wrapper[data-embed-url*="flo.uri.sh"]:not([data-dl-done])').forEach(attachFlourish);
    doc.querySelectorAll('iframe[src*="flo.uri.sh"]').forEach(function (f) {
      if (!f.closest('[data-dl-done]')) attachFlourish(f);
    });
  }

  /* charts and embeds keep arriving (lazy cards, injected articles): one batched
     rescan shortly after, whatever the number of mutations. A timer rather than
     an animation frame, which a background tab would hold back. */
  var queued = false;
  function later() {
    if (queued) return;
    queued = true;
    setTimeout(function () { queued = false; scan(); }, 80);
  }

  function start() {
    injectCSS();
    scan();
    if (root.MutationObserver) new MutationObserver(later).observe(doc.body, { childList: true, subtree: true });
  }

  root.SoochanaDownload = { scan: scan, render: render, renderFlourish: renderFlourish };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
  else start();
})(window);
