/**
 * storyteller/ui/storyteller.js
 * The Soochana Storyteller: watches which chart section the reader is
 * looking at, narrates it, and optionally reads it aloud.
 *
 *   SoochanaStoryteller.init({
 *     geography: { level: 'district', id: 'Koraput', name: 'Koraput' },
 *     load: url => DataLoader.loadJSON(url),
 *     sources: { odishaSlideData }          // data already inline on the page
 *   });
 *   SoochanaStoryteller.setState('state-pyramid', { year: '2036' });
 *
 * A section takes part by carrying  data-story-id="<registered story id>".
 * Sections added later (the district dossier renders after its data
 * loads) are picked up automatically.
 *
 * Behaviour:
 *  - a section becomes eligible when ~55% of it (or of the viewport, for
 *    tall sections) is visible, and is narrated only after the reader has
 *    stayed on it for about a second;
 *  - a section already narrated this session updates the card silently
 *    rather than speaking again; Replay repeats it on request;
 *  - voice is off until the reader turns it on (browsers block speech
 *    without a gesture), and the text is always shown, so the narrator is
 *    never the only way to read a chart;
 *  - nothing about the visitor is collected: preferences stay in this
 *    browser's localStorage, the "already narrated" memory in
 *    sessionStorage.
 */
(function (root) {
  'use strict';
  var NS = root.SoochanaStoryteller = root.SoochanaStoryteller || {};
  var doc = root.document;
  var PREFS_KEY = 'soochana-storyteller-prefs';
  var SEEN_KEY = 'soochana-storyteller-seen';

  var ICON = {
    play: '<path d="M8 5v14l11-7z" fill="currentColor"/>',
    pause: '<path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/>',
    voice: '<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    mute: '<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    replay: '<path d="M12 5a7 7 0 1 1-6.6 4.7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 4v5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    list: '<path d="M8 7h12M8 12h12M8 17h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="4.5" cy="7" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="17" r="1.2" fill="currentColor"/>',
    close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    down: '<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    up: '<path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    overview: '<rect x="4" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/>'
  };
  function icon(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICON[name] + '</svg>';
  }

  var STATUS_LABEL = {
    observed: 'Observed',
    survey_rounds: 'Survey rounds',
    historical_plus_projected: 'Observed + projected',
    projected: 'Projected'
  };

  /* ── session state ───────────────────────────────────────────────── */
  var state = {
    currentSection: null,
    previouslyNarratedSections: new Set(),
    userPaused: false,
    voiceEnabled: false,
    autoNarrate: true,
    mode: 'story',
    collapsed: false,
    closed: false,
    narrationVersion: 0,
    storyState: {}
  };

  var config = null, voice = null, service = null;
  var els = {};
  var current = null;           /* narration on the card */
  var sectionEls = {};          /* story id → last element that showed it */
  var narrationCache = new Map();
  var transcript = [];
  var io = null, scores = new Map(), candidate = null, dwellTimer = null;
  var started = false;
  var firstPick = true;         /* the first visibility check after load skips the dwell */
  var OVERVIEW = '__overview';

  function readJSON(store, key, fallback) {
    try { var v = root[store].getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function writeJSON(store, key, value) {
    try { root[store].setItem(key, JSON.stringify(value)); } catch (e) { /* private mode: in-memory only */ }
  }
  function savePrefs() {
    writeJSON('localStorage', PREFS_KEY, {
      voiceEnabled: state.voiceEnabled, autoNarrate: state.autoNarrate,
      mode: state.mode, collapsed: state.collapsed, closed: state.closed
    });
  }

  /* ── DOM ─────────────────────────────────────────────────────────── */
  function h(tag, attrs, html) {
    var el = doc.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else el.setAttribute(k, attrs[k]);
    });
    if (html) el.innerHTML = html;   /* only ever our own static markup */
    return el;
  }

  function build() {
    var card = h('aside', { class: 'sst sst-entering', id: 'soochana-storyteller', 'aria-label': 'Soochana storyteller: explains the chart in view', hidden: '' });
    var head = h('div', { class: 'sst-head' });
    head.appendChild(h('span', { class: 'sst-dot', 'aria-hidden': 'true' }));
    head.appendChild(h('span', { class: 'sst-brand', text: 'Soochana Storyteller' }));
    els.peek = h('span', { class: 'sst-peek', 'aria-hidden': 'true' });
    head.appendChild(els.peek);
    head.appendChild(h('span', { class: 'sst-head-spacer' }));
    els.collapse = h('button', { type: 'button', class: 'sst-icon-btn', 'data-act': 'collapse', 'aria-expanded': 'true', 'aria-controls': 'sst-body', title: 'Collapse' }, icon('down'));
    els.close = h('button', { type: 'button', class: 'sst-icon-btn', 'data-act': 'close', 'aria-label': 'Hide the storyteller', title: 'Hide' }, icon('close'));
    els.transcriptBtn = h('button', { type: 'button', class: 'sst-icon-btn', 'data-act': 'transcript', 'aria-label': 'Open the transcript', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', title: 'Transcript' }, icon('list'));
    els.overviewBtn = h('button', { type: 'button', class: 'sst-icon-btn', 'data-act': 'overview', 'aria-label': 'Show the page overview', title: 'Page overview' }, icon('overview'));
    head.appendChild(els.overviewBtn);
    head.appendChild(els.transcriptBtn);
    head.appendChild(els.collapse);
    head.appendChild(els.close);
    card.appendChild(head);

    var body = h('div', { class: 'sst-body', id: 'sst-body' });
    els.kicker = h('div', { class: 'sst-kicker' });
    els.section = h('span');
    els.badge = h('span', { class: 'sst-badge' });
    els.kicker.appendChild(els.section);
    els.kicker.appendChild(els.badge);
    body.appendChild(els.kicker);
    els.headline = h('h2', { class: 'sst-headline' });
    body.appendChild(els.headline);
    els.text = h('p', { class: 'sst-text' });
    body.appendChild(els.text);
    els.points = h('ul', { class: 'sst-points', 'aria-label': 'Key points' });
    body.appendChild(els.points);
    els.why = h('details', { class: 'sst-why' });
    els.why.appendChild(h('summary', { text: 'Why this matters' }));
    els.whyText = h('p');
    els.why.appendChild(els.whyText);
    body.appendChild(els.why);
    els.source = h('div', { class: 'sst-source' });
    body.appendChild(els.source);
    els.pending = h('button', { type: 'button', class: 'sst-pending', 'data-act': 'pending', hidden: '' });
    body.appendChild(els.pending);
    els.note = h('div', { class: 'sst-note', hidden: '' });
    body.appendChild(els.note);
    card.appendChild(body);

    var controls = h('div', { class: 'sst-controls', role: 'group', 'aria-label': 'Narration controls' });
    els.play = h('button', { type: 'button', 'data-act': 'play' });
    els.voice = h('button', { type: 'button', class: 'sst-icon-btn', 'data-act': 'voice' });
    els.replay = h('button', { type: 'button', class: 'sst-icon-btn', 'data-act': 'replay', 'aria-label': 'Replay this narration', title: 'Replay' }, icon('replay'));
    var seg = h('div', { class: 'sst-seg', role: 'group', 'aria-label': 'Narration detail' });
    els.modeStory = h('button', { type: 'button', 'data-mode': 'story', text: 'Story' });
    els.modeData = h('button', { type: 'button', 'data-mode': 'data', text: 'Data' });
    seg.appendChild(els.modeStory);
    seg.appendChild(els.modeData);
    els.auto = h('button', { type: 'button', 'data-act': 'auto', title: 'Follow the page as you scroll', text: 'Auto' });
    [els.play, els.voice, els.replay, h('span', { class: 'sst-grow' }), seg, els.auto].forEach(function (n) { controls.appendChild(n); });
    card.appendChild(controls);

    /* Announces new narrations to screen readers, once each. */
    els.live = h('div', { class: 'sst-sr', 'aria-live': 'polite', 'aria-atomic': 'true' });
    card.appendChild(els.live);

    var launcher = h('button', { type: 'button', class: 'sst-launcher', hidden: '', 'aria-label': 'Show the Soochana storyteller' },
      '<span class="sst-dot" aria-hidden="true"></span>Storyteller');

    var tr = h('section', { class: 'sst-transcript', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'sst-tr-title', hidden: '' });
    var trHead = h('header');
    trHead.appendChild(h('h2', { id: 'sst-tr-title', text: 'Narration transcript' }));
    els.trClose = h('button', { type: 'button', 'data-act': 'transcript-close', text: 'Close' });
    trHead.appendChild(els.trClose);
    tr.appendChild(trHead);
    els.trList = h('ol');
    tr.appendChild(els.trList);

    doc.body.appendChild(card);
    doc.body.appendChild(launcher);
    doc.body.appendChild(tr);
    els.card = card; els.launcher = launcher; els.transcript = tr;

    card.addEventListener('click', onClick);
    launcher.addEventListener('click', function () { setClosed(false); });
    tr.addEventListener('click', onTranscriptClick);
    tr.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeTranscript(); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !state.collapsed) { setCollapsed(true); els.collapse.focus(); }
    });
    syncControls();
  }

  /* ── rendering ───────────────────────────────────────────────────── */
  function sectionTitle(n) {
    var def = NS.stories.get(n.storyId);
    return n.geography + ' · ' + (def ? def.title : n.title);
  }

  /* Before any chart has been read: show the card so readers know it is
     there, with a one-line hint instead of a narration. */
  function showIdle() {
    els.card.classList.add('sst-idle');
    els.section.textContent = config.geography.name;
    els.badge.textContent = '';
    els.headline.textContent = 'Reading the charts on this page\u2026';
    els.peek.textContent = 'Reading the charts on this page\u2026';
    els.text.textContent = 'In a moment: what the charts on this page show, worked out from the data behind them.';
    els.points.hidden = true; els.why.hidden = true; els.source.textContent = '';
    showCard();
    syncControls();
  }

  function render(n, opts) {
    opts = opts || {};
    current = n;
    els.card.classList.remove('sst-idle');
    els.section.textContent = sectionTitle(n);
    els.badge.textContent = STATUS_LABEL[n.dataStatus] || 'Observed';
    els.badge.classList.toggle('is-projected', /projected/.test(n.dataStatus));
    els.headline.textContent = n.headline;
    els.peek.textContent = n.headline;
    els.text.textContent = n.narration;
    els.points.innerHTML = '';
    if (n.links && n.links.length) {
      /* The overview lists each chart; each item jumps to it. */
      n.links.forEach(function (l) {
        var li = h('li', { class: 'sst-link-item' });
        li.appendChild(h('button', { type: 'button', class: 'sst-link', 'data-goto': l.storyId, text: l.text }));
        els.points.appendChild(li);
      });
      els.points.setAttribute('aria-label', 'Charts on this page');
      els.points.hidden = false;
    } else {
      (n.keyPoints || []).forEach(function (k) { els.points.appendChild(h('li', { text: k })); });
      els.points.setAttribute('aria-label', 'Key points');
      els.points.hidden = !n.keyPoints || !n.keyPoints.length || state.mode === 'story';
    }
    els.why.hidden = !n.importance;
    els.whyText.textContent = n.importance || '';
    els.source.innerHTML = '';
    els.source.appendChild(h('strong', { text: 'Source: ' }));
    els.source.appendChild(doc.createTextNode(n.sourceLabel.replace(/\.$/, '') + '.' + (n.sourceNote ? ' ' + n.sourceNote : '')));
    els.pending.hidden = true;
    if (opts.announce) els.live.textContent = n.headline + '. ' + n.narration;
    showCard();
    syncControls();
  }

  function showCard() {
    if (state.closed) return;
    if (els.card.hidden) {
      els.card.hidden = false;
      els.launcher.hidden = true;
      root.setTimeout(function () { els.card.classList.remove('sst-entering'); }, 30);
    }
  }

  function syncControls() {
    var vs = voice ? voice.state() : 'unsupported';
    var supported = vs !== 'unsupported';
    var speaking = vs === 'speaking';
    var paused = vs === 'paused';
    els.play.innerHTML = icon(speaking ? 'pause' : 'play') + '<span>' + (speaking ? 'Pause' : paused ? 'Resume' : 'Listen') + '</span>';
    els.play.disabled = !supported || !current;
    els.play.setAttribute('aria-label', speaking ? 'Pause the narration' : paused ? 'Resume the narration' : 'Read this narration aloud');
    els.voice.innerHTML = icon(state.voiceEnabled ? 'voice' : 'mute');
    els.voice.disabled = !supported;
    els.voice.setAttribute('aria-pressed', String(state.voiceEnabled));
    els.voice.setAttribute('aria-label', state.voiceEnabled ? 'Voice on. Turn off voice narration' : 'Voice off. Turn on voice narration');
    els.voice.title = state.voiceEnabled ? 'Voice on' : 'Voice off';
    els.replay.disabled = !current;
    els.modeStory.setAttribute('aria-pressed', String(state.mode === 'story'));
    els.modeData.setAttribute('aria-pressed', String(state.mode === 'data'));
    els.auto.setAttribute('aria-pressed', String(state.autoNarrate));
    els.card.classList.toggle('sst-speaking', speaking);
    els.card.classList.toggle('sst-collapsed', state.collapsed);
    els.collapse.innerHTML = icon(state.collapsed ? 'up' : 'down');
    els.collapse.setAttribute('aria-expanded', String(!state.collapsed));
    els.collapse.setAttribute('aria-label', state.collapsed ? 'Expand the storyteller' : 'Collapse the storyteller');
    els.collapse.title = state.collapsed ? 'Expand' : 'Collapse';
    els.note.hidden = vs !== 'blocked';
    els.note.textContent = vs === 'blocked' ? 'Your browser blocked audio. Press Listen to hear the narration.' : '';
  }

  /* ── narration ───────────────────────────────────────────────────── */
  function storyContext(id) {
    return {
      geography: config.geography,
      load: config.load,
      sources: config.sources,
      state: state.storyState[id] || {}
    };
  }

  function seenKey(id) { return id + '|' + (config.geography && config.geography.id) + '|' + JSON.stringify(state.storyState[id] || {}); }

  function narrationFor(ds, id, mode) {
    var st = state.storyState[id] || {};
    var m = mode || state.mode;
    var key = [id, m, JSON.stringify(st)].join('|');
    if (!narrationCache.has(key)) {
      narrationCache.set(key, root.SoochanaInsight.narrate.buildNarration(ds, { mode: m, focusYear: st.year }));
    }
    return narrationCache.get(key);
  }

  /* ── in-section perception panels ─────────────────────────────────
     Each narrated section gets its own panel, placed under the
     section's heading, which pops in as the section scrolls into view.
     It carries the full perception: headline, plain explanation, the
     precise numbers, key points, why it matters and the source. */
  function inlineSlot(el) {
    var slot = el.querySelector('[data-story-slot]');
    if (slot) return { parent: slot, before: null };
    var heading = el.querySelector('h2, h3');
    if (heading && heading.parentNode) {
      /* after the heading; if it sits in a flex row, after that row */
      var anchor = heading;
      while (anchor.parentNode !== el && anchor.parentNode && anchor.parentNode !== doc.body) anchor = anchor.parentNode;
      return anchor.parentNode === el ? { parent: el, before: anchor.nextSibling } : { parent: el, before: null };
    }
    return { parent: el, before: null };
  }

  function ensureInline(el) {
    if (el.__sstInline && el.contains(el.__sstInline)) return el.__sstInline;
    var box = h('aside', { class: 'sst-inline', 'aria-label': 'What this chart shows' });
    box.innerHTML =
      '<div class="sst-inline-top"><span class="sst-inline-tag"><span class="sst-dot" aria-hidden="true"></span>Perception</span>' +
      '<span class="sst-badge"></span></div>' +
      '<h4 class="sst-inline-head"></h4>' +
      '<p class="sst-inline-text"></p>' +
      '<p class="sst-inline-data"><strong>In numbers:</strong> <span></span></p>' +
      '<ul class="sst-points"></ul>' +
      '<details class="sst-why"><summary>Why this matters</summary><p></p></details>' +
      '<div class="sst-inline-foot"><span class="sst-source"></span>' +
      '<button type="button" class="sst-inline-listen">' + icon('play') + '<span>Listen</span></button></div>';
    var slot = inlineSlot(el);
    slot.parent.insertBefore(box, slot.before);
    box.querySelector('.sst-inline-listen').addEventListener('click', function () {
      if (!box.__narration) return;
      state.userPaused = false;
      if (voice.state() === 'speaking') { voice.cancel(); return; }
      speak(box.__narration);
    });
    el.__sstInline = box;
    return box;
  }

  function renderInline(el, opts) {
    opts = opts || {};
    var id = el.getAttribute('data-story-id');
    if (!NS.stories.get(id)) return;
    var key = id + '|' + JSON.stringify(state.storyState[id] || {});
    if (el.__sstInlineKey === key && !opts.force) return;
    el.__sstInlineKey = key;
    NS.stories.build(id, storyContext(id)).then(function (ds) {
      if (!ds) { el.__sstInlineKey = null; return; }
      var story = narrationFor(ds, id, 'story');
      var data = narrationFor(ds, id, 'data');
      var box = ensureInline(el);
      box.__narration = story;
      var q = function (sel) { return box.querySelector(sel); };
      q('.sst-badge').textContent = STATUS_LABEL[story.dataStatus] || 'Observed';
      q('.sst-badge').classList.toggle('is-projected', /projected/.test(story.dataStatus));
      q('.sst-inline-head').textContent = story.headline;
      q('.sst-inline-text').textContent = story.narration;
      q('.sst-inline-data span').textContent = data.narration;
      q('.sst-inline-data').hidden = !data.narration || data.narration === story.narration;
      var pts = q('.sst-points');
      pts.innerHTML = '';
      (story.keyPoints || []).forEach(function (k) { pts.appendChild(h('li', { text: k })); });
      pts.hidden = !story.keyPoints || !story.keyPoints.length;
      q('.sst-why').hidden = !story.importance;
      q('.sst-why p').textContent = story.importance || '';
      q('.sst-source').textContent = 'Source: ' + story.sourceLabel.replace(/\.$/, '') + '.' + (story.sourceNote ? ' ' + story.sourceNote : '');
      q('.sst-inline-listen').hidden = !voice || !voice.isSupported();
      box.classList.remove('is-in');
      void box.offsetWidth;                   /* restart the pop-in */
      box.classList.add('is-in');
    });
  }

  function renderInlineFor(id) {
    doc.querySelectorAll('[data-story-id="' + id + '"]').forEach(function (el) {
      if (el.__sstInline) renderInline(el, { force: true });
    });
  }

  function speak(n) {
    if (!voice || !voice.isSupported()) return;
    voice.speak(n.headline + '. ' + n.narration);
  }

  /* opts.manual: the reader asked for this (replay, mode change, filter
     change) — it may speak even if the section was narrated before. */
  function narrate(id, opts) {
    opts = opts || {};
    var version = ++state.narrationVersion;
    service.cancel();
    return NS.stories.build(id, storyContext(id)).then(function (ds) {
      if (version !== state.narrationVersion || !ds) return;
      var n = narrationFor(ds, id);
      var sk = seenKey(id);
      var seen = state.previouslyNarratedSections.has(sk);
      state.previouslyNarratedSections.add(sk);
      writeJSON('sessionStorage', SEEN_KEY, Array.from(state.previouslyNarratedSections));
      var fresh = !seen || opts.manual;
      /* Speech about the previous chart must not run on under a new one. */
      var vs = voice ? voice.state() : 'idle';
      if (vs === 'speaking' || vs === 'paused') voice.cancel();
      render(n, { announce: fresh });
      logTranscript(n);
      if (fresh && state.voiceEnabled && !state.userPaused && !opts.silent) speak(n);
      if (service.isEnabled()) {
        service.refine(n).then(function (better) {
          if (!better || version !== state.narrationVersion) return;
          narrationCache.set([id, state.mode, JSON.stringify(state.storyState[id] || {})].join('|'), better);
          logTranscript(better);
          var vs = voice ? voice.state() : 'idle';
          if (vs === 'speaking' || vs === 'paused') { current = better; return; }  /* never swap mid-sentence */
          els.text.classList.add('sst-swapping');
          root.setTimeout(function () { render(better); els.text.classList.remove('sst-swapping'); }, 180);
        });
      }
    });
  }

  /* The page overview: every chart on the page is analysed (cheap, and
     the data are already loaded) and summarised together. Shown when the
     page opens, and from the Overview button. */
  function narrateOverview(opts) {
    opts = opts || {};
    var version = ++state.narrationVersion;
    service.cancel();
    var ids = [];
    doc.querySelectorAll('[data-story-id]').forEach(function (el) {
      var id = el.getAttribute('data-story-id');
      if (!NS.stories.get(id) || ids.indexOf(id) !== -1) return;
      ids.push(id);
      if (!sectionEls[id]) sectionEls[id] = el;
    });
    if (!ids.length) return Promise.resolve();
    return Promise.all(ids.map(function (id) {
      return NS.stories.build(id, storyContext(id))
        .then(function (ds) { return ds ? narrationFor(ds, id) : null; })
        .catch(function () { return null; });
    })).then(function (list) {
      if (version !== state.narrationVersion) return;   /* a chart took over meanwhile */
      var o = root.SoochanaInsight.narrate.buildOverview(list, { geography: config.geography.name, mode: state.mode });
      if (!o) return;
      var vs = voice ? voice.state() : 'idle';
      if (vs === 'speaking' || vs === 'paused') voice.cancel();
      render(o, { announce: true });
      logTranscript(o);
      if (state.voiceEnabled && !state.userPaused) speak(o);
    });
  }

  function logTranscript(n) {
    var existing = transcript.findIndex(function (t) { return t.storyId === n.storyId && t.mode === n.mode && t.cacheKey === n.cacheKey; });
    var entry = { storyId: n.storyId, mode: n.mode, cacheKey: n.cacheKey, title: sectionTitle(n), status: STATUS_LABEL[n.dataStatus] || '',
                  headline: n.headline, narration: n.narration, source: n.sourceLabel };
    if (existing !== -1) transcript[existing] = entry; else transcript.push(entry);
    if (!els.transcript.hidden) renderTranscript();
  }

  function renderTranscript() {
    els.trList.innerHTML = '';
    if (!transcript.length) {
      els.trList.appendChild(h('li', { class: 'sst-empty', text: 'Nothing narrated yet. Scroll to a chart to begin.' }));
      return;
    }
    transcript.slice().reverse().forEach(function (t) {
      var li = h('li');
      li.appendChild(h('div', { class: 'sst-t-meta', text: t.title + ' · ' + t.status + (t.mode === 'data' ? ' · data mode' : '') }));
      li.appendChild(h('div', { class: 'sst-t-head', text: t.headline }));
      li.appendChild(h('p', { text: t.narration }));
      li.appendChild(h('div', { class: 'sst-t-meta', text: 'Source: ' + t.source }));
      if (sectionEls[t.storyId]) li.appendChild(h('button', { type: 'button', 'data-goto': t.storyId, text: 'Go to chart' }));
      els.trList.appendChild(li);
    });
  }

  function openTranscript() {
    renderTranscript();
    els.transcript.hidden = false;
    els.transcriptBtn.setAttribute('aria-expanded', 'true');
    els.trClose.focus();
  }
  function closeTranscript() {
    els.transcript.hidden = true;
    els.transcriptBtn.setAttribute('aria-expanded', 'false');
    if (!els.card.hidden) els.transcriptBtn.focus();
  }

  /* ── controls ────────────────────────────────────────────────────── */
  /* The story the card is showing, which is the one controls act on. */
  function cardStory() { return (current && current.storyId) || state.currentSection; }
  function renarrate(opts) {
    var id = cardStory();
    if (id === OVERVIEW) return narrateOverview(opts);
    if (id) return narrate(id, opts);
  }

  function setCollapsed(v) { state.collapsed = v; savePrefs(); syncControls(); }

  function setClosed(v) {
    state.closed = v;
    savePrefs();
    if (v) {
      if (voice) voice.cancel();
      els.card.hidden = true;
      els.launcher.hidden = false;
      els.launcher.focus();
    } else {
      els.launcher.hidden = true;
      if (state.currentSection) narrate(state.currentSection, { silent: true });
      else narrateOverview();
      els.close.focus();
    }
  }

  function onClick(e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    var mode = btn.getAttribute('data-mode');
    if (mode && mode !== state.mode) {
      state.mode = mode; savePrefs();
      renarrate({ manual: true });
      return;
    }
    var goto = btn.getAttribute('data-goto');
    if (goto) { scrollToStory(goto); return; }
    switch (act) {
      case 'collapse': state.userExpanded = state.collapsed; setCollapsed(!state.collapsed); break;
      case 'close': setClosed(true); break;
      case 'play': {
        var vs = voice.state();
        if (vs === 'speaking') { voice.pause(); state.userPaused = true; }
        else if (vs === 'paused') { voice.resume(); state.userPaused = false; }
        else if (current) { state.userPaused = false; if (!state.voiceEnabled) { state.voiceEnabled = true; savePrefs(); } speak(current); }
        break;
      }
      case 'voice':
        state.voiceEnabled = !state.voiceEnabled;
        savePrefs();
        if (!state.voiceEnabled) voice.cancel();
        else if (current) { state.userPaused = false; speak(current); }
        break;
      case 'replay':
        if (current) {
          els.live.textContent = current.headline + '. ' + current.narration;
          els.text.classList.add('sst-swapping');
          root.setTimeout(function () { els.text.classList.remove('sst-swapping'); }, 200);
          if (state.voiceEnabled) { state.userPaused = false; speak(current); }
        }
        break;
      case 'auto':
        state.autoNarrate = !state.autoNarrate; savePrefs();
        if (state.autoNarrate && state.currentSection && current && current.storyId !== state.currentSection) narrate(state.currentSection);
        break;
      case 'transcript': openTranscript(); break;
      case 'overview': if (state.collapsed) { state.collapsed = false; } narrateOverview({ manual: true }); break;
      case 'pending':
        if (state.currentSection) narrate(state.currentSection, { manual: true });
        break;
    }
    syncControls();
  }

  function onTranscriptClick(e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    if (btn.getAttribute('data-act') === 'transcript-close') { closeTranscript(); return; }
    var id = btn.getAttribute('data-goto');
    if (id && sectionEls[id]) { closeTranscript(); scrollToStory(id); }
  }

  function scrollToStory(id) {
    var el = sectionEls[id] || doc.querySelector('[data-story-id="' + id + '"]');
    if (!el) return;
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  }

  /* ── scroll intelligence ─────────────────────────────────────────── */
  /* Visibility relative to what can be visible: a section taller than
     the screen counts as fully in view when it fills the screen. */
  function visibility(el, rect) {
    rect = rect || el.getBoundingClientRect();
    var vh = root.innerHeight || doc.documentElement.clientHeight;
    var visible = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
    var possible = Math.min(rect.height, vh);
    return possible > 0 ? visible / possible : 0;
  }

  function pick() {
    var best = null, bestScore = 0;
    scores.forEach(function (s, el) { if (s > bestScore) { best = el; bestScore = s; } });
    var initial = firstPick;
    firstPick = false;
    if (!best || bestScore < config.minVisible) { candidate = null; root.clearTimeout(dwellTimer); return; }
    /* A chart already on screen when the page opens is explained at once. */
    if (initial) { activate(best); return; }
    var id = best.getAttribute('data-story-id');
    if (id === state.currentSection && best === sectionEls[id]) { candidate = null; root.clearTimeout(dwellTimer); return; }
    if (best === candidate) return;
    candidate = best;
    root.clearTimeout(dwellTimer);
    dwellTimer = root.setTimeout(confirmCandidate, config.dwellMs);
  }

  function confirmCandidate() {
    var el = candidate;
    candidate = null;
    if (!el || !doc.body.contains(el) || visibility(el) < config.minVisible) return;
    activate(el);
  }

  /* Keep the card off the chart: a fixed side, or for 'auto' the side
     opposite the section being read. Phones always use the bottom sheet. */
  function dock(el) {
    var side = config.dock;
    if (side === 'auto') {
      var r = el.getBoundingClientRect(), vw = root.innerWidth || doc.documentElement.clientWidth;
      side = r.width > vw * 0.7 ? 'left' : (r.left + r.width / 2 < vw / 2 ? 'right' : 'left');
    }
    var right = side === 'right';
    [els.card, els.launcher, els.transcript].forEach(function (n) { n.classList.toggle('sst-dock-right', right); });
  }

  function activate(el) {
    var id = el.getAttribute('data-story-id');
    if (!NS.stories.get(id)) return;
    dock(el);
    var changed = id !== state.currentSection;
    state.currentSection = id;
    sectionEls[id] = el;
    if (!changed) return;
    if (state.closed) return;
    if (config.inline && !state.userExpanded && !state.collapsed) { state.collapsed = true; syncControls(); }
    if (!state.autoNarrate && current) {
      var def = NS.stories.get(id);
      els.pending.textContent = 'Narrate this section: ' + def.title;
      els.pending.hidden = false;
      return;
    }
    narrate(id);
  }

  function observe(el) {
    if (!io || el.__sstObserved) return;
    el.__sstObserved = true;
    io.observe(el);
  }

  function scan(rootEl) {
    (rootEl || doc).querySelectorAll('[data-story-id]').forEach(observe);
  }

  function start() {
    if (started) return;
    started = true;
    var thresholds = [];
    for (var t = 0; t <= 1.0001; t += 0.05) thresholds.push(Math.min(1, +t.toFixed(2)));
    io = new root.IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var sc = e.isIntersecting ? visibility(e.target, e.boundingClientRect) : 0;
        scores.set(e.target, sc);
        if (config.inline && sc >= config.inlineVisible) renderInline(e.target);
      });
      pick();
    }, { threshold: thresholds });
    scan();
    if (root.MutationObserver) {
      new root.MutationObserver(function (muts) {
        muts.forEach(function (m) {
          m.addedNodes.forEach(function (n) {
            if (n.nodeType !== 1) return;
            if (n.hasAttribute('data-story-id')) observe(n);
            scan(n);
          });
        });
      }).observe(doc.body, { childList: true, subtree: true });
    }
    root.addEventListener('pagehide', function () { if (voice) voice.cancel(); });
  }

  /* ── public API ──────────────────────────────────────────────────── */
  function init(cfg) {
    var extra = root.SOOCHANA_STORYTELLER_CONFIG || {};
    config = Object.assign({
      geography: { level: 'state', id: 'Odisha', name: 'Odisha' },
      load: function (url) { return fetch(url).then(function (r) { return r.json(); }); },
      sources: {},
      dwellMs: 1000,
      minVisible: 0.55,
      inline: true,          /* perception panels inside each section */
      inlineVisible: 0.2,    /* pop the panel in once 20% of the section shows */
      dock: 'left',
      llmEndpoint: null,
      pregeneratedUrl: null
    }, extra, cfg || {});
    if (!root.IntersectionObserver || !NS.stories || !root.SoochanaInsight) return api;

    var prefs = readJSON('localStorage', PREFS_KEY, {});
    var narrow = root.matchMedia && root.matchMedia('(max-width: 640px)').matches;
    state.voiceEnabled = !!prefs.voiceEnabled;
    state.autoNarrate = prefs.autoNarrate !== false;
    state.mode = prefs.mode === 'data' ? 'data' : 'story';
    state.collapsed = prefs.collapsed != null ? !!prefs.collapsed : narrow;
    state.closed = !!prefs.closed;
    readJSON('sessionStorage', SEEN_KEY, []).forEach(function (k) { state.previouslyNarratedSections.add(k); });

    voice = new NS.NarrationVoiceService(config.voiceAdapter);
    voice.onChange(function () { if (els.card) syncControls(); });
    service = new NS.NarrationService({ endpoint: config.llmEndpoint, pregeneratedUrl: config.pregeneratedUrl });

    function go() {
      if (!els.card) build();
      if (state.closed) els.launcher.hidden = false;
      else if (doc.querySelector('[data-story-id]')) { showIdle(); narrateOverview(); }
      start();
    }
    if (root.location && root.location.protocol === 'file:' && root.console) {
      console.warn('[storyteller] This page was opened as a file, so the browser blocks the data it needs. ' +
        'Serve the folder instead, e.g. "python -m http.server 8777", and open http://localhost:8777/.');
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', go); else go();
    return api;
  }

  function setState(id, patch) {
    var before = JSON.stringify(state.storyState[id] || {});
    state.storyState[id] = Object.assign({}, state.storyState[id] || {}, patch || {});
    /* Charts may re-render with the same filter (odisha.html redraws the
       pyramid each time it scrolls into view); only a real change counts. */
    if (JSON.stringify(state.storyState[id]) === before) return;
    if (started && config.inline) renderInlineFor(id);
    if (started && cardStory() === id && !state.closed) narrate(id, { manual: true });
  }

  function getState() {
    return {
      currentSection: state.currentSection,
      previouslyNarratedSections: Array.from(state.previouslyNarratedSections),
      userPaused: state.userPaused,
      voiceEnabled: state.voiceEnabled,
      autoNarrate: state.autoNarrate,
      mode: state.mode,
      narrationVersion: state.narrationVersion,
      current: current ? { storyId: current.storyId, headline: current.headline, narration: current.narration, generator: current.generator } : null
    };
  }

  var api = {
    init: init,
    setState: setState,
    getState: getState,
    scan: scan,
    narrate: function (id) { return narrate(id, { manual: true }); },
    /* (re)draw the in-section perception panel for a section element */
    showPerception: function (el) { if (el && config) renderInline(el, { force: true }); },
    registerSource: function (name, data) { if (config) config.sources[name] = data; }
  };
  Object.assign(NS, api);
})(typeof window !== 'undefined' ? window : globalThis);
