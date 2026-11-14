/** Reversi: place a disc to flank a line of the other color and flip it. Most discs wins. */
import type { BoardProps, BotCtx, GameDef, GameResult, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';

export interface ReversiState {
  board: (Seat | null)[];
  turn: Seat;
  last: number | null;
  passed: boolean;
  over: boolean;
}
export type ReversiMove = { cell: number } | { pass: true };

const DIRS: [number, number][] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];
/** The square one step from `i` in direction d, or -1 off the board */
const inb = (i: number, [dr, dc]: [number, number]) => {
  const r = Math.floor(i / 8) + dr;
  const c = (i % 8) + dc;
  return r >= 0 && r < 8 && c >= 0 && c < 8 ? r * 8 + c : -1;
};

export function setup(): ReversiState {
  const board: (Seat | null)[] = Array(64).fill(null);
  board[27] = board[36] = 1;
  board[28] = board[35] = 0;
  return { board, turn: 0, last: null, passed: false, over: false };
}

export function flips(board: (Seat | null)[], cell: number, who: Seat): number[] {
  if (board[cell] !== null) return [];
  const out: number[] = [];
  for (const d of DIRS) {
    const line: number[] = [];
    let i = inb(cell, d);
    while (i >= 0 && board[i] === 1 - who) {
      line.push(i);
      i = inb(i, d);
    }
    if (i >= 0 && board[i] === who && line.length) out.push(...line);
  }
  return out;
}

export const legal = (board: (Seat | null)[], who: Seat) => Array.from({ length: 64 }, (_, i) => i).filter((i) => flips(board, i, who).length > 0);

function place(s: ReversiState, cell: number): ReversiState {
  const board = s.board.slice();
  for (const f of flips(board, cell, s.turn)) board[f] = s.turn;
  board[cell] = s.turn;
  const next = (1 - s.turn) as Seat;
  if (legal(board, next).length) return { board, turn: next, last: cell, passed: false, over: false };
  // Opponent can't move: same player again, or the game ends
  if (legal(board, s.turn).length) return { board, turn: s.turn, last: cell, passed: true, over: false };
  return { board, turn: next, last: cell, passed: false, over: true };
}

export function move(s: ReversiState, seat: Seat, m: ReversiMove): ReversiState | string {
  if (s.over) return 'The game is over';
  if (seat !== s.turn) return 'Not your turn';
  if (!('cell' in m) || !flips(s.board, m.cell, seat).length) return 'You must flank at least one disc';
  return place(s, m.cell);
}

export const activePlayers = (s: ReversiState): Seat[] => (s.over ? [] : [s.turn]);
const count = (b: (Seat | null)[], who: Seat) => b.filter((x) => x === who).length;
export function result(s: ReversiState): GameResult | null {
  if (!s.over) return null;
  const [a, b] = [count(s.board, 0), count(s.board, 1)];
  return a === b ? { winners: [], draw: true } : { winners: [a > b ? 0 : 1] };
}

// Corners are gold, squares next to them are poison
const W = [
  100, -20, 10, 5, 5, 10, -20, 100, -20, -50, -2, -2, -2, -2, -50, -20, 10, -2, 1, 1, 1, 1, -2, 10, 5, -2, 1, 0, 0, 1, -2, 5, 5, -2, 1, 0, 0, 1, -2, 5, 10, -2, 1, 1, 1,
  1, -2, 10, -20, -50, -2, -2, -2, -2, -50, -20, 100, -20, 10, 5, 5, 10, -20, 100,
];

function evaluate(s: ReversiState, me: Seat) {
  if (s.over) return (count(s.board, me) - count(s.board, (1 - me) as Seat)) * 1000;
  let v = 0;
  s.board.forEach((x, i) => {
    if (x === me) v += W[i];
    else if (x !== null) v -= W[i];
  });
  return v + (legal(s.board, me).length - legal(s.board, (1 - me) as Seat).length) * 5;
}

function search(s: ReversiState, depth: number, me: Seat, alpha: number, beta: number): number {
  if (depth === 0 || s.over) return evaluate(s, me);
  const moves = legal(s.board, s.turn);
  const maxing = s.turn === me;
  let best = maxing ? -Infinity : Infinity;
  for (const c of moves) {
    const v = search(place(s, c), depth - 1, me, alpha, beta);
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

export function bot(v: ReversiState, seat: Seat, ctx: BotCtx): ReversiMove {
  const moves = legal(v.board, seat);
  if (ctx.level === 'easy' && ctx.random() < 0.6) return { cell: moves[Math.floor(ctx.random() * moves.length)] };
  const depth = ctx.level === 'hard' ? 5 : 3;
  let best = -Infinity;
  let pick = moves[0];
  for (const c of moves) {
    const val = search(place(v, c), depth - 1, seat, -Infinity, Infinity) + ctx.random();
    if (val > best) {
      best = val;
      pick = c;
    }
  }
  return { cell: pick };
}

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<ReversiState, ReversiMove>) {
  const myTurn = canMove && v.turn === seat;
  const moves = new Set(myTurn ? legal(v.board, seat) : []);
  return (
    <div className="stack center">
      <div className="info-row">
        {([0, 1] as Seat[]).map((p) => (
          <span key={p} className={'chip' + (v.turn === p && !v.over ? ' trump-chip' : '')}>
            <span className={'rv-disc mini ' + (p === 0 ? 'dark' : 'light')} /> {p === seat ? tx('You') : players[p].name}: {count(v.board, p)}
          </span>
        ))}
        {v.passed && <span className="chip">{tx('{name} had no move and passed', { name: players[1 - v.turn].name })}</span>}
      </div>
      <div className="rv-board">
        {v.board.map((x, i) => (
          <button key={i} className={'rv-sq' + (moves.has(i) ? ' can' : '')} disabled={!moves.has(i)} onClick={() => onMove({ cell: i })} aria-label={tx('square {i}', { i })}>
            {x !== null && <span className={'rv-disc ' + (x === 0 ? 'dark' : 'light') + (v.last === i ? ' last' : '')} />}
          </button>
        ))}
      </div>
    </div>
  );
}

export const reversi: GameDef<ReversiState, ReversiMove, ReversiState> = {
  id: 'reversi',
  name: 'Reversi',
  tagline: 'Flank and flip. Corners are king.',
  icon: '⚫',
  minPlayers: 2,
  maxPlayers: 2,
  hiddenInfo: false,
  rules:
    'Dark moves first. Place a disc so that one or more straight lines (across, down or diagonal) of your opponent’s discs end at another of yours; all of them flip to your color. If you have no such move you pass. When neither player can move, the one with more discs wins. Tip: corners can never be flipped.',
  setup: () => setup(),
  activePlayers,
  view: (s) => s,
  move: (s, seat, m) => move(s, seat, m),
  result,
  bot,
  botDelay: () => 600,
  Board,
};
