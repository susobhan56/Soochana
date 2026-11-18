import React from 'react';
import {interpolate, interpolateColors} from 'remotion';
import S from '../data/scenes.json';
import {C, outfit} from '../lib/theme';
import {Body, Chip, Headline, Hi, Kicker, Source, easeOut, fade, tween, useT} from '../lib/ui';

/* Tectonics: the record (surveys) and the signals (searches) as two plates
   that meet, then story 1's guess-first reveal. */
export const TECTONICS_FRAMES = 210;

const BLUES = ['#6cc0f0', '#4a98d6', '#3577b3', '#24578a'];
const AMBERS = ['#f4ac45', '#dc8a2f', '#b96b22', '#8f5119'];

/* One layer of a plate: a slab with a gently wavy top and a jagged inner edge. */
const slab = (side: -1 | 1, k: number) => {
  const y = 560 + k * 42;
  const outer = 960 + side * 560;
  const inner = 960 + side * (k % 2 ? 6 : 14);
  const wob = (x: number) => Math.sin(x / 70 + k) * 5;
  const pts: string[] = [];
  for (let s = 0; s <= 8; s++) {
    const x = outer + ((inner - outer) * s) / 8;
    pts.push(`${x.toFixed(1)},${(y + wob(x)).toFixed(1)}`);
  }
  return `M${pts.join('L')}L${inner - side * 8},${y + 18}L${inner},${y + 36}L${outer},${y + 36 + wob(outer)}Z`;
};

const Waffle: React.FC<{x: number; y: number; was: number; now: number; f0: number; gain: boolean}> = ({x, y, was, now, f0, gain}) => {
  const f = useT();
  const a = tween(f, f0, f0 + 20, 0, Math.round(was));
  const b = tween(f, f0 + 26, f0 + 46, Math.round(was), Math.round(now));
  return (
    <g>
      {Array.from({length: 100}, (_, i) => {
        const cx = x + (i % 10) * 26;
        const cy = y + (9 - Math.floor(i / 10)) * 26;
        let c = 'rgba(255,255,255,0.13)';
        if (gain) {
          if (i < a) c = C.sky;
          if (i >= Math.round(was) && i < b) c = C.yellow;
        } else {
          if (i < Math.min(a, b) || (i < a && f < f0 + 26)) c = C.amber;
          else if (i < Math.round(was) && i >= b && f >= f0 + 26) c = interpolateColors(fade(f, f0 + 26, f0 + 46), [0, 1], [C.amber, 'rgba(240,138,75,0.28)']);
        }
        return <circle key={i} cx={cx} cy={cy} r={10} fill={c} />;
      })}
    </g>
  );
};

export const Tectonics: React.FC = () => {
  const f = useT();
  const meet = tween(f, 4, 48, 0, 1, easeOut);
  const ridge = tween(f, 40, 72, 0, 1, easeOut);
  const shift = tween(f, 84, 112, 0, 1);
  const s = interpolate(shift, [0, 1], [1, 0.6]);
  const cx = interpolate(shift, [0, 1], [960, 500]);
  const cy = interpolate(shift, [0, 1], [600, 600]);
  const {online, methods} = S.tectonics;

  return (
    <>
      <Chip where="Tectonics" what="a story series" />
      <div style={{position: 'absolute', left: 130, top: 150, opacity: fade(f, 6, 20)}}>
        <Headline size={58}>
          Where the <Hi c={C.sky}>record</Hi> meets the <Hi c={C.yellow}>signals</Hi>.
        </Headline>
      </div>

      <svg width={1920} height={1080} style={{position: 'absolute'}} fontFamily={outfit.fontFamily}>
        <g transform={`translate(${cx} ${cy}) scale(${s}) translate(-960 -600)`}>
          <g transform={`translate(${interpolate(meet, [0, 1], [-760, 0])} 0)`}>
            {BLUES.map((c, k) => <path key={c} d={slab(-1, k)} fill={c} />)}
            <text x={680} y={470} textAnchor="middle" fill={C.paper} fontSize={28} fontWeight={600} letterSpacing="0.12em">THE RECORD</text>
            <text x={680} y={505} textAnchor="middle" fill={C.skySoft} fontSize={26}>Census · NFHS · SRS</text>
          </g>
          <g transform={`translate(${interpolate(meet, [0, 1], [760, 0])} 0)`}>
            {AMBERS.map((c, k) => <path key={c} d={slab(1, k)} fill={c} />)}
            <text x={1240} y={470} textAnchor="middle" fill={C.paper} fontSize={28} fontWeight={600} letterSpacing="0.12em">THE SIGNALS</text>
            <text x={1240} y={505} textAnchor="middle" fill="#f9d5bf" fontSize={26}>what people search online</text>
          </g>
          <g transform={`translate(960 562) scale(1 ${ridge}) translate(-960 -562)`}>
            <path d="M840,562 C900,540 930,330 960,300 C990,330 1020,540 1080,562 Z" fill="#6fbf8f" />
            {[0, 1, 2, 3].map((k) => (
              <path key={k} d={`M${870 + k * 12},${520 - k * 50} Q960,${500 - k * 50} ${1050 - k * 12},${520 - k * 50}`} stroke="#e8c15a" strokeWidth={3} fill="none" opacity={0.8} />
            ))}
          </g>
          <text x={960} y={270} textAnchor="middle" fill={C.paper} fontSize={26} fontWeight={600} letterSpacing="0.14em" opacity={fade(f, 62, 76)}>
            NEW QUESTIONS
          </text>
        </g>

        <g opacity={fade(f, 100, 114)}>
          <Waffle x={1060} y={430} was={online.was} now={online.now} f0={116} gain />
          <Waffle x={1470} y={430} was={methods.was} now={methods.now} f0={130} gain={false} />
          <text x={1060} y={720} fill={C.paper} fontSize={24} fontWeight={600}>Women ever online</text>
          <text x={1060} y={752} fill={C.skySoft} fontSize={22}>
            {online.was}% → <tspan fill={C.yellow} fontWeight={600}>{online.now}%</tspan>
          </text>
          <text x={1470} y={720} fill={C.paper} fontSize={24} fontWeight={600}>Modern contraception</text>
          <text x={1470} y={752} fill="#f9d5bf" fontSize={22}>
            {methods.was}% → <tspan fill={C.amber} fontWeight={600}>{methods.now}%</tspan>
          </text>
        </g>
      </svg>

      <div style={{position: 'absolute', left: 1060, top: 300, width: 700, opacity: fade(f, 98, 112)}}>
        <Kicker>GUESS FIRST, THEN SEE</Kicker>
        <Body style={{marginTop: 12, fontSize: 30}}>Of every 100 women in Odisha…</Body>
      </div>
      <div style={{position: 'absolute', left: 130, top: 860, width: 1660, opacity: fade(f, 150, 164)}}>
        <Body style={{fontSize: 34, color: C.paper}}>
          Read together, the two plates help us <Hi>see change as it happens</Hi>, and ask better questions.
        </Body>
        <Source style={{marginTop: 16}}>NFHS-5 (2019–21) → NFHS-6 (2023–24), Odisha</Source>
      </div>
    </>
  );
};
