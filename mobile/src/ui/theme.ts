/* theme.ts — palette e spaziature, coerenti con la versione web. */

export type Palette = {
  bg: string; card: string; card2: string; line: string;
  txt: string; dim: string;
  accent: string; accentSoft: string;
  ok: string; warn: string; bad: string; violet: string;
};

export const DARK: Palette = {
  bg: '#0e1116', card: '#161b22', card2: '#1d242e', line: '#262e3a',
  txt: '#e7edf5', dim: '#97a3b4',
  accent: '#4a9eff', accentSoft: 'rgba(74,158,255,0.14)',
  ok: '#35c48b', warn: '#f2b13a', bad: '#f2685f', violet: '#a97bff',
};

export const LIGHT: Palette = {
  bg: '#f4f6fa', card: '#ffffff', card2: '#eef2f8', line: '#dde3ec',
  txt: '#171f2b', dim: '#5d6b7d',
  accent: '#1f6fd4', accentSoft: 'rgba(31,111,212,0.10)',
  ok: '#1e9c6c', warn: '#c98407', bad: '#d1483d', violet: '#7d4fd6',
};

export const R = { sm: 10, md: 14, lg: 18, pill: 999 };
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22 };

export function colorForPct(p: Palette, pct: number): string {
  if (pct >= 115) return p.bad;
  if (pct >= 100) return p.ok;
  if (pct >= 85) return p.accent;
  if (pct >= 60) return p.warn;
  return p.bad;
}
