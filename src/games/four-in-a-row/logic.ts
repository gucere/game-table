import type { BotCtx, GameResult, Seat } from '../../engine/types';

export const ROWS = 6;
export const COLS = 7;

export type Cell = Seat | null;

export interface FourState {
  /** Row-major, row 0 is the top */
  cells: Cell[];
  turn: Seat;
  last: number | null;
  win: number[] | null;
}

export function setup(): FourState {
  return { cells: Array(ROWS * COLS).fill(null), turn: 0, last: null, win: null };
}

export function dropRow(cells: Cell[], col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) if (cells[r * COLS + col] === null) return r;
  return -1;
}

const DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/** The winning line through `idx`, if the piece there completes four in a row */
export function winAt(cells: Cell[], idx: number): number[] | null {
  const who = cells[idx];
  if (who === null) return null;
  const r0 = Math.floor(idx / COLS);
  const c0 = idx % COLS;
  for (const [dr, dc] of DIRS) {
    const line = [idx];
    for (const sign of [1, -1]) {
      let r = r0 + dr * sign;
      let c = c0 + dc * sign;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && cells[r * COLS + c] === who) {
        line.push(r * COLS + c);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (line.length >= 4) return line;
  }
  return null;
}

export function result(s: FourState): GameResult | null {
  if (s.win) return { winners: [s.cells[s.win[0]]!] };
  if (s.cells.every((c) => c !== null)) return { winners: [], draw: true };
  return null;
}

export function move(s: FourState, seat: Seat, col: unknown): FourState | string {
  if (seat !== s.turn) return 'Not your turn';
  if (typeof col !== 'number' || !Number.isInteger(col) || col < 0 || col >= COLS) return 'Bad column';
  const r = dropRow(s.cells, col);
  if (r < 0) return 'That column is full';
  const cells = s.cells.slice();
  const idx = r * COLS + col;
  cells[idx] = seat;
  return { cells, turn: 1 - seat, last: idx, win: winAt(cells, idx) };
}

// ---------------------------------------------------------------- Bot

const WINDOWS: number[][] = (() => {
  const out: number[][] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      for (const [dr, dc] of DIRS) {
        const er = r + dr * 3;
        const ec = c + dc * 3;
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
        out.push([0, 1, 2, 3].map((k) => (r + dr * k) * COLS + (c + dc * k)));
      }
  return out;
})();

const WEIGHT = [0, 1, 6, 40];
const ORDER = [3, 2, 4, 1, 5, 0, 6];
const WIN = 1_000_000;

function evaluate(cells: Cell[], me: Seat): number {
  let score = 0;
  for (let r = 0; r < ROWS; r++) {
    const c = cells[r * COLS + 3];
    if (c === me) score += 4;
    else if (c !== null) score -= 4;
  }
  for (const w of WINDOWS) {
    let mine = 0;
    let theirs = 0;
    for (const i of w) {
      if (cells[i] === me) mine++;
      else if (cells[i] !== null) theirs++;
    }
    if (theirs === 0) score += WEIGHT[mine];
    else if (mine === 0) score -= WEIGHT[theirs];
  }
  return score;
}

function negamax(cells: Cell[], depth: number, alpha: number, beta: number, toMove: Seat): number {
  let any = false;
  let best = -Infinity;
  for (const col of ORDER) {
    const r = dropRow(cells, col);
    if (r < 0) continue;
    any = true;
    const idx = r * COLS + col;
    cells[idx] = toMove;
    let v: number;
    if (winAt(cells, idx)) v = WIN + depth;
    else if (depth <= 1) v = evaluate(cells, toMove);
    else v = -negamax(cells, depth - 1, -beta, -alpha, 1 - toMove);
    cells[idx] = null;
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return any ? best : 0;
}

export function bot(s: FourState, seat: Seat, ctx: BotCtx): number {
  const legal = ORDER.filter((c) => dropRow(s.cells, c) >= 0);
  if (ctx.level === 'easy' && ctx.random() < 0.35) {
    return legal[Math.floor(ctx.random() * legal.length)];
  }
  const depth = { easy: 2, normal: 4, hard: 7 }[ctx.level];
  const cells = s.cells.slice();
  let bestScore = -Infinity;
  let best: number[] = [];
  for (const col of legal) {
    const idx = dropRow(cells, col) * COLS + col;
    cells[idx] = seat;
    const v = winAt(cells, idx) ? WIN + depth : -negamax(cells, depth - 1, -Infinity, Infinity, 1 - seat);
    cells[idx] = null;
    if (v > bestScore) {
      bestScore = v;
      best = [col];
    } else if (v === bestScore) best.push(col);
  }
  return best[Math.floor(ctx.random() * best.length)];
}
