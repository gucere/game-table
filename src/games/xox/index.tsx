import type { BoardProps, GameDef } from '../../engine/types';
import * as L from './logic';
import { t as tx } from '../../i18n';

function Mark({ seat }: { seat: number }) {
  return seat === 0 ? (
    <svg viewBox="0 0 100 100" className="xox-mark" style={{ color: 'var(--p0)' }} aria-label={tx('X')}>
      <path d="M22 22 L78 78 M78 22 L22 78" stroke="currentColor" strokeWidth="13" strokeLinecap="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 100 100" className="xox-mark" style={{ color: 'var(--p1)' }} aria-label={tx('O')}>
      <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="12" />
    </svg>
  );
}

function Board({ view, canMove, onMove }: BoardProps<L.XoxState, number>) {
  const win = L.findWin(view.board);
  return (
    <div className="xox-board" role="grid">
      {view.board.map((c, i) => (
        <button
          key={i}
          className={'xox-cell' + (win?.line.includes(i) ? ' win' : '')}
          disabled={!canMove || c !== null}
          onClick={() => onMove(i)}
          aria-label={tx('Cell {v}', { v: i + 1 })}
        >
          {c !== null && <Mark seat={c} />}
        </button>
      ))}
    </div>
  );
}

export const xox: GameDef<L.XoxState, number, L.XoxState> = {
  id: 'xox',
  name: 'XOX',
  tagline: 'Tic-tac-toe. Three in a row wins.',
  icon: '❌',
  minPlayers: 2,
  maxPlayers: 2,
  hiddenInfo: false,
  setup: L.setup,
  activePlayers: (s) => (L.result(s) ? [] : [s.turn]),
  view: (s) => s,
  move: (s, seat, m) => L.move(s, seat, m),
  result: L.result,
  bot: L.bot,
  Board,
};
