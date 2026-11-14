import { useEffect, useState } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import * as L from './logic';
import { t as tx } from '../../i18n';

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.DamaView, L.DamaMove>) {
  const [path, setPath] = useState<number[]>([]);
  const myTurn = canMove && v.turn === seat;
  useEffect(() => setPath([]), [v.last, v.turn]);

  const cands = v.legal.filter((m) => path.every((x, i) => m.path[i] === x));
  const starts = new Set(v.legal.map((m) => m.path[0]));
  const nexts = new Set(path.length ? cands.filter((m) => m.path.length > path.length).map((m) => m.path[path.length]) : []);
  const pendingCaps = new Set(cands.length && path.length > 1 ? cands[0].captures.slice(0, path.length - 1) : []);
  const mustCapture = v.legal.some((m) => m.captures.length);

  const click = (i: number) => {
    if (!myTurn) return;
    if (nexts.has(i)) {
      const p = [...path, i];
      const done = cands.filter((m) => m.path.length === p.length && m.path.every((x, k) => x === p[k]));
      if (done.length === 1 && !cands.some((m) => m.path.length > p.length && p.every((x, k) => m.path[k] === x))) {
        onMove(done[0]);
        setPath([]);
      } else setPath(p);
      return;
    }
    if (starts.has(i)) setPath(path[0] === i && path.length === 1 ? [] : [i]);
    else setPath([]);
  };

  const flip = seat === 1;
  const order = Array.from({ length: 64 }, (_, k) => (flip ? 63 - k : k));
  const lastSquares = new Set(v.last?.path ?? []);
  const counts = [0, 1].map((o) => v.board.filter((p) => p?.owner === o).length);

  return (
    <div className="stack center">
      <div className="info-row">
        {[0, 1].map((o) => (
          <span key={o} className={'chip' + (v.turn === o && !v.winner && !v.draw ? ' trump-chip' : '')}>
            <span className="seat-dot" style={{ background: `var(--p${o})` }} /> {o === seat ? tx('You') : players[o].name}{tx(': {counts} pieces', { counts: counts[o] })}</span>
        ))}
        {myTurn && mustCapture && <span className="chip urgent">{tx('You must capture!')}</span>}
      </div>
      <div className="dm-board">
        {order.map((i) => {
          const p = v.board[i];
          const isNext = nexts.has(i);
          const cls =
            'dm-sq' +
            ((Math.floor(i / 8) + (i % 8)) % 2 ? ' dark' : '') +
            (path.includes(i) ? ' sel' : '') +
            (isNext ? ' next' : '') +
            (myTurn && !path.length && starts.has(i) ? ' can' : '') +
            (lastSquares.has(i) ? ' last' : '');
          return (
            <button key={i} className={cls} onClick={() => click(i)} disabled={!myTurn} aria-label={tx('square {i}', { i: i })}>
              {p && !pendingCaps.has(i) && (path[0] !== i || path.length === 1) && (
                <span className={'dm-piece' + (p.king ? ' king' : '')} style={{ background: `var(--p${p.owner})` }}>
                  {p.king ? '♛' : ''}
                </span>
              )}
              {path.length > 1 && path[path.length - 1] === i && v.board[path[0]] && (
                <span className={'dm-piece ghost' + (v.board[path[0]]!.king ? ' king' : '')} style={{ background: `var(--p${seat})` }}>
                  {v.board[path[0]]!.king ? '♛' : ''}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {myTurn && <p className="small muted">{tx('Tap a piece, then where it goes. For a multi-capture, tap each landing square in turn.')}</p>}
    </div>
  );
}

export const dama: GameDef<L.DamaState, L.DamaMove, L.DamaView> = {
  id: 'dama',
  name: 'Dama',
  tagline: 'Turkish draughts: straight lines, big captures.',
  icon: '⛀',
  minPlayers: 2,
  maxPlayers: 2,
  hiddenInfo: false,
  rules:
    'Each side has 16 pieces on the second and third rows. Pieces move one square forward or sideways (never diagonally or backwards) and capture by jumping over an enemy piece forward or sideways onto an empty square. Captured pieces are removed at once, and you can keep jumping. Capturing is compulsory, and you must choose the sequence that takes the most pieces. A piece reaching the far row becomes a dama (♛): it moves any distance in a straight line and captures from a distance, but cannot turn straight back in the middle of a capture. Take all the enemy pieces, or leave them no move, to win.',
  setup: () => L.setup(),
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m) => L.move(s, seat, m),
  result: L.result,
  bot: L.bot,
  botDelay: () => 500,
  Board,
};
