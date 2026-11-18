import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {C, outfit} from './lib/theme';
import {Background, Brand, Fader, Speed, fade} from './lib/ui';
import NARR from './data/narration.json';
import {OPENING_FRAMES, Opening} from './scenes/Opening';
import {NARRATIVE_FRAMES, Narrative} from './scenes/Narrative';
import {PEOPLE_FRAMES, People} from './scenes/People';
import {THEMES_FRAMES, Themes} from './scenes/Themes';
import {DISTRICTS_FRAMES, Districts} from './scenes/Districts';
import {HEALTH_FRAMES, Health} from './scenes/Health';
import {TECTONICS_FRAMES, Tectonics} from './scenes/Tectonics';
import {ASSIST_FRAMES, AssistantLearn} from './scenes/AssistantLearn';
import {REPO_FRAMES, Repository} from './scenes/Repository';
import {AHEAD_FRAMES, Ahead} from './scenes/Ahead';
import {END_FRAMES, EndCard} from './scenes/EndCard';
import {COMING_FRAMES, ComingSoon} from './scenes/ComingSoon';

/* The promo, scene by scene (82 seconds, the length of the music).
   keyed: the length a scene was animated at; dur: its length here (the scene
   plays at keyed / dur speed). nav names the scene in the bottom bar.
   fadeIn / fadeOut: 0 where one scene flows straight into the next. */
type Scene = {C: React.FC<any>; props?: object; keyed: number; dur: number; nav: string | null; fadeIn?: number; fadeOut?: number};
const SCENES: Scene[] = [
  {C: Opening, keyed: OPENING_FRAMES, dur: 250, nav: null, fadeIn: 0},
  {C: Narrative, keyed: NARRATIVE_FRAMES, dur: 130, nav: null, fadeOut: 0},
  {C: People, props: {seamless: true}, keyed: PEOPLE_FRAMES, dur: 290, nav: 'Story', fadeIn: 0},
  {C: Themes, keyed: THEMES_FRAMES, dur: THEMES_FRAMES, nav: 'Themes'},
  {C: Districts, keyed: DISTRICTS_FRAMES, dur: 178, nav: 'Districts'},
  {C: Health, keyed: HEALTH_FRAMES, dur: 160, nav: 'Health'},
  {C: Tectonics, keyed: TECTONICS_FRAMES, dur: 160, nav: 'Tectonics'},
  {C: AssistantLearn, keyed: ASSIST_FRAMES, dur: 145, nav: 'Assistant & Learn'},
  {C: Repository, keyed: REPO_FRAMES, dur: 130, nav: 'And more'},
  {C: Ahead, keyed: AHEAD_FRAMES, dur: 160, nav: null},
  {C: EndCard, keyed: END_FRAMES, dur: 120, nav: null},
  {C: ComingSoon, keyed: COMING_FRAMES, dur: 124, nav: null, fadeOut: 0},
];
const starts = SCENES.reduce<number[]>((a, s, i) => [...a, i ? a[i - 1] + SCENES[i - 1].dur : 0], []);
export const PROMO_FRAMES = starts[starts.length - 1] + SCENES[SCENES.length - 1].dur;
const NAV = SCENES.map((s, i) => ({...s, from: starts[i]})).filter((s) => s.nav);
const navFrom = NAV[0].from;
const navTo = NAV[NAV.length - 1].from + NAV[NAV.length - 1].dur;

/* A quiet bar along the bottom naming each part of the portal as it comes up. */
const ModuleBar: React.FC = () => {
  const f = useCurrentFrame() + navFrom;
  const o = fade(f, navFrom + 6, navFrom + 20) * (1 - fade(f, navTo - 10, navTo));
  return (
    <div style={{position: 'absolute', left: 130, right: 130, bottom: 30, display: 'flex', gap: 10, opacity: o, fontFamily: outfit.fontFamily}}>
      {NAV.map((s) => {
        const p = Math.min(1, Math.max(0, (f - s.from) / s.dur));
        const on = f >= s.from && f < s.from + s.dur;
        return (
          <div key={s.nav} style={{flex: 1}}>
            <div style={{height: 3, background: 'rgba(159,211,240,0.18)', borderRadius: 2, overflow: 'hidden'}}>
              <div style={{width: `${p * 100}%`, height: 3, background: on ? C.yellow : C.skySoft}} />
            </div>
            <div style={{marginTop: 8, fontSize: 19, letterSpacing: '0.12em', color: on ? C.yellow : C.muted, fontWeight: on ? 600 : 400}}>{s.nav!.toUpperCase()}</div>
          </div>
        );
      })}
    </div>
  );
};

/* Music: "Motivational Showreel" by MUSIC4VIDEO (public/audio/music.mp3, 86 s).
   It is started MUSIC_IN seconds in so its own ending (about 82 s) lands on the
   last frame; its full-energy section then arrives with the title. */
const MUSIC_IN = Math.max(0, 82 - PROMO_FRAMES / 30);
/* Voiceover: one clip per line of src/data/narration.json, each placed at its
   `at` second. `set` (written by tools/vo_durations.js) says which voice:
   "final" reads public/audio/vo/, "guide" the Windows guide voice. */
const VO_DIR = (NARR as {set?: string}).set === 'final' ? 'audio/vo' : 'audio/vo-guide';
const CUES = NARR.cues.filter((c) => (c as {dur?: number}).dur).map((c) => ({...c, from: Math.round(c.at * 30), len: Math.ceil(((c as {dur?: number}).dur ?? 0) * 30)}));

/* The music dips under each line and comes back between them. */
const DUCK = 0.28;
const voiceAt = (f: number) =>
  Math.max(0, ...CUES.map((c) => interpolate(f, [c.from - 8, c.from, c.from + c.len, c.from + c.len + 12], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})));
const musicVolume = (f: number) =>
  0.9 *
  interpolate(f, [0, 15, PROMO_FRAMES - 24, PROMO_FRAMES], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) *
  interpolate(voiceAt(f), [0, 1], [1, DUCK]);

export const Promo: React.FC = () => (
  <AbsoluteFill style={{fontFamily: outfit.fontFamily}}>
    <Audio src={staticFile('audio/music.mp3')} startFrom={Math.round(MUSIC_IN * 30)} volume={musicVolume} />
    {CUES.map((c) => (
      <Sequence key={c.id} from={c.from} durationInFrames={c.len + 6}>
        <Audio src={staticFile(`${VO_DIR}/${c.file}`)} volume={1} />
      </Sequence>
    ))}
    <Background />
    {SCENES.map((s, i) => (
      <Sequence key={i} from={starts[i]} durationInFrames={s.dur}>
        <Fader dur={s.dur} inFrames={s.fadeIn ?? 12} outFrames={s.fadeOut ?? 10}>
          <Speed.Provider value={s.keyed / s.dur}>
            <s.C {...s.props} />
          </Speed.Provider>
        </Fader>
      </Sequence>
    ))}
    <Sequence from={navFrom} durationInFrames={navTo - navFrom}>
      <Fader dur={navTo - navFrom}>
        <Brand />
      </Fader>
      <ModuleBar />
    </Sequence>
  </AbsoluteFill>
);
