import React from 'react';
import {AbsoluteFill, interpolate, interpolateColors, random} from 'remotion';
import M from '../data/odisha.json';
import S from '../data/scenes.json';
import {C, outfit} from '../lib/theme';
import {Brand, Headline, Hi, Kicker, SerifLine, Source, fade, tween, useT} from '../lib/ui';

/* The bigger picture: what the numbers let us see coming, and plan for.
   The map warms from east to west like a sunrise as understanding spreads. */
export const AHEAD_FRAMES = 180;

const MAP = {x: 905, y: 70, s: 0.94};

export const Ahead: React.FC = () => {
  const f = useT();
  const [, working] = S.ages[0].shares;
  const cards = [
    {big: `${working} of 100`, line: 'are of working age. A window to invest in skills and jobs.', at: 40},
    {big: S.keyStats.tfr.v, line: 'children per woman. Plans for schools, health and care can follow how families are changing.', at: 72},
    {big: `${S.keyStats.life.v} yrs`, line: 'life expectancy. Longer lives, and time to plan for healthy ageing.', at: 104},
  ];
  const sweep = tween(f, 18, 150, 0, 1, (t) => t);
  const year = Math.round(interpolate(sweep, [0, 1], [2021, 2036]));

  return (
    <>
      {/* sunrise glow */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 55% at 72% 100%, rgba(244,197,52,${0.28 * sweep}) 0%, rgba(240,138,75,${0.12 * sweep}) 45%, rgba(0,0,0,0) 75%)`,
        }}
      />
      <Brand />
      <svg width={1920} height={1080} style={{position: 'absolute'}} fontFamily={outfit.fontFamily}>
        {M.dots.map((d, i) => {
          const x = MAP.x + d[0] * MAP.s;
          const y = MAP.y + d[1] * MAP.s;
          /* the light front moves from the coast (east) inland (west) */
          const front = interpolate(sweep, [0, 1], [1050, -120]);
          const warm = interpolate(d[0] - front, [-140, 0], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const c = interpolateColors(warm, [0, 0.5, 1], [C.sky, C.skySoft, C.yellow]);
          const tw = 0.75 + 0.25 * Math.sin(f / 10 + i * 1.3);
          return <circle key={i} cx={x} cy={y} r={4.4 + 1.4 * warm} fill={c} opacity={fade(f, random(`a${i}`) * 14, 14 + random(`a${i}`) * 14) * interpolate(warm, [0, 1], [0.45, 1]) * tw} />;
        })}
        <text x={1770} y={1000} textAnchor="end" fill={C.yellow} fontSize={64} fontWeight={700} opacity={fade(f, 14, 26)}>
          {year}
        </text>
      </svg>

      <div style={{position: 'absolute', left: 130, top: 150, width: 820, opacity: fade(f, 4, 18)}}>
        <Kicker>THE BIGGER PICTURE</Kicker>
        <Headline size={52} style={{marginTop: 16}}>
          Knowing what is changing helps us <Hi>plan what comes next.</Hi>
        </Headline>
      </div>
      <div style={{position: 'absolute', left: 130, top: 420, width: 820, display: 'flex', flexDirection: 'column', gap: 34, fontFamily: outfit.fontFamily}}>
        {cards.map((c) => {
          const o = fade(f, c.at, c.at + 14);
          return (
            <div key={c.big} style={{display: 'flex', alignItems: 'center', gap: 28, opacity: o, transform: `translateX(${interpolate(o, [0, 1], [-24, 0])}px)`}}>
              <div style={{width: 250, flexShrink: 0, color: C.yellow, fontSize: 56, fontWeight: 700, letterSpacing: '-0.01em'}}>{c.big}</div>
              <div style={{color: '#d7e3ee', fontSize: 28, fontWeight: 300, lineHeight: 1.35}}>{c.line}</div>
            </div>
          );
        })}
      </div>
      <SerifLine style={{position: 'absolute', left: 130, top: 790, width: 900, fontSize: 40, lineHeight: 1.3, opacity: fade(f, 134, 150)}}>
        The numbers don’t decide the future.
        <br />
        They help us shape it.
      </SerifLine>
      <Source style={{position: 'absolute', left: 130, top: 935, opacity: fade(f, 140, 154)}}>
        Population projections 2021; {S.keyStats.tfr.src}; {S.keyStats.life.src}
      </Source>
    </>
  );
};
