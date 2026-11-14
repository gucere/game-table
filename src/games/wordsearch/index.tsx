import { useEffect, useState } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import * as L from './logic';
import { t as tx } from '../../i18n';

/** Cells on the straight line from a to b (or null if not on one of the 8 directions) */
function line(size: number, a: number, b: number): number[] | null {
  const [r0, c0] = [Math.floor(a / size), a % size];
  const [r1, c1] = [Math.floor(b / size), b % size];
  const dr = Math.sign(r1 - r0);
  const dc = Math.sign(c1 - c0);
  const len = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0));
  if (r1 - r0 !== dr * len || c1 - c0 !== dc * len) return null;
  return Array.from({ length: len + 1 }, (_, k) => (r0 + dr * k) * size + (c0 + dc * k));
}

const HUES = [12, 48, 95, 160, 200, 250, 290, 330];

function Board({ view: v, canMove, onMove }: BoardProps<L.WSState, L.WSMove>) {
  const [start, setStart] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (v.finishedAt !== null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [v.finishedAt]);

  const sel = start !== null && end !== null ? (line(v.size, start, end) ?? [start]) : start !== null ? [start] : [];
  const selSet = new Set(sel);
  const foundBy = new Map<number, number>();
  v.words.forEach((w, k) => v.found[k] && w.cells.forEach((c) => foundBy.set(c, k)));

  const submit = (cells: number[]) => {
    if (cells.length > 1) onMove({ type: 'find', cells });
    setStart(null);
    setEnd(null);
  };
  const secs = Math.max(0, Math.round(((v.finishedAt ?? now) - v.startedAt) / 1000));

  return (
    <div className="stack center">
      <div className="info-row">
        <span className="chip">{tx('Found {length} / {length2}', { length: v.found.filter(Boolean).length, length2: v.words.length })}
        </span>
        <span className="chip">
          ⏱ {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
        </span>
      </div>
      <div
        className="ws-grid"
        style={{ gridTemplateColumns: `repeat(${v.size}, 1fr)` }}
        onPointerUp={() => {
          if (dragging && start !== null && end !== null && end !== start) submit(sel);
          setDragging(false);
        }}
        onPointerLeave={() => setDragging(false)}
      >
        {v.grid.map((ch, i) => {
          const f = foundBy.get(i);
          return (
            <button
              key={i}
              className={'ws-cell' + (selSet.has(i) ? ' sel' : '')}
              style={f !== undefined ? { background: `hsl(${HUES[f % HUES.length]} 70% 60% / 0.55)` } : undefined}
              disabled={!canMove}
              onPointerDown={(e) => {
                (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
                if (start !== null && !dragging) {
                  // Second tap: finish the selection
                  const cells = line(v.size, start, i);
                  if (cells && i !== start) submit(cells);
                  else setStart(i === start ? null : i);
                  return;
                }
                setStart(i);
                setEnd(i);
                setDragging(true);
              }}
              onPointerEnter={() => dragging && setEnd(i)}
            >
              {ch}
            </button>
          );
        })}
      </div>
      <div className="ws-words">
        {v.words.map((w, k) => (
          <span key={w.word} className={v.found[k] ? 'found' : ''}>
            {w.word}
          </span>
        ))}
      </div>
      <p className="small muted">{tx('Drag across a word, or tap its first and last letter.')}</p>
    </div>
  );
}

export const wordsearch: GameDef<L.WSState, L.WSMove, L.WSState> = {
  id: 'kelime-avi',
  name: 'Kelime Avı',
  tagline: 'Find every hidden word in the letter grid.',
  icon: '🔎',
  minPlayers: 1,
  maxPlayers: 1,
  hiddenInfo: false,
  options: [
    {
      id: 'lang',
      label: 'Language',
      default: 'tr',
      choices: [
        { value: 'tr', label: 'Türkçe' },
        { value: 'en', label: 'English' },
      ],
    },
    {
      id: 'level',
      label: 'Level',
      default: 'normal',
      choices: [
        { value: 'easy', label: 'Easy: 9×9, across and down' },
        { value: 'normal', label: 'Normal: 11×11, plus diagonals' },
        { value: 'hard', label: 'Hard: 13×13, any direction, even backwards' },
      ],
    },
  ],
  rules: 'Words hide in straight lines. Drag from the first letter to the last (or tap both ends) to circle a word. Find them all as fast as you can.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: (s) => s,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  Board,
};
