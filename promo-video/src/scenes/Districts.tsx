import React from 'react';
import {interpolate} from 'remotion';
import M from '../data/odisha.json';
import S from '../data/scenes.json';
import {C, outfit} from '../lib/theme';
import {Body, Chip, Headline, Hi, Source, fade, tween, useT} from '../lib/ui';

/* District Insight and the District Duel: one coastal city district against
   one young tribal district, with both age pyramids moving 2011 → 2036. */
export const DISTRICTS_FRAMES = 240;

const MAP = {x: 150, y: 262, s: 0.56};
const PAIR = [
  {name: 'Khordha', colour: C.sky, cx: 1110},
  {name: 'Nabarangpur', colour: C.amber, cx: 1580},
] as const;
const ROW = 27;
const TOP = 330;
const HALF = 200;
const SCALE = HALF / 6.5; // px per % of the district, per sex

export const Districts: React.FC = () => {
  const f = useT();
  const grow = tween(f, 30, 75, 0, 1);
  const t = tween(f, 100, 150, 0, 1);
  const year = Math.round(interpolate(t, [0, 1], [2011, 2036]));

  return (
    <>
      <Chip where="District Insight · District Duel" what="all 30 districts, side by side" />
      <div style={{position: 'absolute', left: 130, top: 150, width: 1700, opacity: fade(f, 6, 20)}}>
        <Headline size={58}>
          30 districts. <Hi>Each on its own path.</Hi>
        </Headline>
      </div>

      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        <g transform={`translate(${MAP.x} ${MAP.y}) scale(${MAP.s})`} opacity={fade(f, 8, 26)}>
          {M.districts.map((d, i) => {
            const pick = PAIR.find((p) => p.name === d.name);
            const lit = pick ? fade(f, 26 + (pick.name === 'Khordha' ? 0 : 8), 40 + (pick.name === 'Khordha' ? 0 : 8)) : 0;
            const pulse = fade(f, 10 + i * 0.6, 22 + i * 0.6);
            return (
              <path
                key={d.name}
                d={d.d}
                fill={pick ? pick.colour : C.sky}
                fillOpacity={pick ? 0.15 + 0.75 * lit : 0.1 * pulse}
                stroke={C.skySoft}
                strokeOpacity={0.35}
                strokeWidth={1.6}
              />
            );
          })}
        </g>
        {PAIR.map((p, k) => {
          const d = M.districts.find((x) => x.name === p.name)!;
          const x = MAP.x + d.cx * MAP.s;
          const y = MAP.y + d.cy * MAP.s;
          const o = fade(f, 34 + k * 8, 48 + k * 8);
          return (
            <g key={p.name} opacity={o} fontFamily={outfit.fontFamily}>
              <circle cx={x} cy={y} r={6} fill={C.paper} />
              <text x={x + (k ? -14 : 14)} y={y + (k ? 34 : -14)} fill={C.paper} fontSize={24} fontWeight={600} textAnchor={k ? 'end' : 'start'}>
                {p.name}
              </text>
            </g>
          );
        })}

        {/* pyramid duel */}
        <text x={1345} y={TOP - 40} textAnchor="middle" fill={C.paper} fontFamily={outfit.fontFamily} fontSize={52} fontWeight={700} opacity={fade(f, 30, 44)}>
          {year}
        </text>
        {PAIR.map((p, k) => {
          const D = S.duel[p.name];
          const rows = D.pyr['2011'];
          return (
            <g key={p.name} fontFamily={outfit.fontFamily} opacity={fade(f, 22 + k * 6, 36 + k * 6)}>
              <text x={p.cx} y={TOP - 50} textAnchor="middle" fill={p.colour} fontSize={30} fontWeight={600}>
                {p.name}
              </text>
              {rows.map((r, j) => {
                const b = D.pyr['2036'][j];
                const m = interpolate(t, [0, 1], [r.m, b.m]) * SCALE * grow;
                const fe = interpolate(t, [0, 1], [r.f, b.f]) * SCALE * grow;
                const y = TOP + (rows.length - 1 - j) * ROW;
                const old = parseInt(r.age, 10) >= 60;
                return (
                  <g key={r.age}>
                    <rect x={p.cx - 3 - m} y={y} width={m} height={ROW - 5} rx={3} fill={p.colour} opacity={old ? 1 : 0.55} />
                    <rect x={p.cx + 3} y={y} width={fe} height={ROW - 5} rx={3} fill={p.colour} opacity={old ? 1 : 0.8} />
                  </g>
                );
              })}
              <text x={p.cx - HALF} y={TOP + 17 * ROW + 26} fill={C.muted} fontSize={21}>men</text>
              <text x={p.cx + HALF} y={TOP + 17 * ROW + 26} fill={C.muted} fontSize={21} textAnchor="end">women</text>
            </g>
          );
        })}
        <g fontFamily={outfit.fontFamily} fontSize={18} fill={C.muted} opacity={fade(f, 40, 54)}>
          {['80+', '60', '40', '20', '0'].map((a, k) => {
            const j = [16, 12, 8, 4, 0][k];
            return (
              <text key={a} x={1345} y={TOP + (16 - j) * ROW + 17} textAnchor="middle">{a}</text>
            );
          })}
        </g>
      </svg>

      <div style={{position: 'absolute', left: 130, top: 880, width: 640, opacity: fade(f, 60, 76)}}>
        <Body style={{fontSize: 28}}>
          Seeing each district clearly helps plan for each one: growth, fertility, longevity and health on one page.
        </Body>
      </div>
      <div style={{position: 'absolute', left: 900, top: 858, width: 900, display: 'flex', justifyContent: 'space-around', opacity: fade(f, 148, 162)}}>
        {PAIR.map((p) => (
          <div key={p.name} style={{textAlign: 'center', fontFamily: outfit.fontFamily}}>
            <div style={{color: p.colour, fontSize: 44, fontWeight: 700}}>{S.duel[p.name].elders2036}%</div>
            <div style={{color: '#c9d8e6', fontSize: 24}}>aged 60+ in 2036 · fertility {S.duel[p.name].tfr2020} (2020)</div>
          </div>
        ))}
      </div>
      <Source style={{position: 'absolute', left: 900, top: 955, opacity: fade(f, 156, 170)}}>District age projections, 2011–2036</Source>
    </>
  );
};
