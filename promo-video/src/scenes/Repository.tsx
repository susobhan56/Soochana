import React from 'react';
import {interpolate, staticFile} from 'remotion';
import S from '../data/scenes.json';
import FL from '../data/flourish.json';
import {C, outfit} from '../lib/theme';
import {Body, BrowserCard, Chip, Headline, Hi, easeOut, fade, tween, useT} from '../lib/ui';

/* The rest of the portal in one beat: the State Dossier, the guided tour,
   the themes and the Repository, with real screenshots fanned behind. */
export const REPO_FRAMES = 160;

/* The State Dossier's Flourish charts, one after another, each drawn on with a wipe. */
const FLOURISH = ['chart1.png', 'chart3.png', 'chart5.png', 'chart4.png'].map((file) => FL.find((c) => c.file === file)!).filter(Boolean);
const FlourishCard: React.FC<{f: number; left: number; top: number; w: number}> = ({f, left, top, w}) => {
  const per = 34;
  const k = Math.min(FLOURISH.length - 1, Math.max(0, Math.floor((f - 22) / per)));
  const local = f - 22 - k * per;
  const wipe = tween(local, 0, 22, 0, 100, easeOut);
  const o = tween(f, 22, 44, 0, 1, easeOut);
  const h = (w * 700) / 1100;
  return (
    <div style={{position: 'absolute', left, top, width: w, borderRadius: 14, overflow: 'hidden', background: '#fff', boxShadow: '0 30px 80px rgba(0,0,0,0.45)', opacity: o, transform: `rotateY(-14deg) translateY(${interpolate(o, [0, 1], [60, 0])}px)`}}>
      <div style={{height: 34, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', background: '#dfe5ec', fontFamily: outfit.fontFamily, fontSize: 13, color: '#55657a'}}>
        <span style={{background: C.navy, color: '#fff', borderRadius: 6, padding: '2px 8px', fontWeight: 600}}>Flourish</span>
        State Dossier · {FLOURISH[k].title}
      </div>
      <div style={{width: w, height: h, position: 'relative'}}>
        <img src={staticFile(`flourish/${FLOURISH[k].file}`)} style={{width: w, height: h, display: 'block', clipPath: `inset(0 ${100 - wipe}% 0 0)`}} />
      </div>
    </div>
  );
};

export const Repository: React.FC = () => {
  const f = useT();
  const R = S.repo;
  const stats = [
    {n: R.dossierModules, t: 'modules in the State Dossier'},
    {n: R.exploreScreens, t: 'screens in the guided tour, with quizzes'},
    {n: R.themes, t: 'themes of briefs and articles'},
    {n: R.reports, t: `reports, and ${R.datasets} datasets to download`},
  ];
  const card = (d: number) => tween(f, d, d + 30, 0, 1, easeOut);
  const cards = [
    {src: 'explore', url: 'soochana · explore', w: 600, left: 1190, top: 120, at: 8},
    {src: 'repository', url: 'soochana · repository', w: 500, left: 1320, top: 640, at: 44},
  ];

  return (
    <>
      <Chip where="Explore · Dossier · Repository" what="and much more" />
      <div style={{position: 'absolute', left: 130, top: 170, width: 780, opacity: fade(f, 6, 20)}}>
        <Headline size={58}>
          And much more. <Hi>Every number sourced.</Hi>
        </Headline>
      </div>
      <div style={{position: 'absolute', left: 130, top: 380, display: 'flex', flexDirection: 'column', gap: 22, fontFamily: outfit.fontFamily}}>
        {stats.map((s, k) => {
          const a = 14 + k * 12;
          return (
            <div key={s.t} style={{display: 'flex', alignItems: 'baseline', gap: 24, opacity: fade(f, a, a + 12), transform: `translateX(${interpolate(fade(f, a, a + 12), [0, 1], [-20, 0])}px)`}}>
              <span style={{color: C.yellow, fontSize: 76, fontWeight: 700, width: 170, fontVariantNumeric: 'tabular-nums'}}>
                {Math.round(tween(f, a, a + 30, 0, s.n, easeOut))}
              </span>
              <span style={{color: '#d7e3ee', fontSize: 30, fontWeight: 300}}>{s.t}</span>
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 130, top: 880, width: 780, opacity: fade(f, 70, 84)}}>
        <Body style={{fontSize: 28}}>Charts download as images. The whole state prints as one report.</Body>
      </div>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, perspective: 1800}}>
        {cards.slice(0, 1).map((c) => (
          <BrowserCard
            key={c.src}
            src={staticFile(`shots/${c.src}.png`)}
            url={c.url}
            width={c.w}
            style={{left: c.left, top: c.top, opacity: card(c.at), transform: `rotateY(-14deg) translateY(${interpolate(card(c.at), [0, 1], [60, 0])}px)`}}
          />
        ))}
        <FlourishCard f={f} left={930} top={270} w={720} />
        {cards.slice(1).map((c) => (
          <BrowserCard
            key={c.src}
            src={staticFile(`shots/${c.src}.png`)}
            url={c.url}
            width={c.w}
            style={{left: c.left, top: c.top, opacity: card(c.at), transform: `rotateY(-14deg) translateY(${interpolate(card(c.at), [0, 1], [60, 0])}px)`}}
          />
        ))}
      </div>
    </>
  );
};
