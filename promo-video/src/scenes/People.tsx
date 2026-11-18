import React from 'react';
import {interpolate, interpolateColors, random} from 'remotion';
import S from '../data/scenes.json';
import {C, outfit} from '../lib/theme';
import {Body, Chip, Headline, Hi, Kicker, Source, fade, tween, window_, useT} from '../lib/ui';

/* "Odisha, told in 100 people": the same 100 dots re-form four times, as in
   the home page story. */
export const PEOPLE_FRAMES = 350;
const P = [0, 88, 176, 264]; // phase starts
const MORPH = 28;

type Dot = {x: number; y: number; r: number; c: string; o: number};

/* ── layouts ─────────────────────────────────────────── */
const grid = (i: number) => ({x: 1040 + (i % 10) * 64, y: 236 + Math.floor(i / 10) * 64});

const popAt = (y: number) => {
  const L = S.popLine;
  for (let k = 0; k < L.length - 1; k++) {
    if (y <= L[k + 1].year) {
      const a = L[k], b = L[k + 1];
      return a.pop * Math.pow(b.pop / a.pop, (y - a.year) / (b.year - a.year));
    }
  }
  return L[L.length - 1].pop;
};
const lx = (yr: number) => interpolate(yr, [1901, 2036], [960, 1760]);
const ly = (pop: number) => interpolate(pop, [0, 5.5e7], [840, 250]);

const tx = (t: number) => interpolate(t, [1.0, 2.8], [960, 1760]);
/* A simple beeswarm: each district sits at its fertility rate, nudged up or down to clear its neighbours. */
const swarm = (vals: number[], r: number) => {
  const placed: {x: number; y: number}[] = [];
  const out: number[] = new Array(vals.length);
  vals
    .map((v, i) => ({i, x: tx(v)}))
    .sort((a, b) => a.x - b.x)
    .forEach(({i, x}) => {
      for (let k = 0; ; k++) {
        const y = 560 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (r * 2 + 4);
        if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= r * 2 + 3)) {
          placed.push({x, y});
          out[i] = y;
          break;
        }
      }
    });
  return out;
};
const TFR_R = 15;
const sw2020 = swarm(S.tfr.map((d) => d.y2020), TFR_R);
const sw2036 = swarm(S.tfr.map((d) => d.y2036), TFR_R);
const tfrColour = (v: number) => (v > 2.1 ? C.amber : C.sky);

const ages = (yr: 0 | 1) => {
  const [ch, wk, el] = S.ages[yr].shares;
  return {el, wk, ch};
};
const ageColour = (i: number, a: {el: number; wk: number}) => (i < a.el ? C.yellow : i < a.el + a.wk ? C.sky : C.skySoft);

/* `seamless`: the dots are already on the grid, carried in from the narrative scene. */
const layout = (phase: number, i: number, f: number, seamless = false): Dot => {
  if (phase === 0) {
    const g = grid(i);
    const pop = seamless ? 1 : tween(f, 6 + random(`p${i}`) * 30, 26 + random(`p${i}`) * 30, 0, 1);
    const urbanOn = fade(f, 40 + (i - 83) * 1.2, 50 + (i - 83) * 1.2);
    return {...g, r: 23 * pop, c: i >= S.rural ? interpolateColors(urbanOn, [0, 1], [C.sky, C.yellow]) : C.sky, o: pop};
  }
  if (phase === 1) {
    const yr = 1901 + (i * 135) / 99;
    return {x: lx(yr), y: ly(popAt(yr)), r: 8, c: yr <= 2011 ? C.sky : C.yellow, o: 1};
  }
  if (phase === 2) {
    if (i >= S.tfr.length) return {x: 960 + (i / 100) * 800, y: 840, r: 0, c: C.sky, o: 0};
    const d = S.tfr[i];
    const t = tween(f, P[2] + 42, P[2] + 74, 0, 1);
    const v = interpolate(t, [0, 1], [d.y2020, d.y2036]);
    return {x: tx(v), y: interpolate(t, [0, 1], [sw2020[i], sw2036[i]]), r: TFR_R, c: tfrColour(v), o: 1};
  }
  const g = grid(i);
  const t = fade(f, P[3] + 44 + (i % 10) * 1.5, P[3] + 54 + (i % 10) * 1.5);
  return {...g, r: 23, c: interpolateColors(t, [0, 1], [ageColour(i, ages(0)), ageColour(i, ages(1))]), o: 1};
};

