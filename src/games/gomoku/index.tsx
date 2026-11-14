/** Gomoku: take turns placing stones on a 15×15 board. Five in a row (or more) wins. */
import type { BoardProps, BotCtx, GameDef, GameResult, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';

export const N = 15;
export interface GomokuState {
  board: (Seat | null)[];
  turn: Seat;
  last: number | null;
  line: number[] | null;
  winner: Seat | null;
  full: boolean;
}
export type GomokuMove = { cell: number };

const DIRS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/** The run of `who`'s stones through cell in direction d (cell counted as theirs) */
function run(board: (Seat | null)[], cell: number, who: Seat, [dr, dc]: [number, number]) {
  const r0 = Math.floor(cell / N);
  const c0 = cell % N;
  const cells = [cell];
  let open = 0;
  for (const sgn of [1, -1]) {
    let r = r0 + dr * sgn;
    let c = c0 + dc * sgn;
    while (r >= 0 && c >= 0 && r < N && c < N && board[r * N + c] === who) {
      cells.push(r * N + c);
      r += dr * sgn;
      c += dc * sgn;
    }
    if (r >= 0 && c >= 0 && r < N && c < N && board[r * N + c] === null) open++;
  }
  return { cells, open };
}

export function setup(): GomokuState {
  return { board: Array(N * N).fill(null), turn: 0, last: null, line: null, winner: null, full: false };
}

export function move(s: GomokuState, seat: Seat, m: GomokuMove): GomokuState | string {
  if (s.winner !== null || s.full) return 'The game is over';
  if (seat !== s.turn) return 'Not your turn';
  if (!Number.isInteger(m?.cell) || m.cell < 0 || m.cell >= N * N || s.board[m.cell] !== null) return 'Pick an empty point';
  const board = s.board.slice();
  board[m.cell] = seat;
  for (const d of DIRS) {
    const r = run(board, m.cell, seat, d);
    if (r.cells.length >= 5) return { board, turn: seat, last: m.cell, line: r.cells, winner: seat, full: false };
  }
  return { board, turn: (1 - seat) as Seat, last: m.cell, line: null, winner: null, full: board.every((x) => x !== null) };
}

export const activePlayers = (s: GomokuState): Seat[] => (s.winner !== null || s.full ? [] : [s.turn]);
export const result = (s: GomokuState): GameResult | null => (s.winner !== null ? { winners: [s.winner] } : s.full ? { winners: [], draw: true } : null);

const SHAPE = (len: number, open: number) => {
  if (len >= 5) return 1_000_000;
  if (len === 4) return open === 2 ? 50_000 : open === 1 ? 5_000 : 0;
  if (len === 3) return open === 2 ? 3_000 : open === 1 ? 300 : 0;
  if (len === 2) return open === 2 ? 200 : open === 1 ? 30 : 0;
  return open * 5;
};

/** How good is this point for `who`, adding up the shapes it makes in all four directions */
function value(board: (Seat | null)[], cell: number, who: Seat) {
  return DIRS.reduce((a, d) => {
    const r = run(board, cell, who, d);
    return a + SHAPE(r.cells.length, r.open);
  }, 0);
}

export function bot(v: GomokuState, seat: Seat, ctx: BotCtx): GomokuMove {
  const stones = v.board.flatMap((x, i) => (x !== null ? [i] : []));
  if (!stones.length) return { cell: Math.floor(N / 2) * N + Math.floor(N / 2) };
  // Only consider points near existing stones
  const near = new Set<number>();
  for (const st of stones) {
    const r = Math.floor(st / N);
    const c = st % N;
    for (let dr = -2; dr <= 2; dr++)
      for (let dc = -2; dc <= 2; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && cc >= 0 && rr < N && cc < N && v.board[rr * N + cc] === null) near.add(rr * N + cc);
      }
  }
  const defend = ctx.level === 'easy' ? 0.5 : 0.9;
  const scored = [...near].map((c) => ({ c, s: value(v.board, c, seat) + value(v.board, c, (1 - seat) as Seat) * defend + ctx.random() * 3 })).sort((a, b) => b.s - a.s);
  const pool = ctx.level === 'easy' ? scored.slice(0, 5) : ctx.level === 'normal' ? scored.slice(0, 2) : scored.slice(0, 1);
  return { cell: pool[Math.floor(ctx.random() * pool.length)].c };
}

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<GomokuState, GomokuMove>) {
  const myTurn = canMove && v.turn === seat;
  const line = new Set(v.line ?? []);
  return (
    <div className="stack center">
      <div className="info-row">
        {([0, 1] as Seat[]).map((p) => (
          <span key={p} className={'chip' + (v.turn === p && v.winner === null ? ' trump-chip' : '')}>
            <span className={'rv-disc mini ' + (p === 0 ? 'dark' : 'light')} /> {p === seat ? tx('You') : players[p].name}
          </span>
        ))}
      </div>
      <div className="gm-board" style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}>
        {v.board.map((x, i) => (
          <button key={i} className="gm-pt" disabled={!myTurn || x !== null} onClick={() => onMove({ cell: i })} aria-label={tx('point {i}', { i })}>
            {x !== null && <span className={'rv-disc ' + (x === 0 ? 'dark' : 'light') + (v.last === i ? ' last' : '') + (line.has(i) ? ' win' : '')} />}
          </button>
        ))}
      </div>
    </div>
  );
}

export const gomoku: GameDef<GomokuState, GomokuMove, GomokuState> = {
  id: 'gomoku',
  name: 'Gomoku',
  tagline: 'Five in a row on a big board.',
  icon: '⚪',
  minPlayers: 2,
  maxPlayers: 2,
  hiddenInfo: false,
  rules: 'Dark goes first. Take turns placing a stone on any empty point. The first to get five (or more) of their stones in an unbroken line, across, down or diagonally, wins. Watch out for open threes and fours!',
  setup: () => setup(),
  activePlayers,
  view: (s) => s,
  move: (s, seat, m) => move(s, seat, m),
  result,
  bot,
  botDelay: () => 500,
  Board,
};
