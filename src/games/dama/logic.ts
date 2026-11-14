/**
 * Dama (Turkish draughts) on an 8×8 board.
 * Men move one square forward or sideways (never diagonally or back) and capture by
 * jumping over an enemy piece forward or sideways. Captured pieces vanish at once.
 * Capturing is compulsory and you must take the most pieces possible.
 * A man reaching the far row becomes a dama, which moves and captures any distance in
 * straight lines (but cannot reverse direction in the middle of a capture).
 */
import type { BotCtx, GameResult, Seat } from '../../engine/types';

export type Piece = { owner: Seat; king: boolean } | null;
export interface DamaMove {
  path: number[];
  captures: number[];
}

export interface DamaState {
  board: Piece[];
  turn: Seat;
  /** Moves since the last capture or man move, for the draw rule */
  quiet: number;
  last: DamaMove | null;
  winner: Seat | null;
  draw: boolean;
}

export type DamaView = DamaState & { me: Seat; legal: DamaMove[] };

const idx = (r: number, c: number) => r * 8 + c;
const inb = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
/** Seat 0 starts at the bottom and moves up */
const forward = (seat: Seat) => (seat === 0 ? -1 : 1);

export function setup(): DamaState {
  const board: Piece[] = Array(64).fill(null);
  for (let c = 0; c < 8; c++) {
    board[idx(1, c)] = board[idx(2, c)] = { owner: 1, king: false };
    board[idx(5, c)] = board[idx(6, c)] = { owner: 0, king: false };
  }
  return { board, turn: 0, quiet: 0, last: null, winner: null, draw: false };
}

function dirsFor(p: NonNullable<Piece>): [number, number][] {
  const f = forward(p.owner);
  return p.king
    ? [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]
    : [
        [f, 0],
        [0, -1],
        [0, 1],
      ];
}

/** All capture sequences starting at `from` (board already reflects earlier jumps) */
function captureSeqs(board: Piece[], from: number, piece: NonNullable<Piece>, banned: [number, number] | null): DamaMove[] {
  const r0 = Math.floor(from / 8);
  const c0 = from % 8;
  const out: DamaMove[] = [];
  for (const [dr, dc] of dirsFor(piece)) {
    if (banned && dr === banned[0] && dc === banned[1]) continue;
    if (piece.king) {
      // Slide over empty squares to an enemy, then land on any empty square beyond it
      let r = r0 + dr;
      let c = c0 + dc;
      while (inb(r, c) && !board[idx(r, c)]) {
        r += dr;
        c += dc;
      }
      if (!inb(r, c) || board[idx(r, c)]!.owner === piece.owner) continue;
      const victim = idx(r, c);
      r += dr;
      c += dc;
      while (inb(r, c) && !board[idx(r, c)]) {
        const land = idx(r, c);
        const b2 = board.slice();
        b2[from] = null;
        b2[victim] = null;
        b2[land] = piece;
        const more = captureSeqs(b2, land, piece, [-dr, -dc]);
        if (more.length) for (const m of more) out.push({ path: [from, ...m.path], captures: [victim, ...m.captures] });
        else out.push({ path: [from, land], captures: [victim] });
        r += dr;
        c += dc;
      }
    } else {
      const r1 = r0 + dr;
      const c1 = c0 + dc;
      const r2 = r0 + 2 * dr;
      const c2 = c0 + 2 * dc;
      if (!inb(r2, c2)) continue;
      const mid = board[idx(r1, c1)];
      if (!mid || mid.owner === piece.owner || board[idx(r2, c2)]) continue;
      const land = idx(r2, c2);
      const b2 = board.slice();
      b2[from] = null;
      b2[idx(r1, c1)] = null;
      b2[land] = piece;
      const more = captureSeqs(b2, land, piece, null);
      if (more.length) for (const m of more) out.push({ path: [from, ...m.path], captures: [idx(r1, c1), ...m.captures] });
      else out.push({ path: [from, land], captures: [idx(r1, c1)] });
    }
  }
  return out;
}

export function legalMoves(s: Pick<DamaState, 'board' | 'turn'>): DamaMove[] {
  const caps: DamaMove[] = [];
  const quiet: DamaMove[] = [];
  s.board.forEach((p, from) => {
    if (!p || p.owner !== s.turn) return;
    caps.push(...captureSeqs(s.board, from, p, null));
    const r0 = Math.floor(from / 8);
    const c0 = from % 8;
    for (const [dr, dc] of dirsFor(p)) {
      let r = r0 + dr;
      let c = c0 + dc;
      while (inb(r, c) && !s.board[idx(r, c)]) {
        quiet.push({ path: [from, idx(r, c)], captures: [] });
        if (!p.king) break;
        r += dr;
        c += dc;
      }
    }
  });
  if (caps.length) {
    const most = Math.max(...caps.map((m) => m.captures.length));
    return caps.filter((m) => m.captures.length === most);
  }
  return quiet;
}

