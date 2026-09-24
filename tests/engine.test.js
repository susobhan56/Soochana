// Core perception engine tests.  Run with:  node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const NS = require('./_load.js');

const { analyzeSeries } = NS.trend;
const { analyzeGap, detectCrossovers, compareGroup, rankEntities } = NS.compare;
const { buildNarration, analyzeDataset } = NS.narrate;

function series(values, extra) {
  return Object.assign({
    id: 's', label: 'Indicator', source: 'Test source',
    values: values.map(([x, y, status]) => ({ x, y, status }))
  }, extra);
}
const years = (start, step, ys, status) => ys.map((y, i) => [start + i * step, y, status]);

test('increasing series: direction, strength, change measures', () => {
  const p = analyzeSeries(series(years(2011, 5, [10, 12, 14, 16, 18, 20]), { unitKind: 'count' }));
  assert.equal(p.direction, 'increasing');
  assert.equal(p.strength, 'strong');
  assert.equal(p.absoluteChange, 10);
  assert.equal(p.relativeChangePct, 100);
  assert.equal(p.shape, 'linear_increase');
  assert.equal(p.turningPoints.length, 0);
  assert.equal(p.peak, null, 'an endpoint maximum is not a peak');
  assert.equal(p.highest.x, 2036);
});

test('decreasing series', () => {
  const p = analyzeSeries(series(years(1991, 10, [32, 29, 26, 22]), { unitKind: 'percent' }));
  assert.equal(p.direction, 'decreasing');
  assert.equal(p.percentagePointChange, -10);
  assert.equal(p.netDirection, 'down');
});

test('stable series: tiny movement is not "significant"', () => {
  const p = analyzeSeries(series([[2011, 51.1], [2016, 51.15], [2021, 51.2]], { unitKind: 'percent' }));
  assert.equal(p.direction, 'stable');
  assert.equal(p.shape, 'plateau');
  const text = NS.language.describeTrend(p).story;
  assert.match(text, /broadly stable/);
  assert.doesNotMatch(text, /significant/);
});

test('noisy series with a clear net rise is still increasing, and the noise is not a turning point', () => {
  const p = analyzeSeries(series(years(2000, 1, [100, 101.5, 101, 103, 102.6, 104.8, 104.5, 106, 108]), { unitKind: 'count', minChange: 2 }));
  assert.equal(p.direction, 'increasing');
  assert.equal(p.turningPoints.length, 0);
});

test('genuinely fluctuating series is "mixed"', () => {
  const p = analyzeSeries(series(years(2000, 1, [10, 20, 9, 21, 10, 20, 11]), { unitKind: 'count', minChange: 2 }));
  assert.equal(p.direction, 'mixed');
  assert.equal(p.shape, 'fluctuating');
  assert.ok(p.turningPoints.length >= 2);
});

test('peak: rise then fall is an inverted U with an interior peak', () => {
  const p = analyzeSeries(series([[1991, 54.8], [2001, 58.6], [2011, 63.0], [2021, 65.7], [2026, 65.4], [2036, 62.9]], { unitKind: 'percent' }));
  assert.equal(p.shape, 'inverted_u');
  assert.equal(p.peak.x, 2021);
  assert.equal(p.turningPoints[0].type, 'peak');
});

test('trough: fall then recovery is U-shaped', () => {
  const p = analyzeSeries(series([[1951, 1022], [1961, 1001], [1971, 988], [1991, 971], [2011, 979], [2036, 1022]], { minChange: 10 }));
  assert.equal(p.shape, 'u_shaped');
  assert.equal(p.trough.x, 1991);
  assert.equal(p.direction, 'mixed');
});

test('acceleration and deceleration', () => {
  const acc = analyzeSeries(series(years(2011, 5, [9.3, 10, 11.2, 13, 15.1, 18.1]), { unitKind: 'percent' }));
  assert.equal(acc.shape, 'accelerating_increase');
  const dec = analyzeSeries(series(years(2011, 5, [100, 120, 135, 145, 150, 152]), { unitKind: 'count' }));
  assert.equal(dec.shape, 'decelerating_increase');
});

