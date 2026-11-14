import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';

/**
 * Board: 24 points, index 0..23. Positive = seat 0 checkers, negative = seat 1.
 * Seat 0 moves 23 -> 0 and bears off below 0 (home = 0..5).
 * Seat 1 moves 0 -> 23 and bears off above 23 (home = 18..23).
 */
export interface Position {
  board: number[];
  bar: [number, number];
  off: [number, number];
  /** Mahbusa: the seat whose single checker is trapped under the stack on this point */
  pinned?: (Seat | null)[];
  /** Gul Bara: both players travel the same way round, and a single checker holds a point */
  gul?: boolean;
}

export type Variant = 'tavla' | 'mahbusa' | 'gulbara';

/** The 24 points each player passes, from start to home (home = the last six) */
const PATH0 = Array.from({ length: 24 }, (_, k) => 23 - k);
const PATH1 = Array.from({ length: 24 }, (_, k) => k);
const PATH1_GUL = [...Array.from({ length: 12 }, (_, k) => 11 - k), ...Array.from({ length: 12 }, (_, k) => 23 - k)];
const pathOf = (p: Pick<Position, 'gul'>, seat: Seat) => (seat === 0 ? PATH0 : p.gul ? PATH1_GUL : PATH1);
const INDEX = (path: number[]) => {
  const out = Array(24).fill(0);
  path.forEach((pt, k) => (out[pt] = k));
  return out;
};
const IDX0 = INDEX(PATH0);
const IDX1 = INDEX(PATH1);
const IDX1_GUL = INDEX(PATH1_GUL);
/** How far along its own path a point is for this player (0 = start, 23 = last) */
export const progress = (p: Pick<Position, 'gul'>, seat: Seat, point: number) => (seat === 0 ? IDX0 : p.gul ? IDX1_GUL : IDX1)[point];

export type From = number | 'bar';
export type To = number | 'off';

export interface Step {
  from: From;
  to: To;
  die: number;
}

export interface BgState extends Position {
  turn: Seat;
  phase: 'roll' | 'move';
  /** Dice still to play this turn */
  dice: number[];
  /** Dice as rolled (for display) */
  rolled: number[];
  /** Position at the start of this turn, for undo */
  turnStart: (Position & { dice: number[] }) | null;
  target: number;
  score: [number, number];
  notice: string;
  matchOver: boolean;
  variant?: Variant;
  /** Gul Bara: doubles still to play this turn after the current one */
  cascade?: number[];
  /** Turns taken by each player (Gul Bara's doubles rule starts from the fourth) */
  turns?: [number, number];
}

export type BgMove = { type: 'roll' } | { type: 'undo' } | { type: 'step'; from: From; die: number };

const START: number[] = (() => {
  const b = Array(24).fill(0);
  b[23] = 2;
  b[12] = 5;
  b[7] = 3;
  b[5] = 5;
  b[0] = -2;
  b[11] = -5;
  b[16] = -3;
  b[18] = -5;
  return b;
})();

export const own = (p: Position, i: number, seat: Seat) => (seat === 0 ? Math.max(0, p.board[i]) : Math.max(0, -p.board[i]));
const opp = (p: Position, i: number, seat: Seat) => own(p, i, (1 - seat) as Seat);

export function rollDice(random: () => number) {
  return [1 + Math.floor(random() * 6), 1 + Math.floor(random() * 6)];
}

function freshPosition(variant: Variant = 'tavla'): Position {
  if (variant === 'mahbusa') {
    // Everyone starts with all fifteen checkers on their first point
    const board = Array(24).fill(0);
    board[23] = 15;
    board[0] = -15;
    return { board, bar: [0, 0], off: [0, 0], pinned: Array(24).fill(null) };
  }
  if (variant === 'gulbara') {
    // Both start in the same corner of their own path: seat 1 begins across from seat 0
    const board = Array(24).fill(0);
    board[23] = 15;
    board[11] = -15;
    return { board, bar: [0, 0], off: [0, 0], gul: true };
  }
  return { board: START.slice(), bar: [0, 0], off: [0, 0] };
}

export function setup(ctx: Pick<GameCtx, 'random' | 'options'>, variant: Variant = 'tavla'): BgState {
  const target = Number(ctx.options.match ?? '1') || 1;
  return openingRoll(
    { ...freshPosition(variant), turn: 0, phase: 'roll', dice: [], rolled: [], turnStart: null, target, score: [0, 0], notice: '', matchOver: false, variant },
    ctx.random,
  );
}

