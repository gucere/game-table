import { useEffect, useRef, useState } from 'react';
import type { BoardProps, GameDef, GameResult, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';
import { playSound } from '../../ui/sound';
import * as S from './sim';

interface BrickState {
  score: number | null;
  level: number;
}
type BrickMove = { type: 'score'; n: number; level: number };

const BEST_KEY = 'oyun-masasi:bricks-best';
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function draw(ctx: CanvasRenderingContext2D, s: S.Bricks) {
  const g = ctx.createLinearGradient(0, 0, 0, S.H);
  g.addColorStop(0, '#16213a');
  g.addColorStop(1, '#0b1020');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S.W, S.H);
  // Faint grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < S.W; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, S.H);
    ctx.stroke();
  }
  for (const b of s.bricks) {
    if (b.hp <= 0) continue;
    ctx.fillStyle = S.brickColor(b);
    ctx.globalAlpha = 0.55 + 0.45 * (b.hp / b.maxHp);
    roundRect(ctx, b.x, b.y, S.BRICK_W, S.BRICK_H, 5);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(b.x + 4, b.y + 3, S.BRICK_W - 8, 3);
    if (b.hp > 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(b.hp), b.x + S.BRICK_W / 2, b.y + S.BRICK_H / 2 + 1);
    }
  }
  for (const p of s.sparks) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
  ctx.font = '16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const d of s.drops) {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.arc(d.x, d.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(S.POWER_ICON[d.kind], d.x, d.y + 1);
  }
  // Paddle
  const pg = ctx.createLinearGradient(0, S.PADDLE_Y, 0, S.PADDLE_Y + S.PADDLE_H);
  pg.addColorStop(0, s.wide > 0 ? '#9ef01a' : '#e9ecef');
  pg.addColorStop(1, s.wide > 0 ? '#4c9a0e' : '#868e96');
  ctx.fillStyle = pg;
  roundRect(ctx, s.paddleX - s.paddleW / 2, S.PADDLE_Y, s.paddleW, S.PADDLE_H, 6);
  ctx.fill();
  // Balls
  for (const b of s.balls) {
    ctx.shadowColor = s.slow > 0 ? '#74c0fc' : '#ffe066';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, S.BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.fillStyle = '#fff';
  if (s.banner > 0) {
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.fillText(tx('Level {n}', { n: s.level }), S.W / 2, S.H / 2);
  } else if (s.balls.some((b) => b.stuck)) {
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(tx('Tap or press Space to launch'), S.W / 2, S.H / 2 + 60);
  }
}

const EVENT_SOUND = { paddle: 'move', brick: 'hit', wall: null, lost: 'lose', power: 'achievement', level: 'win' } as const;

