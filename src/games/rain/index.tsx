import { useEffect, useRef, useState } from 'react';
import type { BoardProps, GameDef, GameResult, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';
import { TileView } from '../tiles/TileView';
import * as R from './sim';

interface RainState {
  score: number | null;
  maxNum: number;
}
type RainMove = { type: 'score'; n: number };

const BEST_KEY = 'oyun-masasi:rain-best';
const readBest = () => {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
};
const saveBest = (n: number) => {
  try {
    if (n > readBest()) localStorage.setItem(BEST_KEY, String(n));
  } catch {
    /* storage unavailable */
  }
};

/** Draw a rain tile with the regular Okey tile look (jokers as the false-joker tile) */
const toTileId = (t: R.RTile) => (t.c === R.JOKER ? 104 : t.c * 13 + (t.n - 1));

function Game({ maxNum, onDone }: { maxNum: number; onDone: (n: number) => void }) {
  const rain = useRef(R.newRain(maxNum, Math.random));
  const [, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const redraw = () => setFrame((f) => f + 1);

  useEffect(() => {
    if (paused) return;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      R.step(rain.current, Math.random);
      redraw();
      if (rain.current.dead) {
        saveBest(rain.current.score);
        timer = setTimeout(() => onDone(rain.current.score), 1200);
        return;
      }
      timer = setTimeout(loop, R.interval(rain.current));
    };
    timer = setTimeout(loop, R.interval(rain.current));
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const r = rain.current;
      const act: Record<string, () => void> = {
        ArrowLeft: () => R.shift(r, -1),
        ArrowRight: () => R.shift(r, 1),
        ArrowUp: () => R.rotate(r),
        ArrowDown: () => R.step(r, Math.random),
        ' ': () => R.hardDrop(r, Math.random),
        p: () => setPaused((x) => !x),
      };
      const f = act[e.key];
      if (!f) return;
      e.preventDefault();
      if (paused && e.key !== 'p') return;
      f();
      redraw();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paused]);

  const r = rain.current;
  const pieceAt = new Map<number, R.RTile>();
  if (r.piece) {
    const [[ax, ay], [bx, by]] = R.cellsOf(r.piece);
    if (ay >= 0) pieceAt.set(ay * R.COLS + ax, r.piece.a);
    if (by >= 0) pieceAt.set(by * R.COLS + bx, r.piece.b);
  }
  const flash = new Set(r.flash);
  const press = (f: () => void) => () => {
    if (paused || r.dead) return;
    f();
    redraw();
  };

  return (
    <div className="stack-sm center">
      <div className="info-row">
        <span className="chip">{tx('Score {score}', { score: r.score })}</span>
        <span className="chip">{tx('Level {n}', { n: r.level })}</span>
        <span className="chip">{tx('Best {best}', { best: Math.max(readBest(), r.score) })}</span>
        {r.chain > 1 && <span className="chip trump-chip">{tx('Chain ×{n}!', { n: r.chain })}</span>}
      </div>
      <div className="rn-wrap">
        <div className="rn-well" style={{ gridTemplateColumns: `repeat(${R.COLS}, 1fr)` }}>
          {r.grid.map((cell, i) => {
            const t = pieceAt.get(i) ?? cell;
            return (
              <span key={i} className={'rn-cell' + (flash.has(i) ? ' flash' : '') + (pieceAt.has(i) ? ' falling' : '')}>
                {t && <TileView tile={toTileId(t)} size="sm" />}
              </span>
            );
          })}
        </div>
        <div className="stack-sm rn-side">
          <span className="small muted">{tx('Next')}</span>
          <div className="row">
            {r.next.map((t, i) => (
              <TileView key={i} tile={toTileId(t)} size="sm" />
            ))}
          </div>
          <button className="btn small ghost" onClick={() => setPaused((x) => !x)}>
            {paused ? tx('▶ Resume') : tx('⏸ Pause')}
          </button>
        </div>
      </div>
      <div className="rn-pad">
        <button className="btn" onClick={press(() => R.shift(r, -1))} aria-label={tx('Left')}>
          ◀
        </button>
        <button className="btn" onClick={press(() => R.rotate(r))} aria-label={tx('Rotate')}>
          ⟳
        </button>
        <button className="btn" onClick={press(() => R.shift(r, 1))} aria-label={tx('Right')}>
          ▶
        </button>
        <button className="btn primary" onClick={press(() => R.hardDrop(r, Math.random))} aria-label={tx('Drop')}>
          ⤓
        </button>
      </div>
      <p className="small muted">{tx('Arrows move and rotate, ↓ speeds up, Space drops, P pauses.')}</p>
    </div>
  );
}

function Board({ view: v, canMove, onMove }: BoardProps<RainState, RainMove>) {
  if (!canMove) return <p className="center muted">{v.score !== null ? tx('Score: {score}', { score: v.score }) : ''}</p>;
  return <Game maxNum={v.maxNum} onDone={(n) => onMove({ type: 'score', n })} />;
}

export const rain: GameDef<RainState, RainMove, RainState> = {
  id: 'tas-yagmuru',
  name: 'Taş Yağmuru',
  tagline: 'Falling Okey tiles: line up sets and runs before the well fills.',
  icon: '🌧️',
  minPlayers: 1,
  maxPlayers: 1,
  hiddenInfo: false,
  options: [
    {
      id: 'numbers',
      label: 'Tile numbers',
      default: '6',
      choices: [
        { value: '5', label: '1–5 (easier)' },
        { value: '6', label: '1–6' },
        { value: '8', label: '1–8 (harder)' },
      ],
    },
  ],
  rules:
    'Pairs of Okey tiles fall into the well. Move and rotate them so that three or more tiles in a row or a column make an Okey meld: a set (the same number in different colors) or a run (one color, consecutive numbers, up or down). The green ✿ tile is a joker and fits anywhere. Melds disappear, the tiles above drop, and any new melds that form score a chain bonus. It speeds up as you go; the game ends when the well is full.',
  setup: (ctx) => ({ score: null, maxNum: Number(ctx.options.numbers ?? 6) }),
  activePlayers: (s) => (s.score === null ? [0] : []),
  view: (s) => s,
  move: (s, _seat: Seat, m) => (s.score !== null ? 'Game over' : m?.type === 'score' && Number.isInteger(m.n) && m.n >= 0 ? { ...s, score: m.n } : 'Bad score'),
  result: (s): GameResult | null => (s.score === null ? null : { winners: [0], message: `Score: ${s.score} 🌧️` }),
  Board,
};