const dotAt = (i: number, f: number, seamless: boolean): Dot => {
  let phase = 0;
  for (let k = 1; k < P.length; k++) if (f >= P[k]) phase = k;
  const cur = layout(phase, i, f, seamless);
  if (phase === 0) return cur;
  const delay = random(`m${i}`) * 14;
  const t = tween(f, P[phase] + delay, P[phase] + delay + MORPH, 0, 1);
  if (t >= 1) return cur;
  const prev = layout(phase - 1, i, P[phase] - 1, seamless);
  return {
    x: interpolate(t, [0, 1], [prev.x, cur.x]),
    y: interpolate(t, [0, 1], [prev.y, cur.y]),
    r: interpolate(t, [0, 1], [prev.r, cur.r]),
    c: interpolateColors(t, [0, 1], [prev.c, cur.c]),
    o: interpolate(t, [0, 1], [prev.o, cur.o]),
  };
};

/* The dot that stands for Mitali: a village dot in the middle of the grid. */
const MITALI = 54;
const crore = (n: number) => (n / 1e7).toFixed(2);
const lakh = (n: number) => Math.round(n / 1e5);

export const People: React.FC<{seamless?: boolean}> = ({seamless = false}) => {
  const f = useT();
  const L = S.popLine;
  const first = L[0], census = L.find((p) => p.year === 2011)!, last = L[L.length - 1];
  const yearT = tween(f, P[2] + 42, P[2] + 74, 0, 1);
  const agesT = fade(f, P[3] + 44, P[3] + 66);

  const texts = [
    {
      h: <><Hi>{S.rural}</Hi> of 100 live in villages.</>,
      b: <>Only {S.urban} live in towns and cities. {S.tribal} belong to a Scheduled Tribe.</>,
      s: 'Census of India 2011',
    },
    {
      h: <>From <Hi>{crore(first.pop)}</Hi> crore to <Hi>{crore(last.pop)}</Hi> crore.</>,
      b: <>Odisha grew {(census.pop / L.find((p) => p.year === 1951)!.pop).toFixed(1)}× in sixty years. Now growth is steadying.</>,
      s: 'Census 1901–2011; projections to 2036',
    },
    {
      h: <>Families are getting <Hi>smaller</Hi>.</>,
      b: <>{S.tfrAbove2020} of 30 districts were above replacement fertility in 2020. By 2036, just {S.tfrAbove2036}. Each district at its own pace.</>,
      s: 'District fertility projections, 2020–2036',
    },
    {
      h: <>People are living <Hi>longer</Hi>.</>,
      b: <>By 2036, {S.ages[1].shares[2]} of every 100 will be over 60, up from {S.ages[0].shares[2]}: about {lakh(S.ages[1].elders)} lakh people. Progress worth planning for.</>,
      s: 'State age projections, 2021–2036',
    },
  ];

  return (
    <>
      <Chip where="Home" what="Odisha, told in 100 people" />
      <div style={{position: 'absolute', left: 130, top: 300, width: 740}}>
        <Kicker style={{opacity: fade(f, 6, 20)}}>IF ODISHA WERE 100 PEOPLE</Kicker>
        <div style={{position: 'relative', marginTop: 28}}>
          {texts.map((t, k) => {
            const end = k < 3 ? P[k + 1] + 6 : PEOPLE_FRAMES + 20;
            const o = window_(f, P[k] + (k ? 10 : 8), end);
            return (
              <div key={k} style={{position: 'absolute', top: 0, opacity: o, transform: `translateY(${interpolate(fade(f, P[k] + 8, P[k] + 22), [0, 1], [18, 0])}px)`}}>
                <Headline size={60}>{t.h}</Headline>
                <Body style={{marginTop: 24}}>{t.b}</Body>
                <Source style={{marginTop: 30}}>{t.s}</Source>
              </div>
            );
          })}
        </div>
      </div>

      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        {/* population axis */}
        <g opacity={window_(f, P[1] + 14, P[2] + 4)} fontFamily={outfit.fontFamily} fontSize={20} fill={C.muted}>
          <line x1={960} x2={1760} y1={860} y2={860} stroke={C.muted} strokeOpacity={0.4} />
          {[1901, 1951, 2011, 2036].map((y) => (
            <text key={y} x={lx(y)} y={895} textAnchor="middle">{y}</text>
          ))}
          <line x1={lx(2011)} x2={lx(2011)} y1={300} y2={860} stroke={C.muted} strokeOpacity={0.3} strokeDasharray="4 6" />
          <text x={lx(2011) + 12} y={842} fill={C.yellow}>projected →</text>
          {[first, census, last].map((p) => (
            <text key={p.year} x={lx(p.year) + (p.year === 2011 ? -16 : 0)} y={ly(p.pop) - (p.year === 2011 ? 6 : 26)} textAnchor={p.year === 1901 ? 'start' : p.year === 2011 ? 'end' : 'middle'} fill={C.paper} fontSize={24} fontWeight={600}>
              {crore(p.pop)} cr
            </text>
          ))}
        </g>
        {/* fertility axis */}
        <g opacity={window_(f, P[2] + 14, P[3] + 4)} fontFamily={outfit.fontFamily} fontSize={20} fill={C.muted}>
          <line x1={960} x2={1760} y1={820} y2={820} stroke={C.muted} strokeOpacity={0.4} />
          {[1.0, 1.5, 2.0, 2.5].map((v) => (
            <text key={v} x={tx(v)} y={855} textAnchor="middle">{v.toFixed(1)}</text>
          ))}
          <text x={1360} y={892} textAnchor="middle">children per woman</text>
          <line x1={tx(2.1)} x2={tx(2.1)} y1={330} y2={820} stroke={C.yellow} strokeWidth={2} strokeDasharray="6 8" />
          <text x={tx(2.1) + 14} y={350} fill={C.yellow} fontSize={22}>2.1 · replacement level</text>
          <text x={960} y={330} fill={C.paper} fontSize={64} fontWeight={700}>{yearT < 0.5 ? 2020 : 2036}</text>
          <text x={960} y={370} fill={C.muted}>each dot is a district</text>
        </g>
        {/* ages legend */}
        <g opacity={window_(f, P[3] + 18, PEOPLE_FRAMES + 20)} fontFamily={outfit.fontFamily} fontSize={22} fill={C.paper}>
          <text x={1020} y={195} fontSize={44} fontWeight={700}>{agesT < 0.5 ? S.ages[0].year : S.ages[1].year}</text>
          {[
            [C.yellow, `60+  ·  ${Math.round(interpolate(agesT, [0, 1], [S.ages[0].shares[2], S.ages[1].shares[2]]))}`],
            [C.sky, `15–59  ·  ${Math.round(interpolate(agesT, [0, 1], [S.ages[0].shares[1], S.ages[1].shares[1]]))}`],
            [C.skySoft, `under 15  ·  ${Math.round(interpolate(agesT, [0, 1], [S.ages[0].shares[0], S.ages[1].shares[0]]))}`],
          ].map(([c, t], k) => (
            <g key={k} transform={`translate(${1020 + k * 220} 920)`}>
              <circle r={9} cx={9} cy={-8} fill={c} />
              <text x={28}>{t}</text>
            </g>
          ))}
        </g>
        {/* urban/rural legend */}
        <g opacity={window_(f, 44, P[1] + 4)} fontFamily={outfit.fontFamily} fontSize={22} fill={C.paper}>
          {[
            [C.sky, `in villages · ${S.rural}`],
            [C.yellow, `in towns · ${S.urban}`],
          ].map(([c, t], k) => (
            <g key={k} transform={`translate(${1020 + k * 260} 920)`}>
              <circle r={9} cx={9} cy={-8} fill={c} />
              <text x={28}>{t}</text>
            </g>
          ))}
          <text x={1020} y={195} fill={C.muted}>1 dot ≈ {(S.popLine.find((p) => p.year === 2021)!.pop / 100 / 1e5).toFixed(1)} lakh people</text>
        </g>
        {Array.from({length: 100}, (_, i) => {
          const d = dotAt(i, f, seamless);
          return <circle key={i} cx={d.x} cy={d.y} r={Math.max(0, d.r)} fill={d.c} opacity={d.o} />;
        })}
        {/* Mitali, the narration's character: one village dot, picked out while the dots are people */}
        {(() => {
          const m = dotAt(MITALI, f, seamless);
          const o = window_(f, 10, P[1] + 4);
          const pulse = 1 + 0.18 * Math.sin(f / 5);
          return (
            <g opacity={o} fontFamily={outfit.fontFamily}>
              <circle cx={m.x} cy={m.y} r={m.r + 7 * pulse} fill="none" stroke={C.yellow} strokeWidth={4} />
              <circle cx={m.x} cy={m.y} r={m.r} fill={C.paper} />
              <rect x={m.x - 62} y={m.y - m.r - 66} width={124} height={44} rx={22} fill={C.navyDeep} stroke={C.yellow} strokeWidth={2} />
              <text x={m.x} y={m.y - m.r - 35} textAnchor="middle" fill={C.yellow} fontSize={26} fontWeight={600}>Mitali</text>
            </g>
          );
        })()}
      </svg>
    </>
  );
};
