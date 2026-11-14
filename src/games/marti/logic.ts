/**
 * Martı: a one-tap flying game. The flight itself runs in the browser (see sim.ts);
 * the game engine only records each player's score, so friends can race on the
 * same course (same seed) online or take turns on one device.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';

export interface MartiState {
  n: number;
  seed: number;
  scores: (number | null)[];
  /** Character each player flew with (cosmetic) */
  chars: (string | null)[];
}

export type MartiMove = { type: 'score'; n: number; char?: string };

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'random'>): MartiState {
  return { n: ctx.numPlayers, seed: Math.floor(ctx.random() * 2 ** 31), scores: Array(ctx.numPlayers).fill(null), chars: Array(ctx.numPlayers).fill(null) };
}

export function move(s: MartiState, seat: Seat, m: MartiMove): MartiState | string {
  if (m?.type !== 'score' || !Number.isInteger(m.n) || m.n < 0 || m.n > 100000) return 'Bad score';
  if (s.scores[seat] !== null) return 'Already flown';
  const scores = s.scores.slice();
  scores[seat] = m.n;
  const chars = (s.chars ?? s.scores.map(() => null)).slice();
  chars[seat] = typeof m.char === 'string' ? m.char.slice(0, 20) : null;
  return { ...s, scores, chars };
}

export const activePlayers = (s: MartiState): Seat[] => s.scores.map((x, i) => (x === null ? i : -1)).filter((i) => i >= 0);

export function result(s: MartiState): GameResult | null {
  if (s.scores.some((x) => x === null)) return null;
  const sc = s.scores as number[];
  if (s.n === 1) return { winners: [0], message: `Score: ${sc[0]} 🐦` };
  const best = Math.max(...sc);
  return { winners: sc.map((x, i) => (x === best ? i : -1)).filter((i) => i >= 0) };
}

/** Bots don't fly; they post a believable score for their level */
export function bot(_s: MartiState, _seat: Seat, ctx: BotCtx): MartiMove {
  const [lo, hi] = { easy: [2, 10], normal: [6, 22], hard: [15, 45] }[ctx.level];
  const chars = ['marti', 'guvercin', 'leylek', 'papagan', 'karga', 'kanarya', 'hazerfen'];
  return { type: 'score', n: lo + Math.floor(ctx.random() * (hi - lo + 1)), char: chars[Math.floor(ctx.random() * chars.length)] };
}
