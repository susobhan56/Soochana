import React from 'react';
import {AbsoluteFill, Img, interpolate, random, staticFile} from 'remotion';
import {C, SITE, oriya, outfit} from '../lib/theme';
import {easeOut, fade, tween, useT} from '../lib/ui';

/* The last beat: what is coming next. Each item is something the portal has
   already started (see SOOCHANA_PRESENTER_SCRIPT.md and storyteller/README.md);
   confirm the list with the team before release. */
export const COMING_FRAMES = 140;

const NEXT = [
  {icon: '◎', title: 'Live search signals', line: 'Tectonics tracks what Odisha searches for, alongside the surveys.'},
  {icon: '✦', title: 'More Tectonics stories', line: 'New stories in the series, each with its open questions.'},
  {icon: '♪', title: 'The Storyteller', line: 'Every chart explained in plain words, and read aloud.'},
];

export const ComingSoon: React.FC = () => {
  const f = useT();
  const title = tween(f, 6, 30, 0, 1, easeOut);

  return (
    <>
      {/* a slow field of rising dots: the stories still to come */}
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        {Array.from({length: 90}, (_, i) => {
          const x = random(`cx${i}`) * 1920;
          const speed = 0.6 + random(`cs${i}`) * 1.4;
          const y = 1100 - ((random(`cy${i}`) * 1200 + f * speed * 3) % 1200);
          const r = 2 + random(`cr${i}`) * 4;
          return <circle key={i} cx={x} cy={y} r={r} fill={random(`cc${i}`) < 0.25 ? C.yellow : C.sky} opacity={0.18 + random(`co${i}`) * 0.35} />;
        })}
      </svg>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, rgba(7,26,43,0.2) 0%, rgba(7,26,43,0.75) 75%)'}} />

      <div style={{position: 'absolute', left: 0, right: 0, top: 120, textAlign: 'center', fontFamily: outfit.fontFamily}}>
        <div style={{color: C.skySoft, fontSize: 26, fontWeight: 600, letterSpacing: '0.3em', opacity: fade(f, 2, 16)}}>MITALI’S STORY IS ONLY BEGINNING</div>
        <div
          style={{
            color: C.yellow,
            fontSize: 140,
            fontWeight: 700,
            letterSpacing: `${interpolate(title, [0, 1], [0.4, 0.08])}em`,
            lineHeight: 1.1,
            marginTop: 18,
            opacity: title,
            transform: `scale(${interpolate(title, [0, 1], [0.92, 1])})`,
          }}
        >
          COMING SOON
        </div>
      </div>

      <div style={{position: 'absolute', left: 0, right: 0, top: 470, display: 'flex', justifyContent: 'center', gap: 36, fontFamily: outfit.fontFamily}}>
        {NEXT.map((n, k) => {
          const o = tween(f, 30 + k * 12, 52 + k * 12, 0, 1, easeOut);
          return (
            <div
              key={n.title}
              style={{
                width: 440,
                background: 'rgba(13,43,69,0.85)',
                border: '1px solid rgba(159,211,240,0.35)',
                borderRadius: 24,
                padding: '30px 30px 32px',
                opacity: o,
                transform: `translateY(${interpolate(o, [0, 1], [40, 0])}px)`,
              }}
            >
              <div style={{width: 64, height: 64, borderRadius: 32, background: C.yellow, color: C.navyDeep, fontSize: 34, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{n.icon}</div>
              <div style={{color: C.paper, fontSize: 34, fontWeight: 600, marginTop: 20}}>{n.title}</div>
              <div style={{color: '#c9d8e6', fontSize: 25, fontWeight: 300, marginTop: 10, lineHeight: 1.4}}>{n.line}</div>
            </div>
          );
        })}
      </div>

      <div style={{position: 'absolute', left: 0, right: 0, top: 860, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 28, fontFamily: outfit.fontFamily, opacity: fade(f, 70, 86)}}>
        <span style={{fontFamily: oriya.fontFamily, fontWeight: 700, fontSize: 52, color: C.sky}}>ସୂଚନା</span>
        <span style={{background: C.yellow, color: C.navyDeep, fontSize: 30, fontWeight: 600, borderRadius: 40, padding: '10px 34px'}}>{SITE}</span>
        <div style={{background: '#fff', borderRadius: 10, padding: 6}}>
          <Img src={staticFile('qr.svg')} style={{width: 96, height: 96, display: 'block'}} />
        </div>
      </div>
    </>
  );
};
