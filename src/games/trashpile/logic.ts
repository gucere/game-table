/**
 * Trash: a four-player shedding game, built to the rules a friend of the site wrote down.
 * Everyone has 3 face-down cards, 3 face-up cards on top of them and 4 in hand. Play one card
 * a turn, equal or higher than the pile (3 low … A high); 2 resets, 8 copies the card under it,
 * 10 trashes the pile. Can't (or won't) play? Pick up the pile. First with no cards left wins.
 */
import type { BotCtx, GameCtx, Seat } from '../../engine/types';
import { rankOf, shuffle } from '../cards/cards';

export const PLAYERS = 4;
export const REVEAL_MS = 2000;
/** Ordinary ranks, low to high */
export const ORDER = [3, 4, 5, 6, 7, 9, 11, 12, 13, 14];
export const SPECIAL = new Set([2, 8, 10]);
/** "Anything goes" */
export const ANY = 0;

export interface TrashState {
  n: number;
  hands: number[][];
  up: (number | null)[][];
  down: (number | null)[][];
  stock: number[];
  pile: number[];
  trashed: number;
  turn: Seat;
  phase: 'swap' | 'play' | 'reveal' | 'roundover';
  ready: boolean[];
  wins: number[];
  round: number;
  winner: Seat | null;
  /** A failed face-up play or face-down flip, shown before the pickup */
  reveal: { seat: Seat; card: number; from: 'up' | 'down' } | null;
  deadline: number | null;
  last: { seat: Seat; kind: 'play' | 'pickup' | 'trash'; card?: number; count?: number } | null;
}

export type TrashMove =
  | { type: 'swap'; card: number; slot: number }
  | { type: 'ready' }
  | { type: 'play'; card: number }
  | { type: 'up'; slot: number }
  | { type: 'flip'; slot: number }
  | { type: 'pickup' }
  | { type: 'next' };

export interface TrashView extends Omit<TrashState, 'hands' | 'down' | 'stock'> {
  me: Seat;
  hand: number[];
  handCounts: number[];
  /** Face-down cards: only whether each slot still has a card */
  down: boolean[][];
  stockCount: number;
}

export const rank = (c: number) => rankOf(c);

/** The rank to beat: look down through 8s; a 2, an empty pile or only 8s means anything goes */
export function effective(pile: number[]): number {
  for (let i = pile.length - 1; i >= 0; i--) {
    const r = rank(pile[i]);
    if (r === 8) continue;
    if (r === 2) return ANY;
    return r;
  }
  return ANY;
}

export function legal(card: number, pile: number[]) {
  const r = rank(card);
  if (SPECIAL.has(r)) return true;
  const e = effective(pile);
  return e === ANY || ORDER.indexOf(r) >= ORDER.indexOf(e);
}

function deal(base: Pick<TrashState, 'wins' | 'round'>, random: () => number): TrashState {
  const deck = shuffle(
    Array.from({ length: 52 }, (_, i) => i),
    random,
  );
  const take = () => deck.pop()!;
  const down = Array.from({ length: PLAYERS }, () => [null, null, null] as (number | null)[]);
  const up = Array.from({ length: PLAYERS }, () => [null, null, null] as (number | null)[]);
  const hands: number[][] = Array.from({ length: PLAYERS }, () => []);
  for (let k = 0; k < 3; k++) for (let p = 0; p < PLAYERS; p++) down[p][k] = take();
  for (let k = 0; k < 3; k++) for (let p = 0; p < PLAYERS; p++) up[p][k] = take();
  for (let k = 0; k < 4; k++) for (let p = 0; p < PLAYERS; p++) hands[p].push(take());
  return {
    n: PLAYERS,
    hands,
    up,
    down,
    stock: deck,
    pile: [],
    trashed: 0,
    turn: 0,
    phase: 'swap',
    ready: Array(PLAYERS).fill(false),
    wins: base.wins,
    round: base.round,
    winner: null,
    reveal: null,
    deadline: null,
    last: null,
  };
}

export function setup(ctx: Pick<GameCtx, 'random'>): TrashState {
  return deal({ wins: Array(PLAYERS).fill(0), round: 1 }, ctx.random);
}

/** Where this player plays from now */
export function zone(s: Pick<TrashState, 'up' | 'stock'> & { hands?: number[][]; handCounts?: number[] }, seat: Seat): 'hand' | 'up' | 'down' {
  const handSize = s.hands ? s.hands[seat].length : (s.handCounts?.[seat] ?? 0);
  if (handSize > 0) return 'hand';
  if (s.up[seat].some((c) => c !== null)) return 'up';
  return 'down';
}

