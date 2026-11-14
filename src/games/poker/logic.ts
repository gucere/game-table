/**
 * Poker with play chips: Texas Hold'em and Five-Card Draw share this engine.
 * No-limit betting with blinds, side pots for all-ins, and a showdown.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';
import { deck, rankOf, shuffle, suitOf, type Card } from '../cards/cards';
import { best, category, eval5, handName } from './eval';

export type Variant = 'holdem' | 'draw';

export interface PokerState {
  variant: Variant;
  n: number;
  chips: number[];
  handNo: number;
  maxHands: number;
  dealer: Seat;
  sb: number;
  bb: number;
  blindsUpEvery: number;
  deck: Card[];
  hole: Card[][];
  board: Card[];
  phase: 'bet' | 'draw' | 'showdown' | 'done';
  street: number;
  /** Still in this hand (not folded, and was dealt in) */
  live: boolean[];
  allIn: boolean[];
  bet: number[];
  contributed: number[];
  toAct: Seat;
  currentBet: number;
  minRaise: number;
  acted: boolean[];
  drew: boolean[];
  lastAction: (string | null)[];
  result: {
    winners: { seat: Seat; amount: number; hand: string }[];
    shown: (Card[] | null)[];
    board: Card[];
  } | null;
  deadline: number | null;
}

export type PokerMove =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'raise'; to: number }
  | { type: 'draw'; discard: Card[] };

export interface PokerView extends Omit<PokerState, 'deck' | 'hole'> {
  me: Seat;
  hand: Card[];
  /** Cards shown at the showdown (others' hole cards stay hidden) */
  shown: (Card[] | null)[];
  holeCounts: number[];
  pot: number;
  toCall: number;
  minRaiseTo: number;
  maxRaiseTo: number;
}

const STREET_NAMES: Record<Variant, string[]> = { holdem: ['Pre-flop', 'Flop', 'Turn', 'River'], draw: ['First bet', 'Second bet'] };
export const streetName = (s: Pick<PokerState, 'variant' | 'street'>) => STREET_NAMES[s.variant][s.street] ?? '';
const SHOWDOWN_MS = 6000;

const seated = (s: PokerState) => s.chips.map((c, i) => (c > 0 ? i : -1)).filter((i) => i >= 0);
function nextSeat(s: Pick<PokerState, 'n'>, from: Seat, ok: (i: Seat) => boolean): Seat {
  for (let k = 1; k <= s.n; k++) {
    const i = (from + k) % s.n;
    if (ok(i)) return i;
  }
  return from;
}

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'random' | 'options' | 'now'>, variant: Variant): PokerState {
  const n = ctx.numPlayers;
  const start = Number(ctx.options.chips ?? 1000);
  const s: PokerState = {
    variant,
    n,
    chips: Array(n).fill(start),
    handNo: 0,
    maxHands: Number(ctx.options.hands ?? 0),
    dealer: Math.floor(ctx.random() * n),
    sb: Math.max(1, Math.round(start / 100)),
    bb: Math.max(2, Math.round(start / 50)),
    blindsUpEvery: Number(ctx.options.blinds ?? 10),
    deck: [],
    hole: [],
    board: [],
    phase: 'bet',
    street: 0,
    live: [],
    allIn: [],
    bet: [],
    contributed: [],
    toAct: 0,
    currentBet: 0,
    minRaise: 0,
    acted: [],
    drew: [],
    lastAction: [],
    result: null,
    deadline: null,
  };
  return startHand(s, ctx);
}

function post(s: PokerState, seat: Seat, amount: number) {
  const a = Math.min(amount, s.chips[seat]);
  s.chips[seat] -= a;
  s.bet[seat] += a;
  s.contributed[seat] += a;
  if (s.chips[seat] === 0) s.allIn[seat] = true;
  return a;
}

type Ctx = Pick<GameCtx, 'random' | 'now'>;