export function apply(s: DamaState, m: DamaMove): DamaState {
  const board = s.board.slice();
  const from = m.path[0];
  const to = m.path[m.path.length - 1];
  const p = board[from]!;
  board[from] = null;
  for (const x of m.captures) board[x] = null;
  const lastRow = p.owner === 0 ? 0 : 7;
  const promote = !p.king && Math.floor(to / 8) === lastRow;
  board[to] = { owner: p.owner, king: p.king || promote };
  const quiet = m.captures.length || !p.king ? 0 : s.quiet + 1;
  const next: DamaState = { board, turn: (1 - s.turn) as Seat, quiet, last: m, winner: null, draw: false };
  const counts = [0, 1].map((o) => board.filter((x) => x?.owner === o).length);
  if (!counts[next.turn] || !legalMoves(next).length) return { ...next, winner: s.turn };
  // Two lone kings, or 50 quiet king moves each: a draw
  const onlyKings = board.every((x) => !x || x.king);
  if (next.quiet >= 100 || (onlyKings && counts[0] === 1 && counts[1] === 1)) return { ...next, draw: true };
  return next;
}

const same = (a: DamaMove, b: DamaMove) => a.path.length === b.path.length && a.path.every((x, i) => x === b.path[i]) && a.captures.join() === b.captures.join();

export function move(s: DamaState, seat: Seat, m: DamaMove): DamaState | string {
  if (s.winner !== null || s.draw) return 'The game is over';
  if (seat !== s.turn) return 'Not your turn';
  if (!m || !Array.isArray(m.path) || !Array.isArray(m.captures)) return 'Bad move';
  const legal = legalMoves(s);
  const found = legal.find((x) => same(x, m));
  if (!found) return legal.some((x) => x.captures.length) ? 'You must capture (as many pieces as possible)' : 'Illegal move';
  return apply(s, found);
}

export const activePlayers = (s: DamaState): Seat[] => (s.winner !== null || s.draw ? [] : [s.turn]);
export const view = (s: DamaState, seat: Seat): DamaView => ({ ...s, me: seat, legal: s.turn === seat && s.winner === null && !s.draw ? legalMoves(s) : [] });

export function result(s: DamaState): GameResult | null {
  if (s.winner !== null) return { winners: [s.winner] };
  if (s.draw) return { winners: [], draw: true };
  return null;
}

// ------------------------------------------------------------- bot

function evaluate(board: Piece[], me: Seat) {
  let sc = 0;
  board.forEach((p, i) => {
    if (!p) return;
    const r = Math.floor(i / 8);
    const adv = p.owner === 0 ? 7 - r : r;
    const v = p.king ? 3.2 : 1 + adv * 0.06;
    sc += p.owner === me ? v : -v;
  });
  return sc;
}

function search(s: DamaState, depth: number, alpha: number, beta: number, me: Seat): number {
  if (s.winner !== null) return s.winner === me ? 1000 + depth : -1000 - depth;
  if (s.draw) return 0;
  if (depth === 0) return evaluate(s.board, me);
  const moves = legalMoves(s);
  const maxing = s.turn === me;
  let best = maxing ? -Infinity : Infinity;
  for (const m of moves) {
    const v = search(apply(s, m), depth - 1, alpha, beta, me);
    if (maxing) {
      best = Math.max(best, v);
      alpha = Math.max(alpha, v);
    } else {
      best = Math.min(best, v);
      beta = Math.min(beta, v);
    }
    if (beta <= alpha) break;
  }
  return best;
}

export function bot(v: DamaView, seat: Seat, ctx: BotCtx): DamaMove {
  const moves = v.legal;
  if (ctx.level === 'easy' && ctx.random() < 0.5) return moves[Math.floor(ctx.random() * moves.length)];
  const depth = ctx.level === 'hard' ? 5 : ctx.level === 'normal' ? 3 : 1;
  let best = -Infinity;
  let choices: DamaMove[] = [];
  for (const m of moves) {
    const val = search(apply(v, m), depth - 1, -Infinity, Infinity, seat) + ctx.random() * 0.05;
    if (val > best + 1e-9) {
      best = val;
      choices = [m];
    } else if (Math.abs(val - best) < 1e-9) choices.push(m);
  }
  return choices[Math.floor(ctx.random() * choices.length)];
}
