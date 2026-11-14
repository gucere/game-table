import { useState } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import * as L from './logic';
import { t as tx } from '../../i18n';

function Board({ view, canMove, onMove }: BoardProps<L.FourState, number>) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="four-wrap">
      <div className="four-board" onMouseLeave={() => setHover(null)}>
        {Array.from({ length: L.COLS }, (_, col) => {
          const full = L.dropRow(view.cells, col) < 0;
          return (
            <button
              key={col}
              className={'four-col' + (canMove && hover === col && !full ? ' hover' : '')}
              disabled={!canMove || full}
              onMouseEnter={() => setHover(col)}
              onClick={() => onMove(col)}
              aria-label={tx('Drop in column {v}', { v: col + 1 })}
            >
              {Array.from({ length: L.ROWS }, (_, row) => {
                const idx = row * L.COLS + col;
                const c = view.cells[idx];
                const cls =
                  'four-hole' +
                  (view.win?.includes(idx) ? ' win' : '') +
                  (view.last === idx ? ' last' : '');
                return (
                  <span key={row} className={cls}>
                    {c !== null && (
                      <span
                        className="four-disc"
                        style={{ background: `var(--p${c})`, ['--drop-rows' as string]: row + 1 }}
                      />
                    )}
                  </span>
                );
              })}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const fourInARow: GameDef<L.FourState, number, L.FourState> = {
  id: 'four-in-a-row',
  name: 'Four in a Row',
  tagline: 'Drop discs, line up four.',
  icon: '🔴',
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
