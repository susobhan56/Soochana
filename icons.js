/* ─────────────────────────────────────────────────────────────────────
   icons.js — the home page's line icons (24 x 24, drawn for this site)

   SoochanaIcons.svg('heart', 'my-class') returns an <svg> that draws in
   the current text colour. The icons are decorative and hidden from
   screen readers; the words beside them carry the meaning. Used by the
   story (story.js) and the state dossier (dossier.js). The markup below is
   this file's own constants, never data, so it is safe to set as HTML.
   ───────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var ICONS = {
    mountain: '<path d="M2.5 19.5 9 8.5l4 6.5 2.2-3.4 6.3 7.9z"/><circle cx="17" cy="6" r="1.7"/>',
    map:      '<path d="M9 4 3 6.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
    sprout:   '<path d="M12 20.5v-8.5"/><path d="M12 12c0-4.2 3-6.8 7.5-6.8 0 4.2-3 6.8-7.5 6.8z"/><path d="M12 14.6c0-3.1-2.4-5.2-5.8-5.2 0 3.1 2.4 5.2 5.8 5.2z"/>',
    landmark: '<path d="M3 9.5 12 4l9 5.5M4.5 9.5h15M6.5 9.5v8M10 9.5v8M14 9.5v8M17.5 9.5v8M4.5 17.5h15M3 20.5h18"/>',
    home:     '<path d="M3.5 11 12 4.5l8.5 6.5"/><path d="M5.8 9.4v10.1h12.4V9.4"/><path d="M10 19.5v-5h4v5"/>',
    users:    '<circle cx="9" cy="8" r="3.2"/><path d="M3.3 19.5c0-3.3 2.6-5.8 5.7-5.8s5.7 2.5 5.7 5.8"/><circle cx="17.2" cy="9" r="2.4"/><path d="M15.6 13.8c2.9.2 5.1 2.5 5.1 5.7"/>',
    trend:    '<path d="M3.5 3.5v17h17"/><path d="M7 15.5l4-4.2 3 3 5.5-6.3"/><path d="M15.8 8h3.7v3.7"/>',
    family:   '<circle cx="8.5" cy="6.5" r="2.7"/><path d="M4 20.5v-4.3a4.5 4.5 0 0 1 9 0v4.3"/><circle cx="17" cy="11" r="2"/><path d="M14.3 20.5v-2.4a2.7 2.7 0 0 1 5.4 0v2.4"/>',
    bars:     '<path d="M5 20.5v-7M10 20.5V6.5M15 20.5v-9.5M20 20.5v-4.5"/>',
    gender:   '<circle cx="8" cy="9.5" r="3.7"/><path d="M8 13.2v7.3M5.6 17.8h4.8"/><circle cx="16.2" cy="13.6" r="3.7"/><path d="M18.8 11l2.7-2.7M18.6 8.3h2.9v2.9"/>',
    pyramid:  '<path d="M12 3.5v17M10 5.5h4M8 9.5h8M6 13.5h12M4 17.5h16"/>',
    drum:     '<ellipse cx="12" cy="7" rx="6.5" ry="2.4"/><path d="M5.5 7v9.6c0 1.3 2.9 2.4 6.5 2.4s6.5-1.1 6.5-2.4V7"/><path d="M5.5 9.6 9 17.8l3-8.2 3 8.2 3.5-8.2"/>',
    heart:    '<path d="M12 20s-7.6-4.6-7.6-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.6 2.5C19.6 15.4 12 20 12 20z"/><path d="M7.6 12.4h2.5l1.3-2.1 1.8 4 1.2-1.9h2.1"/>',
    hospital: '<path d="M4 20.5V8h16v12.5M2.5 20.5h19"/><path d="M9 8V4.5h6V8"/><path d="M12 10.8v5M9.5 13.3h5"/>',
    pulse:    '<path d="M2.5 12h4.2l2.5-6.2 4.2 12.4 2.5-6.2h5.6"/>',
    apple:    '<path d="M12 7.6c-1.6-1-5.6-1.2-6.9 2.3-1.3 3.7 1 9.8 3.8 9.8 1.3 0 1.8-.6 3.1-.6s1.8.6 3.1.6c2.8 0 5.1-6.1 3.8-9.8C17.6 6.4 13.6 6.6 12 7.6z"/><path d="M12 7.6c0-2.1 1-3.4 2.9-3.9"/>',
    book:     '<path d="M12 7c-2.1-1.7-5.1-2.1-8.3-1.6v13.2c3.2-.5 6.2-.1 8.3 1.6 2.1-1.7 5.1-2.1 8.3-1.6V5.4C17.1 4.9 14.1 5.3 12 7z"/><path d="M12 7v13.2"/>',
    cap:      '<path d="M2.5 9.2 12 4.6l9.5 4.6L12 13.8z"/><path d="M6.4 11.1v4.6c1.5 1.5 3.5 2.3 5.6 2.3s4.1-.8 5.6-2.3v-4.6"/><path d="M21.5 9.2v5.3"/>',
    monitor:  '<rect x="3" y="4.5" width="18" height="12" rx="1.6"/><path d="M8.5 20.5h7M12 16.5v4"/>',
    road:     '<path d="M8.2 3.5 4.5 20.5M15.8 3.5l3.7 17"/><path d="M12 4v2.6M12 10.2v3.2M12 17v3.5"/>',
    drop:     '<path d="M12 3.5s6.2 6.6 6.2 10.8a6.2 6.2 0 0 1-12.4 0C5.8 10.1 12 3.5 12 3.5z"/><path d="M9.2 14.6a2.9 2.9 0 0 0 2.6 2.8"/>',
    zap:      '<path d="M13.2 3 5 13.6h6.1L10.4 21l8.2-10.6h-6.1z"/>',
    hourglass: '<path d="M6.5 3.5h11M6.5 20.5h11"/><path d="M7.8 3.5c0 4.6 4.2 5.6 4.2 8.5s-4.2 3.9-4.2 8.5M16.2 3.5c0 4.6-4.2 5.6-4.2 8.5s4.2 3.9 4.2 8.5"/>',
    signpost:  '<path d="M12 3v18"/><path d="M5 5.5h10.5L18 8l-2.5 2.5H5z"/><path d="M19 13H8.5L6 15.5 8.5 18H19z"/>',
  };

  function svg(name, cls) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    var a = { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false', fill: 'none',
              stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    Object.keys(a).forEach(function (k) { s.setAttribute(k, a[k]); });
    s.setAttribute('class', 'sz-ic' + (cls ? ' ' + cls : ''));
    s.innerHTML = ICONS[name] || ICONS.bars;
    return s;
  }

  window.SoochanaIcons = { svg: svg, names: Object.keys(ICONS) };
})();
