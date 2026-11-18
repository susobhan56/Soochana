import React from 'react';
import {Easing, interpolate, staticFile} from 'remotion';
import {Gif} from '@remotion/gif';
import S from '../data/scenes.json';
import {C, outfit} from '../lib/theme';
import {Person} from '../lib/people';
import {Chip, Source, easeOut, fade, tween, useT} from '../lib/ui';

/* Mitali's life, in numbers. The camera travels across Odisha and stops at
   seven moments of one life (birth, childhood, school, the city, work,
   coming home, old age). At each stop Mitali is labelled with her age, the
   portal's theme GIF names the theme, and a small chart shows one real
   figure about lives like hers. */
const INTRO = 24;
const SEG = 84; // frames per stop: 24 moving, the rest held
const MOVE = 24;
export const THEMES_FRAMES = INTRO + 7 * SEG;

const GROUND = 820;
const GAP = 560;
const STOPS = Array.from({length: 7}, (_, i) => 960 + i * GAP);
const T = S.themes;
const r0 = (v: number) => Math.round(v);
const clampX = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

type Viz =
  | {type: 'waffle'; value: number; label: string}
  | {type: 'bars'; was: number; now: number; wasLab: string; nowLab: string}
  | {type: 'circles'; a: number; b: number; aLab: string; bLab: string; unit: string};

type Stop = {age: number; ageLab: string; gif: string; k: string; line: React.ReactNode; src: string; viz: Viz};

const LIFE: Stop[] = [
  {age: 0, ageLab: 'day 1', gif: 'health', k: 'HEALTH', line: <>{r0(T.hospitalBirths.now)} of every 100 babies are born in a hospital</>, src: 'NFHS-6 (2023–24)',
    viz: {type: 'waffle', value: r0(T.hospitalBirths.now), label: 'born in a hospital'}},
  {age: 5, ageLab: 'age 5', gif: 'health', k: 'CHILDHOOD', line: <>Children fully vaccinated: {r0(T.vaccinated.was)}% → <b>{r0(T.vaccinated.now)}%</b></>, src: 'NFHS-5 → NFHS-6, vaccination card',
    viz: {type: 'bars', was: T.vaccinated.was, now: T.vaccinated.now, wasLab: '2019–21', nowLab: '2023–24'}},
  {age: 12, ageLab: 'age 12', gif: 'education', k: 'EDUCATION · GENDER', line: <>Women with 10+ years of school: {r0(T.womenSchool.was)}% → <b>{r0(T.womenSchool.now)}%</b></>, src: 'NFHS-5 → NFHS-6',
    viz: {type: 'bars', was: T.womenSchool.was, now: T.womenSchool.now, wasLab: '2019–21', nowLab: '2023–24'}},
  {age: 21, ageLab: 'age 21', gif: 'urban', k: 'URBANISATION · GENDER', line: <>Women with their own phone: {r0(T.womenPhone.was)}% → <b>{r0(T.womenPhone.now)}%</b></>, src: 'NFHS-5 → NFHS-6',
    viz: {type: 'bars', was: T.womenPhone.was, now: T.womenPhone.now, wasLab: '2019–21', nowLab: '2023–24'}},
  {age: 25, ageLab: 'age 25', gif: 'employement', k: 'EMPLOYMENT · GENDER', line: <>Women with their own bank account: {r0(T.womenBank.was)}% → <b>{r0(T.womenBank.now)}%</b></>, src: 'NFHS-5 → NFHS-6',
    viz: {type: 'bars', was: T.womenBank.was, now: T.womenBank.now, wasLab: '2019–21', nowLab: '2023–24'}},
  {age: 32, ageLab: 'age 32', gif: 'urban', k: 'MIGRATION', line: <>Odias among people moving in: {r0(T.returning.was)}% → <b>{r0(T.returning.now)}%</b></>, src: 'Returning Odias among in-migrants · NSS 2007–08 → PLFS 2020–21',
    viz: {type: 'bars', was: T.returning.was, now: T.returning.now, wasLab: '2007–08', nowLab: '2020–21'}},
  {age: 70, ageLab: 'age 70', gif: 'ageing', k: 'AGEING', line: <>People aged 60+: {T.elders[0]} lakh today, <b>{T.elders[1]} lakh</b> by 2036</>, src: 'State age projections, 2021–2036',
    viz: {type: 'circles', a: T.elders[0], b: T.elders[1], aLab: '2021', bLab: '2036', unit: 'lakh'}},
];

