/* guard.js: the first script on every page.
 *
 * 1. Framing. Another website must not show the portal inside its own page
 *    (passing it off as theirs, or tricking visitors into clicks). GitHub Pages
 *    cannot send the X-Frame-Options / frame-ancestors headers, so this does it
 *    in the page: framed by another site, the portal breaks out to the top
 *    window, or, where the browser blocks that, shows only a link to open it.
 *    Frames from the portal's own address are fine.
 * 2. Copyright. Adds the notice to the foot of the page (the last <footer>, or
 *    a line of its own on pages without one).
 */
(function () {
  'use strict';

  var NOTICE = '© 2026 CYSD. All rights reserved. The text, charts, code and data ' +
    'compilations on this portal may not be copied or republished without written permission.';

  function framedByAnotherSite() {
    if (window.top === window.self) return false;
    try { return window.top.location.origin !== window.location.origin; }
    catch (e) { return true; }   // the top window is on another site
  }

  if (framedByAnotherSite()) {
    document.documentElement.style.visibility = 'hidden';
    try { window.top.location.replace(window.location.href); } catch (e) { /* blocked without a click */ }
    document.addEventListener('DOMContentLoaded', function () {
      var a = document.createElement('a');
      a.href = window.location.href;
      a.target = '_top';
      a.rel = 'noopener';
      a.textContent = 'Open Soochana in its own window';
      a.style.cssText = 'display:block;margin:40px auto;font:600 18px/1.4 system-ui,sans-serif;text-align:center;color:#1a535c';
      document.body.replaceChildren(a);
      document.documentElement.style.visibility = 'visible';
    });
    return;
  }

  function addNotice() {
    if (document.querySelector('.soo-copyright')) return;
    var p = document.createElement('p');
    p.className = 'soo-copyright';
    p.textContent = NOTICE;
    p.style.cssText = 'flex-basis:100%;margin:0;font-size:12px;line-height:1.5;opacity:.75';
    var footers = document.querySelectorAll('footer');
    if (footers.length) {
      footers[footers.length - 1].appendChild(p);
    } else {
      p.style.cssText += ';padding:14px clamp(16px,6vw,80px);text-align:center;position:relative;z-index:1';
      document.body.appendChild(p);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addNotice);
  else addNotice();
})();
