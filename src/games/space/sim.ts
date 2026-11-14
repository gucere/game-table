/**
 * Uzay Savunması: an original fixed-screen shooter. A formation of drones marches side to side
 * and steps down; your ship fires on its own, you dodge and aim. Every fifth wave is a hive boss.
 * Pure simulation, no drawing, so it can be tested.
 */

export const W = 360;
export const H = 540;
export const SHIP_Y = H - 46;
const SHIP_SPEED = 330;
const BULLET_SPEED = 620;
const COLS = 7;
const SX = 40;
const SY = 34;
/** Enemy hit radius */
export const ER = 13;

export type PowerKind = 'rapid' | 'double' | 'shield';

export interface Enemy {
  col: number;
  row: number;
  /** 0 orb drone, 1 jelly, 2 crystal (aims at you) */
  type: 0 | 1 | 2;
  hp: number;
  alive: boolean;
}
export interface Boss {
  x: number;
  y: number;
  vx: number;
  hp: number;
  maxHp: number;
  fireT: number;
}
export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
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

export interface Space {
  shipX: number;
  lives: number;
  /** Seconds of blinking safety after being hit */
  safe: number;
  power: Record<PowerKind, number>;
  cool: number;
  bullets: Shot[];
  bolts: Shot[];
  drops: Drop[];
  sparks: Spark[];
  enemies: Enemy[];
  ox: number;
  oy: number;
  dir: 1 | -1;
  boss: Boss | null;
  wave: number;
  /** Pause before the next wave starts */
  waveT: number;
  score: number;
  time: number;
  over: boolean;
}

export interface Input {
  left: boolean;
  right: boolean;
  /** Where a finger or the mouse wants the ship */
  targetX: number | null;
}

const POINTS = [10, 20, 30];
export const COLORS = ['#7ae0ff', '#ff7ac8', '#c79bff'];

export function newSpace(): Space {
  const s: Space = {
    shipX: W / 2,
    lives: 3,
    safe: 0,
    power: { rapid: 0, double: 0, shield: 0 },
    cool: 0.4,
    bullets: [],
    bolts: [],
    drops: [],
    sparks: [],
    enemies: [],
    ox: 0,
    oy: 0,
    dir: 1,
    boss: null,
    wave: 0,
    waveT: 0,
    score: 0,
    time: 0,
    over: false,
  };
  startWave(s);
  return s;
}

export const isBossWave = (wave: number) => wave % 5 === 0;

export function startWave(s: Space) {
  s.wave++;
  s.bolts = [];
  s.dir = 1;
  if (isBossWave(s.wave)) {
    const hp = 40 + s.wave * 6;
    s.enemies = [];
    s.boss = { x: W / 2, y: 90, vx: 70 + s.wave * 4, hp, maxHp: hp, fireT: 1.5 };
    return;
  }
  s.boss = null;
  const rows = Math.min(5, 3 + Math.floor(s.wave / 2));
  s.enemies = [];
  for (let row = 0; row < rows; row++) {
    const type = (row === 0 ? 2 : row <= 2 ? 1 : 0) as 0 | 1 | 2;
    for (let col = 0; col < COLS; col++) s.enemies.push({ col, row, type, hp: type === 2 && s.wave > 3 ? 2 : 1, alive: true });
  }
  s.ox = (W - (COLS - 1) * SX) / 2;
  s.oy = 70 + Math.min(60, (s.wave - 1) * 8);
}

export const enemyPos = (s: Space, e: Enemy) => ({ x: s.ox + e.col * SX, y: s.oy + e.row * SY });

function burst(s: Space, x: number, y: number, color: string, n = 14, random: () => number = Math.random) {
  for (let i = 0; i < n; i++) {
    const a = random() * Math.PI * 2;
    const v = 40 + random() * 160;
    s.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + random() * 0.4, color });
  }
}

function hitShip(s: Space, random: () => number) {
  if (s.safe > 0) return;
  if (s.power.shield > 0) {
    s.power.shield = 0;
    s.safe = 0.6;
    burst(s, s.shipX, SHIP_Y, '#8fd3ff', 10, random);
    return;
  }
  s.lives--;
  s.safe = 2;
  burst(s, s.shipX, SHIP_Y, '#ffb703', 26, random);
  if (s.lives <= 0) s.over = true;
}

