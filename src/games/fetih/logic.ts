/**
 * Fetih (Frontiers): an original territory game on a freshly generated hex map.
 * Each turn: reinforce (income from territories and villages), attack neighbors, then make
 * one fortifying move. A battle is armies + one die each; castles add 2 to the defense.
 * Take every territory, or hold the most when the round limit is reached.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';
import { shuffle } from '../cards/cards';

export const W = 13;
export const H = 9;

export interface Territory {
  cells: number[];
  /** Cell where the label goes */
  center: number;
  adj: number[];
  village: boolean;
  castle: boolean;
}

export interface FetihState {
  n: number;
  /** Territory index of every hex cell */
  cellOf: number[];
  terr: Territory[];
  owner: Seat[];
  armies: number[];
  turn: Seat;
  phase: 'place' | 'attack' | 'fortify' | 'done';
  pending: number;
  round: number;
  maxRounds: number;
  alive: boolean[];
  last: { from: number; to: number; aRoll: number; dRoll: number; won: boolean; aLoss: number; dLoss: number } | null;
  winner: Seat | null;
}

export type FetihMove =
  | { type: 'place'; t: number; n: number }
  | { type: 'attack'; from: number; to: number }
  | { type: 'endAttack' }
  | { type: 'fortify'; from: number; to: number; n: number }
  | { type: 'endTurn' };

/** Neighbors of a cell on an odd-row-offset hex grid */
export function hexNeighbors(i: number): number[] {
  const r = Math.floor(i / W);
  const c = i % W;
  const odd = r % 2 === 1;
  const d = odd
    ? [
        [0, -1],
        [0, 1],
        [-1, 0],
        [-1, 1],
        [1, 0],
        [1, 1],
      ]
    : [
        [0, -1],
        [0, 1],
        [-1, -1],
        [-1, 0],
        [1, -1],
        [1, 0],
      ];
  return d.map(([dr, dc]) => [r + dr, c + dc]).filter(([rr, cc]) => rr >= 0 && rr < H && cc >= 0 && cc < W).map(([rr, cc]) => rr * W + cc);
}

/** Grow territories from random seeds until every hex belongs to one */
export function makeMap(count: number, random: () => number): { cellOf: number[]; terr: Territory[] } {
  const total = W * H;
  for (;;) {
    const cellOf = Array(total).fill(-1);
    const seeds = shuffle(
      Array.from({ length: total }, (_, i) => i),
      random,
    ).slice(0, count);
    seeds.forEach((s, k) => (cellOf[s] = k));
    const frontier = seeds.map((s) => [s]);
    let left = total - count;
    while (left > 0) {
      // Grow the smallest territories first so sizes stay even
      const sizes = Array.from({ length: count }, (_, k) => cellOf.filter((x) => x === k).length);
      const order = Array.from({ length: count }, (_, k) => k).sort((a, b) => sizes[a] - sizes[b] || random() - 0.5);
      let grew = false;
      for (const k of order) {
        const options = frontier[k].flatMap((c) => hexNeighbors(c)).filter((x) => cellOf[x] === -1);
        if (!options.length) continue;
        const pick = options[Math.floor(random() * options.length)];
        cellOf[pick] = k;
        frontier[k].push(pick);
        left--;
        grew = true;
        break;
      }
      if (!grew) break;
    }
    if (left > 0) continue;
    const terr: Territory[] = Array.from({ length: count }, (_, k) => {
      const cells = cellOf.flatMap((x, i) => (x === k ? [i] : []));
      const adj = [...new Set(cells.flatMap((c) => hexNeighbors(c).map((x) => cellOf[x])))].filter((x) => x !== k);
      // Label on the cell closest to the territory's middle
      const cx = cells.reduce((a, c) => a + (c % W) + (Math.floor(c / W) % 2) * 0.5, 0) / cells.length;
      const cy = cells.reduce((a, c) => a + Math.floor(c / W), 0) / cells.length;
      const center = cells.slice().sort((a, b) => Math.hypot((a % W) - cx, Math.floor(a / W) - cy) - Math.hypot((b % W) - cx, Math.floor(b / W) - cy))[0];
      return { cells, center, adj, village: false, castle: false };
    });
    if (terr.some((t) => t.cells.length < 2)) continue;
    const ids = shuffle(
      terr.map((_, k) => k),
      random,
    );
    ids.slice(0, Math.round(count / 4)).forEach((k) => (terr[k].village = true));
    ids.slice(Math.round(count / 4), Math.round(count / 4) + Math.round(count / 5)).forEach((k) => (terr[k].castle = true));
    return { cellOf, terr };
  }
}