function startHand(prev: PokerState, ctx: Ctx): PokerState {
  const s: PokerState = { ...prev, chips: prev.chips.slice(), result: null, deadline: null, board: [], street: 0, phase: 'bet' };
  const inPlay = seated(s);
  s.handNo = prev.handNo + 1;
  if (s.blindsUpEvery && s.handNo > 1 && (s.handNo - 1) % s.blindsUpEvery === 0) {
    s.sb *= 2;
    s.bb *= 2;
  }
  s.dealer = s.handNo === 1 && s.chips[s.dealer] > 0 ? s.dealer : nextSeat(s, prev.dealer, (i) => s.chips[i] > 0);
  s.deck = shuffle(deck(), ctx.random);
  const handSize = s.variant === 'holdem' ? 2 : 5;
  s.hole = Array.from({ length: s.n }, (_, i) => (inPlay.includes(i) ? s.deck.splice(0, handSize) : []));
  s.live = Array.from({ length: s.n }, (_, i) => inPlay.includes(i));
  s.allIn = Array(s.n).fill(false);
  s.bet = Array(s.n).fill(0);
  s.contributed = Array(s.n).fill(0);
  s.acted = Array(s.n).fill(false);
  s.drew = Array(s.n).fill(false);
  s.lastAction = Array(s.n).fill(null);
  // Heads-up: the dealer posts the small blind and acts first before the flop
  const headsUp = inPlay.length === 2;
  const sbSeat = headsUp ? s.dealer : nextSeat(s, s.dealer, (i) => s.live[i]);
  const bbSeat = nextSeat(s, sbSeat, (i) => s.live[i]);
  post(s, sbSeat, s.sb);
  post(s, bbSeat, s.bb);
  s.lastAction[sbSeat] = 'small blind';
  s.lastAction[bbSeat] = 'big blind';
  s.currentBet = s.bb;
  s.minRaise = s.bb;
  s.toAct = nextSeat(s, bbSeat, (i) => s.live[i] && !s.allIn[i]);
  return settleIfNoAction(s, ctx);
}

const canAct = (s: PokerState, i: Seat) => s.live[i] && !s.allIn[i];
const liveCount = (s: PokerState) => s.live.filter(Boolean).length;

function roundDone(s: PokerState) {
  const actors = s.live.map((l, i) => (l && !s.allIn[i] ? i : -1)).filter((i) => i >= 0);
  return actors.every((i) => s.acted[i] && s.bet[i] === s.currentBet) || (actors.length <= 1 && actors.every((i) => s.bet[i] >= s.currentBet));
}

/** Move the game on when nobody can (or needs to) act any more */
function settleIfNoAction(s: PokerState, ctx: Ctx): PokerState {
  if (liveCount(s) <= 1) return showdown(s, ctx);
  if (s.phase === 'bet' && roundDone(s)) return nextStreet(s, ctx);
  return s;
}

function nextStreet(prev: PokerState, ctx: Ctx): PokerState {
  const s: PokerState = { ...prev, bet: Array(prev.n).fill(0), acted: Array(prev.n).fill(false), currentBet: 0, minRaise: prev.bb };
  s.board = prev.board.slice();
  s.deck = prev.deck.slice();
  const actors = s.live.filter((l, i) => l && !s.allIn[i]).length;
  if (s.variant === 'holdem') {
    if (s.street >= 3) return showdown(s, ctx);
    s.street++;
    s.board.push(...s.deck.splice(0, s.street === 1 ? 3 : 1));
    // Everyone all-in (or only one can still bet): deal the rest straight away
    if (actors <= 1) return nextStreet(s, ctx);
  } else {
    if (s.street >= 1) return showdown(s, ctx);
    s.phase = 'draw';
    s.toAct = nextSeat(s, s.dealer, (i) => s.live[i]);
    return s;
  }
  s.toAct = nextSeat(s, s.dealer, (i) => canAct(s, i));
  return s;
}

