/**
 * Hearts: avoid taking hearts (1 point each) and the queen of spades (13).
 * Pass three cards before each hand (left, right, across, then keep). The 2♣ leads.
 * Take all of them ("shoot the moon") and everyone else gets 26 instead. Lowest score wins.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';
import { card, deck, rankOf, shuffle, suitOf, type Card } from '../cards/cards';
import { trickWinner, type Play } from '../batak/engine';

export const QS = card(0, 12);
const TWO_CLUBS = card(2, 2);
const PASS_DIR = ['left', 'right', 'across', 'none'] as const;

export interface HeartsState {
  hands: Card[][];
  phase: 'pass' | 'play' | 'done';
  handNo: number;
  passes: (Card[] | null)[];
  trick: Play[];
  lastTrick: { plays: Play[]; winner: Seat } | null;
  turn: Seat;
  taken: Card[][];
  broken: boolean;
  firstTrick: boolean;
  scores: number[];
  history: number[][];
  target: number;
  moon: Seat | null;
}
export type HeartsMove = { type: 'pass'; cards: Card[] } | { type: 'play'; card: Card };
export interface HeartsView extends Omit<HeartsState, 'hands' | 'passes'> {
  me: Seat;
  hand: Card[];
  handCounts: number[];
  passed: boolean[];
  passDir: (typeof PASS_DIR)[number];
  legal: Card[];
  points: number[];
}

export const pointsOf = (c: Card) => (c === QS ? 13 : suitOf(c) === 1 ? 1 : 0);
export const passDir = (handNo: number) => PASS_DIR[handNo % 4];

function deal(s: HeartsState, random: () => number): HeartsState {
  const cards = shuffle(deck(), random);
  const hands = [0, 1, 2, 3].map((i) => cards.slice(i * 13, i * 13 + 13));
  const base: HeartsState = { ...s, hands, trick: [], lastTrick: s.lastTrick, taken: [[], [], [], []], broken: false, firstTrick: true, passes: [null, null, null, null], moon: null };
  return passDir(s.handNo) === 'none' ? startPlay(base) : { ...base, phase: 'pass' };
}

function startPlay(s: HeartsState): HeartsState {
  const turn = s.hands.findIndex((h) => h.includes(TWO_CLUBS));
  return { ...s, phase: 'play', turn };
}

export function setup(ctx: Pick<GameCtx, 'random' | 'options'>): HeartsState {
  return deal(
    {
      hands: [],
      phase: 'pass',
      handNo: 0,
      passes: [],
      trick: [],
      lastTrick: null,
      turn: 0,
      taken: [],
      broken: false,
      firstTrick: true,
      scores: [0, 0, 0, 0],
      history: [],
      target: Number(ctx.options.target ?? 100),
      moon: null,
    },
    ctx.random,
  );
}

export function legalCards(s: Pick<HeartsState, 'trick' | 'broken' | 'firstTrick'>, hand: Card[]): Card[] {
  if (!s.trick.length) {
    if (s.firstTrick) return hand.includes(TWO_CLUBS) ? [TWO_CLUBS] : hand;
    if (!s.broken) {
      const nonHearts = hand.filter((c) => suitOf(c) !== 1);
      if (nonHearts.length) return nonHearts;
    }
    return hand;
  }
  const led = suitOf(s.trick[0].card);
  const follow = hand.filter((c) => suitOf(c) === led);
  if (follow.length) return follow;
  // No points on the first trick if you can help it
  if (s.firstTrick) {
    const clean = hand.filter((c) => pointsOf(c) === 0);
    if (clean.length) return clean;
  }
  return hand;
}

function finishHand(s: HeartsState, random: () => number): HeartsState {
  const pts = s.taken.map((t) => t.reduce((a, c) => a + pointsOf(c), 0));
  const moon = pts.findIndex((p) => p === 26);
  const delta = moon >= 0 ? pts.map((_, i) => (i === moon ? 0 : 26)) : pts;
  const scores = s.scores.map((x, i) => x + delta[i]);
  const next: HeartsState = { ...s, scores, history: [...s.history, delta], handNo: s.handNo + 1, moon: moon >= 0 ? moon : null };
  if (Math.max(...scores) >= s.target) return { ...next, phase: 'done' };
  return deal(next, random);
}

export function move(s: HeartsState, seat: Seat, m: HeartsMove, ctx: Pick<GameCtx, 'random'>): HeartsState | string {
  if (s.phase === 'done') return 'The game is over';
  if (s.phase === 'pass') {
    if (m.type !== 'pass') return 'Choose three cards to pass';
    if (s.passes[seat]) return 'Already passed';
    const cards = m.cards ?? [];
    if (cards.length !== 3 || new Set(cards).size !== 3 || !cards.every((c) => s.hands[seat].includes(c))) return 'Pick exactly three of your cards';
    const passes = s.passes.map((p, i) => (i === seat ? cards : p));
    if (!passes.every(Boolean)) return { ...s, passes };
    const off = { left: 1, right: 3, across: 2, none: 0 }[passDir(s.handNo)];
    const hands = s.hands.map((h, i) => {
      const from = (i - off + 4) % 4;
      return [...h.filter((c) => !passes[i]!.includes(c)), ...passes[from]!];
    });
    return startPlay({ ...s, hands, passes });
  }
  if (m.type !== 'play') return 'Play a card';
  if (seat !== s.turn) return 'Not your turn';
  const hand = s.hands[seat];
  if (!legalCards(s, hand).includes(m.card)) return 'You must follow the rules';
  const hands = s.hands.map((h, i) => (i === seat ? h.filter((c) => c !== m.card) : h));
  const trick = [...s.trick, { seat, card: m.card }];
  const broken = s.broken || suitOf(m.card) === 1 || m.card === QS;
  if (trick.length < 4) return { ...s, hands, trick, broken, turn: ((seat + 1) % 4) as Seat };
  const win = trickWinner(trick, null).seat as Seat;
  const taken = s.taken.map((t, i) => (i === win ? [...t, ...trick.map((p) => p.card)] : t));
  const next: HeartsState = { ...s, hands, trick: [], broken, taken, turn: win, firstTrick: false, lastTrick: { plays: trick, winner: win } };
  return hands.every((h) => !h.length) ? finishHand(next, ctx.random) : next;
}

export function activePlayers(s: HeartsState): Seat[] {
  if (s.phase === 'pass') return [0, 1, 2, 3].filter((i) => !s.passes[i]);
  if (s.phase === 'play') return [s.turn];
  return [];
}

export function view(s: HeartsState, seat: Seat): HeartsView {
  const { hands, passes, ...rest } = s;
  return {
    ...rest,
    me: seat,
    hand: hands[seat] ?? [],
    handCounts: hands.map((h) => h.length),
    passed: passes.map(Boolean),
    passDir: passDir(s.handNo),
    legal: s.phase === 'play' && s.turn === seat ? legalCards(s, hands[seat]) : [],
    points: s.taken.map((t) => t.reduce((a, c) => a + pointsOf(c), 0)),
  };
}

export function result(s: HeartsState): GameResult | null {
  if (s.phase !== 'done') return null;
  const low = Math.min(...s.scores);
  return { winners: s.scores.flatMap((x, i) => (x === low ? [i] : [])) };
}

// ------------------------------------------------------------- bot

const high = (cs: Card[]) => cs.slice().sort((a, b) => rankOf(b) - rankOf(a))[0];
const low = (cs: Card[]) => cs.slice().sort((a, b) => rankOf(a) - rankOf(b))[0];

export function bot(v: HeartsView, _seat: Seat, ctx: BotCtx): HeartsMove {
  if (v.phase === 'pass') {
    // Pass the scariest cards: Q/K/A of spades, high hearts, then other high cards
    const danger = (c: Card) => (c === QS ? 100 : suitOf(c) === 0 && rankOf(c) > 12 ? 80 : suitOf(c) === 1 ? rankOf(c) * 3 : rankOf(c) * 2);
    return { type: 'pass', cards: v.hand.slice().sort((a, b) => danger(b) - danger(a)).slice(0, 3) };
  }
  const legal = v.legal;
  if (ctx.level === 'easy' && ctx.random() < 0.3) return { type: 'play', card: legal[Math.floor(ctx.random() * legal.length)] };
  if (!v.trick.length) {
    // Lead low, preferring suits other than hearts and avoiding spades while Q♠ is out
    const safe = legal.filter((c) => suitOf(c) !== 1 && !(suitOf(c) === 0 && rankOf(c) >= 12));
    return { type: 'play', card: low(safe.length ? safe : legal) };
  }
  const led = suitOf(v.trick[0].card);
  const following = legal.some((c) => suitOf(c) === led);
  if (!following) {
    // Dump the queen of spades, then high hearts, then the highest card
    if (legal.includes(QS)) return { type: 'play', card: QS };
    const hearts = legal.filter((c) => suitOf(c) === 1);
    return { type: 'play', card: high(hearts.length ? hearts : legal) };
  }
  const hi = Math.max(...v.trick.filter((p) => suitOf(p.card) === led).map((p) => rankOf(p.card)));
  const under = legal.filter((c) => rankOf(c) < hi);
  if (under.length) return { type: 'play', card: high(under) };
  const pointsInTrick = v.trick.some((p) => pointsOf(p.card) > 0);
  // Last to play on a clean trick: win it with the highest (but never with the Q♠ if avoidable)
  if (v.trick.length === 3 && !pointsInTrick) {
    const noQ = legal.filter((c) => c !== QS);
    return { type: 'play', card: high(noQ.length ? noQ : legal) };
  }
  return { type: 'play', card: low(legal) };
}
