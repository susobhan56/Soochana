import React, {useMemo} from 'react';
import {AbsoluteFill, Easing, interpolate, interpolateColors, random} from 'remotion';
import data from '../data/odisha.json';
import {C, H, W, oriya, outfit, serif} from '../lib/theme';
import {NOW_YEAR, fmtIN, perDay, statePop} from '../lib/pop';
import {useTextPoints} from '../lib/textPoints';
import {useT} from '../lib/ui';

/* Scene timing, in frames at 30 fps. */
const T = {
  gather: 10, // dots start flying from the scatter to the map
  outline: 70, // district outlines appear
  countFrom: 20,
  countTo: 135,
  morph: 188, // dots leave the map for the word ସୂଚନା
  title: 236,
  tagline: 262,
};
export const OPENING_FRAMES = 320;

const MAP = {x: 905, y: 70, s: 0.94};
const N = data.dots.length;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = Easing.bezier(0.65, 0, 0.35, 1);

const fade = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], clamp);

export const Opening: React.FC = () => {
  const f = useT();

  const text = useTextPoints('ସୂଚନା', oriya, {
    weight: 700,
    size: 330,
    cx: W / 2,
    cy: 430,
    width: W,
    height: H,
    count: N,
  });

  /* Pair map dots with letter points left to right, so every dot travels a short, tidy path. */
  const target = useMemo(() => {
    if (!text) return null;
    const byX = data.dots.map((d, i) => ({i, x: MAP.x + d[0] * MAP.s})).sort((a, b) => a.x - b.x);
    const pts = [...text].sort((a, b) => a[0] - b[0]);
    const out: ([number, number] | null)[] = new Array(N).fill(null);
    byX.forEach((d, k) => {
      const j = Math.floor((k * pts.length) / N);
      out[d.i] = k < pts.length || pts.length >= N ? pts[Math.min(j, pts.length - 1)] : null;
    });
    return out;
  }, [text]);

  if (!target) return null;

  const year = interpolate(f, [T.countFrom, T.countTo], [1951, NOW_YEAR], {...clamp, easing: ease});
  const counting = f < T.countTo;
  const hookOut = 1 - fade(f, T.morph - 8, T.morph + 10);
  const camera = interpolate(f, [0, OPENING_FRAMES], [1, 1.035]);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 60% 45%, ${C.navy} 0%, ${C.navyDeep} 75%)`,
        fontFamily: outfit.fontFamily,
      }}
    >
      <AbsoluteFill style={{transform: `scale(${camera})`}}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <g
            transform={`translate(${MAP.x} ${MAP.y}) scale(${MAP.s})`}
            opacity={fade(f, T.outline, T.outline + 40) * hookOut}
          >
            {data.districts.map((d) => (
              <path key={d.name} d={d.d} fill="none" stroke={C.skySoft} strokeOpacity={0.28} strokeWidth={1.4} />
            ))}
          </g>
          {data.dots.map((d, i) => {
            const sx = random(`sx${i}`) * W;
            const sy = random(`sy${i}`) * H;
            const mx = MAP.x + d[0] * MAP.s;
            const my = MAP.y + d[1] * MAP.s;
            const t1 = interpolate(f, [T.gather + random(`d${i}`) * 38 + (d[1] / 1000) * 14, T.gather + 56 + random(`d${i}`) * 38 + (d[1] / 1000) * 14], [0, 1], {...clamp, easing: ease});
            const delay2 = random(`e${i}`) * 22;
            const t2 = interpolate(f, [T.morph + delay2, T.morph + 46 + delay2], [0, 1], {...clamp, easing: ease});
            const tp = target[i];
            const tx = tp ? tp[0] : mx;
            const ty = tp ? tp[1] : my;
            const x = interpolate(t2, [0, 1], [interpolate(t1, [0, 1], [sx, mx]), tx]);
            const y = interpolate(t2, [0, 1], [interpolate(t1, [0, 1], [sy, my]), ty]);
            const r = interpolate(t2, [0, 1], [interpolate(t1, [0, 1], [2.4, 5.6]), 3.9]);
            const roll = random(`c${i}`);
            const base = roll < 0.07 ? C.yellow : roll < 0.11 ? C.amber : roll < 0.3 ? C.skySoft : C.sky;
            /* Blue letters, with the closing ା picked out in the portal's yellow. */
            const word = interpolateColors((tx - 540) / 830, [0, 0.88, 0.92, 1], [C.sky, C.skySoft, C.yellow, C.yellow]);
            const fill = interpolateColors(t2, [0, 1], [base, word]);
            const twinkle = 0.78 + 0.22 * Math.sin(f / 9 + i * 1.7);
            const alive = tp ? 1 : 1 - t2;
            const op = fade(f, 0, 12) * twinkle * alive * interpolate(t1, [0, 1], [0.55, 1]);
            return <circle key={i} cx={x} cy={y} r={r} fill={fill} opacity={op} />;
          })}
        </svg>
      </AbsoluteFill>

      {/* The live counter, as on the portal's welcome screen. */}
      <div style={{position: 'absolute', left: 130, top: 300, width: 760, opacity: hookOut}}>
        <div
          style={{
            color: C.skySoft,
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '0.22em',
            opacity: fade(f, 10, 28),
            transform: `translateY(${interpolate(fade(f, 10, 28), [0, 1], [16, 0])}px)`,
          }}
        >
          ODISHA · LIVE POPULATION ESTIMATE
        </div>
        <div
          style={{
            color: C.paper,
            fontSize: 126,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.01em',
            lineHeight: 1.05,
            marginTop: 22,
            opacity: fade(f, 16, 30),
          }}
        >
          {fmtIN(statePop(year))}
        </div>
        <div style={{height: 64, marginTop: 14, position: 'relative'}}>
          <div style={{position: 'absolute', color: C.yellow, fontSize: 40, fontWeight: 400, opacity: fade(f, 20, 32) * (counting ? 1 : 1 - fade(f, T.countTo, T.countTo + 8))}}>
            in {Math.floor(year)}
          </div>
          <div style={{position: 'absolute', color: C.paper, fontSize: 44, fontWeight: 300, opacity: fade(f, T.countTo + 2, T.countTo + 14)}}>
            people live in Odisha <span style={{color: C.yellow, fontWeight: 600}}>right now.</span>
          </div>
        </div>
        <div style={{color: C.muted, fontSize: 22, marginTop: 30, lineHeight: 1.5, opacity: fade(f, T.countTo + 14, T.countTo + 28)}}>
          Estimated from district population projections, 1951–2036.
          <br />
          Odisha gains about {Math.round(perDay() / 50) * 50} people every day.
        </div>
      </div>

      {/* Title */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 650, textAlign: 'center'}}>
        <div
          style={{
            color: C.paper,
            fontSize: 72,
            fontWeight: 600,
            letterSpacing: `${interpolate(fade(f, T.title, T.title + 30), [0, 1], [0.6, 0.32])}em`,
            paddingLeft: '0.32em',
            opacity: fade(f, T.title, T.title + 18),
          }}
        >
          SOOCHANA
        </div>
        <div style={{color: C.skySoft, fontSize: 32, fontWeight: 300, marginTop: 18, letterSpacing: '0.04em', opacity: fade(f, T.title + 12, T.title + 28)}}>
          Odisha’s Demographic Intelligence Portal
        </div>
        <div
          style={{
            color: C.yellow,
            fontFamily: serif.fontFamily,
            fontStyle: 'italic',
            fontWeight: 300,
            fontSize: 44,
            marginTop: 40,
            opacity: fade(f, T.tagline, T.tagline + 16),
            transform: `translateY(${interpolate(fade(f, T.tagline, T.tagline + 16), [0, 1], [14, 0])}px)`,
          }}
        >
          From numbers to narrative
        </div>
      </div>
    </AbsoluteFill>
  );
};
