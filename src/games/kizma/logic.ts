/**
 * Kızma Birader ("don't get angry, brother"): the cross-shaped race game.
 * Roll a 6 to bring a piece out, race it around the 40-square track and into your
 * four home squares. Land on someone and they go back to start. A 6 rolls again.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';

export const TRACK = 40;
export const HOME = 4;
/** Position of a piece: -1 in the yard, 0..39 steps from its own start, 40..43 home squares */
export type Pos = number;

/** Board coordinates (column, row on an 11×11 grid) of the 40 track squares, clockwise */
export const PATH: [number, number][] = [
  [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [4, 3], [4, 2], [4, 1], [4, 0], [5, 0],
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [10, 5],
  [10, 6], [9, 6], [8, 6], [7, 6], [6, 6], [6, 7], [6, 8], [6, 9], [6, 10], [5, 10],
  [4, 10], [4, 9], [4, 8], [4, 7], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 5],
];
export const HOMES: [number, number][][] = [
  [[1, 5], [2, 5], [3, 5], [4, 5]],
  [[5, 1], [5, 2], [5, 3], [5, 4]],
  [[9, 5], [8, 5], [7, 5], [6, 5]],
  [[5, 9], [5, 8], [5, 7], [5, 6]],
];
export const YARDS: [number, number][][] = [
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[9, 0], [10, 0], [9, 1], [10, 1]],
  [[9, 9], [10, 9], [9, 10], [10, 10]],
  [[0, 9], [1, 9], [0, 10], [1, 10]],
];

export interface KizmaState {
  n: number;
  /** Board corner each player uses (2 players sit opposite) */
  slot: number[];
  pieces: Pos[][];
  turn: Seat;
  phase: 'roll' | 'move' | 'done';
  dice: number | null;
  /** Rolls left this turn when nothing is out on the track */
  tries: number;
  last: { seat: Seat; dice: number; captured: Seat | null } | null;
  winner: Seat | null;
}

export type KizmaMove = { type: 'roll' } | { type: 'move'; piece: number };
export type KizmaView = KizmaState & { me: Seat; movable: number[] };

export const absolute = (slot: number, rel: number) => (slot * 10 + rel) % TRACK;

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'random'>): KizmaState {
  const n = ctx.numPlayers;
  const slot = n === 2 ? [0, 2] : [0, 1, 2, 3].slice(0, n);
  const s: KizmaState = {
    n,
    slot,
    pieces: Array.from({ length: n }, () => [-1, -1, -1, -1]),
    turn: Math.floor(ctx.random() * n),
    phase: 'roll',
    dice: null,
    tries: 3,
    last: null,
    winner: null,
  };
  return s;
}

function occupant(s: KizmaState, abs: number): { seat: Seat; piece: number } | null {
  for (let seat = 0; seat < s.n; seat++) {
    const i = s.pieces[seat].findIndex((p) => p >= 0 && p < TRACK && absolute(s.slot[seat], p) === abs);
    if (i >= 0) return { seat, piece: i };
  }
  return null;
}

/** Where piece `i` would end up with this roll, or null if it can't move */
export function target(s: KizmaState, seat: Seat, i: number, d: number): Pos | null {
  const p = s.pieces[seat][i];
  const mine = s.pieces[seat];
  if (p === -1) {
    if (d !== 6) return null;
    const startOcc = occupant(s, absolute(s.slot[seat], 0));
    return startOcc?.seat === seat ? null : 0;
  }
  const t = p + d;
  if (t > TRACK + HOME - 1) return null;
  if (t >= TRACK) {
    // No jumping over your own pieces inside the home row
    for (let h = Math.max(TRACK, p + 1); h <= t; h++) if (mine.includes(h)) return null;
    return t;
  }
  const occ = occupant(s, absolute(s.slot[seat], t));
  return occ?.seat === seat ? null : t;
}

export function movable(s: KizmaState, seat: Seat): number[] {
  if (s.phase !== 'move' || s.turn !== seat || s.dice === null) return [];
  return [0, 1, 2, 3].filter((i) => target(s, seat, i, s.dice!) !== null);
}

