import type { BoardProps, GameDef, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';
import * as L from './logic';

const WHERE = ['top left', 'top middle', 'top right', 'middle left', 'centre', 'middle right', 'bottom left', 'bottom middle', 'bottom right'];

function Mark({ seat, big }: { seat: number; big?: boolean }) {
  return seat === 0 ? (
    <svg viewBox="0 0 100 100" className={'xox-mark' + (big ? ' sx-big' : '')} style={{ color: 'var(--p0)' }} aria-label={tx('X')}>
      <path d="M22 22 L78 78 M78 22 L22 78" stroke="currentColor" strokeWidth={big ? 10 : 13} strokeLinecap="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 100 100" className={'xox-mark' + (big ? ' sx-big' : '')} style={{ color: 'var(--p1)' }} aria-label={tx('O')}>
      <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth={big ? 9 : 12} />
    </svg>
  );
}

function Board({ view: v, canMove, onMove }: BoardProps<L.SuperState, number>) {
  const legal = new Set(canMove ? L.legalMoves(v) : []);
  return (
    <div className="stack-sm center">
      {!v.over && (
        <p className="small muted">
          {v.forced === null ? tx('Play in any open board.') : tx('Play in the {where} board.', { where: tx(WHERE[v.forced]) })}
        </p>
      )}
      <div className="sx-board" role="grid" aria-label={tx('Big board')}>
        {Array.from({ length: 9 }, (_, b) => {
          const owner = v.boards[b];
          const open = canMove && owner === null && (v.forced === null || v.forced === b);
          return (
            <div key={b} className={'sx-small' + (open ? ' open' : '') + (owner === 'draw' ? ' full' : '')}>
              {Array.from({ length: 9 }, (_, c) => {
                const i = b * 9 + c;
                const cell = v.cells[i];
                return (
                  <button
                    key={c}
                    className={'sx-cell' + (v.last === i ? ' last' : '')}
                    disabled={!legal.has(i)}
                    onClick={() => onMove(i)}
                    aria-label={tx('Board {b}, square {c}', { b: b + 1, c: c + 1 })}
                  >
                    {cell !== null && <Mark seat={cell} />}
                  </button>
                );
              })}
              {owner !== null && owner !== 'draw' && (
                <span className="sx-owner">
                  <Mark seat={owner} big />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function teach(v: L.SuperState, seat: Seat): string | null {
  if (v.over) return null;
  const moves = L.legalMoves(v);
  for (const m of moves) if (L.apply(v, m).winner === seat) return tx('You can win the whole game right now!');
  // Moves that hand the opponent a free choice, or a board they can win at once
  const risky = moves.filter((m) => {
    const after = L.apply(v, m);
    return after.forced === null || L.legalMoves(after).some((r) => after.boards[Math.floor(r / 9)] === null && L.apply(after, r).boards[Math.floor(r / 9)] === 1 - seat);
  });
  if (risky.length && risky.length < moves.length) return tx('Look where each move sends your opponent. Some squares let them win a board or play anywhere next.');
  if (v.cells.every((c) => c === null)) return tx('The square you choose sends your opponent to the matching board. The centre board is the most valuable, just like the centre square.');
  return tx('Win small boards in a line, but don’t forget: every move also picks your opponent’s next board.');
}

export const superXox: GameDef<L.SuperState, number, L.SuperState> = {
  id: 'super-xox',
  name: 'Süper XOX',
  tagline: 'Nine tic-tac-toe boards in one, and every move picks where your opponent plays.',
  icon: '#️⃣',
  minPlayers: 2,
  maxPlayers: 2,
  hiddenInfo: false,
  rules:
    'The big board is made of nine small tic-tac-toe boards. Take turns placing your mark. The square you pick inside a small board sends your opponent to the small board in the same position: play the top-right square, and they must play in the top-right board. Three in a row on a small board wins that board. Win three small boards in a row to win the game. If you are sent to a board that is already won or full, you may play in any open board. If no moves are left, it’s a draw.',
  setup: L.setup,
  activePlayers: (s) => (s.over ? [] : [s.turn]),
  view: (s) => s,
  move: (s, seat, m) => L.move(s, seat, m),
  result: L.result,
  bot: L.bot,
  botDelay: () => 500,
  describeMove: (_v, m) => tx('Play the {square} square of the {board} board.', { square: tx(WHERE[m % 9]), board: tx(WHERE[Math.floor(m / 9)]) }),
  teach,
  Board,
};