const segStart = (i: number) => INTRO + i * SEG;

const stroke = {stroke: C.skySoft, strokeWidth: 4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const};
const rad = (d: number) => (d * Math.PI) / 180;

/* The "Mitali · age" pill over her figure. */
const Tag: React.FC<{x: number; y: number; text: string; o: number; muted?: boolean}> = ({x, y, text, o, muted}) => {
  const w = text.length * 13 + 36;
  return (
    <g opacity={o} fontFamily={outfit.fontFamily} transform={`translate(0 ${interpolate(o, [0, 1], [10, 0])})`}>
      <line x1={x} y1={y + 22} x2={x} y2={y + 40} stroke={muted ? C.skySoft : C.yellow} strokeWidth={2} />
      <rect x={x - w / 2} y={y - 22} width={w} height={44} rx={22} fill={C.navyDeep} stroke={muted ? C.skySoft : C.yellow} strokeWidth={2} />
      <text x={x} y={y + 8} textAnchor="middle" fill={muted ? C.skySoft : C.yellow} fontSize={24} fontWeight={600}>{text}</text>
    </g>
  );
};

type SP = {cx: number; f: number; lt: number; tag: number};

/* ── the seven moments ──────────────────────────────── */
const Birth: React.FC<SP> = ({cx, f, lt, tag}) => {
  const mx = interpolate(lt, [-40, 50], [cx - 300, cx - 70], {...clampX, easing: Easing.out(Easing.quad)});
  const walking = lt < 50;
  const beat = (f * 6) % 400;
  return (
    <g>
      <g transform={`translate(${cx + 110} ${GROUND})`}>
        <rect x={-140} y={-170} width={280} height={170} fill={C.navy} {...stroke} />
        <circle cx={0} cy={-115} r={32} fill={C.sky} fillOpacity={0.2} {...stroke} />
        <path d="M-8,-136 h16 v12 h12 v16 h-12 v12 h-16 v-12 h-12 v-16 h12 Z" fill={C.sky} />
        <rect x={-26} y={-64} width={52} height={64} fill="none" {...stroke} />
        <text x={0} y={-182} textAnchor="middle" fill={C.skySoft} fontSize={20} fontFamily={outfit.fontFamily} letterSpacing="0.2em">HOSPITAL</text>
        <path d="M-40,-215 h40 l15,-30 l20,55 l18,-40 l12,15 h115" fill="none" stroke={C.amber} strokeWidth={4} strokeDasharray="400" strokeDashoffset={400 - beat} strokeLinecap="round" />
      </g>
      <Person x={mx - 60} y={GROUND} kind="man" walk={walking ? f / 3.4 + 1.5 : null} cloth={C.sky} />
      <Person x={mx} y={GROUND} kind="woman" walk={walking ? f / 3.4 : null} cloth={C.yellow} prop="baby" />
      <Tag x={mx + 22} y={GROUND - 250} text="Mitali · day 1" o={tag} />
    </g>
  );
};

