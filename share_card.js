/**
 * share_card.js — turns a tour result into an image people can post.
 *
 *   SoochanaShare.make({ bg, kicker, title, big, bigNote, lines, draw })
 *     → Promise<Blob>  (a 1200×630 PNG, the size link previews use)
 *   SoochanaShare.send(blob, filename, text)
 *     → shares the image where the device supports it (phones), and
 *       otherwise saves it as a download.
 *
 * Drawn on a canvas in the tour's own type: Anton for display, Merriweather
 * for reading, Hind for labels. No logos, only the page address in the
 * footer so the image leads back to the tour.
 */
(function () {
  'use strict';

  var W = 1200, H = 630, PAD = 72;
  var DISPLAY = "'Anton', 'Oswald', Impact, sans-serif";
  var READ = "'Merriweather', Georgia, serif";
  var UI = "'Hind', system-ui, sans-serif";

  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load('64px Anton'),
      document.fonts.load('300 28px Merriweather'),
      document.fonts.load('600 22px Hind')
    ]).catch(function () {});
  }

  /* wrap text into lines no wider than max; returns the lines */
  function wrap(ctx, text, max) {
    var words = String(text).split(/\s+/), lines = [], line = '';
    words.forEach(function (w) {
      var test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > max && line) { lines.push(line); line = w; }
      else line = test;
    });
    if (line) lines.push(line);
    return lines;
  }

  function make(o) {
    return fontsReady().then(function () {
      var c = document.createElement('canvas');
      c.width = W; c.height = H;
      var ctx = c.getContext('2d');

      /* ground, with the tour's soft top-left light */
      ctx.fillStyle = o.bg || '#1f6fa6';
      ctx.fillRect(0, 0, W, H);
      var g = ctx.createRadialGradient(W * 0.18, H * 0.05, 0, W * 0.18, H * 0.05, W * 0.75);
      g.addColorStop(0, 'rgba(255,255,255,0.14)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      var textW = o.draw ? 640 : W - PAD * 2;
      var y = PAD + 6;
      ctx.textBaseline = 'alphabetic';

      if (o.kicker) {
        ctx.font = '600 22px ' + UI;
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.fillText(String(o.kicker).toUpperCase().split('').join(String.fromCharCode(8202)), PAD, y + 16);
        y += 52;
      }

      if (o.title) {
        ctx.font = '50px ' + DISPLAY;
        ctx.fillStyle = '#ffffff';
        wrap(ctx, String(o.title).toUpperCase(), textW).slice(0, 3).forEach(function (l) {
          y += 54; ctx.fillText(l, PAD, y);
        });
        y += 22;
      }

      if (o.big) {
        ctx.font = '124px ' + DISPLAY;
        ctx.fillStyle = o.bigColor || '#f4c534';
        y += 118;
        ctx.fillText(o.big, PAD, y);
        if (o.bigNote) {
          var bw = ctx.measureText(o.big).width;
          ctx.font = '34px ' + DISPLAY;
          ctx.fillStyle = '#ffffff';
          wrap(ctx, String(o.bigNote).toUpperCase(), Math.max(160, textW - bw - 28)).slice(0, 2).forEach(function (l, i) {
            ctx.fillText(l, PAD + bw + 24, y - 50 + i * 40);
          });
        }
        y += 22;
      }

      if (o.lines && o.lines.length) {
        ctx.font = '300 26px ' + READ;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        o.lines.forEach(function (t) {
          wrap(ctx, t, textW).forEach(function (l) {
            if (y > H - 130) return;
            y += 40; ctx.fillText(l, PAD, y);
          });
          y += 8;
        });
      }

      /* optional picture on the right: a mini chart, the people grid… */
      if (o.draw) {
        ctx.save();
        o.draw(ctx, { x: 760, y: 90, w: 370, h: 400 });
        ctx.restore();
      }

      /* footer: where this came from */
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(PAD, H - 78, W - PAD * 2, 1);
      ctx.font = '600 21px ' + UI;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText('Soochana · Explore Odisha', PAD, H - 40);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(location.host + location.pathname, W - PAD, H - 40);
      ctx.textAlign = 'left';

      return new Promise(function (res) { c.toBlob(res, 'image/png'); });
    });
  }

  /* Share where the device can take an image; otherwise download it. */
  function send(blob, filename, text) {
    var file = null;
    try { file = new File([blob], filename, { type: 'image/png' }); } catch (e) {}
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], text: text }).then(function () { return 'shared'; }, function (err) {
        return err && err.name === 'AbortError' ? 'cancelled' : download(blob, filename);
      });
    }
    return Promise.resolve(download(blob, filename));
  }

  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    return 'downloaded';
  }

  window.SoochanaShare = { make: make, send: send };
})();
