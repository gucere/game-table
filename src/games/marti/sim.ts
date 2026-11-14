/** Martı flight physics, independent of rendering so it can be tested. */

export const W = 400;
export const H = 600;
export const SEA = H - 70;
export const BIRD_X = 110;
export const BIRD_R = 14;
const GRAVITY = 1500;
const FLAP = -430;
const SPAWN_EVERY = 1.45;
export const OB_W = 64;

export interface Obstacle {
  x: number;
  gapY: number;
  gap: number;
  passed: boolean;
}

export interface Sim {
  t: number;
  y: number;
  vy: number;
  started: boolean;
  dead: boolean;
  score: number;
  obstacles: Obstacle[];
  spawned: number;
  nextSpawn: number;
}

/** Small seeded PRNG so every player in a match gets the same course */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newSim(): Sim {
  return { t: 0, y: H * 0.42, vy: 0, started: false, dead: false, score: 0, obstacles: [], spawned: 0, nextSpawn: 0.6 };
}

export function flap(s: Sim) {
  if (s.dead) return;
  s.started = true;
  s.vy = FLAP;
}

export const speedFor = (score: number) => Math.min(220, 150 + score * 2.5);

function spawn(s: Sim, seed: number) {
  const r = rng(seed + s.spawned * 7919);
  const gap = Math.max(128, 168 - s.spawned * 1.2);
  const margin = 90;
  const gapY = margin + gap / 2 + r() * (SEA - 2 * margin - gap);
  s.obstacles.push({ x: W + 20, gapY, gap, passed: false });
  s.spawned++;
}

function circleHitsRect(cx: number, cy: number, r: number, x: number, y: number, w: number, h: number) {
  const nx = Math.max(x, Math.min(cx, x + w));
  const ny = Math.max(y, Math.min(cy, y + h));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

function hits(s: Sim, o: Obstacle) {
  const top = o.gapY - o.gap / 2;
  const bottom = o.gapY + o.gap / 2;
  return circleHitsRect(BIRD_X, s.y, BIRD_R, o.x, -100, OB_W, top + 100) || circleHitsRect(BIRD_X, s.y, BIRD_R, o.x, bottom, OB_W, SEA - bottom + 100);
}

/** Advance the simulation by dt seconds */
export function step(s: Sim, dt: number, seed: number) {
  s.t += dt;
  if (!s.started) {
    s.y = H * 0.42 + Math.sin(s.t * 3) * 8;
    return;
  }
  if (s.dead) {
    // Fall into the sea
    if (s.y < SEA - BIRD_R) {
      s.vy += GRAVITY * dt;
      s.y = Math.min(SEA - BIRD_R, s.y + s.vy * dt);
    }
    return;
  }
  s.vy += GRAVITY * dt;
  s.y += s.vy * dt;
  if (s.y < BIRD_R) {
    s.y = BIRD_R;
    s.vy = 0;
  }
  const v = speedFor(s.score);
  s.nextSpawn -= dt;
  if (s.nextSpawn <= 0) {
    spawn(s, seed);
    s.nextSpawn += SPAWN_EVERY * (150 / v);
  }
  for (const o of s.obstacles) {
    o.x -= v * dt;
    if (!o.passed && o.x + OB_W < BIRD_X - BIRD_R) {
      o.passed = true;
      s.score++;
    }
    if (hits(s, o)) s.dead = true;
  }
  s.obstacles = s.obstacles.filter((o) => o.x > -OB_W - 10);
  if (s.y + BIRD_R >= SEA) {
    s.y = SEA - BIRD_R;
    s.dead = true;
  }
}