export function income(s: Pick<FetihState, 'owner' | 'terr'>, seat: Seat) {
  const mine = s.owner.filter((o) => o === seat).length;
  const villages = s.terr.filter((t, k) => t.village && s.owner[k] === seat).length;
  return Math.max(3, Math.floor(mine / 2)) + villages;
}

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'random' | 'options'>): FetihState {
  const n = ctx.numPlayers;
  const count = Math.max(14, Math.min(30, n * 5 + 4));
  const { cellOf, terr } = makeMap(count, ctx.random);
  const order = shuffle(
    terr.map((_, k) => k),
    ctx.random,
  );
  const owner: Seat[] = Array(count).fill(0);
  order.forEach((k, i) => (owner[k] = i % n));
  const armies = Array(count).fill(1);
  // Spread a few extra armies so everyone starts with the same total
  const extra = Math.max(2, Math.round(24 / n));
  for (let p = 0; p < n; p++) {
    const mine = order.filter((k) => owner[k] === p);
    for (let a = 0; a < extra + (Math.ceil(count / n) - mine.length); a++) armies[mine[Math.floor(ctx.random() * mine.length)]]++;
  }
  const s: FetihState = {
    n,
    cellOf,
    terr,
    owner,
    armies,
    turn: 0,
    phase: 'place',
    pending: 0,
    round: 1,
    maxRounds: Number(ctx.options.rounds ?? 0),
    alive: Array(n).fill(true),
    last: null,
    winner: null,
  };
  return { ...s, pending: income(s, 0) };
}

const roll = (random: () => number) => 1 + Math.floor(random() * 6);

function checkEnd(s: FetihState): FetihState {
  const alive = s.alive.map((_, p) => s.owner.includes(p));
  const live = alive.flatMap((a, p) => (a ? [p] : []));
  if (live.length === 1) return { ...s, alive, phase: 'done', winner: live[0] };
  return { ...s, alive };
}

function nextTurn(s: FetihState): FetihState {
  let t = s.turn;
  let round = s.round;
  for (let k = 0; k < s.n; k++) {
    t = (t + 1) % s.n;
    if (t === 0) round++;
    if (s.alive[t]) break;
  }
  if (s.maxRounds && round > s.maxRounds) {
    // Most territories, then most armies
    const score = (p: Seat) => s.owner.filter((o) => o === p).length * 1000 + s.armies.reduce((a, x, k) => a + (s.owner[k] === p ? x : 0), 0);
    const best = Math.max(...s.alive.map((a, p) => (a ? score(p) : -1)));
    const winner = s.alive.findIndex((a, p) => a && score(p) === best);
    return { ...s, round, phase: 'done', winner };
  }
  return { ...s, turn: t, round, phase: 'place', pending: income(s, t) };
}

/** Territories reachable from `from` through your own land */
export function connected(s: Pick<FetihState, 'terr' | 'owner'>, from: number): Set<number> {
  const seen = new Set([from]);
  const q = [from];
  while (q.length) {
    const k = q.pop()!;
    for (const a of s.terr[k].adj) if (!seen.has(a) && s.owner[a] === s.owner[from]) {
      seen.add(a);
      q.push(a);
    }
  }
  return seen;
}

