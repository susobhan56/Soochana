import React, {useMemo} from 'react';
import {interpolate, interpolateColors, random} from 'remotion';
import S from '../data/scenes.json';
import {C, outfit} from '../lib/theme';
import {Headline, Hi, Kicker, ease, fade, tween, useT, window_} from '../lib/ui';

/* From numbers to narrative: a wall of real district figures. A hundred of
   them light up, become dots and gather into the 100-people grid that opens
   the story scene, so the cut into it is seamless. */
export const NARRATIVE_FRAMES = 140;

const W0 = S.numberWall;
const NAME_X = 770, COL_X = 940, COL_W = 100, ROW_Y = 222, ROW_H = 44;
/* The story scene's grid, which the dots land on. */
const slot = (i: number) => ({x: 1040 + (i % 10) * 64, y: 236 + Math.floor(i / 10) * 64});

export const Narrative: React.FC = () => {
  const f = useT();

  /* Pick 100 of the cells, then pair them with grid slots in reading order so the dots flow neatly. */
  const picks = useMemo(() => {
    const cells: {r: number; c: number; k: number}[] = [];
    W0.rows.forEach((row, r) => row.vals.forEach((_, c) => cells.push({r, c, k: random(`cell${r}-${c}`)})));
    const chosen = [...cells].sort((a, b) => a.k - b.k).slice(0, 100).sort((a, b) => a.r - b.r || a.c - b.c);
    const map = new Map<string, number>();
    chosen.forEach((cell, i) => map.set(`${cell.r}-${cell.c}`, i));
    return map;
  }, []);

  const drift = interpolate(f, [0, 80], [0, -22], {extrapolateRight: 'clamp'});
  const lit = fade(f, 48, 64);
  const toDot = fade(f, 62, 76);
  const rest = 1 - fade(f, 66, 92);

  return (
    <>
      <div style={{position: 'absolute', left: 130, top: 380, width: 620}}>
        <div style={{position: 'absolute', top: 0, opacity: window_(f, 6, 72)}}>
          <Kicker>FROM NUMBERS…</Kicker>
          <Headline size={56} style={{marginTop: 18}}>
            Numbers tell us <Hi>what</Hi> is changing.
          </Headline>
        </div>
        <div style={{position: 'absolute', top: 0, opacity: window_(f, 76, 136)}}>
          <Kicker>…TO NARRATIVE</Kicker>
          <Headline size={56} style={{marginTop: 18}}>
            Read together, they show us <Hi>why</Hi>, and <Hi>what comes next</Hi>.
          </Headline>
        </div>
      </div>

      <svg width={1920} height={1080} style={{position: 'absolute'}} fontFamily={outfit.fontFamily}>
        <g transform={`translate(0 ${drift})`}>
          <g opacity={fade(f, 0, 16) * rest} fontSize={16} fill={C.skySoft} letterSpacing="0.06em">
            {W0.cols.map((c, j) => (
              <text key={c} x={COL_X + j * COL_W + 70} y={ROW_Y - 44} textAnchor="end">{c.toUpperCase()}</text>
            ))}
          </g>
          {W0.rows.map((row, r) => {
            const y = ROW_Y + r * ROW_H;
            const rowIn = fade(f, r * 0.8, 12 + r * 0.8);
            return (
              <g key={row.name}>
                <text x={NAME_X} y={y} fill={C.muted} fontSize={22} opacity={rowIn * rest}>{row.name}</text>
                {row.vals.map((v, c) => {
                  const x = COL_X + c * COL_W + 70;
                  const i = picks.get(`${r}-${c}`);
                  if (i == null) {
                    return <text key={c} x={x} y={y} textAnchor="end" fill="#8aa0b6" fontSize={24} opacity={rowIn * rest * interpolate(lit, [0, 1], [0.85, 0.3])} style={{fontVariantNumeric: 'tabular-nums'}}>{v}</text>;
                  }
                  const d = random(`fly${i}`) * 16;
                  const t = tween(f, 76 + d, 106 + d, 0, 1, ease);
                  const s = slot(i);
                  const cx = interpolate(t, [0, 1], [x - 26, s.x]);
                  /* The wall drifts up; landing at s.y - drift puts the dot exactly on its grid slot. */
                  const cy = interpolate(t, [0, 1], [y - 8, s.y - drift]);
                  return (
                    <g key={c}>
                      <text x={x} y={y} textAnchor="end" fontSize={24} fill={interpolateColors(lit, [0, 1], ['#8aa0b6', C.sky])} opacity={rowIn * (1 - toDot)} style={{fontVariantNumeric: 'tabular-nums'}}>
                        {v}
                      </text>
                      <circle cx={cx} cy={cy} r={interpolate(t, [0, 1], [7 * toDot, 23])} fill={C.sky} />
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>
      </svg>
    </>
  );
};