const Childhood: React.FC<SP> = ({cx, f, lt, tag}) => {
  const hop = lt > 30 ? Math.abs(Math.sin((lt - 30) / 5)) * 14 : 0;
  return (
    <g>
      {[-300, -150].map((dx, k) => (
        <g key={dx} transform={`translate(${cx + dx} ${GROUND})`}>
          <rect x={-55} y={-80} width={110} height={80} fill={C.navy} {...stroke} />
          <path d="M-72,-78 L0,-140 L72,-78 Z" fill={C.amber} fillOpacity={0.35} {...stroke} />
          <rect x={-14} y={-46} width={28} height={46} fill="none" {...stroke} />
          {k === 0 && <path d={`M30,-118 q${8 * Math.sin(f / 8)},-20 0,-40 q${-8 * Math.sin(f / 8)},-20 0,-40`} fill="none" stroke={C.muted} strokeWidth={4} opacity={0.6} />}
        </g>
      ))}
      <g transform={`translate(${cx + 250} ${GROUND})`}>
        <path d="M0,0 C6,-80 -6,-160 8,-230" fill="none" {...stroke} strokeWidth={7} />
        {[-60, -20, 20, 60, 100].map((a, k) => (
          <path key={k} d={`M8,-230 q${40 * Math.sin(rad(a + 2 * Math.sin(f / 10)))},-30 ${90 * Math.sin(rad(a))},${30 - 60 * Math.cos(rad(a))}`} fill="none" stroke={C.teal} strokeWidth={6} strokeLinecap="round" />
        ))}
      </g>
      {/* a health worker's visit: the vaccine kit */}
      <Person x={cx - 20} y={GROUND} kind="woman" cloth={C.paper} />
      <rect x={cx + 4} y={GROUND - 92} width={30} height={22} rx={4} fill={C.sky} stroke={C.paper} strokeWidth={3} />
      <path d={`M${cx + 13},${GROUND - 81} h12 M${cx + 19},${GROUND - 87} v12`} stroke={C.paper} strokeWidth={3} />
      <Person x={cx + 90} y={GROUND - hop} kind="girl" cloth={C.yellow} prop="wave" t={f} />
      <Person x={cx + 170} y={GROUND} kind="woman" cloth={C.amber} />
      <Tag x={cx + 90} y={GROUND - 190} text="Mitali · age 5" o={tag} />
    </g>
  );
};

const School: React.FC<SP> = ({cx, f, lt, tag}) => {
  const gx = interpolate(lt, [-40, 60], [cx - 360, cx - 60], {...clampX, easing: Easing.out(Easing.quad)});
  const walking = lt < 60;
  return (
    <g>
      <g transform={`translate(${cx + 90} ${GROUND})`}>
        <rect x={-150} y={-150} width={300} height={150} fill={C.navy} {...stroke} />
        <path d="M-170,-148 L0,-215 L170,-148" fill="none" {...stroke} />
        {[-100, -40, 40, 100].map((x) => <rect key={x} x={x - 18} y={-118} width={36} height={34} fill={C.yellow} fillOpacity={0.25} {...stroke} strokeWidth={3} />)}
        <rect x={-22} y={-62} width={44} height={62} fill="none" {...stroke} />
        <line x1={0} y1={-215} x2={0} y2={-290} {...stroke} />
        <path d={`M0,-290 q22,${-6 + 6 * Math.sin(f / 5)} 44,0 l0,26 q-22,${6 * Math.sin(f / 5)} -44,0 Z`} fill={C.amber} stroke="none" />
        <text x={0} y={-160} textAnchor="middle" fill={C.skySoft} fontSize={20} fontFamily={outfit.fontFamily} letterSpacing="0.2em">SCHOOL</text>
      </g>
      <Person x={gx - 70} y={GROUND} kind="girl" walk={walking ? f / 3 + 1 : null} cloth={C.amber} prop="books" />
      <Person x={gx} y={GROUND} kind="girl" walk={walking ? f / 3 : null} cloth={C.sky} prop="bag" />
      <Tag x={gx} y={GROUND - 190} text="Mitali · age 12" o={tag} />
    </g>
  );
};

