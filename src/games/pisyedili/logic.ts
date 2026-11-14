/**
 * Pis Yedili: the traditional Turkish shedding game with a normal deck. Match the top card's
 * suit or rank and be the first to run out. 7 makes the next player draw two (and 7s stack),
 * 8 skips the next player, 10 reverses direction, and a jack can go on anything and names a suit.
 * Card ids above 51 are a second deck (id % 52 is the card).
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';
import { rankOf, shuffle, suitOf, type Suit } from '../cards/cards';

export const HAND = 7;
export const face = (id: number) => id % 52;
export const rank = (id: number) => rankOf(face(id));
export const suit = (id: number) => suitOf(face(id));
const SPECIAL = new Set([7, 8, 10, 11]);

export interface PisState {
  n: number;
  mode: 'round' | 'points';
  target: number;
  hands: number[][];
  stock: number[];
  pile: number[];
  /** Suit to follow (a jack can change it) */
  suit: Suit;
  dir: 1 | -1;
  turn: Seat;
  /** Cards the current player must draw because of 7s, unless they add a 7 */
  penalty: number;
  drew: boolean;
  dealer: Seat;
  totals: number[];
  roundOver: boolean;
  roundWinner: Seat | null;
  roundPoints: number[] | null;
  over: boolean;
  last: { seat: Seat; kind: 'play' | 'draw' | 'pass'; card?: number; count?: number; suit?: Suit } | null;
}

export type PisMove = { type: 'play'; card: number; suit?: Suit } | { type: 'draw' } | { type: 'pass' } | { type: 'next' };

export interface PisView extends Omit<PisState, 'hands' | 'stock'> {
  me: Seat;
  hand: number[];
  counts: number[];
  stockCount: number;
  /** Everyone's hands once the round is over */
  shown: number[][] | null;
}

function deal(s: Omit<PisState, 'hands' | 'stock' | 'pile' | 'suit'>, random: () => number): PisState {
  const decks = s.n > 4 ? 2 : 1;
  let stock = shuffle(
    Array.from({ length: 52 * decks }, (_, i) => i),
    random,
  );
  const hands = Array.from({ length: s.n }, () => stock.splice(-HAND));
  // Start on a plain card
  const k = stock.findIndex((c) => !SPECIAL.has(rank(c)));
  const top = stock[k];
  stock = stock.filter((_, i) => i !== k);
  return { ...s, hands, stock, pile: [top], suit: suit(top), dir: 1, turn: (s.dealer + 1) % s.n, penalty: 0, drew: false, roundOver: false, roundWinner: null, roundPoints: null, last: null };
}

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'random' | 'options'>): PisState {
  const mode = ctx.options.mode === 'points' ? 'points' : 'round';
  return deal(
    { n: ctx.numPlayers, mode, target: Number(ctx.options.target ?? 101), dir: 1, turn: 0, penalty: 0, drew: false, dealer: ctx.numPlayers - 1, totals: Array(ctx.numPlayers).fill(0), roundOver: false, roundWinner: null, roundPoints: null, over: false, last: null },
    ctx.random,
  );
}

export const top = (s: Pick<PisState, 'pile'>) => s.pile[s.pile.length - 1];

export function canPlay(s: Pick<PisState, 'pile' | 'suit' | 'penalty'>, card: number) {
  if (s.penalty > 0) return rank(card) === 7;
  return rank(card) === 11 || suit(card) === s.suit || rank(card) === rank(top(s));
}

/** Points a card left in hand costs at the end of a round */
export function cardPoints(card: number) {
  const r = rank(card);
  if (r === 11) return 25;
  if (r === 7) return 20;
  if (r === 14) return 11;
  return Math.min(r, 10);
}

const step = (s: PisState, from: Seat, k = 1) => (((from + s.dir * k) % s.n) + s.n) % s.n;

function drawCards(s: PisState, seat: Seat, count: number, random: () => number) {
  let stock = [...s.stock];
  let pile = [...s.pile];
  const got: number[] = [];
  for (let k = 0; k < count; k++) {
    if (!stock.length && pile.length > 1) {
      stock = shuffle(pile.slice(0, -1), random);
      pile = pile.slice(-1);
    }
    if (!stock.length) break;
    got.push(stock.pop()!);
  }
  return { stock, pile, hands: s.hands.map((h, i) => (i === seat ? [...h, ...got] : h)), got };
}

function endRound(s: PisState, winner: Seat): PisState {
  const roundPoints = s.hands.map((h) => h.reduce((a, c) => a + cardPoints(c), 0));
  const totals = s.totals.map((t, i) => t + roundPoints[i]);
  const over = s.mode === 'round' || totals.some((t) => t >= s.target);
  return { ...s, totals, roundOver: true, roundWinner: winner, roundPoints, over };
}

