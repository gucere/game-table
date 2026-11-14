/**
 * Satranç (chess) with the full rules: castling, en passant, promotion, check, mate,
 * stalemate, threefold repetition, the 50-move rule and insufficient material.
 * Squares are 0..63 with 0 = a8 and 63 = h1. Pieces are letters: uppercase white, lowercase black.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';

export type Color = 'w' | 'b';
export interface Pos {
  board: string[];
  turn: Color;
  /** Castling rights: K Q k q */
  castle: string;
  ep: number | null;
}
export interface CMove {
  from: number;
  to: number;
  promo?: string;
}
interface Gen extends CMove {
  flag?: 'ep' | 'K' | 'Q' | 'double';
}

export interface ChessState extends Pos {
  /** Which seat plays white */
  white: Seat;
  half: number;
  keys: string[];
  moves: { san: string; from: number; to: number }[];
  over: { winner: Color | null; reason: string } | null;
}

export type ChessView = ChessState & { me: Seat; myColor: Color; legal: CMove[]; check: boolean };

const E = '.';
const rc = (i: number) => [Math.floor(i / 8), i % 8];
const at = (r: number, c: number) => (r >= 0 && r < 8 && c >= 0 && c < 8 ? r * 8 + c : -1);
const colorOf = (p: string): Color | null => (p === E ? null : p === p.toUpperCase() ? 'w' : 'b');
const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');
export const sqName = (i: number) => 'abcdefgh'[i % 8] + (8 - Math.floor(i / 8));

export function startPos(): Pos {
  const rows = ['rnbqkbnr', 'pppppppp', '........', '........', '........', '........', 'PPPPPPPP', 'RNBQKBNR'];
  return { board: rows.join('').split(''), turn: 'w', castle: 'KQkq', ep: null };
}

const KN = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];
const KG = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];
const ROOK = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const BISHOP = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