function showdown(prev: PokerState, ctx: Ctx): PokerState {
  const s: PokerState = { ...prev, chips: prev.chips.slice(), phase: 'showdown' };
  const live = s.live.map((l, i) => (l ? i : -1)).filter((i) => i >= 0);
  const scores = s.hole.map((h, i) => (s.live[i] ? best([...h, ...s.board]).score : -1));
  const won = new Map<Seat, number>();
  if (live.length === 1) {
    const total = s.contributed.reduce((a, b) => a + b, 0);
    won.set(live[0], total);
  } else {
    // Side pots: each contribution level is a pot for those who reached it
    const levels = [...new Set(s.contributed.filter((c) => c > 0))].sort((a, b) => a - b);
    let prevLevel = 0;
    for (const level of levels) {
      const slice = s.contributed.reduce((a, c) => a + Math.max(0, Math.min(c, level) - prevLevel), 0);
      const eligible = live.filter((i) => s.contributed[i] >= level);
      prevLevel = level;
      if (!eligible.length || !slice) continue;
      const top = Math.max(...eligible.map((i) => scores[i]));
      const winners = eligible.filter((i) => scores[i] === top);
      const share = Math.floor(slice / winners.length);
      let rest = slice - share * winners.length;
      // Odd chips go to the first winner left of the dealer
      const order = winners.slice().sort((a, b) => ((a - s.dealer + s.n) % s.n) - ((b - s.dealer + s.n) % s.n));
      for (const w of order) {
        won.set(w, (won.get(w) ?? 0) + share + (rest > 0 ? 1 : 0));
        if (rest > 0) rest--;
      }
    }
  }
  for (const [w, amt] of won) s.chips[w] += amt;
  s.result = {
    winners: [...won.entries()].map(([seat, amount]) => ({ seat, amount, hand: live.length > 1 ? handName(scores[seat]) : '' })),
    shown: s.hole.map((h, i) => (live.length > 1 && s.live[i] ? h : null)),
    board: s.board,
  };
  // Show the result for a few seconds, then deal the next hand
  s.deadline = ctx.now() + SHOWDOWN_MS;
  return s;
}

export function onTimer(s: PokerState, ctx: GameCtx): PokerState {
  if (s.phase !== 'showdown') return s;
  const left = seated(s);
  if (left.length <= 1 || (s.maxHands && s.handNo >= s.maxHands)) return { ...s, phase: 'done', deadline: null };
  return startHand(s, ctx);
}

export function activePlayers(s: PokerState): Seat[] {
  if (s.phase === 'bet' || s.phase === 'draw') return [s.toAct];
  return [];
}

