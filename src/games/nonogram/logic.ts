/**
 * Nonogram: fill the grid so every row and column matches its clue (the lengths of the
 * filled blocks, in order). Puzzles are generated so they can be solved by pure logic,
 * one line at a time, which also means the answer is unique.
 */
import type { GameCtx, GameResult, Seat } from '../../engine/types';

export interface NonoState {
  size: number;
  solution: boolean[];
  rows: number[][];
  cols: number[][];
  /** 0 empty, 1 filled, 2 crossed out */
  cells: number[];
  startedAt: number;
  finishedAt: number | null;
}
export type NonoMove = { type: 'set'; cells: number[]; value: 0 | 1 | 2 };
export type NonoView = Omit<NonoState, 'solution'>;

export function clue(line: boolean[]): number[] {
  const out: number[] = [];
  let run = 0;
  for (const x of line) {
    if (x) run++;
    else if (run) {
      out.push(run);
      run = 0;
    }
  }
  if (run) out.push(run);
  return out;
}

/**
 * Given a clue and what we know (-1 unknown, 0 empty, 1 filled), work out which cells
 * are certain. Returns null if the line is impossible.
 */
export function solveLine(blocks: number[], known: number[]): number[] | null {
  const n = known.length;
  const canFill = Array(n).fill(false);
  const canEmpty = Array(n).fill(false);
  let any = false;
  const memo = new Map<string, boolean>();
  // place(b, pos): can blocks b.. be placed starting at or after pos, consistent with `known`?
  const place = (b: number, pos: number, cur: number[]): boolean => {
    const key = `${b},${pos}`;
    if (b === blocks.length) {
      for (let i = pos; i < n; i++) if (known[i] === 1) return false;
      for (let i = pos; i < n; i++) cur[i] = 0;
      record(cur);
      return true;
    }
    if (memo.has(key) && !memo.get(key)) return false;
    let ok = false;
    const len = blocks[b];
    const rest = blocks.slice(b + 1).reduce((a, x) => a + x + 1, 0);
    for (let s = pos; s + len + rest <= n; s++) {
      if (known[s - 1] === 1 && s - 1 >= pos) break;
      let fits = true;
      for (let i = s; i < s + len; i++) if (known[i] === 0) fits = false;
      if (s + len < n && known[s + len] === 1) fits = false;
      if (fits) {
        const c = cur.slice();
        for (let i = pos; i < s; i++) c[i] = 0;
        for (let i = s; i < s + len; i++) c[i] = 1;
        if (s + len < n) c[s + len] = 0;
        if (place(b + 1, s + len + 1, c)) ok = true;
      }
      if (known[s] === 1) break;
    }
    memo.set(key, ok);
    return ok;
  };
  const record = (cur: number[]) => {
    any = true;
    cur.forEach((v, i) => (v ? (canFill[i] = true) : (canEmpty[i] = true)));
  };
  place(0, 0, Array(n).fill(0));
  if (!any) return null;
  return known.map((k, i) => (canFill[i] && !canEmpty[i] ? 1 : canEmpty[i] && !canFill[i] ? 0 : k));
}

/** Can the puzzle be solved line by line? */
export function lineSolvable(size: number, rows: number[][], cols: number[][]): boolean {
  const g = Array(size * size).fill(-1);
  for (let changed = true; changed; ) {
    changed = false;
    for (let k = 0; k < size; k++) {
      for (const isRow of [true, false]) {
        const idx = Array.from({ length: size }, (_, j) => (isRow ? k * size + j : j * size + k));
        const res = solveLine(isRow ? rows[k] : cols[k], idx.map((i) => g[i]));
        if (!res) return false;
        res.forEach((v, j) => {
          if (v !== g[idx[j]]) {
            g[idx[j]] = v;
            changed = true;
          }
        });
      }
    }
  }
  return g.every((x) => x !== -1);
}

export function generate(size: number, random: () => number) {
  for (let attempt = 0; ; attempt++) {
    const density = 0.52 + random() * 0.12;
    const solution = Array.from({ length: size * size }, () => random() < density);
    const rows = Array.from({ length: size }, (_, r) => clue(solution.slice(r * size, r * size + size)));
    const cols = Array.from({ length: size }, (_, c) => clue(Array.from({ length: size }, (_, r) => solution[r * size + c])));
    if (lineSolvable(size, rows, cols) || attempt > 400) return { solution, rows, cols };
  }
}

export function setup(ctx: Pick<GameCtx, 'random' | 'options' | 'now'>): NonoState {
  const size = Number(ctx.options.size ?? 10);
  const { solution, rows, cols } = generate(size, ctx.random);
  return { size, solution, rows, cols, cells: Array(size * size).fill(0), startedAt: ctx.now(), finishedAt: null };
}

const solved = (s: NonoState, cells: number[]) => s.rows.every((cl, r) => clue(cells.slice(r * s.size, r * s.size + s.size).map((x) => x === 1)).join() === cl.join()) &&
  s.cols.every((cl, c) => clue(Array.from({ length: s.size }, (_, r) => cells[r * s.size + c] === 1)).join() === cl.join());

export function move(s: NonoState, _seat: Seat, m: NonoMove, ctx: Pick<GameCtx, 'now'>): NonoState | string {
  if (s.finishedAt !== null) return 'Solved!';
  if (!Array.isArray(m?.cells) || ![0, 1, 2].includes(m.value)) return 'Bad move';
  const cells = s.cells.slice();
  for (const i of m.cells) if (Number.isInteger(i) && i >= 0 && i < cells.length) cells[i] = m.value;
  return { ...s, cells, finishedAt: solved(s, cells) ? ctx.now() : null };
}

export const activePlayers = (s: NonoState): Seat[] => (s.finishedAt === null ? [0] : []);
export const view = (s: NonoState): NonoView => {
  const { solution: _solution, ...rest } = s;
  return rest;
};
export function result(s: NonoState): GameResult | null {
  if (s.finishedAt === null) return null;
  const secs = Math.round((s.finishedAt - s.startedAt) / 1000);
  return { winners: [0], message: `Solved in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} 🖼️` };
}
