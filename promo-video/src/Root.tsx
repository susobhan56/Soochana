import React from 'react';
import {Composition} from 'remotion';
import {FPS, H, W} from './lib/theme';
import {PROMO_FRAMES, Promo} from './Promo';
import {OPENING_FRAMES, Opening} from './scenes/Opening';
import {ContactSheet} from './ContactSheet';

export const Root: React.FC = () => (
  <>
    <Composition id="Promo" component={Promo} durationInFrames={PROMO_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="Opening" component={Opening} durationInFrames={OPENING_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="ContactSheet" component={ContactSheet} durationInFrames={1} fps={FPS} width={1920} height={1320} />
  </>
);