/** Is square `sq` attacked by `by`? */
export function attacked(board: string[], sq: number, by: Color): boolean {
  const [r, c] = rc(sq);
  const is = (i: number, letters: string) => i >= 0 && board[i] !== E && colorOf(board[i]) === by && letters.includes(board[i].toLowerCase());
  const pr = by === 'w' ? r + 1 : r - 1;
  if (is(at(pr, c - 1), 'p') || is(at(pr, c + 1), 'p')) return true;
  for (const [dr, dc] of KN) if (is(at(r + dr, c + dc), 'n')) return true;
  for (const [dr, dc] of KG) if (is(at(r + dr, c + dc), 'k')) return true;
  for (const [dirs, letters] of [
    [ROOK, 'rq'],
    [BISHOP, 'bq'],
  ] as const) {
    for (const [dr, dc] of dirs) {
      let rr = r + dr;
      let cc = c + dc;
      while (at(rr, cc) >= 0) {
        const p = board[at(rr, cc)];
        if (p !== E) {
          if (colorOf(p) === by && letters.includes(p.toLowerCase())) return true;
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
  }
  return false;
}

const kingSq = (board: string[], c: Color) => board.indexOf(c === 'w' ? 'K' : 'k');
export const inCheck = (p: Pos, c: Color = p.turn) => attacked(p.board, kingSq(p.board, c), other(c));

function pseudo(p: Pos): Gen[] {
  const out: Gen[] = [];
  const me = p.turn;
  const b = p.board;
  for (let i = 0; i < 64; i++) {
    const pc = b[i];
    if (pc === E || colorOf(pc) !== me) continue;
    const [r, c] = rc(i);
    const t = pc.toLowerCase();
    const add = (to: number, flag?: Gen['flag']) => {
      if (t === 'p' && (Math.floor(to / 8) === 0 || Math.floor(to / 8) === 7)) for (const pr of 'qrbn') out.push({ from: i, to, promo: pr });
      else out.push({ from: i, to, flag });
    };
    if (t === 'p') {
      const d = me === 'w' ? -1 : 1;
      const one = at(r + d, c);
      if (one >= 0 && b[one] === E) {
        add(one);
        const start = me === 'w' ? 6 : 1;
        const two = at(r + 2 * d, c);
        if (r === start && b[two] === E) add(two, 'double');
      }
      for (const dc of [-1, 1]) {
        const x = at(r + d, c + dc);
        if (x < 0) continue;
        if (b[x] !== E && colorOf(b[x]) !== me) add(x);
        else if (x === p.ep) add(x, 'ep');
      }
    } else if (t === 'n' || t === 'k') {
      for (const [dr, dc] of t === 'n' ? KN : KG) {
        const x = at(r + dr, c + dc);
        if (x >= 0 && colorOf(b[x]) !== me) add(x);
      }
      if (t === 'k') {
        const row = me === 'w' ? 7 : 0;
        const [kc, qc] = me === 'w' ? ['K', 'Q'] : ['k', 'q'];
        if (i === at(row, 4) && !attacked(b, i, other(me))) {
          if (p.castle.includes(kc) && b[at(row, 5)] === E && b[at(row, 6)] === E && !attacked(b, at(row, 5), other(me))) add(at(row, 6), 'K');
          if (p.castle.includes(qc) && b[at(row, 3)] === E && b[at(row, 2)] === E && b[at(row, 1)] === E && !attacked(b, at(row, 3), other(me)))
            add(at(row, 2), 'Q');
        }
      }
    } else {
      const dirs = t === 'r' ? ROOK : t === 'b' ? BISHOP : [...ROOK, ...BISHOP];
      for (const [dr, dc] of dirs) {
        let rr = r + dr;
        let cc = c + dc;
        while (at(rr, cc) >= 0) {
          const x = at(rr, cc);
          if (b[x] === E) add(x);
          else {
            if (colorOf(b[x]) !== me) add(x);
            break;
          }
          rr += dr;
          cc += dc;
        }
      }
    }
  }
  return out;
}

export function play(p: Pos, m: Gen): Pos {
  const b = p.board.slice();
  const pc = b[m.from];
  const me = p.turn;
  b[m.to] = m.promo ? (me === 'w' ? m.promo.toUpperCase() : m.promo) : pc;
  b[m.from] = E;
  if (m.flag === 'ep') b[m.to + (me === 'w' ? 8 : -8)] = E;
  if (m.flag === 'K') {
    b[m.to - 1] = b[m.to + 1];
    b[m.to + 1] = E;
  }
  if (m.flag === 'Q') {
    b[m.to + 1] = b[m.to - 2];
    b[m.to - 2] = E;
  }
  let castle = p.castle;
  const strip = (chars: string) => (castle = castle.replace(new RegExp(`[${chars}]`, 'g'), ''));
  if (pc === 'K') strip('KQ');
  if (pc === 'k') strip('kq');
  for (const [sq, ch] of [
    [63, 'K'],
    [56, 'Q'],
    [7, 'k'],
    [0, 'q'],
  ] as const)
    if (m.from === sq || m.to === sq) strip(ch);
  return { board: b, turn: other(me), castle, ep: m.flag === 'double' ? (m.from + m.to) / 2 : null };
}

function legalGen(p: Pos): Gen[] {
  return pseudo(p).filter((m) => !inCheck(play(p, m), p.turn));
}

export const legalMoves = (p: Pos): CMove[] => legalGen(p).map(({ from, to, promo }) => (promo ? { from, to, promo } : { from, to }));

const key = (p: Pos) => p.board.join('') + p.turn + p.castle + (p.ep ?? '-');

function insufficient(b: string[]) {
  const pieces = b.filter((x) => x !== E && x.toLowerCase() !== 'k');
  if (!pieces.length) return true;
  return pieces.length === 1 && 'bn'.includes(pieces[0].toLowerCase());
}

function san(p: Pos, m: Gen, all: Gen[]): string {
  const pc = p.board[m.from].toUpperCase();
  if (m.flag === 'K') return 'O-O';
  if (m.flag === 'Q') return 'O-O-O';
  const capture = p.board[m.to] !== E || m.flag === 'ep';
  let s = '';
  if (pc === 'P') s = capture ? 'abcdefgh'[m.from % 8] + 'x' : '';
  else {
    s = pc;
    const rivals = all.filter((x) => x.to === m.to && x.from !== m.from && p.board[x.from] === p.board[m.from]);
    if (rivals.length) {
      if (rivals.every((x) => x.from % 8 !== m.from % 8)) s += 'abcdefgh'[m.from % 8];
      else if (rivals.every((x) => Math.floor(x.from / 8) !== Math.floor(m.from / 8))) s += String(8 - Math.floor(m.from / 8));
      else s += sqName(m.from);
    }
    if (capture) s += 'x';
  }
  s += sqName(m.to);
  if (m.promo) s += '=' + m.promo.toUpperCase();
  const after = play(p, m);
  if (inCheck(after)) s += legalGen(after).length ? '+' : '#';
  return s;
}

export function setup(ctx: Pick<GameCtx, 'random' | 'options'>): ChessState {
  const p = startPos();
  const white: Seat = ctx.options.white === 'first' ? 0 : ctx.options.white === 'second' ? 1 : ctx.random() < 0.5 ? 0 : 1;
  return { ...p, white, half: 0, keys: [key(p)], moves: [], over: null };
}

export const colorOfSeat = (s: Pick<ChessState, 'white'>, seat: Seat): Color => (seat === s.white ? 'w' : 'b');
const seatOfColor = (s: Pick<ChessState, 'white'>, c: Color): Seat => (c === 'w' ? s.white : 1 - s.white);

export function move(s: ChessState, seat: Seat, m: CMove): ChessState | string {
  if (s.over) return 'The game is over';
  if (colorOfSeat(s, seat) !== s.turn) return 'Not your turn';
  const all = legalGen(s);
  const g = all.find((x) => x.from === m?.from && x.to === m?.to && (x.promo ?? '') === (m?.promo ?? (x.promo ? 'q' : '')));
  if (!g) return 'Illegal move';
  const notation = san(s, g, all);
  const pos = play(s, g);
  const pawnOrCapture = s.board[g.from].toLowerCase() === 'p' || s.board[g.to] !== E || g.flag === 'ep';
  const half = pawnOrCapture ? 0 : s.half + 1;
  const k = key(pos);
  const keys = [...s.keys, k];
  const next: ChessState = { ...s, ...pos, half, keys, moves: [...s.moves, { san: notation, from: g.from, to: g.to }], over: null };
  const replies = legalGen(pos);
  if (!replies.length) next.over = inCheck(pos) ? { winner: s.turn, reason: 'Checkmate' } : { winner: null, reason: 'Stalemate' };
  else if (half >= 100) next.over = { winner: null, reason: '50 moves without a capture or pawn move' };
  else if (keys.filter((x) => x === k).length >= 3) next.over = { winner: null, reason: 'Threefold repetition' };
  else if (insufficient(pos.board)) next.over = { winner: null, reason: 'Not enough material to mate' };
  return next;
}

export const activePlayers = (s: ChessState): Seat[] => (s.over ? [] : [seatOfColor(s, s.turn)]);

export function view(s: ChessState, seat: Seat): ChessView {
  const myColor = colorOfSeat(s, seat);
  return { ...s, me: seat, myColor, legal: !s.over && s.turn === myColor ? legalMoves(s) : [], check: inCheck(s) };
}

export function result(s: ChessState): GameResult | null {
  if (!s.over) return null;
  if (s.over.winner === null) return { winners: [], draw: true, message: `Draw: ${s.over.reason.toLowerCase()}.` };
  return { winners: [seatOfColor(s, s.over.winner)] };
}

// ------------------------------------------------------------- bot

const VAL: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
// Small positional bonuses (from white's side, a8 = 0): centre control and pawn advance
const CENTER = Array.from({ length: 64 }, (_, i) => {
  const [r, c] = rc(i);
  return 14 - (Math.abs(3.5 - r) + Math.abs(3.5 - c)) * 4;
});

function evaluate(p: Pos): number {
  let sc = 0;
  for (let i = 0; i < 64; i++) {
    const pc = p.board[i];
    if (pc === E) continue;
    const t = pc.toLowerCase();
    const w = pc !== t;
    let v = VAL[t];
    if (t === 'n' || t === 'b') v += CENTER[i];
    if (t === 'p') v += (w ? 6 - Math.floor(i / 8) : Math.floor(i / 8) - 1) * 6 + CENTER[i] * 0.3;
    if (t === 'k') v += -CENTER[i] * 0.5;
    sc += w ? v : -v;
  }
  return p.turn === 'w' ? sc : -sc;
}

function order(p: Pos, ms: Gen[]) {
  const score = (m: Gen) => (p.board[m.to] !== E ? VAL[p.board[m.to].toLowerCase()] * 10 - VAL[p.board[m.from].toLowerCase()] : 0) + (m.promo === 'q' ? 800 : 0);
  return ms.sort((a, b) => score(b) - score(a));
}

function quiesce(p: Pos, alpha: number, beta: number, depth: number): number {
  const stand = evaluate(p);
  if (stand >= beta) return beta;
  if (alpha < stand) alpha = stand;
  if (depth === 0) return alpha;
  for (const m of order(
    p,
    pseudo(p).filter((x) => p.board[x.to] !== E || x.promo),
  )) {
    const n = play(p, m);
    if (inCheck(n, p.turn)) continue;
    const v = -quiesce(n, -beta, -alpha, depth - 1);
    if (v >= beta) return beta;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

function negamax(p: Pos, depth: number, alpha: number, beta: number): number {
  const ms = legalGen(p);
  if (!ms.length) return inCheck(p) ? -100000 - depth : 0;
  if (depth === 0) return quiesce(p, alpha, beta, 4);
  let best = -Infinity;
  for (const m of order(p, ms)) {
    const v = -negamax(play(p, m), depth - 1, -beta, -alpha);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

export function bot(v: ChessView, _seat: Seat, ctx: BotCtx): CMove {
  const ms = order(v, legalGen(v));
  if (ctx.level === 'easy' && ctx.random() < 0.35) {
    const m = ms[Math.floor(ctx.random() * ms.length)];
    return { from: m.from, to: m.to, promo: m.promo };
  }
  const depth = ctx.level === 'hard' ? 3 : ctx.level === 'normal' ? 2 : 1;
  let best = -Infinity;
  let pick: Gen[] = [];
  for (const m of ms) {
    const val = -negamax(play(v, m), depth - 1, -Infinity, Infinity) + ctx.random() * 8;
    if (val > best) {
      best = val;
      pick = [m];
    }
  }
  const m = pick[0];
  return { from: m.from, to: m.to, promo: m.promo };
}
