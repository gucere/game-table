import { useEffect, useRef, useState } from 'react';
import type { BoardProps, GameDef, GameResult, Seat } from '../../engine/types';
import * as S from './sim';
import { t as tx } from '../../i18n';
import { CELL, SKINS, skinById, type Skin } from './skins';
import { useMyStats } from '../../ui/LikeButton';
import { getPref, setPref } from '../../profile/stats';

interface SnakeState {
  score: number | null;
  walls: boolean;
  speed: number;
}
type SnakeMove = { type: 'score'; n: number };

const BEST_KEY = 'oyun-masasi:snake-best';
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

const KEYS: Record<string, S.Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };

function Game({ walls, speed, skin, onDone }: { walls: boolean; speed: number; skin: Skin; onDone: (n: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const look = useRef(skin);
  look.current = skin;
  const draw = (ctx: CanvasRenderingContext2D, s: S.Snake) => look.current.draw(ctx, s);
  // A new look shows straight away, even while paused
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) draw(ctx, snake.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skin]);
  const snake = useRef(S.newSnake(walls, Math.random));
  const [score, setScore] = useState(0);
  const [started, setStarted] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) draw(ctx, snake.current);
    if (!started) return;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      const ev = S.tick(snake.current, Math.random);
      const c = ref.current?.getContext('2d');
      if (c) draw(c, snake.current);
      setScore(snake.current.score);
      if (ev === 'died') {
        saveBest(snake.current.score);
        timer = setTimeout(() => onDone(snake.current.score), 900);
        return;
      }
      timer = setTimeout(loop, S.interval(snake.current, speed));
    };
    timer = setTimeout(loop, speed);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = KEYS[e.key];
      if (!d) return;
      e.preventDefault();
      S.turn(snake.current, d);
      setStarted(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const press = (d: S.Dir) => {
    S.turn(snake.current, d);
    setStarted(true);
  };

  return (
    <div className="stack-sm center">
      <span className="chip">{tx('Score {score} · Best {v}', { score: score, v: Math.max(readBest(), score) })}
      </span>
      <canvas
        ref={ref}
        width={S.N * CELL}
        height={S.N * CELL}
        className="snake-canvas"
        onPointerDown={(e) => (touch.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const t = touch.current;
          touch.current = null;
          if (!t) return;
          const dx = e.clientX - t.x;
          const dy = e.clientY - t.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return setStarted(true);
          press(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
        }}
        aria-label={tx('Snake game area')}
      />
      {!started && <p className="small">{tx('Press an arrow key, swipe, or use the buttons to start.')}</p>}
      <div className="snake-pad">
        <span />
        <button className="btn" onClick={() => press('up')} aria-label={tx('Up')}>
          ▲
        </button>
        <span />
        <button className="btn" onClick={() => press('left')} aria-label={tx('Left')}>
          ◀
        </button>
        <span />
        <button className="btn" onClick={() => press('right')} aria-label={tx('Right')}>
          ▶
        </button>
        <span />
        <button className="btn" onClick={() => press('down')} aria-label={tx('Down')}>
          ▼
        </button>
        <span />
      </div>
    </div>
  );
}

/** The game with its look picker; the chosen look is remembered with the profile */
function Play({ walls, speed, onDone }: { walls: boolean; speed: number; onDone: (n: number) => void }) {
  const stats = useMyStats();
  const skin = skinById(getPref(stats, 'snakeSkin'));
  return (
    <div className="stack-sm center">
      <div className="row center-row snake-skins" role="radiogroup" aria-label={tx('Look')}>
        {SKINS.map((k) => (
          <button key={k.id} role="radio" aria-checked={skin.id === k.id} className={'chip-btn small-chip' + (skin.id === k.id ? ' on' : '')} onClick={() => setPref('snakeSkin', k.id)}>
            {k.icon} {tx(k.name)}
          </button>
        ))}
      </div>
      <Game walls={walls} speed={speed} skin={skin} onDone={onDone} />
    </div>
  );
}

function Board({ view: v, canMove, onMove }: BoardProps<SnakeState, SnakeMove>) {
  if (!canMove) return <p className="center muted">{v.score !== null ? tx('Score: {score}', { score: v.score }) : ''}</p>;
  return <Play walls={v.walls} speed={v.speed} onDone={(n) => onMove({ type: 'score', n })} />;
}

export const snake: GameDef<SnakeState, SnakeMove, SnakeState> = {
  id: 'yilan',
  name: 'Yılan',
  tagline: 'Eat, grow, and never bite your own tail.',
  icon: '🐍',
  minPlayers: 1,
  maxPlayers: 1,
  hiddenInfo: false,
  options: [
    {
      id: 'walls',
      label: 'Edges',
      default: 'wrap',
      choices: [
        { value: 'wrap', label: 'Wrap around' },
        { value: 'walls', label: 'Walls (harder)' },
      ],
    },
    {
      id: 'speed',
      label: 'Speed',
      default: '130',
      choices: [
        { value: '180', label: 'Relaxed' },
        { value: '130', label: 'Normal' },
        { value: '90', label: 'Fast' },
      ],
    },
  ],
  rules: 'Steer with the arrow keys, WASD, swipes or the buttons. Apples are 1 point and make you longer; golden simits appear now and then for 5 points but vanish quickly. Hitting your own body (or a wall, if walls are on) ends the game. You speed up as you grow.',
  setup: (ctx) => ({ score: null, walls: ctx.options.walls === 'walls', speed: Number(ctx.options.speed ?? 130) }),
  activePlayers: (s) => (s.score === null ? [0] : []),
  view: (s) => s,
  move: (s, _seat: Seat, m) => (s.score !== null ? 'Game over' : m?.type === 'score' && Number.isInteger(m.n) && m.n >= 0 ? { ...s, score: m.n } : 'Bad score'),
  result: (s): GameResult | null => (s.score === null ? null : { winners: [0], message: `Score: ${s.score} 🐍` }),
  leaderboard: { score: (v) => v.score, boardOptions: ['walls', 'speed'] },
  Board,
};
