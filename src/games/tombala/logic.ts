/**
 * Tombala: Turkish bingo, the New Year's Eve classic.
 * Each card has 15 numbers in 3 rows (5 per row, 9 columns: 1–9, 10–19 … 80–90).
 * Numbers are drawn from the bag one by one. The first to fill a row calls 1. çinko,
 * the first with two full rows calls 2. çinko, and the first with all 15 calls TOMBALA!
 */
import type { GameCtx, GameResult, Seat } from '../../engine/types';
import { shuffle } from '../cards/cards';

export type TCard = (number | null)[][];
export type Prize = 'cinko1' | 'cinko2' | 'tombala';
export const PRIZES: Prize[] = ['cinko1', 'cinko2', 'tombala'];
export const PRIZE_NAMES: Record<Prize, string> = { cinko1: '1. Çinko', cinko2: '2. Çinko', tombala: 'TOMBALA' };
const ROWS_NEEDED: Record<Prize, number> = { cinko1: 1, cinko2: 2, tombala: 3 };

export interface TombalaState {
  n: number;
  cards: TCard[];
  bag: number[];
  drawn: number[];
  winners: Record<Prize, Seat | null>;
  intervalMs: number;
  deadline: number | null;
  phase: 'play' | 'done';
}

export type TombalaMove = { type: 'claim' };
export type TombalaView = TombalaState & { me: Seat; claimable: Prize | null };

const colRange = (c: number) => (c === 0 ? [1, 9] : c === 8 ? [80, 90] : [c * 10, c * 10 + 9]);

export function makeCard(random: () => number): TCard {
  // Pick 5 columns per row so that every column gets at least one number
  for (;;) {
    const rows = [0, 1, 2].map(() => shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8], random).slice(0, 5).sort((a, b) => a - b));
    const used = new Set(rows.flat());
    if (used.size < 9) continue;
    const card: TCard = rows.map(() => Array(9).fill(null));
    for (let c = 0; c < 9; c++) {
      const inCol = [0, 1, 2].filter((r) => rows[r].includes(c));
      const [lo, hi] = colRange(c);
      const pool = shuffle(
        Array.from({ length: hi - lo + 1 }, (_, i) => lo + i),
        random,
      )
        .slice(0, inCol.length)
        .sort((a, b) => a - b);
      inCol.forEach((r, k) => (card[r][c] = pool[k]));
    }
    return card;
  }
}

export const fullRows = (card: TCard, drawn: number[]) => {
  const set = new Set(drawn);
  return card.filter((row) => row.every((x) => x === null || set.has(x))).length;
};

export const nextPrize = (s: Pick<TombalaState, 'winners'>): Prize | null => PRIZES.find((p) => s.winners[p] === null) ?? null;

export function canClaim(s: TombalaState, seat: Seat): Prize | null {
  const p = nextPrize(s);
  if (!p || s.phase !== 'play') return null;
  return fullRows(s.cards[seat], s.drawn) >= ROWS_NEEDED[p] ? p : null;
}

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'random' | 'options' | 'now'>): TombalaState {
  const intervalMs = Number(ctx.options.speed ?? 4) * 1000;
  return {
    n: ctx.numPlayers,
    cards: Array.from({ length: ctx.numPlayers }, () => makeCard(ctx.random)),
    bag: shuffle(
      Array.from({ length: 90 }, (_, i) => i + 1),
      ctx.random,
    ),
    drawn: [],
    winners: { cinko1: null, cinko2: null, tombala: null },
    intervalMs,
    // A moment to look at your card before the first number
    deadline: ctx.now() + 3000,
    phase: 'play',
  };
}

export function activePlayers(s: TombalaState): Seat[] {
  return Array.from({ length: s.n }, (_, i) => i).filter((i) => canClaim(s, i) !== null);
}

export function move(s: TombalaState, seat: Seat, m: TombalaMove): TombalaState | string {
  if (m?.type !== 'claim') return 'Unknown move';
  const p = canClaim(s, seat);
  if (!p) return 'Nothing to claim yet';
  const winners = { ...s.winners, [p]: seat };
  return p === 'tombala' ? { ...s, winners, phase: 'done', deadline: null } : { ...s, winners };
}

export function onTimer(s: TombalaState, ctx: GameCtx): TombalaState {
  if (s.phase !== 'play') return s;
  if (!s.bag.length) return { ...s, phase: 'done', deadline: null };
  return { ...s, drawn: [...s.drawn, s.bag[0]], bag: s.bag.slice(1), deadline: ctx.now() + s.intervalMs };
}

export function view(s: TombalaState, seat: Seat): TombalaView {
  // Nothing is secret, except what's still in the bag
  return { ...s, bag: [], me: seat, claimable: canClaim(s, seat) };
}

export function result(s: TombalaState): GameResult | null {
  if (s.phase !== 'done') return null;
  const w = s.winners.tombala;
  return w === null ? { winners: [], draw: true, message: 'The bag is empty!' } : { winners: [w] };
}

export function bot(): TombalaMove {
  return { type: 'claim' };
}
