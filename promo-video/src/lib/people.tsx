import React from 'react';
import {C} from './theme';

/* Line-drawn people in the style of the portal's theme icons: round heads,
   stroked limbs, a filled garment. Feet sit at (x, y); `walk` is the phase of
   the walk cycle in radians (null to stand still). */

export type Kind = 'man' | 'woman' | 'girl' | 'boy' | 'elderM' | 'elderF';
export type Prop = 'rest' | 'bag' | 'bundle' | 'baby' | 'phone' | 'cane' | 'briefcase' | 'kite' | 'wave' | 'books';

type P = {
  x: number;
  y: number;
  kind: Kind;
  walk?: number | null;
  dir?: 1 | -1;
  scale?: number;
  ink?: string;
  cloth?: string;
  prop?: Prop;
  t?: number; // frame, for props that move on their own
  seated?: boolean;
};

const rad = (d: number) => (d * Math.PI) / 180;
/* A point `len` away from (x, y), at `deg` degrees from straight down (positive = forward). */
const at = (x: number, y: number, len: number, deg: number): [number, number] => [x + len * Math.sin(rad(deg)), y + len * Math.cos(rad(deg))];

export const Person: React.FC<P> = ({x, y, kind, walk = null, dir = 1, scale = 1, ink = C.paper, cloth = C.sky, prop, t = 0, seated}) => {
  const child = kind === 'girl' || kind === 'boy';
  const elder = kind === 'elderM' || kind === 'elderF';
  const female = kind === 'woman' || kind === 'girl' || kind === 'elderF';
  const s = scale * (child ? 0.68 : 1);
  const sw = 5.5;
  const swing = walk == null ? 0 : (elder ? 14 : 24) * Math.sin(walk);
  const bend = elder ? 16 : 0;

  const hip: [number, number] = seated ? [0, -52] : [0, -82];
  const neck = at(hip[0], hip[1], -58, -bend); // up the spine
  const head: [number, number] = [neck[0] + Math.sin(rad(bend)) * 22, neck[1] - 22];

  /* legs */
  const legs = seated
    ? [[at(hip[0], hip[1], 40, 90), null], [at(hip[0] + 4, hip[1], 40, 90), null]]
    : [[at(hip[0], hip[1], 82, swing)], [at(hip[0], hip[1], 82, -swing)]];
  /* arms: angles from straight down at the shoulder */
  let armA = -swing * 0.9, armB = swing * 0.9;
  let bendA = 0, bendB = 0; // elbow bends, degrees
  if (prop === 'baby') { armA = 55; armB = 40; bendA = 70; bendB = 80; }
  if (prop === 'bundle') { armA = 170; bendA = 0; }
  if (prop === 'phone') { armA = 40; bendA = 115; }
  if (prop === 'wave') { armA = 150 + 18 * Math.sin(t / 4); }
  if (prop === 'kite') { armA = 150; }
  if (prop === 'cane') { armA = 28; }
  if (prop === 'books') { armA = 30; bendA = 80; }
  if (seated && prop === 'rest') { armA = 18; armB = 14; bendA = 62; bendB = 66; }
  else if (seated) { armA = 50; armB = 45; bendA = 50 + 10 * Math.sin(t / 3); bendB = 55 - 10 * Math.sin(t / 3); }
  const shoulder = at(neck[0], neck[1], 8, 0);
  const elbowA = at(shoulder[0], shoulder[1], 32, armA);
  const handA = at(elbowA[0], elbowA[1], 30, armA + bendA);
  const elbowB = at(shoulder[0], shoulder[1], 32, armB);
  const handB = at(elbowB[0], elbowB[1], 30, armB + bendB);

  const line = (a: [number, number], b: [number, number], k?: string | number) => (
    <line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={ink} strokeWidth={sw} strokeLinecap="round" />
  );

  return (
    <g transform={`translate(${x} ${y}) scale(${dir * s} ${s})`} strokeLinejoin="round">
      {/* garment behind the limbs */}
      {prop === 'bag' && <rect x={-24} y={neck[1] + 6} width={18} height={34} rx={5} fill={C.yellow} stroke={ink} strokeWidth={3} />}
      {female ? (
        <path
          d={`M${neck[0] - 9},${neck[1] + 4} L${neck[0] + 9},${neck[1] + 4} L${hip[0] + (seated ? 30 : 22)},${hip[1] + (seated ? 16 : 46)} L${hip[0] - (seated ? 4 : 22)},${hip[1] + (seated ? 16 : 46)} Z`}
          fill={cloth}
          fillOpacity={0.85}
          stroke={ink}
          strokeWidth={4}
        />
      ) : (
        <path d={`M${neck[0] - 11},${neck[1] + 4} L${neck[0] + 11},${neck[1] + 4} L${hip[0] + 11},${hip[1] + 4} L${hip[0] - 11},${hip[1] + 4} Z`} fill={cloth} fillOpacity={0.85} stroke={ink} strokeWidth={4} />
      )}
      {legs.map((l, k) => (
        <g key={k}>{seated ? <>{line(hip, l[0] as [number, number])}{line(l[0] as [number, number], [(l[0] as [number, number])[0], 0])}</> : line(hip, l[0] as [number, number])}</g>
      ))}
      {line(shoulder, elbowB, 'b1')}
      {line(elbowB, handB, 'b2')}
      {line(shoulder, elbowA, 'a1')}
      {line(elbowA, handA, 'a2')}
      <circle cx={head[0]} cy={head[1]} r={15} fill={C.navy} stroke={ink} strokeWidth={sw} />
      {female && !elder && <circle cx={head[0] - 13} cy={head[1] - 6} r={6} fill={ink} />}
      {kind === 'girl' && <path d={`M${head[0] - 12},${head[1] + 4} q-10,10 -4,20`} stroke={ink} strokeWidth={4} fill="none" strokeLinecap="round" />}
      {elder && <path d={`M${head[0] - 14},${head[1] - 6} a15,15 0 0 1 28,0`} stroke="#d9e3ec" strokeWidth={6} fill="none" />}

      {/* props */}
      {prop === 'cane' && line(handA, [handA[0] + 6, 0], 'cane')}
      {prop === 'baby' && (
        <g>
          <ellipse cx={(handA[0] + handB[0]) / 2 + 4} cy={(handA[1] + handB[1]) / 2 - 6} rx={18} ry={12} fill={C.yellow} stroke={ink} strokeWidth={3} />
          <circle cx={(handA[0] + handB[0]) / 2 + 18} cy={(handA[1] + handB[1]) / 2 - 12} r={7} fill={C.navy} stroke={ink} strokeWidth={3} />
        </g>
      )}
      {prop === 'bundle' && <rect x={head[0] - 22} y={head[1] - 44} width={44} height={26} rx={8} fill={C.amber} stroke={ink} strokeWidth={3} />}
      {prop === 'phone' && (
        <g>
          <rect x={handA[0] - 5} y={handA[1] - 14} width={11} height={18} rx={2} fill={C.yellow} stroke={ink} strokeWidth={2} />
          <circle cx={handA[0]} cy={handA[1] - 5} r={16 + 3 * Math.sin(t / 5)} fill={C.yellow} opacity={0.18} />
        </g>
      )}
      {prop === 'briefcase' && <rect x={handB[0] - 13} y={handB[1]} width={26} height={19} rx={3} fill={C.amber} stroke={ink} strokeWidth={3} />}
      {prop === 'books' && <rect x={handA[0] - 6} y={handA[1] - 18} width={22} height={16} rx={2} fill={C.yellow} stroke={ink} strokeWidth={3} />}
      {prop === 'kite' && (
        <g>
          <path d={`M${handA[0]},${handA[1]} q60,${-60 + 10 * Math.sin(t / 6)} 120,-150`} stroke={ink} strokeWidth={1.5} fill="none" opacity={0.7} />
          <path d={`M${handA[0] + 120},${handA[1] - 175} l18,22 l-18,26 l-18,-26 Z`} fill={C.yellow} stroke={ink} strokeWidth={3} transform={`rotate(${8 * Math.sin(t / 7)} ${handA[0] + 120} ${handA[1] - 150})`} />
        </g>
      )}
    </g>
  );
};