test('reference crossing: replacement-level fertility', () => {
  const p = analyzeSeries(series([[2016, 2.4], [2020, 2.2, 'computed'], [2021, 2.05, 'projected'], [2026, 1.8, 'projected']], {
    references: [{ value: 2.1, label: 'replacement level' }], minChange: 0.1
  }));
  const ref = p.references[0];
  assert.equal(ref.crossing.direction, 'below');
  assert.equal(ref.crossing.status, 'projected');
  assert.ok(ref.crossing.x > 2020 && ref.crossing.x < 2021);
  assert.equal(ref.endPosition, 'below');
});

test('crossover between two series', () => {
  const young = series(years(2011, 5, [32, 29, 26, 22, 19, 17]), { id: 'young' });
  const elderly = series(years(2011, 5, [10, 11, 14, 18, 20, 22]), { id: 'elderly' });
  const cs = detectCrossovers(young, elderly);
  assert.equal(cs.length, 1);
  assert.equal(cs[0].leaderBefore, 'young');
  assert.equal(cs[0].leaderAfter, 'elderly');
  assert.ok(cs[0].x > 2026 && cs[0].x < 2031);
});

test('convergence: narrowing gap', () => {
  const g = analyzeGap(series(years(2000, 5, [30, 28, 26, 24])), series(years(2000, 5, [10, 13, 16, 19])), 1);
  assert.equal(g.direction, 'narrowing');
  assert.equal(g.start.gap, 20);
  assert.equal(g.end.gap, 5);
});

test('divergence: widening gap, and spread across several series', () => {
  const g = analyzeGap(series(years(2000, 5, [10, 12, 15, 20])), series(years(2000, 5, [10, 10.5, 11, 11])), 1);
  assert.equal(g.direction, 'widening');
  const grp = compareGroup([
    series(years(2000, 5, [10, 14, 18]), { id: 'a' }),
    series(years(2000, 5, [10, 11, 12]), { id: 'b' }),
    series(years(2000, 5, [10, 8, 6]), { id: 'c' })
  ]);
  assert.equal(grp.spread.direction, 'diverging');
});

test('ranking change between first and last period', () => {
  const grp = compareGroup([
    series(years(2000, 10, [5, 6, 7]), { id: 'a' }),
    series(years(2000, 10, [6, 6.5, 6.8]), { id: 'b' })
  ]);
  assert.equal(grp.ranking.changed, true);
  assert.deepEqual(grp.ranking.start, ['b', 'a']);
  assert.deepEqual(grp.ranking.end, ['a', 'b']);
});

test('peer ranking and outliers stay descriptive', () => {
  const items = [1.1, 1.12, 1.15, 1.18, 1.2, 1.13, 1.16, 2.39].map((v, i) => ({ id: 'd' + i, value: v }));
  const r = rankEntities(items, 'd7');
  assert.equal(r.selected.rank, 1);
  assert.equal(r.selected.band, 'among_highest');
  assert.equal(r.selected.isOutlier, true);
});

test('percentage-point vs relative change', () => {
  const p = analyzeSeries(series([[2011, 20], [2036, 30]], { unitKind: 'percent' }));
  assert.equal(p.percentagePointChange, 10);
  assert.equal(p.relativeChangePct, 50);
  assert.equal(NS.language.magnitude(p), '10 percentage points');
});

test('population vs growth rate: rising level, falling rate is "still growing, more slowly"', () => {
  const ds = {
    id: 'pop', title: 'Population', geography: { name: 'Odisha' }, source: { name: 'Census' },
    series: [
      series([[2011, 4.19e7], [2021, 4.63e7], [2031, 5.01e7, 'projected'], [2036, 5.15e7, 'projected']],
        { id: 'pop', role: 'population', unitKind: 'count', format: 'persons' }),
      series([[2011, 1.40], [2021, 1.02], [2031, 0.73, 'projected'], [2036, 0.55, 'projected']],
        { id: 'gr', role: 'growth_rate', unitKind: 'rate', format: 'growth', minChange: 0.15 })
    ]
  };
  const n = buildNarration(ds);
  assert.equal(n.insights[0].type, 'population_growth_slowdown');
  assert.match(n.narration, /keeps growing/);
  assert.doesNotMatch(n.narration, /population (is )?(declin|falls|shrink)/i);
  const d = buildNarration(ds, { mode: 'data' });
  assert.match(d.narration, /5\.15 crore/);
  assert.match(d.narration, /0\.55%/);
});

