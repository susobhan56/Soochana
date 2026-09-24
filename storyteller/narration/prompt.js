/**
 * storyteller/narration/prompt.js
 * The narrator's system prompt, the output contract, and the validator
 * that guards every model response.
 *
 * Shared by the browser (to validate what the proxy returns) and by the
 * Node proxy / pre-generation script (to build the request). The model is
 * only ever asked to reword evidence the deterministic engine produced;
 * the validator rejects any number, year or causal claim that cannot be
 * traced back to that evidence, and the caller then keeps the
 * deterministic narration.
 */
(function (root) {
  'use strict';
  var NS = root.SoochanaStoryteller = root.SoochanaStoryteller || {};

  var PROMPT_VERSION = 'narrator-v1';

  var SYSTEM_PROMPT = [
    'You are the Soochana Visual Storyteller.',
    '',
    'Your job is to explain what a chart about Odisha is revealing, not merely describe what the chart contains.',
    '',
    'You receive structured statistical evidence produced by a deterministic analysis engine, including a deterministic draft narration. Rewrite that draft into clear, natural, calm prose for a general public audience interested in Odisha’s population and human-development transition.',
    '',
    'Never invent data, sources, years, trends, projections or district values.',
    'Use only numbers and years that appear in the evidence. Prefer fewer numbers.',
    'Never infer causality unless the evidence explicitly supports it. Do not use words such as "because", "due to", "driven by" or "as a result of".',
    'Never confuse projected values with observed values: when a value or period is projected, say so ("is projected to", "is expected to").',
    'When the evidence says survey_rounds is true, describe the change as a comparison between survey rounds, not an annual trend.',
    'Do not overstate small changes. Do not label a district or value as good or bad, best or worst.',
    'Do not give policy recommendations.',
    '',
    'Prioritise, in order: the strongest visible trend; the most important turning point or crossing; meaningful relationships between series; comparisons; what the pattern helps the reader understand.',
    'Keep the distinction between a level and its rate of change (a population can grow while its growth rate falls), and between percentage points and per cent.',
    '',
    'Use plain English and short sentences. Avoid statistical jargon. Do not start with "This graph shows" or "This chart shows". Do not read out every number.',
    'Length: the narration is 1–3 sentences and 35–70 words in story mode; up to 4 sentences and 95 words in data mode, where precise values and dates are welcome.',
    'If the evidence confidence is medium or low, use appropriately cautious language.',
    '',
    'Return only the JSON object described by the output schema. Plain text only: no HTML, Markdown or links.'
  ].join('\n');

  var OUTPUT_SCHEMA = {
    type: 'object',
    properties: {
      headline: { type: 'string', description: 'Five to nine words naming the main pattern. No trailing full stop.' },
      narration: { type: 'string', description: 'The narration text.' },
      importance: { type: 'string', description: 'One sentence on why the pattern is analytically meaningful, without causal claims.' },
      key_points: { type: 'array', items: { type: 'string' }, description: 'Two to four short phrases.' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
    },
    required: ['headline', 'narration', 'importance', 'key_points', 'confidence'],
    additionalProperties: false
  };

  function buildUserMessage(evidence, mode) {
    var ev = Object.assign({}, evidence, { mode: mode === 'data' ? 'data' : 'story' });
    return 'Narration mode: ' + ev.mode + '\n\nEvidence (JSON):\n' + JSON.stringify(ev, null, 2);
  }

  /* ── Validation ──────────────────────────────────────────────────── */

  function collectNumbers(obj, out) {
    out = out || [];
    if (obj == null) return out;
    if (typeof obj === 'number' && isFinite(obj)) { out.push(obj); return out; }
    if (typeof obj === 'string') {
      (obj.match(/\d[\d,]*(\.\d+)?/g) || []).forEach(function (t) {
        var n = parseFloat(t.replace(/,/g, ''));
        if (isFinite(n)) out.push(n);
      });
      return out;
    }
    if (Array.isArray(obj)) { obj.forEach(function (v) { collectNumbers(v, out); }); return out; }
    if (typeof obj === 'object') Object.keys(obj).forEach(function (k) { collectNumbers(obj[k], out); });
    return out;
  }

  /* Every way a number from the evidence could legitimately be written:
     rounded, and rescaled to lakh, crore or million for head-counts. */
  function allowedValues(evidence) {
    var base = collectNumbers(evidence);
    var out = [];
    base.forEach(function (v) {
      var a = Math.abs(v);
      out.push(a);
      if (a >= 1e5) out.push(a / 1e5, a / 1e6, a / 1e7);
    });
    /* Constants a careful narration may use without them being data. */
    /* Age-group bounds, replacement fertility and "per 1,000" bases only;
       small integers are deliberately not allowed, so "fell by 5 points"
       cannot slip through unless 5 is really in the evidence. */
    [1000, 100000, 2.1, 0, 14, 15, 59, 60, 5, 100].forEach(function (c) { out.push(c); });
    return out;
  }

  function isYear(n, token) { return /^\d{4}$/.test(token) && n >= 1800 && n <= 2100; }

  function numberMatches(n, token, allowed, years) {
    if (isYear(n, token)) {
      return years.some(function (y) { return Math.abs(y - n) <= 1; });
    }
    /* A number passes only if some evidence value, rounded to the
       precision the number is written at, equals it: 11.23 may appear as
       11.2 or 11, but 0.95 cannot pass on the strength of a nearby 0.93. */
    var dot = token.indexOf('.');
    var dp = dot === -1 ? 0 : token.length - dot - 1;
    var f = Math.pow(10, dp);
    return allowed.some(function (a) { return Math.abs(Math.round(a * f) / f - n) < 1e-9; });
  }

  var CAUSAL = /\b(because|due to|caused by|as a result of|driven by|thanks to|owing to|results? in|resulted in|leads? to|led to)\b/i;
  var MARKUP = /<[^>]+>|```|https?:\/\/|\*\*|__/;

  function validateNarration(output, evidence, mode) {
    var errors = [];
    if (!output || typeof output !== 'object') return { ok: false, errors: ['not an object'] };
    var headline = typeof output.headline === 'string' ? output.headline.trim() : '';
    var narration = typeof output.narration === 'string' ? output.narration.trim() : '';
    var importance = typeof output.importance === 'string' ? output.importance.trim() : '';
    var keyPoints = Array.isArray(output.key_points) ? output.key_points.filter(function (k) { return typeof k === 'string'; }) : [];

    if (!headline || headline.length > 90) errors.push('headline missing or too long');
    var wc = narration.split(/\s+/).filter(Boolean).length;
    var maxWords = mode === 'data' ? 120 : 90;
    if (wc < 10 || wc > maxWords) errors.push('narration length ' + wc + ' words');
    if (/^this (graph|chart) shows/i.test(narration)) errors.push('forbidden opening');

    var texts = [headline, narration, importance].concat(keyPoints);
    texts.forEach(function (t) {
      if (MARKUP.test(t)) errors.push('markup or link in output');
      if (CAUSAL.test(t)) errors.push('causal language: "' + (t.match(CAUSAL) || [''])[0] + '"');
    });

    var allowed = allowedValues(evidence);
    var years = collectNumbers(evidence).filter(function (n) { return n >= 1800 && n <= 2100 && Math.round(n) === n; });
    texts.forEach(function (t) {
      (t.match(/\d[\d,]*(\.\d+)?/g) || []).forEach(function (tok) {
        var clean = tok.replace(/,/g, '');
        var n = parseFloat(clean);
        if (!numberMatches(n, clean, allowed, years)) errors.push('number not in evidence: ' + tok);
      });
    });

    /* A projected horizon must be named as a projection. */
    var projectedEnds = (evidence.series || []).filter(function (s) { return s.end && s.end.status === 'projected'; })
      .map(function (s) { return String(s.end.period); });
    if (evidence.pyramid && evidence.pyramid.last && evidence.pyramid.last.status === 'projected') projectedEnds.push(String(evidence.pyramid.last.year));
    var mentionsProjectedYear = projectedEnds.some(function (y) { return narration.indexOf(y) !== -1; });
    if (mentionsProjectedYear && !/project|expect|forecast|estimat/i.test(narration)) {
      errors.push('projected period described without projection language');
    }

    if (errors.length) return { ok: false, errors: errors };
    return {
      ok: true,
      value: {
        headline: headline.replace(/\.$/, ''),
        narration: narration,
        importance: importance || null,
        keyPoints: keyPoints.slice(0, 4),
        confidence: ['high', 'medium', 'low'].indexOf(output.confidence) !== -1 ? output.confidence : null
      }
    };
  }

  NS.prompt = {
    PROMPT_VERSION: PROMPT_VERSION,
    SYSTEM_PROMPT: SYSTEM_PROMPT,
    OUTPUT_SCHEMA: OUTPUT_SCHEMA,
    buildUserMessage: buildUserMessage,
    validateNarration: validateNarration
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = NS.prompt;
})(typeof window !== 'undefined' ? window : globalThis);