export function move(prev: PokerState, seat: Seat, m: PokerMove, ctx: Pick<GameCtx, 'random' | 'now'>): PokerState | string {
  if (prev.phase !== 'bet' && prev.phase !== 'draw') return 'Wait for the next hand';
  if (seat !== prev.toAct) return 'Not your turn';
  const s: PokerState = {
    ...prev,
    chips: prev.chips.slice(),
    bet: prev.bet.slice(),
    contributed: prev.contributed.slice(),
    live: prev.live.slice(),
    allIn: prev.allIn.slice(),
    acted: prev.acted.slice(),
    lastAction: prev.lastAction.slice(),
    hole: prev.hole.map((h) => h.slice()),
    deck: prev.deck.slice(),
  };

  if (s.phase === 'draw') {
    if (m.type !== 'draw') return 'Choose cards to swap (or none)';
    const discard = Array.isArray(m.discard) ? m.discard : [];
    if (discard.length > 4 || !discard.every((c) => s.hole[seat].includes(c))) return 'Swap up to 4 of your cards';
    s.hole[seat] = [...s.hole[seat].filter((c) => !discard.includes(c)), ...s.deck.splice(0, discard.length)];
    s.drew = prev.drew.slice();
    s.drew[seat] = true;
    s.lastAction[seat] = discard.length ? `drew ${discard.length}` : 'stands pat';
    const nextDrawer = s.live.findIndex((l, i) => l && !s.drew[i] && i !== seat);
    if (nextDrawer >= 0) {
      s.toAct = nextSeat(s, seat, (i) => s.live[i] && !s.drew[i]);
      return s;
    }
    // Second betting round
    s.phase = 'bet';
    s.street = 1;
    s.toAct = nextSeat(s, s.dealer, (i) => canAct(s, i));
    return settleIfNoAction(s, ctx);
  }

  const toCall = s.currentBet - s.bet[seat];
  switch (m.type) {
    case 'fold':
      s.live[seat] = false;
      s.lastAction[seat] = 'fold';
      break;
    case 'check':
      if (toCall > 0) return 'You have to call, raise or fold';
      s.lastAction[seat] = 'check';
      break;
    case 'call': {
      if (toCall <= 0) return 'Nothing to call: check instead';
      const paid = post(s, seat, toCall);
      s.lastAction[seat] = s.allIn[seat] ? `all-in ${paid}` : `call ${paid}`;
      break;
    }
    case 'raise': {
      const to = Math.floor(Number(m.to));
      const max = s.bet[seat] + s.chips[seat];
      if (!Number.isFinite(to) || to <= s.currentBet) return 'Raise to more than the current bet';
      if (to > max) return 'Not enough chips';
      const isAllIn = to === max;
      if (to < s.currentBet + s.minRaise && !isAllIn) return `The minimum raise is to ${s.currentBet + s.minRaise}`;
      const raiseBy = to - s.currentBet;
      post(s, seat, to - s.bet[seat]);
      // A full raise reopens the betting for everyone
      if (raiseBy >= s.minRaise) {
        s.minRaise = raiseBy;
        s.acted = s.acted.map(() => false);
      }
      s.currentBet = to;
      s.lastAction[seat] = s.allIn[seat] ? `all-in ${to}` : prev.currentBet === 0 ? `bet ${to}` : `raise to ${to}`;
      break;
    }
    default:
      return 'Unknown action';
  }
  s.acted[seat] = true;
  if (liveCount(s) <= 1 || roundDone(s)) return settleIfNoAction(s, ctx);
  s.toAct = nextSeat(s, seat, (i) => canAct(s, i));
  return s;
}

export function view(s: PokerState, seat: Seat): PokerView {
  const { deck: _deck, hole, ...rest } = s;
  const pot = s.contributed.reduce((a, b) => a + b, 0);
  const toCall = Math.max(0, s.currentBet - (s.bet[seat] ?? 0));
  const maxRaiseTo = (s.bet[seat] ?? 0) + (s.chips[seat] ?? 0);
  return {
    ...rest,
    me: seat,
    hand: hole[seat] ?? [],
    shown: s.result ? s.result.shown : hole.map(() => null),
    holeCounts: hole.map((h, i) => (s.live[i] ? h.length : 0)),
    pot,
    toCall,
    minRaiseTo: Math.min(maxRaiseTo, s.currentBet + s.minRaise),
    maxRaiseTo,
  };
}

export function result(s: PokerState): GameResult | null {
  if (s.phase !== 'done') return null;
  const top = Math.max(...s.chips);
  return { winners: s.chips.map((c, i) => (c === top ? i : -1)).filter((i) => i >= 0) };
}

// ------------------------------------------------------------- bot

/** Rough pre-flop strength 0..1 for two hole cards */
function preflop(h: Card[]) {
  const [a, b] = h.map(rankOf).sort((x, y) => y - x);
  const suited = suitOf(h[0]) === suitOf(h[1]);
  let v = (a + b - 4) / 24; // 0..1 by high cards
  if (a === b) v = 0.5 + (a - 2) / 24;
  if (suited) v += 0.06;
  if (a - b === 1) v += 0.04;
  return Math.min(1, v);
}

