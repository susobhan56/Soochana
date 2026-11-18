import {loadFont as loadOutfit} from '@remotion/google-fonts/Outfit';
import {loadFont as loadMerriweather} from '@remotion/google-fonts/Merriweather';
import {loadFont as loadOriya} from '@remotion/google-fonts/NotoSansOriya';

/* The portal's welcome-screen palette (style.css, the --soo-* and --w-* tokens). */
export const C = {
  navy: '#0d2b45',
  navyDeep: '#071a2b',
  sky: '#36b4ee',
  skySoft: '#9fd3f0',
  yellow: '#f4c534',
  amber: '#f08a4b',
  paper: '#faf9f5',
  muted: '#8fa9bf',
  teal: '#2ec4c4',
};

export const outfit = loadOutfit('normal', {weights: ['300', '400', '600', '700'], subsets: ['latin']});
export const serif = loadMerriweather('italic', {weights: ['300', '400'], subsets: ['latin']});
export const oriya = loadOriya('normal', {weights: ['700'], subsets: ['oriya']});

export const FPS = 30;
export const W = 1920;
export const H = 1080;

/* The portal's public address for the end card. Confirm before publishing. */
export const SITE = 'susobhan56.github.io/Soochana';
