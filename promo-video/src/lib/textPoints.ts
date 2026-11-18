import {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';

export type Pt = [number, number];

/* Draws `text` on an offscreen canvas once its font has loaded and returns
   about `count` points on an even grid inside the letters. */
export const useTextPoints = (
  text: string,
  font: {fontFamily: string; waitUntilDone: () => Promise<unknown>},
  opts: {weight: number; size: number; cx: number; cy: number; width: number; height: number; count: number},
): Pt[] | null => {
  const [pts, setPts] = useState<Pt[] | null>(null);
  const [handle] = useState(() => delayRender('sampling text points'));

  useEffect(() => {
    let alive = true;
    const css = `${opts.weight} ${opts.size}px "${font.fontFamily}"`;
    font
      .waitUntilDone()
      .then(() => document.fonts.load(css, text))
      .then(() => {
        const cv = document.createElement('canvas');
        cv.width = opts.width;
        cv.height = opts.height;
        const g = cv.getContext('2d')!;
        g.fillStyle = '#000';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = css;
        g.fillText(text, opts.cx, opts.cy);
        const px = g.getImageData(0, 0, opts.width, opts.height).data;
        const sample = (step: number): Pt[] => {
          const out: Pt[] = [];
          for (let y = 0, row = 0; y < opts.height; y += step * 0.866, row++) {
            for (let x = row % 2 ? step / 2 : 0; x < opts.width; x += step) {
              if (px[(Math.round(y) * opts.width + Math.round(x)) * 4 + 3] > 128) out.push([x, y]);
            }
          }
          return out;
        };
        let step = 4;
        let out = sample(step);
        while (out.length > opts.count * 1.05) {
          step += 0.25;
          out = sample(step);
        }
        if (alive) {
          setPts(out);
          continueRender(handle);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  return pts;
};