export function step(s: Space, dt: number, input: Input, random: () => number = Math.random) {
  if (s.over) return;
  s.time += dt;
  s.safe = Math.max(0, s.safe - dt);
  for (const k of Object.keys(s.power) as PowerKind[]) s.power[k] = Math.max(0, s.power[k] - dt);

  // Ship
  let dx = 0;
  if (input.targetX !== null) dx = Math.max(-SHIP_SPEED * dt, Math.min(SHIP_SPEED * dt, input.targetX - s.shipX));
  else dx = ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * SHIP_SPEED * dt;
  s.shipX = Math.max(20, Math.min(W - 20, s.shipX + dx));

  // Auto-fire
  s.cool -= dt;
  if (s.cool <= 0 && s.waveT <= 0) {
    s.cool = s.power.rapid > 0 ? 0.15 : 0.32;
    if (s.power.double > 0) s.bullets.push({ x: s.shipX - 8, y: SHIP_Y - 14, vx: 0, vy: -BULLET_SPEED }, { x: s.shipX + 8, y: SHIP_Y - 14, vx: 0, vy: -BULLET_SPEED });
    else s.bullets.push({ x: s.shipX, y: SHIP_Y - 16, vx: 0, vy: -BULLET_SPEED });
  }

  for (const list of [s.bullets, s.bolts]) for (const b of list) ((b.x += b.vx * dt), (b.y += b.vy * dt));
  s.bullets = s.bullets.filter((b) => b.y > -10);
  s.bolts = s.bolts.filter((b) => b.y < H + 10 && b.x > -10 && b.x < W + 10);
  for (const d of s.drops) d.y += 90 * dt;
  s.drops = s.drops.filter((d) => {
    if (Math.abs(d.x - s.shipX) < 24 && Math.abs(d.y - SHIP_Y) < 22) {
      s.power[d.kind] = d.kind === 'shield' ? 12 : 9;
      burst(s, d.x, d.y, '#ffffff', 8, random);
      return false;
    }
    return d.y < H + 10;
  });
  for (const p of s.sparks) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  s.sparks = s.sparks.filter((p) => p.life > 0);

  // Between waves
  if (s.waveT > 0) {
    s.waveT -= dt;
    if (s.waveT <= 0) startWave(s);
    return;
  }

  if (s.boss) stepBoss(s, s.boss, dt, random);
  else stepFormation(s, dt, random);

  // Enemy fire hitting the ship
  s.bolts = s.bolts.filter((b) => {
    if (Math.abs(b.x - s.shipX) < 15 && Math.abs(b.y - SHIP_Y) < 12) {
      hitShip(s, random);
      return false;
    }
    return true;
  });

  const cleared = s.boss ? s.boss.hp <= 0 : s.enemies.every((e) => !e.alive);
  if (cleared && !s.over) {
    if (s.boss) {
      s.score += 500 + s.wave * 50;
      burst(s, s.boss.x, s.boss.y, '#ffd166', 60, random);
      s.boss = null;
    }
    s.waveT = 1.6;
    s.bullets = [];
  }
}

function maybeDrop(s: Space, x: number, y: number, random: () => number) {
  if (random() < 0.09) {
    const kinds: PowerKind[] = ['rapid', 'double', 'shield'];
    s.drops.push({ x, y, kind: kinds[Math.floor(random() * 3)] });
  }
}

function stepFormation(s: Space, dt: number, random: () => number) {
  const alive = s.enemies.filter((e) => e.alive);
  const total = s.enemies.length;
  // Fewer drones left: the rest march faster
  const speed = (28 + s.wave * 5) * (1 + 2.2 * (1 - alive.length / total));
  s.ox += s.dir * speed * dt;
  const xs = alive.map((e) => enemyPos(s, e).x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  if ((s.dir > 0 && maxX > W - ER - 6) || (s.dir < 0 && minX < ER + 6)) {
    s.dir = (s.dir * -1) as 1 | -1;
    s.ox += s.dir * 2;
    s.oy += 14;
  }
  // Drones reaching the ship's level win
  if (alive.some((e) => enemyPos(s, e).y > SHIP_Y - 26)) {
    s.lives = 0;
    s.over = true;
    burst(s, s.shipX, SHIP_Y, '#ffb703', 30, random);
    return;
  }
  // Fire: only the lowest drone in each column can shoot
  const rate = 0.55 + s.wave * 0.18;
  if (random() < rate * dt) {
    const lowest = new Map<number, Enemy>();
    for (const e of alive) if (!lowest.has(e.col) || lowest.get(e.col)!.row < e.row) lowest.set(e.col, e);
    const shooters = [...lowest.values()];
    const e = shooters[Math.floor(random() * shooters.length)];
    if (e) {
      const p = enemyPos(s, e);
      const vy = 170 + s.wave * 8;
      const vx = e.type === 2 ? Math.max(-90, Math.min(90, ((s.shipX - p.x) / (SHIP_Y - p.y)) * vy)) : 0;
      s.bolts.push({ x: p.x, y: p.y + 10, vx, vy });
    }
  }
  // Bullets hitting drones
  s.bullets = s.bullets.filter((b) => {
    for (const e of alive) {
      if (!e.alive) continue;
      const p = enemyPos(s, e);
      if (Math.abs(b.x - p.x) < ER && Math.abs(b.y - p.y) < ER) {
        e.hp--;
        if (e.hp <= 0) {
          e.alive = false;
          s.score += POINTS[e.type] * (1 + Math.floor((s.wave - 1) / 3));
          burst(s, p.x, p.y, COLORS[e.type], 14, random);
          maybeDrop(s, p.x, p.y, random);
        } else burst(s, p.x, p.y, '#ffffff', 4, random);
        return false;
      }
    }
    return true;
  });
}

function stepBoss(s: Space, b: Boss, dt: number, random: () => number) {
  b.x += b.vx * dt;
  if (b.x < 60 || b.x > W - 60) {
    b.vx *= -1;
    b.x = Math.max(60, Math.min(W - 60, b.x));
  }
  b.y = 90 + Math.sin(s.time * 1.3) * 18;
  b.fireT -= dt;
  if (b.fireT <= 0) {
    // Fan of bolts, wider as the hive weakens
    const n = b.hp < b.maxHp / 2 ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.22;
      s.bolts.push({ x: b.x, y: b.y + 26, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190 });
    }
    b.fireT = Math.max(0.7, 1.4 - s.wave * 0.03);
  }
  s.bullets = s.bullets.filter((sh) => {
    if (Math.abs(sh.x - b.x) < 46 && Math.abs(sh.y - b.y) < 30) {
      b.hp--;
      s.score += 2;
      burst(s, sh.x, sh.y, '#ffd166', 4, random);
      if (random() < 0.02) maybeDrop(s, b.x, b.y + 30, () => 0);
      return false;
    }
    return true;
  });
}
