// server/narrate-proxy.mjs
// Minimal HTTP proxy between the portal and the Claude API.
//
//   POST /api/narrate   { cacheKey, mode, evidence }  →  narration JSON
//   GET  /health
//
// Run:   cd server && npm install && npm start
// Env:   ANTHROPIC_API_KEY          (or an `ant auth login` profile)
//        PORT                       default 8787
//        ALLOWED_ORIGINS            comma-separated, e.g. https://soochana.example.org
//        SOOCHANA_NARRATOR_MODEL    default claude-opus-5
//        NARRATE_HOURLY_CAP         uncached API calls allowed per hour, default 120
//
// The portal's Content-Security-Policy (the <meta> at the top of each page)
// must list the proxy's address under connect-src, or browsers block the call.
//
// Then point the portal at it before the storyteller scripts load:
//   <script>window.SOOCHANA_STORYTELLER_CONFIG = { llmEndpoint: 'https://…/api/narrate' };</script>
//
// The proxy holds the API key, caches every validated answer, and
// rate-limits by client address. It stores nothing about visitors.

import http from 'node:http';
import { generateNarration, MODEL, PROMPT_VERSION } from './narrator.mjs';

const PORT = Number(process.env.PORT || 8787);
const ALLOWED = (process.env.ALLOWED_ORIGINS || 'http://localhost:8777')
  .split(',').map(s => s.trim()).filter(Boolean);
const MAX_BODY = 64 * 1024;
const CACHE_MAX = 1000;
const RATE = { windowMs: 60_000, max: 30 };
const HOURLY_CAP = Number(process.env.NARRATE_HOURLY_CAP || 120);

const cache = new Map();      // cacheKey|mode|promptVersion → validated narration
const inflight = new Map();   // same key → pending promise (request de-duplication)
const hits = new Map();       // client → { count, reset }

function remember(key, value) {
  cache.set(key, value);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

function limited(ip) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now > h.reset) { hits.set(ip, { count: 1, reset: now + RATE.windowMs }); return false; }
  h.count += 1;
  return h.count > RATE.max;
}

// The Origin header can be forged outside a browser, so the API spend also has
// a ceiling for the whole server: at most HOURLY_CAP uncached calls an hour.
let budget = { count: 0, reset: 0 };
function overBudget() {
  const now = Date.now();
  if (now > budget.reset) budget = { count: 0, reset: now + 3_600_000 };
  budget.count += 1;
  return budget.count > HOURLY_CAP;
}

function send(res, status, body, origin) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (origin && ALLOWED.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('body too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;

  if (req.method === 'OPTIONS') {
    if (!origin || !ALLOWED.includes(origin)) { res.writeHead(403); res.end(); return; }
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    send(res, 200, { ok: true, model: MODEL, promptVersion: PROMPT_VERSION, cached: cache.size }, origin);
    return;
  }

  if (req.method !== 'POST' || req.url !== '/api/narrate') { send(res, 404, { error: 'not found' }, origin); return; }
  // Browsers always send Origin on a cross-site POST; a request without one is a script, not the portal.
  if (!origin || !ALLOWED.includes(origin)) { send(res, 403, { error: 'origin not allowed' }); return; }

  const ip = req.socket.remoteAddress || 'unknown';
  if (limited(ip)) { send(res, 429, { error: 'rate limited' }, origin); return; }

  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch (e) {
    send(res, e.status || 400, { error: e.status ? e.message : 'invalid JSON' }, origin);
    return;
  }
  const { cacheKey, mode, evidence } = payload || {};
  if (typeof cacheKey !== 'string' || cacheKey.length > 300 || !evidence || typeof evidence !== 'object' || !Array.isArray(evidence.series)) {
    send(res, 400, { error: 'expected { cacheKey, mode, evidence }' }, origin);
    return;
  }
  const m = mode === 'data' ? 'data' : 'story';
  const key = `${cacheKey}|${m}|${PROMPT_VERSION}`;

  if (cache.has(key)) { send(res, 200, cache.get(key), origin); return; }
  if (!inflight.has(key) && overBudget()) { send(res, 503, { error: 'narration unavailable' }, origin); return; }

  try {
    if (!inflight.has(key)) inflight.set(key, generateNarration(evidence, m).finally(() => inflight.delete(key)));
    const result = await inflight.get(key);
    if (!result.ok) {
      // 422: the portal keeps its deterministic narration.
      send(res, 422, { error: 'narration rejected', reasons: result.errors }, origin);
      return;
    }
    remember(key, result.raw);
    send(res, 200, result.raw, origin);
  } catch (err) {
    const status = err?.status === 429 ? 503 : 502;
    console.error('[narrate] upstream error', err?.status ?? '', err?.message ?? err);
    send(res, status, { error: 'narration unavailable' }, origin);
  }
});

server.listen(PORT, () => {
  console.log(`Soochana narrator proxy on http://localhost:${PORT} (model ${MODEL}; origins ${ALLOWED.join(', ')})`);
});
