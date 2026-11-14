import { useEffect, useState } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import * as L from './logic';
import { t as tx } from '../../i18n';

function Board({ view: v, canMove, onMove }: BoardProps<L.SudokuView, L.SudokuMove>) {
  const [sel, setSel] = useState<number | null>(null);
  const [noteMode, setNoteMode] = useState(false);

  const input = (val: number) => {
    if (sel === null || !canMove || v.givens[sel]) return;
    onMove({ type: noteMode && val ? 'note' : 'set', i: sel, v: val });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sel === null) return;
      if (/^[1-9]$/.test(e.key)) input(Number(e.key));
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') input(0);
      else if (e.key === 'n') setNoteMode((n) => !n);
      else {
        const d = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key];
        if (d) {
          e.preventDefault();
          setSel((s) => (s === null ? 0 : Math.min(80, Math.max(0, s + d))));
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const selVal = sel !== null ? v.cells[sel] : 0;
  const counts = Array(10).fill(0);
  v.cells.forEach((x) => counts[x]++);

  return (
    <div className="sudoku-wrap">
      <div className="info-row">
        <span className="chip">{tx('Mistakes: {mistakes}', { mistakes: v.mistakes })}</span>
        <button className={'btn small' + (noteMode ? ' primary' : '')} onClick={() => setNoteMode((n) => !n)} aria-pressed={noteMode}>{tx('✏️ Notes')}{' '}{noteMode ? 'on' : 'off'}
        </button>
      </div>
      <div className="sudoku" role="grid">
        {v.cells.map((val, i) => {
          const r = Math.floor(i / 9);
          const c = i % 9;
          const peer = sel !== null && (L.PEERS[sel].includes(i) || sel === i);
          const same = selVal && val === selVal;
          const cls =
            'scell' +
            (v.givens[i] ? ' given' : '') +
            (sel === i ? ' sel' : peer ? ' peer' : '') +
            (same ? ' same' : '') +
            (v.conflicts[i] ? ' bad' : '') +
            (c % 3 === 2 && c < 8 ? ' br' : '') +
            (r % 3 === 2 && r < 8 ? ' bb' : '');
          return (
            <button key={i} className={cls} onClick={() => setSel(i)} aria-label={tx('Row {v} column {v2}{v3}', { v: r + 1, v2: c + 1, v3: val ? `, ${val}` : '' })}>
              {val ? (
                val
              ) : v.notes[i] ? (
                <span className="notes">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <span key={n}>{v.notes[i] & (1 << n) ? n : ''}</span>
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="numpad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button key={n} className="btn" disabled={!canMove || counts[n] >= 9} onClick={() => input(n)}>
            {n}
          </button>
        ))}
        <button className="btn" disabled={!canMove} onClick={() => input(0)} aria-label={tx('Erase')}>
          ⌫
        </button>
      </div>
    </div>
  );
}

export const sudoku: GameDef<L.SudokuState, L.SudokuMove, L.SudokuView> = {
  id: 'sudoku',
  name: 'Sudoku',
  tagline: 'Fill the grid: every row, column and box gets 1–9.',
  icon: '🔢',
  minPlayers: 1,
  maxPlayers: 1,
  hiddenInfo: false,
  options: [
    {
      id: 'level',
      label: 'Difficulty',
      default: 'easy',
      choices: [
        { value: 'easy', label: 'Easy' },
        { value: 'medium', label: 'Medium' },
        { value: 'hard', label: 'Hard' },
      ],
    },
  ],
  rules: 'Each row, column and 3×3 box must contain the numbers 1 to 9 once. Pick a square, then a number. Notes mode adds small pencil marks. Keyboard: 1–9, arrows, Backspace, N for notes.',
  setup: L.setup,
  activePlayers: (s) => (s.endedAt ? [] : [0]),
  view: L.view,
  move: (s, _seat, m, ctx) => L.move(s, m, ctx.now()),
  result: L.result,
  Board,
};