const City: React.FC<SP> = ({cx, f, lt, tag}) => (
  <g>
    {[
      [-270, 260, 100],
      [-160, 360, 110],
      [-40, 300, 90],
      [80, 420, 120],
      [210, 240, 100],
    ].map(([dx, h, w], k) => {
      const grow = tween(lt, -50 + k * 8, 10 + k * 8, 0.15, 1, Easing.out(Easing.cubic));
      const hh = h * grow;
      return (
        <g key={k} transform={`translate(${cx + dx} ${GROUND})`}>
          <rect x={-w / 2} y={-hh} width={w} height={hh} fill={C.navy} {...stroke} />
          {Array.from({length: Math.floor(hh / 44)}, (_, r) =>
            [-w / 4, w / 4].map((wx, c) => (
              <rect key={`${r}-${c}`} x={wx - 9} y={-hh + 18 + r * 44} width={18} height={22} rx={2} fill={(r + c + k) % 3 === 0 ? C.yellow : C.sky} fillOpacity={(r * 7 + c * 3 + k + Math.floor(f / 12)) % 5 === 0 ? 0.15 : 0.55} />
            )),
          )}
        </g>
      );
    })}
    {/* signal arcs from her phone */}
    {[0, 1, 2].map((k) => {
      const p = ((f / 30 + k / 3) % 1);
      return <circle key={k} cx={cx - 60 + 18} cy={GROUND - 128} r={10 + p * 60} fill="none" stroke={C.yellow} strokeWidth={3} opacity={(1 - p) * 0.7} />;
    })}
    <Person x={cx - 60} y={GROUND} kind="woman" cloth={C.sky} prop="phone" t={f} />
    <Person x={cx + 50} y={GROUND} kind="man" walk={f / 3.2 + 2} cloth={C.amber} />
    <Tag x={cx - 60} y={GROUND - 250} text="Mitali · age 21" o={tag} />
  </g>
);

const Work: React.FC<SP> = ({cx, f, lt, tag}) => {
  const wx = interpolate(lt, [-40, 50], [cx - 340, cx - 40], {...clampX, easing: Easing.out(Easing.quad)});
  const walking = lt < 50;
  const coin = tween(lt, 50, 70, 0, 1, easeOut);
  return (
    <g>
      <g transform={`translate(${cx + 150} ${GROUND})`}>
        <rect x={-90} y={-70} width={180} height={10} rx={3} fill={C.skySoft} />
        <line x1={-80} y1={-60} x2={-80} y2={0} {...stroke} />
        <line x1={80} y1={-60} x2={80} y2={0} {...stroke} />
        <path d="M-40,-72 l10,-50 h70 l-10,50 Z" fill={C.sky} fillOpacity={0.35} {...stroke} strokeWidth={3} />
        <g transform={`translate(0 -250) rotate(${f * 2})`}>
          {Array.from({length: 8}, (_, k) => <rect key={k} x={-7} y={-40} width={14} height={16} rx={2} fill={C.yellow} transform={`rotate(${k * 45})`} />)}
          <circle r={28} fill={C.navy} stroke={C.yellow} strokeWidth={8} />
        </g>
      </g>
      <Person x={cx + 150} y={GROUND} kind="man" seated cloth={C.sky} t={f} />
      <Person x={wx} y={GROUND} kind="woman" walk={walking ? f / 3 : null} cloth={C.amber} prop="briefcase" />
      {/* her own bank card, rising as she arrives */}
      <g opacity={coin} transform={`translate(${wx + 60} ${GROUND - 170 - coin * 20})`}>
        <rect x={-30} y={-20} width={60} height={40} rx={6} fill={C.yellow} stroke={C.paper} strokeWidth={3} />
        <rect x={-30} y={-8} width={60} height={8} fill={C.navy} />
      </g>
      <Tag x={wx} y={GROUND - 250} text="Mitali · age 25" o={tag} />
    </g>
  );
};