function Game({ onDone }: { onDone: (score: number, level: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sim = useRef(S.newBricks());
  const input = useRef<S.Input>({ left: false, right: false, targetX: null, launch: false });
  const [hud, setHud] = useState({ score: 0, lives: 3, level: 1 });
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let finished = false;
    let lastSound = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const s = sim.current;
      if (!pausedRef.current) {
        const events = S.step(s, dt, input.current);
        // A tap during the "Level n" banner waits until the ball can go
        if (!s.balls.some((b) => b.stuck)) input.current.launch = false;
        // One sound per frame at most, so a multi-ball doesn't turn into noise
        const e = events.find((x) => EVENT_SOUND[x]);
        if (e && now - lastSound > 40) {
          lastSound = now;
          playSound(EVENT_SOUND[e]!);
        }
        setHud((h) => (h.score !== s.score || h.lives !== s.lives || h.level !== s.level ? { score: s.score, lives: s.lives, level: s.level } : h));
      }
      const ctx = ref.current?.getContext('2d');
      if (ctx) draw(ctx, s);
      if (s.over && !finished) {
        finished = true;
        saveBest(s.score);
        setTimeout(() => onDone(s.score, s.level), 1200);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const key = (down: boolean) => (e: KeyboardEvent) => {
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) input.current.left = down;
      else if (['ArrowRight', 'd', 'D'].includes(e.key)) input.current.right = down;
      else if (down && (e.key === ' ' || e.key === 'ArrowUp')) input.current.launch = true;
      else if (down && (e.key === 'p' || e.key === 'P' || e.key === 'Escape')) setPaused((p) => !p);
      else return;
      input.current.targetX = null;
      e.preventDefault();
    };
    const kd = key(true);
    const ku = key(false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    const onBlur = () => setPaused(true);
    window.addEventListener('blur', onBlur);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', onBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aim = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    input.current.targetX = ((e.clientX - b.left) / b.width) * S.W;
  };

  return (
    <div className="stack-sm center">
      <div className="info-row">
        <span className="chip">{tx('Score {n}', { n: hud.score })}</span>
        <span className="chip">{tx('Level {n}', { n: hud.level })}</span>
        <span className="chip">{'❤️'.repeat(Math.max(0, hud.lives))}</span>
        <span className="chip">{tx('Best {best}', { best: Math.max(readBest(), hud.score) })}</span>
        <button className="btn small" onClick={() => setPaused((p) => !p)}>
          {paused ? `▶ ${tx('Resume')}` : `⏸ ${tx('Pause')}`}
        </button>
      </div>
      <div className="sp-wrap">
        <canvas
          ref={ref}
          width={S.W}
          height={S.H}
          className="sp-canvas"
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => {
            aim(e);
            if (paused) setPaused(false);
            else input.current.launch = true;
          }}
          onPointerMove={(e) => (e.buttons || e.pointerType === 'mouse') && aim(e)}
          aria-label={tx('Brick Smash')}
        />
        {paused && <div className="sp-paused">{tx('Paused')}</div>}
      </div>
      <p className="small muted">{tx('Move the paddle with the mouse, a finger, or ← → / A D. Tap or press Space to launch the ball. Catch ↔ wide paddle, ✳ more balls, 🐢 slow ball and ❤ extra life. P pauses.')}</p>
    </div>
  );
}

function Board({ view: v, canMove, onMove }: BoardProps<BrickState, BrickMove>) {
  if (v.score !== null) return <p className="center">{tx('Score: {score} 🧱 (level {level})', { score: v.score, level: v.level })}</p>;
  if (!canMove) return null;
  return <Game onDone={(n, level) => onMove({ type: 'score', n, level })} />;
}

export const bricks: GameDef<BrickState, BrickMove, BrickState> = {
  id: 'tugla-kirma',
  name: 'Tuğla Kırma',
  tagline: 'Bounce the ball and smash every brick.',
  icon: '🧱',
  minPlayers: 1,
  maxPlayers: 1,
  hiddenInfo: false,
  noTurnTimer: true,
  rules:
    'Keep the ball in play with your paddle and break all the bricks to reach the next level. Where the ball hits the paddle decides its angle: near the edges sends it out wide. Numbered bricks take more hits. Broken bricks sometimes drop a power-up: ↔ a wider paddle, ✳ two extra balls, 🐢 a slower ball or ❤ an extra life. You have three lives, and each level is faster than the last.',
  setup: () => ({ score: null, level: 1 }),
  activePlayers: (s) => (s.score === null ? [0] : []),
  view: (s) => s,
  move: (s, _seat: Seat, m) =>
    s.score !== null ? 'Game over' : m?.type === 'score' && Number.isInteger(m.n) && m.n >= 0 ? { score: m.n, level: Number(m.level) || 1 } : 'Bad score',
  // Reaching level 3 counts as a win for the stats
  result: (s): GameResult | null => (s.score === null ? null : { winners: s.level >= 3 ? [0] : [], message: `Score: ${s.score} 🧱` }),
  leaderboard: { score: (v) => v.score },
  Board,
};
