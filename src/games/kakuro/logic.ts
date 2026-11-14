/**
 * Kakuro: a crossword of numbers. Each run of white cells must add up to the clue
 * to its left (across) or above it (down), using 1–9 with no digit repeated in a run.
 * Generated puzzles are checked with a solver and kept only if the answer is unique
 * (with a time budget; the checker accepts any grid that satisfies every clue anyway).
 */
import type { GameCtx, GameResult, Seat } from '../../engine/types';
import { shuffle } from '../cards/cards';

export interface Run {
  cells: number[];
  sum: number;
  /** The black cell holding the clue */
  clue: number;
  across: boolean;
}

export interface KakuroState {
  size: number;
  white: boolean[];
  runs: Run[];
  digits: number[];
  startedAt: number;
  finishedAt: number | null;
}
export type KakuroMove = { type: 'set'; cell: number; digit: number };

function findRuns(size: number, white: boolean[]): Run[] {
  const runs: Run[] = [];
  for (const across of [true, false]) {
    for (let a = 0; a < size; a++) {
      let cur: number[] = [];
      for (let b = 0; b <= size; b++) {
        const i = across ? a * size + b : b * size + a;
        if (b < size && white[i]) cur.push(i);
        else {
          if (cur.length) runs.push({ cells: cur, sum: 0, clue: across ? cur[0] - 1 : cur[0] - size, across });
          cur = [];
        }
      }
    }
  }
  return runs;
}

function makePattern(size: number, random: () => number): boolean[] | null {
  const white = Array.from({ length: size * size }, (_, i) => i >= size && i % size !== 0 && random() < 0.86);
  // Every white cell needs an across and a down run of 2..9 cells; trim until stable
  for (let changed = true; changed; ) {
    changed = false;
    for (const r of findRuns(size, white)) {
      if (r.cells.length === 1) {
        white[r.cells[0]] = false;
        changed = true;
      } else if (r.cells.length > 9) {
        white[r.cells[4]] = false;
        changed = true;
      }
    }
  }
  const count = white.filter(Boolean).length;
  return count >= (size - 1) * (size - 1) * 0.5 ? white : null;
}

function fill(size: number, white: boolean[], runs: Run[], random: () => number): number[] | null {
  const cells = white.flatMap((w, i) => (w ? [i] : []));
  const runsOf = new Map<number, Run[]>();
  for (const r of runs) for (const c of r.cells) runsOf.set(c, [...(runsOf.get(c) ?? []), r]);
  const digits = Array(size * size).fill(0);
  let steps = 0;
  const go = (k: number): boolean => {
    if (k === cells.length) return true;
    if (++steps > 20000) return false;
    const c = cells[k];
    // Favour low and high digits: their sums have fewer combinations, so fewer ambiguities
    const ds = [1, 2, 3, 4, 5, 6, 7, 8, 9]
      .map((d) => [d, Math.abs(d - 5) + random() * 4] as const)
      .sort((a, b) => b[1] - a[1])
      .map(([d]) => d);
    for (const d of ds) {
      if (runsOf.get(c)!.some((r) => r.cells.some((x) => digits[x] === d))) continue;
      digits[c] = d;
      if (go(k + 1)) return true;
      digits[c] = 0;
    }
    return false;
  };
  return go(0) ? digits : null;
}

const comboCache = new Map<string, number[]>();
/** Bitmasks (bit d for digit d) of every set of `len` different digits adding up to `sum` */
export function comboMasks(len: number, sum: number): number[] {
  const key = `${len},${sum}`;
  if (comboCache.has(key)) return comboCache.get(key)!;
  const out: number[] = [];
  const go = (start: number, left: number, rem: number, mask: number) => {
    if (left === 0) {
      if (rem === 0) out.push(mask);
      return;
    }
    for (let d = start; d <= 9 && d <= rem; d++) go(d + 1, left - 1, rem - d, mask | (1 << d));
  };
  go(1, len, sum, 0);
  comboCache.set(key, out);
  return out;
}

const bits = (m: number) => {
  let c = 0;
  for (; m; m &= m - 1) c++;
  return c;
};

/**
 * Find up to `limit` solutions (null if the search ran too long). Each run keeps the
 * digit combinations that can still make its sum; the most constrained square goes next.
 */
export function solve(size: number, white: boolean[], runs: Run[], limit = 2, budget = 60000): number[][] | null {
  const cells = white.flatMap((w, i) => (w ? [i] : []));
  const runsOf = new Map<number, number[]>();
  runs.forEach((r, k) => r.cells.forEach((c) => runsOf.set(c, [...(runsOf.get(c) ?? []), k])));
  const combos = runs.map((r) => comboMasks(r.cells.length, r.sum));
  const used = runs.map(() => 0);
  const digits = Array(size * size).fill(0);
  const found: number[][] = [];
  let steps = 0;
  const cand = (c: number) => {
    let mask = 0x3fe;
    for (const k of runsOf.get(c)!) {
      let m = 0;
      for (const combo of combos[k]) if ((combo & used[k]) === used[k]) m |= combo & ~used[k];
      mask &= m;
    }
    return mask;
  };
  const go = (left: number) => {
    if (found.length >= limit || ++steps > budget) return;
    if (left === 0) {
      found.push(digits.slice());
      return;
    }
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (const c of cells) {
      if (digits[c]) continue;
      const m = cand(c);
      const n = bits(m);
      if (n === 0) return;
      if (n < bestCount) {
        best = c;
        bestMask = m;
        bestCount = n;
        if (n === 1) break;
      }
    }
    for (let d = 1; d <= 9; d++) {
      if (!(bestMask & (1 << d))) continue;
      digits[best] = d;
      for (const k of runsOf.get(best)!) used[k] |= 1 << d;
      go(left - 1);
      for (const k of runsOf.get(best)!) used[k] &= ~(1 << d);
      digits[best] = 0;
      if (found.length >= limit) return;
    }
  };
  go(cells.length);
  return steps > budget ? null : found;
}