const Home: React.FC<SP> = ({cx, f, lt, tag}) => {
  const bus = interpolate(lt, [-60, 30], [cx + 500, cx + 200], {...clampX, easing: Easing.out(Easing.cubic)});
  const hx = interpolate(lt, [30, 85], [cx + 160, cx - 40], clampX);
  const walking = lt > 30 && lt < 85;
  return (
    <g>
      <line x1={cx - 300} x2={cx + 520} y1={GROUND + 18} y2={GROUND + 18} stroke={C.muted} strokeWidth={3} strokeDasharray="24 18" />
      {/* home: the village house again, a lamp lit in the window */}
      <g transform={`translate(${cx - 220} ${GROUND})`}>
        <rect x={-60} y={-86} width={120} height={86} fill={C.navy} {...stroke} />
        <path d="M-78,-84 L0,-150 L78,-84 Z" fill={C.amber} fillOpacity={0.35} {...stroke} />
        <rect x={-15} y={-50} width={30} height={50} fill="none" {...stroke} />
        <rect x={24} y={-66} width={22} height={20} rx={2} fill={C.yellow} opacity={0.5 + 0.4 * Math.sin(f / 6)} />
        <text x={0} y={-166} textAnchor="middle" fill={C.paper} fontSize={22} fontFamily={outfit.fontFamily} fontWeight={600}>HOME</text>
      </g>
      <Person x={cx - 150} y={GROUND} kind="elderF" cloth={C.amber} prop="wave" t={f} />
      <g transform={`translate(${bus} ${GROUND})`}>
        <rect x={-90} y={-92} width={180} height={78} rx={12} fill={C.navy} {...stroke} />
        {[-60, -20, 20].map((x) => <rect key={x} x={x - 14} y={-80} width={30} height={26} rx={3} fill={C.sky} fillOpacity={0.3} stroke={C.skySoft} strokeWidth={3} />)}
        {[-55, 55].map((x) => <circle key={x} cx={x} cy={-12} r={13} fill={C.navy} {...stroke} />)}
      </g>
      <g opacity={fade(lt, 28, 36)}>
        <Person x={hx} y={GROUND} kind="woman" dir={-1} walk={walking ? f / 3 : null} cloth={C.sky} prop="bundle" />
        <Person x={hx + 70} y={GROUND} kind="boy" dir={-1} walk={walking ? f / 3 + 1.4 : null} cloth={C.yellow} />
      </g>
      <Tag x={hx} y={GROUND - 300} text="Mitali · age 32" o={tag * fade(lt, 34, 44)} />
    </g>
  );
};

const OldAge: React.FC<SP> = ({cx, f, tag}) => (
  <g>
    <circle cx={cx + 320} cy={GROUND - 430} r={120} fill={C.yellow} opacity={0.07} />
    <circle cx={cx + 320} cy={GROUND - 430} r={46} fill={C.yellow} opacity={0.85} />
    <g transform={`translate(${cx - 160} ${GROUND})`}>
      <path d="M0,0 C-8,-80 10,-150 0,-220" fill="none" {...stroke} strokeWidth={10} />
      <circle cx={0} cy={-300} r={120} fill="#2f8f6b" fillOpacity={0.35} {...stroke} />
      <circle cx={-70} cy={-250} r={70} fill="#2f8f6b" fillOpacity={0.3} {...stroke} />
    </g>
    <g transform={`translate(${cx - 30} ${GROUND})`}>
      <rect x={-90} y={-50} width={180} height={9} rx={3} fill={C.skySoft} />
      <line x1={-75} y1={-41} x2={-75} y2={0} {...stroke} />
      <line x1={75} y1={-41} x2={75} y2={0} {...stroke} />
    </g>
    <Person x={cx - 70} y={GROUND} kind="elderM" seated cloth={C.sky} prop="rest" />
    <Person x={cx + 10} y={GROUND} kind="elderF" seated cloth={C.amber} prop="rest" />
    <Person x={cx + 170} y={GROUND} kind="girl" cloth={C.yellow} prop="kite" t={f} />
    <Tag x={cx + 10} y={GROUND - 236} text="Mitali · age 70" o={tag} />
    <Tag x={cx + 220} y={GROUND - 156} text="her granddaughter" o={tag} muted />
  </g>
);

