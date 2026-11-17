/**
 * Looks for Yılan. The game is the same in every one; only the drawing changes.
 * Each skin draws the whole board for one moment of the game.
 */
import * as S from './sim';

export const CELL = 24;
const W = S.N * CELL;
const mid = (n: number) => n * CELL + CELL / 2;
const ANGLE: Record<S.Dir, number> = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

/** Which way segment i faces: towards the one in front of it (the head uses the heading) */
function facing(s: S.Snake, i: number): number {
  if (i === 0) return ANGLE[s.dir];
  const a = s.body[i];
  const b = s.body[i - 1];
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  // Wrapped around the edge
  if (Math.abs(dx) > 1) dx = -Math.sign(dx);
  if (Math.abs(dy) > 1) dy = -Math.sign(dy);
  return Math.atan2(dy, dx);
}

function deadShade(ctx: CanvasRenderingContext2D, s: S.Snake, color = 'rgba(0,0,0,0.35)') {
  if (!s.dead) return;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, W);
}

function simit(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, blink = false) {
  ctx.strokeStyle = blink ? '#f6d68b' : '#c8862a';
  ctx.lineWidth = r * 0.75;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fff8';
  for (let k = 0; k < 7; k++) ctx.fillRect(x + Math.cos(k * 0.9) * r - 1, y + Math.sin(k * 0.9) * r - 1, 2, 2);
}

// ---------------------------------------------------------------- Classic garden