export function move(s: PisState, seat: Seat, m: PisMove, ctx: Pick<GameCtx, 'random'>): PisState | string {
  if (s.over) return 'Game over';
  if (s.roundOver) {
    if (m?.type !== 'next') return 'The round is over';
    return deal({ ...s, dealer: (s.dealer + 1) % s.n }, ctx.random);
  }
  if (seat !== s.turn) return 'Not your turn';
  if (m?.type === 'draw') {
    if (s.penalty > 0) {
      const d = drawCards(s, seat, s.penalty, ctx.random);
      return { ...s, ...d, penalty: 0, drew: false, turn: step(s, seat), last: { seat, kind: 'draw', count: d.got.length } };
    }
    if (s.drew) return 'You already drew: play the card or pass';
    const d = drawCards(s, seat, 1, ctx.random);
    // Nothing left to draw: the turn passes
    if (!d.got.length) return { ...s, drew: false, turn: step(s, seat), last: { seat, kind: 'pass' } };
    return { ...s, ...d, drew: true, last: { seat, kind: 'draw', count: 1 } };
  }
  if (m?.type === 'pass') {
    if (!s.drew) return 'Draw a card first';
    return { ...s, drew: false, turn: step(s, seat), last: { seat, kind: 'pass' } };
  }
  if (m?.type !== 'play') return 'Play a card or draw';
  const hand = s.hands[seat];
  if (!hand.includes(m.card)) return 'That card isn’t in your hand';
  if (!canPlay(s, m.card)) return s.penalty > 0 ? 'Play a 7 or take the cards' : 'That card doesn’t match';
  const r = rank(m.card);
  if (r === 11 && (m.suit === undefined || ![0, 1, 2, 3].includes(m.suit))) return 'Name a suit for the jack';
  const rest = hand.filter((c) => c !== m.card);
  let next: PisState = {
    ...s,
    hands: s.hands.map((h, i) => (i === seat ? rest : h)),
    pile: [...s.pile, m.card],
    suit: r === 11 ? m.suit! : suit(m.card),
    drew: false,
    last: { seat, kind: 'play', card: m.card, suit: r === 11 ? m.suit : undefined },
  };
  if (!rest.length) return endRound(next, seat);
  if (r === 7) next = { ...next, penalty: s.penalty + 2, turn: step(next, seat) };
  else if (r === 8) next = { ...next, turn: step(next, seat, 2) };
  else if (r === 10) {
    const dir = (s.dir * -1) as 1 | -1;
    next = { ...next, dir };
    // With two players a reverse works like a skip
    next = { ...next, turn: s.n === 2 ? seat : step(next, seat) };
  } else next = { ...next, turn: step(next, seat) };
  return next;
}

export function activePlayers(s: PisState): Seat[] {
  if (s.over) return [];
  if (s.roundOver) return [s.roundWinner ?? 0];
  return [s.turn];
}

export function view(s: PisState, seat: Seat): PisView {
  const { hands, stock, ...rest } = s;
  return { ...rest, me: seat, hand: hands[seat] ?? [], counts: hands.map((h) => h.length), stockCount: stock.length, shown: s.roundOver ? hands : null };
}

export function result(s: PisState): GameResult | null {
  if (!s.over) return null;
  if (s.mode === 'round') return { winners: [s.roundWinner!] };
  const best = Math.min(...s.totals);
  return { winners: s.totals.flatMap((t, i) => (t === best ? [i] : [])) };
}

export function bot(v: PisView, _seat: Seat, ctx: BotCtx): PisMove {
  if (v.roundOver) return { type: 'next' };
  const options = v.hand.filter((c) => canPlay(v, c));
  if (!options.length) return v.drew ? { type: 'pass' } : { type: 'draw' };
  const nextSeat = (((v.me + v.dir) % v.n) + v.n) % v.n;
  const nextLow = v.counts[nextSeat] <= 2;
  const bySuit = [0, 1, 2, 3].map((st) => v.hand.filter((c) => suit(c) === st && rank(c) !== 11).length);
  const favorite = bySuit.indexOf(Math.max(...bySuit)) as Suit;
  const pick = (c: number): PisMove => (rank(c) === 11 ? { type: 'play', card: c, suit: favorite } : { type: 'play', card: c });
  if (ctx.level === 'easy') return pick(options[Math.floor(ctx.random() * options.length)]);
  const score = (c: number) => {
    const r = rank(c);
    let x = 10 + cardPoints(c) / 5;
    if (r === 11) x -= 12; // keep jacks for when nothing else fits
    if ((r === 7 || r === 8) && nextLow) x += ctx.level === 'hard' ? 12 : 6;
    if (r === 7 && ctx.level === 'hard') x += 3;
    if (suit(c) === favorite) x += 1;
    return x;
  };
  return pick([...options].sort((a, b) => score(b) - score(a))[0]);
}
