/** Yılan: snake simulation, independent of drawing so it can be tested. */

export const N = 20;
export type P = { x: number; y: number };
export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Snake {
  body: P[];
  dir: Dir;
  /** Turns queued from key presses (so two quick turns both register) */
  queue: Dir[];
  food: P;
  bonus: { at: P; ticks: number } | null;
  grow: number;
  score: number;
  ticks: number;
  dead: boolean;
  walls: boolean;
}

const OPP: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const STEP: Record<Dir, P> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

function freeCell(s: Pick<Snake, 'body'>, random: () => number, avoid: P[] = []): P {
  for (;;) {
    const p = { x: Math.floor(random() * N), y: Math.floor(random() * N) };
    if (!s.body.some((b) => b.x === p.x && b.y === p.y) && !avoid.some((b) => b.x === p.x && b.y === p.y)) return p;
  }
}

export function newSnake(walls: boolean, random: () => number): Snake {
  const body = [
    { x: 6, y: 10 },
    { x: 5, y: 10 },
    { x: 4, y: 10 },
  ];
  return { body, dir: 'right', queue: [], food: freeCell({ body }, random), bonus: null, grow: 0, score: 0, ticks: 0, dead: false, walls };
}

export function turn(s: Snake, d: Dir) {
  const last = s.queue[s.queue.length - 1] ?? s.dir;
  if (d !== last && d !== OPP[last] && s.queue.length < 3) s.queue.push(d);
}

/** Move one square. Returns what happened, for sounds/effects. */
export function tick(s: Snake, random: () => number): 'ate' | 'bonus' | 'died' | null {
  if (s.dead) return null;
  if (s.queue.length) s.dir = s.queue.shift()!;
  const head = s.body[0];
  let nx = head.x + STEP[s.dir].x;
  let ny = head.y + STEP[s.dir].y;
  if (!s.walls) {
    nx = (nx + N) % N;
    ny = (ny + N) % N;
  } else if (nx < 0 || ny < 0 || nx >= N || ny >= N) {
    s.dead = true;
    return 'died';
  }
  // The tail moves away this tick unless we're growing
  const body = s.grow > 0 ? s.body : s.body.slice(0, -1);
  if (body.some((b) => b.x === nx && b.y === ny)) {
    s.dead = true;
    return 'died';
  }
  s.body = [{ x: nx, y: ny }, ...s.body];
  if (s.grow > 0) s.grow--;
  else s.body.pop();
  s.ticks++;
  let ev: 'ate' | 'bonus' | null = null;
  if (nx === s.food.x && ny === s.food.y) {
    s.score += 1;
    s.grow += 1;
    s.food = freeCell(s, random, s.bonus ? [s.bonus.at] : []);
    ev = 'ate';
    // Now and then a golden simit shows up for a few seconds
    if (!s.bonus && random() < 0.2) s.bonus = { at: freeCell(s, random, [s.food]), ticks: 40 };
  }
  if (s.bonus) {
    if (nx === s.bonus.at.x && ny === s.bonus.at.y) {
      s.score += 5;
      s.grow += 2;
      s.bonus = null;
      ev = 'bonus';
    } else if (--s.bonus.ticks <= 0) s.bonus = null;
  }
  return ev;
}

/** Milliseconds per step: speeds up as the snake grows */
export const interval = (s: Snake, base: number) => Math.max(base * 0.5, base - s.score * 2);
