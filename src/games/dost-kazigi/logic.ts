import type { BotCtx, GameCtx, GameResult } from '../../engine/types';
import { deck, rankOf, shuffle, type Card } from '../cards/cards';
export interface DostState {
  n: number; stock: Card[]; hands: Card[][]; table: Card[]; piles: Card[][]; turn: number;
  round: number; rounds: number; scores: number[]; phase: 'play' | 'round' | 'done';
}
export interface DostView extends Omit<DostState, 'stock' | 'hands'> { stockCount: number; hand: Card[]; handCounts: number[] }
export type Source = { kind: 'table'; index: number } | { kind: 'pile'; seat: number };
export type DostMove = { type: 'play'; card: Card; source?: Source; target?: number } | { type: 'next' };
export const penalty = (c: Card) => rankOf(c) === 3 ? 30 : rankOf(c) === 11 ? 20 : rankOf(c) >= 12 ? 10 : rankOf(c);
export const pileScore = (pile: Card[]) => pile.reduce((sum, c) => sum + penalty(c), 0);
function refill(s: DostState): DostState {
  const stock = [...s.stock], hands = s.hands.map((h) => [...h]);
  for (let k = 0; k < 4; k++) for (let p = 0; p < s.n && stock.length; p++) hands[p].push(stock.pop()!);
  return { ...s, stock, hands };
}
function deal(s: DostState, random: () => number): DostState {
  const stock = shuffle(deck(), random);
  return refill({ ...s, stock, table: stock.splice(-4), hands: Array.from({ length: s.n }, () => []), piles: Array.from({ length: s.n }, () => []), turn: (s.round - 1) % s.n, phase: 'play' });
}
export function setup(ctx: GameCtx): DostState {
  return deal({ n: ctx.numPlayers, stock: [], hands: [], table: [], piles: [], turn: 0, round: 1,
    rounds: ['1', '3', '5'].includes(ctx.options.rounds) ? Number(ctx.options.rounds) : 1, scores: Array(ctx.numPlayers).fill(0), phase: 'play' }, ctx.random);
}
export function targets(s: Pick<DostState, 'n'>, seat: number, source: Source): number[] {
  return Array.from({ length: s.n }, (_, i) => i).filter((i) => i !== seat && (source.kind !== 'pile' || i !== source.seat));
}
export function sources(s: Pick<DostState, 'n' | 'table' | 'piles'>, seat: number, card: Card): Source[] {
  const rank = rankOf(card);
  const matches: Source[] = s.table.flatMap((c, index) => rankOf(c) === rank ? [{ kind: 'table' as const, index }] : []);
  s.piles.forEach((pile, p) => { if (pile.length && rankOf(pile[pile.length - 1]) === rank && targets(s, seat, { kind: 'pile', seat: p }).length) matches.push({ kind: 'pile', seat: p }); });
  return matches;
}
export const activePlayers = (s: DostState) => s.phase === 'done' ? [] : [s.turn];
export function view(s: DostState, seat: number): DostView {
  const { stock, hands, ...rest } = s;
  return { ...rest, stockCount: stock.length, hand: [...hands[seat]], handCounts: hands.map((h) => h.length) };
}
export function move(s: DostState, seat: number, m: DostMove, ctx: GameCtx): DostState | string {
  if (seat !== s.turn || s.phase === 'done') return 'Not your turn';
  if (m.type === 'next') return s.phase === 'round' ? deal({ ...s, round: s.round + 1 }, ctx.random) : 'Finish this round first';
  if (m.type !== 'play' || s.phase !== 'play' || !s.hands[seat].includes(m.card)) return 'Choose a card from your hand';
  const matches = sources(s, seat, m.card);
  const mustMatch = s.hands[seat].some((c) => sources(s, seat, c).length > 0);
  if (mustMatch && !matches.length) return 'You must use an available match';
  const next: DostState = { ...s, hands: s.hands.map((h) => [...h]), table: [...s.table], piles: s.piles.map((p) => [...p]) };
  next.hands[seat].splice(next.hands[seat].indexOf(m.card), 1);
  if (matches.length) {
    const source = matches.find((source) => source.kind === m.source?.kind && (source.kind === 'table' ? source.index === (m.source as { index: number }).index : source.seat === (m.source as { seat: number }).seat));
    if (!source || m.target === undefined || !targets(s, seat, source).includes(m.target)) return 'Choose a matching source and another player';
    const captured: Card[] = [];
    if (source.kind === 'table') captured.push(...next.table.splice(source.index, 1));
    else {
      const pile = next.piles[source.seat];
      while (pile.length && rankOf(pile[pile.length - 1]) === rankOf(m.card)) captured.unshift(pile.pop()!);
    }
    next.piles[m.target].push(...captured, m.card);
  } else {
    if (m.source || m.target !== undefined) return 'This card has no matching source';
    next.table.push(m.card);
  }
  if (next.hands.every((h) => !h.length)) {
    if (next.stock.length) return refill({ ...next, turn: (seat + 1) % s.n });
    next.scores = next.scores.map((score, i) => score + pileScore(next.piles[i]));
    next.phase = s.round >= s.rounds ? 'done' : 'round';
    next.turn = 0;
  } else {
    do { next.turn = (next.turn + 1) % s.n; } while (!next.hands[next.turn].length);
  }
  return next;
}
export const result = (s: DostState): GameResult | null => s.phase === 'done' ? { winners: s.scores.flatMap((score, i) => score === Math.min(...s.scores) ? [i] : []) } : null;
export function bot(v: DostView, seat: number, ctx: BotCtx): DostMove {
  if (v.phase === 'round') return { type: 'next' };
  const moves = v.hand.flatMap((card) => sources(v, seat, card).flatMap((source) => targets(v, seat, source).map((target) => ({ type: 'play' as const, card, source, target }))));
  if (moves.length) {
    if (ctx.level === 'easy') return moves[Math.floor(ctx.random() * moves.length)];
    return moves.sort((a, b) => {
      const score = (m: typeof a) => (m.source.kind === 'pile' && m.source.seat === seat ? 200 : 0) + penalty(m.card) - v.scores[m.target] - pileScore(v.piles[m.target]);
      return score(b) - score(a);
    })[0];
  }
  return { type: 'play', card: [...v.hand].sort((a, b) => penalty(a) - penalty(b))[0] };
}
