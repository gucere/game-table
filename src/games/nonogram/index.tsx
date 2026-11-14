import { useState } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import * as L from './logic';
import { t as tx } from '../../i18n';

function Board({ view: v, canMove, onMove }: BoardProps<L.NonoView, L.NonoMove>) {
  const [mode, setMode] = useState<1 | 2>(1);
  const [paint, setPaint] = useState<{ value: 0 | 1 | 2; cells: number[]; anchor: number } | null>(null);
  const n = v.size;
  const shown = v.cells.slice();
  if (paint) for (const i of paint.cells) shown[i] = paint.value;

  const lineDone = (cells: number[], cl: number[]) => L.clue(cells.map((i) => shown[i] === 1)).join() === cl.join();
  const rowCells = (r: number) => Array.from({ length: n }, (_, c) => r * n + c);
  const colCells = (c: number) => Array.from({ length: n }, (_, r) => r * n + c);

  const begin = (i: number, alt: boolean) => {
    if (!canMove) return;
    const m = alt ? 2 : mode;
    setPaint({ value: v.cells[i] === m ? 0 : m, cells: [i], anchor: i });
  };
  const extend = (i: number) => {
    if (!paint) return;
    // Paint in a straight line from where the drag started
    const [ar, ac] = [Math.floor(paint.anchor / n), paint.anchor % n];
    const [r, c] = [Math.floor(i / n), i % n];
    const cells =
      r === ar
        ? Array.from({ length: Math.abs(c - ac) + 1 }, (_, k) => r * n + Math.min(c, ac) + k)
        : c === ac
          ? Array.from({ length: Math.abs(r - ar) + 1 }, (_, k) => (Math.min(r, ar) + k) * n + c)
          : paint.cells;
    setPaint({ ...paint, cells });
  };
  const finish = () => {
    if (paint) onMove({ type: 'set', cells: paint.cells, value: paint.value });
    setPaint(null);
  };

  const secs = Math.round(((v.finishedAt ?? Date.now()) - v.startedAt) / 1000);

  return (
    <div className="stack center">
      <div className="action-bar">
        <button className={'btn small' + (mode === 1 ? ' primary' : '')} onClick={() => setMode(1)}>{tx('■ Fill')}</button>
        <button className={'btn small' + (mode === 2 ? ' primary' : '')} onClick={() => setMode(2)}>{tx('✕ Mark empty')}</button>
        {v.finishedAt !== null && <span className="chip">{tx('Solved in {secs}s', { secs: secs })}</span>}
      </div>
      <div className="nn-wrap" style={{ ['--n' as string]: n }} onPointerUp={finish} onPointerLeave={finish} onContextMenu={(e) => e.preventDefault()}>
        <span />
        <div className="nn-cols">
          {v.cols.map((cl, c) => (
            <span key={c} className={'nn-clue col' + (lineDone(colCells(c), cl) ? ' done' : '')}>
              {(cl.length ? cl : [0]).map((x, k) => (
                <b key={k}>{x}</b>
              ))}
            </span>
          ))}
        </div>
        <div className="nn-rows">
          {v.rows.map((cl, r) => (
            <span key={r} className={'nn-clue row' + (lineDone(rowCells(r), cl) ? ' done' : '')}>
              {(cl.length ? cl : [0]).map((x, k) => (
                <b key={k}>{x}</b>
              ))}
            </span>
          ))}
        </div>
        <div className="nn-grid">
          {shown.map((val, i) => (
            <button
              key={i}
              className={'nn-cell' + (val === 1 ? ' fill' : val === 2 ? ' cross' : '') + ((i % n) % 5 === 4 ? ' r5' : '') + (Math.floor(i / n) % 5 === 4 ? ' b5' : '')}
              disabled={!canMove}
              onPointerDown={(e) => {
                (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
                begin(i, e.button === 2);
              }}
              onPointerEnter={() => extend(i)}
              aria-label={tx('row {v} column {v2}: {v3}', { v: Math.floor(i / n) + 1, v2: (i % n) + 1, v3: val === 1 ? 'filled' : val === 2 ? 'marked empty' : 'blank' })}
            >
              {val === 2 ? '✕' : ''}
            </button>
          ))}
        </div>
      </div>
      <p className="small muted">{tx('Drag to paint a row or column. Right-click (or switch to ✕) to mark cells you know are empty.')}</p>
    </div>
  );
}

export const nonogram: GameDef<L.NonoState, L.NonoMove, L.NonoView> = {
  id: 'nonogram',
  name: 'Nonogram',
  tagline: 'Number clues reveal a hidden picture.',
  icon: '🖼️',
  minPlayers: 1,
  maxPlayers: 1,
  hiddenInfo: false,
  options: [
    {
      id: 'size',
      label: 'Size',
      default: '10',
      choices: [
        { value: '5', label: '5 × 5' },
        { value: '10', label: '10 × 10' },
        { value: '15', label: '15 × 15' },
      ],
    },
  ],
  rules:
    'The numbers beside each row and above each column are the lengths of its runs of filled squares, in order, with at least one blank between runs. Fill the grid to match every clue. Every puzzle can be solved by logic alone, no guessing needed. Clues turn grey when their line matches.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: (s) => L.view(s),
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  Board,
};
