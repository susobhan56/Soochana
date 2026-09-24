/**
 * storyteller/stories/registry.js
 * Story registry and data adapters.
 *
 * Each story maps a chart on the portal to the numbers behind it. The
 * Flourish iframes on the district page do not expose their data, so the
 * district stories read the same JSON files the portal already ships
 * (datasets/*.json) — a parallel numerical definition of each chart,
 * never a scrape of the picture.
 *
 * A story definition:
 *   { id, title, indicator, chartType, level: 'state'|'district'|…,
 *     priority, build(ctx) → Promise<StoryDataset|null> }
 *
 * ctx: { geography: { level, id, name },
 *        load(path) → Promise<json>,          // DataLoader.loadJSON in the browser
 *        sources: { odishaSlideData, … },      // data already inline on a page
 *        state: { year?, … } }                 // current filters
 *
 * Adding a chart = register a story here, add data-story-id to its
 * section. See storyteller/README.md.
 */
(function (root) {
  'use strict';
  var NS = root.SoochanaStoryteller = root.SoochanaStoryteller || {};
  function I() { return root.SoochanaInsight; }
  function D() { return NS.districts; }

  var PATHS = {
    districtPopulation: 'datasets/district_population_trends.json',
    districtFertility: 'datasets/district_fertility_trends.json',
    districtPyramids: 'datasets/district_age_pyramids.json',
    districtLifeExpectancy: 'datasets/district_life_expectancy.json',
    districtMortality: 'datasets/district_mortality.json',
    stateDemographics: 'datasets/state_demographics.json'
  };

  /* Provenance, as stated in the portal's own sheets and chart notes.
     Where a chart cites no source, `name` is null and the narrator says
     so rather than guessing. */
  var SOURCES = {
    districtPopulation: {
      name: 'Census of India / ORGI; population projections using a Bayesian approach',
      note: 'Values up to 2011 are Census counts; 2016 onward are projections.'
    },
    districtFertility: {
      name: 'NFHS-4 and NFHS-5 district data (computed); projections using a Bayesian approach',
      note: '2015-16 and 2020 are computed from NFHS rounds; 2021 onward are projections.'
    },
    districtPyramids: {
      name: 'Census 2011; projected age–sex distribution',
      note: '2011 is the Census; 2021–2036 are projections.'
    },
    districtLifeExpectancy: {
      name: 'Estimates from NFHS-4 (2015-16) and NFHS-5 (2019-21) district data',
      note: 'Two survey rounds, not an annual series.'
    },
    districtMortality: {
      name: 'NFHS-4 (2015-16) and NFHS-5 (2019-21)',
      note: 'Two survey rounds, not an annual series.'
    },
    statePopulation: {
      name: 'Census of India (1901–2011); later values are projections',
      note: 'Growth rates are computed from the state totals in datasets/state_demographics.json. The chart does not name its projection source.'
    },
    stateCensusSeries: {
      name: 'Census of India (to 2011); later values are projections',
      note: 'The chart does not name its projection source.'
    },
    uncited: {
      name: null,
      note: 'The chart does not cite a source. Values after 2011 are treated as projections.'
    }
  };

  var NFHS = {
    nfhs4: { x: 2016, label: 'NFHS-4 (2015-16)' },
    nfhs5: { x: 2020, label: 'NFHS-5 (2019-21)' }
  };

  var registry = new Map();
  var cache = new Map();

  function register(def) {
    if (!def || !def.id || typeof def.build !== 'function') throw new Error('story needs id and build()');
    registry.set(def.id, def);
  }

  function get(id) { return registry.get(id) || null; }

  function build(id, ctx) {
    var def = get(id);
    if (!def) return Promise.resolve(null);
    var geo = ctx.geography || { level: 'state', id: 'Odisha', name: 'Odisha' };
    var key = id + '|' + geo.level + ':' + geo.id + '|' + JSON.stringify(ctx.state || {});
    if (!cache.has(key)) {
      cache.set(key, Promise.resolve().then(function () { return def.build(Object.assign({}, ctx, { geography: geo })); })
        .then(function (ds) {
          if (!ds) return null;
          return Object.assign({
            id: def.id, title: def.title, indicator: def.indicator, chartType: def.chartType,
            geography: geo, dataVersion: def.dataVersion || 'v1'
          }, ds);
        })
        .catch(function (e) {
          cache.delete(key);
          if (root.console) console.warn('[storyteller] could not build story ' + id, e);
          return null;
        }));
    }
    return cache.get(key);
  }

  /* ── adapters ───────────────────────────────────────────────────── */

  function afterCensus(year) { return +year > 2011 ? 'projected' : 'observed'; }

  /* Annual exponential growth between consecutive levels, in % a year.
     Computed from the chart's own numbers, so it can never disagree
     with the line the reader sees. */
  function growthRateFromLevels(values) {
    var out = [];
    for (var i = 1; i < values.length; i++) {
      var a = values[i - 1], b = values[i];
      if (a.y > 0 && b.y > 0 && b.x > a.x) {
        out.push({
          x: b.x, label: b.label || String(b.x),
          y: I().stats.round(Math.log(b.y / a.y) / (b.x - a.x) * 100, 3),
          status: b.status === 'projected' ? 'projected' : 'computed'
        });
      }
    }
    return out;
  }

  function districtKey(ctx, data) {
    return D().resolveKey(ctx.geography.id || ctx.geography.name, Object.keys(data || {}));
  }

  function stateRows(state) {
    /* The source sheet has a second, unrelated table appended below the
       population rows. Keep rows only while years keep increasing and
       totals are present. */
    var rows = [];
    (state && state.population_trends || []).forEach(function (r) {
      if (rows.done) return;
      if (rows.length && r.year <= rows[rows.length - 1].year) { rows.done = true; return; }
      if (r.total) rows.push(r);
    });
    return rows;
  }

  function inline(ctx) { return (ctx.sources && ctx.sources.odishaSlideData) || null; }

  function sharesByYear(rows) {
    var d = I().pyramid.describeYear('x', rows, 'observed');
    return d;
  }

  /* ── District stories ───────────────────────────────────────────── */

  register({
    id: 'district-population', title: 'Population trends', indicator: 'population', chartType: 'line', level: 'district', priority: 10,
    build: function (ctx) {
      return ctx.load(PATHS.districtPopulation).then(function (all) {
        var key = districtKey(ctx, all);
        if (!key) return null;
        var rows = all[key];
        var values = Object.keys(rows).map(Number).sort(function (a, b) { return a - b; }).map(function (y) {
          return { x: y, y: rows[y].total, status: afterCensus(y) };
        });
        var peers = Object.keys(all).filter(function (k) { return all[k]['2011'] && all[k]['2036']; }).map(function (k) {
          return { id: k, label: k, value: (all[k]['2036'].total / all[k]['2011'].total - 1) * 100 };
        });
        /* If every district grows by the same proportion after 2011, the
           projection is a pro-rata share of the state total. Say so, so the
           post-2011 slowdown is not read as district-specific. */
        var growth = peers.map(function (p) { return p.value; });
        var uniform = growth.length > 1 && Math.max.apply(null, growth) - Math.min.apply(null, growth) < 0.1;
        return {
          source: uniform ? Object.assign({}, SOURCES.districtPopulation, {
            note: SOURCES.districtPopulation.note + ' The projections grow every district by the same proportion after 2011, so they follow the state trajectory rather than district-specific change.'
          }) : SOURCES.districtPopulation,
          series: [
            { id: 'population', label: 'Population', role: 'population', unitKind: 'count', format: 'persons',
              subject: ctx.geography.name + '’s population', values: values },
            { id: 'growth', label: 'Annual growth rate', role: 'growth_rate', unitKind: 'rate', format: 'growth',
              minChange: 0.15, values: growthRateFromLevels(values) }
          ],
          peers: { items: peers, selectedId: key, metricLabel: 'projected population growth between 2011 and 2036', format: 'percent' }
        };
      });
    }
  });

  register({
    id: 'district-tfr', title: 'Total fertility rate', indicator: 'tfr', chartType: 'line', level: 'district', priority: 10,
    build: function (ctx) {
      return ctx.load(PATHS.districtFertility).then(function (all) {
        var key = districtKey(ctx, all);
        if (!key) return null;
        var values = Object.keys(all[key]).map(function (k) {
          var survey = /NFHS/i.test(k);
          return {
            x: survey ? 2016 : +k, label: k, y: all[key][k],
            status: survey || k === '2020' ? 'computed' : 'projected'
          };
        });
        var peers = Object.keys(all).filter(function (k) { return isFinite(all[k]['2036']); })
          .map(function (k) { return { id: k, label: k, value: all[k]['2036'] }; });
        return {
          source: SOURCES.districtFertility,
          series: [{
            id: 'tfr', label: 'Total fertility rate', role: 'tfr', unitKind: 'rate', format: 'tfr', minChange: 0.1,
            references: [{ value: 2.1, label: 'replacement level' }], values: values
          }],
          peers: { items: peers, selectedId: key, metricLabel: 'projected fertility rate for 2036', format: 'tfr' }
        };
      });
    }
  });

  register({
    id: 'district-age-structure', title: 'Young, working-age and elderly shares', indicator: 'age_structure', chartType: 'line', level: 'district', priority: 10,
    build: function (ctx) {
      return ctx.load(PATHS.districtPyramids).then(function (all) {
        var key = districtKey(ctx, all);
        if (!key) return null;
        var series = I().pyramid.toAgeStructureSeries({ years: all[key], statusOf: afterCensus }, { geography: ctx.geography.name });
        var peers = Object.keys(all).filter(function (k) { return all[k]['2036']; }).map(function (k) {
          return { id: k, label: k, value: sharesByYear(all[k]['2036']).elderlyShare };
        });
        return {
          source: SOURCES.districtPyramids,
          series: series,
          peers: { items: peers, selectedId: key, metricLabel: 'projected elderly (60+) share in 2036', format: 'percent' }
        };
      });
    }
  });

  register({
    id: 'district-sex-ratio', title: 'Sex ratio', indicator: 'sex_ratio', chartType: 'line', level: 'district', priority: 9,
    build: function (ctx) {
      return ctx.load(PATHS.districtPopulation).then(function (all) {
        var key = districtKey(ctx, all);
        if (!key) return null;
        var rows = all[key];
        var values = Object.keys(rows).map(Number).sort(function (a, b) { return a - b; })
          .filter(function (y) { return rows[y].male > 0; })
          .map(function (y) { return { x: y, y: I().stats.round(rows[y].female / rows[y].male * 1000, 1), status: afterCensus(y) }; });
        var peers = Object.keys(all).filter(function (k) { return all[k]['2011'] && all[k]['2011'].male; }).map(function (k) {
          return { id: k, label: k, value: all[k]['2011'].female / all[k]['2011'].male * 1000 };
        });
        return {
          source: Object.assign({}, SOURCES.districtPopulation, {
            note: 'Computed as females per 1,000 males from the population series (1951–2036). Values after 2011 are projections.'
          }),
          series: [{
            id: 'sex_ratio', label: 'Sex ratio', role: 'sex_ratio', unitKind: 'ratio', format: 'sexratio', minChange: 10,
            references: [{ value: 1000, label: 'parity' }], values: values
          }],
          peers: { items: peers, selectedId: key, metricLabel: 'sex ratio in the 2011 Census', format: 'sexratio' }
        };
      });
    }
  });

  register({
    id: 'district-pyramid', title: 'Population pyramid', indicator: 'population_pyramid', chartType: 'pyramid', level: 'district', priority: 10,
    build: function (ctx) {
      return ctx.load(PATHS.districtPyramids).then(function (all) {
        var key = districtKey(ctx, all);
        if (!key) return null;
        return { source: SOURCES.districtPyramids, series: [], pyramid: { years: all[key], statusOf: afterCensus } };
      });
    }
  });

  register({
    id: 'district-life-expectancy', title: 'Life expectancy', indicator: 'life_expectancy', chartType: 'bar', level: 'district', priority: 8,
    build: function (ctx) {
      return ctx.load(PATHS.districtLifeExpectancy).then(function (all) {
        var key = districtKey(ctx, all);
        if (!key) return null;
        function series(sex, label, role) {
          var d = all[key][sex] || {};
          return {
            id: 'le_' + sex, label: label, role: role, unitKind: 'value', format: 'years', minChange: 0.5, surveyRounds: true,
            values: ['nfhs4', 'nfhs5'].map(function (r) { return { x: NFHS[r].x, label: NFHS[r].label, y: d[r], status: 'estimated' }; })
          };
        }
        var peers = Object.keys(all).filter(function (k) { return all[k].female && isFinite(all[k].female.nfhs5); })
          .map(function (k) { return { id: k, label: k, value: all[k].female.nfhs5 }; });
        return {
          source: SOURCES.districtLifeExpectancy,
          compare: true,
          series: [series('female', 'Female life expectancy', 'female'), series('male', 'Male life expectancy', 'male')],
          peers: { items: peers, selectedId: key, metricLabel: 'female life expectancy (NFHS-5)', format: 'years' }
        };
      });
    }
  });

  register({
    id: 'district-mortality', title: 'Child mortality', indicator: 'child_mortality', chartType: 'bar', level: 'district', priority: 8,
    build: function (ctx) {
      return ctx.load(PATHS.districtMortality).then(function (all) {
        var key = districtKey(ctx, all);
        if (!key) return null;
        var m = all[key];
        function series(field, id, label) {
          var d = m[field] || {};
          return {
            id: id, label: label, unitKind: 'rate', format: 'per1000births', minChange: 1, surveyRounds: true,
            polarity: 'lower_is_better',
            values: ['nfhs4', 'nfhs5'].map(function (r) { return { x: NFHS[r].x, label: NFHS[r].label, y: d[r], status: 'observed' }; })
          };
        }
        var peers = Object.keys(all).filter(function (k) { return all[k].infant_mortality_rate && isFinite(all[k].infant_mortality_rate.nfhs5); })
          .map(function (k) { return { id: k, label: k, value: all[k].infant_mortality_rate.nfhs5 }; });
        return {
          source: SOURCES.districtMortality,
          compare: false,
          groupNoun: 'child mortality rates',
          series: [
            series('neonatal_mortality_rate', 'nmr', 'Neonatal mortality rate'),
            series('infant_mortality_rate', 'imr', 'Infant mortality rate'),
            series('under_five_mortality_rate', 'u5mr', 'Under-five mortality rate')
          ],
          peers: { items: peers, selectedId: key, metricLabel: 'infant mortality rate (NFHS-5)', format: 'per1000births' }
        };
      });
    }
  });

  /* ── State stories (odisha.html) ────────────────────────────────── */

  function inlineSeries(rows, key, meta) {
    return Object.assign({
      values: rows.map(function (r) { return { x: r.y, y: r[key], status: afterCensus(r.y) }; })
    }, meta);
  }

  register({
    id: 'state-population', title: 'Population growth trajectory', indicator: 'population', chartType: 'line', level: 'state', priority: 10,
    build: function (ctx) {
      var data = inline(ctx);
      return ctx.load(PATHS.stateDemographics).then(function (state) {
        var rows = stateRows(state);
        var level = data && data.popGrowth
          ? inlineSeries(data.popGrowth, 'v', { id: 'population', label: 'Population', role: 'population', unitKind: 'count', format: 'million' })
          : { id: 'population', label: 'Population', role: 'population', unitKind: 'count', format: 'persons',
              values: rows.map(function (r) { return { x: r.year, y: r.total, status: afterCensus(r.year) }; }) };
        return {
          source: SOURCES.statePopulation,
          series: [
            level,
            { id: 'growth', label: 'Annual growth rate', role: 'growth_rate', unitKind: 'rate', format: 'growth', minChange: 0.15,
              values: rows.filter(function (r) { return r.annual_growth_rate != null; })
                .map(function (r) { return { x: r.year, y: r.annual_growth_rate, status: afterCensus(r.year) === 'projected' ? 'projected' : 'computed' }; }) }
          ]
        };
      });
    }
  });

  register({
    id: 'state-pyramid', title: 'Population pyramid', indicator: 'population_pyramid', chartType: 'pyramid', level: 'state', priority: 10,
    build: function (ctx) {
      var data = inline(ctx);
      if (!data || !data.pyramids) {
        /* Pages without the inline chart data (index.html) use the state sheet. */
        return ctx.load(PATHS.stateDemographics).then(function (st) {
          if (!st || !st.pyramids) return null;
          return { source: SOURCES.stateCensusSeries, series: [], pyramid: { years: st.pyramids, statusOf: afterCensus } };
        });
      }
      var years = {};
      Object.keys(data.pyramids).forEach(function (y) {
        years[y] = data.pyramids[y].map(function (r) { return { age: r.a, male: r.m, female: r.f }; });
      });
      return { source: SOURCES.stateCensusSeries, series: [], pyramid: { years: years, statusOf: afterCensus } };
    }
  });

  register({
    id: 'state-age-structure', title: 'Age-wise population share', indicator: 'age_structure', chartType: 'stacked-bar', level: 'state', priority: 10,
    build: function (ctx) {
      var data = inline(ctx);
      if (!data || !data.ageCohorts) {
        return ctx.load(PATHS.stateDemographics).then(function (st) {
          if (!st || !st.pyramids) return null;
          return {
            source: SOURCES.stateCensusSeries,
            series: I().pyramid.toAgeStructureSeries({ years: st.pyramids, statusOf: afterCensus }, { geography: ctx.geography.name })
          };
        });
      }
      var c = data.ageCohorts;
      return {
        source: SOURCES.stateCensusSeries,
        series: [
          inlineSeries(c, 'youth', { id: 'young', label: 'Young (0–14)', role: 'young_share', unitKind: 'percent', format: 'percent' }),
          inlineSeries(c, 'work', { id: 'working', label: 'Working age (15–59)', role: 'working_share', unitKind: 'percent', format: 'percent' }),
          inlineSeries(c, 'senior', { id: 'elderly', label: 'Elderly (60+)', role: 'elderly_share', unitKind: 'percent', format: 'percent' })
        ]
      };
    }
  });

  register({
    id: 'state-sex-ratio', title: 'Overall sex ratio', indicator: 'sex_ratio', chartType: 'line', level: 'state', priority: 9,
    build: function (ctx) {
      var data = inline(ctx);
      if (!data || !data.sexRatio) {
        return ctx.load(PATHS.stateDemographics).then(function (st) {
          var rows = stateRows(st).filter(function (r) { return r.sex_ratio; });
          if (!rows.length) return null;
          return {
            source: SOURCES.stateCensusSeries,
            series: [{
              id: 'sex_ratio', label: 'Sex ratio', role: 'sex_ratio', unitKind: 'ratio', format: 'sexratio', minChange: 10,
              references: [{ value: 1000, label: 'parity' }],
              values: rows.map(function (r) { return { x: r.year, y: I().stats.round(r.sex_ratio, 1), status: afterCensus(r.year) }; })
            }]
          };
        });
      }
      return {
        source: SOURCES.stateCensusSeries,
        series: [inlineSeries(data.sexRatio, 'v', {
          id: 'sex_ratio', label: 'Sex ratio', role: 'sex_ratio', unitKind: 'ratio', format: 'sexratio', minChange: 10,
          references: [{ value: 1000, label: 'parity' }]
        })]
      };
    }
  });

  register({
    id: 'state-srb', title: 'Sex ratio at birth', indicator: 'sex_ratio_at_birth', chartType: 'line', level: 'state', priority: 7,
    build: function (ctx) {
      var data = inline(ctx);
      if (!data || !data.srb) return null;
      return {
        source: SOURCES.uncited,
        series: [inlineSeries(data.srb, 'v', {
          id: 'srb', label: 'Sex ratio at birth', unitKind: 'ratio', format: 'srb', minChange: 8
        })]
      };
    }
  });

  register({
    id: 'state-tfr', title: 'Total fertility rate', indicator: 'tfr', chartType: 'line', level: 'state', priority: 10,
    build: function (ctx) {
      var data = inline(ctx);
      if (!data || !data.tfr) return null;
      return {
        source: SOURCES.uncited,
        series: [inlineSeries(data.tfr, 'v', {
          id: 'tfr', label: 'Total fertility rate', role: 'tfr', unitKind: 'rate', format: 'tfr', minChange: 0.1,
          references: [{ value: 2.1, label: 'replacement level' }]
        })]
      };
    }
  });

  NS.stories = {
    PATHS: PATHS,
    SOURCES: SOURCES,
    register: register,
    get: get,
    build: build,
    list: function () { return Array.from(registry.keys()); },
    clearCache: function () { cache.clear(); },
    adapters: { growthRateFromLevels: growthRateFromLevels, stateRows: stateRows, afterCensus: afterCensus }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = NS.stories;
})(typeof window !== 'undefined' ? window : globalThis);
