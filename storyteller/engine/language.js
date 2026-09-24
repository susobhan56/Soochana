/**
 * storyteller/engine/language.js
 * Number formatting and the small phrase-building helpers the rules use.
 *
 * The rules in rules.js decide WHAT to say; this file decides how a value,
 * a change or a period reads in plain English — percentage points vs per
 * cent, lakh/crore for people, "is projected to" for projections.
 */
(function (root) {
  'use strict';
  var NS = root.SoochanaInsight = root.SoochanaInsight || {};

  var PROJECTED = { projected: 1, modelled: 1 };

  /* Display units. `short` drops the long suffix when a sentence already
     names the unit once. */
  var UNITS = {
    persons:       { style: 'indian' },
    million:       { dp: 1, suffix: ' million' },
    percent:       { dp: 1, suffix: '%', keepShort: true },
    growth:        { dp: 2, suffix: '% a year', shortSuffix: '%' },
    sexratio:      { dp: 0, suffix: ' females per 1,000 males' },
    srb:           { dp: 0, suffix: ' girls born per 1,000 boys' },
    tfr:           { dp: 2, suffix: ' children per woman', trim: true },
    years:         { dp: 1, suffix: ' years', keepShort: true },
    per1000births: { dp: 1, suffix: ' per 1,000 live births' },
    per100kbirths: { dp: 0, suffix: ' per 100,000 live births' },
    value:         { dp: 2 }
  };

  function trimZeros(s) { return s.indexOf('.') === -1 ? s : s.replace(/\.?0+$/, ''); }

  function indian(v) {
    var a = Math.abs(v);
    if (a >= 1e7) return trimZeros((v / 1e7).toFixed(2)) + ' crore';
    if (a >= 1e5) return trimZeros((v / 1e5).toFixed(2)) + ' lakh';
    return Math.round(v).toLocaleString('en-IN');
  }

  function fmt(v, unit, opts) {
    opts = opts || {};
    if (v == null || !isFinite(v)) return 'n/a';
    var u = UNITS[unit] || UNITS.value;
    if (u.style === 'indian') return indian(v);
    var dp = opts.dp != null ? opts.dp : u.dp;
    var s = Number(v).toFixed(dp);
    if (u.trim) s = trimZeros(Number(v).toFixed(dp));
    if (dp === 0) s = Math.round(v).toLocaleString('en-IN');
    if (opts.short) return s + (u.keepShort ? u.suffix : (u.shortSuffix || ''));
    return s + (u.suffix || '');
  }

  function isProjected(point) { return !!(point && PROJECTED[point.status]); }

  /* "in 2011", "by 2036" — "by" signals a projection's horizon. */
  function when(point) {
    if (!point) return '';
    return (isProjected(point) ? 'by ' : 'in ') + point.label;
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function subjectOf(p) { return p.subject || ('the ' + String(p.label || 'indicator').toLowerCase()); }

  /* Magnitude of a change, in the unit that means something:
     percentage points for shares, a multiple for large growth in counts,
     and a relative per cent otherwise. */
  function magnitude(p) {
    var abs = Math.abs(p.absoluteChange);
    if (p.unitKind === 'percent') {
      var pp = abs < 10 ? abs.toFixed(1) : Math.round(abs);
      return pp + ' percentage point' + (pp === '1.0' ? '' : 's');
    }
    var start = p.start.value, end = p.end.value;
    if (p.relativeChangePct != null && start > 0) {
      var ratio = end / start;
      if (ratio >= 2.4) return 'about ' + Math.round(ratio) + ' times its ' + p.start.label + ' level';
      if (ratio >= 1.9) return 'roughly double';
      if (ratio <= 0.55 && ratio > 0.4) return 'roughly half';
      return Math.round(Math.abs(p.relativeChangePct)) + '%';
    }
    return fmt(abs, p.format);
  }

  function hedge(sentence, confidence, properNouns) {
    if (confidence === 'high' || !sentence) return sentence;
    var lead = confidence === 'medium' ? 'The available figures suggest that ' : 'The limited observations indicate that ';
    /* Lower-case the first word unless it is a name ("Koraput") or an
       acronym ("NFHS-5", "TFR"). */
    var firstWord = sentence.split(/[\s,’']/)[0];
    var keep = (properNouns || []).indexOf(firstWord) !== -1 || /^[A-Z0-9-]{2,}$/.test(firstWord);
    return lead + (keep ? sentence : sentence.charAt(0).toLowerCase() + sentence.slice(1));
  }

  /* When a crossing falls between two points far apart, name the
     interval rather than an interpolated year: "between 2011 and 2021"
     is honest, "around 2013" is false precision. */
  function crossingWhen(c) {
    if (!c) return '';
    var a = parseInt(c.between && c.between[0], 10), b = parseInt(c.between && c.between[1], 10);
    if (isFinite(a) && isFinite(b) && b - a > 5) return 'between ' + c.between[0] + ' and ' + c.between[1];
    return 'around ' + Math.round(c.approxYear != null ? c.approxYear : c.x);
  }

  /* Verb for a direction, softened when the move is weak. */
  function verb(direction, strength, projected) {
    var up = direction === 'increasing';
    var base = strength === 'weak' ? (up ? 'edge up' : 'edge down') : (up ? 'rise' : 'fall');
    if (projected) return 'is projected to ' + base;
    return base === 'rise' ? 'rises' : base === 'fall' ? 'falls' : base + 's';
  }

  /* Generic, rule-free description of one series — the fallback when no
     domain rule claims it. Returns { story, data }. */
  function describeTrend(p) {
    var subj = subjectOf(p);
    var allProjected = p.dataStatus === 'projected';
    var survey = p.surveyRounds && p.n === 2;
    var lead = survey ? 'Between the ' + p.start.label + ' and ' + p.end.label + ' survey rounds, ' : '';
    var sh = { short: true };
    var span = 'from ' + fmt(p.start.value, p.format) + ' ' + when(p.start) + ' to ' +
      (isProjected(p.end) && !isProjected(p.start) ? 'a projected ' : '') + fmt(p.end.value, p.format, sh) + ' ' + when(p.end);
    var story, data;

    if (p.direction === 'stable') {
      story = subj + (allProjected ? ' is projected to stay' : ' stays') + ' broadly stable over the period';
      data = story + ', moving only ' + span;
    } else if (p.direction === 'mixed') {
      if (p.shape === 'u_shaped' && p.trough) {
        story = subj + ' falls to a low around ' + p.trough.label + (isProjected(p.end) ? ' and is then projected to recover' : ' and then recovers');
        data = subj + ' falls from ' + fmt(p.start.value, p.format) + ' ' + when(p.start) + ' to a low of ' +
          fmt(p.trough.value, p.format, sh) + ' in ' + p.trough.label + (isProjected(p.end) ? ', and is then projected to reach ' : ', then returns to ') +
          fmt(p.end.value, p.format, sh) + ' ' + when(p.end);
      } else if (p.shape === 'inverted_u' && p.peak) {
        story = subj + ' climbs to a high around ' + p.peak.label + (isProjected(p.end) ? ' and is then projected to ease' : ' and then eases');
        data = subj + ' rises from ' + fmt(p.start.value, p.format) + ' ' + when(p.start) + ' to a high of ' +
          fmt(p.peak.value, p.format, sh) + ' in ' + p.peak.label + (isProjected(p.end) ? ', and is then projected to ease to ' : ', then eases to ') +
          fmt(p.end.value, p.format, sh) + ' ' + when(p.end);
      } else {
        story = subj + ' moves up and down over the period rather than in one direction';
        data = story + ', ranging between ' + fmt(p.lowest.value, p.format, sh) + ' and ' + fmt(p.highest.value, p.format);
      }
    } else {
      var up = p.direction === 'increasing';
      var projectedOnly = allProjected;
      var v = verb(p.direction, p.strength, projectedOnly);
      var manner = '';
      if (/^accelerating/.test(p.shape)) manner = up ? ', and the rise gathers pace over time' : ', and the fall steepens over time';
      else if (/^decelerating/.test(p.shape)) manner = up ? ', though more slowly over time' : ', though the decline slows over time';
      else if (p.strength === 'strong' && !p.interrupted && p.n > 2) manner = ' steadily';
      if (p.interrupted && p.turningPoints.length) {
        var tp = p.turningPoints[0];
        manner = ' overall, despite a ' + (tp.type === 'peak' ? 'temporary high' : 'dip') + ' around ' + tp.label;
      }
      story = subj + ' ' + v + manner;
      data = subj + ' ' + v + ' ' + span + ' — ' + (up ? 'an increase' : 'a decrease') + ' of ' + magnitude(p);
      if (!projectedOnly && p.dataStatus === 'historical_plus_projected' && p.phases.projected &&
          p.phases.observed && p.phases.projected.direction !== p.phases.observed.direction) {
        story += '; the projections, however, show it ' +
          (p.phases.projected.direction === 'increasing' ? 'rising' : p.phases.projected.direction === 'decreasing' ? 'falling' : 'levelling off') +
          ' after ' + p.phases.observed.end.label;
      }
    }
    return { story: cap(lead ? lead + story.charAt(0).toLowerCase() + story.slice(1) : story) + '.',
             data: cap(lead ? lead + data.charAt(0).toLowerCase() + data.slice(1) : data) + '.' };
  }

  function listJoin(items) {
    if (items.length <= 1) return items.join('');
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }

  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  NS.language = {
    UNITS: UNITS,
    fmt: fmt,
    indian: indian,
    when: when,
    cap: cap,
    isProjected: isProjected,
    subjectOf: subjectOf,
    magnitude: magnitude,
    hedge: hedge,
    crossingWhen: crossingWhen,
    verb: verb,
    describeTrend: describeTrend,
    listJoin: listJoin,
    ordinal: ordinal
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = NS.language;
})(typeof window !== 'undefined' ? window : globalThis);
