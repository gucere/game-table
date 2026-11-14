import type { GameCtx, GameResult } from '../../engine/types';

export const LEVELS: Record<string, { w: number; h: number; mines: number; label: string }> = {
  easy: { w: 9, h: 9, mines: 10, label: 'Easy (9×9, 10 mines)' },
  medium: { w: 16, h: 16, mines: 40, label: 'Medium (16×16, 40 mines)' },
  hard: { w: 30, h: 16, mines: 99, label: 'Hard (30×16, 99 mines)' },
};

export interface MineState {
  w: number;
  h: number;
  mines: number;
  /** null until the first click, so the first click is always safe */
  mine: boolean[] | null;
  open: boolean[];
  flag: boolean[];
  status: 'playing' | 'won' | 'lost';
  boom: number | null;
  startedAt: number | null;
  endedAt: number | null;
}

/** What the player sees: mines only after the game ends */
export interface MineView extends Omit<MineState, 'mine'> {
  adj: number[];
  mineShown: boolean[];
}

export type MineMove = { type: 'open' | 'flag' | 'chord'; i: number };

export function setup(ctx: Pick<GameCtx, 'options'>): MineState {
  const lv = LEVELS[ctx.options.level] ?? LEVELS.easy;
  const n = lv.w * lv.h;
  return {
    w: lv.w,
    h: lv.h,
    mines: lv.mines,
    mine: null,
    open: Array(n).fill(false),
    flag: Array(n).fill(false),
    status: 'playing',
    boom: null,
    startedAt: null,
    endedAt: null,
  };
}

export function neighbors(s: { w: number; h: number }, i: number): number[] {
  const x = i % s.w;
  const y = Math.floor(i / s.w);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < s.w && ny < s.h) out.push(ny * s.w + nx);
    }
  return out;
}

function adjacency(s: MineState): number[] {
  return s.open.map((_, i) => (s.mine ? neighbors(s, i).filter((j) => s.mine![j]).length : 0));
}

function placeMines(s: MineState, safe: number, random: () => number): boolean[] {
  const n = s.w * s.h;
  const keepClear = new Set([safe, ...neighbors(s, safe)]);
  const cells = Array.from({ length: n }, (_, i) => i).filter((i) => !keepClear.has(i));
  const mine = Array(n).fill(false);
  for (let k = 0; k < s.mines && cells.length; k++) {
    const j = Math.floor(random() * cells.length);
    mine[cells[j]] = true;
    cells.splice(j, 1);
  }
  return mine;
}

function flood(s: MineState, start: number, open: boolean[]) {
  const adj = adjacency(s);
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    if (open[i] || s.flag[i]) continue;
    open[i] = true;
    if (adj[i] === 0 && !s.mine![i]) for (const j of neighbors(s, i)) if (!open[j]) stack.push(j);
  }
}

function finish(s: MineState, now: number): MineState {
  const safeLeft = s.open.some((o, i) => !o && !s.mine![i]);
  if (!safeLeft) return { ...s, status: 'won', endedAt: now, flag: s.mine!.slice() };
  return s;
}

export function move(s: MineState, m: MineMove, ctx: Pick<GameCtx, 'random' | 'now'>): MineState | string {
  if (s.status !== 'playing') return 'The game is over';
  const n = s.w * s.h;
  if (!m || !Number.isInteger(m.i) || m.i < 0 || m.i >= n) return 'Bad cell';
  const i = m.i;

  if (m.type === 'flag') {
    if (s.open[i]) return s;
    const flag = s.flag.slice();
    flag[i] = !flag[i];
    return { ...s, flag };
  }

  let st = s;
  if (!st.mine) st = { ...st, mine: placeMines(st, i, ctx.random), startedAt: ctx.now() };
  const mine = st.mine!;

  let targets: number[];
  if (m.type === 'chord') {
    if (!st.open[i]) return st;
    const adj = adjacency(st)[i];
    const ns = neighbors(st, i);
    if (ns.filter((j) => st.flag[j]).length !== adj) return st;
    targets = ns.filter((j) => !st.open[j] && !st.flag[j]);
  } else {
    if (st.flag[i] || st.open[i]) return st;
    targets = [i];
  }

  const hit = targets.find((j) => mine[j]);
  if (hit !== undefined) {
    const open = st.open.slice();
    open[hit] = true;
    return { ...st, open, status: 'lost', boom: hit, endedAt: ctx.now() };
  }
  const open = st.open.slice();
  for (const j of targets) flood(st, j, open);
  return finish({ ...st, open }, ctx.now());
}

export function result(s: MineState): GameResult | null {
  if (s.status === 'won') {
    const secs = s.startedAt && s.endedAt ? Math.round((s.endedAt - s.startedAt) / 1000) : 0;
    return { winners: [0], message: `Cleared in ${secs}s! 🎉` };
  }
  if (s.status === 'lost') return { winners: [], message: 'Boom! 💥' };
  return null;
}

export function view(s: MineState): MineView {
  const { mine, ...rest } = s;
  const over = s.status !== 'playing';
  return {
    ...rest,
    adj: s.open.map((o, i) => (o && mine ? neighbors(s, i).filter((j) => mine[j]).length : 0)),
    mineShown: mine && over ? mine : Array(s.w * s.h).fill(false),
  };
}