/** Own checkers on a point, counting one trapped underneath (Mahbusa) */
const has = (p: Position, i: number, seat: Seat) => own(p, i, seat) > 0 || p.pinned?.[i] === seat;

/** Each player rolls one die; the higher roll moves first with both dice */
function openingRoll(s: BgState, random: () => number): BgState {
  let a = 0;
  let b = 0;
  while (a === b) [a, b] = rollDice(random);
  const turn: Seat = a > b ? 0 : 1;
  const turns: [number, number] = [0, 0];
  turns[turn] = 1;
  const next: BgState = { ...s, turn, phase: 'move', dice: [a, b], rolled: [a, b], notice: '', turns, cascade: [] };
  return { ...next, turnStart: { ...copyPos(next), dice: [a, b] } };
}

function copyPos(p: Position): Position {
  const out: Position = { board: p.board.slice(), bar: [p.bar[0], p.bar[1]], off: [p.off[0], p.off[1]] };
  if (p.pinned) out.pinned = p.pinned.slice();
  if (p.gul) out.gul = true;
  return out;
}

function allHome(p: Position, seat: Seat) {
  if (p.bar[seat]) return false;
  for (let i = 0; i < 24; i++) {
    if (progress(p, seat, i) < 18 && has(p, i, seat)) return false;
  }
  return true;
}

/** Single checker moves for one die value */
export function singleSteps(p: Position, seat: Seat, die: number): Step[] {
  const out: Step[] = [];
  // Mahbusa: a point is closed if the opponent holds it, including on top of my trapped checker.
  // Gul Bara: any point with an opponent's checker on it is closed.
  const openAt = (t: number) =>
    p.gul ? opp(p, t, seat) === 0 : p.pinned ? p.pinned[t] !== seat && opp(p, t, seat) < 2 : opp(p, t, seat) < 2;
  const path = pathOf(p, seat);
  if (p.bar[seat] > 0) {
    const t = path[die - 1];
    if (openAt(t)) out.push({ from: 'bar', to: t, die });
    return out;
  }
  const home = allHome(p, seat);
  for (let i = 0; i < 24; i++) {
    if (!own(p, i, seat)) continue;
    const k = progress(p, seat, i) + die;
    if (k <= 23) {
      if (openAt(path[k])) out.push({ from: i, to: path[k], die });
    } else if (home) {
      const exact = k === 24;
      let furthest = true;
      if (!exact) {
        // Overshooting is only allowed from the checker furthest from home
        for (let j = 0; j < 24; j++) if (progress(p, seat, j) < progress(p, seat, i) && has(p, j, seat)) furthest = false;
      }
      if (exact || furthest) out.push({ from: i, to: 'off', die });
    }
  }
  return out;
}

export function applyStep(p: Position, seat: Seat, st: Step): Position {
  const n = copyPos(p);
  const sign = seat === 0 ? 1 : -1;
  if (st.from === 'bar') n.bar[seat]--;
  else {
    n.board[st.from] -= sign;
    // Mahbusa: leaving a point frees the checker trapped under it
    if (n.pinned && n.board[st.from] === 0 && n.pinned[st.from] === 1 - seat) {
      n.board[st.from] = -sign;
      n.pinned[st.from] = null;
    }
  }
  if (st.to === 'off') n.off[seat]++;
  else {
    if (opp(n, st.to, seat) === 1) {
      n.board[st.to] = 0;
      // Tavla hits the checker to the bar; Mahbusa traps it in place
      if (n.pinned) n.pinned[st.to] = (1 - seat) as Seat;
      else n.bar[1 - seat]++;
    }
    n.board[st.to] += sign;
  }
  return n;
}

function uniqueDice(dice: number[]) {
  return [...new Set(dice)];
}

/** Most dice that can be played from here */
function maxPlayable(p: Position, seat: Seat, dice: number[]): number {
  if (!dice.length) return 0;
  let best = 0;
  for (const d of uniqueDice(dice)) {
    const rest = dice.slice();
    rest.splice(rest.indexOf(d), 1);
    for (const st of singleSteps(p, seat, d)) {
      best = Math.max(best, 1 + maxPlayable(applyStep(p, seat, st), seat, rest));
      if (best === dice.length) return best;
    }
  }
  return best;
}

