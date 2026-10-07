/**
 * chatbot-engine.js
 * Question answering for the Soochana Assistant. It reads the portal's own
 * district tables and answers from them: single values, rankings, district
 * comparisons, trends over time, associations between indicators, and a
 * data-based reading of where a district stands. No figure is typed in by
 * hand; every number comes from the files handed to createEngine().
 *
 * Answers are plain data ({ blocks, links, suggestions }), never HTML, so the
 * chat window can render them with textContent only.
 *
 * Runs in the browser (window.SoochanaChat) and in Node (module.exports) so
 * tests/chatbot.test.js can check answers against the real files.
 */
(function (root) {
  'use strict';

  /* ── text helpers ─────────────────────────────────────── */

  // Source titles carry a few broken apostrophes and PDF line-break hyphens.
  function clean(s) {
    return String(s == null ? '' : s)
      .replace(/�/g, '’')
      .replace(/([a-z])- ([a-z])/g, '$1$2')
      .replace(/([a-z])- ([A-Z])/g, '$1-$2')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function fold(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  }
  function words(s) {
    return fold(s).replace(/['’]/g, '').replace(/[^a-z0-9+]+/g, ' ').trim().split(' ').filter(Boolean);
  }
  function stem(w) {
    if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (w.length > 4 && /(sses|xes|ches|shes)$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && /[^s]s$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function stems(s) { return words(s).map(stem); }
  function stripHtml(s) { return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' '); }

  // Edit distance, counting a swapped pair of letters as one edit ("koraptu").
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    const d = [];
    for (let i = 0; i <= a.length; i++) d.push([i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  }

  function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function listJoin(a) {
    if (a.length <= 1) return a.join('');
    return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  }
  function trimZeros(s) { return s.indexOf('.') === -1 ? s : s.replace(/\.?0+$/, ''); }
  function num(v, dec) {
    const r = Number(Number(v).toFixed(dec));
    return r.toLocaleString('en-IN', { maximumFractionDigits: dec, minimumFractionDigits: 0 });
  }
  function indian(v) {
    const a = Math.abs(v);
    if (a >= 1e7) return trimZeros((v / 1e7).toFixed(2)) + ' crore';
    if (a >= 1e5) return trimZeros((v / 1e5).toFixed(2)) + ' lakh';
    return Math.round(v).toLocaleString('en-IN');
  }

  /* ── statistics ───────────────────────────────────────── */

  function mean(a) { return a.reduce((s, x) => s + x, 0) / a.length; }
  function median(a) {
    const s = a.slice().sort((x, y) => x - y), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function corr(xs, ys) {
    const mx = mean(xs), my = mean(ys);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < xs.length; i++) {
      const dx = xs[i] - mx, dy = ys[i] - my;
      sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
    }
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
  }

  /* ── vocabulary ───────────────────────────────────────── */

  // Other spellings of the district names the data uses.
  const DISTRICT_ALIASES = {
    Angul: ['anugul'],
    Baleshwar: ['balasore', 'baleswar', 'balesore'],
    Bargarh: ['baragarh'],
    Bolangir: ['balangir', 'bolangiri', 'balangiri'],
    Boudh: ['baudh', 'bauda', 'boudha'],
    Debagarh: ['deogarh', 'debagada', 'devgarh', 'deogad'],
    Jagatsinghapur: ['jagatsinghpur', 'jagatsingpur'],
    Jajpur: ['jajapur'],
    Kandhamal: ['kandhamala', 'phulbani'],
    Kendujhar: ['keonjhar', 'kendujhara'],
    Khordha: ['khurda', 'khurdha', 'khorda'],
    Nabarangpur: ['nabarangapur', 'nabarangpore', 'nowrangpur'],
    Subarnapur: ['sonepur', 'sonapur', 'subarnpur']
  };

  const REGIONS = {
    india: { name: 'India', say: ['india', 'national', 'nationally', 'country', 'all india'] },
    odisha: { name: 'Odisha', say: ['odisha', 'orissa'] },
    bihar: { name: 'Bihar', say: ['bihar'] },
    jharkhand: { name: 'Jharkhand', say: ['jharkhand'] },
    chhattisgarh: { name: 'Chhattisgarh', say: ['chhattisgarh', 'chattisgarh'] },
    telangana: { name: 'Telangana', say: ['telangana'] },
    kerala: { name: 'Kerala', say: ['kerala'] },
    tamilnadu: { name: 'Tamil Nadu', say: ['tamil nadu', 'tamilnadu'] },
    maharashtra: { name: 'Maharashtra', say: ['maharashtra'] },
    gujarat: { name: 'Gujarat', say: ['gujarat'] },
    uttarpradesh: { name: 'Uttar Pradesh', say: ['uttar pradesh', 'uttarpradesh'] },
    westbengal: { name: 'West Bengal', say: ['west bengal', 'bengal'] },
    rajasthan: { name: 'Rajasthan', say: ['rajasthan'] },
    madhyapradesh: { name: 'Madhya Pradesh', say: ['madhya pradesh', 'madhyapradesh'] },
    karnataka: { name: 'Karnataka', say: ['karnataka'] },
    punjab: { name: 'Punjab', say: ['punjab'] }
  };

  const GROUPS = {
    kbk: { label: 'KBK districts', test: d => d.kbk, say: ['kbk', 'kbk region', 'kbk district'] },
    coastal: { label: 'coastal districts', test: d => d.coastal, say: ['coastal', 'coast', 'sea coast', 'seaside'] },
    northern: { label: 'Northern division', test: d => d.division === 'Northern', say: ['northern', 'north odisha', 'northern division'] },
    central: { label: 'Central division', test: d => d.division === 'Central', say: ['central division', 'central odisha'] },
    southern: { label: 'Southern division', test: d => d.division === 'Southern', say: ['southern', 'south odisha', 'southern division'] }
  };

  const THEMES = {
    health: ['health', 'healthcare', 'medical', 'hospital'],
    education: ['education', 'school', 'schooling', 'learning', 'teacher'],
    demography: ['demography', 'demographic', 'people'],
    ageing: ['ageing', 'aging', 'elderly', 'old age'],
    migration: ['migration', 'migrant', 'urbanisation', 'urbanization'],
    employment: ['employment', 'job', 'work', 'labour', 'labor', 'workforce', 'unemployment']
  };

  // [key, path in districts.json, direction (+1 higher is better, -1 lower
  //  is better, 0 neither), theme, phrases people use for it]
  const TABLE = [
    ['literacy', 'f.literacy', 1, 'education', ['literacy', 'literacy rate', 'literate', 'literacy level', 'overall literacy']],
    ['female_lit', 'f.female_lit', 1, 'education', ['female literacy', 'female literate', 'girl literacy', 'women literacy rate census']],
    ['male_lit', 'f.male_lit', 1, 'education', ['male literacy', 'male literate', 'men literacy']],
    ['density', 'f.density', 0, 'demography', ['density', 'population density', 'densely populated', 'crowded', 'people per sq km']],
    ['urban_pct', 'f.urban_pct', 0, 'migration', ['urban', 'urban population', 'urbanisation', 'urbanization', 'urbanised', 'urbanized', 'city population']],
    ['tribal_pct', 'f.tribal_pct', 0, 'demography', ['tribal', 'tribe', 'tribal population', 'scheduled tribe', 'st population', 'st share', 'adivasi']],
    ['sex_ratio', 'f.sex_ratio', 1, 'demography', ['sex ratio', 'gender ratio', 'female per 1000 male', 'women per 1000 men']],
    ['growth_01_11', 'f.growth_01_11', 0, 'demography', ['population growth', 'growth rate', 'decadal growth', 'population growth rate']],
    ['elderly_pct', 'f.elderly_pct', 0, 'ageing', ['elderly', 'elderly population', 'ageing', 'aging', 'old age', 'older people', 'senior citizen', 'aged 60', '60+', 'old people']],
    ['child_pct', 'f.child_pct', 0, 'demography', ['child population', 'children share', 'young population', 'aged 0 14', 'under 15']],
    ['elderly_pct_2036', 'f.elderly_pct_2036', 0, 'ageing', ['elderly 2036', 'future elderly', 'ageing 2036', 'elderly population 2036']],
    ['beds_per_100k', 'f.beds_per_100k', 1, 'health', ['hospital bed', 'bed', 'beds per lakh', 'hospital capacity']],
    ['mmr', 'f.mmr', -1, 'health', ['maternal mortality', 'mmr', 'maternal death', 'maternal mortality ratio', 'mother dying']],
    ['forest_pct', 'f.forest_pct', 0, 'demography', ['forest', 'forest cover', 'green cover']],
    ['sown_pct', 'f.sown_pct', 0, 'employment', ['sown area', 'net sown', 'cultivated', 'farmland', 'agricultural land', 'crop area', 'agriculture']],
    ['rainfall_mm', 'f.rainfall_mm', 0, 'demography', ['rainfall', 'rain', 'precipitation']],
    ['bank_per_100k', 'f.bank_per_100k', 1, 'employment', ['bank', 'bank branch', 'banking', 'bank access']],
    ['sec_dropout', 'f.sec_dropout', -1, 'education', ['dropout', 'drop out', 'secondary dropout', 'school dropout', 'dropout rate', 'secondary school dropout']],
    ['mid_dropout', 'f.mid_dropout', -1, 'education', ['middle school dropout', 'middle dropout', 'upper primary dropout', 'middle school drop out']],
    ['sec_ptr', 'f.sec_ptr', -1, 'education', ['pupil teacher ratio', 'ptr', 'teacher ratio', 'student teacher ratio', 'student per teacher', 'pupil per teacher']],
    ['smart_class_pct', 'f.smart_class_pct', 1, 'education', ['smart class', 'smart classroom', 'digital classroom']],
    ['computer_pct', 'f.computer_pct', 1, 'education', ['computer', 'school with computer', 'computer in school']],
    ['imr', 'nfhs5.imr', -1, 'health', ['infant mortality', 'imr', 'infant death', 'infant mortality rate', 'baby dying']],
    ['nmr', 'nfhs5.nmr', -1, 'health', ['neonatal mortality', 'nmr', 'neonatal', 'newborn death', 'newborn mortality']],
    ['u5mr', 'nfhs5.u5mr', -1, 'health', ['under five mortality', 'under 5 mortality', 'u5mr', 'child mortality', 'child death', 'under five death']],
    ['stunted', 'nfhs5.stunted', -1, 'health', ['stunting', 'stunted', 'malnutrition', 'malnourished', 'undernutrition', 'nutrition', 'short for age']],
    ['wasted', 'nfhs5.wasted', -1, 'health', ['wasting', 'wasted', 'thin for height']],
    ['underweight', 'nfhs5.underweight', -1, 'health', ['underweight', 'under weight']],
    ['anaemic_child', 'nfhs5.anaemic_child', -1, 'health', ['anaemia', 'anemia', 'anaemic', 'anemic', 'child anaemia']],
    ['le_female', 'nfhs5.le_female', 1, 'health', ['life expectancy', 'female life expectancy', 'women life expectancy', 'lifespan', 'longevity']],
    ['le_male', 'nfhs5.le_male', 1, 'health', ['male life expectancy', 'men life expectancy']],
    ['srb', 'nfhs5.srb', 1, 'demography', ['sex ratio at birth', 'srb', 'birth sex ratio', 'girls born per 1000 boys']],
    ['insurance', 'nfhs5.insurance', 1, 'health', ['insurance', 'health insurance', 'insured', 'health cover']],
    ['women_lit', 'nfhs5.women_lit', 1, 'education', ['women literacy', 'literate women', 'women literate', 'woman literacy']],
    ['child_marriage', 'nfhs5.child_marriage', -1, 'health', ['child marriage', 'early marriage', 'married before 18', 'underage marriage', 'marriage before 18']],
    ['fp_any', 'nfhs5.fp_any', 1, 'health', ['family planning', 'contraception', 'contraceptive', 'contraceptive use']],
    ['unmet_need', 'nfhs5.unmet_need', -1, 'health', ['unmet need', 'unmet need for family planning']],
    ['anc4', 'nfhs5.anc4', 1, 'health', ['antenatal', 'anc', 'antenatal care', 'prenatal', 'anc visit', 'pregnancy checkup']],
    ['inst_births', 'nfhs5.inst_births', 1, 'health', ['institutional birth', 'institutional delivery', 'hospital birth', 'hospital delivery', 'delivery in hospital', 'safe delivery']],
    ['full_vax', 'nfhs5.full_vax', 1, 'health', ['vaccination', 'vaccinated', 'immunisation', 'immunization', 'vaccine', 'full immunisation', 'fully vaccinated']],
    ['adequate_diet', 'nfhs5.adequate_diet', 1, 'health', ['adequate diet', 'minimum diet', 'child diet', 'diet']]
  ];

  // Short everyday names, for sentences ("the highest stunting").
  const NAMES = {
    literacy: 'literacy', female_lit: 'female literacy', male_lit: 'male literacy', density: 'population density',
    urban_pct: 'urban share', tribal_pct: 'tribal (ST) share', sex_ratio: 'sex ratio', growth_01_11: 'population growth (2001–11)',
    elderly_pct: 'elderly (60+) share', child_pct: 'child (0–14) share', elderly_pct_2036: 'elderly share in 2036',
    beds_per_100k: 'hospital beds per lakh', mmr: 'maternal mortality', forest_pct: 'forest cover', sown_pct: 'net sown area',
    rainfall_mm: 'rainfall', bank_per_100k: 'bank branches per lakh', sec_dropout: 'secondary dropout', mid_dropout: 'middle-school dropout',
    sec_ptr: 'pupil–teacher ratio', smart_class_pct: 'smart classrooms', computer_pct: 'schools with computers',
    imr: 'infant mortality', nmr: 'neonatal mortality', u5mr: 'under-five mortality', stunted: 'stunting', wasted: 'wasting',
    underweight: 'underweight', anaemic_child: 'child anaemia', le_female: 'female life expectancy', le_male: 'male life expectancy',
    srb: 'sex ratio at birth', insurance: 'health insurance', women_lit: 'women’s literacy', child_marriage: 'child marriage',
    fp_any: 'family-planning use', unmet_need: 'unmet need for family planning', anc4: 'antenatal care (4+ visits)',
    inst_births: 'institutional births', full_vax: 'full vaccination', adequate_diet: 'adequate child diet',
    population: 'population', tfr: 'fertility', lfpr: 'labour force participation', flfpr: 'female labour force participation'
  };

  const UNITS = {
    sex_ratio: 'females per 1,000 males',
    srb: 'girls per 1,000 boys born',
    density: 'people per sq km',
    rainfall_mm: 'mm a year',
    sec_ptr: 'pupils per teacher'
  };
  const DECIMALS = { sex_ratio: 0, srb: 0, density: 0, rainfall_mm: 0, mmr: 0, beds_per_100k: 0, bank_per_100k: 0, sec_ptr: 0, tfr: 2, population: 0 };

  // Indicators too close to one another to count as an "association".
  const FAMILIES = [
    ['literacy', 'female_lit', 'male_lit', 'women_lit'],
    ['imr', 'nmr', 'u5mr'],
    ['stunted', 'wasted', 'underweight'],
    ['le_female', 'le_male'],
    ['elderly_pct', 'elderly_pct_2036', 'child_pct'],
    ['sec_dropout', 'mid_dropout'],
    ['smart_class_pct', 'computer_pct'],
    ['fp_any', 'unmet_need'],
    ['sex_ratio', 'srb'],
    ['tfr', 'child_pct']
  ];
  function sameFamily(a, b) { return FAMILIES.some(f => f.indexOf(a) !== -1 && f.indexOf(b) !== -1); }

  // The indicators used when someone compares or profiles districts without naming one.
  const KEY_SET = ['population', 'literacy', 'female_lit', 'sex_ratio', 'tribal_pct', 'urban_pct', 'tfr', 'imr', 'stunted', 'inst_births', 'child_marriage', 'mmr'];

  const STOP = new Set(('a an the of in on at to for and or is are was were be been what which who whom whose how why when where ' +
    'do does did has have had me my i you your we our it its this that these those there than then with by from as about ' +
    'tell show give find list please can could would should will district districts odisha state data rate number much many ' +
    'value level percent percentage share compare vs versus between any all some more most less least high low ' +
    'highest lowest top bottom best worst better worse also like know').split(' '));

  // Words too common in titles to say what a document is about.
  const GENERIC = new Set(stemsList('rate ratio population people child children women woman female male total per year share age aged ' +
    'number birth births health trend trends change changing growth indicator data report odisha india district'));
  function stemsList(s) { return s.split(' ').map(stem); }

  const RX = {
    greet: /^\s*(hi+|hello+|hey+|hiya|namaste|namaskar|namaskara|good (morning|afternoon|evening))\b/,
    thanks: /\b(thank|thanks|thankyou|thx|dhanyabad|dhanyavad)\b/,
    help: /\b(help|what can you do|what do you do|how (do|can) i use|what can i ask|who are you|capabilit\w*)\b/,
    high: /\b(highest|most|top|maximum|max|largest|biggest|greatest|higher|leading|peak)\b/,
    low: /\b(lowest|least|minimum|min|smallest|fewest|bottom|lower|fewer)\b/,
    best: /\b(best|better|strongest|doing well|performing well|top performing|good)\b/,
    worst: /\b(worst|worse|poorest|weakest|lagging|lags|behind|doing badly|poor|bad)\b/,
    trendStrong: /\b(trend|trends|over time|over the years|history|historical|changed|changing|evolv\w*|since|grown|grew|growth over|over the decades|decade by decade|trajectory)\b/,
    trendWeak: /\b(projection\w*|projected|future|forecast\w*|will|going to|by 20\d\d|coming years|change)\b/,
    improve: /\b(improv\w*|progress\w*|worsen\w*|deteriorat\w*|declin\w*|fell|dropped|reduc\w*|got better|got worse)\b/,
    compare: /\b(compare|comparison|compared|comparing|vs|v|versus|difference|differences|differ|between|against|relative to|gap between)\b/,
    why: /\b(why|reason\w*|cause\w*|explain\w*|because|factor\w*|driver\w*|relat\w*|correlat\w*|link\w*|associat\w*|depend\w*|connect\w*|affect\w*|influenc\w*)\b/,
    assessStrong: /\b(suggest\w*|recommend\w*|should|priorit\w*|what can be done|how can|how to improve|intervention\w*|focus on|action\w*)\b/,
    assess: /\b(strength\w*|weakness\w*|concern\w*|percept\w*|think|opinion|insight\w*|challeng\w*|problem\w*|issue\w*|doing|perform\w*|assess\w*|situation|condition|stand|stands|attention|scorecard|report card|progress)\b/,
    profile: /\b(about|profile|overview|summary|summari[sz]e|facts?|describe|snapshot|key stat\w*|at a glance)\b/,
    content: /\b(articles?|reports?|reading|publications?|datasets?|download\w*|excel|pdf|documents?|papers?|where can i find|resources?|files?|sources?)\b/,
    policy: /\b(polic(y|ies)|schemes?|welfare|bsky|mamata|yojana|programmes?|programs?)\b/,
    followup: /^\s*(and|what about|how about|what of|same for|also|now|then)\b/,
    pronoun: /\b(it|its|there|this district|that district|same district|them|both|these districts)\b/,
    here: /\b(this district|here|this page|current district)\b/,
    stateWord: /\b(which state|what state|states|state wise|statewise|other states|among states|indian states)\b/,
    which: /\b(which|what|name the|list)\b/
  };

  /* ── engine ───────────────────────────────────────────── */

  function createEngine(src) {
    src = src || {};
    const table = src.districts || { meta: { features: {} }, districts: [] };
    const meta = table.meta || { features: {} };
    const rows = table.districts || [];
    const names = rows.map(r => r.name);
    const byName = {};
    rows.forEach(r => { byName[r.name] = r; });
    const N = names.length;

    /* districts: exact names, aliases, then near-misses */
    const dLookup = {};
    names.forEach(n => { dLookup[fold(n).replace(/[^a-z]/g, '')] = n; });
    Object.keys(DISTRICT_ALIASES).forEach(n => {
      if (byName[n]) DISTRICT_ALIASES[n].forEach(a => { dLookup[a] = n; });
    });
    const dKeys = Object.keys(dLookup);
    function districtOf(token) {
      if (dLookup[token]) return dLookup[token];
      if (token.length < 5 || STOP.has(token)) return null;
      let best = null, bestD = 9;
      dKeys.forEach(k => {
        const d = lev(token, k);
        if (d < bestD) { bestD = d; best = k; }
      });
      const allow = token.length >= 8 ? 2 : 1;
      return best && bestD <= allow ? dLookup[best] : null;
    }
    function resolveKey(name, obj) {
      if (!obj) return null;
      const keys = Object.keys(obj);
      for (let i = 0; i < keys.length; i++) {
        if (dLookup[fold(keys[i]).replace(/[^a-z]/g, '')] === name) return keys[i];
      }
      return null;
    }

    /* indicators */
    const IND = [];
    const byKey = {};
    function add(ind) {
      ind.dec = ind.key in DECIMALS ? DECIMALS[ind.key] : 1;
      ind.name = NAMES[ind.key] || ind.name;
      ind.phrases = ind.syn.map(stems);
      IND.push(ind);
      byKey[ind.key] = ind;
    }
    const numOrNull = v => (v == null || v === '' || isNaN(+v) ? null : +v);

    TABLE.forEach(([key, path, pol, theme, syn]) => {
      const parts = path.split('.'), grp = parts[0], k = parts[1];
      const f = (meta.features || {})[k] || {};
      const ind = { key, pol, theme, syn, label: clean(f.label || key), unit: UNITS[k] || clean(f.unit || '') };
      if (grp === 'f') {
        ind.source = clean(f.source || '');
        ind.periods = [{ id: 'f', label: ind.source }];
        ind.def = 'f';
        ind.raw = (name) => numOrNull(((byName[name] || {}).f || {})[k]);
      } else {
        const has4 = rows.some(r => r.nfhs4 && r.nfhs4[k] != null);
        ind.periods = has4
          ? [{ id: 'nfhs4', label: 'NFHS-4, 2015–16' }, { id: 'nfhs5', label: 'NFHS-5, 2019–21' }]
          : [{ id: 'nfhs5', label: 'NFHS-5, 2019–21' }];
        ind.def = 'nfhs5';
        ind.source = has4 ? 'NFHS-5 (2019–21), with NFHS-4 (2015–16) for change' : 'NFHS-5 (2019–21)';
        ind.raw = (name, p) => numOrNull(((byName[name] || {})[p || 'nfhs5'] || {})[k]);
        ind.state = meta.state_nfhs5 && meta.state_nfhs5[k] != null ? { v: +meta.state_nfhs5[k], label: 'Odisha, NFHS-5' } : null;
      }
      add(ind);
    });

    const pop = src.population || null;
    if (pop) {
      const any = pop[Object.keys(pop)[0]] || {};
      const years = Object.keys(any).sort();
      add({
        key: 'population', pol: 0, theme: 'demography', label: 'Population', unit: 'people',
        syn: ['population', 'people', 'inhabitant', 'how many people', 'total population', 'headcount', 'residents'],
        source: 'Census 1951–2011; projections 2016–2036',
        periods: years.map(y => ({ id: y, label: y + (+y > 2011 ? ' projection' : ' Census'), projected: +y > 2011 })),
        def: '2011',
        raw: (name, p) => {
          const key = resolveKey(name, pop);
          const row = key && pop[key][p || '2011'];
          return row ? numOrNull(row.total) : null;
        },
        stateRaw: (p) => {
          let s = 0, n = 0;
          names.forEach(nm => { const v = byKey.population.raw(nm, p); if (v != null) { s += v; n++; } });
          return n === N ? s : null;
        }
      });
    }

    const fert = src.fertility || null;
    if (fert) {
      const any = fert[Object.keys(fert)[0]] || {};
      const keys = Object.keys(any);
      add({
        key: 'tfr', pol: 0, theme: 'demography', label: 'Total fertility rate', unit: 'births per woman',
        syn: ['fertility', 'tfr', 'total fertility', 'total fertility rate', 'fertility rate', 'birth per woman', 'children per woman', 'birth rate'],
        source: 'NFHS-4 (2015–16); estimate for 2020; projections to 2036',
        periods: keys.map(y => /nfhs/i.test(y)
          ? { id: y, label: 'NFHS-4, 2015–16' }
          : { id: y, label: y === '2020' ? '2020 estimate' : y + ' projection', projected: y !== '2020' }),
        def: keys.indexOf('2020') !== -1 ? '2020' : keys[0],
        raw: (name, p) => {
          const key = resolveKey(name, fert);
          return key ? numOrNull(fert[key][p || '2020']) : null;
        }
      });
    }

    /* state-vs-India table */
    const NAT = [];
    const natMap = [
      [/^population \(actual/i, 'population'],
      [/^population \(projected/i, 'population'],
      [/^decadal population growth/i, 'growth_01_11'],
      [/^population density/i, 'density'],
      [/^st population share/i, 'tribal_pct'],
      [/^sex ratio at birth/i, 'srb'],
      [/^sex ratio \(/i, 'sex_ratio'],
      [/^lfpr/i, 'lfpr'],
      [/^flfpr/i, 'flfpr']
    ];
    (src.national || []).forEach(r => {
      const m = natMap.find(x => x[0].test(r.indicator));
      if (!m) return;
      const values = {};
      Object.keys(REGIONS).forEach(k => { if (r[k] != null) values[k] = +r[k]; });
      NAT.push({ key: m[1], label: clean(r.indicator.replace(/_/g, ' ').replace(/\s*\(.*$/, '')), full: clean(r.indicator.replace(/_/g, ' ')), year: clean(r.year).replace(/\s*-\s*/, '–'), source: clean(r.source), values });
    });
    if (NAT.some(n => n.key === 'lfpr')) {
      add({ key: 'lfpr', pol: 1, theme: 'employment', label: 'Labour force participation (15–59)', unit: '%', nationalOnly: true,
        syn: ['labour force participation', 'labor force participation', 'lfpr', 'workforce participation', 'labour force', 'labor force'], source: 'PLFS 2023–24', periods: [], def: null, raw: () => null });
    }
    if (NAT.some(n => n.key === 'flfpr')) {
      add({ key: 'flfpr', pol: 1, theme: 'employment', label: 'Female labour force participation (15–59)', unit: '%', nationalOnly: true,
        syn: ['female labour force', 'female labor force', 'flfpr', 'women workforce', 'women work', 'female workforce', 'working women', 'female employment', 'women employment', 'women labour'], source: 'PLFS 2023–24', periods: [], def: null, raw: () => null });
    }

    /* content index */
    const docs = [];
    (src.contents || []).forEach(a => {
      const title = clean(a.title);
      docs.push({ kind: 'article', title, theme: a.theme, url: 'article.html?id=' + encodeURIComponent(a.id),
        t: new Set(stems(title)), a: new Set(stems(clean(a.abstract))), b: new Set(stems(stripHtml(a.article).slice(0, 6000))) });
    });
    (src.reports || []).forEach(r => {
      const title = clean(r.name || 'Report');
      const ext = /^https?:/i.test(r.file || '');
      docs.push({ kind: 'report', title, theme: r.theme, url: ext ? r.file : 'repository.html', external: ext,
        t: new Set(stems(title)), a: new Set(stems(clean(r.description))), b: new Set() });
    });
    (src.datasets || []).forEach(d => {
      const title = clean(d.name);
      docs.push({ kind: 'dataset', title, theme: null, url: 'repository.html',
        t: new Set(stems(title)), a: new Set(stems(clean(d.description))), b: new Set() });
    });

    function searchDocs(terms, theme, limit) {
      const q = terms.filter(w => !STOP.has(w) && w.length > 2);
      const scored = docs.map(d => {
        let head = 0, body = 0;
        q.forEach(w => {
          const wt = GENERIC.has(w) ? 0.3 : 1;
          if (d.t.has(w)) head += 3 * wt;
          else if (d.a.has(w)) head += 2 * wt;
          if (d.b.has(w) && wt === 1) body++;
        });
        const relevant = head >= 2 || body >= 3;
        const s = head + 0.5 * body + (theme && d.theme === theme ? 1.5 : 0);
        return { d, s: relevant ? s : 0 };
      }).filter(x => x.s >= 3).sort((x, y) => y.s - x.s);
      const seen = new Set(), out = [];
      scored.forEach(x => {
        if (out.length >= (limit || 4) || seen.has(x.d.title)) return;
        seen.add(x.d.title);
        out.push(x.d);
      });
      return out;
    }
    function docLink(d) {
      const icon = d.kind === 'article' ? '📖' : d.kind === 'report' ? '📄' : '📊';
      return { title: icon + ' ' + d.title, url: d.url, external: !!d.external };
    }

    /* value helpers */
    function val(ind, name, p) { return ind.raw(name, p || ind.def); }
    function periodOf(ind, id) { return ind.periods.find(x => x.id === (id || ind.def)) || { id: id, label: ind.source }; }
    function series(ind, p) {
      return names.map(n => ({ name: n, v: val(ind, n, p) })).filter(x => x.v != null);
    }
    function position(ind, name, p) {
      const all = series(ind, p), me = val(ind, name, p);
      if (me == null) return null;
      const hi = 1 + all.filter(x => x.v > me).length;
      const lo = 1 + all.filter(x => x.v < me).length;
      const good = ind.pol > 0 ? hi : ind.pol < 0 ? lo : null;
      return { v: me, hi, lo, n: all.length, good };
    }
    function posText(pos) {
      if (!pos) return '';
      if (pos.hi === 1) return 'the highest of ' + pos.n + ' districts';
      if (pos.lo === 1) return 'the lowest of ' + pos.n + ' districts';
      if (pos.hi <= pos.lo) return ordinal(pos.hi) + ' highest of ' + pos.n;
      return ordinal(pos.lo) + ' lowest of ' + pos.n;
    }
    function standing(ind, pos) {
      if (!pos || pos.good == null) return '';
      if (pos.good <= Math.ceil(pos.n / 4)) return 'among the better-placed quarter of districts';
      if (pos.good > pos.n - Math.ceil(pos.n / 4)) return 'among the weakest quarter of districts';
      return '';
    }
    function fmt(ind, v, bare) {
      if (v == null) return 'n/a';
      if (ind.key === 'population') return indian(v);
      const s = num(v, ind.dec);
      if (ind.unit === '%' || ind.unit === '% of area') return s + '%';
      return bare || !ind.unit ? s : s + ' ' + ind.unit;
    }
    function fmtDiff(ind, d) {
      const a = Math.abs(d);
      if (ind.key === 'population') return indian(a);
      if (ind.unit === '%' || ind.unit === '% of area') return num(a, ind.dec) + ' percentage points';
      return num(a, ind.dec) + (ind.unit ? ' ' + ind.unit : '');
    }
    function direction(ind) {
      return ind.pol > 0 ? 'higher is better' : ind.pol < 0 ? 'lower is better' : 'neither higher nor lower is better in itself';
    }
    function medianOf(ind, p) { const s = series(ind, p); return s.length ? median(s.map(x => x.v)) : null; }
    function stateValue(ind, p) {
      if (ind.stateRaw) { const v = ind.stateRaw(p || ind.def); return v != null ? { v, label: 'Odisha' } : null; }
      if (ind.state && (p || ind.def) === 'nfhs5') return ind.state;
      return null;
    }
    function refLine(ind, p) {
      const st = stateValue(ind, p), md = medianOf(ind, p);
      const bits = [];
      if (st) bits.push(st.label + ': ' + fmt(ind, st.v));
      if (md != null && ind.key !== 'population') bits.push('median district: ' + fmt(ind, md));
      return bits.join('; ');
    }
    function sourceNote(inds) {
      const seen = new Set(), s = [];
      inds.forEach(i => { if (i.source && !seen.has(i.source)) { seen.add(i.source); s.push(i.label + ': ' + i.source); } });
      return s.length ? { type: 'note', text: 'Source — ' + s.join(' · ') } : null;
    }
    function hasPrev(ind) { return ind.periods.length === 2 && ind.periods[0].id === 'nfhs4'; }

    // The most similar district (tribal share, literacy, urban share), for
    // "compare with..." suggestions that are worth asking.
    const PEER_KEYS = ['tribal_pct', 'literacy', 'urban_pct'].filter(k => byKey[k]);
    const peerStats = PEER_KEYS.map(k => {
      const v = names.map(n => val(byKey[k], n)).filter(x => x != null);
      const m = mean(v);
      return { k, m, sd: Math.sqrt(mean(v.map(x => (x - m) * (x - m)))) || 1 };
    });
    function peerOf(d, exclude) {
      if (!byName[d]) return names[0];
      const z = n => peerStats.map(s => ((val(byKey[s.k], n) == null ? s.m : val(byKey[s.k], n)) - s.m) / s.sd);
      const me = z(d);
      let best = null, bestD = Infinity;
      names.forEach(n => {
        if (n === d || (exclude && exclude.indexOf(n) !== -1)) return;
        const dist = z(n).reduce((s, x, i) => s + (x - me[i]) * (x - me[i]), 0);
        if (dist < bestD) { bestD = dist; best = n; }
      });
      return best;
    }

    // The district whose page the chat is open on, in the table's spelling.
    function pageDistrict(ctx) {
      return ctx && ctx.pageDistrict ? districtOf(fold(ctx.pageDistrict).replace(/[^a-z]/g, '')) : null;
    }

    /* ── parse ─────────────────────────────────────────── */

    function parse(query, ctx) {
      ctx = ctx || {};
      const last = ctx.last || {};
      const raw = fold(query);
      const w = words(query);
      const st = w.map(stem);
      const text = ' ' + w.join(' ') + ' ';
      const p = { query, text, words: w, stems: st, districts: [], indicators: [], groups: [], regions: [], themes: [], flags: {} };

      // indicators: longest phrase at each position
      const used = new Array(st.length).fill(false);
      for (let i = 0; i < st.length; i++) {
        let best = null, bestLen = 0;
        IND.forEach(ind => {
          ind.phrases.forEach(ph => {
            if (ph.length <= bestLen || i + ph.length > st.length) return;
            for (let j = 0; j < ph.length; j++) if (st[i + j] !== ph[j]) return;
            best = ind; bestLen = ph.length;
          });
        });
        if (best) {
          if (p.indicators.indexOf(best) === -1) p.indicators.push(best);
          for (let j = 0; j < bestLen; j++) used[i + j] = true;
          i += bestLen - 1;
        }
      }
      // "elderly ... 2036" means the projection
      if (/\b(2036|future|projected)\b/.test(text) && p.indicators.indexOf(byKey.elderly_pct) !== -1 && byKey.elderly_pct_2036) {
        p.indicators[p.indicators.indexOf(byKey.elderly_pct)] = byKey.elderly_pct_2036;
      }

      w.forEach((tok, i) => {
        if (used[i]) return;
        const d = districtOf(tok);
        if (d && p.districts.indexOf(d) === -1) p.districts.push(d);
      });
      Object.keys(REGIONS).forEach(k => {
        if (REGIONS[k].say.some(s => text.indexOf(' ' + s + ' ') !== -1)) p.regions.push(k);
      });
      Object.keys(GROUPS).forEach(k => {
        if (GROUPS[k].say.some(s => text.indexOf(' ' + s + ' ') !== -1)) p.groups.push(k);
      });
      Object.keys(THEMES).forEach(k => {
        if (THEMES[k].some(s => {
          const ph = stems(s);
          for (let i = 0; i + ph.length <= st.length; i++) {
            let ok = true;
            for (let j = 0; j < ph.length; j++) if (used[i + j] || st[i + j] !== ph[j]) { ok = false; break; }
            if (ok) return true;
          }
          return false;
        })) p.themes.push(k);
      });

      const f = p.flags;
      Object.keys(RX).forEach(k => { f[k] = RX[k].test(text); });
      f.greet = RX.greet.test(raw);
      const ym = raw.match(/\b(19[5-9]\d|20[0-3]\d)\b/);
      p.year = ym ? ym[1] : null;
      const nf = raw.match(/nfhs\s*-?\s*([4-6])/);
      p.nfhs = nf ? nf[1] : null;
      const tn = raw.match(/\b(?:top|bottom|first|last|best|worst|highest|lowest)\s+(\d{1,2})\b/) || raw.match(/\b(\d{1,2})\s+(?:districts?|highest|lowest|best|worst)\b/);
      p.topN = tn ? Math.max(1, Math.min(30, +tn[1])) : null;
      const th = raw.match(/\b(above|over|more than|greater than|higher than|at least|exceeding|below|under|less than|lower than|fewer than|at most)\s+(\d+(?:\.\d+)?)/);
      p.threshold = th ? { op: /above|over|more|greater|higher|least|exceed/.test(th[1]) ? '>' : '<', v: +th[2] } : null;
      p.state = p.regions.indexOf('odisha') !== -1;

      // Follow-ups reuse what the previous question was about.
      const follow = f.followup || w.length <= 2;
      if (!p.districts.length && f.pronoun && last.districts && last.districts.length) p.districts = last.districts.slice();
      const onPage = pageDistrict(ctx);
      if (!p.districts.length && f.here && onPage) p.districts = [onPage];
      if (p.districts.length && !p.indicators.length && !p.themes.length && follow && last.indicators && last.indicators.length) {
        p.indicators = last.indicators.map(k => byKey[k]).filter(Boolean);
      }
      if (!p.districts.length && !p.groups.length && p.indicators.length && f.followup && last.districts && last.districts.length) {
        p.districts = last.districts.slice();
      }
      if (f.compare && p.districts.length === 1 && !p.state && !p.groups.length && last.districts && last.districts.length && last.districts[0] !== p.districts[0]) {
        p.districts = [last.districts[0], p.districts[0]];
        if (!p.indicators.length && last.indicators) p.indicators = last.indicators.map(k => byKey[k]).filter(Boolean);
      }
      const bare = !p.districts.length && !p.indicators.length && !p.groups.length && !p.regions.length && !p.themes.length;
      if (bare && (f.high || f.low || f.best || f.worst || p.topN || p.threshold) && last.indicators && last.indicators.length) {
        p.indicators = last.indicators.map(k => byKey[k]).filter(Boolean);
      } else if (bare && (f.compare || f.trendStrong || f.trendWeak || f.why || f.assess || f.assessStrong || f.improve)) {
        if (last.districts) p.districts = last.districts.slice();
        if (last.indicators) p.indicators = last.indicators.map(k => byKey[k]).filter(Boolean);
      }
      return p;
    }

    /* ── answer builders ───────────────────────────────── */

    function para(text) { return { type: 'p', text }; }
    function relatedLinks(p, themes, max) {
      const terms = p.stems.concat(...p.indicators.map(i => i.phrases.slice(0, 3).flat()));
      const found = searchDocs(Array.from(new Set(terms)), themes && themes[0], max || 2);
      return found.map(docLink);
    }
    function districtLink(n) { return { title: '🗺️ ' + n + ' district profile', url: 'district.html?id=' + encodeURIComponent(n) }; }
    const LINK = {
      duel: { title: '⚔️ District duel with age pyramids', url: 'odisha_compare.html' },
      health: { title: '🩺 District health, NFHS-5 vs NFHS-6', url: 'district-health.html' },
      learn: { title: '🧮 Indicator correlation matrix (Learn)', url: 'learn/index.html' },
      states: { title: '🇮🇳 Odisha vs other states', url: 'compare.html' },
      map: { title: '🗺️ Odisha district map', url: 'index.html' },
      repo: { title: '📁 Data repository', url: 'repository.html' },
      themes: { title: '📊 All themes', url: 'themes.html' },
      timeline: { title: '⌛ Policy timelines', url: 'index.html#policyTimeline' }
    };
    function indLink(ind) {
      if (ind.periods.some(x => /nfhs/.test(x.id))) return LINK.health;
      if (ind.nationalOnly) return LINK.states;
      return null;
    }
    function pickPeriod(ind, p) {
      if (p.year && ind.periods.some(x => x.id === p.year)) return p.year;
      if (p.nfhs === '4') { const x = ind.periods.find(q => /nfhs/i.test(q.id) || /NFHS-4/.test(q.label)); if (x) return x.id; }
      return ind.def;
    }
    function nfhs6Note(p) {
      return p.nfhs === '6' ? para('NFHS-6 district figures are on the district health page; I answer from NFHS-5 (2019–21) for now.') : null;
    }
    function dataInds() { return IND.filter(i => !i.nationalOnly); }
    function suggestFor(p, kind) {
      const d = p.districts[0] || 'Koraput';
      const other = peerOf(d, p.districts);
      const ind = p.indicators[0];
      const s = [];
      if (kind === 'district') s.push('Compare ' + d + ' and ' + peerOf(d), 'How is ' + d + ' doing on health?', 'How has ' + d + '’s population changed?');
      else if (kind === 'indicator' && ind) s.push('Which district has the lowest ' + ind.name + '?', 'Why does ' + ind.name + ' vary across districts?', (ind.name + ' in KBK districts vs the rest').replace(/^\w/, c => c.toUpperCase()));
      else if (kind === 'compare') s.push('Compare ' + p.districts.join(' and ') + ' on health', 'What should ' + d + ' focus on?', 'Compare ' + d + ' with ' + other);
      else s.push('Tell me about Koraput', 'Which district has the highest infant mortality?', 'Compare Khordha and Malkangiri');
      return s.slice(0, 3);
    }
    function answer(blocks, links, suggestions, extra) {
      const a = Object.assign({ blocks: blocks.filter(Boolean), links: (links || []).filter(Boolean), suggestions: suggestions || [] }, extra || {});
      const seen = new Set();
      a.links = a.links.filter(l => (seen.has(l.url) ? false : (seen.add(l.url), true))).slice(0, 5);
      return a;
    }

    function greet() {
      return answer([para('Namaskar! I answer from Soochana’s own district data: values, rankings, comparisons, trends, and what the numbers suggest for a district. Try one of these:')],
        [], suggestFor({ districts: [], indicators: [] }), { intent: 'greet' });
    }
    function help() {
      return answer([
        para('I work from the portal’s data for Odisha’s 30 districts (Census, NFHS-4 and NFHS-5, UDISE+, projections to 2036) and its articles and reports. You can ask me to:'),
        { type: 'list', items: [
          'Look up a figure: “Infant mortality in Rayagada”',
          'Rank districts: “Top 5 districts for institutional births”, “Which districts have literacy below 60%?”',
          'Compare: “Koraput vs Ganjam”, “KBK districts vs the rest on stunting”, “Odisha vs Kerala sex ratio”',
          'Show a trend: “How has Cuttack’s population changed?”, “Fertility in Malkangiri by 2036”',
          'Look for links: “Why is stunting high in some districts?”',
          'Read a district: “What should Nabarangpur focus on?”',
          'Find reading: “Reports on migration”'
        ] },
        para('Follow-ups work too, e.g. “and Puri?” after a question about one district.')
      ], [], suggestFor({ districts: [], indicators: [] }), { intent: 'help' });
    }

    function valueAnswer(p) {
      const d = p.districts[0];
      const inds = p.indicators.filter(i => !i.nationalOnly).slice(0, 5);
      const blocks = [], used = [];
      if (inds.length === 1) {
        const ind = inds[0], per = pickPeriod(ind, p), v = val(ind, d, per);
        used.push(ind);
        if (v == null) {
          blocks.push(para('The portal has no ' + ind.name + ' figure for ' + d + '.'));
        } else {
          const pos = position(ind, d, per), stand = standing(ind, pos);
          let s = '**' + d + '** — ' + ind.label + ': **' + fmt(ind, v) + '** (' + periodOf(ind, per).label + '), ' + posText(pos) + (stand ? ', ' + stand : '') + '.';
          if (ind.key === 'population') {
            const extra = ['2026', '2036'].filter(y => y !== per && ind.periods.some(x => x.id === y)).map(y => fmt(ind, val(ind, d, y)) + ' in ' + y);
            if (extra.length) s += ' Projected: ' + listJoin(extra) + '.';
          } else if (ind.key === 'tfr') {
            const y36 = val(ind, d, '2036');
            if (per !== '2036' && y36 != null) s += ' Projected for 2036: ' + fmt(ind, y36) + '.';
            s += ' Replacement level is 2.1.';
          } else if (hasPrev(ind) && per === 'nfhs5') {
            const v4 = val(ind, d, 'nfhs4');
            if (v4 != null) {
              const better = ind.pol * (v - v4) > 0;
              s += ' In NFHS-4 (2015–16) it was ' + fmt(ind, v4) + ', so it has ' + (v === v4 ? 'not changed' : (v > v4 ? 'risen' : 'fallen') + ' by ' + fmtDiff(ind, v - v4) + (ind.pol ? (better ? ', an improvement' : ', a setback') : '')) + '.';
            }
          }
          blocks.push(para(s));
          const ref = refLine(ind, per);
          if (ref) blocks.push(para('For reference — ' + ref + (ind.pol ? ' (' + direction(ind) + ')' : '') + '.'));
        }
      } else {
        const rowsOut = inds.map(ind => {
          used.push(ind);
          const per = pickPeriod(ind, p), pos = position(ind, d, per);
          return [ind.label, fmt(ind, val(ind, d, per)), pos ? posText(pos) : '—'];
        });
        blocks.push(para('**' + d + '** on ' + inds.length + ' indicators:'));
        blocks.push({ type: 'table', head: ['Indicator', d, 'Position'], rows: rowsOut });
      }
      blocks.push(nfhs6Note(p));
      blocks.push(sourceNote(used));
      return answer(blocks, [districtLink(d), indLink(inds[0])].concat(relatedLinks(p, [inds[0].theme])),
        ['Compare ' + d + ' with ' + peerOf(d), 'Which district has the highest ' + inds[0].name + '?', 'Why does ' + inds[0].name + ' vary across districts?'],
        { intent: 'value' });
    }

    function rankAnswer(p) {
      const ind = p.indicators.find(i => !i.nationalOnly);
      const per = pickPeriod(ind, p);
      let pool = series(ind, per);
      let scope = 'of ' + pool.length + ' districts';
      if (p.groups.length) {
        const g = GROUPS[p.groups[0]];
        pool = pool.filter(x => g.test(byName[x.name]));
        scope = 'among ' + g.label;
      }
      const f = p.flags;
      let wantHigh;
      let caveat = null;
      if ((f.best || f.worst) && !(f.high || f.low)) {
        if (ind.pol === 0) { wantHigh = !f.worst; caveat = 'There is no better or worse direction for ' + ind.name + ', so this lists the ' + (wantHigh ? 'highest' : 'lowest') + ' values.'; }
        else wantHigh = f.best ? ind.pol > 0 : ind.pol < 0;
      } else {
        wantHigh = !(f.low && !f.high);
      }
      const blocks = [];
      if (p.threshold) {
        const t = p.threshold;
        const hit = pool.filter(x => (t.op === '>' ? x.v > t.v : x.v < t.v)).sort((a, b) => (t.op === '>' ? b.v - a.v : a.v - b.v));
        blocks.push(para('**' + hit.length + '** district' + (hit.length === 1 ? '' : 's') + ' ' + scope.replace(/^of /, 'out of ') + ' have ' + ind.name + ' ' + (t.op === '>' ? 'above' : 'below') + ' ' + fmt(ind, t.v) + ' (' + periodOf(ind, per).label + ')' + (hit.length ? ':' : '.')));
        if (hit.length) blocks.push({ type: 'bars', items: hit.map(x => ({ label: x.name, value: x.v, text: fmt(ind, x.v, true) })) });
      } else {
        const sorted = pool.slice().sort((a, b) => (wantHigh ? b.v - a.v : a.v - b.v));
        const n = Math.min(p.topN || 5, sorted.length);
        const top = sorted.slice(0, n);
        const word = wantHigh ? 'highest' : 'lowest';
        const lead = top[0];
        let s = '**' + lead.name + '** has the ' + word + ' ' + ind.name + ' ' + scope + ': **' + fmt(ind, lead.v) + '** (' + periodOf(ind, per).label + ').';
        if (top.length > 2) s += ' Next are ' + listJoin(top.slice(1, 3).map(x => x.name + ' (' + fmt(ind, x.v) + ')')) + '.';
        blocks.push(para(s));
        blocks.push({ type: 'bars', items: top.map(x => ({ label: x.name, value: x.v, text: fmt(ind, x.v, true) })) });
        const other = sorted[sorted.length - 1];
        const ref = refLine(ind, per);
        blocks.push(para('At the other end: ' + other.name + ' (' + fmt(ind, other.v) + ').' + (ref ? ' ' + ref.replace(/^\w/, c => c.toUpperCase()) + '.' : '') + (ind.pol ? ' For this indicator ' + direction(ind) + '.' : '')));
      }
      if (caveat) blocks.push({ type: 'note', text: caveat });
      blocks.push(nfhs6Note(p));
      blocks.push(sourceNote([ind]));
      return answer(blocks, [indLink(ind), LINK.map].concat(relatedLinks(p, [ind.theme])),
        suggestFor(Object.assign({}, p, { districts: [] }), 'indicator'),
        { intent: 'rank', memory: { indicators: [ind.key] } });
    }

    function overviewAnswer(p) {
      const ind = p.indicators.find(i => !i.nationalOnly);
      const per = pickPeriod(ind, p);
      const sorted = series(ind, per).sort((a, b) => b.v - a.v);
      if (!sorted.length) return fallback(p);
      const md = median(sorted.map(x => x.v));
      const st = stateValue(ind, per);
      const blocks = [para('**' + ind.label + '** across Odisha’s districts (' + periodOf(ind, per).label + '): from ' + fmt(ind, sorted[sorted.length - 1].v) + ' in ' + sorted[sorted.length - 1].name + ' to ' + fmt(ind, sorted[0].v) + ' in ' + sorted[0].name + '. ' + (ind.key === 'population' ? '' : 'The median district is at ' + fmt(ind, md) + '.') + (st ? ' ' + st.label + ': ' + fmt(ind, st.v) + '.' : ''))];
      blocks.push({ type: 'bars', compact: true, items: sorted.map(x => ({ label: x.name, value: x.v, text: fmt(ind, x.v, true) })) });
      if (hasPrev(ind)) {
        const ch = names.map(n => ({ n, a: val(ind, n, 'nfhs4'), b: val(ind, n, 'nfhs5') })).filter(x => x.a != null && x.b != null);
        const better = ch.filter(x => ind.pol * (x.b - x.a) > 0).length;
        blocks.push(para('Between NFHS-4 and NFHS-5, ' + better + ' of ' + ch.length + ' districts moved in the better direction (' + direction(ind) + ').'));
      } else if (ind.pol) {
        blocks.push(para('For this indicator ' + direction(ind) + '.'));
      }
      blocks.push(nfhs6Note(p));
      blocks.push(sourceNote([ind]));
      return answer(blocks, [indLink(ind), LINK.map].concat(relatedLinks(p, [ind.theme])), suggestFor(p, 'indicator'), { intent: 'overview' });
    }

    function improveAnswer(p) {
      const ind = p.indicators.find(hasPrev);
      const f = p.flags;
      const worse = f.worst || /\b(worsen\w*|deteriorat\w*|got worse|least improv\w*)\b/.test(p.text);
      let pool = names;
      let scope = '';
      if (p.groups.length) { const g = GROUPS[p.groups[0]]; pool = names.filter(n => g.test(byName[n])); scope = ' among ' + g.label; }
      const ch = pool.map(n => ({ n, a: val(ind, n, 'nfhs4'), b: val(ind, n, 'nfhs5') })).filter(x => x.a != null && x.b != null)
        .map(x => Object.assign(x, { g: ind.pol * (x.b - x.a) }));
      ch.sort((x, y) => (worse ? x.g - y.g : y.g - x.g));
      const top = ch.slice(0, p.topN || 5);
      const lead = top[0];
      const improved = ch.filter(x => x.g > 0).length;
      const blocks = [
        para('Between NFHS-4 (2015–16) and NFHS-5 (2019–21), ' + (worse ? 'the biggest setback' : 'the biggest improvement') + ' in ' + ind.name + scope + ' was in **' + lead.n + '**: ' + fmt(ind, lead.a) + ' → ' + fmt(ind, lead.b) + '.'),
        { type: 'bars', signed: true, items: top.map(x => ({ label: x.n, value: x.g, text: (x.b - x.a > 0 ? '+' : '−') + num(Math.abs(x.b - x.a), ind.dec) + ' (' + num(x.a, ind.dec) + ' → ' + num(x.b, ind.dec) + ')' })) },
        para(improved + ' of ' + ch.length + ' districts' + scope + ' moved in the better direction (' + direction(ind) + ').'),
        sourceNote([ind])
      ];
      return answer(blocks, [LINK.health].concat(relatedLinks(p, [ind.theme])), suggestFor(p, 'indicator'), { intent: 'improve', memory: { indicators: [ind.key] } });
    }

    function compareAnswer(p) {
      const ds = p.districts.slice(0, 4);
      const withState = p.state || p.flags.stateWord || /\b(average|median|rest of|other districts|typical)\b/.test(p.text);
      let inds = p.indicators.filter(i => !i.nationalOnly);
      let themeNote = '';
      if (!inds.length && p.themes.length) {
        inds = dataInds().filter(i => i.theme === p.themes[0] && i.pol !== 0).slice(0, 10);
        themeNote = ' on ' + p.themes[0];
      }
      const keySet = !inds.length;
      if (keySet) inds = KEY_SET.map(k => byKey[k]).filter(Boolean);
      const blocks = [];
      if (ds.length === 1 && withState) {
        return districtVsState(p, ds[0], inds, keySet);
      }
      if (inds.length === 1 && !keySet) {
        const ind = inds[0], per = pickPeriod(ind, p);
        const vals = ds.map(d => ({ d, v: val(ind, d, per), pos: position(ind, d, per) }));
        const ok = vals.filter(x => x.v != null).sort((a, b) => b.v - a.v);
        if (ok.length >= 2) {
          const hi = ok[0], lo = ok[ok.length - 1];
          let s = ind.label + ' (' + periodOf(ind, per).label + '): ' + listJoin(ds.map(d => { const x = vals.find(y => y.d === d); return '**' + d + '** ' + fmt(ind, x.v) + ' (' + posText(x.pos) + ')'; })) + '.';
          if (ok.length === 2 && hi.v !== lo.v) {
            const ratio = lo.v > 0 && ind.key !== 'population' && hi.v / lo.v >= 1.5 ? ', about ' + num(hi.v / lo.v, 1) + ' times as high' : '';
            s += ' ' + hi.d + ' is higher by ' + fmtDiff(ind, hi.v - lo.v) + ratio + '.';
            if (ind.pol) s += ' Since ' + direction(ind) + ', **' + (ind.pol > 0 ? hi.d : lo.d) + '** does better here.';
          }
          blocks.push(para(s));
          const md = medianOf(ind, per);
          blocks.push({ type: 'bars', items: vals.filter(x => x.v != null).map(x => ({ label: x.d, value: x.v, text: fmt(ind, x.v, true) }))
            .concat(md != null && ind.key !== 'population' ? [{ label: 'Median district', value: md, text: fmt(ind, md, true), muted: true }] : []) });
          if (hasPrev(ind) && per === 'nfhs5') {
            const ch = ds.map(d => { const a = val(ind, d, 'nfhs4'), b = val(ind, d, 'nfhs5'); return a != null && b != null ? d + ' ' + fmt(ind, a) + ' → ' + fmt(ind, b) : null; }).filter(Boolean);
            if (ch.length) blocks.push(para('Change since NFHS-4: ' + ch.join('; ') + '.'));
          }
        } else {
          blocks.push(para('The portal doesn’t have ' + ind.name + ' for all of ' + listJoin(ds) + '.'));
        }
      } else {
        const tableRows = [];
        const wins = {};
        ds.forEach(d => { wins[d] = 0; });
        let scored = 0;
        const gaps = [];
        inds.forEach(ind => {
          const per = pickPeriod(ind, p);
          const vs = ds.map(d => val(ind, d, per));
          let mark = '';
          if (ind.pol && vs.every(v => v != null)) {
            const bestV = ind.pol > 0 ? Math.max.apply(null, vs) : Math.min.apply(null, vs);
            const winners = ds.filter((d, i) => vs[i] === bestV);
            if (winners.length === 1) { wins[winners[0]]++; mark = winners[0]; }
            else mark = 'tie';
            scored++;
            if (ds.length === 2 && vs[0] !== vs[1]) {
              const md = medianOf(ind, per) || 1;
              gaps.push({ ind, per, rel: Math.abs(vs[0] - vs[1]) / Math.abs(md), vs });
            }
          }
          tableRows.push([ind.label + (ind.key === 'population' ? ' (' + per + ')' : '')].concat(vs.map(v => fmt(ind, v, true))).concat([mark || '—']));
        });
        const lead = ds.slice().sort((a, b) => wins[b] - wins[a]);
        let s = 'Comparing **' + listJoin(ds) + '**' + themeNote + ' on ' + inds.length + ' indicators.';
        if (scored) s += ' Where a better direction is clear (' + scored + ' indicators), ' + listJoin(lead.map(d => d + ' does better on ' + wins[d])) + '.';
        blocks.push(para(s));
        blocks.push({ type: 'table', head: ['Indicator'].concat(ds).concat(['Better']), rows: tableRows });
        if (gaps.length) {
          gaps.sort((a, b) => b.rel - a.rel);
          blocks.push(para('Widest gaps: ' + gaps.slice(0, 3).map(g => g.ind.name + ' (' + fmt(g.ind, g.vs[0]) + ' vs ' + fmt(g.ind, g.vs[1]) + ')').join('; ') + '.'));
        }
        blocks.push({ type: 'note', text: 'Counting indicators is a rough summary: they differ in importance and in year (Census 2011, NFHS-5 2019–21, UDISE+ 2024–25).' });
      }
      if (inds.length === 1) blocks.push(sourceNote(inds));
      return answer(blocks, [LINK.duel].concat(ds.map(districtLink)).concat(relatedLinks(p, inds.length === 1 ? [inds[0].theme] : p.themes)),
        suggestFor(p, 'compare'), { intent: 'compare' });
    }

    function districtVsState(p, d, inds) {
      const rowsOut = inds.map(ind => {
        const per = pickPeriod(ind, p);
        const st = stateValue(ind, per), md = medianOf(ind, per);
        const pos = position(ind, d, per);
        return [ind.label, fmt(ind, val(ind, d, per), true), st ? fmt(ind, st.v, true) : '—', ind.key === 'population' ? '—' : fmt(ind, md, true), pos ? posText(pos) : '—'];
      });
      return answer([
        para('**' + d + '** against Odisha. Where the portal has no state figure, the median of the 30 districts stands in.'),
        { type: 'table', head: ['Indicator', d, 'Odisha', 'Median district', 'Position'], rows: rowsOut },
        { type: 'note', text: 'The median district is a typical district, not a population-weighted state average.' }
      ], [districtLink(d), LINK.duel], suggestFor(p, 'district'), { intent: 'compare' });
    }

    function groupAnswer(p) {
      const gk = p.groups.slice(0, 2);
      const inds = p.indicators.filter(i => !i.nationalOnly).length
        ? p.indicators.filter(i => !i.nationalOnly)
        : (p.themes.length ? dataInds().filter(i => i.theme === p.themes[0] && i.pol !== 0).slice(0, 8) : KEY_SET.map(k => byKey[k]).filter(k => k && k.key !== 'population'));
      const sets = gk.map(k => ({ k, label: GROUPS[k].label, members: names.filter(n => GROUPS[k].test(byName[n])) }));
      if (sets.length === 1) {
        const rest = names.filter(n => sets[0].members.indexOf(n) === -1);
        sets.push({ k: 'rest', label: 'other districts', members: rest });
      }
      const avg = (ind, members, per) => { const v = members.map(n => val(ind, n, per)).filter(x => x != null); return v.length ? mean(v) : null; };
      const blocks = [para('**' + sets[0].label.replace(/^\w/, c => c.toUpperCase()) + '** (' + sets[0].members.length + '): ' + sets[0].members.join(', ') + '.')];
      if (inds.length === 1) {
        const ind = inds[0], per = pickPeriod(ind, p);
        const a = avg(ind, sets[0].members, per), b = avg(ind, sets[1].members, per);
        let s = 'Average ' + ind.name + ' (' + periodOf(ind, per).label + '): ' + sets[0].label + ' ' + fmt(ind, a) + ', ' + sets[1].label + ' ' + fmt(ind, b) + '.';
        if (ind.pol && a !== b) s += ' Since ' + direction(ind) + ', the ' + (ind.pol * (a - b) > 0 ? sets[0].label : sets[1].label) + ' do better on average.';
        blocks.push(para(s));
        blocks.push({ type: 'bars', items: sets[0].members.map(n => ({ label: n, value: val(ind, n, per), text: fmt(ind, val(ind, n, per), true) })).filter(x => x.value != null).sort((x, y) => y.value - x.value)
          .concat([{ label: sets[1].label.replace(/^\w/, c => c.toUpperCase()) + ' (avg)', value: b, text: fmt(ind, b, true), muted: true }]) });
      } else {
        blocks.push({ type: 'table', head: ['Indicator (average)', sets[0].label, sets[1].label], rows: inds.map(ind => { const per = pickPeriod(ind, p); return [ind.label, fmt(ind, avg(ind, sets[0].members, per), true), fmt(ind, avg(ind, sets[1].members, per), true)]; }) });
      }
      blocks.push({ type: 'note', text: 'Averages are simple means of district figures, not weighted by population.' });
      blocks.push(sourceNote(inds.length === 1 ? inds : []));
      return answer(blocks, [LINK.map].concat(relatedLinks(p, inds.length === 1 ? [inds[0].theme] : p.themes)),
        ['Which KBK district has the lowest literacy?', 'Coastal vs KBK districts on stunting', 'Southern division on health'], { intent: 'group' });
    }

    function trendAnswer(p) {
      const ind = p.indicators.find(i => i.periods.length > 1) || p.indicators[0];
      const d = p.districts[0];
      const who = d || 'Odisha';
      const blocks = [];
      if (ind.key === 'population') {
        const get = y => (d ? val(ind, d, y) : ind.stateRaw(y));
        const pick = ['1951', '1971', '1991', '2001', '2011', '2021', '2026', '2036'].filter(y => get(y) != null);
        const first = pick[0], census = '2011', end = pick[pick.length - 1];
        blocks.push(para('**' + who + '**’s population grew from ' + fmt(ind, get(first)) + ' in ' + first + ' to **' + fmt(ind, get(census)) + '** at the 2011 Census, and is projected at **' + fmt(ind, get(end)) + '** by ' + end + '.'));
        blocks.push({ type: 'bars', items: pick.map(y => ({ label: y + (+y > 2011 ? ' (proj.)' : ''), value: get(y), text: fmt(ind, get(y)), muted: +y > 2011 })) });
        const dec = [['1991', '2001'], ['2001', '2011'], ['2011', '2021'], ['2021', '2031']].filter(x => get(x[0]) && get(x[1]))
          .map(x => ({ span: x[0] + '–' + x[1].slice(2), g: (get(x[1]) / get(x[0]) - 1) * 100, proj: +x[1] > 2011 }));
        if (dec.length >= 3) {
          const slowing = dec[dec.length - 1].g < dec[0].g;
          blocks.push(para('Growth per decade ' + (slowing ? 'is slowing' : 'is not slowing') + ': ' + dec.map(x => num(x.g, 1) + '% in ' + x.span + (x.proj ? ' (projected)' : '')).join(', ') + '.'));
        }
        blocks.push({ type: 'note', text: 'Figures after 2011 are projections, not counts. Source — ' + ind.source + '.' });
      } else if (ind.key === 'tfr') {
        if (!d) return overviewAnswer(p);
        const ids = ind.periods.map(x => x.id);
        const pick = ids.filter((y, i) => i === 0 || ['2020', '2024', '2028', '2032', '2036'].indexOf(y) !== -1);
        const vals = pick.map(y => ({ y, v: val(ind, d, y), label: periodOf(ind, y).label }));
        const a = vals[0], b = vals.find(x => x.y === '2020') || vals[1], z = vals[vals.length - 1];
        let s = '**' + d + '**’s total fertility rate was ' + fmt(ind, a.v) + ' in ' + a.label + ', ' + fmt(ind, b.v) + ' in ' + b.label + ', and is projected at **' + fmt(ind, z.v) + '** by ' + z.y + '.';
        if (a.v >= 2.1) {
          const cross = ids.map(y => ({ y, v: val(ind, d, y) })).find(x => x.v != null && x.v < 2.1);
          s += cross ? ' It falls below the replacement level of 2.1 in ' + periodOf(ind, cross.y).label + '.' : ' It stays at or above the replacement level of 2.1.';
        } else {
          s += ' It was already below the replacement level of 2.1 in NFHS-4.';
        }
        blocks.push(para(s));
        blocks.push({ type: 'bars', items: vals.map(x => ({ label: x.label.replace(' projection', ' (proj.)'), value: x.v, text: fmt(ind, x.v, true), muted: !!periodOf(ind, x.y).projected })) });
        blocks.push({ type: 'note', text: 'Values after 2020 are projections. Source — ' + ind.source + '.' });
      } else if (hasPrev(ind)) {
        if (!d) return overviewAnswer(p);
        const a = val(ind, d, 'nfhs4'), b = val(ind, d, 'nfhs5');
        if (a == null || b == null) return valueAnswer(p);
        const ch = names.map(n => ({ n, g: ind.pol * ((val(ind, n, 'nfhs5') || 0) - (val(ind, n, 'nfhs4') || 0)) }));
        const myG = ind.pol * (b - a);
        const rank = 1 + ch.filter(x => x.g > myG).length;
        let s = '**' + d + '** — ' + ind.label + ' went from ' + fmt(ind, a) + ' in NFHS-4 (2015–16) to **' + fmt(ind, b) + '** in NFHS-5 (2019–21)';
        s += a === b ? ', unchanged.' : ', ' + (b > a ? 'up' : 'down') + ' ' + fmtDiff(ind, b - a) + '.';
        if (ind.pol && a !== b) s += ' That is ' + (myG > 0 ? 'an improvement' : 'a setback') + ' (' + direction(ind) + '); ' + (rank <= 15 ? ordinal(rank) + ' best change' : ordinal(ch.length - rank + 1) + ' weakest change') + ' of ' + ch.length + ' districts.';
        blocks.push(para(s));
        blocks.push({ type: 'bars', items: [{ label: 'NFHS-4 (2015–16)', value: a, text: fmt(ind, a, true) }, { label: 'NFHS-5 (2019–21)', value: b, text: fmt(ind, b, true) }] });
        blocks.push(nfhs6Note(p) || para('NFHS-6 figures for this district are on the district health page.'));
        blocks.push(sourceNote([ind]));
      } else {
        const r = d ? valueAnswer(p) : overviewAnswer(p);
        r.blocks.push({ type: 'note', text: 'The portal has only one time point for ' + ind.name + ' (' + ind.source + '), so there is no trend to show.' });
        return r;
      }
      return answer(blocks, [d ? districtLink(d) : LINK.map, indLink(ind)].concat(relatedLinks(p, [ind.theme])),
        d ? ['Compare ' + d + ' and ' + peerOf(d) + ' on ' + ind.name, 'Which district has the highest ' + ind.name + '?', 'What should ' + d + ' focus on?'] : suggestFor(p, 'indicator'),
        { intent: 'trend' });
    }

    function correlates(target, per) {
      const out = [];
      dataInds().forEach(ind => {
        if (ind === target || ind.key === 'population' || sameFamily(ind.key, target.key)) return;
        const xs = [], ys = [];
        names.forEach(n => { const a = val(ind, n), b = val(target, n, per); if (a != null && b != null) { xs.push(a); ys.push(b); } });
        if (xs.length < 20) return;
        out.push({ ind, r: corr(xs, ys), n: xs.length });
      });
      return oneFamilyEach(out.filter(x => Math.abs(x.r) >= 0.4).sort((a, b) => Math.abs(b.r) - Math.abs(a.r)));
    }
    // Keep only the first of near-duplicate indicators (literacy, female literacy...).
    function oneFamilyEach(list) {
      const kept = [];
      list.forEach(x => { if (!kept.some(k => sameFamily(k.ind.key, x.ind.key))) kept.push(x); });
      return kept;
    }
    function strength(r) { const a = Math.abs(r); return a >= 0.7 ? 'strong' : a >= 0.5 ? 'moderate' : 'weak-to-moderate'; }

    function whyAnswer(p) {
      const target = p.indicators.find(i => !i.nationalOnly && i.key !== 'population');
      if (!target) return fallback(p);
      const per = pickPeriod(target, p);
      const d = p.districts[0];
      const cs = correlates(target, per).slice(0, 4);
      const blocks = [];
      if (d) {
        const pos = position(target, d, per);
        if (pos) blocks.push(para('**' + d + '** — ' + target.label + ': ' + fmt(target, pos.v) + ', ' + posText(pos) + '.'));
      }
      if (!cs.length) {
        blocks.push(para('Across the 30 districts, no other indicator in the portal moves closely with ' + target.name + ' (no correlation of 0.4 or more). The explanation probably lies in factors the portal doesn’t measure at district level.'));
      } else {
        blocks.push(para('Looking across the 30 districts, ' + target.name + ' (' + target.label.toLowerCase() + ') moves with:'));
        blocks.push({ type: 'list', items: cs.map(c => {
          let s = 'Districts with higher ' + c.ind.name + ' tend to have ' + (c.r > 0 ? 'higher' : 'lower') + ' ' + target.name + ' (' + strength(c.r) + ', r = ' + (c.r < 0 ? '−' : '') + num(Math.abs(c.r), 2) + ').';
          if (d) { const q = position(c.ind, d); if (q) s += ' ' + d + ': ' + fmt(c.ind, q.v) + ', ' + posText(q) + '.'; }
          return s;
        }) });
      }
      blocks.push({ type: 'note', text: 'These are associations between districts, not proof of cause. Many indicators move together because they share deeper drivers such as poverty, remoteness and tribal share.' });
      return answer(blocks, [LINK.learn, d ? districtLink(d) : null].concat(relatedLinks(p, [target.theme], 3)),
        [d ? 'What should ' + d + ' focus on?' : 'Which district has the highest ' + target.name + '?', cs[0] ? 'Which district has the lowest ' + cs[0].ind.name + '?' : 'Tell me about Koraput', 'Compare KBK districts with the rest on ' + target.name],
        { intent: 'why', needsLLM: true, memory: { indicators: [target.key] } });
    }

    function assessDistrict(d, theme) {
      const inds = dataInds().filter(i => i.pol !== 0 && (!theme || i.theme === theme));
      const pts = inds.map(ind => ({ ind, pos: position(ind, d) })).filter(x => x.pos);
      const q = n => Math.ceil(n / 6);
      const strengths = oneFamilyEach(pts.filter(x => x.pos.good <= q(x.pos.n)).sort((a, b) => a.pos.good - b.pos.good));
      const concerns = oneFamilyEach(pts.filter(x => x.pos.good > x.pos.n - q(x.pos.n)).sort((a, b) => b.pos.good - a.pos.good));
      const changes = inds.filter(hasPrev).map(ind => {
        const a = val(ind, d, 'nfhs4'), b = val(ind, d, 'nfhs5');
        if (a == null || b == null || a === b) return null;
        return { ind, a, b, rel: ind.pol * (b - a) / Math.max(Math.abs(a), 1e-9) };
      }).filter(Boolean);
      return {
        strengths, concerns,
        gains: changes.filter(x => x.rel > 0.05).sort((x, y) => y.rel - x.rel),
        setbacks: changes.filter(x => x.rel < -0.05).sort((x, y) => x.rel - y.rel)
      };
    }
    function ptText(x) { return x.ind.label + ': ' + fmt(x.ind, x.pos.v) + ' (' + posText(x.pos) + ')'; }
    function chText(x) { return x.ind.label + ': ' + fmt(x.ind, x.a) + ' → ' + fmt(x.ind, x.b); }

    function assessAnswer(p) {
      const d = p.districts[0];
      const theme = p.themes[0] || null;
      if (!d) {
        const ind = p.indicators.find(i => !i.nationalOnly && i.pol !== 0);
        if (ind) {
          const per = pickPeriod(ind, p);
          const worst = series(ind, per).sort((a, b) => ind.pol * (a.v - b.v)).slice(0, 5);
          const cs = correlates(ind, per).slice(0, 2);
          const blocks = [
            para('On ' + ind.name + ' (' + direction(ind) + '), the districts furthest behind are:'),
            { type: 'bars', items: worst.map(x => ({ label: x.name, value: x.v, text: fmt(ind, x.v, true) })) },
            para((refLine(ind, per) ? refLine(ind, per).replace(/^\w/, c => c.toUpperCase()) + '. ' : '') + (cs.length ? 'Across districts it moves with ' + listJoin(cs.map(c => c.ind.name + ' (r = ' + (c.r < 0 ? '−' : '') + num(Math.abs(c.r), 2) + ')')) + ', so progress on those may go together. ' : '') + 'Those districts are the natural place to focus.'),
            { type: 'note', text: 'A reading of the portal’s figures, not a policy assessment. Local context and newer data (NFHS-6) matter.' },
            sourceNote([ind])
          ];
          return answer(blocks, [indLink(ind)].concat(relatedLinks(p, [ind.theme], 3)), suggestFor(p, 'indicator'), { intent: 'assess', needsLLM: true });
        }
        if (p.groups.length) return groupAnswer(p);
        return answer([para('Tell me which district (or indicator) you have in mind, e.g. “What should Malkangiri focus on?” or “Where is child marriage a concern?”.')],
          [], ['What should Malkangiri focus on?', 'How is Khordha doing?', 'Where is child marriage a concern?'], { intent: 'assess', needsLLM: true });
      }
      const r = assessDistrict(d, theme);
      const row = byName[d];
      const tags = [row.division + ' division', row.kbk ? 'KBK district' : null, row.coastal ? 'coastal' : null].filter(Boolean).join(' · ');
      const blocks = [para('**' + d + '**' + (theme ? ' on ' + theme : '') + ' — a reading of the portal’s indicators (' + tags + ').')];
      if (r.strengths.length) { blocks.push(para('**Where it does well**')); blocks.push({ type: 'list', items: r.strengths.slice(0, 4).map(ptText) }); }
      if (r.concerns.length) { blocks.push(para('**Where it lags**')); blocks.push({ type: 'list', items: r.concerns.slice(0, 4).map(ptText) }); }
      if (!r.strengths.length && !r.concerns.length) blocks.push(para(d + ' sits in the middle of the districts on most indicators, with no extreme highs or lows.'));
      if (r.gains.length || r.setbacks.length) {
        blocks.push(para('**Change since NFHS-4 (2015–16 → 2019–21)**'));
        blocks.push({ type: 'list', items: r.gains.slice(0, 2).map(x => '↑ Better: ' + chText(x)).concat(r.setbacks.slice(0, 2).map(x => '↓ Worse: ' + chText(x))) });
      }
      const focus = r.concerns.slice(0, 3).map(x => x.ind.name).concat(r.setbacks.slice(0, 2).map(x => x.ind.name));
      const uniq = focus.filter((x, i) => focus.indexOf(x) === i).slice(0, 4);
      if (uniq.length) blocks.push(para('**Where the data points to attention:** ' + listJoin(uniq) + '. These are the indicators where ' + d + ' is furthest behind other districts or has slipped since NFHS-4.'));
      blocks.push({ type: 'note', text: 'Ranks compare ' + d + ' with the other 29 districts, using the latest year the portal holds for each indicator. This reads the figures, not the local context; programmes on the ground and newer data (NFHS-6) may change the picture.' });
      const themesHit = uniq.length ? r.concerns.slice(0, 2).map(x => x.ind.theme) : [];
      return answer(blocks, [districtLink(d), LINK.health].concat(relatedLinks(Object.assign({}, p, { stems: p.stems.concat(r.concerns.slice(0, 2).flatMap(x => x.ind.phrases[0])) }), themesHit, 2)),
        [r.concerns[0] ? 'Why is ' + r.concerns[0].ind.name + ' ' + (r.concerns[0].pos.hi <= r.concerns[0].pos.lo ? 'high' : 'low') + ' in ' + d + '?' : 'Tell me about ' + d, 'Compare ' + d + ' and ' + peerOf(d), 'How has ' + d + '’s population changed?'],
        { intent: 'assess', needsLLM: true });
    }

    function profileAnswer(p) {
      const d = p.districts[0];
      if (p.themes.length) return assessAnswer(p);
      const row = byName[d];
      const tags = [row.division + ' division', row.kbk ? 'KBK district' : null, row.coastal ? 'coastal' : null].filter(Boolean).join(' · ');
      const inds = KEY_SET.map(k => byKey[k]).filter(Boolean);
      const rowsOut = inds.map(ind => { const pos = position(ind, d); return [ind.label + (ind.key === 'population' ? ' (2011)' : ''), fmt(ind, val(ind, d), true), pos ? posText(pos) : '—']; });
      const blocks = [para('**' + d + '** — ' + tags + '.')];
      const pp = byKey.population;
      if (pp) {
        const a = val(pp, d, '2011'), b = val(pp, d, '2036');
        if (a != null) blocks.push(para('Population ' + fmt(pp, a) + ' at the 2011 Census' + (b != null ? ', projected ' + fmt(pp, b) + ' by 2036' : '') + '.'));
      }
      blocks.push({ type: 'table', head: ['Indicator', d, 'Position'], rows: rowsOut });
      const r = assessDistrict(d);
      const bits = [];
      if (r.strengths[0]) bits.push('stands out on ' + listJoin(r.strengths.slice(0, 2).map(x => x.ind.name)));
      if (r.concerns[0]) bits.push('lags on ' + listJoin(r.concerns.slice(0, 2).map(x => x.ind.name)));
      if (bits.length) blocks.push(para('In short, ' + d + ' ' + bits.join(' but ') + '.'));
      return answer(blocks, [districtLink(d), LINK.duel], suggestFor(p, 'district'), { intent: 'profile' });
    }

    function nationalAnswer(p) {
      const regs = p.regions.filter(r => r !== 'odisha' && r !== 'india');
      const cols = ['odisha', 'india'].concat(regs).slice(0, 5);
      let rowsN = NAT;
      if (p.indicators.length) {
        const keys = p.indicators.map(i => i.key);
        rowsN = NAT.filter(n => keys.indexOf(n.key) !== -1);
        if (p.year) { const y = rowsN.filter(n => n.year.indexOf(p.year) === 0); if (y.length) rowsN = y; }
      }
      if (!rowsN.length) return null;
      const fmtN = (n, v) => (v == null ? 'n/a' : /^population/i.test(n.full) || /^st population$/i.test(n.label) ? indian(v) : num(v, v % 1 ? 2 : 0) + (/%/.test(n.full) || /share|rate|lfpr/i.test(n.full) ? '%' : ''));
      const blocks = [];
      if ((p.flags.stateWord || (!regs.length && (p.flags.high || p.flags.low || p.flags.best || p.flags.worst))) && rowsN.length) {
        const n = rowsN[0];
        const list = Object.keys(n.values).filter(k => k !== 'india').map(k => ({ k, v: n.values[k] }));
        const hi = !(p.flags.low && !p.flags.high);
        list.sort((a, b) => (hi ? b.v - a.v : a.v - b.v));
        const oRank = 1 + list.findIndex(x => x.k === 'odisha');
        blocks.push(para(n.label + ' (' + n.year + '), ' + list.length + ' states in the portal: **' + REGIONS[list[0].k].name + '** is ' + (hi ? 'highest' : 'lowest') + ' at ' + fmtN(n, list[0].v) + '. Odisha is ' + ordinal(oRank) + ' at ' + fmtN(n, n.values.odisha) + '; India ' + fmtN(n, n.values.india) + '.'));
        blocks.push({ type: 'bars', items: list.map(x => ({ label: REGIONS[x.k].name, value: x.v, text: fmtN(n, x.v), hl: x.k === 'odisha' })) });
        blocks.push({ type: 'note', text: 'Source — ' + n.source + '.' });
      } else {
        const lines = rowsN.slice(0, 3).map(n => {
          let s = n.label + ', ' + n.year + ': Odisha ' + fmtN(n, n.values.odisha) + ', India ' + fmtN(n, n.values.india);
          regs.forEach(r => { if (n.values[r] != null) s += ', ' + REGIONS[r].name + ' ' + fmtN(n, n.values[r]); });
          return s + '.';
        });
        blocks.push(para(lines.join(' ')));
        if (rowsN.length > 1) blocks.push({ type: 'table', head: ['Indicator (year)'].concat(cols.map(c => REGIONS[c].name)), rows: rowsN.map(n => [n.label + ' (' + n.year + ')'].concat(cols.map(c => fmtN(n, n.values[c])))) });
        blocks.push({ type: 'note', text: 'Sources — ' + Array.from(new Set(rowsN.map(n => n.source))).join(', ') + '.' });
      }
      return answer(blocks, [LINK.states].concat(relatedLinks(p, [(p.indicators[0] || {}).theme])),
        ['Which state has the highest sex ratio at birth?', 'Odisha vs Kerala', 'Female labour force participation in Odisha vs India'], { intent: 'national' });
    }

    function contentAnswer(p, lead) {
      const found = searchDocs(p.stems, p.themes[0], 5);
      const blocks = [];
      if (lead) blocks.push(lead);
      if (found.length) blocks.push(para(lead ? 'Related reading on the portal:' : 'Here’s what the portal has on that:'));
      else if (!lead) blocks.push(para('I couldn’t find an article or report matching that. The repository lists every report and dataset.'));
      const links = found.map(docLink);
      if (p.themes[0]) links.push({ title: '📊 ' + p.themes[0].replace(/^\w/, c => c.toUpperCase()) + ' theme', url: 'theme_detail.html?theme=' + p.themes[0] });
      links.push(LINK.repo);
      return answer(blocks, links, suggestFor(p), { intent: 'content' });
    }

    function policyAnswer(p) {
      const a = contentAnswer(p, para('Odisha has rolled out major welfare milestones like the Mamata scheme (maternity cash benefits) and the Biju Swasthya Kalyan Yojana (BSKY, cashless health care). The policy timelines on the home page trace them.'));
      a.links.unshift(LINK.timeline);
      a.intent = 'policy';
      return a;
    }

    function themeOverview(p) {
      const th = p.themes[0];
      const inds = dataInds().filter(i => i.theme === th && i.pol !== 0).slice(0, 8);
      if (!inds.length) return contentAnswer(p);
      const rowsOut = inds.map(ind => {
        const s = series(ind).sort((a, b) => ind.pol * (b.v - a.v));
        return [ind.label, s[0].name + ' ' + fmt(ind, s[0].v, true), s[s.length - 1].name + ' ' + fmt(ind, s[s.length - 1].v, true)];
      });
      const r = contentAnswer(p);
      r.blocks = [para('**' + th.replace(/^\w/, c => c.toUpperCase()) + '** across the districts: the best- and worst-placed district on each indicator.'),
        { type: 'table', head: ['Indicator', 'Best', 'Furthest behind'], rows: rowsOut }].concat(r.blocks.length ? [para('Related reading on the portal:')] : []);
      r.intent = 'theme';
      r.suggestions = ['Which district has the lowest ' + inds[0].name + '?', 'How is Koraput doing on ' + th + '?', 'Compare Khordha and Malkangiri on ' + th];
      return r;
    }

    function fallback(p) {
      const found = searchDocs(p.stems, p.themes[0], 4);
      const blocks = [para(found.length
        ? 'I couldn’t match that to a district figure, but these pages on the portal look relevant:'
        : 'I couldn’t match that to the portal’s data. Try naming a district (e.g. Koraput) or an indicator (literacy, infant mortality, stunting, fertility, child marriage…).')];
      return answer(blocks, found.map(docLink).concat([LINK.themes, LINK.repo]), suggestFor(p), { intent: 'fallback', needsLLM: true });
    }

    /* ── routing ───────────────────────────────────────── */

    function respond(query, ctx) {
      const q = String(query || '').trim();
      if (!q) return help();
      const p = parse(q, ctx);
      const f = p.flags;
      const hasData = p.districts.length || p.indicators.length || p.groups.length || p.regions.length || p.themes.length;
      let a;

      if (f.greet && !hasData && p.words.length <= 4) a = greet();
      else if (f.thanks && !hasData) a = answer([para('Glad to help. Ask me anything else about the districts.')], [], suggestFor(p), { intent: 'thanks' });
      else if (f.help && !hasData) a = help();
      else if (f.policy && !p.indicators.length && !p.districts.length) a = policyAnswer(p);
      else {
        const ind = p.indicators.find(i => !i.nationalOnly);
        const natOnly = p.indicators.length && p.indicators.every(i => i.nationalOnly);
        const otherRegion = p.regions.some(r => r !== 'odisha');
        const multiD = p.districts.length >= 2;

        if ((otherRegion || natOnly || (f.stateWord && !p.districts.length)) && !p.districts.length) a = nationalAnswer(p);
        if (!a && f.content && !ind && !p.districts.length) a = contentAnswer(p);
        if (!a && f.why && ind && !f.assessStrong) a = whyAnswer(p);
        if (!a && (f.assessStrong || (f.assess && !ind)) && !multiD && !(p.groups.length && !p.districts.length && !f.assessStrong)) a = assessAnswer(p);
        if (!a && f.improve && ind && hasPrev(ind) && !p.districts.length && (f.high || f.low || f.best || f.worst || f.which)) a = improveAnswer(p);
        if (!a && p.groups.length && !p.districts.length && !(ind && (f.high || f.low || f.best || f.worst || p.threshold || p.topN))) a = groupAnswer(p);
        if (!a && (multiD || (p.districts.length === 1 && f.compare && (p.state || /\b(average|median|rest|other districts|typical)\b/.test(p.text))))) a = compareAnswer(p);
        if (!a && ind && (f.trendStrong || (f.trendWeak && !p.year) || (f.improve && p.districts.length)) && ind.periods.length > 1) a = trendAnswer(p);
        if (!a && ind && !p.districts.length && (p.threshold || p.topN || f.high || f.low || f.best || f.worst || /\b(which|what|name|list)\b.*\bdistricts?\b/.test(p.text))) {
          a = (p.state && !f.high && !f.low && !f.best && !f.worst && !p.threshold) ? stateValueAnswer(p, ind) : rankAnswer(p);
        }
        if (!a && ind && p.districts.length === 1) a = valueAnswer(p);
        if (!a && ind && !p.districts.length) a = p.state ? stateValueAnswer(p, ind) : overviewAnswer(p);
        if (!a && p.districts.length === 1) a = (f.assess || f.assessStrong) ? assessAnswer(p) : profileAnswer(p);
        if (!a && p.themes.length) a = themeOverview(p);
        if (!a && p.state) a = nationalAnswer(Object.assign({}, p, { indicators: [] }));
        if (!a && (f.content || f.policy)) a = contentAnswer(p);
        if (!a) a = fallback(p);
      }

      const mem = a.memory || {};
      a.memory = {
        districts: mem.districts || (p.districts.length ? p.districts.slice() : (ctx && ctx.last && ctx.last.districts) || []),
        indicators: mem.indicators || (p.indicators.length ? p.indicators.map(i => i.key) : (ctx && ctx.last && ctx.last.indicators) || [])
      };
      if (p.indicators.length && !p.districts.length && ['rank', 'overview', 'improve', 'national', 'group'].indexOf(a.intent) !== -1) a.memory.districts = [];
      return a;
    }

    function stateValueAnswer(p, ind) {
      const per = pickPeriod(ind, p);
      const st = stateValue(ind, per);
      const nat = NAT.filter(n => n.key === ind.key);
      if (nat.length) {
        const r = nationalAnswer(p);
        if (r) return r;
      }
      if (st) {
        return answer([para('**Odisha** — ' + ind.label + ': **' + fmt(ind, st.v) + '** (' + periodOf(ind, per).label + ').'), sourceNote([ind])],
          [indLink(ind), LINK.states], suggestFor(p, 'indicator'), { intent: 'value' });
      }
      const r = overviewAnswer(p);
      r.blocks.unshift({ type: 'note', text: 'The portal has no single state-wide figure for ' + ind.name + '; here is how the districts spread.' });
      return r;
    }

    // Opening prompts; on a district page they are about that district.
    function starters(ctx) {
      const d = pageDistrict(ctx);
      if (d) return ['What should ' + d + ' focus on?', 'Compare ' + d + ' with ' + peerOf(d), 'How has ' + d + '’s population changed?'];
      return ['Which district has the highest infant mortality?', 'Compare Koraput and Ganjam', 'Why is stunting high in some districts?'];
    }

    return { answer: respond, parse, starters, pageDistrict, indicators: IND, names, byKey, correlates };
  }

  const api = { createEngine, words, stems, clean, indian };
  root.SoochanaChat = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