test('observed vs projected: projected horizons use projection language', () => {
  const p = analyzeSeries(series([[2011, 9.3], [2021, 11.2], [2031, 15.1, 'projected'], [2036, 18.1, 'projected']], { unitKind: 'percent', label: 'Elderly share' }));
  assert.equal(p.dataStatus, 'historical_plus_projected');
  assert.equal(p.statusDetail.lastObserved.x, 2021);
  const t = NS.language.describeTrend(p);
  assert.match(t.data, /a projected 18\.1% by 2036/);

  const allProjected = analyzeSeries(series([[2026, 1.5, 'projected'], [2036, 1.3, 'projected']], { label: 'TFR', minChange: 0.1 }));
  assert.equal(allProjected.dataStatus, 'projected');
  assert.match(NS.language.describeTrend(allProjected).story, /is projected to/);
});

test('survey rounds are described as a comparison between rounds', () => {
  const p = analyzeSeries(series([[2016, 42, 'observed'], [2020, 31, 'observed']], { surveyRounds: true, label: 'Infant mortality rate' }));
  p.start.label = 'NFHS-4'; p.end.label = 'NFHS-5';
  assert.equal(p.dataStatus, 'survey_rounds');
  assert.match(NS.language.describeTrend(p).story, /^Between the NFHS-4 and NFHS-5 survey rounds/);
});

test('population pyramid: narrowing base and ageing', () => {
  const young = { '0-4': [120, 115], '5-9': [118, 112], '10-14': [115, 110], '20-24': [100, 98], '30-34': [80, 80], '40-44': [60, 62], '60-64': [30, 34], '70-74': [15, 20] };
  const old = { '0-4': [80, 76], '5-9': [85, 80], '10-14': [90, 86], '20-24': [105, 102], '30-34': [100, 98], '40-44': [90, 90], '60-64': [55, 60], '70-74': [35, 45] };
  const rows = o => Object.keys(o).map(a => ({ age: a, male: o[a][0], female: o[a][1] }));
  const pa = NS.pyramid.analyzePyramid({ years: { 2011: rows(young), 2036: rows(old) }, statusOf: y => (+y > 2011 ? 'projected' : 'observed') });
  assert.equal(pa.first.shape, 'expansive');
  assert.equal(pa.last.shape, 'constrictive');
  assert.ok(pa.patterns.includes('narrowing_base'));
  assert.ok(pa.patterns.includes('ageing'));
  assert.ok(pa.elderlyFemaleSurplus);
  const n = buildNarration({ id: 'pyr', title: 'Pyramid', geography: { name: 'X' }, source: { name: 'Census' }, series: [], pyramid: { years: { 2011: rows(young), 2036: rows(old) }, statusOf: y => (+y > 2011 ? 'projected' : 'observed') } });
  assert.match(n.narration, /narrows at the base/);
  assert.match(n.narration, /projected/);
});

test('age structure: young down, elderly up is ageing, not three separate trends', () => {
  const ds = {
    id: 'age', title: 'Age', geography: { name: 'Odisha' }, source: { name: 'Census' },
    series: [
      series([[2011, 28.5], [2021, 24.1], [2036, 18.2, 'projected']], { id: 'y', role: 'young_share', unitKind: 'percent', format: 'percent' }),
      series([[2011, 63.0], [2021, 65.7], [2036, 62.9, 'projected']], { id: 'w', role: 'working_share', unitKind: 'percent', format: 'percent' }),
      series([[2011, 8.5], [2021, 10.2], [2036, 18.9, 'projected']], { id: 'e', role: 'elderly_share', unitKind: 'percent', format: 'percent' })
    ]
  };
  const n = buildNarration(ds);
  assert.equal(n.insights[0].type, 'ageing');
  assert.match(n.narration, /towards older ages/);
  assert.match(n.narration, /peaks around 2021/);
});