function classic(ctx: CanvasRenderingContext2D, s: S.Snake) {
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
  const apple = s.food;
  ctx.fillStyle = '#d62828';
  ctx.beginPath();
  ctx.arc(mid(apple.x), mid(apple.y) + 1, CELL * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2d6a1f';
  ctx.fillRect(mid(apple.x) - 1, apple.y * CELL + 3, 3, 6);
  if (s.bonus) simit(ctx, mid(s.bonus.at.x), mid(s.bonus.at.y), CELL * 0.3, s.bonus.ticks < 12 && s.bonus.ticks % 2 === 1);
  s.body.forEach((b, i) => {
    ctx.fillStyle = i === 0 ? '#1f5130' : i % 2 ? '#2e7d4f' : '#3a9a62';
    const pad = i === 0 ? 1 : 2;
    ctx.beginPath();
    ctx.roundRect(b.x * CELL + pad, b.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, 7);
    ctx.fill();
    if (i % 3 === 1) {
      ctx.fillStyle = '#e9b949';
      ctx.fillRect(mid(b.x) - 2, mid(b.y) - 2, 4, 4);
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
    ctx.arc(mid(h.x) + ox, mid(h.y) + oy, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  deadShade(ctx, s);
}

// ---------------------------------------------------------------- Retro phone: monochrome LCD

const LCD_BG = '#c3cf9c';
const LCD_INK = '#283518';
const LCD_GHOST = 'rgba(40,53,24,0.07)';

function phone(ctx: CanvasRenderingContext2D, s: S.Snake) {
  ctx.fillStyle = LCD_BG;
  ctx.fillRect(0, 0, W, W);
  // Faint pixel grid, like an old screen
  ctx.fillStyle = LCD_GHOST;
  for (let y = 0; y < S.N; y++) for (let x = 0; x < S.N; x++) ctx.fillRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4);
  ctx.fillStyle = LCD_INK;
  if (s.walls) {
    ctx.fillRect(0, 0, W, 4);
    ctx.fillRect(0, W - 4, W, 4);
    ctx.fillRect(0, 0, 4, W);
    ctx.fillRect(W - 4, 0, 4, W);
  }
  // Food: a small pixel diamond; bonus: a blinking pixel "bug"
  const f = s.food;
  const px = (x: number, y: number, dx: number, dy: number) => ctx.fillRect(x * CELL + 6 + dx * 4, y * CELL + 6 + dy * 4, 4, 4);
  for (const [dx, dy] of [[1, 0], [0, 1], [2, 1], [1, 2]]) px(f.x, f.y, dx, dy);
  if (s.bonus && !(s.bonus.ticks < 12 && s.bonus.ticks % 2)) {
    const b = s.bonus.at;
    for (const [dx, dy] of [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2], [1, 0], [1, 2]]) px(b.x, b.y, dx, dy);
  }
  // Snake: solid blocks with a one-pixel gap; the head has a notch for an eye
  s.body.forEach((b, i) => {
    ctx.fillStyle = LCD_INK;
    ctx.fillRect(b.x * CELL + 2, b.y * CELL + 2, CELL - 4, CELL - 4);
    if (i === 0) {
      ctx.fillStyle = LCD_BG;
      const a = ANGLE[s.dir];
      ctx.fillRect(mid(b.x) + Math.cos(a) * 4 - 2 + Math.sin(a) * 4, mid(b.y) + Math.sin(a) * 4 - 2 - Math.cos(a) * 4, 4, 4);
    }
  });
  deadShade(ctx, s, 'rgba(40,53,24,0.25)');
}

// ---------------------------------------------------------------- Seagulls chasing simit over the Bosphorus

/** Wings and body are drawn in two passes, so no gull hides another one's wings */
function gullWings(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number, flap: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const w = size * (0.45 + 0.35 * Math.sin(flap));
  ctx.strokeStyle = '#5f6b78';
  ctx.lineWidth = size * 0.17;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(size * 0.05, 0);
  ctx.quadraticCurveTo(-size * 0.05, -w * 0.9, -size * 0.32, -w);
  ctx.moveTo(size * 0.05, 0);
  ctx.quadraticCurveTo(-size * 0.05, w * 0.9, -size * 0.32, w);
  ctx.stroke();
  // Dark wing tips
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(-size * 0.32, -w, size * 0.07, 0, Math.PI * 2);
  ctx.arc(-size * 0.32, w, size * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function gullBody(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number, head: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#b8c2cc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.36, size * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Tail
  ctx.fillStyle = '#e8edf2';
  ctx.beginPath();
  ctx.moveTo(-size * 0.3, 0);
  ctx.lineTo(-size * 0.48, -size * 0.1);
  ctx.lineTo(-size * 0.48, size * 0.1);
  ctx.fill();
  ctx.fillStyle = '#ffb703';
  ctx.beginPath();
  ctx.moveTo(size * 0.32, -size * 0.05);
  ctx.lineTo(size * (head ? 0.58 : 0.5), 0);
  ctx.lineTo(size * 0.32, size * 0.05);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(size * 0.22, -size * 0.07, size * 0.045, 0, Math.PI * 2);
  ctx.arc(size * 0.22, size * 0.07, size * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function gulls(ctx: CanvasRenderingContext2D, s: S.Snake) {
  const g = ctx.createLinearGradient(0, 0, 0, W);
  g.addColorStop(0, '#3a86c8');
  g.addColorStop(1, '#1d5a8a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, W);
  // Little waves
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  for (let y = 1; y < S.N; y += 2)
    for (let x = (y % 4) / 2; x < S.N; x += 3) {
      ctx.beginPath();
      ctx.arc(mid(x), y * CELL + 6, 5, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  if (s.walls) {
    ctx.strokeStyle = '#d9c7a1';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, W - 6, W - 6);
  }
  simit(ctx, mid(s.food.x), mid(s.food.y), CELL * 0.3);
  if (s.bonus && !(s.bonus.ticks < 12 && s.bonus.ticks % 2)) {
    // A glass of tea on a saucer
    const { x, y } = s.bonus.at;
    ctx.fillStyle = '#fff';
    ctx.fillRect(mid(x) - 8, mid(y) + 7, 16, 3);
    ctx.fillStyle = '#b5371b';
    ctx.beginPath();
    ctx.moveTo(mid(x) - 5, mid(y) - 7);
    ctx.lineTo(mid(x) + 5, mid(y) - 7);
    ctx.lineTo(mid(x) + 3, mid(y) + 6);
    ctx.lineTo(mid(x) - 3, mid(y) + 6);
    ctx.fill();
  }
  const t = Date.now() / 120;
  const size = (i: number) => (i === 0 ? CELL * 1.35 : CELL * 1.1);
  // All wings first, then the bodies (leader last, on top)
  for (let i = s.body.length - 1; i >= 0; i--) gullWings(ctx, mid(s.body[i].x), mid(s.body[i].y), size(i), facing(s, i), t + i * 1.3);
  for (let i = s.body.length - 1; i >= 0; i--) gullBody(ctx, mid(s.body[i].x), mid(s.body[i].y), size(i), facing(s, i), i === 0);
  deadShade(ctx, s, 'rgba(10,30,60,0.4)');
}

// ---------------------------------------------------------------- A little train picking up cargo

function train(ctx: CanvasRenderingContext2D, s: S.Snake) {
  ctx.fillStyle = '#d9c9a3';
  ctx.fillRect(0, 0, W, W);
  ctx.fillStyle = 'rgba(120,90,50,0.12)';
  for (let y = 0; y < S.N; y++) for (let x = 0; x < S.N; x++) if ((x * 7 + y * 13) % 5 === 0) ctx.fillRect(x * CELL + 8, y * CELL + 9, 3, 3);
  if (s.walls) {
    ctx.strokeStyle = '#6b4f2c';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, W - 6, W - 6);
  }
  // Cargo crate
  const f = s.food;
  ctx.fillStyle = '#b07a3c';
  ctx.fillRect(f.x * CELL + 4, f.y * CELL + 4, CELL - 8, CELL - 8);
  ctx.strokeStyle = '#6b4520';
  ctx.lineWidth = 2;
  ctx.strokeRect(f.x * CELL + 4, f.y * CELL + 4, CELL - 8, CELL - 8);
  ctx.beginPath();
  ctx.moveTo(f.x * CELL + 4, f.y * CELL + 4);
  ctx.lineTo(f.x * CELL + CELL - 4, f.y * CELL + CELL - 4);
  ctx.stroke();
  if (s.bonus && !(s.bonus.ticks < 12 && s.bonus.ticks % 2)) {
    // A golden ticket
    const { x, y } = s.bonus.at;
    ctx.fillStyle = '#e9b949';
    ctx.fillRect(x * CELL + 3, y * CELL + 7, CELL - 6, CELL - 14);
    ctx.fillStyle = '#7a5a10';
    ctx.fillRect(x * CELL + 7, y * CELL + 11, CELL - 14, 2);
  }
  // Rails under the train
  ctx.strokeStyle = '#6d6d6d';
  ctx.lineWidth = 2;
  s.body.forEach((b, i) => {
    const a = facing(s, i);
    ctx.save();
    ctx.translate(mid(b.x), mid(b.y));
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(-CELL / 2, -7);
    ctx.lineTo(CELL / 2, -7);
    ctx.moveTo(-CELL / 2, 7);
    ctx.lineTo(CELL / 2, 7);
    ctx.stroke();
    ctx.restore();
  });
  const colors = ['#2a6f97', '#e76f51', '#2a9d8f', '#e9c46a'];
  for (let i = s.body.length - 1; i >= 0; i--) {
    const b = s.body[i];
    ctx.save();
    ctx.translate(mid(b.x), mid(b.y));
    ctx.rotate(facing(s, i));
    if (i === 0) {
      // Locomotive: boiler, cab and chimney
      ctx.fillStyle = '#b22222';
      ctx.beginPath();
      ctx.roundRect(-11, -8, 22, 16, 4);
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.fillRect(-11, -8, 8, 16);
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(5, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.arc(11, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.roundRect(-10, -8, 20, 16, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(-6, -4, 4, 8);
      ctx.fillRect(2, -4, 4, 8);
      // Coupling to the car in front
      ctx.fillStyle = '#333';
      ctx.fillRect(10, -1.5, 3, 3);
    }
    ctx.restore();
  }
  deadShade(ctx, s);
}

// ---------------------------------------------------------------- Neon

function neon(ctx: CanvasRenderingContext2D, s: S.Snake) {
  ctx.fillStyle = '#07070f';
  ctx.fillRect(0, 0, W, W);
  ctx.strokeStyle = 'rgba(120,80,255,0.12)';
  ctx.lineWidth = 1;
  for (let k = 0; k <= S.N; k++) {
    ctx.beginPath();
    ctx.moveTo(k * CELL, 0);
    ctx.lineTo(k * CELL, W);
    ctx.moveTo(0, k * CELL);
    ctx.lineTo(W, k * CELL);
    ctx.stroke();
  }
  if (s.walls) {
    ctx.shadowColor = '#ff2bd6';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#ff2bd6';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, W - 4, W - 4);
  }
  ctx.shadowBlur = 16;
  ctx.shadowColor = '#ff2bd6';
  ctx.fillStyle = '#ff5ce1';
  ctx.beginPath();
  ctx.arc(mid(s.food.x), mid(s.food.y), CELL * 0.28, 0, Math.PI * 2);
  ctx.fill();
  if (s.bonus && !(s.bonus.ticks < 12 && s.bonus.ticks % 2)) {
    const { x, y } = s.bonus.at;
    ctx.shadowColor = '#ffe14d';
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? CELL * 0.18 : CELL * 0.42;
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      ctx.lineTo(mid(x) + Math.cos(a) * r, mid(y) + Math.sin(a) * r);
    }
    ctx.fill();
  }
  // The snake as one glowing line (broken where it wraps around an edge)
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 18;
  ctx.strokeStyle = '#5ff6ff';
  ctx.lineWidth = CELL * 0.55;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  s.body.forEach((b, i) => {
    const prev = s.body[i - 1];
    if (!prev || Math.abs(prev.x - b.x) + Math.abs(prev.y - b.y) > 1) ctx.moveTo(mid(b.x), mid(b.y));
    else ctx.lineTo(mid(b.x), mid(b.y));
  });
  if (s.body.length === 1) ctx.lineTo(mid(s.body[0].x) + 0.1, mid(s.body[0].y));
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  const h = s.body[0];
  ctx.beginPath();
  ctx.arc(mid(h.x), mid(h.y), CELL * 0.16, 0, Math.PI * 2);
  ctx.fill();
  deadShade(ctx, s, 'rgba(0,0,0,0.5)');
}

export interface Skin {
  id: string;
  icon: string;
  name: string;
  draw(ctx: CanvasRenderingContext2D, s: S.Snake): void;
}

export const SKINS: Skin[] = [
  { id: 'classic', icon: '🐍', name: 'Garden', draw: classic },
  { id: 'phone', icon: '📟', name: 'Retro phone', draw: phone },
  { id: 'gulls', icon: '🐦', name: 'Seagulls & simit', draw: gulls },
  { id: 'train', icon: '🚂', name: 'Train', draw: train },
  { id: 'neon', icon: '✨', name: 'Neon', draw: neon },
];

export const skinById = (id: string | undefined) => SKINS.find((k) => k.id === id) ?? SKINS[0];
