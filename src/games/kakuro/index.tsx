import { useEffect, useState } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import * as L from './logic';
import { t as tx } from '../../i18n';

/** All ways to write `sum` with `len` different digits */
function combos(sum: number, len: number): number[][] {
  const out: number[][] = [];
  const go = (start: number, left: number, rem: number, cur: number[]) => {
    if (left === 0) {
      if (rem === 0) out.push(cur);
      return;
    }
    for (let d = start; d <= 9 && d <= rem; d++) go(d + 1, left - 1, rem - d, [...cur, d]);
  };
  go(1, len, sum, []);
  return out;
}

function Board({ view: v, canMove, onMove }: BoardProps<L.KakuroState, L.KakuroMove>) {
  const [sel, setSel] = useState<number | null>(null);
  const bad = L.conflicts(v);
  const n = v.size;

  useEffect(() => {
    if (!canMove) return;
    const onKey = (e: KeyboardEvent) => {
      if (sel === null) return;
      if (/^[1-9]$/.test(e.key)) onMove({ type: 'set', cell: sel, digit: Number(e.key) });
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') onMove({ type: 'set', cell: sel, digit: 0 });
      else {
        const step = { ArrowUp: -n, ArrowDown: n, ArrowLeft: -1, ArrowRight: 1 }[e.key];
        if (!step) return;
        e.preventDefault();
        let i = sel + step;
        while (i >= 0 && i < n * n && !v.white[i]) i += step;
        if (i >= 0 && i < n * n) setSel(i);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canMove, sel, v.white, n, onMove]);

  const clues = new Map<number, { across?: number; down?: number }>();
  for (const r of v.runs) clues.set(r.clue, { ...clues.get(r.clue), [r.across ? 'across' : 'down']: r.sum });
  const selRuns = sel === null ? [] : v.runs.filter((r) => r.cells.includes(sel));
  const inSelRun = new Set(selRuns.flatMap((r) => r.cells));

  return (
    <div className="stack center">
      <div className="kk-grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
        {Array.from({ length: n * n }, (_, i) => {
          if (!v.white[i]) {
            const c = clues.get(i);
            return (
              <span key={i} className="kk-black">
                {c && (
                  <>
                    <span className="kk-slash" />
                    {c.across !== undefined && <span className="kk-a">{c.across}</span>}
                    {c.down !== undefined && <span className="kk-d">{c.down}</span>}
                  </>
                )}
              </span>
            );
          }
          return (
            <button
              key={i}
              className={'kk-cell' + (sel === i ? ' sel' : inSelRun.has(i) ? ' run' : '') + (bad.has(i) ? ' bad' : '')}
              onClick={() => setSel(i)}
              disabled={!canMove}
            >
              {v.digits[i] || ''}
            </button>
          );
        })}
      </div>
      {canMove && sel !== null && (
        <>
          <div className="kk-pad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <button key={d} className="btn" onClick={() => onMove({ type: 'set', cell: sel, digit: d })}>
                {d}
              </button>
            ))}
            <button className="btn ghost" onClick={() => onMove({ type: 'set', cell: sel, digit: 0 })}>
              ⌫
            </button>
          </div>
          <div className="small muted stack-sm">
            {selRuns.map((r, k) => {
              const cs = combos(r.sum, r.cells.length);
              return (
                <span key={k}>
                  {r.across ? tx('Across') : tx('Down')}{tx(': {sum} in {length} → {v}', { sum: r.sum, length: r.cells.length, v: cs.slice(0, 6).map((c) => c.join('+')).join(' · ') })}
                  {cs.length > 6 ? tx(' (+{v} more)', { v: cs.length - 6 }) : ''}
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export const kakuro: GameDef<L.KakuroState, L.KakuroMove, L.KakuroState> = {
  id: 'kakuro',
  name: 'Kakuro',
  tagline: 'A crossword of sums.',
  icon: '➕',
  minPlayers: 1,
  maxPlayers: 1,
  hiddenInfo: false,
  options: [
    {
      id: 'size',
      label: 'Size',
      default: '7',
      choices: [
        { value: '6', label: 'Small (6 × 6)' },
        { value: '7', label: 'Medium (7 × 7)' },
        { value: '9', label: 'Large (9 × 9)' },
      ],
    },
  ],
  rules:
    'Fill the white squares with digits 1 to 9. Each run of white squares must add up to the clue at its start (the number to the left for across, above for down), and a digit may not repeat within a run. Tap a square to see which digit combinations can make its sums.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: (s) => s,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  Board,
};
