/**
 * Papaz Kaçtı: three of the four kings are taken out, so one king (the papaz) can never
 * be paired. Everyone throws away pairs, then takes turns drawing a blind card from the
 * next player. Whoever is left holding the papaz loses.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';
import { card, deck, rankOf, shuffle, type Card } from '../cards/cards';

const KING = 13;

export interface PapazState {
  n: number;
  hands: Card[][];
  turn: Seat;
  /** Card index (in the target's hand) the drawer is reaching for */
  pointing: number | null;
  discards: Card[][];
  /** Seats that got rid of all their cards, in order */
  out: Seat[];
  last: { drawer: Seat; target: Seat; card: Card; pair: number | null } | null;
  loser: Seat | null;
  papaz: Card;
}

export type PapazMove = { type: 'point'; index: number } | { type: 'draw'; index: number };

export interface PapazView {
  me: Seat;
  n: number;
  /** My cards, in the order the drawer sees them face down */
  hand: Card[];
  counts: number[];
  turn: Seat;
  target: Seat | null;
  pointing: number | null;
  out: Seat[];
  lastPair: Card[] | null;
  discardCount: number;
  last: { drawer: Seat; target: Seat; card: Card | null; pair: number | null } | null;
  loser: Seat | null;
  done: boolean;
  /** Revealed when the game ends */
  papaz: Card | null;
}

/** Throw away pairs of the same rank */
export function discardPairs(hand: Card[]): { hand: Card[]; pairs: Card[][] } {
  const byRank = new Map<number, Card[]>();
  for (const c of hand) byRank.set(rankOf(c), [...(byRank.get(rankOf(c)) ?? []), c]);
  const keep: Card[] = [];
  const pairs: Card[][] = [];
  for (const c of hand) {
    const group = byRank.get(rankOf(c))!;
    const paired = Math.floor(group.length / 2) * 2;
    const idx = group.indexOf(c);
    if (idx < paired) {
      if (idx % 2 === 1) pairs.push([group[idx - 1], c]);
    } else keep.push(c);
  }
  return { hand: keep, pairs };
}

const holding = (s: Pick<PapazState, 'hands'>) => s.hands.map((h, i) => (h.length ? i : -1)).filter((i) => i >= 0);

/** The next player (clockwise) who still has cards */
export function targetOf(s: Pick<PapazState, 'hands' | 'n'>, seat: Seat): Seat | null {
  for (let k = 1; k < s.n; k++) {
    const t = (seat + k) % s.n;
    if (s.hands[t].length) return t;
  }
  return null;
}

function nextTurn(s: Pick<PapazState, 'hands' | 'n'>, from: Seat): Seat {
  for (let k = 0; k < s.n; k++) {
    const t = (from + k) % s.n;
    if (s.hands[t].length) return t;
  }
  return from;
}

/** The holder "shuffles" their fan before each draw, so position tells you nothing */
function shuffleTarget(s: PapazState, random: () => number): PapazState {
  const t = targetOf(s, s.turn);
  if (t === null) return s;
  return { ...s, hands: s.hands.map((h, i) => (i === t ? shuffle(h, random) : h)) };
}

function settle(s: PapazState): PapazState {
  const left = holding(s);
  if (left.length <= 1) return { ...s, loser: left[0] ?? null, pointing: null };
  return s;
}

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'random'>): PapazState {
  const n = ctx.numPlayers;
  const keepSuit = Math.floor(ctx.random() * 4);
  const papaz = card(keepSuit, KING);
  const cards = shuffle(
    deck().filter((c) => rankOf(c) !== KING || c === papaz),
    ctx.random,
  );
  const raw: Card[][] = Array.from({ length: n }, () => []);
  cards.forEach((c, i) => raw[i % n].push(c));
  const discards: Card[][] = [];
  const hands = raw.map((h) => {
    const r = discardPairs(h);
    discards.push(...r.pairs);
    return shuffle(r.hand, ctx.random);
  });
  let s: PapazState = { n, hands, turn: 0, pointing: null, discards, out: [], last: null, loser: null, papaz };
  s.out = Array.from({ length: n }, (_, i) => i).filter((i) => !hands[i].length);
  s.turn = nextTurn(s, Math.floor(ctx.random() * n));
  s = settle(s);
  return s.loser === null ? shuffleTarget(s, ctx.random) : s;
}

