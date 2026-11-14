import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';

export type Side = 'heads' | 'tails';
export const TARGET = 3;

export interface Flip {
  call: Side | null;
  outcome: Side;
  caller: Seat;
}

export interface CoinState {
  numPlayers: number;
  flips: Flip[];
  scores: number[];
  caller: Seat;
}

export type CoinMove = { type: 'call'; side: Side } | { type: 'flip' };

export function setup(ctx: Pick<GameCtx, 'numPlayers'>): CoinState {
  return { numPlayers: ctx.numPlayers, flips: [], scores: Array(ctx.numPlayers).fill(0), caller: 0 };
}

/** Solo play never ends; two players race to TARGET correct calls */
export function result(s: CoinState): GameResult | null {
  if (s.numPlayers < 2) return null;
  const w = s.scores.findIndex((x) => x >= TARGET);
  return w >= 0 ? { winners: [w] } : null;
}

export function move(s: CoinState, seat: Seat, m: unknown, random: () => number): CoinState | string {
  if (seat !== s.caller) return 'Not your turn';
  const mv = m as CoinMove;
  const outcome: Side = random() < 0.5 ? 'heads' : 'tails';
  if (mv?.type === 'flip' && s.numPlayers === 1) {
    return { ...s, flips: [...s.flips, { call: null, outcome, caller: seat }] };
  }
  if (mv?.type !== 'call' || (mv.side !== 'heads' && mv.side !== 'tails')) return 'Call heads or tails';
  const scores = s.scores.slice();
  const right = mv.side === outcome;
  if (s.numPlayers === 1) {
    if (right) scores[0]++;
  } else {
    scores[right ? seat : 1 - seat]++;
  }
  return {
    ...s,
    scores,
    flips: [...s.flips, { call: mv.side, outcome, caller: seat }],
    caller: s.numPlayers === 1 ? 0 : 1 - seat,
  };
}

/** Current run of correct calls (solo) */
export function streak(s: CoinState): number {
  let n = 0;
  for (let i = s.flips.length - 1; i >= 0; i--) {
    const f = s.flips[i];
    if (f.call === null) continue;
    if (f.call !== f.outcome) break;
    n++;
  }
  return n;
}

export function bot(_s: CoinState, _seat: Seat, ctx: BotCtx): CoinMove {
  return { type: 'call', side: ctx.random() < 0.5 ? 'heads' : 'tails' };
}