const outOfCards = (s: TrashState, seat: Seat) => !s.hands[seat].length && s.up[seat].every((c) => c === null) && s.down[seat].every((c) => c === null);
const next = (seat: Seat) => (seat + 1) % PLAYERS;

/** A card goes on the pile (or trashes it), the player draws, and the turn moves on */
function place(s: TrashState, seat: Seat, card: number): TrashState {
  let t: TrashState;
  if (rank(card) === 10) t = { ...s, pile: [], trashed: s.trashed + s.pile.length + 1, last: { seat, kind: 'trash', card, count: s.pile.length + 1 } };
  else t = { ...s, pile: [...s.pile, card], last: { seat, kind: 'play', card } };
  // Draw one if the stock has cards and the hand is down to three or fewer
  if (t.stock.length && t.hands[seat].length <= 3) {
    const stock = t.stock.slice(0, -1);
    t = { ...t, stock, hands: t.hands.map((h, i) => (i === seat ? [...h, t.stock[t.stock.length - 1]] : h)) };
  }
  if (outOfCards(t, seat)) return { ...t, phase: 'roundover', winner: seat, wins: t.wins.map((w, i) => (i === seat ? w + 1 : w)), deadline: null };
  return { ...t, turn: next(seat) };
}

function failAndReveal(s: TrashState, seat: Seat, card: number, from: 'up' | 'down', now: number): TrashState {
  return { ...s, pile: [...s.pile, card], phase: 'reveal', reveal: { seat, card, from }, deadline: now + REVEAL_MS };
}

export function move(s: TrashState, seat: Seat, m: TrashMove, ctx: Pick<GameCtx, 'random' | 'now'>): TrashState | string {
  if (s.phase === 'roundover') {
    if (m?.type !== 'next') return 'The round is over';
    return deal({ wins: s.wins, round: s.round + 1 }, ctx.random);
  }
  if (s.phase === 'swap') {
    if (s.ready[seat]) return 'You are ready; wait for the others';
    if (m?.type === 'ready') {
      const ready = s.ready.map((r, i) => r || i === seat);
      if (!ready.every(Boolean)) return { ...s, ready };
      // A random player starts every round
      return { ...s, ready, phase: 'play', turn: Math.floor(ctx.random() * PLAYERS) };
    }
    if (m?.type !== 'swap') return 'Swap a card or press Ready';
    if (!s.hands[seat].includes(m.card) || ![0, 1, 2].includes(m.slot) || s.up[seat][m.slot] === null) return 'Pick a card from your hand and one of your face-up cards';
    const upCard = s.up[seat][m.slot]!;
    return {
      ...s,
      hands: s.hands.map((h, i) => (i === seat ? h.map((c) => (c === m.card ? upCard : c)) : h)),
      up: s.up.map((u, i) => (i === seat ? u.map((c, k) => (k === m.slot ? m.card : c)) : u)),
    };
  }
  if (s.phase === 'reveal') return 'Wait a moment…';
  if (seat !== s.turn) return 'Not your turn';
  const z = zone(s, seat);

  if (m?.type === 'pickup') {
    if (!s.pile.length) return 'The pile is empty: play any card';
    return { ...s, hands: s.hands.map((h, i) => (i === seat ? [...h, ...s.pile] : h)), pile: [], turn: next(seat), last: { seat, kind: 'pickup', count: s.pile.length } };
  }
  if (m?.type === 'play') {
    if (z !== 'hand') return 'Your hand is empty';
    if (!s.hands[seat].includes(m.card)) return 'That card isn’t in your hand';
    if (!legal(m.card, s.pile)) return 'That card is too low: play another or pick up the pile';
    return place({ ...s, hands: s.hands.map((h, i) => (i === seat ? h.filter((c) => c !== m.card) : h)) }, seat, m.card);
  }
  if (m?.type === 'up') {
    if (z !== 'up') return z === 'hand' ? 'Play from your hand first' : 'No face-up cards left';
    const card = s.up[seat][m.slot];
    if (card === null || card === undefined) return 'Pick one of your face-up cards';
    const up = s.up.map((u, i) => (i === seat ? u.map((c, k) => (k === m.slot ? null : c)) : u));
    if (legal(card, s.pile)) return place({ ...s, up }, seat, card);
    // Only when nothing face-up fits: show it, then pick up
    if (s.up[seat].some((c) => c !== null && legal(c, s.pile))) return 'One of your face-up cards fits: play that one';
    return failAndReveal({ ...s, up }, seat, card, 'up', ctx.now());
  }
  if (m?.type === 'flip') {
    if (z !== 'down') return 'Play your other cards first';
    const card = s.down[seat][m.slot];
    if (card === null || card === undefined) return 'Pick one of your face-down cards';
    const down = s.down.map((d, i) => (i === seat ? d.map((c, k) => (k === m.slot ? null : c)) : d));
    if (legal(card, s.pile)) return place({ ...s, down }, seat, card);
    return failAndReveal({ ...s, down }, seat, card, 'down', ctx.now());
  }
  return 'Play a card or pick up the pile';
}

