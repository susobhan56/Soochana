/**
 * dotfield3d.js
 * Infinite Liquid Demographic Topographic Mesh with Interactive Data HUD & Axis Labels
 *
 * Explains clearly what the visualization represents:
 *   - Odisha's 17 Quinquennial Age Tiers (0-4 Yrs up to 80+ Yrs)
 *   - Male % (Left) vs Female % (Right)
 *   - Interactive Hover Tooltips with exact age band demographics
 *   - Floating Axis Labels (Apex 80+ Elderly, Base 0-4 Youth, Male/Female split)
 */
(function (global) {
  'use strict';

  var PYR = {
    '1991': [[5.809,5.659],[6.656,6.46],[5.694,5.649],[4.691,4.869],[4.5,4.467],[4.255,4.232],[3.509,3.398],[3.376,3.036],[2.628,2.435],[2.38,2.208],[2.096,1.903],[1.449,1.399],[1.491,1.441],[0.82,0.823],[0.635,0.663],[0.29,0.29],[0.282,0.316]],
    '2011': [[4.487,4.241],[4.727,4.489],[5.028,4.796],[5.043,4.884],[4.653,4.653],[4.128,4.298],[3.681,3.826],[3.348,3.323],[2.933,2.833],[2.53,2.379],[2.148,2.117],[1.716,1.746],[1.492,1.541],[1.037,1.107],[0.799,0.887],[0.42,0.453],[0.408,0.469]],
    '2021': [[4.041,3.992],[3.821,3.756],[3.971,3.883],[4.475,4.281],[4.732,4.512],[4.242,4.234],[4.015,4.021],[3.79,3.767],[3.278,3.226],[3.215,3.11],[2.863,2.741],[2.418,2.35],[1.811,1.803],[1.291,1.319],[1.127,1.169],[0.626,0.669],[0.58,0.652]],
    '2026': [[3.911,3.877],[3.729,3.694],[3.727,3.677],[3.905,3.833],[4.278,4.126],[4.532,4.363],[4.061,4.099],[3.842,3.895],[3.626,3.653],[3.135,3.126],[3.062,2.995],[2.706,2.62],[2.256,2.213],[1.646,1.657],[1.113,1.15],[0.885,0.94],[0.792,0.882]],
    '2031': [[3.596,3.579],[3.607,3.588],[3.641,3.62],[3.669,3.635],[3.742,3.694],[4.096,3.976],[4.34,4.208],[3.887,3.955],[3.674,3.755],[3.46,3.514],[2.98,2.988],[2.888,2.845],[2.523,2.472],[2.028,2.014],[1.396,1.428],[0.965,1.016],[1.021,1.132]],
    '2036': [[3.267,3.256],[3.323,3.315],[3.365,3.354],[3.408,3.386],[3.529,3.5],[3.601,3.564],[3.939,3.836],[4.171,4.062],[3.732,3.815],[3.518,3.611],[3.301,3.371],[2.826,2.855],[2.71,2.699],[2.317,2.31],[1.759,1.784],[1.152,1.209],[1.204,1.383]]
  };

  var AGE_LABELS = [
    '0–4 Yrs (Birth Base)', '5–9 Yrs (Youth)', '10–14 Yrs (Childhood)', '15–19 Yrs (Teens)',
    '20–24 Yrs (Young Adult)', '25–29 Yrs (Workforce)', '30–34 Yrs (Workforce)', '35–39 Yrs (Workforce)',
    '40–44 Yrs (Workforce)', '45–49 Yrs (Workforce)', '50–54 Yrs (Workforce)', '55–59 Yrs (Pre-Retirement)',
    '60–64 Yrs (Senior 60+)', '65–69 Yrs (Senior 60+)', '70–74 Yrs (Senior 60+)', '75–79 Yrs (Elderly 60+)',
    '80+ Yrs (Elderly Apex)'
  ];

  var YEARS   = Object.keys(PYR);
  var SHARE60 = { '1991':'7.2%','2011':'9.5%','2021':'11.1%','2026':'12.4%','2031':'14.0%','2036':'15.9%' };
  var MAXV    = 6.9;
  var MAXDOTS = 22;
  var NUM_BANDS = 17;

  function dotfield3d(canvas, opts) {
    opts = opts || {};
    var dur      = opts.dur || 1600;
    var loop     = true; // INFINITE
    var yearEl   = opts.yearEl  || null;
    var shareEl  = opts.shareEl || null;

    var ctx = canvas.getContext('2d');
    if (!ctx) return { stop: function () {} };

    var W = 0, H = 0, dpr = 1;

    var mouse = { x: -9999, y: -9999, targetX: -9999, targetY: -9999, active: false };
    var rotX = 0, rotY = 0, targetRotX = 0, targetRotY = 0;
    var ripples = [];
    var activeHoverRow = -1;

    function size() {
      dpr = Math.min(global.devicePixelRatio || 1, 2);
      var rect = canvas.getBoundingClientRect();
      var w = rect.width || window.innerWidth;
      var h = rect.height || window.innerHeight;
      W = w; H = h;
      var bw = Math.round(w * dpr);
      var bh = Math.round(h * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
    }

    function onMouseMove(e) {
      var rect = canvas.getBoundingClientRect();
      mouse.targetX = e.clientX - rect.left;
      mouse.targetY = e.clientY - rect.top;
      mouse.active = true;

      var cx = window.innerWidth / 2;
      var cy = window.innerHeight / 2;
      targetRotY = ((e.clientX - cx) / cx) * 0.35;
      targetRotX = -((e.clientY - cy) / cy) * 0.25;
    }

    function onMouseLeave() {
      mouse.active = false;
      mouse.targetX = -9999;
      mouse.targetY = -9999;
      activeHoverRow = -1;
    }

    function onClick(e) {
      var rect = canvas.getBoundingClientRect();
      ripples.push({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        r: 0,
        maxR: Math.max(W, H) * 0.5,
        alpha: 1
      });
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseleave', onMouseLeave, { passive: true });
    window.addEventListener('click', onClick, { passive: true });

    function lerp(a, b, t) { return a + (b - a) * t; }
    function ease(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; }

    function buildDecadeNodes(yrStr) {
      var yrData = PYR[yrStr];
      var grid = [];

      for (var i = 0; i < NUM_BANDS; i++) {
        var row = [];
        var yVal = (i - (NUM_BANDS / 2)) * 24;
        var maleVal = yrData[i][0];
        var femaleVal = yrData[i][1];
        var maleExact = (maleVal / MAXV) * MAXDOTS;
        var femaleExact = (femaleVal / MAXV) * MAXDOTS;

        var isSenior = i >= 12; // 60+
        var isYouth  = i < 4;   // 0-19
        var colorHex = isSenior 
          ? (i >= 14 ? '#8e44ad' : '#bb4500')   // Purple / Coral
          : (isYouth ? '#1a535c' : '#2b5c68');  // Deep Teal

        // Male nodes (left)
        for (var d = MAXDOTS - 1; d >= 0; d--) {
          var xVal = -(16 + d * 16);
          var active = d < maleExact;
          var alpha = active ? (d > maleExact - 1 ? (maleExact % 1) : 0.85) : 0.08;
          row.push({ x: xVal, y: yVal, z: (d % 2 === 0 ? 12 : -12), active: active, alpha: alpha, color: colorHex, rowIdx: i, val: maleVal, gender: 'Male' });
        }

        // Female nodes (right)
        for (var d2 = 0; d2 < MAXDOTS; d2++) {
          var xVal2 = (16 + d2 * 16);
          var active2 = d2 < femaleExact;
          var alpha2 = active2 ? (d2 > femaleExact - 1 ? (femaleExact % 1) : 0.85) : 0.08;
          row.push({ x: xVal2, y: yVal, z: (d2 % 2 === 0 ? -12 : 12), active: active2, alpha: alpha2, color: colorHex, rowIdx: i, val: femaleVal, gender: 'Female' });
        }

        grid.push(row);
      }
      return grid;
    }

    var datasetCache = {};
    YEARS.forEach(function (yr) {
      datasetCache[yr] = buildDecadeNodes(yr);
    });

    var totalRows = NUM_BANDS;
    var totalCols = MAXDOTS * 2;
    var nodesState = [];

    for (var r = 0; r < totalRows; r++) {
      var rowArray = [];
      for (var c = 0; c < totalCols; c++) {
        rowArray.push({
          x: 0, y: 0, z: 0,
          vx: 0, vy: 0, vz: 0,
          sx: 0, sy: 0, scale: 1,
          alpha: 0, color: '#1a535c', rowIdx: r
        });
      }
      nodesState.push(rowArray);
    }

    var fov = 460;

    function renderScene(gridA, gridB, progress, timeMs, currentYrStr) {
      size();
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);

      mouse.x += (mouse.targetX - mouse.x) * 0.15;
      mouse.y += (mouse.targetY - mouse.y) * 0.15;

      rotX += (targetRotX - rotX) * 0.06;
      rotY += (targetRotY - rotY) * 0.06;

      var cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      var cosX = Math.cos(rotX), sinX = Math.sin(rotX);

      var centerX = W >= 1100 ? W * 0.68 : W * 0.5;
      var centerY = H * 0.50;

      // Update click shockwaves
      for (var sw = ripples.length - 1; sw >= 0; sw--) {
        var rip = ripples[sw];
        rip.r += 10;
        rip.alpha *= 0.94;
        if (rip.alpha < 0.01 || rip.r > rip.maxR) {
          ripples.splice(sw, 1);
        } else {
          ctx.strokeStyle = 'rgba(26, 83, 92, ' + (rip.alpha * 0.3) + ')';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      var closestHoverDist = 9999;
      activeHoverRow = -1;

      // Compute and update node 3D positions
      for (var r = 0; r < totalRows; r++) {
        for (var c = 0; c < totalCols; c++) {
          var node = nodesState[r][c];
          var nA = gridA[r][c];
          var nB = gridB[r][c];

          var tx = lerp(nA.x, nB.x, progress);
          var ty = lerp(nA.y, nB.y, progress);
          var tz = lerp(nA.z, nB.z, progress);

          ty += Math.sin(timeMs * 0.002 + tx * 0.012 + r * 0.3) * 3.5;

          node.x += (tx - node.x) * 0.1 + node.vx;
          node.y += (ty - node.y) * 0.1 + node.vy;
          node.z += (tz - node.z) * 0.1 + node.vz;

          node.vx *= 0.84;
          node.vy *= 0.84;
          node.vz *= 0.84;

          node.color = nA.color;
          node.alpha = lerp(nA.alpha, nB.alpha, progress);
          node.rowIdx = r;

          var x1 = node.x * cosY - node.z * sinY;
          var z1 = node.z * cosY + node.x * sinY;
          var y1 = node.y * cosX - z1 * sinX;
          var z2 = z1 * cosX + node.y * sinX;

          var dist = fov + z2;
          if (dist <= 10) continue;

          var sc = fov / dist;
          var sx = centerX + x1 * sc;
          var sy = centerY - y1 * sc;

          if (mouse.active) {
            var dx = sx - mouse.x;
            var dy = sy - mouse.y;
            var dSq = dx * dx + dy * dy;
            var radius = 130;
            if (dSq < radius * radius && dSq > 1) {
              var dLen = Math.sqrt(dSq);
              var force = (1 - dLen / radius) * 14;
              node.vx += (dx / dLen) * force * 0.35;
              node.vy += (dy / dLen) * force * 0.35;
            }
            if (dSq < closestHoverDist) {
              closestHoverDist = dSq;
              activeHoverRow = r;
            }
          }

          node.sx = sx;
          node.sy = sy;
          node.scale = sc;
        }
      }

      // 1. Draw Clean Vector Mesh Grid Wireframe Lines
      ctx.lineWidth = 0.6;
      for (var r2 = 0; r2 < totalRows; r2++) {
        var isRowHovered = (r2 === activeHoverRow);
        for (var c2 = 0; c2 < totalCols; c2++) {
          var curr = nodesState[r2][c2];
          if (curr.alpha < 0.05) continue;

          if (c2 < totalCols - 1) {
            var nextH = nodesState[r2][c2 + 1];
            if (nextH.alpha > 0.05) {
              var lineAlpha = Math.min(curr.alpha, nextH.alpha) * (isRowHovered ? 0.6 : 0.22);
              ctx.strokeStyle = isRowHovered ? '#bb4500' : curr.color;
              ctx.globalAlpha = lineAlpha;
              ctx.beginPath();
              ctx.moveTo(curr.sx, curr.sy);
              ctx.lineTo(nextH.sx, nextH.sy);
              ctx.stroke();
            }
          }

          if (r2 < totalRows - 1) {
            var nextV = nodesState[r2 + 1][c2];
            if (nextV.alpha > 0.05) {
              var lineAlphaV = Math.min(curr.alpha, nextV.alpha) * (isRowHovered ? 0.6 : 0.22);
              ctx.strokeStyle = isRowHovered ? '#bb4500' : curr.color;
              ctx.globalAlpha = lineAlphaV;
              ctx.beginPath();
              ctx.moveTo(curr.sx, curr.sy);
              ctx.lineTo(nextV.sx, nextV.sy);
              ctx.stroke();
            }
          }
        }
      }

      // 2. Draw Crisp Micro-Node Particles
      for (var r3 = 0; r3 < totalRows; r3++) {
        var isRowHovered3 = (r3 === activeHoverRow);
        for (var c3 = 0; c3 < totalCols; c3++) {
          var pNode = nodesState[r3][c3];
          if (pNode.alpha < 0.02) continue;

          var nodeRadius = Math.max(1.1, (isRowHovered3 ? 3.8 : 2.6) * pNode.scale);
          ctx.globalAlpha = isRowHovered3 ? 1.0 : pNode.alpha;
          ctx.fillStyle = isRowHovered3 ? '#bb4500' : pNode.color;
          ctx.beginPath();
          ctx.arc(pNode.sx, pNode.sy, nodeRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 3. Floating Editorial Axis Labels & Annotations
      ctx.globalAlpha = 0.55;
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#1e2530';

      var topNode = nodesState[NUM_BANDS - 1][Math.floor(totalCols / 2)];
      var botNode = nodesState[0][Math.floor(totalCols / 2)];
      var leftNode = nodesState[Math.floor(NUM_BANDS / 2)][0];
      var rightNode = nodesState[Math.floor(NUM_BANDS / 2)][totalCols - 1];

      if (topNode && topNode.sx) {
        ctx.fillText('▲ 80+ ELDERLY APEX', topNode.sx - 55, topNode.sy - 15);
      }
      if (botNode && botNode.sx) {
        ctx.fillText('▼ 0–4 YOUTH BASE', botNode.sx - 52, botNode.sy + 22);
      }
      if (leftNode && leftNode.sx) {
        ctx.fillText('← MALE %', leftNode.sx - 65, leftNode.sy + 4);
      }
      if (rightNode && rightNode.sx) {
        ctx.fillText('FEMALE % →', rightNode.sx + 15, rightNode.sy + 4);
      }

      // 4. Interactive Editorial HUD Tooltip on Hover
      if (activeHoverRow >= 0 && mouse.active) {
        var rowName = AGE_LABELS[activeHoverRow];
        var dataA = PYR[currentYrStr][activeHoverRow];
        var maleP = dataA[0].toFixed(1) + '%';
        var femP = dataA[1].toFixed(1) + '%';

        ctx.globalAlpha = 0.95;
        var ttX = Math.min(W - 220, Math.max(10, mouse.x + 18));
        var ttY = Math.min(H - 70, Math.max(10, mouse.y - 45));

        // Tooltip Background Card
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(ttX, ttY, 210, 62, 8);
        ctx.fill();
        ctx.stroke();

        // Tooltip Text
        ctx.fillStyle = '#1a535c';
        ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(rowName, ttX + 12, ttY + 22);

        ctx.fillStyle = '#4f5664';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.fillText('Male: ' + maleP + '  |  Female: ' + femP, ttX + 12, ttY + 44);
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    var raf = null, t0 = null, idx = 0, stopped = false;

    var reduced = global.matchMedia &&
                  global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      renderScene(datasetCache['2021'], datasetCache['2021'], 1, 0, '2021');
      return { stop: function () {} };
    }

    function frame(ts) {
      if (stopped) return;
      if (t0 === null) t0 = ts;
      var k = (ts - t0) / dur;

      if (k >= 1) {
        k = 0; t0 = ts;
        idx++;
        if (idx > YEARS.length - 1) {
          idx = 0;
        }
      }

      var nextIdx = (idx + 1) % YEARS.length;
      var yrA = YEARS[idx];
      var yrB = YEARS[nextIdx];
      var e = ease(k);

      renderScene(datasetCache[yrA], datasetCache[yrB], e, ts, yrA);

      if (yearEl) {
        var yr = k < 0.5 ? yrA : yrB;
        if (yearEl.textContent !== yr) {
          yearEl.textContent = yr;
          if (shareEl) shareEl.textContent = SHARE60[yr];
        }
      }

      raf = global.requestAnimationFrame(frame);
    }

    function onResize() {
      size();
    }
    if (global.ResizeObserver) {
      new global.ResizeObserver(onResize).observe(canvas);
    } else {
      global.addEventListener('resize', onResize);
    }

    raf = global.requestAnimationFrame(frame);

    return {
      stop: function () {
        stopped = true;
        if (raf) global.cancelAnimationFrame(raf);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseleave', onMouseLeave);
        window.removeEventListener('click', onClick);
      }
    };
  }

  dotfield3d.TRENDS = [
    [1901, 10302917], [1911, 11378875], [1921, 11158586], [1931, 12491056],
    [1941, 13767988], [1951, 14645946], [1961, 17548846], [1971, 21944615],
    [1981, 26370271], [1991, 31659736], [2001, 36804660], [2011, 41974218],
    [2021, 46254277]
  ];

  global.dotfield3d = dotfield3d;
})(window);
