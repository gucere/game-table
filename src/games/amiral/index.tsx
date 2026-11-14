import { useState, type ReactNode } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import * as L from './logic';
import { t as tx } from '../../i18n';

const LETTERS = 'ABCDEFGHIJ';
const cellName = (c: number) => `${LETTERS[c % L.SIZE]}${Math.floor(c / L.SIZE) + 1}`;

function Grid({
  title,
  ships,
  marks,
  preview,
  previewOk,
  onCell,
  onHover,
  clickable,
  lastCell,
}: {
  title: string;
  ships: L.Ship[];
  marks: Record<number, L.Mark>;
  preview?: number[];
  previewOk?: boolean;
  onCell?: (c: number) => void;
  onHover?: (c: number | null) => void;
  clickable?: (c: number) => boolean;
  lastCell?: number | null;
}) {
  const shipCells = new Set(ships.flatMap(L.cellsOf));
  const prev = new Set(preview ?? []);
  return (
    <div className="am-grid-wrap">
      <span className="small muted">{title}</span>
      <div className="am-grid" onMouseLeave={() => onHover?.(null)}>
        <span />
        {LETTERS.split('').map((l) => (
          <span key={l} className="am-label">
            {l}
          </span>
        ))}
        {Array.from({ length: L.SIZE }, (_, r) => (
          <FragmentRow key={r} r={r}>
            {Array.from({ length: L.SIZE }, (_, c) => {
              const i = r * L.SIZE + c;
              const mark = marks[i];
              const can = !!onCell && (!clickable || clickable(i));
              const cls =
                'am-cell' +
                (shipCells.has(i) ? ' ship' : '') +
                (mark ? ` ${mark}` : '') +
                (prev.has(i) ? (previewOk ? ' preview' : ' preview bad') : '') +
                (lastCell === i ? ' last' : '') +
                (can ? ' can' : '');
              return (
                <button key={i} className={cls} disabled={!can} onClick={() => onCell?.(i)} onMouseEnter={() => onHover?.(i)} aria-label={`${cellName(i)}${mark ? ` ${mark}` : ''}`}>
                  {mark === 'miss' ? '•' : mark ? '✕' : ''}
                </button>
              );
            })}
          </FragmentRow>
        ))}
      </div>
    </div>
  );
}

function FragmentRow({ r, children }: { r: number; children: ReactNode }) {
  return (
    <>
      <span className="am-label">{r + 1}</span>
      {children}
    </>
  );
}

function Placement({ onDone }: { onDone: (ships: L.Ship[]) => void }) {
  const [ships, setShips] = useState<L.Ship[]>([]);
  const [h, setH] = useState(true);
  const [hover, setHover] = useState<number | null>(null);
  const next = L.FLEET[ships.length];

  const candidate = (cell: number): L.Ship | null => (next ? { r: Math.floor(cell / L.SIZE), c: cell % L.SIZE, len: next.len, h } : null);
  const fits = (s: L.Ship) => {
    if (s.h ? s.c + s.len > L.SIZE : s.r + s.len > L.SIZE) return false;
    const used = new Set(ships.flatMap(L.cellsOf));
    return L.cellsOf(s).every((c) => !used.has(c));
  };
  const cand = hover !== null ? candidate(hover) : null;
  const previewCells = cand ? L.cellsOf(cand).filter((c) => c < L.SIZE * L.SIZE && (cand.h ? Math.floor(c / L.SIZE) === cand.r : true)) : [];

  return (
    <div className="stack-sm center">
      <span className="small">{next ? tx('Place your {name} ({nameTr}, {len} squares).', { name: next.name, nameTr: next.nameTr, len: next.len }) : tx('Fleet ready!')}</span>
      <div className="action-bar">
        <button className="btn small" onClick={() => setH((x) => !x)} disabled={!next}>
          ⟲ {h ? tx('Horizontal') : tx('Vertical')}
        </button>
        <button className="btn small" onClick={() => setShips(L.randomFleet(Math.random))}>{tx('🎲 Random')}</button>
        <button className="btn small ghost" onClick={() => setShips((s) => s.slice(0, -1))} disabled={!ships.length}>{tx('↶ Undo')}</button>
      </div>
      <Grid
        title={tx('Your waters')}
        ships={ships}
        marks={{}}
        preview={previewCells}
        previewOk={!!cand && fits(cand)}
        onHover={setHover}
        onCell={(c) => {
          const s = candidate(c);
          if (s && fits(s)) setShips((x) => [...x, s]);
        }}
        clickable={() => !!next}
      />
      <button className="btn primary" disabled={!!next} onClick={() => onDone(ships)}>{tx('Ready, start firing')}</button>
    </div>
  );
}

function Board({ view: v, players, canMove, onMove }: BoardProps<L.AmView, L.AmMove>) {
  const enemy = 1 - v.me;
  if (v.phase === 'place') {
    if (!v.myShips && canMove) return <Placement onDone={(ships) => onMove({ type: 'place', ships })} />;
    return <p className="center muted">{tx('Waiting for {name} to place their fleet…', { name: players[enemy].name })}</p>;
  }
  const lastText = v.last
    ? `${v.last.seat === v.me ? 'You' : players[v.last.seat].name} fired at ${cellName(v.last.cell)}: ${v.last.hit ? (v.last.sunk ? `sunk the ${v.last.sunk}! 💥` : 'hit! 🔥') : 'miss.'}`
    : '';
  return (
    <div className="stack center am">
      <div className="info-row">
        <span className="chip">{tx('Your ships left: {myLeft}', { myLeft: v.myLeft })}</span>
        <span className="chip">{tx('Enemy ships left: {enemyLeft}', { enemyLeft: v.enemyLeft })}</span>
      </div>
      {lastText && <p className="small">{lastText}</p>}
      <div className="am-boards">
        <Grid
          title={tx('{name}\'s waters: fire here', { name: players[enemy].name })}
          ships={v.enemySunk}
          marks={v.outgoing}
          onCell={(c) => onMove({ type: 'fire', cell: c })}
          clickable={(c) => canMove && !(c in v.outgoing)}
          lastCell={v.last?.seat === v.me ? v.last.cell : null}
        />
        <Grid title={tx('Your waters')} ships={v.myShips ?? []} marks={v.incoming} lastCell={v.last && v.last.seat !== v.me ? v.last.cell : null} />
      </div>
    </div>
  );
}

export const amiral: GameDef<L.AmState, L.AmMove, L.AmView> = {
  id: 'amiral-batti',
  name: 'Amiral Battı',
  tagline: 'Sea battle: hide your fleet, sink theirs.',
  icon: '🚢',
  minPlayers: 2,
  maxPlayers: 2,
  hiddenInfo: true,
  options: [
    {
      id: 'extra',
      label: 'A hit earns another shot',
      default: 'no',
      choices: [
        { value: 'no', label: 'No (take turns)' },
        { value: 'yes', label: 'Yes' },
      ],
    },
  ],
  rules:
    'Each player secretly places 5 ships (5, 4, 3, 3 and 2 squares) on a 10×10 grid. Ships go in straight lines and cannot overlap. Then take turns firing at a square of the enemy grid: you learn whether it was a hit or a miss, and when a ship is sunk. Sink the whole enemy fleet to win.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m) => L.move(s, seat, m),
  result: L.result,
  bot: L.bot,
  botDelay: () => 800,
  Board,
};