/** Legal next steps: must lead to using as many dice as possible (and the larger die if only one fits) */
export function legalSteps(p: Position, seat: Seat, dice: number[]): Step[] {
  const max = maxPlayable(p, seat, dice);
  if (!max) return [];
  const out: Step[] = [];
  for (const d of uniqueDice(dice)) {
    const rest = dice.slice();
    rest.splice(rest.indexOf(d), 1);
    for (const st of singleSteps(p, seat, d)) {
      if (1 + maxPlayable(applyStep(p, seat, st), seat, rest) === max) out.push(st);
    }
  }
  if (max === 1 && dice.length === 2 && dice[0] !== dice[1]) {
    const hi = Math.max(...dice);
    if (out.some((s) => s.die === hi)) return out.filter((s) => s.die === hi);
  }
  return out;
}

function endTurn(s: BgState, notice = ''): BgState {
  return { ...s, turn: (1 - s.turn) as Seat, phase: 'roll', dice: [], turnStart: null, notice, cascade: [] };
}

/** When the current dice are used up: Gul Bara may go on to the next double, otherwise the turn ends */
function afterStage(s: BgState, notice = ''): BgState {
  let t = s;
  while (t.cascade?.length) {
    const d = t.cascade[0];
    const dice = [d, d, d, d];
    t = { ...t, dice, rolled: [d, d], cascade: t.cascade.slice(1), turnStart: { ...copyPos(t), dice } };
    if (legalSteps(t, t.turn, dice).length) return { ...t, notice: `Doubles run on: now ${d}-${d}!` };
  }
  return endTurn(t, notice);
}

function finishGame(s: BgState, winner: Seat): BgState {
  const loser = (1 - winner) as Seat;
  const mars = s.off[loser] === 0;
  const pts = mars ? 2 : 1;
  const score: [number, number] = [s.score[0], s.score[1]];
  score[winner] += pts;
  const label = mars ? 'mars (2 points)' : '1 point';
  if (score[winner] >= s.target) {
    return { ...s, score, phase: 'roll', dice: [], matchOver: true, notice: `Won with ${label}.` };
  }
  // Next game: the winner rolls first
  return {
    ...s,
    ...freshPosition(s.variant),
    score,
    turn: winner,
    phase: 'roll',
    dice: [],
    rolled: [],
    turnStart: null,
    notice: `Game won with ${label}. Next game!`,
  };
}

export function move(s: BgState, seat: Seat, m: BgMove, ctx: Pick<GameCtx, 'random'>): BgState | string {
  if (s.matchOver) return 'The match is over';
  if (seat !== s.turn) return 'Not your turn';
  if (m?.type === 'roll') {
    if (s.phase !== 'roll') return 'Play your dice first';
    const [a, b] = rollDice(ctx.random);
    const dice = a === b ? [a, a, a, a] : [a, b];
    const turns: [number, number] = [s.turns?.[0] ?? 0, s.turns?.[1] ?? 0];
    turns[seat]++;
    // Gul Bara: from your fourth turn, a double brings every higher double after it
    const cascade = s.variant === 'gulbara' && a === b && turns[seat] >= 4 ? Array.from({ length: 6 - a }, (_, k) => a + 1 + k) : [];
    const next: BgState = { ...s, phase: 'move', dice, rolled: [a, b], notice: '', turns, cascade, turnStart: { ...copyPos(s), dice } };
    if (!legalSteps(next, seat, dice).length) return afterStage({ ...next }, `No legal moves with ${a}–${b}.`);
    return next;
  }
  if (m?.type === 'undo') {
    if (s.phase !== 'move' || !s.turnStart) return 'Nothing to undo';
    const { dice, ...pos } = s.turnStart;
    return { ...s, ...copyPos(pos), dice: dice.slice() };
  }
  if (m?.type === 'step') {
    if (s.phase !== 'move') return 'Roll first';
    const st = legalSteps(s, seat, s.dice).find((x) => x.from === m.from && x.die === m.die);
    if (!st) return 'That move is not allowed';
    const pos = applyStep(s, seat, st);
    const dice = s.dice.slice();
    dice.splice(dice.indexOf(st.die), 1);
    let next: BgState = { ...s, ...pos, dice };
    if (pos.off[seat] === 15) return finishGame(next, seat);
    if (!dice.length || !legalSteps(next, seat, dice).length) next = afterStage(next);
    return next;
  }
  return 'Unknown move';
}

export function result(s: BgState): GameResult | null {
  if (!s.matchOver) return null;
  const w: Seat = s.score[0] > s.score[1] ? 0 : 1;
  return { winners: [w] };
}

// ------------------------------------------------------------- bot

