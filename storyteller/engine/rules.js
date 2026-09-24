/**
 * storyteller/engine/rules.js
 * The insight-rule registry.
 *
 * A rule looks at the analysed context (profiles by role, pairwise
 * comparisons, pyramid analysis, peer ranking) and, when its pattern is
 * present, returns an Insight:
 *
 *   { id, type, level, priority, headline, story, data,
 *     importance?, keyPoints[], covers[] }
 *
 * `covers` lists the series the insight explains. The composer skips any
 * lower-priority insight whose series are already covered, so the
 * population-plus-growth-rate rule silences the two generic trend
 * sentences it replaces. Add a rule with `SoochanaInsight.rules.register`.
 *
 * Rules only describe what the evidence shows. Any "why it matters" text
 * (`importance`) is definitional or descriptive — never a causal claim
 * the data cannot support.
 */
(function (root) {
  'use strict';
  var NS = root.SoochanaInsight = root.SoochanaInsight || {};
  function L() { return NS.language; }

  var TYPES = [
    'increase', 'decrease', 'stable', 'mixed', 'acceleration', 'deceleration',
    'peak', 'trough', 'crossover', 'convergence', 'divergence', 'ranking',
    'ranking_change', 'outlier', 'ageing', 'fertility_decline',
    'population_growth_slowdown', 'population_decline', 'gender_gap',
    'sex_ratio_shift', 'urbanisation', 'migration', 'health_improvement',
    'nutrition_change'
  ];

  var registry = [];

  function register(rule) {
    if (!rule || !rule.id || typeof rule.evaluate !== 'function') throw new Error('rule needs id and evaluate()');
    if (rule.type && TYPES.indexOf(rule.type) === -1) TYPES.push(rule.type);
    registry = registry.filter(function (r) { return r.id !== rule.id; });
    registry.push(rule);
  }

  function ok(p) { return p && !p.insufficient; }
  function decade(x) { return Math.floor(x / 10) * 10 + 's'; }
  function proj(point) { return L().isProjected(point); }

  function evaluate(ctx) {
    var out = [];
    registry.forEach(function (rule) {
      try {
        var res = rule.evaluate(ctx);
        (Array.isArray(res) ? res : res ? [res] : []).forEach(function (ins) {
          ins.rule = rule.id;
          ins.type = ins.type || rule.type;
          ins.level = ins.level || rule.level || 2;
          ins.priority = ins.priority != null ? ins.priority : rule.priority || 50;
          ins.covers = ins.covers || [];
          ins.keyPoints = ins.keyPoints || [];
          out.push(ins);
        });
      } catch (e) {
        /* One faulty rule must never take the narrator down. */
        if (typeof console !== 'undefined') console.warn('[storyteller] rule ' + rule.id + ' failed', e);
      }
    });
    return out.sort(function (a, b) { return b.priority - a.priority; });
  }

  /* ── Population level + growth rate ─────────────────────────────── */
  register({
    id: 'population_growth_slowdown', type: 'population_growth_slowdown', level: 4, priority: 96,
    evaluate: function (ctx) {
      var pop = ctx.byRole.population, g = ctx.byRole.growth_rate;
      if (!ok(pop) || !ok(g) || pop.netDirection !== 'up') return null;
      var peak = g.highest, end = g.end;
      var fromPeak = peak.x < end.x && end.value <= peak.value * 0.6;
      if (!(g.netDirection === 'down' || fromPeak)) return null;
      var ref = fromPeak && peak.x > g.start.x ? peak : g.start;
      var since = ref === peak ? ' since the ' + decade(ref.x) : ' steadily';
      var f = L().fmt;
      var story = ctx.geo + '’s population keeps growing, but the pace of that growth has slowed' + since + '.';
      if (proj(pop.end)) {
        story += ' Projections suggest the population is still growing in ' + pop.end.label + ', at a much gentler rate than in the past.';
      }
      var data = 'Population rises from ' + f(pop.start.value, pop.format) + ' in ' + pop.start.label + ' to ' +
        (proj(pop.end) ? 'a projected ' : '') + f(pop.end.value, pop.format) + ' ' + L().when(pop.end) +
        ', while the annual growth rate falls from ' + f(ref.value, 'growth', { short: true }) + ' in ' + ref.label +
        ' to ' + f(end.value, 'growth', { short: true }) + ' ' + L().when(end) + '.';
      return {
        headline: 'Still growing, but more slowly',
        story: story, data: data,
        importance: 'A falling growth rate is not a falling population: the total keeps rising, only by smaller amounts each year.',
        keyPoints: ['Population keeps rising', 'Annual growth rate falls from ' + f(ref.value, 'growth', { short: true }) + ' to ' + f(end.value, 'growth', { short: true })],
        covers: [pop.id, g.id]
      };
    }
  });

  register({
    id: 'population_decline', type: 'population_decline', level: 2, priority: 90,
    evaluate: function (ctx) {
      var pop = ctx.byRole.population;
      if (!ok(pop) || pop.netDirection !== 'down') return null;
      var f = L().fmt;
      var p = proj(pop.end);
      return {
        headline: p ? 'A projected fall in population' : 'The population is shrinking',
        story: ctx.geo + '’s population ' + (p ? 'is projected to decline' : 'declines') + ' over the period.',
        data: 'Population ' + (p ? 'is projected to fall' : 'falls') + ' from ' + f(pop.start.value, pop.format) + ' in ' +
          pop.start.label + ' to ' + f(pop.end.value, pop.format) + ' ' + L().when(pop.end) + '.',
        keyPoints: ['Population falling'],
        covers: [pop.id]
      };
    }
  });

  /* ── Age structure ──────────────────────────────────────────────── */
  register({
    id: 'age_structure_shift', type: 'ageing', level: 4, priority: 97,
    evaluate: function (ctx) {
      var y = ctx.byRole.young_share, e = ctx.byRole.elderly_share, w = ctx.byRole.working_share;
      if (!ok(y) || !ok(e) || y.netDirection !== 'down' || e.netDirection !== 'up') return null;
      var f = L().fmt;
      var projectedEnd = proj(y.end);
      var allProjected = y.dataStatus === 'projected';
      var sentences = [
        (allProjected ? 'The age structure is projected to shift' : 'The age structure is shifting') +
        ' towards older ages: the share of children falls while the elderly share grows.'
      ];
      var keyPoints = ['Young share falling', 'Elderly share rising'];

      var cross = (ctx.group && ctx.group.pairs || []).filter(function (pr) {
        return pr.crossovers.length && [pr.seriesA, pr.seriesB].indexOf(y.id) !== -1 && [pr.seriesA, pr.seriesB].indexOf(e.id) !== -1;
      })[0];
      if (cross) {
        var c = cross.crossovers[0];
        var at = L().crossingWhen(c);
        sentences.push(L().cap(at) + ', the elderly share ' +
          (c.status === 'projected' ? 'is projected to overtake' : 'overtakes') + ' the share of children.');
        keyPoints.push('Elderly overtake children ' + at);
      }
      if (ok(w)) {
        if (w.peak) {
          sentences.push('The working-age group stays the largest, but its share peaks around ' + w.peak.label +
            (proj(w.end) ? ' and is then projected to ease.' : ' and then eases.'));
          keyPoints.push('Working-age share peaks around ' + w.peak.label);
        } else if (w.direction === 'increasing') {
          sentences.push('Meanwhile the working-age share continues to grow.');
          keyPoints.push('Working-age share rising');
        } else if (w.direction === 'stable') {
          sentences.push('The working-age share stays broadly steady.');
          keyPoints.push('Working-age share steady');
        } else if (w.direction === 'decreasing') {
          sentences.push('The working-age share also slips.');
          keyPoints.push('Working-age share slipping');
        }
      }

      var data = 'Children aged 0–14 ' + (allProjected ? 'are projected to fall' : 'fall') + ' from ' +
        f(y.start.value, 'percent') + ' of the population in ' + y.start.label + ' to ' +
        (projectedEnd && !allProjected ? 'a projected ' : '') + f(y.end.value, 'percent') + ' ' +
        L().when(y.end) + ' (down ' + L().magnitude(y) + '), while the share aged 60+ rises from ' +
        f(e.start.value, 'percent') + ' to ' + f(e.end.value, 'percent') + '.';
      if (ok(w) && w.peak) {
        data += ' The working-age share peaks at ' + f(w.peak.value, 'percent') + ' in ' + w.peak.label +
          ' and ends at ' + f(w.end.value, 'percent') + '.';
      }
      return {
        headline: 'The population is getting older',
        story: sentences.join(' '),
        data: data,
        importance: 'A shrinking share of children alongside a growing share of older people is the signature of an ageing population: the balance between generations is changing.',
        keyPoints: keyPoints,
        covers: [y.id, e.id].concat(ok(w) ? [w.id] : [])
      };
    }
  });

  /* ── Fertility ──────────────────────────────────────────────────── */
  register({
    id: 'fertility_transition', type: 'fertility_decline', level: 4, priority: 95,
    evaluate: function (ctx) {
      var t = ctx.byRole.tfr;
      if (!ok(t)) return null;
      var f = L().fmt;
      var ref = (t.references || []).filter(function (r) { return /replacement/i.test(r.label); })[0];
      if (t.netDirection !== 'down') {
        /* Not a decline: describe the path as it is, and where it sits
           against replacement level. */
        if (!ref) return null;
        var g = L().describeTrend(t);
        var side = ref.endPosition === 'above' ? 'above' : 'below';
        var throughout = ref.crossings.length === 0;
        return {
          /* not a decline, so never tagged as one */
          type: t.direction === 'increasing' ? 'increase' : t.direction === 'stable' ? 'stable' : 'mixed',
          headline: side === 'above' ? 'Fertility stays above replacement' : 'Fertility stays low',
          story: g.story + ' It ' + (throughout ? 'stays ' : 'ends ') + side +
            ' the replacement level of about 2.1 children per woman' + (throughout ? ' throughout.' : '.'),
          data: g.data,
          importance: 'Replacement level, about 2.1 children per woman, is the rate at which each generation just replaces itself.',
          keyPoints: [side === 'above' ? 'Above replacement' : 'Below replacement'],
          covers: [t.id]
        };
      }
      var sentences = [];
      var headline = 'Fertility keeps falling';
      var keyPoints = ['Fertility declining'];
      if (ref && ref.crossing && ref.crossing.direction === 'below') {
        var at = L().crossingWhen(ref.crossing);
        sentences.push('Fertility is falling and ' + (ref.crossing.status === 'projected' ? 'is projected to drop' : 'drops') +
          ' below the replacement level of about 2.1 children per woman ' + at + '.');
        headline = 'Fertility falls below replacement';
        keyPoints.push('Below replacement ' + at);
      } else if (ref && ref.startPosition !== 'above') {
        sentences.push('Fertility is already at or below the replacement level of about 2.1 children per woman at the start of the series, and keeps falling.');
        keyPoints.push('Below replacement throughout');
      } else if (ref && ref.endPosition === 'above') {
        sentences.push('Fertility is falling, but stays above the replacement level of about 2.1 children per woman.');
        keyPoints.push('Still above replacement');
      } else {
        sentences.push('Fertility is moving steadily downward.');
      }
      var pj = t.phases && t.phases.projected;
      if (t.dataStatus === 'historical_plus_projected' && pj && pj.direction === 'decreasing') {
        sentences.push('The projections carry the decline further, to about ' + f(pj.end.value, 'tfr', { short: true }) +
          ' by ' + pj.end.label + (/^decelerating/.test(t.shape) ? ', with the pace of decline easing over time.' : '.'));
        keyPoints.push('Projected ' + f(pj.end.value, 'tfr', { short: true }) + ' by ' + pj.end.label);
      } else if (/^decelerating/.test(t.shape)) {
        sentences.push('The pace of decline eases over time.');
      }
      var lo = t.statusDetail && t.statusDetail.lastObserved;
      var data;
      if (lo && lo.x !== t.start.x && proj(t.end)) {
        /* The observed part gets its own verb: it may have risen even
           though the series as a whole falls. */
        var d0 = lo.value - t.start.value;
        var obs = Math.abs(d0) < t.threshold
          ? 'is ' + f(t.start.value, 'tfr') + ' in ' + t.start.label + ' and ' + f(lo.value, 'tfr', { short: true }) + ' in ' + lo.label
          : (d0 < 0 ? 'falls' : 'rises') + ' from ' + f(t.start.value, 'tfr') + ' in ' + t.start.label + ' to ' + f(lo.value, 'tfr', { short: true }) + ' in ' + lo.label;
        data = 'The total fertility rate ' + obs + ', and is projected to ' + (t.end.value < lo.value ? 'fall to ' : 'reach ') +
          f(t.end.value, 'tfr', { short: true }) + ' by ' + t.end.label + '.';
      } else {
        data = 'The total fertility rate falls from ' + f(t.start.value, 'tfr') + ' in ' + t.start.label + ' to ' +
          (proj(t.end) ? 'a projected ' : '') + f(t.end.value, 'tfr', { short: true }) + ' ' + L().when(t.end) + '.';
      }
      if (ref) {
        data += ' That ' + (proj(t.end) ? 'would leave' : 'leaves') + ' it ' + f(Math.abs(ref.endDistance), 'tfr', { short: true }) +
          ' ' + (ref.endDistance < 0 ? 'below' : 'above') + ' replacement level.';
      }
      return {
        headline: headline,
        story: sentences.join(' '),
        data: data,
        importance: 'Replacement level, about 2.1 children per woman, is the rate at which each generation just replaces itself. Fertility below it means each new generation is smaller than the one before.',
        keyPoints: keyPoints,
        covers: [t.id]
      };
    }
  });

  /* ── Sex ratio ──────────────────────────────────────────────────── */
  register({
    id: 'sex_ratio_path', type: 'sex_ratio_shift', level: 3, priority: 92,
    evaluate: function (ctx) {
      var s = ctx.byRole.sex_ratio;
      if (!ok(s)) return null;
      var f = L().fmt;
      var fmtS = function (v) { return f(v, s.format, { short: true }); };
      var parity = (s.references || []).filter(function (r) { return r.value === 1000; })[0];
      var tps = s.turningPoints || [];
      var trough = tps.filter(function (t) { return t.type === 'trough'; }).slice(-1)[0];
      var peakBefore = trough && tps.filter(function (t) { return t.type === 'peak' && t.x < trough.x; })[0];
      var endProj = proj(s.end);
      var sentences = [], headline, keyPoints = [];

      if (trough && s.end.value - trough.value >= s.threshold) {
        var lead = peakBefore
          ? 'After reaching a high around ' + peakBefore.label + ', the sex ratio declines for decades'
          : 'The sex ratio declines for decades';
        sentences.push(lead + ', bottoming out around ' + trough.label + ', and ' +
          (endProj ? 'then turns upward — a recovery the projections carry forward.' : 'then recovers.'));
        headline = 'A long dip, then a recovery';
        keyPoints.push('Lowest around ' + trough.label, 'Recovering since');
      } else if (s.direction === 'stable') {
        sentences.push('The sex ratio stays broadly stable over the period.');
        headline = 'A broadly stable sex ratio';
      } else if (s.netDirection === 'up' || s.netDirection === 'down') {
        var up = s.netDirection === 'up';
        sentences.push('The sex ratio ' + (s.dataStatus === 'projected' ? 'is projected to ' + (up ? 'rise' : 'fall') : (up ? 'rises' : 'falls')) +
          (s.interrupted ? ' overall, though not in a straight line.' : ' over the period.'));
        headline = up ? 'More females per 1,000 males' : 'Fewer females per 1,000 males';
      } else {
        sentences.push('The sex ratio moves up and down over the period rather than in one direction.');
        headline = 'An uneven path';
      }
      if (parity && parity.crossing) {
        var pc = parity.crossing, above = pc.direction === 'above';
        var meaning = above ? 'more females than males' : 'fewer females than males';
        var at = L().crossingWhen(pc);
        sentences.push(pc.status === 'projected'
          ? 'In the projections, it moves ' + (above ? 'above' : 'below') + ' parity ' + at + ', meaning ' + meaning + '.'
          : 'It has been ' + (above ? 'above' : 'below') + ' parity (' + meaning + ') since ' + at.replace(/^between (\S+) and /, '') + '.');
        keyPoints.push((above ? 'Above' : 'Below') + ' parity ' + (pc.status === 'projected' ? at : 'since ' + at.replace(/^between (\S+) and /, '')));
      }
      var data = 'The ratio stands at ' + fmtS(s.start.value) + ' females per 1,000 males in ' + s.start.label;
      if (trough) data += ', reaches its lowest point of ' + fmtS(trough.value) + ' in ' + trough.label;
      data += ', and ' + (endProj ? 'is projected to reach ' : 'reaches ') + fmtS(s.end.value) + ' ' + L().when(s.end) + '.';
      return {
        headline: headline,
        story: sentences.join(' '),
        data: data,
        importance: 'The sex ratio counts females per 1,000 males. Long-run swings can reflect differences in births, survival and migration, which this chart alone cannot separate.',
        keyPoints: keyPoints,
        covers: [s.id]
      };
    }
  });

  /* ── Two paired series (female vs male) ─────────────────────────── */
  register({
    id: 'gender_gap', type: 'gender_gap', level: 3, priority: 90,
    evaluate: function (ctx) {
      var m = ctx.byRole.male, fe = ctx.byRole.female;
      if (!ok(m) || !ok(fe) || !ctx.group) return null;
      var gap = ctx.group.pairs.filter(function (p) {
        return [p.seriesA, p.seriesB].indexOf(m.id) !== -1 && [p.seriesA, p.seriesB].indexOf(fe.id) !== -1;
      })[0];
      if (!gap) return null;
      var f = L().fmt;
      var survey = m.surveyRounds && m.n === 2;
      var femaleLeads = gap.end.leader === fe.id;
      var both = m.netDirection === fe.netDirection && m.netDirection !== 'flat'
        ? 'Both ' + m.label.toLowerCase() + ' and ' + fe.label.toLowerCase() + ' ' + (m.netDirection === 'up' ? 'rise' : 'fall') : null;
      var lead = survey ? 'Between the ' + m.start.label + ' and ' + m.end.label + ' survey rounds, ' : '';
      var gapWord = gap.direction === 'widening' ? 'widens' : gap.direction === 'narrowing' ? 'narrows' : gap.direction === 'crossover' ? 'reverses' : 'stays about the same';
      var story = (both ? L().cap(lead + both.charAt(0).toLowerCase() + both.slice(1)) + '. ' : '') +
        L().cap((femaleLeads ? fe.label : m.label)) + ' stays above ' + (femaleLeads ? m.label : fe.label).toLowerCase() +
        ', and the gap between them ' + gapWord + '.';
      var data = L().cap(fe.label) + ' goes from ' + f(fe.start.value, fe.format) + ' to ' + f(fe.end.value, fe.format) +
        ', and ' + m.label.toLowerCase() + ' from ' + f(m.start.value, m.format) + ' to ' + f(m.end.value, m.format) +
        '; the gap moves from ' + f(gap.start.gap, m.format) + ' to ' + f(gap.end.gap, m.format) + '.';
      return {
        headline: both ? 'Gains for both, a ' + (gap.direction === 'widening' ? 'wider' : gap.direction === 'narrowing' ? 'narrower' : 'steady') + ' gap' : 'The gap between women and men',
        story: story, data: data,
        importance: survey ? 'These are two survey rounds, not an annual series: the direction is informative, the path between them is not shown.' : null,
        keyPoints: [femaleLeads ? 'Women ahead' : 'Men ahead', 'Gap ' + gapWord],
        covers: [m.id, fe.id]
      };
    }
  });

  /* ── Several indicators moving together (e.g. three mortality rates) */
  register({
    id: 'shared_direction', type: 'decrease', level: 2, priority: 85,
    evaluate: function (ctx) {
      var ps = ctx.profiles.filter(ok);
      if (ps.length < 3) return null;
      var dir = ps[0].netDirection;
      if (dir === 'flat' || !ps.every(function (p) { return p.netDirection === dir; })) return null;
      var f = L().fmt;
      var down = dir === 'down';
      var biggest = ps.slice().sort(function (a, b) {
        return Math.abs(b.relativeChangePct || 0) - Math.abs(a.relativeChangePct || 0);
      })[0];
      var survey = ps[0].surveyRounds && ps[0].n === 2;
      var nWord = ['', '', 'both', 'all three', 'all four', 'all five'][ps.length] || 'all ' + ps.length;
      var lead = survey ? 'Between the ' + ps[0].start.label + ' and ' + ps[0].end.label + ' survey rounds, ' : '';
      var story = L().cap(lead + nWord + ' ' + (ctx.dataset.groupNoun || 'indicators') + ' ' + (down ? 'fall' : 'rise') + '.') +
        ' The ' + (down ? 'steepest relative drop' : 'largest relative rise') + ' is in the ' + biggest.label.toLowerCase() + '.';
      var data = ps.map(function (p) {
        return p.label + ' ' + f(p.start.value, p.format, { short: true }) + ' → ' + f(p.end.value, p.format, { short: true });
      }).join('; ') + '. ' + L().cap(biggest.label) + ' changes most, by ' + Math.round(Math.abs(biggest.relativeChangePct)) + '%.';
      var lowerBetter = ps.every(function (p) { return p.polarity === 'lower_is_better'; });
      return {
        type: lowerBetter && down ? 'health_improvement' : down ? 'decrease' : 'increase',
        headline: L().cap(nWord) + ' ' + (ctx.dataset.groupNoun || 'indicators') + ' ' + (down ? 'fall' : 'rise'),
        story: story, data: data,
        importance: lowerBetter && down
          ? 'Each of these measures counts deaths per 1,000 live births, so a lower figure means fewer deaths in that measure.'
          : null,
        keyPoints: ps.map(function (p) { return p.label + (down ? ' down' : ' up'); }),
        covers: ps.map(function (p) { return p.id; })
      };
    }
  });

  /* ── Generic pairwise crossover ─────────────────────────────────── */
  register({
    id: 'crossover', type: 'crossover', level: 3, priority: 80,
    evaluate: function (ctx) {
      if (!ctx.group) return null;
      var labels = {};
      ctx.profiles.forEach(function (p) { labels[p.id] = p.label; });
      return ctx.group.pairs.filter(function (pr) { return pr.crossovers.length; }).map(function (pr) {
        var c = pr.crossovers[0];
        var after = labels[c.leaderAfter], before = labels[c.leaderBefore];
        return {
          headline: 'The lines cross',
          story: 'The ' + String(before).toLowerCase() + ' and ' + String(after).toLowerCase() + ' lines cross ' +
            L().crossingWhen(c) + (c.status === 'projected' ? ' in the projections' : '') + '; after that, ' + String(after).toLowerCase() + ' is higher.',
          data: 'Crossover between ' + c.between[0] + ' and ' + c.between[1] + ' (around ' + Math.round(c.x) + ').',
          keyPoints: ['Crossover around ' + Math.round(c.x)],
          covers: [pr.seriesA, pr.seriesB]
        };
      });
    }
  });

  /* ── Pairwise gaps that clearly widen or narrow ─────────────────── */
  register({
    id: 'gap_change', type: 'convergence', level: 3, priority: 70,
    evaluate: function (ctx) {
      if (!ctx.group || ctx.profiles.length !== 2) return null;
      var pr = ctx.group.pairs[0];
      if (!pr || (pr.direction !== 'widening' && pr.direction !== 'narrowing')) return null;
      var wide = pr.direction === 'widening';
      return {
        type: wide ? 'divergence' : 'convergence',
        headline: wide ? 'The gap is widening' : 'The gap is narrowing',
        story: wide ? 'The gap between the two groups becomes progressively wider.' : 'The difference between the two groups gradually narrows.',
        data: 'The gap moves from ' + L().fmt(pr.start.gap, ctx.profiles[0].format) + ' in ' + pr.start.label + ' to ' +
          L().fmt(pr.end.gap, ctx.profiles[0].format) + ' ' + L().when({ label: pr.end.label, status: pr.end.status }) + '.',
        keyPoints: [wide ? 'Gap widening' : 'Gap narrowing'],
        covers: [pr.seriesA, pr.seriesB]
      };
    }
  });

  /* ── Population pyramid ─────────────────────────────────────────── */
  register({
    id: 'pyramid_transition', type: 'ageing', level: 4, priority: 96,
    evaluate: function (ctx) {
      var pa = ctx.pyramid;
      if (!pa || pa.insufficient || !pa.overall) return null;
      var o = pa.overall, a = pa.first, b = pa.last, fc = pa.focus;
      var f = L().fmt, has = function (k) { return pa.patterns.indexOf(k) !== -1; };
      var range = a.year + ' to ' + b.year + (b.status === 'projected' ? (a.status === 'projected' ? ' (projected)' : ' (later years projected)') : '');
      var sentences = [], headline, keyPoints = [];
      if (has('narrowing_base') && (has('expanding_top') || has('bulge_moves_up') || has('ageing'))) {
        sentences.push('From ' + range + ', the pyramid narrows at the base while the middle and older age groups fill out — a shift from a youthful population towards a more mature one.');
        headline = 'The shape itself is changing';
        keyPoints.push('Narrower base', 'Fuller middle and top');
      } else if (has('broadening_base')) {
        sentences.push('From ' + range + ', the base of the pyramid widens: young children make up a growing share of the population.');
        headline = 'A broadening base';
        keyPoints.push('Wider base');
      } else {
        sentences.push('From ' + range + ', the overall shape of the pyramid changes little.');
        headline = 'A broadly similar shape';
      }
      if (ctx.focusYear && fc) {
        sentences.push('In ' + fc.year + (fc.status === 'projected' ? ' (projected)' : '') + ', the largest age group is ' + fc.modalBand +
          ', and the base is ' + (fc.shape === 'constrictive' ? 'already narrower than the middle' : fc.shape === 'expansive' ? 'still the widest part' : 'about as wide as the middle') + '.');
      }
      var data = 'Children under five make up ' + f(a.baseShare, 'percent') + ' of the population in ' + a.year + ' and ' +
        f(b.baseShare, 'percent') + ' in ' + b.year + (b.status === 'projected' ? ' (projected)' : '') + '; the most populous five-year group moves from ' + a.modalBand + ' to ' +
        b.modalBand + ', and the median age rises from about ' + Math.round(a.medianAge) + ' to about ' + Math.round(b.medianAge) + ' years.';
      if (o.medianAgeChange < 0) data = data.replace('rises', 'falls');
      return {
        headline: headline,
        story: sentences.join(' '),
        data: data,
        importance: 'A narrowing base with a fuller middle and top means each new cohort of children is small relative to the adults above it — the visual signature of population ageing.',
        keyPoints: keyPoints.concat(['Median age ' + Math.round(a.medianAge) + ' → ' + Math.round(b.medianAge)]),
        covers: ['pyramid']
      };
    }
  });

  register({
    id: 'pyramid_sex_balance', type: 'gender_gap', level: 3, priority: 55,
    evaluate: function (ctx) {
      var pa = ctx.pyramid;
      if (!pa || pa.insufficient || !pa.elderlyFemaleSurplus) return null;
      return {
        headline: 'More women at older ages',
        story: 'Women outnumber men in most of the older age groups.',
        data: 'In ' + pa.focus.year + (pa.focus.status === 'projected' ? ' (projected)' : '') + ', the female count exceeds the male count in most bands aged 60 and over.',
        keyPoints: ['Women outnumber men at older ages'],
        covers: []
      };
    }
  });

  /* ── Where this district sits among its peers ───────────────────── */
  register({
    id: 'peer_ranking', type: 'ranking', level: 3, priority: 30,
    evaluate: function (ctx) {
      var pr = ctx.peers, meta = ctx.dataset.peers;
      if (!pr || !pr.selected || !meta) return null;
      /* If every district has (nearly) the same value, a rank is noise:
         the projections may simply apply one rate to all districts. */
      if (Math.abs(pr.highest.value - pr.lowest.value) <= Math.abs(pr.median) * 0.02) return null;
      var s = pr.selected;
      var rankText = s.rank === 1 ? 'the highest of ' + pr.n : s.rank === pr.n ? 'the lowest of ' + pr.n : L().ordinal(s.rank) + ' highest of ' + pr.n;
      var band = s.band === 'among_highest' ? 'among the highest' : s.band === 'among_lowest' ? 'among the lowest' : 'close to the middle of the range';
      var f = L().fmt;
      return {
        headline: 'Compared with other districts',
        story: 'Among Odisha’s ' + pr.n + ' districts, ' + ctx.geo + '’s ' + meta.metricLabel + ' is ' + band +
          (s.isOutlier ? ', and stands apart from the rest' : '') + '.',
        data: ctx.geo + '’s ' + meta.metricLabel + ' is ' + f(s.value, meta.format, { short: true }) + ', ' +
          rankText + ' districts (district median ' + f(pr.median, meta.format, { short: true }) + ').',
        keyPoints: [L().cap(rankText) + ' districts'],
        covers: []
      };
    }
  });

  /* ── Fallback: a plain description of each remaining series ─────── */
  register({
    id: 'series_trend', level: 2, priority: 40,
    evaluate: function (ctx) {
      return ctx.profiles.filter(ok).map(function (p) {
        var t = L().describeTrend(p);
        var type = p.direction === 'increasing' ? 'increase' : p.direction === 'decreasing' ? 'decrease'
          : p.direction === 'stable' ? 'stable' : p.trough ? 'trough' : p.peak ? 'peak' : 'mixed';
        if (/^accelerating/.test(p.shape)) type = 'acceleration';
        if (/^decelerating/.test(p.shape)) type = 'deceleration';
        var head = p.direction === 'increasing' ? 'rising' : p.direction === 'decreasing' ? 'falling'
          : p.direction === 'stable' ? 'broadly stable' : 'on an uneven path';
        return {
          type: type,
          priority: 40 + (p.strength === 'strong' ? 20 : p.strength === 'moderate' ? 10 : 0),
          headline: L().cap(p.label) + ' ' + head,
          story: t.story,
          data: t.data,
          keyPoints: [L().cap(p.label) + ' ' + head],
          covers: [p.id]
        };
      });
    }
  });

  NS.rules = {
    TYPES: TYPES,
    register: register,
    evaluate: evaluate,
    list: function () { return registry.map(function (r) { return r.id; }); }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = NS.rules;
})(typeof window !== 'undefined' ? window : globalThis);
