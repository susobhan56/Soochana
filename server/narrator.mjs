// server/narrator.mjs
// Turns deterministic evidence into a model-written narration, and checks
// the result with the same validator the browser uses. Shared by the live
// proxy (narrate-proxy.mjs) and the build-time script (pregenerate.mjs).
//
// The model only rewrites; the numbers, years and patterns all come from
// the deterministic engine. Anything that fails validation is discarded
// and the portal keeps its template narration.

import Anthropic from '@anthropic-ai/sdk';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const prompt = require('../storyteller/narration/prompt.js');

export const MODEL = process.env.SOOCHANA_NARRATOR_MODEL || 'claude-opus-5';
export const PROMPT_VERSION = prompt.PROMPT_VERSION;

let client = null;
function getClient() {
  // Credentials come from the environment (ANTHROPIC_API_KEY or an
  // `ant auth login` profile). They never reach the browser.
  if (!client) client = new Anthropic();
  return client;
}

/**
 * @param {object} evidence  narration.evidence from the browser engine
 * @param {'story'|'data'} mode
 * @returns {Promise<{ ok: true, value: object, raw: object } | { ok: false, errors: string[] }>}
 */
export async function generateNarration(evidence, mode = 'story') {
  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: prompt.SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt.buildUserMessage(evidence, mode) }],
    // Short, well-specified rewriting: low effort is plenty.
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: prompt.OUTPUT_SCHEMA }
    },
    // If a safety classifier declines, let the API re-route the request
    // to its recommended fallback model instead of failing outright.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default'
  });

  if (response.stop_reason === 'refusal') {
    return { ok: false, errors: ['model declined: ' + (response.stop_details?.category ?? 'unspecified')] };
  }
  if (response.stop_reason === 'max_tokens') {
    return { ok: false, errors: ['response truncated'] };
  }
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['response was not JSON'] };
  }
  const check = prompt.validateNarration(raw, evidence, mode);
  return check.ok ? { ok: true, value: check.value, raw } : { ok: false, errors: check.errors };
}
