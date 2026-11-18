import React from 'react';
import {interpolate, random} from 'remotion';
import S from '../data/scenes.json';
import {C, outfit} from '../lib/theme';
import {Chip, Headline, Hi, Kicker, Source, easeOut, fade, tween, useT} from '../lib/ui';

/* NFHS-5 → NFHS-6 (district-health.html): every indicator with a clear better
   direction is one dot, placed by how far it moved in the healthy direction. */
export const HEALTH_FRAMES = 210;

const X0 = 200, X1 = 1720, MID = 560, R = 12;
const gx = (g: number) => interpolate(g, [-16, 36], [X0, X1]);
const COL = {up: C.sky, down: C.amber, flat: '#7d8fa3'} as const;

const ys = (() => {
  const placed: {x: number; y: number}[] = [];
  const out: number[] = new Array(S.health.length);
  S.health
    .map((h, i) => ({i, x: gx(h.g)}))
    .sort((a, b) => Math.abs(a.x - gx(0)) - Math.abs(b.x - gx(0)))
    .forEach(({i, x}) => {
      for (let k = 0; ; k++) {
        const y = MID + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (R * 2 + 2);
        if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= R * 2 + 2)) {
          placed.push({x, y});
          out[i] = y;
          break;
        }
      }
    });
  return out;
})();

const NOTES = [
  {n: 7, label: 'Health insurance', dy: -150, anchor: 'end'},
  {n: 14, label: 'Women online', dy: -110, anchor: 'end'},
  {n: 84, label: 'Men with high blood sugar', dy: -150, anchor: 'start'},
  {n: 68, label: 'Child diet, 6–23 months', dy: 120, anchor: 'start'},
] as const;

export const Health: React.FC = () => {
  const f = useT();
  const {up, flat, down} = S.tally;
  const total = up + flat + down;
  const bar = tween(f, 112, 148, 0, 1, easeOut);
  const segs = [
    {n: up, c: COL.up, t: 'better'},
    {n: flat, c: COL.flat, t: 'little change'},
    {n: down, c: COL.down, t: 'worse'},
  ];
  let acc = 0;

  return (
    <>
      <Chip where="Health deep dive" what={`NFHS-5 (2019–21) → NFHS-6 (2023–24), ${S.nIndicators} indicators`} />
      <div style={{position: 'absolute', left: 130, top: 150, opacity: fade(f, 6, 20)}}>
        <Kicker>EVERY INDICATOR, ONE DOT</Kicker>
        <Headline size={58} style={{marginTop: 14}}>
          Four years on: <Hi c={C.sky}>what improved</Hi>, and what needs care.
        </Headline>
      </div>
      <svg width={1920} height={1080} style={{position: 'absolute'}} fontFamily={outfit.fontFamily}>
        <g opacity={fade(f, 14, 30)}>
          <line x1={gx(0)} x2={gx(0)} y1={360} y2={760} stroke={C.muted} strokeDasharray="5 7" />
          <text x={gx(0) - 16} y={790} textAnchor="end" fill={C.amber} fontSize={22}>← got worse</text>
          <text x={gx(0) + 16} y={790} fill={C.sky} fontSize={22}>got better →</text>
          {[-15, -10, 10, 20, 30].map((v) => (
            <text key={v} x={gx(v)} y={790} textAnchor="middle" fill={C.muted} fontSize={19} opacity={0.75}>
              {v > 0 ? '+' : ''}{v}
            </text>
          ))}
        </g>
        {S.health.map((h, i) => {
          const d = 16 + random(`h${i}`) * 50;
          const t = tween(f, d, d + 26, 0, 1, easeOut);
          const y = interpolate(t, [0, 1], [ys[i] - 260, ys[i]]);
          return <circle key={h.n} cx={gx(h.g)} cy={y} r={R} fill={COL[h.c as keyof typeof COL]} opacity={t} />;
        })}
        {NOTES.map((n, k) => {
          const i = S.health.findIndex((h) => h.n === n.n);
          const h = S.health[i];
          const x = gx(h.g), y = ys[i];
          const o = fade(f, 92 + k * 9, 106 + k * 9);
          const ty = MID + n.dy;
          const pct = (v: number) => `${Math.round(v)}%`;
          return (
            <g key={n.n} opacity={o}>
              <line x1={x} x2={x} y1={y + (n.dy < 0 ? -R : R)} y2={ty + (n.dy < 0 ? 10 : -30)} stroke={C.paper} strokeOpacity={0.6} />
              <text x={x + (n.anchor === 'end' ? 10 : -10)} y={ty - 22} textAnchor={n.anchor} fill={C.paper} fontSize={25} fontWeight={600}>
                {n.label}
              </text>
              <text x={x + (n.anchor === 'end' ? 10 : -10)} y={ty + 6} textAnchor={n.anchor} fill={COL[h.c as keyof typeof COL]} fontSize={25}>
                {pct(h.t5)} → {pct(h.t6)}
              </text>
            </g>
          );
        })}
        <g transform="translate(200 860)">
          {segs.map((s) => {
            const x = (acc / total) * 1520 * bar;
            const w = (s.n / total) * 1520 * bar;
            acc += s.n;
            return (
              <g key={s.t}>
                <rect x={x} y={0} width={Math.max(0, w - 4)} height={54} rx={6} fill={s.c} />
                <text x={x + 18} y={37} fill={C.navyDeep} fontSize={28} fontWeight={700} opacity={fade(f, 138, 150)}>
                  {s.n} {s.t}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <Source style={{position: 'absolute', left: 200, top: 950, opacity: fade(f, 144, 158)}}>
        NFHS-5 and NFHS-6 state fact sheets, Odisha · {total} indicators with a clear better direction
      </Source>
    </>
  );
};
