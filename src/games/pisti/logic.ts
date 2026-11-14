/**
 * Pişti: the Turkish fishing card game.
 * Play a card on the pile. Match the top card's rank, or play a jack, to take the whole pile.
 * Taking a single card by matching it is a pişti (10 points, or 20 for jack on jack).
 * After the deal: A and J are 1 point each, 2♣ is 2, 10♦ is 3, and most cards is 3.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';
import { card, deck, rankOf, shuffle, type Card } from '../cards/cards';

const JACK = 11;
const TWO_CLUBS = card(2, 2);
const TEN_DIAMONDS = card(3, 10);

export function cardPoints(c: Card) {
  if (c === TEN_DIAMONDS) return 3;
  if (c === TWO_CLUBS) return 2;
  const r = rankOf(c);
  return r === 14 || r === JACK ? 1 : 0;
}

export interface DealScore {
  cards: number[];
  points: number[];
  pisti: number[];
  most: number[];
  total: number[];
}

export interface PistiState {
  n: number;
  teams: boolean;
  /** 0 = a single deal, otherwise play deals until a side reaches this */
  target: number;
  dealer: Seat;
  dealNo: number;
  stock: Card[];
  pile: Card[];
  /** The first cards on the table are face down */
  hiddenInPile: number;
  hands: Card[][];
  turn: Seat;
  captured: Card[][];
  pisti: number[];
  lastCapturer: Seat | null;
  /** Face-up cards everyone has seen this deal */
  seen: Card[];
  last: { seat: Seat; card: Card; took: number; pisti: number } | null;
  /** Scores per side (player, or team when playing in pairs) */
  scores: number[];
  history: DealScore[];
  phase: 'play' | 'done';
}

export type PistiMove = { type: 'play'; card: Card };

export interface PistiView {
  me: Seat;
  n: number;
  teams: boolean;
  target: number;
  hand: Card[];
  handCounts: number[];
  /** The pile's top card (always face up) */
  top: Card | null;
  pileCount: number;
  stockCount: number;
  turn: Seat;
  capturedCounts: number[];
  pisti: number[];
  last: PistiState['last'];
  seen: Card[];
  scores: number[];
  history: DealScore[];
  dealNo: number;
  phase: PistiState['phase'];
}

export const sideOf = (s: Pick<PistiState, 'teams'>, seat: Seat) => (s.teams ? seat % 2 : seat);
export const sideCount = (s: Pick<PistiState, 'teams' | 'n'>) => (s.teams ? 2 : s.n);

function deal(s: PistiState, random: () => number): PistiState {
  let cards = shuffle(deck(), random);
  // Four on the table: three face down, the top one face up (never a jack)
  let tableTop = cards[3];
  while (rankOf(tableTop) === JACK) {
    cards = [...cards.slice(0, 3), ...cards.slice(4), tableTop];
    tableTop = cards[3];
  }
  const pile = cards.slice(0, 4);
  let stock = cards.slice(4);
  const hands: Card[][] = [];
  for (let i = 0; i < s.n; i++) {
    hands.push(stock.slice(0, 4));
    stock = stock.slice(4);
  }
  return {
    ...s,
    stock,
    pile,
    hiddenInPile: 3,
    hands,
    turn: ((s.dealer + 1) % s.n) as Seat,
    captured: hands.map(() => []),
    pisti: hands.map(() => 0),
    lastCapturer: null,
    seen: [tableTop],
    last: null,
    phase: 'play',
  };
}

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'random' | 'options'>): PistiState {
  const n = ctx.numPlayers;
  const teams = n === 4 && ctx.options.teams !== 'solo';
  const target = Number(ctx.options.target ?? 101) || 0;
  const base: PistiState = {
    n,
    teams,
    target,
    dealer: Math.floor(ctx.random() * n),
    dealNo: 0,
    stock: [],
    pile: [],
    hiddenInPile: 0,
    hands: [],
    turn: 0,
    captured: [],
    pisti: [],
    lastCapturer: null,
    seen: [],
    last: null,
    scores: Array(teams ? 2 : n).fill(0),
    history: [],
    phase: 'play',
  };
  return deal(base, ctx.random);
}

export function scoreDeal(s: PistiState): DealScore {
  const k = sideCount(s);
  const cards = Array(k).fill(0);
  const points = Array(k).fill(0);
  const pisti = Array(k).fill(0);
  for (let seat = 0; seat < s.n; seat++) {
    const side = sideOf(s, seat);
    cards[side] += s.captured[seat].length;
    points[side] += s.captured[seat].reduce((a, c) => a + cardPoints(c), 0);
    pisti[side] += s.pisti[seat];
  }
  const max = Math.max(...cards);
  const most = cards.map((c) => (c === max && cards.filter((x) => x === max).length === 1 ? 3 : 0));
  const total = cards.map((_, i) => points[i] + pisti[i] + most[i]);
  return { cards, points, pisti, most, total };
}

function endDeal(s: PistiState, random: () => number): PistiState {
  // Leftover cards on the table go to whoever took last
  let captured = s.captured;
  if (s.pile.length && s.lastCapturer !== null) {
    captured = captured.map((c, i) => (i === s.lastCapturer ? [...c, ...s.pile] : c));
  }
  const settled = { ...s, captured, pile: [], hiddenInPile: 0 };
  const sc = scoreDeal(settled);
  const scores = s.scores.map((x, i) => x + sc.total[i]);
  const history = [...s.history, sc];
  const best = Math.max(...scores);
  const leaders = scores.filter((x) => x === best).length;
  const over = s.target === 0 || (best >= s.target && leaders === 1);
  const next: PistiState = { ...settled, scores, history, dealNo: s.dealNo + 1 };
  if (over) return { ...next, phase: 'done' };
  return deal({ ...next, dealer: ((s.dealer + 1) % s.n) as Seat }, random);
}

