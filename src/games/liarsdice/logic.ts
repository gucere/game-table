/**
 * Yalancı Zar (liar's dice). Everyone rolls their dice in secret. Players take turns raising a
 * bid on how many dice on the whole table show a face ("four 5s"), or call the last bid a lie.
 * Then all dice are shown: if there are at least that many, the caller loses a die; otherwise
 * the bidder does. Lose all your dice and you're out; the last player with dice wins.
 * With "ones are wild", every 1 also counts as the face that was bid.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';

export interface Bid {
  count: number;
  face: number;
  by: Seat;
}

export interface Reveal {
  bid: Bid;
  caller: Seat;
  /** How many dice matched */
  actual: number;
  loser: Seat;
  dice: number[][];
}

export interface LiarState {
  n: number;
  dice: number[][];
  turn: Seat;
  bid: Bid | null;
  /** Bids so far this round, newest last */
  history: Bid[];
  wild: boolean;
  phase: 'bid' | 'reveal';
  reveal: Reveal | null;
  /** Host clock: when the reveal ends and the next round starts */
  until: number;
  winner: Seat | null;
}

export interface LiarView extends Omit<LiarState, 'dice'> {
  me: Seat;
  mine: number[];
  counts: number[];
}

export type LiarMove = { type: 'bid'; count: number; face: number } | { type: 'liar' };

export const REVEAL_MS = 5000;

const roll = (k: number, random: () => number) => Array.from({ length: k }, () => 1 + Math.floor(random() * 6)).sort((a, b) => a - b);

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'random' | 'options'>): LiarState {
  const start = Math.min(6, Math.max(2, Number(ctx.options.dice) || 5));
  return {
    n: ctx.numPlayers,
    dice: Array.from({ length: ctx.numPlayers }, () => roll(start, ctx.random)),
    turn: Math.floor(ctx.random() * ctx.numPlayers),
    bid: null,
    history: [],
    wild: ctx.options.wild !== 'off',
    phase: 'bid',
    reveal: null,
    until: 0,
    winner: null,
  };
}

export const totalDice = (s: Pick<LiarState, 'dice'> | Pick<LiarView, 'counts'>) => ('dice' in s ? s.dice.reduce((n, d) => n + d.length, 0) : s.counts.reduce((n, c) => n + c, 0));

/** Is this bid higher than the current one? More dice, or the same number of a higher face */
export function canBid(s: Pick<LiarState, 'bid' | 'wild'>, count: number, face: number, total: number): boolean {
  if (!Number.isInteger(count) || !Number.isInteger(face) || face < 1 || face > 6 || count < 1 || count > total) return false;
  if (s.wild && face === 1) return false;
  if (!s.bid) return true;
  return count > s.bid.count || (count === s.bid.count && face > s.bid.face);
}

export function countFace(dice: number[][], face: number, wild: boolean) {
  return dice.flat().filter((d) => d === face || (wild && d === 1)).length;
}

const alive = (dice: number[][]) => dice.flatMap((d, i) => (d.length ? [i] : []));

function nextAlive(dice: number[][], from: Seat): Seat {
  for (let k = 1; k <= dice.length; k++) {
    const i = (from + k) % dice.length;
    if (dice[i].length) return i;
  }
  return from;
}

export function move(s: LiarState, seat: Seat, m: LiarMove, ctx: Pick<GameCtx, 'now'>): LiarState | string {
  if (s.winner !== null) return 'The game is over';
  if (s.phase !== 'bid') return 'Wait for the next round';
  if (seat !== s.turn) return 'Not your turn';
  if (m?.type === 'bid') {
    if (!canBid(s, m.count, m.face, totalDice(s))) return 'Your bid must be higher than the last one';
    const bid = { count: m.count, face: m.face, by: seat };
    return { ...s, bid, history: [...s.history, bid], turn: nextAlive(s.dice, seat) };
  }
  if (m?.type === 'liar') {
    if (!s.bid) return 'There is no bid to call yet';
    const actual = countFace(s.dice, s.bid.face, s.wild);
    const loser = actual >= s.bid.count ? seat : s.bid.by;
    return { ...s, phase: 'reveal', reveal: { bid: s.bid, caller: seat, actual, loser, dice: s.dice }, until: ctx.now() + REVEAL_MS };
  }
  return 'Invalid move';
}

/** After the reveal: the loser drops a die, everyone rolls again, the loser (or the next player) starts */
export function onTimer(s: LiarState, ctx: Pick<GameCtx, 'random'>): LiarState {
  if (s.phase !== 'reveal' || !s.reveal) return s;
  const counts = s.dice.map((d, i) => d.length - (i === s.reveal!.loser ? 1 : 0));
  const dice = counts.map((k) => (k > 0 ? roll(k, ctx.random) : []));
  const left = alive(dice);
  const winner = left.length === 1 ? left[0] : null;
  const turn = dice[s.reveal.loser].length ? s.reveal.loser : nextAlive(dice, s.reveal.loser);
  return { ...s, dice, phase: 'bid', bid: null, history: [], reveal: winner === null ? null : s.reveal, until: 0, turn, winner };
}

export function view(s: LiarState, seat: Seat): LiarView {
  const { dice, ...rest } = s;
  return { ...rest, me: seat, mine: dice[seat] ?? [], counts: dice.map((d) => d.length) };
}

export function result(s: LiarState): GameResult | null {
  return s.winner === null ? null : { winners: [s.winner] };
}

// ---- Bot: guesses from its own dice and the odds for everyone else's

function expected(v: LiarView, face: number) {
  const mine = v.mine.filter((d) => d === face || (v.wild && d === 1)).length;
  const others = totalDice(v) - v.mine.length;
  const p = v.wild && face !== 1 ? 1 / 3 : 1 / 6;
  return mine + others * p;
}

export function bot(v: LiarView, _seat: Seat, ctx: BotCtx): LiarMove {
  const total = totalDice(v);
  const bluff = { easy: 1.6, normal: 0.9, hard: 0.5 }[ctx.level];
  if (v.bid && v.bid.count > expected(v, v.bid.face) + bluff) return { type: 'liar' };
  // Raise on the face we hold most of
  const faces = (v.wild ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6]).sort((a, b) => expected(v, b) - expected(v, a) || ctx.random() - 0.5);
  let best: LiarMove | null = null;
  let bestRisk = Infinity;
  for (const face of faces) {
    let count = v.bid ? (face > v.bid.face ? v.bid.count : v.bid.count + 1) : Math.max(1, Math.floor(expected(v, face)));
    if (!v.bid) count = Math.max(1, Math.min(count, total));
    if (!canBid(v, count, face, total)) continue;
    const risk = count - expected(v, face) + (ctx.level === 'easy' ? ctx.random() * 1.5 : ctx.random() * 0.3);
    if (risk < bestRisk) {
      bestRisk = risk;
      best = { type: 'bid', count, face };
    }
  }
  if (!best || (v.bid && bestRisk > bluff + 0.6)) return v.bid ? { type: 'liar' } : best ?? { type: 'bid', count: 1, face: v.wild ? 2 : 1 };
  return best;
}
