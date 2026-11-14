/**
 * Mangala, the Turkish mancala. Six pits a side with four stones each, plus a store.
 * Pick up a pit, drop the first stone back in it and sow the rest anticlockwise
 * (a single stone just moves on). Last stone in your store: go again. Last stone makes an
 * opponent's pit even: take them. Last stone in your own empty pit: take it and the
 * stones opposite. When one side runs out, that player also takes the other side's stones.
 */
import type { BoardProps, BotCtx, GameDef, GameResult, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';

export interface MangalaState {
  pits: number[];
  turn: Seat;
  last: { seat: Seat; pit: number; capture: number; again: boolean } | null;
  over: boolean;
}
export type MangalaMove = { pit: number };

const STORE = [6, 13];
const own = (seat: Seat, i: number) => (seat === 0 ? i >= 0 && i <= 5 : i >= 7 && i <= 12);
const opposite = (i: number) => 12 - i;

export function setup(): MangalaState {
  const pits = Array(14).fill(4);
  pits[6] = pits[13] = 0;
  return { pits, turn: 0, last: null, over: false };
}

export const legal = (s: Pick<MangalaState, 'pits' | 'turn'>) => Array.from({ length: 14 }, (_, i) => i).filter((i) => own(s.turn, i) && s.pits[i] > 0);

export function play(s: MangalaState, pit: number): MangalaState {
  const pits = s.pits.slice();
  const me = s.turn;
  let stones = pits[pit];
  pits[pit] = 0;
  let i = pit;
  if (stones === 1) {
    i = (i + 1) % 14;
    pits[i]++;
  } else {
    // First stone goes back into the pit it came from
    pits[pit] = 1;
    stones--;
    while (stones > 0) {
      i = (i + 1) % 14;
      if (i === STORE[1 - me]) continue;
      pits[i]++;
      stones--;
    }
  }
  let capture = 0;
  let again = false;
  if (i === STORE[me]) again = true;
  else if (!own(me, i) && pits[i] % 2 === 0) {
    capture = pits[i];
    pits[STORE[me]] += pits[i];
    pits[i] = 0;
  } else if (own(me, i) && pits[i] === 1 && pits[opposite(i)] > 0) {
    capture = pits[i] + pits[opposite(i)];
    pits[STORE[me]] += capture;
    pits[i] = pits[opposite(i)] = 0;
  }
  const side = (seat: Seat) => (seat === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12]);
  let over = false;
  for (const seat of [0, 1] as Seat[]) {
    if (side(seat).every((k) => pits[k] === 0)) {
      // The player who ran out takes everything left on the other side
      const other = (1 - seat) as Seat;
      for (const k of side(other)) {
        pits[STORE[seat]] += pits[k];
        pits[k] = 0;
      }
      over = true;
      break;
    }
  }
  return { pits, turn: again && !over ? me : ((1 - me) as Seat), last: { seat: me, pit, capture, again }, over };
}

export function move(s: MangalaState, seat: Seat, m: MangalaMove): MangalaState | string {
  if (s.over) return 'The game is over';
  if (seat !== s.turn) return 'Not your turn';
  if (!legal(s).includes(m?.pit)) return 'Pick one of your pits with stones';
  return play(s, m.pit);
}

export const activePlayers = (s: MangalaState): Seat[] => (s.over ? [] : [s.turn]);
export function result(s: MangalaState): GameResult | null {
  if (!s.over) return null;
  const [a, b] = [s.pits[6], s.pits[13]];
  return a === b ? { winners: [], draw: true } : { winners: [a > b ? 0 : 1] };
}