export function move(s: PistiState, seat: Seat, m: PistiMove, ctx: Pick<GameCtx, 'random'>): PistiState | string {
  if (s.phase === 'done') return 'The game is over';
  if (seat !== s.turn) return 'Not your turn';
  if (m?.type !== 'play' || !s.hands[seat].includes(m.card)) return 'Play a card from your hand';
  const c = m.card;
  const hands = s.hands.map((h, i) => (i === seat ? h.filter((x) => x !== c) : h));
  const top = s.pile.length ? s.pile[s.pile.length - 1] : null;
  const takes = top !== null && (rankOf(c) === rankOf(top) || rankOf(c) === JACK);
  let next: PistiState;
  if (takes) {
    const isPisti = s.pile.length === 1 && rankOf(c) === rankOf(top!);
    const bonus = isPisti ? (rankOf(c) === JACK ? 20 : 10) : 0;
    const taken = [...s.pile, c];
    next = {
      ...s,
      hands,
      pile: [],
      hiddenInPile: 0,
      captured: s.captured.map((x, i) => (i === seat ? [...x, ...taken] : x)),
      pisti: s.pisti.map((x, i) => (i === seat ? x + bonus : x)),
      lastCapturer: seat,
      seen: [...s.seen, c],
      last: { seat, card: c, took: taken.length, pisti: bonus },
    };
  } else {
    next = { ...s, hands, pile: [...s.pile, c], seen: [...s.seen, c], last: { seat, card: c, took: 0, pisti: 0 } };
  }
  next.turn = ((seat + 1) % s.n) as Seat;
  if (next.hands.every((h) => h.length === 0)) {
    if (next.stock.length >= s.n * 4) {
      let stock = next.stock;
      const newHands: Card[][] = [];
      for (let i = 0; i < s.n; i++) {
        newHands.push(stock.slice(0, 4));
        stock = stock.slice(4);
      }
      next = { ...next, hands: newHands, stock };
    } else {
      return endDeal(next, ctx.random);
    }
  }
  return next;
}

export function view(s: PistiState, seat: Seat): PistiView {
  return {
    me: seat,
    n: s.n,
    teams: s.teams,
    target: s.target,
    hand: s.hands[seat] ?? [],
    handCounts: s.hands.map((h) => h.length),
    top: s.pile.length ? s.pile[s.pile.length - 1] : null,
    pileCount: s.pile.length,
    stockCount: s.stock.length,
    turn: s.turn,
    capturedCounts: s.captured.map((c) => c.length),
    pisti: s.pisti,
    last: s.last,
    seen: s.seen,
    scores: s.scores,
    history: s.history,
    dealNo: s.dealNo,
    phase: s.phase,
  };
}

export const activePlayers = (s: PistiState): Seat[] => (s.phase === 'done' ? [] : [s.turn]);

export function result(s: PistiState): GameResult | null {
  if (s.phase !== 'done') return null;
  const best = Math.max(...s.scores);
  const sides = s.scores.map((x, i) => (x === best ? i : -1)).filter((i) => i >= 0);
  const winners = Array.from({ length: s.n }, (_, seat) => seat).filter((seat) => sides.includes(sideOf(s, seat)));
  if (winners.length === s.n) return { winners: [], draw: true };
  return { winners };
}

// ------------------------------------------------------------- bot

export function bot(v: PistiView, _seat: Seat, ctx: BotCtx): PistiMove {
  const r = ctx.random;
  const hand = v.hand;
  if (ctx.level === 'easy' && r() < 0.3) return { type: 'play', card: hand[Math.floor(r() * hand.length)] };
  const top = v.top;
  const jacks = hand.filter((c) => rankOf(c) === JACK);
  const value = (c: Card) => cardPoints(c) * 3 + (rankOf(c) === JACK ? 6 : 0);

  if (top !== null) {
    const match = hand.filter((c) => rankOf(c) === rankOf(top));
    if (match.length) {
      // Prefer matching a non-jack so the jack stays in hand
      const nonJ = match.filter((c) => rankOf(c) !== JACK);
      return { type: 'play', card: (nonJ.length ? nonJ : match)[0] };
    }
    const endgame = v.stockCount === 0 && hand.length <= 2;
    const worth = v.pileCount >= (ctx.level === 'hard' ? 3 : 2) || cardPoints(top) >= 2 || endgame;
    if (jacks.length && worth) return { type: 'play', card: jacks[0] };
  }

  // Nothing to take: play the card the next players are least likely to match
  const known = (rank: number) => v.seen.filter((c) => rankOf(c) === rank).length + hand.filter((c) => rankOf(c) === rank).length;
  const options = hand.filter((c) => rankOf(c) !== JACK || hand.every((x) => rankOf(x) === JACK));
  const pool = options.length ? options : hand;
  const risk = (c: Card) => {
    const unknown = 4 - known(rankOf(c));
    // An empty pile risks a pişti; a big pile makes any match costly
    const stake = top === null ? 10 : 1 + v.pileCount * 0.5;
    return unknown * stake + value(c) * (top === null ? 0.3 : 1);
  };
  const best = pool.slice().sort((a, b) => risk(a) - risk(b))[0];
  return { type: 'play', card: best };
}
