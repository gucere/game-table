import { useEffect, useState } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import * as L from './logic';
import { t as tx } from '../../i18n';

const NUM_COLORS = ['', '#1e6fd9', '#2e8b3a', '#d63a3a', '#5b2c99', '#8b1a1a', '#1a8b8b', '#222', '#777'];

function Timer({ v }: { v: L.MineView }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!v.startedAt || v.endedAt) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [v.startedAt, v.endedAt]);
  if (!v.startedAt) return <span>{tx('0s')}</span>;
  return <span>{tx('{v}s', { v: Math.floor(((v.endedAt ?? now) - v.startedAt) / 1000) })}</span>;
}

function Board({ view: v, canMove, onMove }: BoardProps<L.MineView, L.MineMove>) {
  const [flagMode, setFlagMode] = useState(false);
  const flags = v.flag.filter(Boolean).length;
  const click = (i: number) => {
    if (!canMove) return;
    if (v.open[i]) onMove({ type: 'chord', i });
    else onMove({ type: flagMode ? 'flag' : 'open', i });
  };
  return (
    <div className="mines-wrap">
      <div className="info-row">
        <span className="chip">💣 {v.mines - flags}</span>
        <span className="chip">
          ⏱ <Timer v={v} />
        </span>
        <button className={'btn small' + (flagMode ? ' primary' : '')} onClick={() => setFlagMode((f) => !f)} aria-pressed={flagMode}>{tx('🚩 Flag mode')}{' '}{flagMode ? 'on' : 'off'}
        </button>
      </div>
      <p className="muted small center">{tx('Right-click (or flag mode) to flag. Click an opened number to clear around it.')}</p>
      <div className="mines-scroll">
        <div className="mines" style={{ gridTemplateColumns: `repeat(${v.w}, var(--cell))` }} onContextMenu={(e) => e.preventDefault()}>
          {v.open.map((open, i) => {
            const mine = v.mineShown[i];
            let content: string | number = '';
            if (open && v.boom === i) content = '💥';
            else if (open && v.adj[i]) content = v.adj[i];
            else if (!open && mine && !v.flag[i]) content = '💣';
            else if (v.flag[i]) content = v.status === 'lost' && !mine ? '❌' : '🚩';
            return (
              <button
                key={i}
                className={'mcell' + (open ? ' open' : '') + (v.boom === i ? ' boom' : '')}
                style={{ color: typeof content === 'number' ? NUM_COLORS[content] : undefined }}
                onClick={() => click(i)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (canMove && !open) onMove({ type: 'flag', i });
                }}
                disabled={!canMove}
                aria-label={open ? tx('Open, {adj} mines around', { adj: v.adj[i] }) : v.flag[i] ? tx('Flagged') : tx('Hidden')}
              >
                {content}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const minesweeper: GameDef<L.MineState, L.MineMove, L.MineView> = {
  id: 'minesweeper',
  name: 'Minesweeper',
  tagline: 'Clear the field without hitting a mine.',
  icon: '💣',
  minPlayers: 1,
  maxPlayers: 1,
  hiddenInfo: false,
  options: [
    {
      id: 'level',
      label: 'Difficulty',
      default: 'easy',
      choices: Object.entries(L.LEVELS).map(([value, l]) => ({ value, label: l.label })),
    },
  ],
  rules: 'Numbers show how many mines touch that square. Flag every mine and open every safe square to win. Your first click is always safe.',
  setup: L.setup,
  activePlayers: (s) => (s.status === 'playing' ? [0] : []),
  view: L.view,
  move: (s, _seat, m, ctx) => L.move(s, m, ctx),
  result: L.result,
  Board,
};
