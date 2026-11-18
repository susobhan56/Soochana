import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';

/* A dev-only grid of captured images, to check them at a glance. */
const NAMES = Array.from({length: 9}, (_, i) => `flourish/chart${i + 1}.png`);

export const ContactSheet: React.FC = () => (
  <AbsoluteFill style={{background: '#222', display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start'}}>
    {NAMES.map((n) => (
      <div key={n} style={{width: 640, height: 440}}>
        <Img src={staticFile(n)} style={{width: 640, height: 407, objectFit: 'contain', background: '#fff'}} />
        <div style={{color: '#fff', fontSize: 22, fontFamily: 'sans-serif'}}>{n}</div>
      </div>
    ))}
  </AbsoluteFill>
);
