import type { BoardProps, GameDef, Seat } from '../../engine/types';
import * as L from './logic';
import { t as tx } from '../../i18n';

const DICE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.KizmaView, L.KizmaMove>) {
  const myTurn = canMove && v.turn === seat;
  // Who sits in each board corner
  const ownerOfSlot = (slot: number) => v.slot.indexOf(slot);

  type Cell = { kind: 'track' | 'home' | 'yard' | 'start'; slot?: number } | null;
  const grid: Cell[][] = Array.from({ length: 11 }, () => Array(11).fill(null));
  L.PATH.forEach(([c, r], i) => (grid[r][c] = { kind: i % 10 === 0 ? 'start' : 'track', slot: i % 10 === 0 ? i / 10 : undefined }));
  L.HOMES.forEach((h, slot) => h.forEach(([c, r]) => (grid[r][c] = { kind: 'home', slot })));
  L.YARDS.forEach((y, slot) => y.forEach(([c, r]) => (grid[r][c] = { kind: 'yard', slot })));

  // Where each piece is drawn
  const at = new Map<string, { seat: Seat; piece: number }>();
  v.pieces.forEach((ps, s) =>
    ps.forEach((p, i) => {
      const slot = v.slot[s];
      const [c, r] = p === -1 ? L.YARDS[slot][i] : p < L.TRACK ? L.PATH[L.absolute(slot, p)] : L.HOMES[slot][p - L.TRACK];
      at.set(`${c},${r}`, { seat: s, piece: i });
    }),
  );

  const lastText = v.last
    ? `${v.last.seat === seat ? 'You' : players[v.last.seat].name} rolled ${v.last.dice}` +
      (v.last.captured !== null ? ` and sent ${v.last.captured === seat ? 'you' : players[v.last.captured].name} back to start! 😤` : '')
    : '';

  return (
    <div className="stack center kizma">
      <div className="info-row">
        {players.map((p, i) => (
          <span key={i} className={'chip' + (v.turn === i && v.phase !== 'done' ? ' trump-chip' : '')}>
            <span className="seat-dot" style={{ background: `var(--p${i})` }} /> {i === seat ? tx('You') : p.name}{tx(': {length}/4 home', { length: v.pieces[i].filter((x) => x >= L.TRACK).length })}</span>
        ))}
      </div>

      <div className="kz-board" role="grid" aria-label={tx('Kızma Birader board')}>
        {grid.map((row, r) =>
          row.map((cell, c) => {
            if (!cell) return <span key={`${r}-${c}`} className="kz-empty" />;
            const piece = at.get(`${c},${r}`);
            const owner = cell.slot !== undefined ? ownerOfSlot(cell.slot) : -1;
            const canClick = !!piece && myTurn && piece.seat === seat && v.movable.includes(piece.piece);
            return (
              <span
                key={`${r}-${c}`}
                className={`kz-cell ${cell.kind}`}
                style={owner >= 0 ? { ['--slot' as string]: `var(--p${owner})` } : undefined}
              >
                {piece && (
                  <button
                    className={'kz-piece' + (canClick ? ' can' : '')}
                    style={{ background: `var(--p${piece.seat})` }}
                    disabled={!canClick}
                    onClick={() => onMove({ type: 'move', piece: piece.piece })}
                    aria-label={tx('{name} piece {v}', { name: players[piece.seat].name, v: piece.piece + 1 })}
                  />
                )}
              </span>
            );
          }),
        )}
      </div>

      <div className="row center-row">
        <span className="kz-dice" aria-label={v.dice ? tx('Dice: {dice}', { dice: v.dice }) : tx('Dice')}>
          {v.dice ? DICE[v.dice] : v.last && v.last.seat === v.turn ? DICE[v.last.dice] : '🎲'}
        </span>
        {myTurn && v.phase === 'roll' && (
          <button className="btn primary" onClick={() => onMove({ type: 'roll' })} autoFocus>{tx('Roll')}{' '}{v.tries > 1 ? tx('({tries} tries for a 6)', { tries: v.tries }) : ''}
          </button>
        )}
        {myTurn && v.phase === 'move' && <span className="small">{tx('Tap a glowing piece to move it {dice}.', { dice: v.dice })}</span>}
      </div>
      {lastText && <p className="small">{lastText}</p>}
    </div>
  );
}

export const kizma: GameDef<L.KizmaState, L.KizmaMove, L.KizmaView> = {
  id: 'kizma-birader',
  name: 'Kızma Birader',
  tagline: "Race your four pieces home. Don't get angry, brother!",
  icon: '🎲',
  minPlayers: 2,
  maxPlayers: 4,
  defaultPlayers: 4,
  hiddenInfo: false,
  rules:
    'Roll a 6 to bring a piece onto your start square (with nothing out, you get three tries). Move pieces clockwise by the roll; a 6 lets you roll again. Landing on another player\'s piece sends it back to their start. You cannot land on your own piece. After a full lap a piece enters your four home squares, needing an exact roll and without jumping over your own pieces there. First to get all four home wins.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  bot: L.bot,
  botDelay: (s) => (s.phase === 'roll' ? 700 : 600),
  Board,
};