/* ── the small chart on each caption card ───────────── */
const MiniViz: React.FC<{v: Viz; t: number}> = ({v, t}) => {
  if (v.type === 'waffle') {
    const lit = Math.round(v.value * tween(t, 0, 1, 0, 1, easeOut));
    return (
      <svg width={168} height={168} viewBox="0 0 168 168">
        {Array.from({length: 100}, (_, i) => (
          <circle key={i} cx={8 + (i % 10) * 16.8} cy={8 + Math.floor(i / 10) * 16.8} r={6.4} fill={i < lit ? C.yellow : 'rgba(255,255,255,0.14)'} />
        ))}
      </svg>
    );
  }
  if (v.type === 'bars') {
    const H = 140, max = 100;
    const bar = (val: number, x: number, lab: string, col: string, d: number) => {
      const g = tween(t, d, d + 0.6, 0, 1, easeOut);
      const h = (val / max) * H * g;
      return (
        <g key={lab}>
          <rect x={x} y={8 + H - h} width={62} height={h} rx={6} fill={col} />
          <text x={x + 31} y={8 + H - h - 8} textAnchor="middle" fill={C.paper} fontSize={22} fontWeight={700} opacity={g}>{r0(val * g)}%</text>
          <text x={x + 31} y={H + 34} textAnchor="middle" fill={C.muted} fontSize={17}>{lab}</text>
        </g>
      );
    };
    return (
      <svg width={190} height={H + 42} fontFamily={outfit.fontFamily} style={{overflow: 'visible'}}>
        <line x1={0} x2={190} y1={H + 8} y2={H + 8} stroke={C.muted} strokeOpacity={0.5} />
        {bar(v.was, 20, v.wasLab, 'rgba(159,211,240,0.45)', 0)}
        {bar(v.now, 108, v.nowLab, C.yellow, 0.3)}
      </svg>
    );
  }
  const ra = 30 * Math.sqrt(v.a / v.a);
  const rb = 30 * Math.sqrt(v.b / v.a) * tween(t, 0.3, 1, 0, 1, easeOut);
  return (
    <svg width={190} height={182} fontFamily={outfit.fontFamily}>
      <circle cx={48} cy={110} r={ra * tween(t, 0, 0.4, 0, 1, easeOut)} fill="rgba(159,211,240,0.45)" />
      <circle cx={140} cy={110 - (rb - ra)} r={rb} fill={C.yellow} />
      <text x={48} y={110 + 6} textAnchor="middle" fill={C.paper} fontSize={18} fontWeight={700}>{v.a}</text>
      <text x={140} y={110 - (rb - ra) + 7} textAnchor="middle" fill={C.navyDeep} fontSize={22} fontWeight={700} opacity={tween(t, 0.6, 1, 0, 1)}>{v.b}</text>
      <text x={48} y={174} textAnchor="middle" fill={C.muted} fontSize={17}>{v.aLab}</text>
      <text x={140} y={174} textAnchor="middle" fill={C.muted} fontSize={17}>{v.bLab} · {v.unit}</text>
    </svg>
  );
};

