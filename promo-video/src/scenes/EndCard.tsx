import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile} from 'remotion';
import {C, SITE, oriya, outfit} from '../lib/theme';
import {BrowserCard, SerifLine, fade, useT} from '../lib/ui';

/* The close: a wall of the real portal behind the name, the vision line, who
   it is for, an invitation with the address and a QR code, and the partners. */
export const END_FRAMES = 150;

const WALL = ['home', 'story1', 'dossier', 'district2', 'compare2', 'health', 'tectonics', 'explore', 'learn', 'learn2', 'rankings', 'health2'];

/* Partner logos sit on white tiles; the square files have wide margins, so they are cropped to the artwork. */
const LOGOS = [
  {src: 'logos/logo_diu.png', square: true},
  {src: 'logos/logo_cysd.png', square: true},
  {src: 'logos/logo_unfpa.png', square: true},
  {src: 'logos/logo_odi.png', square: false},
];
const TILE_W = 190, TILE_H = 110;

export const EndCard: React.FC = () => {
  const f = useT();
  const pan = interpolate(f, [0, END_FRAMES], [0, -160]);
  const cta = fade(f, 50, 64);

  return (
    <>
      <AbsoluteFill style={{perspective: 2000, opacity: 0.3 * fade(f, 0, 20)}}>
        <div style={{position: 'absolute', left: -200, top: -120, width: 2600, height: 1400, transform: `rotateX(22deg) rotateZ(-9deg) translateX(${pan}px)`}}>
          {WALL.map((n, i) => (
            <BrowserCard key={n} src={staticFile(`shots/${n}.png`)} url={`soochana · ${n}`} width={600} style={{left: (i % 4) * 640, top: Math.floor(i / 4) * 440 + (i % 2) * 40}} />
          ))}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 50%, rgba(7,26,43,0.94) 0%, rgba(7,26,43,0.6) 70%, rgba(7,26,43,0.35) 100%)`}} />

      <div style={{position: 'absolute', left: 0, right: 0, top: 96, textAlign: 'center', fontFamily: outfit.fontFamily}}>
        <div style={{fontFamily: oriya.fontFamily, fontWeight: 700, fontSize: 120, color: C.sky, lineHeight: 1.2, opacity: fade(f, 4, 20)}}>ସୂଚନା</div>
        <div style={{color: C.paper, fontSize: 50, fontWeight: 600, letterSpacing: '0.32em', paddingLeft: '0.32em', opacity: fade(f, 10, 26)}}>SOOCHANA</div>
        <div style={{color: C.skySoft, fontSize: 28, fontWeight: 300, marginTop: 10, opacity: fade(f, 16, 30)}}>Odisha’s Demographic Intelligence Portal</div>
        <SerifLine style={{marginTop: 34, fontSize: 42, opacity: fade(f, 26, 42)}}>Every plan starts from an honest picture of its people.</SerifLine>
        <div style={{color: '#d7e3ee', fontSize: 27, fontWeight: 300, marginTop: 16, opacity: fade(f, 36, 50)}}>
          For planners, teachers, journalists, students, and every citizen of Odisha.
        </div>

        <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 40, marginTop: 40, opacity: cta, transform: `scale(${interpolate(cta, [0, 1], [0.94, 1])})`}}>
          <div style={{textAlign: 'right'}}>
            <div style={{color: C.yellow, fontSize: 30, fontWeight: 700, letterSpacing: '0.08em'}}>FIND YOUR DISTRICT’S STORY</div>
            <div style={{display: 'inline-block', marginTop: 14, background: C.yellow, color: C.navyDeep, fontSize: 32, fontWeight: 600, borderRadius: 40, padding: '12px 36px'}}>{SITE}</div>
          </div>
          <div style={{background: '#fff', borderRadius: 14, padding: 10, opacity: fade(f, 56, 70)}}>
            <Img src={staticFile('qr.svg')} style={{width: 140, height: 140, display: 'block'}} />
          </div>
        </div>

        <div style={{color: C.muted, fontSize: 21, marginTop: 40, letterSpacing: '0.03em', opacity: fade(f, 66, 80)}}>
          Built by the Demographic Intelligence Unit, CYSD · Technical support: UNFPA Odisha · Part of the Odisha Development Initiative
        </div>
        <div style={{display: 'flex', justifyContent: 'center', gap: 22, marginTop: 18}}>
          {LOGOS.map((l, k) => (
            <div key={l.src} style={{width: TILE_W, height: TILE_H, background: '#fff', borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: fade(f, 70 + k * 4, 82 + k * 4)}}>
              {l.square ? (
                <Img src={staticFile(l.src)} style={{width: TILE_W, height: TILE_W, objectFit: 'cover', marginTop: 0}} />
              ) : (
                <Img src={staticFile(l.src)} style={{width: TILE_W - 24, height: TILE_H - 24, objectFit: 'contain'}} />
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
