import { useEffect, useState } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import * as L from './logic';
import { t as tx } from '../../i18n';

const GLYPH: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.ChessView, L.CMove>) {
  const [from, setFrom] = useState<number | null>(null);
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null);
  const myTurn = canMove && v.turn === v.myColor;
  useEffect(() => {
    setFrom(null);
    setPromo(null);
  }, [v.moves.length]);

  const targets = new Set(from === null ? [] : v.legal.filter((m) => m.from === from).map((m) => m.to));
  const sources = new Set(v.legal.map((m) => m.from));
  const last = v.moves[v.moves.length - 1];
  const kingInCheck = v.check ? v.board.indexOf(v.turn === 'w' ? 'K' : 'k') : -1;
  const flip = v.myColor === 'b';
  const order = Array.from({ length: 64 }, (_, k) => (flip ? 63 - k : k));
  const opp = 1 - seat;

  const click = (i: number) => {
    if (!myTurn) return;
    if (from !== null && targets.has(i)) {
      const options = v.legal.filter((m) => m.from === from && m.to === i);
      if (options.some((m) => m.promo)) setPromo({ from, to: i });
      else onMove({ from, to: i });
      return;
    }
    setFrom(sources.has(i) && from !== i ? i : null);
  };

  // Captured pieces, from the material missing on the board
  const startCount: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const missing = (c: 'w' | 'b') =>
    Object.entries(startCount).flatMap(([t, n]) => {
      const have = v.board.filter((x) => x === (c === 'w' ? t.toUpperCase() : t)).length;
      return Array(Math.max(0, n - have)).fill(t);
    });

  const pairs: string[] = [];
  for (let k = 0; k < v.moves.length; k += 2) pairs.push(`${k / 2 + 1}. ${v.moves[k].san}${v.moves[k + 1] ? ' ' + v.moves[k + 1].san : ''}`);

  return (
    <div className="stack center chess">
      <div className="info-row">
        <span className="chip">
          {players[opp].name} ({v.myColor === 'w' ? 'black' : 'white'}) {missing(v.myColor).map((t) => GLYPH[t]).join('')}
        </span>
      </div>
      <div className="ch-board">
        {order.map((i) => {
          const pc = v.board[i];
          const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
          const cls =
            'ch-sq' +
            (dark ? ' dark' : '') +
            (from === i ? ' sel' : '') +
            (targets.has(i) ? (pc !== '.' ? ' cap' : ' dot') : '') +
            (last && (last.from === i || last.to === i) ? ' last' : '') +
            (kingInCheck === i ? ' check' : '');
          return (
            <button key={i} className={cls} onClick={() => click(i)} disabled={!myTurn} aria-label={`${L.sqName(i)}${pc !== '.' ? ' ' + pc : ''}`}>
              {pc !== '.' && <span className={'ch-piece ' + (pc === pc.toUpperCase() ? 'w' : 'b')}>{GLYPH[pc.toLowerCase()]}</span>}
              {(flip ? i % 8 === 7 : i % 8 === 0) && <span className="ch-coord r">{8 - Math.floor(i / 8)}</span>}
              {(flip ? Math.floor(i / 8) === 0 : Math.floor(i / 8) === 7) && <span className="ch-coord f">{'abcdefgh'[i % 8]}</span>}
            </button>
          );
        })}
      </div>
      <div className="info-row">
        <span className="chip">{tx('You (')}{v.myColor === 'w' ? 'white' : 'black'}) {missing(v.myColor === 'w' ? 'b' : 'w').map((t) => GLYPH[t]).join('')}
        </span>
        {v.check && !v.over && <span className="chip urgent">{tx('Check!')}</span>}
        {v.over && <span className="chip">{v.over.reason}</span>}
      </div>
      {promo && (
        <div className="action-bar">
          <span className="small">{tx('Promote to:')}</span>
          {['q', 'r', 'b', 'n'].map((p) => (
            <button key={p} className="btn" onClick={() => onMove({ ...promo, promo: p })}>
              <span className={'ch-piece ' + (v.myColor === 'w' ? 'w' : 'b')}>{GLYPH[p]}</span>
            </button>
          ))}
        </div>
      )}
      {pairs.length > 0 && (
        <details className="rules">
          <summary>{tx('Moves ({length})', { length: v.moves.length })}</summary>
          <p className="small ch-moves">{pairs.join('  ')}</p>
        </details>
      )}
    </div>
  );
}

export const satranc: GameDef<L.ChessState, L.CMove, L.ChessView> = {
  id: 'satranc',
  name: 'Satranç',
  tagline: 'Chess, with a bot that thinks a few moves ahead.',
  icon: '♟️',
  minPlayers: 2,
  maxPlayers: 2,
  hiddenInfo: false,
  options: [
    {
      id: 'white',
      label: 'White (moves first)',
      default: 'random',
      choices: [
        { value: 'random', label: 'Random' },
        { value: 'first', label: 'First player' },
        { value: 'second', label: 'Second player' },
      ],
    },
  ],
  rules:
    'Standard chess. Tap a piece to see where it can go, then tap the square. Castling, en passant and promotion (you pick the piece) are all supported. The game ends in checkmate, or a draw by stalemate, threefold repetition, 50 moves without a capture or pawn move, or when neither side can mate.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m) => L.move(s, seat, m),
  result: L.result,
  bot: L.bot,
  botDelay: () => 400,
  Board,
};