export function move(s: PapazState, seat: Seat, m: PapazMove, ctx: Pick<GameCtx, 'random'>): PapazState | string {
  if (s.loser !== null || holding(s).length <= 1) return 'The game is over';
  if (seat !== s.turn) return 'Not your turn';
  const target = targetOf(s, seat);
  if (target === null) return 'Nobody to draw from';
  const th = s.hands[target];
  if (!Number.isInteger(m?.index) || m.index < 0 || m.index >= th.length) return 'Pick one of their cards';
  if (m.type === 'point') return { ...s, pointing: m.index };
  if (m.type !== 'draw') return 'Unknown move';

  const drawn = th[m.index];
  const targetHand = th.filter((_, i) => i !== m.index);
  const match = s.hands[seat].find((c) => rankOf(c) === rankOf(drawn));
  const myHand = match !== undefined ? s.hands[seat].filter((c) => c !== match) : [...s.hands[seat], drawn];
  const hands = s.hands.map((h, i) => (i === seat ? myHand : i === target ? targetHand : h));
  const discards = match !== undefined ? [...s.discards, [match, drawn]] : s.discards;
  const out = [...s.out];
  for (const x of [target, seat]) if (!hands[x].length && !out.includes(x)) out.push(x);
  let next: PapazState = {
    ...s,
    hands,
    discards,
    out,
    pointing: null,
    last: { drawer: seat, target, card: drawn, pair: match !== undefined ? rankOf(drawn) : null },
  };
  next = settle(next);
  if (next.loser !== null) return next;
  // The turn passes to the player who was just drawn from (or the next one with cards)
  next.turn = nextTurn(next, target);
  return shuffleTarget(next, ctx.random);
}

export function view(s: PapazState, seat: Seat): PapazView {
  const done = s.loser !== null;
  const l = s.last;
  return {
    me: seat,
    n: s.n,
    hand: s.hands[seat] ?? [],
    counts: s.hands.map((h) => h.length),
    turn: s.turn,
    target: done ? null : targetOf(s, s.turn),
    pointing: s.pointing,
    out: s.out,
    lastPair: s.discards.length ? s.discards[s.discards.length - 1] : null,
    discardCount: s.discards.length * 2,
    // Only the two players involved know which card moved (unless it made a pair)
    last: l ? { ...l, card: l.drawer === seat || l.target === seat || l.pair !== null ? l.card : null } : null,
    loser: s.loser,
    done,
    papaz: done ? s.papaz : null,
  };
}

export const activePlayers = (s: PapazState): Seat[] => (s.loser !== null ? [] : [s.turn]);

export function result(s: PapazState): GameResult | null {
  if (s.loser === null) return null;
  return { winners: Array.from({ length: s.n }, (_, i) => i).filter((i) => i !== s.loser) };
}

export function bot(v: PapazView, _seat: Seat, ctx: BotCtx): PapazMove {
  const count = v.target !== null ? v.counts[v.target] : 1;
  // Reach for a card first (so people can watch the hand hover), then take it
  if (v.pointing === null && ctx.level !== 'easy') return { type: 'point', index: Math.floor(ctx.random() * count) };
  if (v.pointing !== null && ctx.random() < 0.25 && count > 1 && ctx.level === 'hard') {
    // Change of heart
    return { type: 'draw', index: (v.pointing + 1 + Math.floor(ctx.random() * (count - 1))) % count };
  }
  return { type: 'draw', index: v.pointing ?? Math.floor(ctx.random() * count) };
}