/** Monte Carlo chance of winning against `opps` random hands */
function equity(hand: Card[], board: Card[], opps: number, samples: number, random: () => number) {
  const known = new Set([...hand, ...board]);
  const rest = deck().filter((c) => !known.has(c));
  let wins = 0;
  for (let k = 0; k < samples; k++) {
    const d = shuffle(rest, random);
    const fullBoard = [...board, ...d.slice(0, 5 - board.length)];
    let p = 5 - board.length;
    const mine = best([...hand, ...fullBoard]).score;
    let beat = true;
    let tie = false;
    for (let o = 0; o < opps; o++) {
      const theirs = best([d[p], d[p + 1], ...fullBoard]).score;
      p += 2;
      if (theirs > mine) {
        beat = false;
        break;
      }
      if (theirs === mine) tie = true;
    }
    if (beat) wins += tie ? 0.5 : 1;
  }
  return wins / samples;
}

/** What to swap in Five-Card Draw: keep made hands and 4-card draws */
export function drawChoice(hand: Card[]): Card[] {
  const sc = eval5(hand);
  const cat = category(sc);
  if (cat >= 4) return []; // straight or better: stand pat
  const byRank = new Map<number, Card[]>();
  for (const c of hand) byRank.set(rankOf(c), [...(byRank.get(rankOf(c)) ?? []), c]);
  const multiples = [...byRank.values()].filter((g) => g.length >= 2).flat();
  if (multiples.length) return hand.filter((c) => !multiples.includes(c));
  for (const suit of [0, 1, 2, 3]) {
    const same = hand.filter((c) => suitOf(c) === suit);
    if (same.length === 4) return hand.filter((c) => suitOf(c) !== suit);
  }
  // Keep the two highest cards
  const keep = hand.slice().sort((a, b) => rankOf(b) - rankOf(a)).slice(0, 2);
  return hand.filter((c) => !keep.includes(c));
}

export function bot(v: PokerView, seat: Seat, ctx: BotCtx): PokerMove {
  const r = ctx.random;
  if (v.phase === 'draw') return { type: 'draw', discard: drawChoice(v.hand) };
  const opps = v.live.filter((l, i) => l && i !== seat).length;
  let strength: number;
  if (v.variant === 'holdem' && v.board.length === 0) strength = preflop(v.hand);
  else if (v.variant === 'holdem') strength = equity(v.hand, v.board, opps, ctx.level === 'hard' ? 160 : 60, r);
  else {
    const cat = category(eval5(v.hand));
    strength = [0.15, 0.4, 0.6, 0.72, 0.82, 0.86, 0.92, 0.97, 0.99][cat];
    if (v.street === 0) strength = Math.min(0.9, strength + 0.08);
  }
  // Preflop scores are absolute; post-flop equity already reflects the number of opponents
  const fair = v.variant === 'holdem' && v.board.length > 0 ? 1 / (opps + 1) : 0.45;
  const noise = ctx.level === 'easy' ? (r() - 0.5) * 0.35 : ctx.level === 'normal' ? (r() - 0.5) * 0.12 : (r() - 0.5) * 0.06;
  const s = strength + noise;
  const potOdds = v.toCall / (v.pot + v.toCall || 1);
  const raiseTo = (frac: number) => Math.max(v.minRaiseTo, Math.min(v.maxRaiseTo, Math.round(v.currentBet + Math.max(v.bb, v.pot * frac))));
  const canRaise = v.maxRaiseTo > v.currentBet;
  const strong = v.variant === 'holdem' && v.board.length > 0 ? s > Math.min(0.85, fair * 1.9) : s > 0.72;
  const decent = v.variant === 'holdem' && v.board.length > 0 ? s > fair * 1.1 : s > 0.42;

  if (strong && canRaise && r() < 0.8) return { type: 'raise', to: raiseTo(s > 0.9 ? 1 : 0.6) };
  if (v.toCall === 0) {
    // Occasional bluff / thin value bet
    if (canRaise && (decent ? r() < 0.35 : r() < (ctx.level === 'easy' ? 0.05 : 0.1))) return { type: 'raise', to: raiseTo(0.5) };
    return { type: 'check' };
  }
  if (decent || s > potOdds + 0.08 || v.toCall <= v.bb / 2) return { type: 'call' };
  return { type: 'fold' };
}
