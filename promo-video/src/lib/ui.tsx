import React, {createContext, useContext} from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {C, oriya, outfit, serif} from './theme';

/* Playback speed for a scene: the promo sets it so a scene can play a little
   faster than it was keyed. Scenes read frames through useT(), not useCurrentFrame(). */
export const Speed = createContext(1);
export const useT = () => useCurrentFrame() * useContext(Speed);

export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const ease = Easing.bezier(0.65, 0, 0.35, 1);
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

/* 0 → 1 between frames a and b. */
export const fade = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], clamp);
export const tween = (f: number, a: number, b: number, from: number, to: number, e = ease) =>
  interpolate(f, [a, b], [from, to], {...clamp, easing: e});
/* In for frames [a, a+12], out for [b-10, b]: one line of text that comes and goes. */
export const window_ = (f: number, a: number, b: number) => fade(f, a, a + 12) * (1 - fade(f, b - 10, b));

export const Background: React.FC = () => (
  <AbsoluteFill style={{background: `radial-gradient(ellipse at 60% 45%, ${C.navy} 0%, ${C.navyDeep} 75%)`}} />
);

/* Fades a scene in from, and out to, the shared navy background. */
export const Fader: React.FC<{dur: number; inFrames?: number; outFrames?: number; children: React.ReactNode}> = ({dur, inFrames = 12, outFrames = 10, children}) => {
  const f = useCurrentFrame();
  const o = (inFrames ? fade(f, 0, inFrames) : 1) * (outFrames ? 1 - fade(f, dur - outFrames, dur) : 1);
  return <AbsoluteFill style={{opacity: o}}>{children}</AbsoluteFill>;
};

/* The label naming which part of the portal is on screen. */
export const Chip: React.FC<{where: string; what: string}> = ({where, what}) => {
  const f = useT();
  const o = fade(f, 4, 18);
  return (
    <div
      style={{
        position: 'absolute',
        left: 130,
        top: 74,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        fontFamily: outfit.fontFamily,
        opacity: o,
        transform: `translateX(${interpolate(o, [0, 1], [-20, 0])}px)`,
      }}
    >
      <span style={{width: 10, height: 10, borderRadius: 5, background: C.yellow}} />
      <span style={{color: C.yellow, fontSize: 23, fontWeight: 600, letterSpacing: '0.18em'}}>{where.toUpperCase()}</span>
      <span style={{color: C.muted, fontSize: 23, fontWeight: 400, letterSpacing: '0.04em'}}>{what}</span>
    </div>
  );
};

export const Kicker: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div style={{color: C.skySoft, fontFamily: outfit.fontFamily, fontSize: 22, fontWeight: 600, letterSpacing: '0.2em', ...style}}>{children}</div>
);

export const Headline: React.FC<{children: React.ReactNode; size?: number; style?: React.CSSProperties}> = ({children, size = 64, style}) => (
  <div style={{color: C.paper, fontFamily: outfit.fontFamily, fontSize: size, fontWeight: 600, lineHeight: 1.12, letterSpacing: '-0.01em', ...style}}>{children}</div>
);

export const Body: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div style={{color: '#c9d8e6', fontFamily: outfit.fontFamily, fontSize: 32, fontWeight: 300, lineHeight: 1.4, ...style}}>{children}</div>
);

export const Source: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div style={{color: C.muted, fontFamily: outfit.fontFamily, fontSize: 23, fontWeight: 400, letterSpacing: '0.01em', ...style}}>Source: {children}</div>
);

export const Hi: React.FC<{children: React.ReactNode; c?: string}> = ({children, c = C.yellow}) => (
  <span style={{color: c, fontWeight: 600}}>{children}</span>
);

/* Small persistent brand mark, top right. */
export const Brand: React.FC = () => (
  <div style={{position: 'absolute', right: 130, top: 62, display: 'flex', alignItems: 'baseline', gap: 12}}>
    <span style={{fontFamily: oriya.fontFamily, fontWeight: 700, fontSize: 34, color: C.sky}}>ସୂଚନା</span>
    <span style={{fontFamily: outfit.fontFamily, fontWeight: 600, fontSize: 18, letterSpacing: '0.3em', color: C.paper}}>SOOCHANA</span>
  </div>
);

export const SerifLine: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div style={{color: C.yellow, fontFamily: serif.fontFamily, fontStyle: 'italic', fontWeight: 300, fontSize: 40, ...style}}>{children}</div>
);

/* Shown under a screenshot of the real portal. */
export const BrowserCard: React.FC<{src: string; url: string; width: number; style?: React.CSSProperties; crop?: number}> = ({src, url, width, style, crop = 0}) => {
  const h = (width * 1000) / 1600;
  return (
    <div style={{position: 'absolute', width, borderRadius: 14, overflow: 'hidden', background: '#e9eef3', boxShadow: '0 30px 80px rgba(0,0,0,0.45)', ...style}}>
      <div style={{height: 34, display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', background: '#dfe5ec'}}>
        {['#f27c6f', '#f5c35b', '#6cc76c'].map((c) => (
          <span key={c} style={{width: 11, height: 11, borderRadius: 6, background: c}} />
        ))}
        <span style={{marginLeft: 12, flex: 1, height: 20, borderRadius: 10, background: '#fff', color: '#55657a', fontFamily: outfit.fontFamily, fontSize: 12, lineHeight: '20px', paddingLeft: 12}}>
          {url}
        </span>
      </div>
      <div style={{width, height: h, overflow: 'hidden'}}>
        <img src={src} style={{width, display: 'block', marginTop: -crop * (width / 1600)}} />
      </div>
    </div>
  );
};