export function countSolutions(size: number, white: boolean[], runs: Run[], limit = 2, budget = 60000): number {
  const r = solve(size, white, runs, limit, budget);
  return r === null ? limit : r.length;
}

function trim(size: number, white: boolean[]) {
  for (let changed = true; changed; ) {
    changed = false;
    for (const r of findRuns(size, white)) {
      if (r.cells.length === 1) {
        white[r.cells[0]] = false;
        changed = true;
      }
    }
  }
}

/**
 * Build a puzzle from a random filled grid, then make the answer unique: while the solver
 * finds a different solution, black out a square where the two disagree. The original
 * digits stay a valid answer, so the clues are simply recomputed from them.
 */
export function generate(size: number, random: () => number, tries = 40) {
  let fallback: { white: boolean[]; runs: Run[] } | null = null;
  const unique: { white: boolean[]; runs: Run[] }[] = [];
  const minWhite = (size - 1) * (size - 1) * 0.4;
  for (let t = 0; t < tries && unique.length < 4; t++) {
    const white = makePattern(size, random);
    if (!white) continue;
    const digits = fill(size, white, findRuns(size, white), random);
    if (!digits) continue;
    for (let round = 0; round < 25; round++) {
      const runs = findRuns(size, white);
      for (const r of runs) r.sum = r.cells.reduce((a, c) => a + digits[c], 0);
      if (white.filter(Boolean).length < minWhite) break;
      fallback ??= { white: white.slice(), runs };
      const sols = solve(size, white, runs, 2, 40000);
      if (sols === null) break;
      const other = sols.find((x) => x.some((d, i) => white[i] && d !== digits[i]));
      if (!other) {
        unique.push({ white: white.slice(), runs });
        break;
      }
      // Black out the differing square that costs the fewest other squares
      const diff = shuffle(
        white.flatMap((w, i) => (w && other[i] !== digits[i] ? [i] : [])),
        random,
      );
      let bestWhite: boolean[] | null = null;
      for (const c of diff) {
        const w2 = white.slice();
        w2[c] = false;
        trim(size, w2);
        if (!bestWhite || w2.filter(Boolean).length > bestWhite.filter(Boolean).length) bestWhite = w2;
      }
      bestWhite!.forEach((w, i) => (white[i] = w));
    }
  }
  // Prefer the fullest grid among the unique ones
  if (unique.length) return unique.sort((a, b) => b.white.filter(Boolean).length - a.white.filter(Boolean).length)[0];
  return fallback!;
}

export function setup(ctx: Pick<GameCtx, 'random' | 'options' | 'now'>): KakuroState {
  const size = Number(ctx.options.size ?? 7);
  let g = generate(size, ctx.random);
  while (!g) g = generate(size, ctx.random);
  return { size, white: g.white, runs: g.runs, digits: Array(size * size).fill(0), startedAt: ctx.now(), finishedAt: null };
}

export function runOk(r: Run, digits: number[]) {
  const ds = r.cells.map((c) => digits[c]);
  return ds.every(Boolean) && new Set(ds).size === ds.length && ds.reduce((a, b) => a + b, 0) === r.sum;
}

/** Cells that break a rule right now (a repeated digit, or a full run with the wrong sum) */
export function conflicts(s: Pick<KakuroState, 'runs' | 'digits'>): Set<number> {
  const bad = new Set<number>();
  for (const r of s.runs) {
    const ds = r.cells.map((c) => s.digits[c]);
    r.cells.forEach((c, k) => {
      if (ds[k] && ds.filter((x) => x === ds[k]).length > 1) bad.add(c);
    });
    if (ds.every(Boolean) && ds.reduce((a, b) => a + b, 0) !== r.sum) r.cells.forEach((c) => bad.add(c));
  }
  return bad;
}

export function move(s: KakuroState, _seat: Seat, m: KakuroMove, ctx: Pick<GameCtx, 'now'>): KakuroState | string {
  if (s.finishedAt !== null) return 'Solved!';
  if (!s.white[m?.cell] || !Number.isInteger(m.digit) || m.digit < 0 || m.digit > 9) return 'Pick a white cell and a digit';
  const digits = s.digits.slice();
  digits[m.cell] = m.digit;
  return { ...s, digits, finishedAt: s.runs.every((r) => runOk(r, digits)) ? ctx.now() : null };
}

export const activePlayers = (s: KakuroState): Seat[] => (s.finishedAt === null ? [0] : []);
export function result(s: KakuroState): GameResult | null {
  if (s.finishedAt === null) return null;
  const secs = Math.round((s.finishedAt - s.startedAt) / 1000);
  return { winners: [0], message: `Solved in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} ➕` };
}
