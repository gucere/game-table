import { useEffect, useRef } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import * as L from './logic';
import { t as tx } from '../../i18n';

const KEYS: Record<string, L.Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

const BEST_KEY = 'oyun-masasi:merge-best';
function bestScore(score: number) {
  try {
    const b = Number(localStorage.getItem(BEST_KEY)) || 0;
    if (score > b) localStorage.setItem(BEST_KEY, String(score));
    return Math.max(b, score);
  } catch {
    return score;
  }
}

/** Tile colors: Iznik tile blues and turquoise, warming to coral and gold */
const COLORS = ['#e8f1f2', '#cfe8ea', '#9fd6d9', '#5fbcc4', '#2a9aa6', '#1d6f8f', '#244c86', '#4b3b8f', '#a23a6b', '#d4553b', '#e88d2a', '#e9b949', '#3c3c3c'];
const tileColor = (v: number) => COLORS[Math.min(COLORS.length - 1, Math.log2(v) - 1)];

function Board({ view: v, canMove, onMove }: BoardProps<L.MergeState, L.MergeMove>) {
  const start = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!canMove) return;
    const onKey = (e: KeyboardEvent) => {
      const d = KEYS[e.key];
      if (!d) return;
      e.preventDefault();
      if (L.slide(v.grid, v.size, d).changed) onMove({ type: 'slide', dir: d });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canMove, v.grid, v.size, onMove]);

  const best = bestScore(v.score);
  return (
    <div className="stack center">
      <div className="info-row">
        <span className="chip">{tx('Score {score}', { score: v.score })}</span>
        <span className="chip">{tx('Best {best}', { best: best })}</span>
        <span className="chip">{tx('Biggest tile {best}', { best: v.best })}</span>
      </div>
      <div
        className="mg-board"
        style={{ gridTemplateColumns: `repeat(${v.size}, 1fr)` }}
        onPointerDown={(e) => (start.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const s0 = start.current;
          start.current = null;
          if (!s0 || !canMove) return;
          const dx = e.clientX - s0.x;
          const dy = e.clientY - s0.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
          const d: L.Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
          if (L.slide(v.grid, v.size, d).changed) onMove({ type: 'slide', dir: d });
        }}
      >
        {v.grid.map((val, i) => (
          <span
            key={`${i}-${val}-${v.moves}`}
            className={'mg-tile' + (val ? ' on' : '') + (v.merged.includes(i) ? ' pop' : '') + (v.spawned === i ? ' new' : '')}
            style={val ? { background: tileColor(val), color: val >= 16 ? '#fff' : '#1d3b4a', fontSize: `${Math.max(0.9, 2.1 - String(val).length * 0.28) * (4 / v.size)}rem` } : undefined}
          >
            {val || ''}
          </span>
        ))}
      </div>
      <p className="small muted">{tx('Swipe, or use the arrow keys / WASD.')}</p>
    </div>
  );
}

export const merge: GameDef<L.MergeState, L.MergeMove, L.MergeState> = {
  id: 'birlestir',
  name: 'Birleştir',
  tagline: 'Slide, merge, double up. How big can you go?',
  icon: '🔷',
  minPlayers: 1,
  maxPlayers: 1,
  hiddenInfo: false,
  options: [
    {
      id: 'size',
      label: 'Board',
      default: '4',
      choices: [
        { value: '4', label: '4 × 4' },
        { value: '5', label: '5 × 5 (easier)' },
        { value: '6', label: '6 × 6 (relaxed)' },
      ],
    },
  ],
  rules: 'Swipe (or use the arrow keys) to slide every tile as far as it goes. Two equal tiles that bump into each other merge into one with their sum, which adds to your score. A new tile appears after every move. The game ends when nothing can move.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: (s) => s,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  Board,
};