/** Pieces out on the track (or able to move in the home row) */
function hasPlayable(s: KizmaState, seat: Seat) {
  const ps = s.pieces[seat];
  return ps.some((p, i) => {
    if (p < 0) return false;
    if (p < TRACK) return true;
    // A home piece can still move if there's a free square ahead of it
    for (let h = p + 1; h < TRACK + HOME; h++) if (!ps.includes(h)) return [1, 2, 3].some((d) => target(s, seat, i, d) !== null);
    return false;
  });
}

const done = (ps: Pos[]) => ps.every((p) => p >= TRACK);

function endTurn(s: KizmaState): KizmaState {
  const turn = ((s.turn + 1) % s.n) as Seat;
  return { ...s, turn, phase: 'roll', dice: null, tries: hasPlayable(s, turn) ? 1 : 3 };
}

export function move(s: KizmaState, seat: Seat, m: KizmaMove, ctx: Pick<GameCtx, 'random'>): KizmaState | string {
  if (s.phase === 'done') return 'The game is over';
  if (seat !== s.turn) return 'Not your turn';
  if (m.type === 'roll') {
    if (s.phase !== 'roll') return 'Move a piece first';
    const d = 1 + Math.floor(ctx.random() * 6);
    const rolled: KizmaState = { ...s, dice: d, phase: 'move', tries: s.tries - 1, last: { seat, dice: d, captured: null } };
    if (movable(rolled, seat).length) return rolled;
    // Nothing to move: roll again if you still have tries (nothing out yet), otherwise pass
    if (rolled.tries > 0) return { ...rolled, phase: 'roll' };
    return endTurn(rolled);
  }
  if (s.phase !== 'move' || s.dice === null) return 'Roll the dice first';
  const to = target(s, seat, m.piece, s.dice);
  if (to === null || !Number.isInteger(m.piece)) return 'That piece cannot move';
  const pieces = s.pieces.map((ps) => ps.slice());
  let captured: Seat | null = null;
  if (to < TRACK) {
    const occ = occupant(s, absolute(s.slot[seat], to));
    if (occ && occ.seat !== seat) {
      pieces[occ.seat][occ.piece] = -1;
      captured = occ.seat;
    }
  }
  pieces[seat][m.piece] = to;
  const next: KizmaState = { ...s, pieces, last: { seat, dice: s.dice, captured } };
  if (done(pieces[seat])) return { ...next, phase: 'done', winner: seat, dice: null };
  // A six earns another roll
  if (s.dice === 6) return { ...next, phase: 'roll', dice: null, tries: 1 };
  return endTurn(next);
}

export const activePlayers = (s: KizmaState): Seat[] => (s.phase === 'done' ? [] : [s.turn]);

export const view = (s: KizmaState, seat: Seat): KizmaView => ({ ...s, me: seat, movable: movable(s, seat) });

export function result(s: KizmaState): GameResult | null {
  return s.winner === null ? null : { winners: [s.winner] };
}

export function bot(v: KizmaView, seat: Seat, ctx: BotCtx): KizmaMove {
  if (v.phase === 'roll') return { type: 'roll' };
  const opts = v.movable;
  if (ctx.level === 'easy' && ctx.random() < 0.5) return { type: 'move', piece: opts[Math.floor(ctx.random() * opts.length)] };
  const d = v.dice!;
  const score = (i: number) => {
    const from = v.pieces[seat][i];
    const to = target(v, seat, i, d)!;
    let sc = 0;
    if (to >= TRACK) sc += 60;
    if (from === -1) sc += 45;
    if (to < TRACK) {
      const occ = occupant(v, absolute(v.slot[seat], to));
      if (occ && occ.seat !== seat) sc += 80;
      // Danger: an opponent 1..6 squares behind the landing square
      for (let o = 0; o < v.n; o++) {
        if (o === seat) continue;
        for (const p of v.pieces[o]) {
          if (p < 0 || p >= TRACK) continue;
          const gap = (absolute(v.slot[seat], to) - absolute(v.slot[o], p) + TRACK) % TRACK;
          if (gap >= 1 && gap <= 6) sc -= ctx.level === 'hard' ? 30 : 15;
        }
      }
    }
    sc += from >= 0 ? from * 0.5 : 0;
    return sc;
  };
  return { type: 'move', piece: opts.slice().sort((a, b) => score(b) - score(a))[0] };
}
