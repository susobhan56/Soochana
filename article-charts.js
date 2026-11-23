/**
 * article-charts.js — animated charts inside theme articles.
 *
 * An article (data/contents.json) carries a chart as a figure whose figures
 * are written into the markup, so the numbers live beside the text that
 * quotes them:
 *
 *   <figure class="soo-chart" data-chart='{"type":"bars", ...}'>
 *     <figcaption>Source: …</figcaption>
 *   </figure>
 *
 * article.html calls SoochanaArticleCharts.render(container) after it puts
 * the article on the page. Each chart is drawn at once (so it can be read,
 * printed and downloaded) and animates the first time it scrolls into view:
 * bars grow, lines draw, the ring fills and the values count up.
 *
 * Types and their data:
 *   bars    { title, unit, dec, max, series:[{name, color}], rows:[{label, values:[…], hl}] }
 *   columns { title, unit, dec, max, points:[{label, value, projected}] }
 *   slope   { title, unit, dec, max, from, to, panels:[{name, lines:[{name, a, b, color}]}] }
 *   donut   { title, unit, dec, centre:{value, label}, parts:[{label, value, color}] }
 * color is a name from COLORS below or any CSS colour.
 */
(function (root) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var W = 640;
  var COLORS = {
    teal: '#1a535c',
    tealLit: '#387478',
    sage: '#a5beba',
    stone: '#c9c4b6',
    gold: '#d4a017',
    orange: '#d35400',
    navy: '#1f385c',
    plum: '#7d5a8c'
  };
  var PALETTE = ['teal', 'sage', 'gold', 'tealLit', 'navy', 'stone'];

  var CSS =
    '.soo-chart{margin:36px auto 30px;max-width:760px;padding:22px 22px 16px;background:var(--surface,#fff);border:1px solid var(--border,rgba(0,0,0,.09));border-radius:14px;columns:auto!important}' +
    '.soo-chart .sc-title{font-weight:600;font-size:calc(16px * var(--type-scale,1));color:var(--ink-heading,#0f172a);line-height:1.35;margin:0 0 4px}' +
    '.soo-chart .sc-sub{font-size:calc(13px * var(--type-scale,1));color:var(--muted,#64748b);margin:0 0 12px}' +
    '.soo-chart svg{display:block;width:100%;height:auto;overflow:visible;font-family:inherit}' +
    '.soo-chart figcaption{margin-top:12px;padding-top:10px;border-top:1px solid var(--hairline,rgba(0,0,0,.055));font-size:calc(12px * var(--type-scale,1));font-style:italic;color:var(--muted,#64748b);line-height:1.5}' +
    '.soo-chart .sc-lab{font-size:13px;fill:var(--ink-body,#334155)}' +
    '.soo-chart .sc-lab.hl{font-weight:600;fill:var(--ink-heading,#0f172a)}' +
    '.soo-chart .sc-val{font-size:12.5px;font-weight:600;fill:var(--ink-heading,#0f172a);font-variant-numeric:tabular-nums}' +
    '.soo-chart .sc-axis{font-size:12px;fill:var(--muted,#64748b)}' +
    '.soo-chart .sc-leg{font-size:12.5px;fill:var(--ink-body,#334155)}' +
    '.soo-chart .sc-grid{stroke:var(--hairline,rgba(0,0,0,.07));stroke-width:1}' +
    '.soo-chart .sc-base{stroke:var(--ink-subtle,#64748b);stroke-width:1}' +
    /* motion: everything starts drawn, and only while waiting to animate is it hidden */
    '.soo-chart.sc-wait .sc-bar{transform:scaleX(0)}' +
    '.soo-chart.sc-wait .sc-col{transform:scaleY(0)}' +
    '.soo-chart.sc-wait .sc-line{stroke-dashoffset:1}' +
    '.soo-chart.sc-wait .sc-dot{transform:scale(0)}' +
    '.soo-chart.sc-wait .sc-seg{stroke-dasharray:0 1000}' +
    '.soo-chart.sc-wait .sc-val,.soo-chart.sc-wait .sc-fade{opacity:0}' +
    '.soo-chart .sc-bar{transform-box:fill-box;transform-origin:left center;transition:transform .9s cubic-bezier(.16,1,.3,1) calc(var(--i,0) * 90ms)}' +
    '.soo-chart .sc-col{transform-box:fill-box;transform-origin:center bottom;transition:transform .9s cubic-bezier(.16,1,.3,1) calc(var(--i,0) * 110ms)}' +
    '.soo-chart .sc-line{stroke-dasharray:1;stroke-dashoffset:0;transition:stroke-dashoffset 1.1s cubic-bezier(.65,0,.35,1) calc(var(--i,0) * 160ms + 250ms)}' +
    '.soo-chart .sc-dot{transform-box:fill-box;transform-origin:center;transition:transform .45s cubic-bezier(.34,1.56,.64,1) calc(var(--i,0) * 160ms + var(--k,0ms))}' +
    '.soo-chart .sc-seg{transition:stroke-dasharray 1s cubic-bezier(.65,0,.35,1) calc(var(--i,0) * 220ms)}' +
    '.soo-chart .sc-val,.soo-chart .sc-fade{transition:opacity .5s ease calc(var(--i,0) * 90ms + 350ms)}' +
    '@media (prefers-reduced-motion: reduce){.soo-chart *{transition:none!important}}' +
    '@media (max-width:600px){.soo-chart{padding:16px 12px 12px;border-radius:10px}}';

  function injectCss() {
    if (root.document.getElementById('soo-chart-css')) return;
    var s = root.document.createElement('style');
    s.id = 'soo-chart-css';
    s.textContent = CSS;
    root.document.head.appendChild(s);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function color(c, i) { return COLORS[c] || c || COLORS[PALETTE[i % PALETTE.length]]; }
  function fmt(v, spec) {
    var dec = spec.dec == null ? (v % 1 ? 1 : 0) : spec.dec;
    var s = Number(v).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return spec.unit === '%' ? s + '%' : s;
  }
  // A round top for the scale, so bars keep a little headroom.
  function niceMax(v) {
    var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
    var step = n <= 1 ? 1 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 3 ? 3 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 6 ? 6 : n <= 8 ? 8 : 10;
    return step * p;
  }
  function svgOpen(h, label) {
    return '<svg xmlns="' + NS + '" viewBox="0 0 ' + W + ' ' + h + '" role="img" aria-label="' + esc(label) + '">';
  }
  // Legend keys in a row, wrapping onto new lines when the row is full.
  // Returns the markup; legendH(items) says how tall it will be.
  function legendLayout(items) {
    var x = 0, line = 0, pos = [];
    items.forEach(function (it) {
      var w = 30 + it.name.length * 7.2;
      if (x > 0 && x + w > W) { x = 0; line++; }
      pos.push({ x: x, line: line });
      x += w + 6;
    });
    return { pos: pos, lines: line + 1 };
  }
  function legendH(items) { return legendLayout(items).lines * 20; }
  function legend(items, y) {
    var L = legendLayout(items), out = '';
    items.forEach(function (it, i) {
      var x = L.pos[i].x, yy = y + L.pos[i].line * 20;
      out += '<rect x="' + x + '" y="' + (yy - 10) + '" width="12" height="12" rx="3" fill="' + it.color + '"/>' +
        '<text class="sc-leg" x="' + (x + 18) + '" y="' + yy + '">' + esc(it.name) + '</text>';
    });
    return out;
  }
  // value text that counts up: data-v holds the end value
  function val(x, y, v, spec, i, anchor) {
    return '<text class="sc-val" style="--i:' + i + '" x="' + x + '" y="' + y + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') +
      ' data-v="' + v + '">' + esc(fmt(v, spec)) + '</text>';
  }

  /* horizontal bars, one or more series per row */
  function bars(spec) {
    var series = spec.series || [{ name: '' }];
    var multi = series.length > 1;
    var keys = series.map(function (s, k) { return { name: s.name, color: color(s.color, k) }; });
    // on a narrow screen each row's label sits above its bars, so the bars keep their length
    var stacked = W < 520;
    var labW = stacked ? 0 : (spec.labelWidth || 170), labH = stacked ? 20 : 0;
    var barH = multi ? 18 : 22, gap = 5, groupGap = multi ? 20 : (stacked ? 14 : 12);
    var top = multi ? legendH(keys) + 12 : 6;
    var max = spec.max || niceMax(Math.max.apply(null, spec.rows.map(function (r) { return Math.max.apply(null, r.values); })));
    var plotW = W - labW - (stacked ? 70 : 64);
    var groupH = labH + series.length * barH + (series.length - 1) * gap;
    var h = top + spec.rows.length * (groupH + groupGap) - groupGap + 8;
    var label = spec.title + '. ' + spec.rows.map(function (r) {
      return r.label + ': ' + r.values.map(function (v, k) { return (multi ? series[k].name + ' ' : '') + fmt(v, spec); }).join(', ');
    }).join('; ');
    var out = svgOpen(h, label);
    if (multi) out += legend(keys, 12);
    var n = 0;
    spec.rows.forEach(function (r, ri) {
      var y0 = top + ri * (groupH + groupGap);
      out += stacked
        ? '<text class="sc-lab' + (r.hl ? ' hl' : '') + '" x="0" y="' + (y0 + 13) + '">' + esc(r.label) + '</text>'
        : '<text class="sc-lab' + (r.hl ? ' hl' : '') + '" x="' + (labW - 12) + '" y="' + (y0 + groupH / 2 + 4.5) + '" text-anchor="end">' + esc(r.label) + '</text>';
      r.values.forEach(function (v, k) {
        var y = y0 + labH + k * (barH + gap), w = Math.max(2, v / max * plotW);
        var c = multi ? color(series[k].color, k) : color(r.hl ? (spec.hlColor || 'teal') : (r.color || spec.color || 'sage'), 0);
        out += '<rect class="sc-bar" style="--i:' + n + '" x="' + labW + '" y="' + y + '" width="' + w.toFixed(1) + '" height="' + barH + '" rx="4" fill="' + c + '"/>';
        out += val(labW + w + 8, y + barH / 2 + 4.5, v, spec, n);
        n++;
      });
    });
    return out + '</svg>';
  }

  function hasProjected(pts) { return pts.some(function (p) { return p.projected; }); }

  /* vertical columns across years or groups */
  function columns(spec) {
    var hasProj = hasProjected(spec.points);
    var pts = spec.points, top = 26, base = 236, h = hasProj ? 290 : 262;
    var max = spec.max || niceMax(Math.max.apply(null, pts.map(function (p) { return p.value; })));
    var left = 8, step = (W - left * 2) / pts.length, colW = Math.min(64, step * 0.58);
    var label = spec.title + '. ' + pts.map(function (p) { return p.label + ': ' + fmt(p.value, spec) + (p.projected ? ' (projected)' : ''); }).join(', ');
    var out = svgOpen(h, label);
    [0.25, 0.5, 0.75, 1].forEach(function (f) {
      var y = base - f * (base - top);
      out += '<line class="sc-grid" x1="0" x2="' + W + '" y1="' + y + '" y2="' + y + '"/>';
    });
    pts.forEach(function (p, i) {
      var cx = left + step * i + step / 2, hgt = Math.max(2, p.value / max * (base - top)), y = base - hgt;
      var c = color(p.projected ? (spec.projColor || 'sage') : (spec.color || 'teal'), 0);
      out += '<rect class="sc-col" style="--i:' + i + '" x="' + (cx - colW / 2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + colW.toFixed(1) + '" height="' + hgt.toFixed(1) + '" rx="5" fill="' + c + '"/>';
      out += val(cx, y - 8, p.value, spec, i, 'middle');
      out += '<text class="sc-axis" x="' + cx + '" y="' + (base + 18) + '" text-anchor="middle">' + esc(p.label) + '</text>';
    });
    out += '<line class="sc-base" x1="0" x2="' + W + '" y1="' + base + '" y2="' + base + '"/>';
    if (hasProj) {
      out += legend([{ name: spec.actualLabel || 'Census', color: color(spec.color || 'teal', 0) }, { name: 'Projected', color: color(spec.projColor || 'sage', 0) }], h - 4);
    }
    return out + '</svg>';
  }

  /* two-point slope lines, in one or more panels */
  function slope(spec) {
    var panels = spec.panels;
    // side by side when there is room, one above the other on a narrow screen
    var stacked = W < 520 && panels.length > 1;
    var cols = stacked ? 1 : panels.length, gapX = 40, pw = (W - gapX * (cols - 1)) / cols;
    var names = [];
    panels[0].lines.forEach(function (l, k) { names.push({ name: l.name, color: color(l.color, k) }); });
    var lead = legendH(names) + 12, panelH = 220, gapY = stacked ? 24 : 0;
    var rows = stacked ? panels.length : 1;
    var h = lead + rows * panelH + (rows - 1) * gapY;
    var all = [];
    panels.forEach(function (p) { p.lines.forEach(function (l) { all.push(l.a, l.b); }); });
    var max = spec.max || niceMax(Math.max.apply(null, all));
    var label = spec.title + '. ' + panels.map(function (p) {
      return p.name + ': ' + p.lines.map(function (l) { return l.name + ' ' + fmt(l.a, spec) + ' (' + spec.from + ') to ' + fmt(l.b, spec) + ' (' + spec.to + ')'; }).join('; ');
    }).join('. ');
    var out = svgOpen(h, label) + legend(names, 12);
    var n = 0;
    panels.forEach(function (p, pi) {
      var x0 = stacked ? 0 : pi * (pw + gapX), y0 = lead + (stacked ? pi * (panelH + gapY) : 0);
      var top = y0 + 50, bot = y0 + panelH - 22;
      var y = function (v) { return bot - v / max * (bot - top); };
      var inset = Math.min(64, pw * 0.22), xa = x0 + inset, xb = x0 + pw - inset;
      out += '<text class="sc-lab hl" x="' + (x0 + pw / 2) + '" y="' + (y0 + 22) + '" text-anchor="middle">' + esc(p.name) + '</text>';
      out += '<line class="sc-grid" x1="' + xa + '" x2="' + xa + '" y1="' + (top - 8) + '" y2="' + bot + '"/>';
      out += '<line class="sc-grid" x1="' + xb + '" x2="' + xb + '" y1="' + (top - 8) + '" y2="' + bot + '"/>';
      out += '<text class="sc-axis" x="' + xa + '" y="' + (bot + 18) + '" text-anchor="middle">' + esc(spec.from) + '</text>';
      out += '<text class="sc-axis" x="' + xb + '" y="' + (bot + 18) + '" text-anchor="middle">' + esc(spec.to) + '</text>';
      p.lines.forEach(function (l, k) {
        var c = color(l.color, k), ya = y(l.a), yb = y(l.b);
        out += '<line class="sc-line" pathLength="1" style="--i:' + n + '" x1="' + xa + '" y1="' + ya.toFixed(1) + '" x2="' + xb + '" y2="' + yb.toFixed(1) + '" stroke="' + c + '" stroke-width="3.5" stroke-linecap="round"/>';
        out += '<circle class="sc-dot" style="--i:' + n + ';--k:0ms" cx="' + xa + '" cy="' + ya.toFixed(1) + '" r="6" fill="' + c + '"/>';
        out += '<circle class="sc-dot" style="--i:' + n + ';--k:1250ms" cx="' + xb + '" cy="' + yb.toFixed(1) + '" r="6" fill="' + c + '"/>';
        out += val(xa - 12, ya + 4.5, l.a, spec, n, 'end');
        out += val(xb + 12, yb + 4.5, l.b, spec, n + 2, 'start');
        n++;
      });
    });
    return out + '</svg>';
  }

  /* a ring of parts, with the parts listed beside it */
  function donut(spec) {
    var parts = spec.parts, total = parts.reduce(function (s, p) { return s + p.value; }, 0);
    // the list sits beside the ring, or under it on a narrow screen
    var under = W < 520;
    var r = 86, sw = 38, ringH = 2 * r + sw + 8;
    var h = under ? ringH + 12 + parts.length * 44 : Math.max(230, 40 + parts.length * 44);
    var cx = under ? W / 2 : 120, cy = under ? ringH / 2 : h / 2;
    var len = 2 * Math.PI * r;
    var label = spec.title + '. ' + parts.map(function (p) { return p.label + ' ' + fmt(p.value, spec) + (spec.unit && spec.unit !== '%' ? ' ' + spec.unit : ''); }).join(', ');
    var out = svgOpen(h, label);
    out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--panel,#f2f1ec)" stroke-width="' + sw + '"/>';
    var start = 0;
    parts.forEach(function (p, i) {
      var frac = p.value / total, seg = frac * len, c = color(p.color, i);
      // a hair of space between parts
      var drawn = Math.max(0, seg - 2.5);
      out += '<circle class="sc-seg" style="--i:' + i + ';--len:' + drawn.toFixed(2) + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + c + '" stroke-width="' + sw + '"' +
        ' stroke-dasharray="' + drawn.toFixed(2) + ' ' + (len - drawn).toFixed(2) + '" stroke-dashoffset="0"' +
        ' transform="rotate(' + (-90 + start / len * 360).toFixed(2) + ' ' + cx + ' ' + cy + ')"/>';
      start += seg;
    });
    if (spec.centre) {
      out += '<text class="sc-fade" style="--i:0" x="' + cx + '" y="' + (cy + 2) + '" text-anchor="middle" font-size="26" font-weight="600" fill="var(--ink-heading,#0f172a)">' + esc(spec.centre.value) + '</text>';
      out += '<text class="sc-fade sc-axis" style="--i:0" x="' + cx + '" y="' + (cy + 22) + '" text-anchor="middle">' + esc(spec.centre.label) + '</text>';
    }
    var lx = under ? 8 : 262, ly = under ? ringH + 26 : cy - (parts.length - 1) * 22;
    parts.forEach(function (p, i) {
      var y = ly + i * 44, c = color(p.color, i);
      out += '<rect x="' + lx + '" y="' + (y - 12) + '" width="14" height="14" rx="3" fill="' + c + '"/>';
      out += '<text class="sc-lab" x="' + (lx + 24) + '" y="' + y + '">' + esc(p.label) + '</text>';
      out += val(lx + 24, y + 19, p.value, spec, i);
      out += '<text class="sc-fade sc-axis" style="--i:' + i + '" x="' + (lx + 24 + fmt(p.value, spec).length * 8 + 10) + '" y="' + (y + 19) + '">' +
        esc((spec.unit && spec.unit !== '%' ? spec.unit + ' · ' : '') + Math.round(p.value / total * 100) + '%') + '</text>';
    });
    return out + '</svg>';
  }

  var TYPES = { bars: bars, columns: columns, slope: slope, donut: donut };

  function countUp(fig) {
    var spec = fig._spec;
    fig.querySelectorAll('.sc-val[data-v]').forEach(function (t) {
      var end = +t.getAttribute('data-v'), t0 = null, dur = 1100;
      function step(ts) {
        if (t0 == null) t0 = ts;
        var k = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        t.textContent = fmt(k < 1 ? end * e : end, spec);
        if (k < 1) root.requestAnimationFrame(step);
      }
      root.requestAnimationFrame(step);
    });
  }

  // The drawing width follows the figure, so text stays at reading size on a
  // phone instead of the whole chart being shrunk.
  function widthFor(fig) {
    var cs = root.getComputedStyle(fig);
    var w = fig.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return Math.round(Math.min(640, Math.max(300, w || 640)));
  }
  function plot(fig) {
    W = widthFor(fig);
    fig._w = W;
    fig.querySelector('.sc-plot').innerHTML = TYPES[fig._spec.type](fig._spec);
  }

  function draw(fig) {
    var spec;
    try { spec = JSON.parse(fig.getAttribute('data-chart')); } catch (e) { return; }
    if (!TYPES[spec.type]) return;
    fig._spec = spec;
    var cap = fig.querySelector('figcaption');
    var head = '<div class="sc-title">' + esc(spec.title) + '</div>' + (spec.sub ? '<div class="sc-sub">' + esc(spec.sub) + '</div>' : '');
    var box = root.document.createElement('div');
    box.className = 'sc-plot';
    fig.insertAdjacentHTML('afterbegin', head);
    fig.insertBefore(box, cap || null);
    plot(fig);
    fig.setAttribute('data-download', '');
    fig.setAttribute('data-download-title', spec.title);
    return true;
  }

  // redraw a chart whose figure has changed width (a phone turned sideways)
  var resizeTimer = null;
  root.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      root.document.querySelectorAll('figure.soo-chart[data-drawn]').forEach(function (fig) {
        if (fig._spec && Math.abs(widthFor(fig) - fig._w) > 24) plot(fig);
      });
    }, 150);
  });

  function render(container) {
    if (!container) return;
    injectCss();
    var figs = [].slice.call(container.querySelectorAll('figure.soo-chart[data-chart]:not([data-drawn])'));
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    figs.forEach(function (fig) {
      if (!draw(fig)) return;
      fig.setAttribute('data-drawn', '');
      if (reduce || !('IntersectionObserver' in root)) return;
      fig.classList.add('sc-wait');
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          obs.disconnect();
          // one frame in the hidden state, so the transition has a start
          root.requestAnimationFrame(function () {
            fig.classList.remove('sc-wait');
            countUp(fig);
          });
        });
      }, { threshold: 0.35 });
      obs.observe(fig);
    });
  }

  root.SoochanaArticleCharts = { render: render, types: Object.keys(TYPES) };
})(window);
