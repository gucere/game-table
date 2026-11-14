import type { BotCtx, GameResult, Seat } from '../../engine/types';

export type Cell = Seat | null;

export interface XoxState {
  board: Cell[];
  turn: Seat;
}

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function setup(): XoxState {
  return { board: Array(9).fill(null), turn: 0 };
}

export function findWin(board: Cell[]): { seat: Seat; line: number[] } | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] !== null && board[a] === board[b] && board[a] === board[c]) {
      return { seat: board[a]!, line };
    }
  }
  return null;
}

export function result(s: XoxState): GameResult | null {
  const win = findWin(s.board);
  if (win) return { winners: [win.seat] };
  if (s.board.every((c) => c !== null)) return { winners: [], draw: true };
  return null;
}

export function move(s: XoxState, seat: Seat, cell: unknown): XoxState | string {
  if (seat !== s.turn) return 'Not your turn';
  if (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 0 || cell > 8) return 'Bad cell';
  if (s.board[cell] !== null) return 'That cell is taken';
  const board = s.board.slice();
  board[cell] = seat;
  return { board, turn: 1 - seat };
}

function minimax(board: Cell[], toMove: Seat, me: Seat, depth: number): number {
  const win = findWin(board);
  if (win) return win.seat === me ? 10 - depth : depth - 10;
  if (board.every((c) => c !== null)) return 0;
  let best = toMove === me ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (board[i] !== null) continue;
    board[i] = toMove;
    const v = minimax(board, 1 - toMove, me, depth + 1);
    board[i] = null;
    best = toMove === me ? Math.max(best, v) : Math.min(best, v);
  }
  return best;
}

export function bot(s: XoxState, seat: Seat, ctx: BotCtx): number {
  const free = s.board.flatMap((c, i) => (c === null ? [i] : []));
  const sloppy = { easy: 0.6, normal: 0.25, hard: 0 }[ctx.level];
  if (ctx.random() < sloppy) return free[Math.floor(ctx.random() * free.length)];
  let bestScore = -Infinity;
  let best: number[] = [];
  for (const i of free) {
    const b = s.board.slice();
    b[i] = seat;
    const v = minimax(b, 1 - seat, seat, 1);
    if (v > bestScore) {
      bestScore = v;
      best = [i];
    } else if (v === bestScore) best.push(i);
  }
  return best[Math.floor(ctx.random() * best.length)];
}
