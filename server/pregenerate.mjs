// server/pregenerate.mjs
// Build-time narration for the major charts, so a static host (GitHub
// Pages) can serve model-written narration with no live API call and no
// key in the browser.
//
//   cd server && npm install
//   node pregenerate.mjs --dry-run                    # list what would be generated
//   node pregenerate.mjs                              # state + all 30 districts, both modes
//   node pregenerate.mjs --stories district-tfr --districts Koraput,Khordha --modes story
//
// Output: data/narration/narrations.json  { narrations: { <cacheKey>: <model JSON> } }
// Enable it on the pages with:
//   window.SOOCHANA_STORYTELLER_CONFIG = { pregeneratedUrl: 'data/narration/narrations.json' };
//
// Each entry is keyed by the deterministic cache key, which embeds a hash
// of the data. If the data change, the key changes, the old entry is
// ignored and the page falls back to the template narration until this
// script is run again. Entries are re-validated in the browser too.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const require = createRequire(import.meta.url);

for (const f of ['stats', 'trend', 'compare', 'pyramid', 'language', 'rules', 'narrate']) {
  require(path.join(root, 'storyteller/engine', f + '.js'));
}
require(path.join(root, 'storyteller/stories/districts.js'));
require(path.join(root, 'storyteller/stories/registry.js'));
const Insight = globalThis.SoochanaInsight;
const Stories = globalThis.SoochanaStoryteller.stories;

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? null : (process.argv[i + 1] || '');
}
const dryRun = process.argv.includes('--dry-run');
const onlyStories = arg('stories')?.split(',');
const onlyDistricts = arg('districts')?.split(',');
const modes = (arg('modes') || 'story,data').split(',');

const load = async p => JSON.parse(await fs.readFile(path.join(root, p), 'utf8'));

/* odisha.html keeps its chart data inline; read that same object. */
async function odishaSlideData() {
  const html = await fs.readFile(path.join(root, 'odisha.html'), 'utf8');
  const m = html.match(/const odishaSlideData = (\{[\s\S]*?\n {4}\});/);
  if (!m) throw new Error('could not find odishaSlideData in odisha.html');
  return Function('"use strict"; return (' + m[1] + ');')();
}

async function jobs() {
  const out = [];
  const sources = { odishaSlideData: await odishaSlideData() };
  const state = { level: 'state', id: 'Odisha', name: 'Odisha' };
  const districts = Object.keys(await load(Stories.PATHS.districtPopulation))
    .filter(d => !onlyDistricts || onlyDistricts.includes(d));

  for (const id of Stories.list()) {
    if (onlyStories && !onlyStories.includes(id)) continue;
    const isState = id.startsWith('state-');
    const geos = isState ? [state] : districts.map(d => ({ level: 'district', id: d, name: d }));
    /* The state pyramid is narrated per selected year. */
    const filters = id === 'state-pyramid' ? [{}, { year: '2011' }, { year: '2026' }, { year: '2036' }] : [{}];
    for (const geography of geos) {
      for (const st of filters) {
        const ds = await Stories.build(id, { geography, load, sources, state: st });
        if (!ds) continue;
        for (const mode of modes) out.push(Insight.narrate.buildNarration(ds, { mode, focusYear: st.year }));
      }
    }
  }
  return out;
}

async function main() {
  const list = await jobs();
  console.log(`${list.length} narrations to generate`);
  if (dryRun) { list.slice(0, 20).forEach(n => console.log(' ', n.cacheKey)); return; }

  const { generateNarration, MODEL, PROMPT_VERSION } = await import('./narrator.mjs');
  const outFile = path.join(root, 'data/narration/narrations.json');
  let existing = {};
  try { existing = JSON.parse(await fs.readFile(outFile, 'utf8')).narrations || {}; } catch {}

  const narrations = {};
  let done = 0, kept = 0, failed = 0;
  const queue = list.slice();
  async function worker() {
    while (queue.length) {
      const n = queue.shift();
      if (existing[n.cacheKey]) { narrations[n.cacheKey] = existing[n.cacheKey]; kept++; continue; }
      try {
        const r = await generateNarration(n.evidence, n.mode);
        if (r.ok) { narrations[n.cacheKey] = r.raw; done++; }
        else { failed++; console.warn('  rejected', n.cacheKey, r.errors.join('; ')); }
      } catch (e) {
        failed++; console.warn('  error', n.cacheKey, e?.status ?? '', e?.message ?? e);
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);

  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, JSON.stringify({
    generatedAt: new Date().toISOString(), model: MODEL, promptVersion: PROMPT_VERSION, narrations
  }, null, 1));
  console.log(`wrote ${outFile}: ${done} new, ${kept} reused, ${failed} rejected (those keep the template narration)`);
}

main().catch(e => { console.error(e); process.exit(1); });
