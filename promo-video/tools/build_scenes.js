/* Builds src/data/scenes.json: every figure the promo's scenes show, read
   from the portal's own files (one folder up), so nothing is typed in by hand.
   Run: node tools/build_scenes.js */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const r1 = (v) => Math.round(v * 10) / 10;

/* Largest-remainder rounding, so shares of 100 people add up to exactly 100. */
const to100 = (vals) => {
  const sum = vals.reduce((a, b) => a + b, 0);
  const raw = vals.map((v) => (v / sum) * 100);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => {
    if (left-- > 0) out[i]++;
  });
  return out;
};

const state = read('datasets/state_demographics.json');
const distPop = read('datasets/district_population_trends.json');
const fert = read('datasets/district_fertility_trends.json');
const pyr = read('datasets/district_age_pyramids.json');
const learn = read('learn/data/districts.json');

/* Population, 1901-2036: the first row for each year is the total series. */
const seen = new Set();
const popLine = state.population_trends
  .filter((r) => r.total && !seen.has(r.year) && seen.add(r.year))
  .map((r) => ({year: r.year, pop: r.total, projected: r.year > 2011}));

/* Children / working age / elders per 100, from the state pyramids. */
const ageSplit = (yr) => {
  const rows = state.pyramids[yr];
  const lo = (a) => parseInt(a, 10);
  const sum = (f) => rows.filter((r) => f(lo(r.age))).reduce((s, r) => s + r.total, 0);
  return {
    year: Number(yr),
    shares: to100([sum((a) => a < 15), sum((a) => a >= 15 && a < 60), sum((a) => a >= 60)]),
    elders: sum((a) => a >= 60),
  };
};

/* Rural/urban and Scheduled Tribe shares, weighted by 2011 population. */
const ALIAS = {Jajpur: 'Jajapur'};
let pop11 = 0, urb = 0, st = 0;
const missing = [];
learn.districts.forEach((d) => {
  const p = (distPop[d.name] || distPop[ALIAS[d.name]] || {})['2011'];
  if (!p) return missing.push(d.name);
  pop11 += p.total;
  urb += (p.total * d.f.urban_pct) / 100;
  st += (p.total * d.f.tribal_pct) / 100;
});
const [rural, urban] = to100([pop11 - urb, urb]);
const tribal = Math.round((st / pop11) * 100);

/* District fertility, 2020 and 2036. */
const tfr = Object.entries(fert)
  .map(([name, v]) => ({name, y2020: v['2020'], y2036: v['2036']}))
  .sort((a, b) => b.y2020 - a.y2020);

/* Pyramid duel: each age group's share of the district, by sex. */
const duelOf = (name) =>
  Object.fromEntries(
    ['2011', '2036'].map((yr) => {
      const rows = pyr[name][yr];
      const tot = rows.reduce((s, r) => s + r.total, 0);
      return [yr, rows.map((r) => ({age: r.age, m: r1((r.male / tot) * 1000) / 10, f: r1((r.female / tot) * 1000) / 10}))];
    }),
  );
const elderShare = (name, yr) => {
  const rows = pyr[name][yr];
  const tot = rows.reduce((s, r) => s + r.total, 0);
  return r1((rows.filter((r) => parseInt(r.age, 10) >= 60).reduce((s, r) => s + r.total, 0) / tot) * 100);
};

/* NFHS-5 -> NFHS-6: the indicators with a clear better direction, as on district-health.html. */
const html = fs.readFileSync(path.join(ROOT, 'district-health.html'), 'utf8');
const line = html.split('\n').find((l) => l.startsWith('const DATA = '));
const NF = JSON.parse(line.replace(/^const DATA = /, '').replace(/;\s*$/, ''));
const cls = (i) => {
  const g = (i.t6 - i.t5) * i.pol;
  return g >= 1 ? 'up' : g <= -1 ? 'down' : 'flat';
};
const health = NF.inds
  .filter((i) => i.pol && i.t6 != null && i.t5 != null)
  .map((i) => ({n: i.n, name: i.name, sec: i.sec, t5: i.t5, t6: i.t6, g: r1((i.t6 - i.t5) * i.pol), c: cls(i)}));
const tally = {up: 0, down: 0, flat: 0};
health.forEach((h) => tally[h.c]++);

/* Assistant demo: infant mortality in Koraput, NFHS-4 -> NFHS-5. */
const kor = learn.districts.find((d) => d.name === 'Koraput');
const puri = learn.districts.find((d) => d.name === 'Puri');

/* Learn demo: women's literacy against child marriage across the districts, with a least-squares fit. */
const pts = learn.districts
  .filter((d) => d.f.female_lit != null && d.nfhs5.child_marriage != null)
  .map((d) => ({name: d.name, x: d.f.female_lit, y: d.nfhs5.child_marriage}));
const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
const sxy = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
const sxx = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
const syy = pts.reduce((s, p) => s + (p.y - my) ** 2, 0);
const slope = sxy / sxx;

