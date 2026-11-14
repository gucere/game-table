/**
 * Birleştir: slide every tile one way; equal neighbors merge into their sum.
 * A new 2 (sometimes a 4) appears after each move. Keep going until the board locks up.
 */
import type { GameCtx, GameResult, Seat } from '../../engine/types';

export type Dir = 'up' | 'down' | 'left' | 'right';
export interface MergeState {
  size: number;
  grid: number[];
  score: number;
  best: number;
  moves: number;
  /** Cells that merged / appeared on the last move (for the little pop animation) */
  merged: number[];
  spawned: number | null;
  over: boolean;
}
export type MergeMove = { type: 'slide'; dir: Dir };

function spawn(grid: number[], random: () => number): { grid: number[]; at: number | null } {
  const empty = grid.flatMap((v, i) => (v ? [] : [i]));
  if (!empty.length) return { grid, at: null };
  const at = empty[Math.floor(random() * empty.length)];
  const g = grid.slice();
  g[at] = random() < 0.9 ? 2 : 4;
  return { grid: g, at };
}

export function setup(ctx: Pick<GameCtx, 'random' | 'options'>): MergeState {
  const size = Number(ctx.options.size ?? 4);
  let grid = Array(size * size).fill(0);
  grid = spawn(grid, ctx.random).grid;
  grid = spawn(grid, ctx.random).grid;
  return { size, grid, score: 0, best: 2, moves: 0, merged: [], spawned: null, over: false };
}

/** Lines of cell indices in the order tiles slide towards (first = the wall) */
function lines(size: number, dir: Dir): number[][] {
  const out: number[][] = [];
  for (let a = 0; a < size; a++) {
    const line: number[] = [];
    for (let b = 0; b < size; b++) {
      if (dir === 'left') line.push(a * size + b);
      if (dir === 'right') line.push(a * size + (size - 1 - b));
      if (dir === 'up') line.push(b * size + a);
      if (dir === 'down') line.push((size - 1 - b) * size + a);
    }
    out.push(line);
  }
  return out;
}

export function slide(grid: number[], size: number, dir: Dir) {
  const g = grid.slice();
  let gained = 0;
  const merged: number[] = [];
  for (const line of lines(size, dir)) {
    const vals = line.map((i) => g[i]).filter(Boolean);
    const out: number[] = [];
    for (let k = 0; k < vals.length; k++) {
      if (vals[k] === vals[k + 1]) {
        out.push(vals[k] * 2);
        gained += vals[k] * 2;
        merged.push(line[out.length - 1]);
        k++;
      } else out.push(vals[k]);
    }
    line.forEach((i, k) => (g[i] = out[k] ?? 0));
  }
  return { grid: g, gained, merged, changed: g.some((v, i) => v !== grid[i]) };
}

export const canMove = (grid: number[], size: number) => (['up', 'down', 'left', 'right'] as Dir[]).some((d) => slide(grid, size, d).changed);

export function move(s: MergeState, _seat: Seat, m: MergeMove, ctx: Pick<GameCtx, 'random'>): MergeState | string {
  if (s.over) return 'No moves left';
  if (!['up', 'down', 'left', 'right'].includes(m?.dir)) return 'Pick a direction';
  const r = slide(s.grid, s.size, m.dir);
  if (!r.changed) return 'Nothing moves that way';
  const sp = spawn(r.grid, ctx.random);
  return {
    ...s,
    grid: sp.grid,
    score: s.score + r.gained,
    best: Math.max(s.best, ...sp.grid),
    moves: s.moves + 1,
    merged: r.merged,
    spawned: sp.at,
    over: !canMove(sp.grid, s.size),
  };
}

export const activePlayers = (s: MergeState): Seat[] => (s.over ? [] : [0]);

export function result(s: MergeState): GameResult | null {
  return s.over ? { winners: [0], message: `No moves left. Score ${s.score}, biggest tile ${s.best}.` } : null;
}
