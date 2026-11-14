/**
 * Spades: four players in two partnerships (sitting opposite). Spades are always trump.
 * Everyone bids how many tricks they'll take (0 = nil); partners add their bids.
 * Make the team bid: 10 per trick bid, +1 per extra trick ("bag"); miss it: −10 per trick bid.
 * Nil: +100 if that player takes no tricks, −100 otherwise. Every 10 bags cost 100.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';
import { deck, rankOf, shuffle, suitOf, type Card } from '../cards/cards';
import { trickWinner, type Play } from '../batak/engine';

const SPADE = 0;

export interface SpadesState {
  hands: Card[][];
  phase: 'bid' | 'play' | 'done';
  dealer: Seat;
  bids: (number | null)[];
  trick: Play[];
  lastTrick: { plays: Play[]; winner: Seat } | null;
  turn: Seat;
  tricks: number[];
  broken: boolean;
  scores: [number, number];
  bags: [number, number];
  history: { delta: [number, number]; bids: number[]; tricks: number[] }[];
  target: number;
}
export type SpadesMove = { type: 'bid'; n: number } | { type: 'play'; card: Card };
export interface SpadesView extends Omit<SpadesState, 'hands'> {
  me: Seat;
  hand: Card[];
  handCounts: number[];
  legal: Card[];
}

export const team = (seat: Seat) => seat % 2;

function deal(s: SpadesState, random: () => number): SpadesState {
  const cards = shuffle(deck(), random);
  return {
    ...s,
    hands: [0, 1, 2, 3].map((i) => cards.slice(i * 13, i * 13 + 13)),
    phase: 'bid',
    bids: [null, null, null, null],
    trick: [],
    tricks: [0, 0, 0, 0],
    broken: false,
    turn: ((s.dealer + 1) % 4) as Seat,
  };
}

export function setup(ctx: Pick<GameCtx, 'random' | 'options'>): SpadesState {
  return deal(
    {
      hands: [],
      phase: 'bid',
      dealer: Math.floor(ctx.random() * 4),
      bids: [],
      trick: [],
      lastTrick: null,
      turn: 0,
      tricks: [],
      broken: false,
      scores: [0, 0],
      bags: [0, 0],
      history: [],
      target: Number(ctx.options.target ?? 500),
    },
    ctx.random,
  );
}

export function legalCards(s: Pick<SpadesState, 'trick' | 'broken'>, hand: Card[]): Card[] {
  if (!s.trick.length) {
    if (!s.broken) {
      const other = hand.filter((c) => suitOf(c) !== SPADE);
      if (other.length) return other;
    }
    return hand;
  }
  const led = suitOf(s.trick[0].card);
  const follow = hand.filter((c) => suitOf(c) === led);
  return follow.length ? follow : hand;
}

function scoreHand(s: SpadesState): { delta: [number, number]; bags: [number, number] } {
  const delta: [number, number] = [0, 0];
  const bags: [number, number] = [s.bags[0], s.bags[1]];
  for (const t of [0, 1]) {
    const seats = [t, t + 2];
    let bid = 0;
    let made = 0;
    for (const p of seats) {
      if (s.bids[p] === 0) delta[t] += s.tricks[p] === 0 ? 100 : -100;
      else bid += s.bids[p]!;
      made += s.tricks[p];
    }
    // Tricks taken by a nil bidder still count toward the team (as overtricks)
    if (bid > 0) {
      if (made >= bid) {
        delta[t] += bid * 10 + (made - bid);
        bags[t] += made - bid;
      } else delta[t] -= bid * 10;
    } else bags[t] += made;
    while (bags[t] >= 10) {
      bags[t] -= 10;
      delta[t] -= 100;
    }
  }
  return { delta, bags };
}

export function move(s: SpadesState, seat: Seat, m: SpadesMove, ctx: Pick<GameCtx, 'random'>): SpadesState | string {
  if (s.phase === 'done') return 'The game is over';
  if (seat !== s.turn) return 'Not your turn';
  if (s.phase === 'bid') {
    if (m.type !== 'bid' || !Number.isInteger(m.n) || m.n < 0 || m.n > 13) return 'Bid 0 (nil) to 13';
    const bids = s.bids.map((b, i) => (i === seat ? m.n : b));
    const next = ((seat + 1) % 4) as Seat;
    if (bids.every((b) => b !== null)) return { ...s, bids, phase: 'play', turn: ((s.dealer + 1) % 4) as Seat };
    return { ...s, bids, turn: next };
  }
  if (m.type !== 'play' || !legalCards(s, s.hands[seat]).includes(m.card)) return 'You must follow suit (and can’t lead spades until they’re broken)';
  const hands = s.hands.map((h, i) => (i === seat ? h.filter((c) => c !== m.card) : h));
  const trick = [...s.trick, { seat, card: m.card }];
  const broken = s.broken || suitOf(m.card) === SPADE;
  if (trick.length < 4) return { ...s, hands, trick, broken, turn: ((seat + 1) % 4) as Seat };
  const win = trickWinner(trick, SPADE).seat as Seat;
  const tricks = s.tricks.map((t, i) => (i === win ? t + 1 : t));
  let next: SpadesState = { ...s, hands, trick: [], broken, tricks, turn: win, lastTrick: { plays: trick, winner: win } };
  if (hands.every((h) => !h.length)) {
    const { delta, bags } = scoreHand(next);
    const scores: [number, number] = [s.scores[0] + delta[0], s.scores[1] + delta[1]];
    next = { ...next, scores, bags, history: [...s.history, { delta, bids: s.bids as number[], tricks }], dealer: ((s.dealer + 1) % 4) as Seat };
    if (Math.max(...scores) >= s.target && scores[0] !== scores[1]) return { ...next, phase: 'done' };
    return deal(next, ctx.random);
  }
  return next;
}

export const activePlayers = (s: SpadesState): Seat[] => (s.phase === 'done' ? [] : [s.turn]);

export function view(s: SpadesState, seat: Seat): SpadesView {
  const { hands, ...rest } = s;
  return { ...rest, me: seat, hand: hands[seat] ?? [], handCounts: hands.map((h) => h.length), legal: s.phase === 'play' && s.turn === seat ? legalCards(s, hands[seat]) : [] };
}

export function result(s: SpadesState): GameResult | null {
  if (s.phase !== 'done') return null;
  const t = s.scores[0] > s.scores[1] ? 0 : 1;
  return { winners: [t, t + 2] };
}

// ------------------------------------------------------------- bot

export function estimate(hand: Card[]) {
  let tricks = 0;
  const spades = hand.filter((c) => suitOf(c) === SPADE).map(rankOf);
  for (const r of spades) if (r >= 12) tricks += r === 14 ? 1 : 0.8;
  tricks += Math.max(0, spades.length - 3) * 0.7;
  for (const s of [1, 2, 3]) {
    const cards = hand.filter((c) => suitOf(c) === s).map(rankOf);
    if (cards.includes(14)) tricks += 0.9;
    if (cards.includes(13) && cards.length >= 2) tricks += 0.6;
    if (cards.length <= 1 && spades.length >= 2) tricks += 0.5;
  }
  return tricks;
}

const lowest = (cs: Card[]) => cs.slice().sort((a, b) => rankOf(a) - rankOf(b) + (suitOf(a) === SPADE ? 20 : 0) - (suitOf(b) === SPADE ? 20 : 0))[0];
const winsNow = (trick: Play[], c: Card) => trickWinner([...trick, { seat: -1, card: c }], SPADE).seat === -1;

export function bot(v: SpadesView, seat: Seat, ctx: BotCtx): SpadesMove {
  if (v.phase === 'bid') {
    const est = estimate(v.hand) + (ctx.level === 'easy' ? (ctx.random() - 0.5) * 2 : 0);
    const weak = v.hand.every((c) => rankOf(c) < 11) && v.hand.filter((c) => suitOf(c) === SPADE).length <= 2;
    if (weak && ctx.level === 'hard') return { type: 'bid', n: 0 };
    return { type: 'bid', n: Math.max(1, Math.min(13, Math.round(est))) };
  }
  const legal = v.legal;
  if (ctx.level === 'easy' && ctx.random() < 0.3) return { type: 'play', card: legal[Math.floor(ctx.random() * legal.length)] };
  const nil = v.bids[seat] === 0;
  const partner = ((seat + 2) % 4) as Seat;
  const teamBid = (v.bids[seat] ?? 0) + (v.bids[partner] ?? 0);
  const teamMade = v.tricks[seat] + v.tricks[partner];
  const need = teamBid - teamMade > 0;
  if (!v.trick.length) {
    if (nil) return { type: 'play', card: lowest(legal) };
    const aces = legal.filter((c) => rankOf(c) === 14 && suitOf(c) !== SPADE);
    if (need && aces.length) return { type: 'play', card: aces[0] };
    return { type: 'play', card: lowest(legal) };
  }
  const winning = legal.filter((c) => winsNow(v.trick, c));
  const current = trickWinner(v.trick, SPADE).seat;
  const partnerWinning = current === partner;
  if (nil) {
    const losers = legal.filter((c) => !winsNow(v.trick, c));
    return { type: 'play', card: losers.length ? losers.sort((a, b) => rankOf(b) - rankOf(a))[0] : lowest(legal) };
  }
  if (need && !partnerWinning && winning.length) return { type: 'play', card: lowest(winning) };
  return { type: 'play', card: lowest(legal) };
}
