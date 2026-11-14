/** Hava Hokeyi physics: a puck, two mallets, walls and goals. Independent of drawing so it can be tested. */

export const W = 360;
export const H = 600;
export const GOAL_W = 130;
export const PUCK_R = 15;
export const MALLET_R = 26;
const MAX_SPEED = 1500;
const FRICTION = 0.992;

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Rink {
  puck: Body;
  /** [bottom (seat 0), top (seat 1)] */
  mallets: [Body, Body];
  /** Where each mallet is being pulled (finger / mouse / bot) */
  targets: [{ x: number; y: number }, { x: number; y: number }];
  score: [number, number];
  /** Pause after a goal, in seconds */
  pause: number;
  lastGoal: 0 | 1 | null;
}

export function newRink(): Rink {
  return {
    puck: { x: W / 2, y: H / 2, vx: 0, vy: 0 },
    mallets: [
      { x: W / 2, y: H - 70, vx: 0, vy: 0 },
      { x: W / 2, y: 70, vx: 0, vy: 0 },
    ],
    targets: [
      { x: W / 2, y: H - 70 },
      { x: W / 2, y: 70 },
    ],
    score: [0, 0],
    pause: 0.6,
    lastGoal: null,
  };
}

/** Keep a mallet inside its own half */
export function clampMallet(side: 0 | 1, x: number, y: number) {
  const cx = Math.max(MALLET_R, Math.min(W - MALLET_R, x));
  const cy = side === 0 ? Math.max(H / 2 + MALLET_R, Math.min(H - MALLET_R, y)) : Math.max(MALLET_R, Math.min(H / 2 - MALLET_R, y));
  return { x: cx, y: cy };
}

function resetPuck(r: Rink, towards: 0 | 1) {
  // Serve to the side that conceded
  r.puck = { x: W / 2, y: towards === 0 ? H / 2 + 60 : H / 2 - 60, vx: 0, vy: 0 };
}

export function step(r: Rink, dt: number) {
  // Mallets chase their targets quickly (velocity is used to "hit" the puck)
  r.mallets.forEach((m, i) => {
    const t = clampMallet(i as 0 | 1, r.targets[i].x, r.targets[i].y);
    const nx = m.x + (t.x - m.x) * Math.min(1, dt * 30);
    const ny = m.y + (t.y - m.y) * Math.min(1, dt * 30);
    m.vx = (nx - m.x) / dt;
    m.vy = (ny - m.y) / dt;
    m.x = nx;
    m.y = ny;
  });
  if (r.pause > 0) {
    r.pause -= dt;
    return null;
  }
  const p = r.puck;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.vx *= Math.pow(FRICTION, dt * 60);
  p.vy *= Math.pow(FRICTION, dt * 60);
  // Side walls
  if (p.x < PUCK_R) {
    p.x = PUCK_R;
    p.vx = Math.abs(p.vx) * 0.9;
  } else if (p.x > W - PUCK_R) {
    p.x = W - PUCK_R;
    p.vx = -Math.abs(p.vx) * 0.9;
  }
  // End walls, with goals in the middle
  const inGoal = Math.abs(p.x - W / 2) < GOAL_W / 2;
  if (p.y < PUCK_R && !inGoal) {
    p.y = PUCK_R;
    p.vy = Math.abs(p.vy) * 0.9;
  } else if (p.y > H - PUCK_R && !inGoal) {
    p.y = H - PUCK_R;
    p.vy = -Math.abs(p.vy) * 0.9;
  }
  let goal: 0 | 1 | null = null;
  if (p.y < -PUCK_R) goal = 0; // into the top goal: point for the bottom player
  if (p.y > H + PUCK_R) goal = 1;
  if (goal !== null) {
    r.score[goal]++;
    r.lastGoal = goal;
    r.pause = 0.9;
    resetPuck(r, (1 - goal) as 0 | 1);
    return goal;
  }
  // Mallet hits
  for (const m of r.mallets) {
    const dx = p.x - m.x;
    const dy = p.y - m.y;
    const d = Math.hypot(dx, dy);
    const min = PUCK_R + MALLET_R;
    if (d < min && d > 0) {
      const nx = dx / d;
      const ny = dy / d;
      // Push the puck out, then bounce it off the moving mallet
      p.x = m.x + nx * min;
      p.y = m.y + ny * min;
      const rvx = p.vx - m.vx;
      const rvy = p.vy - m.vy;
      const along = rvx * nx + rvy * ny;
      if (along < 0) {
        p.vx -= 1.9 * along * nx;
        p.vy -= 1.9 * along * ny;
      }
      p.vx += m.vx * 0.35;
      p.vy += m.vy * 0.35;
    }
  }
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > MAX_SPEED) {
    p.vx *= MAX_SPEED / sp;
    p.vy *= MAX_SPEED / sp;
  }
  return null;
}

/** Simple bot for the top mallet: defend the goal, strike when the puck is close and slow */
export function botTarget(r: Rink, level: 'easy' | 'normal' | 'hard') {
  const p = r.puck;
  const reach = level === 'hard' ? 1 : level === 'normal' ? 0.75 : 0.5;
  const home = { x: W / 2 + (p.x - W / 2) * 0.6 * reach, y: 60 };
  if (p.y < H / 2 && (p.vy < 120 || level === 'hard')) {
    // Come round behind the puck and push it towards the bottom goal
    const aimX = W / 2;
    const ang = Math.atan2(H - p.y, aimX - p.x);
    return { x: p.x - Math.cos(ang) * 20 * reach, y: p.y - Math.sin(ang) * 20 * reach - (1 - reach) * 30 };
  }
  return home;
}
