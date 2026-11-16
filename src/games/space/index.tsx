import { useEffect, useRef, useState } from 'react';
import type { BoardProps, GameDef, GameResult, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';
import * as S from './sim';

interface SpaceState {
  score: number | null;
  wave: number;
}
type SpaceMove = { type: 'score'; n: number; wave: number };

const BEST_KEY = 'oyun-masasi:space-best';
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

// A fixed starfield, scrolled while drawing
const STARS = Array.from({ length: 70 }, (_, i) => ({ x: (i * 97.13) % S.W, y: (i * 211.7) % S.H, z: 0.3 + ((i * 37) % 10) / 10 }));

function drawShip(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  // Engine flame
  ctx.fillStyle = `rgba(255, ${150 + Math.floor(Math.sin(t * 40) * 50)}, 60, 0.9)`;
  ctx.beginPath();
  ctx.moveTo(x - 6, y + 12);
  ctx.lineTo(x, y + 22 + Math.sin(t * 50) * 4);
  ctx.lineTo(x + 6, y + 12);
  ctx.fill();
  // Hull: a swept arrowhead with wings
  ctx.fillStyle = '#e8edf5';
  ctx.beginPath();
  ctx.moveTo(x, y - 18);
  ctx.lineTo(x + 7, y + 2);
  ctx.lineTo(x + 18, y + 12);
  ctx.lineTo(x + 6, y + 10);
  ctx.lineTo(x, y + 14);
  ctx.lineTo(x - 6, y + 10);
  ctx.lineTo(x - 18, y + 12);
  ctx.lineTo(x - 7, y + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e63946';
  ctx.fillRect(x - 18, y + 9, 5, 3);
  ctx.fillRect(x + 13, y + 9, 5, 3);
  ctx.fillStyle = '#3a86ff';
  ctx.beginPath();
  ctx.ellipse(x, y - 3, 3, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemy(ctx: CanvasRenderingContext2D, type: number, x: number, y: number, t: number, armored: boolean) {
  const c = S.COLORS[type];
  ctx.fillStyle = c;
  ctx.strokeStyle = c;
  if (type === 0) {
    // Orb drone: a ball with a single blinking eye and little side fins
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 15, y - 2, 5, 4);
    ctx.fillRect(x + 10, y - 2, 5, 4);
    ctx.fillStyle = '#0b1020';
    const blink = Math.sin(t * 3 + x) > 0.95 ? 1 : 4;
    ctx.beginPath();
    ctx.ellipse(x, y, 4, blink, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 1) {
    // Jelly: a dome with wiggling tentacles
    ctx.beginPath();
    ctx.arc(x, y - 1, 11, Math.PI, 0);
    ctx.lineTo(x + 11, y + 2);
    ctx.lineTo(x - 11, y + 2);
    ctx.fill();
    ctx.lineWidth = 2;
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(x + k * 4.5, y + 2);
      ctx.quadraticCurveTo(x + k * 4.5 + Math.sin(t * 6 + k) * 3, y + 7, x + k * 4.5, y + 12);
      ctx.stroke();
    }
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(x - 5, y - 5, 3, 3);
    ctx.fillRect(x + 2, y - 5, 3, 3);
  } else {
    // Crystal: a spinning diamond
    const w = 11 * Math.abs(Math.cos(t * 2.5 + x * 0.05)) + 3;
    ctx.beginPath();
    ctx.moveTo(x, y - 13);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x, y + 13);
    ctx.lineTo(x - w, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(x - 1, y - 9, 2, 6);
    if (armored) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawBoss(ctx: CanvasRenderingContext2D, b: S.Boss, t: number) {
  // The hive: a slowly turning hexagon with a pulsing core
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(t * 0.4);
  ctx.fillStyle = '#5b2a86';
  ctx.strokeStyle = '#c79bff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 42, Math.sin(a) * 30);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = `rgba(255, 209, 102, ${0.6 + Math.sin(t * 6) * 0.3})`;
  ctx.beginPath();
  ctx.arc(b.x, b.y, 12, 0, Math.PI * 2);
  ctx.fill();
  // Health bar
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(40, 30, S.W - 80, 6);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(40, 30, ((S.W - 80) * Math.max(0, b.hp)) / b.maxHp, 6);
}

const POWER_ICON: Record<S.PowerKind, string> = { rapid: '⚡', double: '✦', shield: '🛡' };

function draw(ctx: CanvasRenderingContext2D, s: S.Space) {
  const t = s.time;
  ctx.fillStyle = '#070b18';
  ctx.fillRect(0, 0, S.W, S.H);
  for (const st of STARS) {
    const y = (st.y + t * 30 * st.z) % S.H;
    ctx.fillStyle = `rgba(255,255,255,${0.25 + st.z * 0.5})`;
    ctx.fillRect(st.x, y, st.z * 2, st.z * 2);
  }
  for (const e of s.enemies) {
    if (!e.alive) continue;
    const p = S.enemyPos(s, e);
    drawEnemy(ctx, e.type, p.x, p.y + Math.sin(t * 4 + e.col) * 1.5, t, e.hp > 1);
  }
  if (s.boss) drawBoss(ctx, s.boss, t);
  ctx.fillStyle = '#fff6a8';
  for (const b of s.bullets) ctx.fillRect(b.x - 1.5, b.y - 7, 3, 10);
  ctx.fillStyle = '#ff5d73';
  for (const b of s.bolts) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = '18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const d of s.drops) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(d.x, d.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(POWER_ICON[d.kind], d.x, d.y + 1);
  }
  for (const p of s.sparks) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
  }
  ctx.globalAlpha = 1;
  if (!s.over && (s.safe <= 0 || Math.floor(t * 12) % 2 === 0)) {
    drawShip(ctx, s.shipX, S.SHIP_Y, t);
    if (s.power.shield > 0) {
      ctx.strokeStyle = `rgba(143, 211, 255, ${0.5 + Math.sin(t * 8) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.shipX, S.SHIP_Y, 26, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (s.waveT > 0 && !s.over) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px system-ui, sans-serif';
    const next = s.wave + 1;
    ctx.fillText(S.isBossWave(next) ? tx('⚠ The hive is coming!') : tx('Wave {n}', { n: next }), S.W / 2, S.H / 2);
  }
}

function Game({ onDone }: { onDone: (score: number, wave: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const space = useRef(S.newSpace());
  const input = useRef<S.Input>({ left: false, right: false, targetX: null });
  const [hud, setHud] = useState({ score: 0, lives: 3, wave: 1 });
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let finished = false;
    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const s = space.current;
      if (!pausedRef.current) {
        for (let k = 0; k < 2; k++) S.step(s, dt / 2, input.current);
        setHud((h) => (h.score !== s.score || h.lives !== s.lives || h.wave !== s.wave ? { score: s.score, lives: s.lives, wave: s.wave } : h));
      }
      const ctx = ref.current?.getContext('2d');
      if (ctx) draw(ctx, s);
      if (s.over && !finished) {
        finished = true;
        saveBest(s.score);
        setTimeout(() => onDone(s.score, s.wave), 1400);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const key = (down: boolean) => (e: KeyboardEvent) => {
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) input.current.left = down;
      else if (['ArrowRight', 'd', 'D'].includes(e.key)) input.current.right = down;
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
        <span className="chip">{tx('Wave {n}', { n: hud.wave })}</span>
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
          onPointerDown={(e) => {
            aim(e);
            if (paused) setPaused(false);
          }}
          onPointerMove={(e) => (e.buttons || e.pointerType === 'mouse') && aim(e)}
          onPointerLeave={() => (input.current.targetX = null)}
          aria-label={tx('Space shooter')}
        />
        {paused && <div className="sp-paused">{tx('Paused')}</div>}
      </div>
      <p className="small muted">{tx('Your ship fires by itself. Move with the mouse, a finger, or ← → / A D. Catch ⚡ ✦ 🛡 for power-ups. P pauses.')}</p>
    </div>
  );
}

function Board({ view: v, canMove, onMove }: BoardProps<SpaceState, SpaceMove>) {
  if (v.score !== null) return <p className="center">{tx('Score: {score} 🚀', { score: v.score })}</p>;
  if (!canMove) return null;
  return <Game onDone={(n, wave) => onMove({ type: 'score', n, wave })} />;
}

export const space: GameDef<SpaceState, SpaceMove, SpaceState> = {
  id: 'uzay-savunmasi',
  name: 'Uzay Savunması',
  tagline: 'Hold the line against marching drone waves and the hive.',
  icon: '🚀',
  minPlayers: 1,
  maxPlayers: 1,
  hiddenInfo: false,
  rules:
    'Waves of drones march side to side and step closer each time they reach the edge. The fewer are left, the faster they go. Your ship fires on its own: move it to aim and to dodge their shots. Orb drones are worth 10, jellies 20, crystals 30 (crystals aim at you, and from wave 4 they take two hits). Every fifth wave the hive arrives and sprays fans of shots. Destroyed drones sometimes drop ⚡ rapid fire, ✦ double shot or a 🛡 shield. You have three lives; if the drones reach your level, it’s over.',
  setup: () => ({ score: null, wave: 0 }),
  activePlayers: (s) => (s.score === null ? [0] : []),
  view: (s) => s,
  move: (s, _seat: Seat, m) =>
    s.score !== null ? 'Game over' : m?.type === 'score' && Number.isInteger(m.n) && m.n >= 0 ? { score: m.n, wave: Number(m.wave) || 0 } : 'Bad score',
  result: (s): GameResult | null => (s.score === null ? null : { winners: [0], message: `Score: ${s.score} 🚀` }),
  leaderboard: { score: (v) => v.score },
  Board,
};
