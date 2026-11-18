import data from '../data/odisha.json';

const YEAR_MS = 365.2425 * 864e5;
const pop = data.statePop as Record<string, number>;
const years = Object.keys(pop).map(Number).sort((a, b) => a - b);

/* Between data years the population grows at a steady rate, so interpolate
   geometrically, as soochana_live.js does on the portal. */
export const statePop = (y: number): number => {
  const c = Math.max(years[0], Math.min(years[years.length - 1], y));
  for (let i = 0; i < years.length - 1; i++) {
    if (c <= years[i + 1]) {
      const a = pop[years[i]];
      const b = pop[years[i + 1]];
      return a * Math.pow(b / a, (c - years[i]) / (years[i + 1] - years[i]));
    }
  }
  return pop[years[years.length - 1]];
};

/* "Now" is fixed to the render date so every render shows the same count.
   Census and projection figures refer to 1 March. */
export const NOW_DATE = new Date(2026, 9, 17);
export const NOW_YEAR = 2026 + (NOW_DATE.getTime() - new Date(2026, 2, 1).getTime()) / YEAR_MS;

export const perDay = (): number => {
  const dt = 1 / 12;
  return (statePop(NOW_YEAR + dt) - statePop(NOW_YEAR - dt)) / (2 * dt) / 365.2425;
};

export const fmtIN = (n: number): string => Math.round(n).toLocaleString('en-IN');