export function pips(p: Position, seat: Seat) {
  let n = p.bar[seat] * 25;
  for (let i = 0; i < 24; i++) n += (own(p, i, seat) + (p.pinned?.[i] === seat ? 1 : 0)) * (24 - progress(p, seat, i));
  return n;
}

function evaluate(p: Position, me: Seat, hard: boolean): number {
  const them = (1 - me) as Seat;
  if (p.gul) {
    // No hitting: race, and hold points the other player still has to pass
    let score = (pips(p, them) - pips(p, me)) * 1.0 + p.off[me] * 4;
    const theirRear = Math.min(...Array.from({ length: 24 }, (_, i) => (own(p, i, them) ? progress(p, them, i) : 99)));
    for (let i = 0; i < 24; i++) {
      if (own(p, i, me) && progress(p, them, i) > theirRear && progress(p, them, i) < 18) score += hard ? 4 : 2;
    }
    return score;
  }
  let score = (pips(p, them) - pips(p, me)) * 1.0 + p.off[me] * 4;
  score += p.bar[them] * 14;
  if (p.pinned) {
    // Trapping is strong; being trapped (especially deep in their home) hurts
    for (let i = 0; i < 24; i++) {
      if (p.pinned[i] === them) score += hard ? 16 : 10;
      if (p.pinned[i] === me) score -= hard ? 18 : 10;
    }
  }
  let run = 0;
  for (let k = 0; k < 24; k++) {
    // Walk from my home outward
    const i = me === 0 ? k : 23 - k;
    const n = own(p, i, me);
    if (n >= 2) {
      run++;
      score += k <= 5 ? 5 : k <= 10 ? 3 : 1;
      if (run >= 3) score += run * (hard ? 3 : 2);
    } else run = 0;
    if (n === 1) {
      // Blot: how exposed is it?
      let shooters = p.bar[them];
      for (let j = 0; j < 24; j++) {
        // Distance the opponent's checker at j must travel to land on i
        const theirDist = them === 0 ? j - i : i - j;
        if (theirDist >= 1 && theirDist <= 12 && own(p, j, them)) shooters++;
      }
      if (shooters) score -= (hard ? 9 : 6) + (k <= 5 ? 4 : 0);
      else score -= 1;
    }
  }
  return score;
}

/** Every distinct end position reachable this turn (legal: uses the most dice), with its first step */
export function endPositions(p: Position, seat: Seat, dice: number[]): { first: Step; pos: Position }[] {
  const leaves: { first: Step; pos: Position; used: number }[] = [];
  const seen = new Set<string>();
  const rec = (pos: Position, rest: number[], first: Step | null, used: number) => {
    const key = pos.board.join(',') + '|' + pos.bar.join(',') + '|' + pos.off.join(',') + '|' + (pos.pinned ?? []).join(',') + '|' + rest.join(',');
    if (seen.has(key)) return;
    seen.add(key);
    let any = false;
    for (const d of uniqueDice(rest)) {
      const r = rest.slice();
      r.splice(r.indexOf(d), 1);
      for (const st of singleSteps(pos, seat, d)) {
        any = true;
        rec(applyStep(pos, seat, st), r, first ?? st, used + 1);
      }
    }
    if (!any && first) leaves.push({ first, pos, used });
  };
  rec(p, dice, null, 0);
  const max = Math.max(0, ...leaves.map((l) => l.used));
  let out = leaves.filter((l) => l.used === max);
  if (max === 1 && dice.length === 2 && dice[0] !== dice[1]) {
    const hi = Math.max(...dice);
    if (out.some((l) => l.first.die === hi)) out = out.filter((l) => l.first.die === hi);
  }
  return out;
}

export function bot(s: BgState, seat: Seat, ctx: BotCtx): BgMove {
  if (s.phase === 'roll') return { type: 'roll' };
  const steps = legalSteps(s, seat, s.dice);
  if (ctx.level === 'easy' && ctx.random() < 0.5) {
    const st = steps[Math.floor(ctx.random() * steps.length)];
    return { type: 'step', from: st.from, die: st.die };
  }
  const all = endPositions(s, seat, s.dice);
  let best = all[0];
  let bestScore = -Infinity;
  for (const c of all) {
    const v = evaluate(c.pos, seat, ctx.level === 'hard');
    if (v > bestScore) {
      bestScore = v;
      best = c;
    }
  }
  const st = best?.first ?? steps[0];
  return { type: 'step', from: st.from, die: st.die };
}