/* Tectonics story 1, read from its own story file. */
const s1 = fs.readFileSync(path.join(ROOT, 'tectonics-s1.js'), 'utf8');
const pick = (key) => {
  const m = s1.match(new RegExp(key + ":\\s*\\{[^}]*?was:\\s*([0-9.]+),\\s*now:\\s*([0-9.]+)"));
  return {was: Number(m[1]), now: Number(m[2])};
};

/* Headline state figures, as the home page tiles show them (data/key_stats.js). */
const vm = require('vm');
const ctx = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data', 'key_stats.js'), 'utf8'), ctx);
const tiles = ctx.window.SOOCHANA_KEY_STATS.groups.flatMap((g) => g.tiles);
const tile = (label) => tiles.find((t) => t.label === label);
const keyStats = {
  tfr: {v: tile('Total Fertility Rate (TFR)').value, src: tile('Total Fertility Rate (TFR)').source},
  life: {v: tile('Life Expectancy').value, src: tile('Life Expectancy').source},
};

/* The bridge scene's wall of raw numbers: real district values, one row per district. */
const COLS = [
  ['literacy', (d) => d.f.literacy],
  ['urban', (d) => d.f.urban_pct],
  ['tribal', (d) => d.f.tribal_pct],
  ['sex ratio', (d) => d.f.sex_ratio],
  ['TFR', (d) => d.f.tfr_2020],
  ['60+ ’36', (d) => d.f.elderly_pct_2036],
  ['IMR', (d) => d.nfhs5.imr],
  ['insured', (d) => d.nfhs5.insurance],
  ['vaccin.', (d) => d.nfhs5.full_vax],
];
const numberWall = {
  cols: COLS.map((c) => c[0]),
  rows: learn.districts.slice(0, 16).map((d) => ({
    name: d.name,
    vals: COLS.map(([c, g]) => {
      const v = g(d);
      return v == null ? '–' : c === 'TFR' ? v.toFixed(2) : v > 100 ? String(Math.round(v)) : v.toFixed(1);
    }),
  })),
};

/* Themes panorama: one real figure per stop. */
const ind = (n) => {
  const i = NF.inds.find((x) => x.n === n);
  return {was: i.t5, now: i.t6};
};
const s5 = fs.readFileSync(path.join(ROOT, 'tectonics-s5.js'), 'utf8');
const s5row = (name) => {
  const m = s5.match(new RegExp("name: '" + name + "'[^}]*?was: ([0-9.]+), now: ([0-9.]+)"));
  return {was: Number(m[1]), now: Number(m[2])};
};
const themes = {
  rural: rural,
  womenSchool: ind(12),
  hospitalBirths: ind(36),
  vaccinated: ind(46),
  womenBank: ind(93),
  womenPhone: ind(94),
  returning: s5row('Returning Odias, all in-migrants'),
  salaried: s5row('Male out-migrants in salaried jobs'),
  elders: [Math.round(ageSplit('2021').elders / 1e5), Math.round(ageSplit('2036').elders / 1e5)],
};

const out = {
  themes,
  keyStats,
  numberWall,
  popLine,
  ages: [ageSplit('2021'), ageSplit('2036')],
  rural, urban, tribal,
  tfr,
  tfrAbove2020: tfr.filter((d) => d.y2020 > 2.1).length,
  tfrAbove2036: tfr.filter((d) => d.y2036 > 2.1).length,
  duel: {
    Khordha: {pyr: duelOf('Khordha'), elders2036: elderShare('Khordha', '2036'), tfr2020: fert.Khordha['2020']},
    Nabarangpur: {pyr: duelOf('Nabarangpur'), elders2036: elderShare('Nabarangpur', '2036'), tfr2020: fert.Nabarangpur['2020']},
  },
  health, tally, nIndicators: NF.inds.length,
  koraputImr: {was: kor.nfhs4.imr, now: kor.nfhs5.imr},
  puriImr: puri.nfhs5.imr,
  learnFit: {pts, slope, intercept: my - slope * mx, r: Math.round((sxy / Math.sqrt(sxx * syy)) * 100) / 100},
  tectonics: {online: pick('online'), methods: pick('methods')},
  repo: {
    reports: read('data/reports.json').reports.length,
    datasets: read('data/datasets.json').datasets.length,
    themes: read('data/themes.json').themes.length,
    dossierModules: read('datasets/state_details.json').Odisha.slides_detail.length,
    exploreScreens: (fs.readFileSync(path.join(ROOT, 'explore.html'), 'utf8').match(/<section class="ex-scene/g) || []).length,
  },
};
fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'scenes.json'), JSON.stringify(out));
if (missing.length) console.warn('no 2011 population for', missing.join(', '));
const {health: _h, tfr: _t, duel: _d, popLine: _p, ...summary} = out;
console.log(JSON.stringify(summary, null, 1));
console.log('tfr top/bottom', tfr[0], tfr[tfr.length - 1], 'health n', health.length);
console.log('duel elders 2036', out.duel.Khordha.elders2036, out.duel.Nabarangpur.elders2036);
console.log('pop', popLine.map((p) => p.year + ':' + (p.pop / 1e7).toFixed(2)).join(' '));
