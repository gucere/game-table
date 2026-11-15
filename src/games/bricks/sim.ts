/** Tuğla Kırma: bounce the ball off your paddle to break every brick. Pure simulation, no drawing. */

export const W = 480;
export const H = 640;
export const PADDLE_Y = 600;
export const PADDLE_H = 12;
export const BALL_R = 6;
const COLS = 10;
const GAP = 4;
const TOP = 64;
export const BRICK_W = (W - 16 - GAP * (COLS - 1)) / COLS;
export const BRICK_H = 18;

export type PowerKind = 'wide' | 'multi' | 'slow' | 'life';
export const POWER_ICON: Record<PowerKind, string> = { wide: '↔', multi: '✳', slow: '🐢', life: '❤' };

export interface Brick {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  row: number;
}
export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Sitting on the paddle until launched */
  stuck: boolean;
}
export interface Drop {
  x: number;
  y: number;
  kind: PowerKind;
}
export interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface Bricks {
  level: number;
  score: number;
  lives: number;
  paddleX: number;
  paddleW: number;
  balls: Ball[];
  bricks: Brick[];
  drops: Drop[];
  sparks: Spark[];
  /** Seconds left on each power-up */
  wide: number;
  slow: number;
  /** "Level n" banner */
  banner: number;
  over: boolean;
  random: () => number;
}

export interface Input {
  left: boolean;
  right: boolean;
  /** Pointer position in game units, or null */
  targetX: number | null;
  launch: boolean;
}

const baseSpeed = (level: number) => Math.min(300 + (level - 1) * 22, 520);
export const BASE_W = 84;

/** Brick layouts: a different shape each level, with tougher bricks as levels go on */
export function layout(level: number): Brick[] {
  const rows = Math.min(4 + Math.ceil(level / 2), 9);
  const shape = (level - 1) % 5;
  const out: Brick[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLS; c++) {
      const keep =
        shape === 0 ||
        (shape === 1 && (r + c) % 2 === 0) ||
        (shape === 2 && Math.abs(c - 4.5) <= r * 0.75 + 0.5) ||
        (shape === 3 && c !== 2 && c !== 7) ||
        (shape === 4 && (r % 3 !== 1 || c % 3 === 0));
      if (!keep) continue;
      const hp = Math.min(3, 1 + Math.floor((rows - 1 - r) / 3) * (level >= 3 ? 1 : 0) + (level >= 6 && r === 0 ? 1 : 0));
      out.push({ x: 8 + c * (BRICK_W + GAP), y: TOP + r * (BRICK_H + GAP), hp, maxHp: hp, row: r });
    }
  }
  return out;
}

export function newBricks(random: () => number = Math.random): Bricks {
  const s: Bricks = {
    level: 1,
    score: 0,
    lives: 3,
    paddleX: W / 2,
    paddleW: BASE_W,
    balls: [],
    bricks: layout(1),
    drops: [],
    sparks: [],
    wide: 0,
    slow: 0,
    banner: 1.6,
    over: false,
    random,
  };
  resetBall(s);
  return s;
}

function resetBall(s: Bricks) {
  s.balls = [{ x: s.paddleX, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0, stuck: true }];
}

function launch(s: Bricks, b: Ball) {
  const speed = baseSpeed(s.level);
  const angle = -Math.PI / 2 + (s.random() - 0.5) * 0.7;
  b.vx = Math.cos(angle) * speed;
  b.vy = Math.sin(angle) * speed;
  b.stuck = false;
}

function burst(s: Bricks, x: number, y: number, color: string, n = 8) {
  for (let i = 0; i < n; i++) {
    const a = s.random() * Math.PI * 2;
    const v = 40 + s.random() * 120;
    s.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + s.random() * 0.3, color });
  }
}

export const brickColor = (b: Brick) => ['#ff6b6b', '#ffb347', '#ffe066', '#7bd389', '#4dabf7', '#9775fa', '#f783ac', '#63e6be', '#ffa94d'][b.row % 9];

/** Hit sounds for the board to play: 'paddle', 'brick', 'wall', 'lost', 'power', 'level' */
export type SimEvent = 'paddle' | 'brick' | 'wall' | 'lost' | 'power' | 'level';

