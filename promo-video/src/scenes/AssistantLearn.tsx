import React from 'react';
import {interpolate} from 'remotion';
import S from '../data/scenes.json';
import {C, outfit} from '../lib/theme';
import {Body, Chip, Headline, Hi, Kicker, easeOut, fade, tween, useT} from '../lib/ui';

/* The Soochana Assistant answering from the portal's own data, beside a
   Learn lesson fitting a model to the 30-district table. */
export const ASSIST_FRAMES = 180;

const typed = (f: number, a: number, b: number, s: string) => s.slice(0, Math.round(tween(f, a, b, 0, s.length, (t) => t)));

const Bubble: React.FC<{me?: boolean; o: number; children: React.ReactNode}> = ({me, o, children}) => (
  <div
    style={{
      alignSelf: me ? 'flex-end' : 'flex-start',
      maxWidth: me ? 520 : 600,
      background: me ? C.sky : '#ffffff',
      color: me ? C.navyDeep : '#1b2b3d',
      borderRadius: me ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
      padding: '16px 22px',
      fontSize: 24,
      lineHeight: 1.4,
      fontWeight: me ? 500 : 400,
      boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
      opacity: o,
      transform: `translateY(${interpolate(o, [0, 1], [12, 0])}px)`,
    }}
  >
    {children}
  </div>
);

const Dots: React.FC<{o: number}> = ({o}) => {
  const f = useT();
  return (
    <div style={{alignSelf: 'flex-start', display: 'flex', gap: 8, background: '#fff', borderRadius: 20, padding: '18px 22px', opacity: o}}>
      {[0, 1, 2].map((k) => (
        <span key={k} style={{width: 10, height: 10, borderRadius: 5, background: '#8fa9bf', opacity: 0.4 + 0.6 * Math.abs(Math.sin(f / 4 + k))}} />
      ))}
    </div>
  );
};

const Src: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{marginTop: 10, fontSize: 17, color: '#55657a', background: '#eef2f6', borderRadius: 8, padding: '6px 12px'}}>{children}</div>
);

/* scatter */
const P = S.learnFit.pts;
const X = (v: number) => interpolate(v, [30, 95], [1060, 1740]);
const Y = (v: number) => interpolate(v, [0, 50], [830, 420]);
const mx = P.reduce((s, p) => s + p.x, 0) / P.length;
const my = P.reduce((s, p) => s + p.y, 0) / P.length;

export const AssistantLearn: React.FC = () => {
  const f = useT();
  const q1 = 'What is the infant mortality rate in Koraput?';
  const k = S.koraputImr;
  const showDots1 = fade(f, 54, 58) * (1 - fade(f, 68, 72));
  const train = tween(f, 76, 128, 0, 1);
  const slope = interpolate(train, [0, 1], [0, S.learnFit.slope]);
  /* a little wobble while it learns, settling as training ends */
  const wobble = Math.sin(f / 3) * 0.25 * (1 - train) * fade(f, 76, 80);
  const lineY = (x: number) => Y(my + (slope + wobble) * (x - mx));

  return (
    <>
      <Chip where="Assistant · Learn" what="ask, and understand" />

      {/* chat window */}
      <div
        style={{
          position: 'absolute',
          left: 130,
          top: 160,
          width: 780,
          height: 740,
          borderRadius: 22,
          overflow: 'hidden',
          background: '#f2f5f9',
          boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
          fontFamily: outfit.fontFamily,
          opacity: fade(f, 4, 16),
          transform: `translateY(${interpolate(fade(f, 4, 16), [0, 1], [24, 0])}px)`,
        }}
      >
        <div style={{height: 92, background: '#0b2238', display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px'}}>
          <div style={{width: 52, height: 52, borderRadius: 26, border: `2px solid ${C.skySoft}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.skySoft, fontSize: 26}}>✦</div>
          <div>
            <div style={{color: '#fff', fontSize: 26, fontWeight: 600}}>Soochana Assistant</div>
            <div style={{color: '#c9d8e6', fontSize: 17, display: 'flex', alignItems: 'center', gap: 8}}>
              <span style={{width: 9, height: 9, borderRadius: 5, background: '#4cc38a'}} />
              Answers from Odisha’s district data
            </div>
          </div>
        </div>
        <div style={{padding: 28, display: 'flex', flexDirection: 'column', gap: 18}}>
          <Bubble me o={fade(f, 12, 18)}>{typed(f, 14, 52, q1) || ' '}</Bubble>
          {f < 72 ? (
            <Dots o={showDots1} />
          ) : (
            <Bubble o={fade(f, 70, 80)}>
              <b>Koraput</b>: infant mortality <b>{k.now}</b> per 1,000 live births, down from {k.was}.
              <Src>Source: NFHS-5 (2019–21), with NFHS-4 (2015–16) for change</Src>
            </Bubble>
          )}
          <Bubble me o={fade(f, 104, 110)}>{typed(f, 106, 118, 'And Puri?') || ' '}</Bubble>
          <Bubble o={fade(f, 128, 138)}>
            <b>Puri</b>: <b>{S.puriImr}</b> per 1,000 live births. It remembers what you asked.
            <Src>Source: NFHS-5 (2019–21)</Src>
          </Bubble>
        </div>
      </div>

      {/* learn panel */}
      <div style={{position: 'absolute', left: 1060, top: 160, width: 720, opacity: fade(f, 20, 34)}}>
        <Kicker>SOOCHANA LEARN</Kicker>
        <Headline size={44} style={{marginTop: 12}}>
          How the numbers work, <Hi c={C.sky}>in pictures.</Hi>
        </Headline>
      </div>
      <svg width={1920} height={1080} style={{position: 'absolute'}} fontFamily={outfit.fontFamily}>
        <g opacity={fade(f, 28, 40)}>
          <line x1={1060} x2={1740} y1={850} y2={850} stroke={C.muted} strokeOpacity={0.5} />
          <line x1={1060} x2={1060} y1={400} y2={850} stroke={C.muted} strokeOpacity={0.5} />
          <text x={1740} y={884} textAnchor="end" fill={C.muted} fontSize={22}>women’s literacy, % (Census 2011)</text>
          <text x={1074} y={412} fill={C.muted} fontSize={22}>married before 18, % (NFHS-5)</text>
        </g>
        {P.map((p, i) => {
          const o = tween(f, 32 + i * 1.2, 44 + i * 1.2, 0, 1, easeOut);
          return <circle key={p.name} cx={X(p.x)} cy={Y(p.y)} r={9 * o} fill={C.skySoft} opacity={0.9} />;
        })}
        <g opacity={fade(f, 74, 80)}>
          <line x1={X(34)} x2={X(92)} y1={lineY(34)} y2={lineY(92)} stroke={C.yellow} strokeWidth={4} strokeLinecap="round" />
          <text x={1740} y={470} textAnchor="end" fill={C.yellow} fontSize={22} fontWeight={600}>
            {train < 1 ? `training… ${Math.round(train * 100)}%` : `fitted · r = ${S.learnFit.r}`}
          </text>
        </g>
      </svg>
      <div style={{position: 'absolute', left: 1060, top: 920, width: 720, opacity: fade(f, 130, 144)}}>
        <Body style={{fontSize: 26}}>Each dot is a district. Models train live in your browser, on Odisha’s own data.</Body>
      </div>
      <div style={{position: 'absolute', left: 130, top: 930, width: 780, opacity: fade(f, 140, 154)}}>
        <Body style={{fontSize: 26}}>Plain-English questions. Every answer names its source.</Body>
      </div>
    </>
  );
};