test('missing values, zeros, negatives, duplicate and irregular periods', () => {
  const p = analyzeSeries(series([[1901, 1.0], [1911, null], [1921, -0.19], [1931, 1.19], [1936, 0.99], [1936, 1.0], [1941, 'n/a'], [1971, 2.5], [2036, 0.55, 'projected']], { unitKind: 'rate', minChange: 0.15 }));
  assert.ok(p.warnings.some(w => /duplicate period 1936/.test(w)));
  assert.ok(p.warnings.some(w => /missing or non-numeric/.test(w)));
  assert.ok(p.notes.some(w => /negative/.test(w)), 'negative growth is a note, not a data error');
  assert.equal(p.n, 6);

  const zero = analyzeSeries(series([[2000, 0], [2010, 5], [2020, 10]], { unitKind: 'count' }));
  assert.equal(zero.relativeChangePct, null, 'no relative change from a zero start');
  assert.equal(zero.direction, 'increasing');

  const irregular = analyzeSeries(series([[1901, 10], [1931, 13], [1936, 13.6], [1941, 14.2], [2011, 42]], { unitKind: 'count' }));
  assert.equal(irregular.direction, 'increasing');
  assert.equal(irregular.events.filter(e => e.type === 'sudden_change').length, 0,
    'a long gap between points is not a sudden change');
});

test('insufficient data never throws', () => {
  assert.equal(analyzeSeries(series([])).insufficient, true);
  assert.equal(analyzeSeries(series([[2011, 5]])).insufficient, true);
  const n = buildNarration({ id: 'x', title: 'Empty', series: [series([])] });
  assert.match(n.narration, /not enough data/);
});

test('missing source is reported, never invented', () => {
  const n = buildNarration({ id: 'x', title: 'T', series: [series(years(2000, 5, [1, 2, 3, 4, 5]), { source: null })] });
  assert.equal(n.sourceLabel, 'Source information is not available for this series.');
  assert.notEqual(n.confidence, 'high');
});

test('analyzeDataset matches the documented example', () => {
  const r = analyzeDataset({
    indicator: 'elderly_population_share', unit: '%', geography: 'Odisha', source: 'ORGI',
    series: [{ year: 2011, value: 9.3 }, { year: 2021, value: 11.2 }, { year: 2031, value: 15.1, status: 'projected' }, { year: 2036, value: 18.1, status: 'projected' }]
  });
  assert.equal(r.direction, 'increasing');
  assert.equal(r.trend_strength, 'strong');
  assert.equal(r.absolute_change, 8.8);
  assert.equal(r.relative_change_percent, 94.62);
  assert.equal(r.start_year, 2011);
  assert.equal(r.end_year, 2036);
  assert.deepEqual(r.turning_points, []);
});

test('narration is deterministic and the cache key tracks the data', () => {
  const ds = { id: 'x', title: 'T', geography: { name: 'Puri' }, source: { name: 'S' }, series: [series(years(2000, 5, [1, 2, 3, 4, 5]))] };
  const a = buildNarration(ds), b = buildNarration(ds);
  assert.equal(a.narration, b.narration);
  assert.equal(a.cacheKey, b.cacheKey);
  const changed = buildNarration(Object.assign({}, ds, { series: [series(years(2000, 5, [1, 2, 3, 4, 6]))] }));
  assert.notEqual(changed.cacheKey, a.cacheKey);
  assert.match(a.cacheKey, /^Puri\|x\|2000-2020\|all\|v1\|story\|/);
});

test('pyramid ignores stray spreadsheet rows whose "age" is not an age band', () => {
  const rows = [{ age: '0-4', male: 10, female: 10 }, { age: '5-9', male: 10, female: 10 }, { age: '80+', male: 5, female: 5 },
                { age: '45707787', male: 1e9, female: 1e9 }, { age: '29.59', male: 3, female: 3 }];
  const d = NS.pyramid.describeYear('2021', rows, 'projected');
  assert.equal(d.total, 50);
  assert.equal(d.bands.length, 3);
});
