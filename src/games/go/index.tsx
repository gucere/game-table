import { useState } from 'react';
import type { BoardProps, GameDef, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';
import * as L from './logic';

const LETTERS = 'ABCDEFGHJKLMNOPQRST';
export const pointName = (at: number, size: number) => LETTERS[at % size] + (size - Math.floor(at / size));

function stars(size: number): number[] {
  const e = size === 9 ? 2 : 3;
  const m = (size - 1) / 2;
  const lines = size === 9 ? [e, size - 1 - e] : [e, m, size - 1 - e];
  const pts = lines.flatMap((r) => lines.map((c) => r * size + c));
  if (size === 9) pts.push(m * size + m);
  return pts;
}

function Board({ view: v, seat, players, canMove, onMove, result }: BoardProps<L.GoState, L.GoMove>) {
  const [error, setError] = useState('');
  const [showScore, setShowScore] = useState(false);
  const n = v.size;
  const cell = 100 / (n + 1);
  const pos = (i: number) => cell * (i + 1);
  const ended = !!v.over;
  const area = ended || showScore ? L.areaScore(v.board, n) : null;
  const myColor = L.color(seat);

  const tap = (at: number) => {
    if (!canMove) return;
    const r = L.tryPlay(v, at);
    if (typeof r === 'string') {
      setError(tx(r));
      return;
    }
    setError('');
    onMove({ type: 'play', at });
  };

  const score = v.over?.score ?? (area ? [area.score[0], area.score[1] + v.komi] : null);
  return (
    <div className="stack-sm center go">
      <div className="info-row">
        {[0, 1].map((s) => (
          <span key={s} className={'chip' + (v.turn === s && !ended ? ' on' : '')}>
            <span className={'go-dot ' + (s === 0 ? 'b' : 'w')} /> {players[s]?.name} · {tx('{n} captured', { n: v.captures[s] })}
          </span>
        ))}
        <span className="chip">{tx('Komi {k}', { k: v.komi })}</span>
      </div>
      <svg viewBox="0 0 100 100" className="go-board" role="grid" aria-label={tx('Go board')}>
        <rect x="0" y="0" width="100" height="100" rx="1.5" className="go-wood" />
        {Array.from({ length: n }, (_, i) => (
          <g key={i}>
            <line x1={pos(0)} y1={pos(i)} x2={pos(n - 1)} y2={pos(i)} className="go-line" />
            <line x1={pos(i)} y1={pos(0)} x2={pos(i)} y2={pos(n - 1)} className="go-line" />
          </g>
        ))}
        {stars(n).map((p) => (
          <circle key={p} cx={pos(p % n)} cy={pos(Math.floor(p / n))} r={cell * 0.1} className="go-star" />
        ))}
        {v.board.map((pt, i) => {
          const x = pos(i % n);
          const y = pos(Math.floor(i / n));
          const owner = area?.owner[i];
          return (
            <g key={i} onClick={() => tap(i)} className={canMove && pt === 0 ? 'go-pt open' : 'go-pt'}>
              <rect x={x - cell / 2} y={y - cell / 2} width={cell} height={cell} fill="transparent" />
              {pt !== 0 && <circle cx={x} cy={y} r={cell * 0.47} className={pt === 1 ? 'go-stone b' : 'go-stone w'} />}
              {pt === 0 && canMove && <circle cx={x} cy={y} r={cell * 0.45} className={'go-ghost ' + (myColor === 1 ? 'b' : 'w')} />}
              {pt === 0 && !!owner && <rect x={x - cell * 0.18} y={y - cell * 0.18} width={cell * 0.36} height={cell * 0.36} className={owner === 1 ? 'go-terr b' : 'go-terr w'} />}
              {v.last?.at === i && <circle cx={x} cy={y} r={cell * 0.16} className={pt === 1 ? 'go-last onb' : 'go-last onw'} />}
            </g>
          );
        })}
      </svg>
      {error && <p className="notice">{error}</p>}
      {v.last && v.last.at === null && !ended && <p className="small">{tx('{name} passed.', { name: players[v.last.seat]?.name ?? '' })}</p>}
      {canMove && !result && (
        <div className="row center-row">
          <button className="btn" onClick={() => onMove({ type: 'pass' })}>
            {tx('Pass')}
          </button>
          <button className="btn ghost small" onClick={() => setShowScore((x) => !x)}>
            {showScore ? tx('Hide the count') : tx('Count the board')}
          </button>
          <button
            className="btn ghost small"
            onClick={() => {
              if (confirm(tx('Resign this game?'))) onMove({ type: 'resign' });
            }}
          >
            {tx('Resign')}
          </button>
        </div>
      )}
      {score && (
        <p className="small">
          {v.over?.reason === 'resign'
            ? tx('{name} resigned.', { name: players[v.over.by!]?.name ?? '' })
            : tx('Black {b} · White {w} (with komi)', { b: score[0], w: score[1] })}
        </p>
      )}
    </div>
  );
}

function teach(v: L.GoState, seat: Seat): string | null {
  if (v.over) return null;
  const mine = L.color(seat);
  const theirs = mine === 1 ? 2 : 1;
  const seen = new Set<number>();
  // Atari: a group with one liberty left, ours or theirs
  for (let i = 0; i < v.board.length; i++) {
    if (v.board[i] === 0 || seen.has(i)) continue;
    const g = L.libertiesOf(v, i);
    if (g.liberties !== 1) continue;
    const last = g.stones.flatMap((p) => L.neighbours(v.size)[p]).find((q) => v.board[q] === 0)!;
    g.stones.forEach((p) => seen.add(p));
    if (v.board[i] === theirs) return tx('Atari! Those {n} stones have one liberty left. Play {sq} to capture them.', { n: g.stones.length, sq: pointName(last, v.size) });
    if (v.board[i] === mine) return tx('Your stones near {sq} are in atari (one liberty left). Extend at {sq} or connect, or they’ll be captured.', { sq: pointName(last, v.size) });
  }
  if (v.ply < v.size) return tx('Opening: corners first, then sides, then the centre. Stones on the third and fourth lines are strongest.');
  if (v.passes === 1) return tx('Your opponent passed. If you pass too, the game ends and the board is counted: make sure dead stones in your area are captured first.');
  return tx('Each group needs two separate eyes (empty points inside) to live forever. Keep your groups connected and look for weak enemy groups to attack.');
}

export const go: GameDef<L.GoState, L.GoMove, L.GoState> = {
  id: 'go',
  name: 'Go',
  tagline: 'Surround more of the board than your opponent.',
  icon: '⚫',
  minPlayers: 2,
  maxPlayers: 2,
  hiddenInfo: false,
  options: [
    {
      id: 'size',
      label: 'Board size',
      default: '9',
      choices: [
        { value: '9', label: '9 × 9 (quick)' },
        { value: '13', label: '13 × 13' },
        { value: '19', label: '19 × 19 (full)' },
      ],
    },
    {
      id: 'komi',
      label: 'Komi (points for White)',
      default: '6.5',
      choices: [
        { value: '0.5', label: '0.5' },
        { value: '5.5', label: '5.5' },
        { value: '6.5', label: '6.5' },
        { value: '7.5', label: '7.5' },
      ],
    },
  ],
  rules:
    'Black (first player) and White take turns placing a stone on an empty point. Stones next to each other along the lines form a group; the empty points next to a group are its liberties. Take a group’s last liberty and it is captured. You may not play a stone that would have no liberties (unless it captures), and you may not retake a ko at once. Instead of playing you can pass; when both pass in a row, the game is counted: your stones plus the empty points only you surround, and White gets komi for moving second. Every stone still on the board counts, so capture dead stones before you pass.',
  setup: L.setup,
  activePlayers: (s) => (s.over ? [] : [s.turn]),
  view: (s) => s,
  move: (s, seat, m) => L.move(s, seat, m),
  result: L.result,
  bot: L.bot,
  botDelay: () => 400,
  describeMove: (v, m) => (m.type === 'play' ? tx('Play at {sq}.', { sq: pointName(m.at, v.size) }) : m.type === 'pass' ? tx('Pass.') : tx('Resign.')),
  teach,
  Board,
};
