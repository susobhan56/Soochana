/**
 * storyteller/narration/narration-service.js
 * Resolves the narration for a story: deterministic first (instant),
 * then — only if configured — a language-model rewrite, which is used
 * only when it passes validation.
 *
 * Sources of a refined narration, in order:
 *   1. in-memory cache (this page view)
 *   2. localStorage cache (keyed by the deterministic cache key, which
 *      embeds a hash of the data, so a data change invalidates it)
 *   3. a pre-generated file, e.g. data/narration/narrations.json
 *      (built by server/pregenerate.mjs; opt-in via config.pregeneratedUrl)
 *   4. a live endpoint     window.SOOCHANA_STORYTELLER_CONFIG.llmEndpoint
 *      (server/narrate-proxy.mjs; optional; the API key stays server-side)
 *
 * If none is available — or anything fails, times out or is rejected by
 * the validator — the deterministic narration stands. The page never
 * waits on, or breaks because of, the AI layer.
 */
(function (root) {
  'use strict';
  var NS = root.SoochanaStoryteller = root.SoochanaStoryteller || {};
  var STORE = 'soochana-narration-cache-v1';

  function NarrationService(options) {
    options = options || {};
    var endpoint = options.endpoint || null;
    var pregenUrl = options.pregeneratedUrl || null;
    var timeoutMs = options.timeoutMs || 8000;
    var memory = new Map();
    var inflight = new Map();
    var pregen = null;
    var controller = null;

    function readStore() {
      try { return JSON.parse(root.localStorage.getItem(STORE) || '{}'); } catch (e) { return {}; }
    }
    function writeStore(key, value) {
      try {
        var all = readStore();
        all[key] = value;
        var keys = Object.keys(all);
        if (keys.length > 120) keys.slice(0, keys.length - 120).forEach(function (k) { delete all[k]; });
        root.localStorage.setItem(STORE, JSON.stringify(all));
      } catch (e) { /* storage full or blocked: memory cache still works */ }
    }

    function loadPregenerated() {
      if (pregen) return pregen;
      if (!pregenUrl || typeof fetch !== 'function') return (pregen = Promise.resolve({}));
      pregen = fetch(pregenUrl, { cache: 'force-cache' })
        .then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (j) { return (j && j.narrations) || {}; })
        .catch(function () { return {}; });
      return pregen;
    }

    function accept(det, raw, via) {
      var check = NS.prompt.validateNarration(raw, det.evidence, det.mode);
      if (!check.ok) {
        if (root.console) console.info('[storyteller] model narration rejected (' + via + '):', check.errors.join('; '));
        return null;
      }
      var v = check.value;
      return Object.assign({}, det, {
        headline: v.headline,
        narration: v.narration,
        importance: v.importance || det.importance,
        keyPoints: v.keyPoints.length ? v.keyPoints : det.keyPoints,
        generator: via
      });
    }

    /* Cancel whatever refinement is running — called when the reader
       moves on, so a slow response for an old chart never lands. */
    this.cancel = function () {
      if (controller) controller.abort();
      controller = null;
    };

    this.isEnabled = function () { return !!endpoint || !!pregenUrl; };

    this.refine = function (det) {
      var key = det.cacheKey;
      if (memory.has(key)) return Promise.resolve(memory.get(key));
      var stored = readStore()[key];
      if (stored) {
        var s = accept(det, stored.raw, stored.via);
        memory.set(key, s);
        return Promise.resolve(s);
      }
      if (inflight.has(key)) return inflight.get(key);

      var self = this;
      var p = loadPregenerated().then(function (all) {
        var hit = all[key];
        if (hit) {
          var acc = accept(det, hit, 'pregenerated');
          if (acc) { memory.set(key, acc); return acc; }
        }
        if (!endpoint || typeof fetch !== 'function') return null;
        self.cancel();
        controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timer = setTimeout(function () { if (controller) controller.abort(); }, timeoutMs);
        return fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cacheKey: key, mode: det.mode, evidence: det.evidence }),
          signal: controller ? controller.signal : undefined
        }).then(function (r) {
          clearTimeout(timer);
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        }).then(function (raw) {
          var acc = accept(det, raw, 'llm');
          if (acc) { memory.set(key, acc); writeStore(key, { raw: raw, via: 'llm' }); }
          return acc;
        }).catch(function () { clearTimeout(timer); return null; });
      }).finally(function () { inflight.delete(key); });
      inflight.set(key, p);
      return p;
    };
  }

  NS.NarrationService = NarrationService;
})(typeof window !== 'undefined' ? window : globalThis);