export function step(s: Bricks, dt: number, input: Input): SimEvent[] {
  const events: SimEvent[] = [];
  if (s.over) return events;
  if (s.banner > 0) s.banner -= dt;
  s.wide = Math.max(0, s.wide - dt);
  s.slow = Math.max(0, s.slow - dt);
  const targetW = s.wide > 0 ? BASE_W * 1.6 : BASE_W;
  s.paddleW += (targetW - s.paddleW) * Math.min(1, dt * 8);

  // Paddle
  const half = s.paddleW / 2;
  if (input.targetX !== null) s.paddleX += (input.targetX - s.paddleX) * Math.min(1, dt * 18);
  else s.paddleX += ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * 520 * dt;
  s.paddleX = Math.max(half, Math.min(W - half, s.paddleX));

  const slowF = s.slow > 0 ? 0.65 : 1;
  for (const b of s.balls) {
    if (b.stuck) {
      b.x = s.paddleX;
      b.y = PADDLE_Y - BALL_R - 1;
      if (input.launch && s.banner <= 0.6) launch(s, b);
      continue;
    }
    // Small sub-steps so a fast ball can't skip through a brick
    const steps = Math.ceil((Math.hypot(b.vx, b.vy) * dt * slowF) / 4);
    const h = (dt * slowF) / steps;
    for (let k = 0; k < steps; k++) {
      b.x += b.vx * h;
      b.y += b.vy * h;
      if (b.x < BALL_R) {
        b.x = BALL_R;
        b.vx = Math.abs(b.vx);
        events.push('wall');
      } else if (b.x > W - BALL_R) {
        b.x = W - BALL_R;
        b.vx = -Math.abs(b.vx);
        events.push('wall');
      }
      if (b.y < BALL_R) {
        b.y = BALL_R;
        b.vy = Math.abs(b.vy);
        events.push('wall');
      }
      // Paddle: where it hits sets the angle
      if (b.vy > 0 && b.y + BALL_R >= PADDLE_Y && b.y + BALL_R <= PADDLE_Y + PADDLE_H + 6 && Math.abs(b.x - s.paddleX) <= s.paddleW / 2 + BALL_R) {
        const off = Math.max(-1, Math.min(1, (b.x - s.paddleX) / (s.paddleW / 2)));
        const speed = Math.min(Math.hypot(b.vx, b.vy) * 1.01, baseSpeed(s.level) * 1.35);
        const angle = -Math.PI / 2 + off * 1.05;
        b.vx = Math.cos(angle) * speed;
        b.vy = Math.sin(angle) * speed;
        b.y = PADDLE_Y - BALL_R;
        events.push('paddle');
      }
      // Bricks
      for (const br of s.bricks) {
        if (br.hp <= 0) continue;
        const cx = Math.max(br.x, Math.min(b.x, br.x + BRICK_W));
        const cy = Math.max(br.y, Math.min(b.y, br.y + BRICK_H));
        if ((b.x - cx) ** 2 + (b.y - cy) ** 2 > BALL_R * BALL_R) continue;
        // Bounce off the side we came in from
        const fromSide = cx === br.x || cx === br.x + BRICK_W;
        const fromTopBottom = cy === br.y || cy === br.y + BRICK_H;
        if (fromSide && !fromTopBottom) b.vx = -b.vx;
        else b.vy = -b.vy;
        b.x += b.vx * h;
        b.y += b.vy * h;
        br.hp--;
        s.score += 10 * s.level;
        events.push('brick');
        if (br.hp <= 0) {
          burst(s, br.x + BRICK_W / 2, br.y + BRICK_H / 2, brickColor(br));
          if (s.random() < 0.12) {
            const kinds: PowerKind[] = ['wide', 'multi', 'slow', 'wide', 'multi', 'life'];
            s.drops.push({ x: br.x + BRICK_W / 2, y: br.y + BRICK_H / 2, kind: kinds[Math.floor(s.random() * kinds.length)] });
          }
        }
        break;
      }
    }
  }

  // Lost balls
  const before = s.balls.length;
  s.balls = s.balls.filter((b) => b.y < H + BALL_R * 2);
  if (s.balls.length < before && s.balls.length === 0) {
    s.lives--;
    events.push('lost');
    s.wide = 0;
    s.slow = 0;
    s.drops = [];
    if (s.lives <= 0) {
      s.over = true;
      return events;
    }
    resetBall(s);
  }

  // Power-ups fall and are caught by the paddle
  for (const d of s.drops) d.y += 140 * dt;
  s.drops = s.drops.filter((d) => {
    if (d.y > PADDLE_Y - 8 && d.y < PADDLE_Y + PADDLE_H + 8 && Math.abs(d.x - s.paddleX) < s.paddleW / 2 + 10) {
      events.push('power');
      if (d.kind === 'wide') s.wide = 15;
      else if (d.kind === 'slow') s.slow = 10;
      else if (d.kind === 'life') s.lives = Math.min(5, s.lives + 1);
      else {
        const src = s.balls.find((b) => !b.stuck) ?? s.balls[0];
        if (src) {
          if (src.stuck) launch(s, src);
          const speed = Math.hypot(src.vx, src.vy);
          for (const a of [-0.5, 0.5]) {
            const ang = Math.atan2(src.vy, src.vx) + a;
            s.balls.push({ x: src.x, y: src.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, stuck: false });
          }
        }
      }
      return false;
    }
    return d.y < H + 20;
  });

  for (const p of s.sparks) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 300 * dt;
    p.life -= dt;
  }
  s.sparks = s.sparks.filter((p) => p.life > 0);

  // Level cleared
  if (s.bricks.every((b) => b.hp <= 0)) {
    s.level++;
    s.score += 100 * s.lives;
    s.bricks = layout(s.level);
    s.drops = [];
    s.banner = 1.6;
    resetBall(s);
    events.push('level');
  }
  return events;
}
