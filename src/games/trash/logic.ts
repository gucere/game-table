import type { BotCtx, GameCtx, GameResult } from '../../engine/types';
import { rankOf, shuffle } from '../cards/cards';

export interface TrashState {
  n: number; stock: number[]; discard: number[]; layouts: number[][]; open: boolean[][];
  sizes: number[]; turn: number; held: number | null; phase: 'draw' | 'place' | 'round' | 'done';
  round: number; roundWinner: number | null; winner: number | null; goal: number; wild: number;
}
export interface TrashView extends Omit<TrashState, 'stock' | 'layouts'> { stockCount: number; layouts: (number | null)[][] }
export type TrashMove = { type: 'draw'; source: 'stock' | 'discard' } | { type: 'place'; slot: number } | { type: 'discard' } | { type: 'next' };
const value = (card: number) => rankOf(card) === 14 ? 1 : rankOf(card);

function deal(s: TrashState, random: () => number): TrashState {
  const stock = shuffle(Array.from({ length: Math.ceil(s.n / 2) * 52 }, (_, i) => i), random);
  const layouts = s.sizes.map((size) => stock.splice(-size));
  return { ...s, stock, layouts, open: s.sizes.map((size) => Array(size).fill(false)), discard: [], held: null, phase: 'draw', roundWinner: null };
}
export function setup(ctx: GameCtx): TrashState {
  const n = ctx.numPlayers;
  return deal({ n, stock: [], discard: [], layouts: [], open: [], sizes: Array(n).fill(10), turn: 0,
    held: null, phase: 'draw', round: 1, roundWinner: null, winner: null,
    goal: ctx.options.length === 'single' ? 9 : ctx.options.length === 'quick' ? 6 : 0,
    wild: ctx.options.wild === 'king' ? 13 : 11 }, ctx.random);
}
export function slots(s: Pick<TrashView, 'layouts' | 'open' | 'wild'>, seat: number, card: number): number[] {
  return s.layouts[seat].flatMap((current, i) => {
    if (rankOf(card) === s.wild) return !s.open[seat][i] ? [i] : [];
    return value(card) === i + 1 && (!s.open[seat][i] || (current !== null && rankOf(current) === s.wild)) ? [i] : [];
  });
}
export const activePlayers = (s: TrashState) => s.phase === 'done' ? [] : [s.turn];
export function view(s: TrashState): TrashView {
  const { stock, layouts, ...rest } = s;
  return { ...rest, stockCount: stock.length, layouts: layouts.map((row, seat) => row.map((c, i) => s.open[seat][i] ? c : null)) };
}
export function move(s: TrashState, seat: number, m: TrashMove, ctx: GameCtx): TrashState | string {
  if (seat !== s.turn || s.phase === 'done') return 'Not your turn';
  if (m.type === 'next') return s.phase === 'round' ? deal({ ...s, round: s.round + 1 }, ctx.random) : 'Finish this round first';
  if (m.type === 'draw') {
    if (s.phase !== 'draw') return 'Place or discard your card first';
    const stock = [...s.stock], discard = [...s.discard];
    if (m.source === 'discard') {
      if (!discard.length || !slots(s, seat, discard[discard.length - 1]).length) return 'That card cannot be placed';
      return { ...s, discard: discard.slice(0, -1), held: discard[discard.length - 1], phase: 'place' };
    }
    if (m.source !== 'stock') return 'Choose a draw pile';
    if (!stock.length && discard.length > 1) stock.push(...shuffle(discard.splice(0, discard.length - 1), ctx.random));
    if (!stock.length) return 'The stock is empty; take the discard';
    return { ...s, stock: stock.slice(0, -1), discard, held: stock[stock.length - 1], phase: 'place' };
  }
  if (s.phase !== 'place' || s.held === null) return 'Draw a card first';
  const available = slots(s, seat, s.held);
  if (m.type === 'discard') {
    if (available.length) return 'Place your card in an available slot';
    return { ...s, discard: [...s.discard, s.held], held: null, phase: 'draw', turn: (seat + 1) % s.n };
  }
  if (m.type !== 'place' || !Number.isInteger(m.slot) || !available.includes(m.slot)) return 'Choose a matching slot';
  const layouts = s.layouts.map((row) => [...row]), open = s.open.map((row) => [...row]);
  const held = layouts[seat][m.slot];
  layouts[seat][m.slot] = s.held; open[seat][m.slot] = true;
  const next = { ...s, layouts, open, held };
  if (open[seat].every(Boolean)) {
    const sizes = [...s.sizes]; sizes[seat]--;
    const won = sizes[seat] <= s.goal;
    return { ...next, sizes, held: null, discard: [...s.discard, held], roundWinner: seat, winner: won ? seat : null, phase: won ? 'done' : 'round' };
  }
  return next;
}
export const result = (s: TrashState): GameResult | null => s.winner === null ? null : { winners: [s.winner] };
export function bot(v: TrashView, seat: number, ctx: BotCtx): TrashMove {
  if (v.phase === 'round') return { type: 'next' };
  if (v.phase === 'draw') return { type: 'draw', source: v.discard.length && slots(v, seat, v.discard[v.discard.length - 1]).length ? 'discard' : 'stock' };
  const available = v.held === null ? [] : slots(v, seat, v.held);
  return available.length ? { type: 'place', slot: available[Math.floor(ctx.random() * available.length)] } : { type: 'discard' };
}