function search(s: MangalaState, depth: number, me: Seat, alpha: number, beta: number): number {
  if (s.over || depth === 0) return s.pits[STORE[me]] - s.pits[STORE[1 - me]] + (s.over ? Math.sign(s.pits[STORE[me]] - s.pits[STORE[1 - me]]) * 100 : 0);
  const maxing = s.turn === me;
  let best = maxing ? -Infinity : Infinity;
  for (const p of legal(s)) {
    const v = search(play(s, p), depth - 1, me, alpha, beta);
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

export function bot(v: MangalaState, seat: Seat, ctx: BotCtx): MangalaMove {
  const moves = legal(v);
  if (ctx.level === 'easy' && ctx.random() < 0.5) return { pit: moves[Math.floor(ctx.random() * moves.length)] };
  const depth = ctx.level === 'hard' ? 7 : ctx.level === 'normal' ? 4 : 1;
  let best = -Infinity;
  let pick = moves[0];
  for (const p of moves) {
    const val = search(play(v, p), depth - 1, seat, -Infinity, Infinity) + ctx.random() * 0.1;
    if (val > best) {
      best = val;
      pick = p;
    }
  }
  return { pit: pick };
}

function Stones({ n }: { n: number }) {
  return (
    <span className="mg-stones" aria-hidden>
      {Array.from({ length: Math.min(n, 12) }, (_, k) => (
        <i key={k} style={{ transform: `translate(${((k * 37) % 21) - 10}px, ${((k * 53) % 17) - 8}px)` }} />
      ))}
    </span>
  );
}

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<MangalaState, MangalaMove>) {
  const myTurn = canMove && v.turn === seat;
  const moves = new Set(myTurn ? legal(v) : []);
  // Show my pits along the bottom, left to right; the opponent's along the top, right to left
  const mine = seat === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12];
  const theirs = (seat === 0 ? [7, 8, 9, 10, 11, 12] : [0, 1, 2, 3, 4, 5]).slice().reverse();
  const opp = 1 - seat;
  const pit = (i: number) => (
    <button key={i} className={'mn-pit' + (moves.has(i) ? ' can' : '') + (v.last?.pit === i ? ' last' : '')} disabled={!moves.has(i)} onClick={() => onMove({ pit: i })} aria-label={tx('Pit with {n} stones', { n: v.pits[i] })}>
      <Stones n={v.pits[i]} />
      <b>{v.pits[i]}</b>
    </button>
  );
  const last = v.last;
  return (
    <div className="stack center">
      <div className="mn-board">
        <div className="mn-store">
          <Stones n={v.pits[STORE[opp]]} />
          <b>{v.pits[STORE[opp]]}</b>
          <span className="small">{players[opp].name}</span>
        </div>
        <div className="mn-rows">
          <div className="mn-row">{theirs.map(pit)}</div>
          <div className="mn-row">{mine.map(pit)}</div>
        </div>
        <div className="mn-store">
          <Stones n={v.pits[STORE[seat]]} />
          <b>{v.pits[STORE[seat]]}</b>
          <span className="small">{tx('You')}</span>
        </div>
      </div>
      {last && (
        <p className="small">
          {last.again
            ? tx('{name} ended in the store and goes again!', { name: last.seat === seat ? tx('You') : players[last.seat].name })
            : last.capture
              ? tx('{name} captured {n} stones!', { name: last.seat === seat ? tx('You') : players[last.seat].name, n: last.capture })
              : ''}
        </p>
      )}
    </div>
  );
}

export const mangala: GameDef<MangalaState, MangalaMove, MangalaState> = {
  id: 'mangala',
  name: 'Mangala',
  tagline: 'The Turkish mancala: sow stones, capture, fill your store.',
  icon: '🥜',
  minPlayers: 2,
  maxPlayers: 2,
  hiddenInfo: false,
  rules:
    'Each side has six pits with four stones, and a store on its right. On your turn, pick up all the stones in one of your pits, drop the first back into the same pit, then sow one into each pit anticlockwise, including your store but not your opponent’s (a lone stone just moves to the next pit). If your last stone lands in your store, play again. If it makes a pit on the other side even, take those stones. If it lands in one of your own empty pits, take it and the stones in the pit opposite. When one player’s pits are empty, that player also takes all the stones left on the other side. Most stones wins.',
  setup: () => setup(),
  activePlayers,
  view: (s) => s,
  move: (s, seat, m) => move(s, seat, m),
  result,
  bot,
  botDelay: () => 700,
  Board,
};