export function move(s: FetihState, seat: Seat, m: FetihMove, ctx: Pick<GameCtx, 'random'>): FetihState | string {
  if (s.phase === 'done') return 'The game is over';
  if (seat !== s.turn) return 'Not your turn';
  const mine = (k: number) => Number.isInteger(k) && k >= 0 && k < s.terr.length && s.owner[k] === seat;
  switch (m.type) {
    case 'place': {
      if (s.phase !== 'place') return 'Reinforcements are placed at the start of your turn';
      if (!mine(m.t)) return 'Place on your own territory';
      const n = Math.max(1, Math.min(s.pending, Math.floor(m.n)));
      const armies = s.armies.slice();
      armies[m.t] += n;
      const pending = s.pending - n;
      return { ...s, armies, pending, phase: pending ? 'place' : 'attack' };
    }
    case 'attack': {
      if (s.phase !== 'attack') return 'Place your reinforcements first';
      if (!mine(m.from) || s.owner[m.to] === seat || !s.terr[m.from].adj.includes(m.to)) return 'Attack a neighboring enemy territory from your own';
      if (s.armies[m.from] < 2) return 'You need at least 2 armies to attack';
      const att = s.armies[m.from] - 1;
      const def = s.armies[m.to];
      const aRoll = roll(ctx.random);
      const dRoll = roll(ctx.random);
      const A = att + aRoll;
      const D = def + dRoll + (s.terr[m.to].castle ? 2 : 0);
      const armies = s.armies.slice();
      const owner = s.owner.slice();
      let aLoss: number;
      let dLoss: number;
      const won = A > D;
      if (won) {
        aLoss = Math.min(att - 1, Math.floor(def / 2));
        dLoss = def;
        owner[m.to] = seat;
        armies[m.to] = att - aLoss;
        armies[m.from] = 1;
      } else {
        aLoss = Math.max(1, Math.ceil(att / 2));
        dLoss = Math.min(def - 1, Math.floor(att / 3));
        armies[m.from] -= aLoss;
        armies[m.to] -= dLoss;
      }
      return checkEnd({ ...s, armies, owner, last: { from: m.from, to: m.to, aRoll, dRoll, won, aLoss, dLoss } });
    }
    case 'endAttack':
      if (s.phase !== 'attack') return 'Nothing to end';
      return { ...s, phase: 'fortify' };
    case 'fortify': {
      if (s.phase !== 'fortify' && s.phase !== 'attack') return 'Not now';
      if (!mine(m.from) || !mine(m.to) || m.from === m.to || !connected(s, m.from).has(m.to)) return 'Move between your own connected territories';
      const n = Math.floor(m.n);
      if (n < 1 || n > s.armies[m.from] - 1) return 'Leave at least one army behind';
      const armies = s.armies.slice();
      armies[m.from] -= n;
      armies[m.to] += n;
      return nextTurn({ ...s, armies, last: null });
    }
    case 'endTurn':
      if (s.phase === 'place') return 'Place your reinforcements first';
      return nextTurn({ ...s, last: null });
  }
  return 'Unknown move';
}

export const activePlayers = (s: FetihState): Seat[] => (s.phase === 'done' ? [] : [s.turn]);
export function result(s: FetihState): GameResult | null {
  return s.winner === null ? null : { winners: [s.winner] };
}

// ------------------------------------------------------------- bot

const threat = (s: FetihState, k: number) => s.terr[k].adj.filter((a) => s.owner[a] !== s.owner[k]).reduce((a, x) => a + s.armies[x], 0);

export function bot(v: FetihState, seat: Seat, ctx: BotCtx): FetihMove {
  const mine = v.owner.flatMap((o, k) => (o === seat ? [k] : []));
  const border = mine.filter((k) => v.terr[k].adj.some((a) => v.owner[a] !== seat));
  if (v.phase === 'place') {
    // Back the border territory with the juiciest weak neighbor
    const score = (k: number) => {
      const weakest = Math.min(...v.terr[k].adj.filter((a) => v.owner[a] !== seat).map((a) => v.armies[a] + (v.terr[a].castle ? 2 : 0)));
      return v.armies[k] - weakest + (ctx.random() * 2);
    };
    const target = (border.length ? border : mine).slice().sort((a, b) => score(b) - score(a))[0];
    return { type: 'place', t: target, n: ctx.level === 'easy' ? 1 : v.pending };
  }
  if (v.phase === 'attack') {
    const margin = ctx.level === 'hard' ? 2 : ctx.level === 'normal' ? 1 : -1;
    let best: { from: number; to: number; edge: number } | null = null;
    for (const from of border) {
      if (v.armies[from] < 3) continue;
      for (const to of v.terr[from].adj) {
        if (v.owner[to] === seat) continue;
        // Expected strength difference (dice cancel out on average)
        const edge = v.armies[from] - 1 - v.armies[to] - (v.terr[to].castle ? 2 : 0) + (v.terr[to].village ? 1 : 0);
        if (edge > margin && (!best || edge > best.edge)) best = { from, to, edge };
      }
    }
    if (best) return { type: 'attack', from: best.from, to: best.to };
    return { type: 'endAttack' };
  }
  // Fortify: move the biggest safe stack towards the most threatened border
  const interior = mine.filter((k) => !border.includes(k) && v.armies[k] > 1).sort((a, b) => v.armies[b] - v.armies[a]);
  for (const from of interior) {
    const reach = connected(v, from);
    const dest = border.filter((k) => reach.has(k)).sort((a, b) => threat(v, b) - threat(v, a))[0];
    if (dest !== undefined) return { type: 'fortify', from, to: dest, n: v.armies[from] - 1 };
  }
  return { type: 'endTurn' };
}
