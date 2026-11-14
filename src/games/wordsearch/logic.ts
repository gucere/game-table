/** Kelime Avı: find the hidden words in a grid of letters. */
import type { GameCtx, GameResult, Seat } from '../../engine/types';
import { shuffle } from '../cards/cards';
import { ALPHABET, upper, words } from '../hangman/logic';

export interface WSWord {
  word: string;
  cells: number[];
}
export interface WSState {
  size: number;
  grid: string[];
  words: WSWord[];
  found: boolean[];
  startedAt: number;
  finishedAt: number | null;
  lang: string;
}
export type WSMove = { type: 'find'; cells: number[] };

const DIRS: Record<string, [number, number][]> = {
  easy: [
    [0, 1],
    [1, 0],
  ],
  normal: [
    [0, 1],
    [1, 0],
    [1, 1],
    [-1, 1],
  ],
  hard: [
    [0, 1],
    [1, 0],
    [1, 1],
    [-1, 1],
    [0, -1],
    [-1, 0],
    [-1, -1],
    [1, -1],
  ],
};

export function generate(size: number, count: number, level: string, lang: string, random: () => number) {
  const pool = shuffle(
    words(lang).filter((w) => w.length <= size - 1),
    random,
  );
  const grid: (string | null)[] = Array(size * size).fill(null);
  const placed: WSWord[] = [];
  const dirs = DIRS[level] ?? DIRS.normal;
  for (const word of pool) {
    if (placed.length >= count) break;
    if (placed.some((p) => p.word === word || p.word.includes(word) || word.includes(p.word))) continue;
    for (let tries = 0; tries < 60; tries++) {
      const [dr, dc] = dirs[Math.floor(random() * dirs.length)];
      const r0 = Math.floor(random() * size);
      const c0 = Math.floor(random() * size);
      const cells: number[] = [];
      let ok = true;
      for (let k = 0; k < word.length; k++) {
        const r = r0 + dr * k;
        const c = c0 + dc * k;
        if (r < 0 || c < 0 || r >= size || c >= size) {
          ok = false;
          break;
        }
        const i = r * size + c;
        if (grid[i] !== null && grid[i] !== word[k]) {
          ok = false;
          break;
        }
        cells.push(i);
      }
      if (!ok) continue;
      cells.forEach((i, k) => (grid[i] = word[k]));
      placed.push({ word, cells });
      break;
    }
  }
  const letters = ALPHABET[lang];
  return { grid: grid.map((g) => g ?? letters[Math.floor(random() * letters.length)]), words: placed.sort((a, b) => a.word.localeCompare(b.word, lang)) };
}

export function setup(ctx: Pick<GameCtx, 'random' | 'options' | 'now'>): WSState {
  const level = ctx.options.level ?? 'normal';
  const size = level === 'easy' ? 9 : level === 'hard' ? 13 : 11;
  const lang = ctx.options.lang === 'en' ? 'en' : 'tr';
  const { grid, words: ws } = generate(size, level === 'easy' ? 8 : level === 'hard' ? 16 : 12, level, lang, ctx.random);
  return { size, grid, words: ws, found: ws.map(() => false), startedAt: ctx.now(), finishedAt: null, lang };
}

export function move(s: WSState, _seat: Seat, m: WSMove, ctx: Pick<GameCtx, 'now'>): WSState | string {
  if (s.finishedAt !== null) return 'All found!';
  const cells = Array.isArray(m?.cells) ? m.cells : [];
  const key = cells.join(',');
  const back = cells.slice().reverse().join(',');
  const i = s.words.findIndex((w, k) => !s.found[k] && (w.cells.join(',') === key || w.cells.join(',') === back));
  if (i < 0) return 'Not one of the words';
  const found = s.found.map((f, k) => f || k === i);
  return { ...s, found, finishedAt: found.every(Boolean) ? ctx.now() : null };
}

export const activePlayers = (s: WSState): Seat[] => (s.finishedAt === null ? [0] : []);

export function result(s: WSState): GameResult | null {
  if (s.finishedAt === null) return null;
  const secs = Math.round((s.finishedAt - s.startedAt) / 1000);
  return { winners: [0], message: `All ${s.words.length} words in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} 🔎` };
}

export { upper };