/** After the reveal pause, the pile (with the failed card) goes into the player's hand */
export function onTimer(s: TrashState): TrashState {
  if (s.phase !== 'reveal' || !s.reveal) return s;
  const seat = s.reveal.seat;
  return { ...s, hands: s.hands.map((h, i) => (i === seat ? [...h, ...s.pile] : h)), pile: [], phase: 'play', reveal: null, deadline: null, turn: next(seat), last: { seat, kind: 'pickup', count: s.pile.length } };
}

export function activePlayers(s: TrashState): Seat[] {
  if (s.phase === 'swap') return s.ready.flatMap((r, i) => (r ? [] : [i]));
  if (s.phase === 'play') return [s.turn];
  if (s.phase === 'roundover') return [0, 1, 2, 3];
  return [];
}

export function view(s: TrashState, seat: Seat): TrashView {
  const { hands, down, stock, ...rest } = s;
  return { ...rest, me: seat, hand: hands[seat] ?? [], handCounts: hands.map((h) => h.length), down: down.map((d) => d.map((c) => c !== null)), stockCount: stock.length };
}

/** The table keeps going round after round: there is no final result, only win counts */
export const result = () => null;

// ------------------------------------------------------------- bot

const strength = (c: number) => {
  const r = rank(c);
  return r === 10 ? 30 : r === 2 ? 25 : r === 8 ? 20 : ORDER.indexOf(r);
};

export function bot(v: TrashView, seat: Seat, ctx: BotCtx): TrashMove {
  if (v.phase === 'roundover') return { type: 'next' };
  if (v.phase === 'swap') {
    // Medium and hard keep strong cards face up for later
    if (ctx.level !== 'easy') {
      const weakestUp = v.up[seat].map((c, k) => ({ c, k })).filter((x) => x.c !== null).sort((a, b) => strength(a.c!) - strength(b.c!))[0];
      const strongestHand = [...v.hand].sort((a, b) => strength(b) - strength(a))[0];
      if (weakestUp && strongestHand !== undefined && strength(strongestHand) > strength(weakestUp.c!)) return { type: 'swap', card: strongestHand, slot: weakestUp.k };
    }
    return { type: 'ready' };
  }
  const z = zone({ up: v.up, stock: [], handCounts: v.handCounts }, seat);
  if (z === 'down') {
    const slots = v.down[seat].flatMap((has, k) => (has ? [k] : []));
    return { type: 'flip', slot: slots[Math.floor(ctx.random() * slots.length)] };
  }
  const cards = z === 'hand' ? v.hand : v.up[seat].filter((c): c is number => c !== null);
  const ok = cards.filter((c) => legal(c, v.pile));
  const asMove = (c: number): TrashMove => (z === 'hand' ? { type: 'play', card: c } : { type: 'up', slot: v.up[seat].indexOf(c) });
  if (!ok.length) return z === 'hand' ? { type: 'pickup' } : asMove(cards[0]);
  if (ctx.level === 'easy') {
    if (v.pile.length && v.pile.length <= 2 && ctx.random() < 0.15 && z === 'hand') return { type: 'pickup' };
    return asMove(ok[Math.floor(ctx.random() * ok.length)]);
  }
  // Lowest ordinary card first; specials only when nothing else fits
  const ordinary = ok.filter((c) => !SPECIAL.has(rank(c))).sort((a, b) => strength(a) - strength(b));
  if (ordinary.length) {
    // Hard: trash a big pile when the next player is close to going out
    if (ctx.level === 'hard') {
      const ten = ok.find((c) => rank(c) === 10);
      const nextSeat = (seat + 1) % PLAYERS;
      const nextCards = v.handCounts[nextSeat] + v.up[nextSeat].filter((c) => c !== null).length + v.down[nextSeat].filter(Boolean).length;
      if (ten !== undefined && v.pile.length >= 6 && nextCards <= 3) return asMove(ten);
    }
    return asMove(ordinary[0]);
  }
  return asMove(ok.sort((a, b) => strength(a) - strength(b))[0]);
}
