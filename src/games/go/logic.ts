/**
 * Go on a 9×9, 13×13 or 19×19 board, with simple, fully automatic rules:
 * captures, no suicide, ko (a move may not bring back the position before the opponent's
 * last move), and area scoring at the end (your stones + empty points only you surround) plus komi.
 * Every stone left on the board at the end counts, so capture dead stones before you pass.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';

/** 0 empty, 1 black (seat 0), 2 white (seat 1) */
export type Point = 0 | 1 | 2;

export interface GoState {
  size: number;
  board: Point[];
  turn: Seat;
  komi: number;
  /** Board before the last move, for the ko rule */
  prev: string | null;
  passes: number;
  last: { seat: Seat; at: number | null } | null;
  captures: [number, number];
  /** Number of moves played (passes included) */
  ply: number;
  over: { reason: 'score' | 'resign'; by?: Seat; score?: [number, number] } | null;
}

export type GoMove = { type: 'play'; at: number } | { type: 'pass' } | { type: 'resign' };

export const color = (seat: Seat): Point => (seat === 0 ? 1 : 2);
const opp = (c: Point): Point => (c === 1 ? 2 : 1);

/** Neighbours of every point, worked out once per board size */
const NB: Record<number, number[][]> = {};
export function neighbours(size: number): number[][] {
  if (!NB[size]) {
    NB[size] = Array.from({ length: size * size }, (_, i) => {
      const r = Math.floor(i / size);
      const c = i % size;
      const out: number[] = [];
      if (r > 0) out.push(i - size);
      if (r < size - 1) out.push(i + size);
      if (c > 0) out.push(i - 1);
      if (c < size - 1) out.push(i + 1);
      return out;
    });
  }
  return NB[size];
}

/** The group containing `at` and whether it has any liberty */
function group(board: Point[], size: number, at: number): { stones: number[]; liberties: number } {
  const nb = neighbours(size);
  const c = board[at];
  const seen = new Set([at]);
  const libs = new Set<number>();
  const stack = [at];
  const stones: number[] = [];
  while (stack.length) {
    const p = stack.pop()!;
    stones.push(p);
    for (const q of nb[p]) {
      if (board[q] === 0) libs.add(q);
      else if (board[q] === c && !seen.has(q)) {
        seen.add(q);
        stack.push(q);
      }
    }
  }
  return { stones, liberties: libs.size };
}

export const libertiesOf = (s: Pick<GoState, 'board' | 'size'>, at: number) => group(s.board, s.size, at);

/** Plays a stone; returns the new board and how many it captured, or an error */
export function place(board: Point[], size: number, at: number, c: Point): { board: Point[]; captured: number } | string {
  if (at < 0 || at >= size * size || board[at] !== 0) return 'That point is taken';
  const b = board.slice();
  b[at] = c;
  let captured = 0;
  for (const q of neighbours(size)[at]) {
    if (b[q] === opp(c)) {
      const g = group(b, size, q);
      if (g.liberties === 0) {
        for (const p of g.stones) b[p] = 0;
        captured += g.stones.length;
      }
    }
  }
  if (group(b, size, at).liberties === 0) return 'No suicide: that stone would have no liberties';
  return { board: b, captured };
}

const key = (b: Point[]) => b.join('');

export function setup(ctx: Pick<GameCtx, 'options'>): GoState {
  const size = [9, 13, 19].includes(Number(ctx.options.size)) ? Number(ctx.options.size) : 9;
  const komi = Number(ctx.options.komi);
  return {
    size,
    board: Array(size * size).fill(0),
    turn: 0,
    komi: Number.isFinite(komi) ? komi : 6.5,
    prev: null,
    passes: 0,
    last: null,
    captures: [0, 0],
    ply: 0,
    over: null,
  };
}

export function tryPlay(s: GoState, at: number): GoState | string {
  const r = place(s.board, s.size, at, color(s.turn));
  if (typeof r === 'string') return r;
  if (s.prev !== null && key(r.board) === s.prev) return 'Ko: you can’t retake straight away. Play somewhere else first.';
  const captures: [number, number] = [...s.captures];
  captures[s.turn] += r.captured;
  return { ...s, board: r.board, prev: key(s.board), turn: 1 - s.turn, passes: 0, last: { seat: s.turn, at }, captures, ply: s.ply + 1 };
}

/** Area score: stones on the board plus empty regions that touch only one colour */
export function areaScore(board: Point[], size: number): { score: [number, number]; owner: Point[] } {
  const nb = neighbours(size);
  const owner: Point[] = board.slice();
  const score: [number, number] = [0, 0];
  const seen = new Uint8Array(board.length);
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== 0) {
      score[board[i] - 1]++;
      continue;
    }
    if (seen[i]) continue;
    const region: number[] = [];
    const touch = new Set<Point>();
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      region.push(p);
      for (const q of nb[p]) {
        if (board[q] === 0) {
          if (!seen[q]) {
            seen[q] = 1;
            stack.push(q);
          }
        } else touch.add(board[q]);
      }
    }
    if (touch.size === 1) {
      const c = [...touch][0];
      score[c - 1] += region.length;
      for (const p of region) owner[p] = c;
    }
  }
  return { score, owner };
}

export function finalScore(s: GoState): [number, number] {
  const { score } = areaScore(s.board, s.size);
  return [score[0], score[1] + s.komi];
}

