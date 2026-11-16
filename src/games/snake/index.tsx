import { useEffect, useRef, useState } from 'react';
import type { BoardProps, GameDef, GameResult, Seat } from '../../engine/types';
import * as S from './sim';
import { t as tx } from '../../i18n';

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

const CELL = 24;
const KEYS: Record<string, S.Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };

function draw(ctx: CanvasRenderingContext2D, s: S.Snake) {
  const W = S.N * CELL;
  // Grass with a soft checker
  for (let y = 0; y < S.N; y++)
    for (let x = 0; x < S.N; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#7cbf5a' : '#86c964';
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  if (s.walls) {
    ctx.strokeStyle = '#5a3b22';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, W - 6, W - 6);
  }
  // Food: a red apple; the bonus is a golden simit
  const apple = s.food;
  ctx.fillStyle = '#d62828';
  ctx.beginPath();
  ctx.arc(apple.x * CELL + CELL / 2, apple.y * CELL + CELL / 2 + 1, CELL * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2d6a1f';
  ctx.fillRect(apple.x * CELL + CELL / 2 - 1, apple.y * CELL + 3, 3, 6);
  if (s.bonus) {
    const { x, y } = s.bonus.at;
    ctx.strokeStyle = s.bonus.ticks < 12 && s.bonus.ticks % 2 ? '#f6d68b' : '#c8862a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(x * CELL + CELL / 2, y * CELL + CELL / 2, CELL * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff6';
    for (let k = 0; k < 6; k++) ctx.fillRect(x * CELL + CELL / 2 + Math.cos(k) * 7, y * CELL + CELL / 2 + Math.sin(k) * 7, 2, 2);
  }
  // Snake: patterned body, darker head with eyes
  s.body.forEach((b, i) => {
    ctx.fillStyle = i === 0 ? '#1f5130' : i % 2 ? '#2e7d4f' : '#3a9a62';
    const pad = i === 0 ? 1 : 2;
    ctx.beginPath();
    ctx.roundRect(b.x * CELL + pad, b.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, 7);
    ctx.fill();
    if (i % 3 === 1) {
      ctx.fillStyle = '#e9b949';
      ctx.fillRect(b.x * CELL + CELL / 2 - 2, b.y * CELL + CELL / 2 - 2, 4, 4);
    }
  });
  const h = s.body[0];
  ctx.fillStyle = '#fff';
  const ex = s.dir === 'left' ? -5 : s.dir === 'right' ? 5 : 0;
  const ey = s.dir === 'up' ? -5 : s.dir === 'down' ? 5 : 0;
  for (const side of [-1, 1]) {
    const ox = ey ? side * 5 : ex;
    const oy = ex ? side * 5 : ey;
    ctx.beginPath();
    ctx.arc(h.x * CELL + CELL / 2 + ox, h.y * CELL + CELL / 2 + oy, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  if (s.dead) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, W, W);
  }
}

function Game({ walls, speed, onDone }: { walls: boolean; speed: number; onDone: (n: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
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

function Board({ view: v, canMove, onMove }: BoardProps<SnakeState, SnakeMove>) {
  if (!canMove) return <p className="center muted">{v.score !== null ? tx('Score: {score}', { score: v.score }) : ''}</p>;
  return <Game walls={v.walls} speed={v.speed} onDone={(n) => onMove({ type: 'score', n })} />;
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
