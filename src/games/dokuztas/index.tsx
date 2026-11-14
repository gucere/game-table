/**
 * Dokuz Taş (nine men's morris). Place your nine pieces, then slide them along the lines.
 * Three in a row along a line (a mill) lets you remove an enemy piece. With three left you
 * may jump anywhere. A player with two pieces, or no move, loses.
 */
import { useEffect, useState } from 'react';
import type { BoardProps, BotCtx, GameDef, GameResult, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';

/** Point i = ring * 8 + k, ring 0 outside; k goes clockwise from the top-left corner */
export const POS: [number, number][] = [0, 1, 2].flatMap((ring) => {
  const a = ring;
  const b = 3;
  const c = 6 - ring;
  return [
    [a, a],
    [b, a],
    [c, a],
    [c, b],
    [c, c],
    [b, c],
    [a, c],
    [a, b],
  ] as [number, number][];
});

export const ADJ: number[][] = Array.from({ length: 24 }, (_, i) => {
  const ring = Math.floor(i / 8);
  const k = i % 8;
  const out = [ring * 8 + ((k + 1) % 8), ring * 8 + ((k + 7) % 8)];
  if (k % 2 === 1) {
    if (ring > 0) out.push(i - 8);
    if (ring < 2) out.push(i + 8);
  }
  return out;
});

export const MILLS: number[][] = [
  ...[0, 1, 2].flatMap((ring) => [0, 2, 4, 6].map((k) => [ring * 8 + k, ring * 8 + k + 1, ring * 8 + ((k + 2) % 8)])),
  ...[1, 3, 5, 7].map((k) => [k, 8 + k, 16 + k]),
];

export interface MorrisState {
  board: (Seat | null)[];
  turn: Seat;
  toPlace: [number, number];
  /** After forming a mill, the same player removes a piece */
  removing: boolean;
  quiet: number;
  last: { from: number | null; to: number | null; removed: number | null } | null;
  winner: Seat | null;
  draw: boolean;
}
export type MorrisMove = { type: 'place'; to: number } | { type: 'move'; from: number; to: number } | { type: 'remove'; at: number };

const count = (b: (Seat | null)[], who: Seat) => b.filter((x) => x === who).length;
const inMill = (b: (Seat | null)[], i: number) => b[i] !== null && MILLS.some((m) => m.includes(i) && m.every((j) => b[j] === b[i]));
const makesMill = (b: (Seat | null)[], to: number, who: Seat) => MILLS.some((m) => m.includes(to) && m.every((j) => j === to || b[j] === who));

export function setup(): MorrisState {
  return { board: Array(24).fill(null), turn: 0, toPlace: [9, 9], removing: false, quiet: 0, last: null, winner: null, draw: false };
}

/** Pieces of `who` that may be removed: not in a mill, unless all of them are */
export function removable(b: (Seat | null)[], who: Seat) {
  const mine = b.flatMap((x, i) => (x === who ? [i] : []));
  const free = mine.filter((i) => !inMill(b, i));
  return free.length ? free : mine;
}

export function moves(s: MorrisState): MorrisMove[] {
  if (s.winner !== null || s.draw) return [];
  const me = s.turn;
  if (s.removing) return removable(s.board, (1 - me) as Seat).map((at) => ({ type: 'remove', at }));
  const empty = s.board.flatMap((x, i) => (x === null ? [i] : []));
  if (s.toPlace[me] > 0) return empty.map((to) => ({ type: 'place', to }));
  const flying = count(s.board, me) === 3;
  const out: MorrisMove[] = [];
  s.board.forEach((x, from) => {
    if (x !== me) return;
    for (const to of flying ? empty : ADJ[from].filter((j) => s.board[j] === null)) out.push({ type: 'move', from, to });
  });
  return out;
}

function endTurn(s: MorrisState): MorrisState {
  const next = (1 - s.turn) as Seat;
  const t: MorrisState = { ...s, turn: next, removing: false };
  if (t.toPlace[next] === 0 && count(t.board, next) + t.toPlace[next] < 3) return { ...t, winner: s.turn };
  if (!moves(t).length) return { ...t, winner: s.turn };
  if (t.quiet >= 100) return { ...t, draw: true };
  return t;
}

export function apply(s: MorrisState, m: MorrisMove): MorrisState {
  const board = s.board.slice();
  const me = s.turn;
  if (m.type === 'remove') {
    board[m.at] = null;
    return endTurn({ ...s, board, quiet: 0, last: { ...(s.last ?? { from: null, to: null }), removed: m.at } });
  }
  let to: number;
  let toPlace = s.toPlace;
  if (m.type === 'place') {
    board[m.to] = me;
    to = m.to;
    toPlace = me === 0 ? [s.toPlace[0] - 1, s.toPlace[1]] : [s.toPlace[0], s.toPlace[1] - 1];
  } else {
    board[m.from] = null;
    board[m.to] = me;
    to = m.to;
  }
  const next: MorrisState = { ...s, board, toPlace, quiet: m.type === 'move' ? s.quiet + 1 : s.quiet, last: { from: m.type === 'move' ? m.from : null, to, removed: null } };
  if (makesMill(board, to, me)) return { ...next, removing: true };
  return endTurn(next);
}

const same = (a: MorrisMove, b: MorrisMove) => JSON.stringify(a) === JSON.stringify(b);

export function move(s: MorrisState, seat: Seat, m: MorrisMove): MorrisState | string {
  if (seat !== s.turn) return 'Not your turn';
  if (!moves(s).some((x) => same(x, m))) return s.removing ? 'Remove one of the other player’s pieces (not from a mill if you can)' : 'Illegal move';
  return apply(s, m);
}

export const activePlayers = (s: MorrisState): Seat[] => (s.winner !== null || s.draw ? [] : [s.turn]);
export const result = (s: MorrisState): GameResult | null => (s.winner !== null ? { winners: [s.winner] } : s.draw ? { winners: [], draw: true } : null);

function evaluate(s: MorrisState, me: Seat) {
  if (s.winner !== null) return s.winner === me ? 10000 : -10000;
  const opp = (1 - me) as Seat;
  const material = count(s.board, me) + s.toPlace[me] - count(s.board, opp) - s.toPlace[opp];
  const twoOf = (who: Seat) => MILLS.filter((m) => m.filter((j) => s.board[j] === who).length === 2 && m.some((j) => s.board[j] === null)).length;
  return material * 100 + (twoOf(me) - twoOf(opp)) * 12;
}

function search(s: MorrisState, depth: number, me: Seat, alpha: number, beta: number): number {
  if (depth === 0 || s.winner !== null || s.draw) return evaluate(s, me);
  const maxing = s.turn === me;
  let best = maxing ? -Infinity : Infinity;
  for (const m of moves(s)) {
    const v = search(apply(s, m), depth - 1, me, alpha, beta);
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

export function bot(v: MorrisState, seat: Seat, ctx: BotCtx): MorrisMove {
  const ms = moves(v);
  if (ctx.level === 'easy' && ctx.random() < 0.5) return ms[Math.floor(ctx.random() * ms.length)];
  const depth = ctx.level === 'hard' ? 4 : 2;
  let best = -Infinity;
  let pick = ms[0];
  for (const m of ms) {
    const val = search(apply(v, m), depth - 1, seat, -Infinity, Infinity) + ctx.random();
    if (val > best) {
      best = val;
      pick = m;
    }
  }
  return pick;
}

const SCALE = 50;
function Board({ view: v, seat, players, canMove, onMove }: BoardProps<MorrisState, MorrisMove>) {
  const myTurn = canMove && v.turn === seat;
  const ms = myTurn ? moves(v) : [];
  const [from, setFrom] = useStateReset<number | null>(null, v);
  const targets = new Set(
    ms.flatMap((m) => (m.type === 'place' ? [m.to] : m.type === 'remove' ? [m.at] : m.type === 'move' && m.from === from ? [m.to] : [])),
  );
  const sources = new Set(ms.flatMap((m) => (m.type === 'move' ? [m.from] : [])));
  const click = (i: number) => {
    if (!myTurn) return;
    if (v.removing) return targets.has(i) && onMove({ type: 'remove', at: i });
    if (v.toPlace[seat] > 0) return targets.has(i) && onMove({ type: 'place', to: i });
    if (from !== null && targets.has(i)) return onMove({ type: 'move', from, to: i });
    setFrom(sources.has(i) ? i : null);
  };
  const lines = [
    ...[0, 1, 2].map((ring) => {
      const a = ring * SCALE + 10;
      const w = (6 - 2 * ring) * SCALE;
      return <rect key={'r' + ring} x={a} y={a} width={w} height={w} />;
    }),
    <line key="t" x1={3 * SCALE + 10} y1={10} x2={3 * SCALE + 10} y2={2 * SCALE + 10} />,
    <line key="b" x1={3 * SCALE + 10} y1={4 * SCALE + 10} x2={3 * SCALE + 10} y2={6 * SCALE + 10} />,
    <line key="l" x1={10} y1={3 * SCALE + 10} x2={2 * SCALE + 10} y2={3 * SCALE + 10} />,
    <line key="rr" x1={4 * SCALE + 10} y1={3 * SCALE + 10} x2={6 * SCALE + 10} y2={3 * SCALE + 10} />,
  ];
  const prompt = !myTurn
    ? ''
    : v.removing
      ? tx('Mill! Remove one of their pieces.')
      : v.toPlace[seat] > 0
        ? tx('Place a piece ({n} left).', { n: v.toPlace[seat] })
        : count(v.board, seat) === 3
          ? tx('Three left: you may jump anywhere.')
          : tx('Move a piece along a line.');
  return (
    <div className="stack center">
      <div className="info-row">
        {([0, 1] as Seat[]).map((p) => (
          <span key={p} className={'chip' + (v.turn === p && v.winner === null ? ' trump-chip' : '')}>
            <span className="seat-dot" style={{ background: `var(--p${p})` }} /> {p === seat ? tx('You') : players[p].name}: {tx('{n} on board, {m} to place', { n: count(v.board, p), m: v.toPlace[p] })}
          </span>
        ))}
      </div>
      {prompt && <p className="small">{prompt}</p>}
      <svg className="dt-board" viewBox={`0 0 ${6 * SCALE + 20} ${6 * SCALE + 20}`}>
        <g className="dt-lines">{lines}</g>
        {POS.map(([x, y], i) => {
          const owner = v.board[i];
          const hot = targets.has(i) || (from === null && sources.has(i));
          return (
            <g key={i} onClick={() => click(i)} className={'dt-pt' + (hot ? ' can' : '') + (from === i ? ' sel' : '')}>
              <circle cx={x * SCALE + 10} cy={y * SCALE + 10} r={16} className="dt-hit" />
              {owner !== null ? (
                <circle cx={x * SCALE + 10} cy={y * SCALE + 10} r={13} style={{ fill: `var(--p${owner})` }} className={'dt-piece' + (v.last?.to === i ? ' last' : '')} />
              ) : (
                <circle cx={x * SCALE + 10} cy={y * SCALE + 10} r={5} className="dt-dot" />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Local selection state that clears whenever the game state changes */
function useStateReset<T>(initial: T, dep: unknown): [T, (v: T) => void] {
  const [v, setV] = useState(initial);
  useEffect(() => setV(initial), [dep]); // eslint-disable-line react-hooks/exhaustive-deps
  return [v, setV];
}

export const dokuzTas: GameDef<MorrisState, MorrisMove, MorrisState> = {
  id: 'dokuz-tas',
  name: 'Dokuz Taş',
  tagline: 'Place, slide, make a mill, take a piece.',
  icon: '⭕',
  minPlayers: 2,
  maxPlayers: 2,
  hiddenInfo: false,
  rules:
    'Each player has nine pieces. First take turns placing them on empty points. Then take turns sliding a piece along a line to a neighboring empty point. Whenever you make three in a row along a line (a mill), remove one of your opponent’s pieces, but not one that is in a mill unless there is no other choice. When you are down to three pieces you may jump to any empty point. You lose with two pieces left, or when you cannot move.',
  setup: () => setup(),
  activePlayers,
  view: (s) => s,
  move: (s, seat, m) => move(s, seat, m),
  result,
  bot,
  botDelay: () => 600,
  Board,
};
