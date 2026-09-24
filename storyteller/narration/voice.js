/**
 * storyteller/narration/voice.js
 * NarrationVoiceService — text-to-speech behind a replaceable adapter.
 *
 * Any adapter implementing this shape can be swapped in (a cloud TTS
 * provider, for instance) without touching the engine or the UI:
 *
 *   { isSupported(): boolean,
 *     speak(text, opts): Promise<void>,   // resolves when finished or stopped
 *     pause(), resume(), stop(),
 *     listVoices?(): Array<{ name, lang }> }
 *
 * The browser adapter speaks sentence by sentence. Chrome silently drops
 * utterances that run past ~15 seconds, and short utterances also make
 * pause/resume and cancellation more reliable across engines.
 */
(function (root) {
  'use strict';
  var NS = root.SoochanaStoryteller = root.SoochanaStoryteller || {};

  function splitSentences(text) {
    return String(text || '').match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [];
  }

  function BrowserSpeechAdapter(options) {
    options = options || {};
    var synth = root.speechSynthesis;
    var self = this;
    var token = 0;
    this.rate = options.rate || 0.98;
    this.lang = options.lang || 'en-IN';
    this.voiceName = options.voiceName || null;

    this.isSupported = function () {
      return !!(synth && root.SpeechSynthesisUtterance);
    };

    this.listVoices = function () {
      return synth ? synth.getVoices().map(function (v) { return { name: v.name, lang: v.lang }; }) : [];
    };

    /* Prefer the configured voice, then an Indian-English voice, then any
       English voice. Voices load asynchronously in Chrome, so this is
       resolved at speak time rather than once at start-up. */
    function pickVoice() {
      if (!synth) return null;
      var voices = synth.getVoices();
      if (self.voiceName) {
        var named = voices.filter(function (v) { return v.name === self.voiceName; })[0];
        if (named) return named;
      }
      return voices.filter(function (v) { return v.lang === self.lang; })[0] ||
        voices.filter(function (v) { return /^en[-_]IN/i.test(v.lang); })[0] ||
        voices.filter(function (v) { return /^en/i.test(v.lang) && v.default; })[0] ||
        voices.filter(function (v) { return /^en/i.test(v.lang); })[0] || null;
    }

    this.speak = function (text, opts) {
      opts = opts || {};
      if (!this.isSupported()) return Promise.reject(new Error('speech not supported'));
      synth.cancel();
      var my = ++token;
      var parts = splitSentences(text);
      var voice = pickVoice();
      return new Promise(function (resolve, reject) {
        var i = 0;
        function next() {
          if (my !== token) return resolve();       /* stopped or superseded */
          if (i >= parts.length) return resolve();
          var u = new root.SpeechSynthesisUtterance(parts[i++].trim());
          u.lang = voice ? voice.lang : self.lang;
          if (voice) u.voice = voice;
          u.rate = opts.rate || self.rate;
          u.onend = next;
          u.onerror = function (e) {
            /* "interrupted"/"canceled" are ours; "not-allowed" is the
               browser's autoplay policy and needs a user gesture. */
            if (e.error === 'interrupted' || e.error === 'canceled') return resolve();
            reject(e);
          };
          synth.speak(u);
        }
        next();
      });
    };

    this.pause = function () { if (synth) synth.pause(); };
    this.resume = function () { if (synth) synth.resume(); };
    this.stop = function () { token++; if (synth) synth.cancel(); };
  }

  /* The service the UI talks to. It tracks state and emits changes so
     the play/pause button always reflects what is actually happening. */
  function NarrationVoiceService(adapter) {
    var listeners = [];
    var state = 'idle'; /* idle | speaking | paused | blocked | unsupported */
    var current = null;
    this.adapter = adapter || new BrowserSpeechAdapter();
    var a = this.adapter;
    if (!a.isSupported()) state = 'unsupported';

    function set(s) { state = s; listeners.forEach(function (fn) { fn(s); }); }

    this.onChange = function (fn) { listeners.push(fn); };
    this.state = function () { return state; };
    this.isSupported = function () { return a.isSupported(); };

    this.speak = function (text, opts) {
      if (!a.isSupported()) { set('unsupported'); return Promise.resolve(); }
      current = text;
      set('speaking');
      var me = text;
      return a.speak(text, opts).then(function () {
        if (current === me && state !== 'paused') set('idle');
      }, function (err) {
        set(err && err.error === 'not-allowed' ? 'blocked' : 'idle');
      });
    };
    this.pause = function () { if (state === 'speaking') { a.pause(); set('paused'); } };
    this.resume = function () { if (state === 'paused') { a.resume(); set('speaking'); } };
    this.cancel = function () { current = null; a.stop(); if (state !== 'unsupported') set('idle'); };
    this.setRate = function (r) { a.rate = r; };
    this.setLanguage = function (lang) { a.lang = lang; };
    this.setVoice = function (name) { a.voiceName = name; };
    this.listVoices = function () { return a.listVoices ? a.listVoices() : []; };
  }

  NS.BrowserSpeechAdapter = BrowserSpeechAdapter;
  NS.NarrationVoiceService = NarrationVoiceService;
  NS.splitSentences = splitSentences;
  if (typeof module !== 'undefined' && module.exports) module.exports = { BrowserSpeechAdapter: BrowserSpeechAdapter, NarrationVoiceService: NarrationVoiceService, splitSentences: splitSentences };
})(typeof window !== 'undefined' ? window : globalThis);
