/**
 * storyteller/engine/narrate.js
 * The pipeline: StoryDataset → profiles → comparisons → insights →
 * Narration. Also builds the compact evidence object sent to an optional
 * language model, and the cache key that identifies a narration.
 *
 *   const n = SoochanaInsight.narrate.buildNarration(dataset, { mode: 'story' });
 *   n.headline, n.narration, n.importance, n.keyPoints, n.sourceLabel …
 */
(function (root) {
  'use strict';
  var NS = root.SoochanaInsight = root.SoochanaInsight || {};

  var LIMITS = {
    story: { sentences: 3, words: 70 },
    data: { sentences: 4, words: 95 }
  };

  function words(s) { return s ? s.trim().split(/\s+/).length : 0; }
  function sentenceCount(s) { return (s.match(/[.!?](\s|$)/g) || []).length || 1; }

  /* Series can only be compared pairwise when they share a unit;
     comparing a head-count with a growth rate would be meaningless. */
  function comparable(series) {
    if (series.length < 2) return false;
    var f = series[0].format || series[0].unit;
    return series.every(function (s) { return (s.format || s.unit) === f; });
  }

  function analyse(dataset, opts) {
    opts = opts || {};
    var series = dataset.series || [];
    var profiles = series.map(function (s) {
      return NS.trend.analyzeSeries(Object.assign({}, s, { source: s.source || (dataset.source && dataset.source.name) || null }));
    });
    var byRole = {}, byId = {};
    profiles.forEach(function (p) { if (p.role) byRole[p.role] = p; byId[p.id] = p; });
    var doCompare = dataset.compare != null ? dataset.compare : comparable(series);
    var group = doCompare ? NS.compare.compareGroup(series, { gapThreshold: dataset.gapThreshold }) : null;
    var pyramid = dataset.pyramid ? NS.pyramid.analyzePyramid(dataset.pyramid, { focusYear: opts.focusYear }) : null;
    var peers = dataset.peers ? NS.compare.rankEntities(dataset.peers.items, dataset.peers.selectedId) : null;
    return {
      dataset: dataset,
      geo: (dataset.geography && dataset.geography.name) || 'Odisha',
      profiles: profiles, byRole: byRole, byId: byId,
      group: group, pyramid: pyramid, peers: peers,
      focusYear: opts.focusYear || null
    };
  }

  function overallStatus(ctx) {
    var kinds = ctx.profiles.map(function (p) { return p.dataStatus; }).filter(Boolean);
    if (ctx.pyramid && ctx.pyramid.dataStatus) kinds.push(ctx.pyramid.dataStatus);
    if (!kinds.length) return 'observed';
    if (kinds.indexOf('historical_plus_projected') !== -1) return 'historical_plus_projected';
    var hasP = kinds.indexOf('projected') !== -1, hasO = kinds.some(function (k) { return k !== 'projected'; });
    if (hasP && hasO) return 'historical_plus_projected';
    if (hasP) return 'projected';
    return kinds.indexOf('survey_rounds') !== -1 ? 'survey_rounds' : 'observed';
  }

  function overallConfidence(ctx, chosen) {
    var ids = {};
    chosen.forEach(function (c) { c.covers.forEach(function (id) { ids[id] = 1; }); });
    var levels = ctx.profiles.filter(function (p) { return ids[p.id]; }).map(function (p) { return p.confidence; });
    if (ctx.pyramid && !ctx.pyramid.insufficient && ids.pyramid) {
      levels.push(ctx.dataset.source && ctx.dataset.source.name ? 'high' : 'medium');
    }
    if (!levels.length) levels = ctx.profiles.map(function (p) { return p.confidence; });
    if (levels.indexOf('low') !== -1) return 'low';
    if (levels.indexOf('medium') !== -1) return 'medium';
    return levels.length ? 'high' : 'low';
  }

  function compose(insights, mode) {
    var lim = LIMITS[mode] || LIMITS.story;
    var covered = {}, chosen = [];
    insights.forEach(function (ins) {
      if (ins.covers.length && ins.covers.every(function (c) { return covered[c]; })) return;
      chosen.push(ins);
      ins.covers.forEach(function (c) { covered[c] = 1; });
    });
    var parts = [], n = 0, w = 0, used = [];
    chosen.forEach(function (ins, k) {
      var text = mode === 'data' ? ins.data : ins.story;
      if (!text) return;
      var tw = words(text), ts = sentenceCount(text);
      if (k === 0 || (n + ts <= lim.sentences && w + tw <= lim.words)) {
        parts.push(text); n += ts; w += tw; used.push(ins);
      }
    });
    return { text: parts.join(' '), used: used, chosen: chosen };
  }

  function periodOf(ctx) {
    var xs = [];
    ctx.profiles.forEach(function (p) { if (p.start) xs.push(p.start, p.end); });
    if (ctx.pyramid && ctx.pyramid.first) {
      xs.push({ x: +ctx.pyramid.first.year, label: ctx.pyramid.first.year }, { x: +ctx.pyramid.last.year, label: ctx.pyramid.last.year });
    }
    if (!xs.length) return null;
    xs.sort(function (a, b) { return a.x - b.x; });
    return { start: xs[0].label, end: xs[xs.length - 1].label };
  }

  function r(v) { return typeof v === 'number' && isFinite(v) ? NS.stats.round(v, Math.abs(v) >= 100 ? 0 : 2) : v; }
  function point(p) { return p ? { period: p.label, value: r(p.value), status: p.status || undefined } : null; }

  /* Everything a language model may say must come from here. The
     validator in storyteller/narration/prompt.js rejects any number it cannot trace back
     to this object. */
  function buildEvidence(ctx, deterministic) {
    var ds = ctx.dataset;
    return {
      story_id: ds.id,
      title: ds.title,
      indicator: ds.indicator,
      geography: ctx.geo,
      chart_type: ds.chartType,
      period: periodOf(ctx),
      data_status: overallStatus(ctx),
      source: ds.source ? ds.source.name : null,
      source_note: ds.source ? ds.source.note || null : null,
      survey_rounds: ctx.profiles.some(function (p) { return p.surveyRounds; }),
      focus_year: ctx.focusYear,
      series: ctx.profiles.filter(function (p) { return !p.insufficient; }).map(function (p) {
        return {
          id: p.id, label: p.label, role: p.role, unit: p.unit,
          start: point(p.start), end: point(p.end),
          last_observed: p.statusDetail && p.statusDetail.lastObserved ? point(p.statusDetail.lastObserved) : null,
          absolute_change: r(p.absoluteChange),
          percentage_point_change: r(p.percentagePointChange),
          relative_change_pct: r(p.relativeChangePct),
          direction: p.direction, strength: p.strength, shape: p.shape,
          peak: point(p.peak), trough: point(p.trough),
          turning_points: p.turningPoints.map(function (t) { return { period: t.label, type: t.type, value: r(t.value) }; }),
          reference_lines: p.references.map(function (ref) {
            return { label: ref.label, value: ref.value, end_position: ref.endPosition,
                     crossing: ref.crossing ? { approx_year: ref.crossing.approxYear, between: ref.crossing.between, direction: ref.crossing.direction, status: ref.crossing.status } : null };
          }),
          data_status: p.dataStatus,
          confidence: p.confidence
        };
      }),
      comparisons: ctx.group ? ctx.group.pairs.map(function (g) {
        return { a: g.labelA, b: g.labelB, gap_start: r(g.start.gap), gap_end: r(g.end.gap), gap_direction: g.direction,
                 crossovers: g.crossovers.map(function (c) { return { approx_year: Math.round(c.x), between: c.between, status: c.status }; }) };
      }) : [],
      pyramid: ctx.pyramid && !ctx.pyramid.insufficient ? {
        years: ctx.pyramid.years,
        first: { year: ctx.pyramid.first.year, under5_share: r(ctx.pyramid.first.baseShare), young_share: r(ctx.pyramid.first.youngShare), elderly_share: r(ctx.pyramid.first.elderlyShare), median_age: Math.round(ctx.pyramid.first.medianAge), largest_group: ctx.pyramid.first.modalBand, shape: ctx.pyramid.first.shape },
        last: { year: ctx.pyramid.last.year, status: ctx.pyramid.last.status, under5_share: r(ctx.pyramid.last.baseShare), young_share: r(ctx.pyramid.last.youngShare), elderly_share: r(ctx.pyramid.last.elderlyShare), median_age: Math.round(ctx.pyramid.last.medianAge), largest_group: ctx.pyramid.last.modalBand, shape: ctx.pyramid.last.shape },
        focus: { year: ctx.pyramid.focus.year, status: ctx.pyramid.focus.status, largest_group: ctx.pyramid.focus.modalBand, shape: ctx.pyramid.focus.shape },
        patterns: ctx.pyramid.patterns
      } : null,
      peers: ctx.peers && ctx.peers.selected ? {
        metric: ds.peers.metricLabel, rank: ctx.peers.selected.rank, of: ctx.peers.n,
        value: r(ctx.peers.selected.value), median: r(ctx.peers.median), band: ctx.peers.selected.band
      } : null,
      deterministic: deterministic
    };
  }

  function cacheKey(ds, opts, ctx) {
    var period = periodOf(ctx);
    var dataHash = NS.stats.hash(JSON.stringify([ds.series, ds.pyramid && ds.pyramid.years, ds.peers && ds.peers.items]));
    return [
      (ds.geography && ds.geography.name) || 'Odisha',
      ds.id,
      period ? period.start + '-' + period.end : '',
      opts.focusYear || 'all',
      ds.dataVersion || 'v1',
      opts.mode || 'story',
      dataHash
    ].join('|');
  }

  function buildNarration(dataset, opts) {
    opts = opts || {};
    var mode = opts.mode === 'data' ? 'data' : 'story';
    var ctx = analyse(dataset, opts);
    var insights = NS.rules.evaluate(ctx);
    var composed = compose(insights, mode);
    var confidence = overallConfidence(ctx, composed.used);
    var text = composed.text;
    /* Hedge the lead sentence when the evidence is thin. Data mode states
       values rather than claims, so it is left as is. */
    if (text && confidence !== 'high' && mode === 'story') {
      var first = text.match(/^[^.!?]*[.!?]/);
      if (first) text = NS.language.hedge(first[0], confidence, [ctx.geo, 'Odisha', 'Odisha’s', ctx.geo + '’s']) + text.slice(first[0].length);
    }
    var top = composed.used[0] || null;
    var importance = null;
    composed.chosen.some(function (c) { if (c.importance) { importance = c.importance; return true; } return false; });
    var keyPoints = [];
    composed.chosen.forEach(function (c) { c.keyPoints.forEach(function (k) { if (keyPoints.indexOf(k) === -1) keyPoints.push(k); }); });

    var status = overallStatus(ctx);
    var src = dataset.source && dataset.source.name;
    var narration = {
      storyId: dataset.id,
      title: dataset.title,
      geography: ctx.geo,
      mode: mode,
      headline: top ? top.headline : dataset.title,
      narration: text || 'There is not enough data in this chart to describe a pattern.',
      importance: importance,
      keyPoints: keyPoints.slice(0, 4),
      confidence: confidence,
      sourceLabel: src || 'Source information is not available for this series.',
      sourceNote: dataset.source && dataset.source.note || null,
      dataStatus: status,
      period: periodOf(ctx),
      insights: composed.used.map(function (i) { return { type: i.type, rule: i.rule, level: i.level, priority: i.priority }; }),
      generator: 'deterministic'
    };
    narration.cacheKey = cacheKey(dataset, { mode: mode, focusYear: opts.focusYear }, ctx);
    narration.evidence = buildEvidence(ctx, { headline: narration.headline, narration: narration.narration });
    narration.profiles = opts.includeProfiles ? ctx.profiles : undefined;
    return narration;
  }

  /* Convenience for a single series, shaped like the spec's example:
     analyzeDataset({ indicator, unit, geography, series:[{year,value,status}] }) */
  function analyzeDataset(input) {
    var unitKind = input.unitKind || (input.unit === '%' ? 'percent' : 'value');
    var s = {
      id: input.indicator, label: input.label || input.indicator, unit: input.unit, unitKind: unitKind,
      geography: input.geography, source: input.source, minChange: input.minChange, references: input.references,
      values: (input.series || []).map(function (d) { return { x: d.year, y: d.value, status: d.status }; })
    };
    var p = NS.trend.analyzeSeries(s);
    if (p.insufficient) return { indicator: input.indicator, insufficient: true, warnings: p.warnings };
    var interp = NS.language.describeTrend(Object.assign({}, p, { label: input.label || String(input.indicator).replace(/_/g, ' ') })).story;
    return {
      indicator: input.indicator,
      geography: input.geography || null,
      unit: input.unit,
      direction: p.direction,
      trend_strength: p.strength,
      shape: p.shape,
      start_value: p.start.value,
      end_value: p.end.value,
      absolute_change: NS.stats.round(p.absoluteChange, 4),
      relative_change_percent: p.relativeChangePct == null ? null : NS.stats.round(p.relativeChangePct, 2),
      percentage_point_change: p.percentagePointChange == null ? null : NS.stats.round(p.percentagePointChange, 4),
      start_year: p.start.x,
      end_year: p.end.x,
      peak: p.peak ? { year: p.peak.x, value: p.peak.value } : null,
      trough: p.trough ? { year: p.trough.x, value: p.trough.value } : null,
      highest: { year: p.highest.x, value: p.highest.value },
      lowest: { year: p.lowest.x, value: p.lowest.value },
      turning_points: p.turningPoints.map(function (t) { return { year: t.x, type: t.type, value: t.value }; }),
      data_status: p.dataStatus,
      confidence: p.confidence,
      warnings: p.warnings,
      interpretation: interp
    };
  }

  function firstSentence(text) {
    /* a full stop followed by a space or the end — not the one in "2.1" */
    var m = String(text || '').match(/^.*?[.!?](?=\s|$)/);
    return m ? m[0].trim() : String(text || '').trim();
  }

  /* A page-level summary built from the narrations of the charts on the
     page, in page order: the lead sentence of the first few, then — only
     when those charts' own insights show it — one sentence connecting
     them. The connection is descriptive (what the charts show together),
     never a claim that one trend caused another. */
  function buildOverview(narrations, opts) {
    opts = opts || {};
    var seen = {};
    var items = (narrations || []).filter(function (n) {
      if (!n || !n.narration || /not enough data/i.test(n.narration) || seen[n.storyId]) return false;
      seen[n.storyId] = 1;
      return true;
    });
    var geo = opts.geography || (items[0] && items[0].geography) || 'Odisha';
    if (!items.length) return null;

    /* Lead with the most significant charts, told in page order. */
    function weight(n) { return (n.insights && n.insights[0] && n.insights[0].priority) || 0; }
    /* one chart per kind of pattern: the pyramid and the age shares both
       say "ageing", so only the stronger of them leads */
    var usedTypes = {}, top = [];
    items.slice().sort(function (a, b) { return weight(b) - weight(a); }).forEach(function (n) {
      var t = n.insights && n.insights[0] && n.insights[0].type;
      if (top.length >= (opts.maxLead || 3) || (t && usedTypes[t])) return;
      if (t) usedTypes[t] = 1;
      top.push(n);
    });
    var lead = items.filter(function (n) { return top.indexOf(n) !== -1; }).map(function (n) { return firstSentence(n.narration); });
    var types = {};
    items.forEach(function (n) { (n.insights || []).forEach(function (i) { types[i.type] = 1; }); });
    var parts = [];
    if (types.population_growth_slowdown) parts.push('slowing population growth');
    if (types.fertility_decline) parts.push('falling fertility');
    if (types.ageing) parts.push('a gradually older population');
    var thread = null;
    if (parts.length >= 2) {
      thread = 'Read together, these charts describe a demographic transition: ' +
        NS.language.listJoin(parts) + '.';
    }
    var statuses = items.map(function (n) { return n.dataStatus; });
    var conf = items.map(function (n) { return n.confidence; });
    return {
      storyId: '__overview',
      title: 'Page overview',
      geography: geo,
      mode: opts.mode || 'story',
      headline: geo + ' at a glance',
      narration: lead.join(' ') + (thread ? ' ' + thread : ''),
      importance: 'Each chart on this page is explained in turn as you scroll to it. The overview only combines what those explanations say.',
      keyPoints: [],
      links: items.map(function (n) { return { storyId: n.storyId, text: n.headline }; }),
      confidence: conf.indexOf('low') !== -1 ? 'low' : conf.indexOf('medium') !== -1 ? 'medium' : 'high',
      sourceLabel: 'The sources of each chart, shown when you reach it',
      sourceNote: null,
      dataStatus: statuses.some(function (s) { return /projected/.test(s); }) ? 'historical_plus_projected'
        : statuses.every(function (s) { return s === 'survey_rounds'; }) ? 'survey_rounds' : 'observed',
      insights: [],
      generator: 'deterministic',
      cacheKey: geo + '|__overview|' + items.map(function (n) { return n.cacheKey; }).join('+')
    };
  }

  NS.narrate = {
    analyse: analyse,
    buildNarration: buildNarration,
    buildEvidence: buildEvidence,
    buildOverview: buildOverview,
    analyzeDataset: analyzeDataset,
    compose: compose
  };
  NS.analyzeDataset = analyzeDataset;
  if (typeof module !== 'undefined' && module.exports) module.exports = NS.narrate;
})(typeof window !== 'undefined' ? window : globalThis);