export function move(s: GoState, seat: Seat, m: GoMove): GoState | string {
  if (s.over) return 'The game is over';
  if (seat !== s.turn) return 'Not your turn';
  if (m?.type === 'resign') return { ...s, over: { reason: 'resign', by: seat } };
  if (m?.type === 'pass') {
    const next: GoState = { ...s, turn: 1 - s.turn, passes: s.passes + 1, last: { seat, at: null }, prev: key(s.board), ply: s.ply + 1 };
    if (next.passes >= 2) next.over = { reason: 'score', score: finalScore(next) };
    return next;
  }
  if (m?.type !== 'play' || !Number.isInteger(m.at)) return 'Invalid move';
  return tryPlay(s, m.at);
}

export function result(s: GoState): GameResult | null {
  if (!s.over) return null;
  if (s.over.reason === 'resign') return { winners: [1 - s.over.by!] };
  const [b, w] = s.over.score!;
  return b === w ? { winners: [], draw: true } : { winners: [b > w ? 0 : 1] };
}

// ---------------------------------------------------------------- Bot

/** An empty point whose neighbours are all `c` (and so are its diagonals, mostly): a real eye */
function isEye(board: Point[], size: number, at: number, c: Point): boolean {
  if (board[at] !== 0) return false;
  const nb = neighbours(size)[at];
  if (!nb.every((q) => board[q] === c)) return false;
  const r = Math.floor(at / size);
  const col = at % size;
  let bad = 0;
  let diag = 0;
  for (const [dr, dc] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]) {
    const rr = r + dr;
    const cc = col + dc;
    if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
    diag++;
    if (board[rr * size + cc] === opp(c)) bad++;
  }
  return diag === 4 ? bad <= 1 : bad === 0;
}

function legalPoints(s: GoState, c: Point): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.board.length; i++) {
    if (s.board[i] !== 0 || isEye(s.board, s.size, i, c)) continue;
    const r = place(s.board, s.size, i, c);
    if (typeof r === 'string') continue;
    if (s.prev !== null && key(r.board) === s.prev) continue;
    out.push(i);
  }
  return out;
}

/** Plays random sensible moves to the end and returns black's area lead (before komi) */
function playout(start: Point[], size: number, turn: Point, random: () => number): number {
  const board = start.slice();
  const n = size * size;
  let c = turn;
  let passes = 0;
  const empties: number[] = [];
  for (let i = 0; i < n; i++) if (board[i] === 0) empties.push(i);
  for (let moves = 0; moves < n * 2 && passes < 2; moves++) {
    let played = false;
    // Try a few random empty points; pass if none works
    for (let k = 0; k < 12 && empties.length; k++) {
      const j = Math.floor(random() * empties.length);
      const at = empties[j];
      if (board[at] !== 0) {
        empties[j] = empties[empties.length - 1];
        empties.pop();
        continue;
      }
      if (isEye(board, size, at, c)) continue;
      const r = place(board, size, at, c);
      if (typeof r === 'string') continue;
      for (let i = 0; i < n; i++) board[i] = r.board[i];
      if (r.captured) for (let i = 0; i < n; i++) if (board[i] === 0 && !empties.includes(i)) empties.push(i);
      played = true;
      break;
    }
    passes = played ? 0 : passes + 1;
    c = opp(c);
  }
  const { score } = areaScore(board, size);
  return score[0] - score[1];
}

export function bot(v: GoState, seat: Seat, ctx: BotCtx): GoMove {
  const c = color(seat);
  const sign = seat === 0 ? 1 : -1;
  const lead = (bLead: number) => sign * (bLead - v.komi);
  // The opponent passed and we're ahead on the board as it stands: pass and win
  const now = areaScore(v.board, v.size).score;
  if (v.passes === 1 && lead(now[0] - now[1]) > 0) return { type: 'pass' };
  const candidates = legalPoints(v, c);
  if (!candidates.length) return { type: 'pass' };

  // Captures and saving our own stones in atari come first for the easy bot
  if (ctx.level === 'easy') {
    for (const at of candidates) {
      const r = place(v.board, v.size, at, c);
      if (typeof r !== 'string' && r.captured > 0) return { type: 'play', at };
    }
    return { type: 'play', at: candidates[Math.floor(ctx.random() * candidates.length)] };
  }

  // Flat Monte Carlo with a time budget: pick the move whose random games end best
  const budget = ctx.level === 'hard' ? 900 : 350;
  const t0 = Date.now();
  const stats = candidates.map((at) => ({ at, wins: 0, runs: 0 }));
  let total = 0;
  while (Date.now() - t0 < budget) {
    // UCB1: try promising moves more often, but every move some
    let best = stats[0];
    let bestU = -Infinity;
    for (const st of stats) {
      const u = st.runs === 0 ? Infinity : st.wins / st.runs + Math.sqrt((2 * Math.log(total + 1)) / st.runs);
      if (u > bestU) {
        bestU = u;
        best = st;
      }
    }
    const r = place(v.board, v.size, best.at, c);
    if (typeof r === 'string') {
      best.runs = 1e9;
      continue;
    }
    const bLead = playout(r.board, v.size, opp(c), ctx.random);
    best.runs++;
    if (lead(bLead) > 0) best.wins++;
    total++;
  }
  stats.sort((a, b) => b.runs - a.runs);
  const top = stats[0];
  // Hopeless everywhere: pass (or resign when far behind late in the game)
  if (top.runs > 20 && top.wins / top.runs < 0.03 && v.ply > v.size * v.size) return { type: 'resign' };
  if (top.runs > 20 && top.wins / top.runs < 0.1 && v.passes === 1) return { type: 'pass' };
  return { type: 'play', at: top.at };
}
