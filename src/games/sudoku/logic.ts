import type { GameCtx, GameResult } from '../../engine/types';

export const CLUES: Record<string, number> = { easy: 40, medium: 32, hard: 26 };

export interface SudokuState {
  givens: boolean[];
  cells: number[]; // 0 = empty
  notes: number[]; // bitmask of pencil marks (bit v = note v)
  solution: number[];
  mistakes: number;
  startedAt: number;
  endedAt: number | null;
}

export type SudokuView = Omit<SudokuState, 'solution'> & { conflicts: boolean[] };

export type SudokuMove = { type: 'set'; i: number; v: number } | { type: 'note'; i: number; v: number };

const row = (i: number) => Math.floor(i / 9);
const col = (i: number) => i % 9;
const box = (i: number) => Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3);

export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) =>
  Array.from({ length: 81 }, (_, j) => j).filter((j) => j !== i && (row(j) === row(i) || col(j) === col(i) || box(j) === box(i))),
);

function candidates(grid: number[], i: number): number[] {
  const used = new Set(PEERS[i].map((j) => grid[j]));
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((v) => !used.has(v));
}

/** Count solutions up to `limit` (backtracking, most-constrained cell first) */
export function countSolutions(grid: number[], limit = 2): number {
  const g = grid.slice();
  let count = 0;
  const go = (): void => {
    if (count >= limit) return;
    let best = -1;
    let bestC: number[] = [];
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const c = candidates(g, i);
      if (c.length === 0) return;
      if (best < 0 || c.length < bestC.length) {
        best = i;
        bestC = c;
        if (c.length === 1) break;
      }
    }
    if (best < 0) {
      count++;
      return;
    }
    for (const v of bestC) {
      g[best] = v;
      go();
      g[best] = 0;
      if (count >= limit) return;
    }
  };
  go();
  return count;
}

function shuffled<T>(a: T[], random: () => number) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export function generate(random: () => number, clues: number): { puzzle: number[]; solution: number[] } {
  const g = Array(81).fill(0);
  const fill = (i: number): boolean => {
    if (i === 81) return true;
    for (const v of shuffled(candidates(g, i), random)) {
      g[i] = v;
      if (fill(i + 1)) return true;
    }
    g[i] = 0;
    return false;
  };
  fill(0);
  const solution = g.slice();
  const puzzle = g.slice();
  let filled = 81;
  for (const i of shuffled(Array.from({ length: 81 }, (_, k) => k), random)) {
    if (filled <= clues) break;
    const keep = puzzle[i];
    puzzle[i] = 0;
    if (countSolutions(puzzle, 2) !== 1) puzzle[i] = keep;
    else filled--;
  }
  return { puzzle, solution };
}

export function setup(ctx: Pick<GameCtx, 'options' | 'random' | 'now'>): SudokuState {
  const { puzzle, solution } = generate(ctx.random, CLUES[ctx.options.level] ?? 40);
  return {
    givens: puzzle.map((v) => v !== 0),
    cells: puzzle,
    notes: Array(81).fill(0),
    solution,
    mistakes: 0,
    startedAt: ctx.now(),
    endedAt: null,
  };
}

export function conflicts(cells: number[]): boolean[] {
  return cells.map((v, i) => v !== 0 && PEERS[i].some((j) => cells[j] === v));
}

export function move(s: SudokuState, m: SudokuMove, now: number): SudokuState | string {
  if (s.endedAt) return 'Solved already';
  if (!m || !Number.isInteger(m.i) || m.i < 0 || m.i > 80 || !Number.isInteger(m.v) || m.v < 0 || m.v > 9) return 'Bad move';
  if (s.givens[m.i]) return 'That number is part of the puzzle';
  if (m.type === 'note') {
    if (s.cells[m.i] || m.v === 0) return s;
    const notes = s.notes.slice();
    notes[m.i] ^= 1 << m.v;
    return { ...s, notes };
  }
  const cells = s.cells.slice();
  cells[m.i] = m.v;
  const notes = s.notes.slice();
  if (m.v) {
    notes[m.i] = 0;
    // Clear that number from peer notes
    for (const j of PEERS[m.i]) notes[j] &= ~(1 << m.v);
  }
  const mistakes = s.mistakes + (m.v && m.v !== s.solution[m.i] ? 1 : 0);
  const done = cells.every((v, i) => v === s.solution[i]);
  return { ...s, cells, notes, mistakes, endedAt: done ? now : null };
}

export function result(s: SudokuState): GameResult | null {
  if (!s.endedAt) return null;
  const secs = Math.round((s.endedAt - s.startedAt) / 1000);
  const t = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  return { winners: [0], message: `Solved in ${t}! 🎉` };
}

export function view(s: SudokuState): SudokuView {
  const { solution: _solution, ...rest } = s;
  return { ...rest, conflicts: conflicts(s.cells) };
}