export const Themes: React.FC = () => {
  const f = useT();
  /* the camera holds on each stop, then travels to the next */
  let cam = STOPS[0];
  for (let i = 1; i < 7; i++) {
    cam = interpolate(f, [segStart(i), segStart(i) + MOVE], [cam, STOPS[i]], {...clampX, easing: Easing.bezier(0.45, 0, 0.25, 1)});
  }
  const stops = [Birth, Childhood, School, City, Work, Home, OldAge];
  const idx = Math.min(6, Math.max(0, Math.floor((f - INTRO) / SEG)));
  /* where Mitali is on her life ribbon, 0 → 70 years */
  const ageNow = (() => {
    const i = idx;
    const a0 = LIFE[Math.max(0, i - 1)].age;
    const a1 = LIFE[i].age;
    return i === 0 ? 0 : interpolate(f, [segStart(i), segStart(i) + MOVE], [a0, a1], clampX);
  })();
  const ribbonX = (a: number) => interpolate(a, [0, 70], [420, 1500]);

  return (
    <>
      <Chip where="Themes" what="one life, through the numbers" />
      <svg width={1920} height={1080} style={{position: 'absolute'}} fontFamily={outfit.fontFamily}>
        {/* far hills, drifting slower than the ground */}
        <g transform={`translate(${-cam * 0.35} 0)`} opacity={0.35}>
          <path d={`M-200,${GROUND} ${Array.from({length: 40}, (_, k) => `Q${k * 220 - 90},${GROUND - 120 - 60 * Math.sin(k * 1.7)} ${k * 220 + 20},${GROUND - 20}`).join(' ')} L9800,${GROUND} Z`} fill="#123a5c" />
        </g>
        <g transform={`translate(${960 - cam} 0)`}>
          <line x1={0} x2={STOPS[6] + 1400} y1={GROUND} y2={GROUND} stroke={C.skySoft} strokeOpacity={0.5} strokeWidth={3} />
          {stops.map((Stop, i) => {
            const lt = f - segStart(i);
            const tag = fade(lt, MOVE - 4, MOVE + 10) * (i < 6 ? 1 - fade(lt, SEG, SEG + 8) : 1);
            return (
              <g key={i} opacity={fade(f, 0, 14)}>
                <Stop cx={STOPS[i]} f={f} lt={lt} tag={tag} />
              </g>
            );
          })}
        </g>

        {/* Mitali's life ribbon */}
        <g opacity={fade(f, 8, 22)}>
          <line x1={ribbonX(0)} x2={ribbonX(70)} y1={930} y2={930} stroke={C.skySoft} strokeOpacity={0.3} strokeWidth={4} strokeLinecap="round" />
          <line x1={ribbonX(0)} x2={ribbonX(ageNow)} y1={930} y2={930} stroke={C.yellow} strokeWidth={4} strokeLinecap="round" />
          {LIFE.map((l, i) => (
            <g key={l.age}>
              <circle cx={ribbonX(l.age)} cy={930} r={i <= idx ? 8 : 6} fill={i <= idx ? C.yellow : C.navy} stroke={i <= idx ? C.yellow : C.skySoft} strokeWidth={2} />
              <text x={ribbonX(l.age)} y={966} textAnchor="middle" fill={i === idx ? C.yellow : C.muted} fontSize={19} fontWeight={i === idx ? 600 : 400}>
                {l.age === 0 ? 'birth' : l.age}
              </text>
            </g>
          ))}
          <text x={ribbonX(0) - 24} y={937} textAnchor="end" fill={C.paper} fontSize={21} fontWeight={600}>Mitali’s life</text>
        </g>
      </svg>

      {/* caption card: theme GIF, the figure, its chart */}
      {LIFE.map((c, i) => {
        const lt = f - segStart(i);
        const o = fade(lt, MOVE - 6, MOVE + 8) * (1 - fade(lt, SEG - 4, SEG + 6)) * fade(f, 4, 16);
        if (o <= 0.001) return null;
        const vt = interpolate(lt, [MOVE + 4, MOVE + 40], [0, 1], clampX);
        return (
          <div key={c.k + i} style={{position: 'absolute', left: 0, right: 0, top: 126, display: 'flex', justifyContent: 'center', opacity: o, fontFamily: outfit.fontFamily, transform: `translateY(${interpolate(o, [0, 1], [14, 0])}px)`}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 28, background: 'rgba(7,26,43,0.8)', border: '1px solid rgba(159,211,240,0.25)', borderRadius: 26, padding: '18px 30px 18px 18px', maxWidth: 1500}}>
              <div style={{width: 112, height: 112, flexShrink: 0, borderRadius: 56, background: C.paper, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'}}>
                <Gif src={staticFile(`gifs/${c.gif}.gif`)} width={96} height={96} fit="contain" />
              </div>
              <div style={{maxWidth: 820}}>
                <div style={{color: C.yellow, fontSize: 22, fontWeight: 600, letterSpacing: '0.18em'}}>{c.k}</div>
                <div style={{color: C.paper, fontSize: 36, fontWeight: 400, marginTop: 6, lineHeight: 1.2}}>{c.line}</div>
                <Source style={{marginTop: 8, fontSize: 20}}>{c.src}</Source>
              </div>
              <div style={{flexShrink: 0}}>
                <MiniViz v={c.viz} t={vt} />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};
