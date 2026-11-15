/**
 * Süper XOX: nine small tic-tac-toe boards inside a big one. The square you play in decides
 * which small board your opponent must play in next. Win a small board with three in a row;
 * win the game with three small boards in a row. If the board you're sent to is already
 * decided, you may play anywhere.
 */
import type { BotCtx, GameResult, Seat } from '../../engine/types';
import { LINES } from '../xox/logic';

export type Owner = Seat | null | 'draw';

export interface SuperState {
  /** 81 cells: board b, square c is at b * 9 + c */
  cells: (Seat | null)[];
  /** Who took each small board (or 'draw' when it filled up) */
  boards: Owner[];
  turn: Seat;
  /** The small board the player must play in, or null for any */
  forced: number | null;
  last: number | null;
  winner: Seat | null;
  over: boolean;
}

export function setup(): SuperState {
  return { cells: Array(81).fill(null), boards: Array(9).fill(null), turn: 0, forced: null, last: null, winner: null, over: false };
}

function lineWinner(get: (i: number) => Owner): Seat | null {
  for (const [a, b, c] of LINES) {
    const x = get(a);
    if (x !== null && x !== 'draw' && x === get(b) && x === get(c)) return x;
  }
  return null;
}

export function legalMoves(s: Pick<SuperState, 'cells' | 'boards' | 'forced' | 'over'>): number[] {
  if (s.over) return [];
  const out: number[] = [];
  for (let b = 0; b < 9; b++) {
    if (s.boards[b] !== null || (s.forced !== null && s.forced !== b)) continue;
    for (let c = 0; c < 9; c++) if (s.cells[b * 9 + c] === null) out.push(b * 9 + c);
  }
  return out;
}

/** Applies a legal move (no checks) */
export function apply(s: SuperState, cell: number): SuperState {
  const cells = s.cells.slice();
  cells[cell] = s.turn;
  const b = Math.floor(cell / 9);
  const c = cell % 9;
  const boards = s.boards.slice();
  const small = lineWinner((i) => cells[b * 9 + i]);
  if (small !== null) boards[b] = small;
  else if (cells.slice(b * 9, b * 9 + 9).every((x) => x !== null)) boards[b] = 'draw';
  const winner = lineWinner((i) => boards[i]);
  const next: SuperState = { cells, boards, turn: 1 - s.turn, forced: boards[c] === null ? c : null, last: cell, winner, over: winner !== null };
  if (!next.over && legalMoves(next).length === 0) next.over = true;
  return next;
}

export function move(s: SuperState, seat: Seat, cell: unknown): SuperState | string {
  if (s.over) return 'The game is over';
  if (seat !== s.turn) return 'Not your turn';
  if (typeof cell !== 'number' || !legalMoves(s).includes(cell)) return 'You can’t play there';
  return apply(s, cell);
}

export function result(s: SuperState): GameResult | null {
  if (!s.over) return null;
  return s.winner === null ? { winners: [], draw: true } : { winners: [s.winner] };
}

// ---- Bot: win or block small boards for the easy level; Monte Carlo playouts above that

function quickPick(s: SuperState, moves: number[]): number | null {
  for (const who of [s.turn, 1 - s.turn]) {
    for (const m of moves) {
      const b = Math.floor(m / 9);
      const cells = s.cells.slice();
      cells[m] = who;
      if (lineWinner((i) => cells[b * 9 + i]) === who) return m;
    }
  }
  return null;
}

function playout(s: SuperState, random: () => number): Seat | null {
  let x = s;
  for (let k = 0; k < 81 && !x.over; k++) {
    const moves = legalMoves(x);
    const m = (random() < 0.5 ? quickPick(x, moves) : null) ?? moves[Math.floor(random() * moves.length)];
    x = apply(x, m);
  }
  return x.winner;
}

export function bot(s: SuperState, seat: Seat, ctx: BotCtx): number {
  const moves = legalMoves(s);
  if (moves.length === 1) return moves[0];
  if (ctx.level === 'easy') return quickPick(s, moves) ?? moves[Math.floor(ctx.random() * moves.length)];
  // A move that wins the whole game right now
  for (const m of moves) if (apply(s, m).winner === seat) return m;
  const budget = ctx.level === 'hard' ? 700 : 250;
  const t0 = Date.now();
  const stats = moves.map((m) => ({ m, score: 0, runs: 0 }));
  let total = 0;
  while (Date.now() - t0 < budget) {
    let best = stats[0];
    let bestU = -Infinity;
    for (const st of stats) {
      const u = st.runs === 0 ? Infinity : st.score / st.runs + Math.sqrt((2 * Math.log(total + 1)) / st.runs);
      if (u > bestU) {
        bestU = u;
        best = st;
      }
    }
    const w = playout(apply(s, best.m), ctx.random);
    best.runs++;
    best.score += w === seat ? 1 : w === null ? 0.5 : 0;
    total++;
  }
  stats.sort((a, b) => b.runs - a.runs);
  return stats[0].m;
}
