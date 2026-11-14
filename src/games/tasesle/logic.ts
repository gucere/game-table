/**
 * Taş Eşle: a solitaire tile-matching game using Okey tiles stacked in layers.
 * Remove identical pairs of free tiles. A tile is free when nothing lies on it and
 * its left or right side is open. Every deal is built backwards, so it can be cleared.
 */
import type { GameCtx, GameResult, Seat } from '../../engine/types';
import { shuffle } from '../cards/cards';

export interface Slot {
  x: number;
  y: number;
  z: number;
}

export const LAYOUTS: Record<string, Slot[]> = {
  pyramid: [
    ...rect(0, 0, 8, 6, 0),
    ...rect(1, 1, 6, 4, 1),
    ...rect(2, 2, 4, 2, 2),
    ...rect(3, 2, 2, 2, 3),
  ],
  fortress: [
    ...rect(0, 0, 10, 6, 0).filter((s) => !(s.x >= 3 && s.x <= 6 && s.y >= 2 && s.y <= 3)),
    ...rect(0, 0, 2, 6, 1),
    ...rect(8, 0, 2, 6, 1),
    ...rect(0, 0, 1, 6, 2),
    ...rect(9, 0, 1, 6, 2),
    ...rect(4, 2, 2, 2, 0),
  ],
};

function rect(x0: number, y0: number, w: number, h: number, z: number): Slot[] {
  const out: Slot[] = [];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) out.push({ x, y, z });
  return out;
}

export interface TasState {
  layout: string;
  slots: Slot[];
  /** Tile at each slot (an Okey tile id), or null once removed */
  tiles: (number | null)[];
  history: [number, number][];
  /** Faces of removed tiles, so undo can put them back */
  removedFaces: Record<number, number>;
  shuffles: number;
  startedAt: number;
  finishedAt: number | null;
}
export type TasMove = { type: 'match'; a: number; b: number } | { type: 'undo' } | { type: 'shuffle' };

/** Two tiles match when they show the same face (Okey ids t and t+52 are the two copies) */
export const sameFace = (a: number, b: number) => a % 52 === b % 52;

export function isFree(slots: Slot[], present: boolean[], i: number) {
  const s = slots[i];
  let left = false;
  let right = false;
  for (let k = 0; k < slots.length; k++) {
    if (!present[k] || k === i) continue;
    const o = slots[k];
    if (o.z === s.z + 1 && o.x === s.x && o.y === s.y) return false;
    if (o.z === s.z && o.y === s.y) {
      if (o.x === s.x - 1) left = true;
      if (o.x === s.x + 1) right = true;
    }
  }
  return !left || !right;
}

/** Deal faces onto the given slots by removing random free pairs, so a solution exists */
function deal(slots: Slot[], idx: number[], faces: number[], random: () => number): (number | null)[] | null {
  const out: (number | null)[] = Array(slots.length).fill(null);
  const present = slots.map((_, i) => idx.includes(i));
  const fs = faces.slice();
  for (let k = 0; k < idx.length / 2; k++) {
    const free = idx.filter((i) => present[i] && isFree(slots, present, i));
    if (free.length < 2) return null;
    const pick = shuffle(free, random).slice(0, 2);
    const f = fs.pop()!;
    out[pick[0]] = f;
    out[pick[1]] = f + 52;
    present[pick[0]] = present[pick[1]] = false;
  }
  return out;
}

export function setup(ctx: Pick<GameCtx, 'random' | 'options' | 'now'>): TasState {
  const layout = ctx.options.layout === 'fortress' ? 'fortress' : 'pyramid';
  const slots = LAYOUTS[layout];
  const all = slots.map((_, i) => i);
  for (;;) {
    const faces = shuffle(
      Array.from({ length: 52 }, (_, i) => i),
      ctx.random,
    ).slice(0, slots.length / 2);
    const tiles = deal(slots, all, faces, ctx.random);
    if (tiles) return { layout, slots, tiles, history: [], removedFaces: {}, shuffles: 0, startedAt: ctx.now(), finishedAt: null };
  }
}

export function freePairs(s: Pick<TasState, 'slots' | 'tiles'>): [number, number][] {
  const present = s.tiles.map((t) => t !== null);
  const free = s.tiles.flatMap((t, i) => (t !== null && isFree(s.slots, present, i) ? [i] : []));
  const out: [number, number][] = [];
  for (let a = 0; a < free.length; a++) for (let b = a + 1; b < free.length; b++) if (sameFace(s.tiles[free[a]]!, s.tiles[free[b]]!)) out.push([free[a], free[b]]);
  return out;
}

export function move(s: TasState, _seat: Seat, m: TasMove, ctx: Pick<GameCtx, 'now' | 'random'>): TasState | string {
  if (s.finishedAt !== null) return 'Cleared!';
  if (m.type === 'undo') {
    // Undo puts the last pair back (their faces are remembered in the history)
    const last = s.history[s.history.length - 1];
    if (!last) return 'Nothing to undo';
    return { ...s, history: s.history.slice(0, -1), tiles: s.tiles.map((t, i) => (i === last[0] || i === last[1] ? s.removedFaces[i] : t)) };
  }
  if (m.type === 'shuffle') {
    const left = s.tiles.flatMap((t, i) => (t !== null ? [i] : []));
    const faces = s.tiles.filter((t): t is number => t !== null).map((t) => t % 52);
    const unique = [...new Set(faces)];
    const pairsFaces: number[] = [];
    for (const f of unique) {
      const count = faces.filter((x) => x === f).length;
      for (let k = 0; k < count / 2; k++) pairsFaces.push(f);
    }
    for (let attempt = 0; attempt < 50; attempt++) {
      const tiles = deal(s.slots, left, shuffle(pairsFaces, ctx.random), ctx.random);
      if (tiles) return { ...s, tiles, shuffles: s.shuffles + 1, history: [] };
    }
    return 'Could not shuffle';
  }
  const { a, b } = m;
  if (a === b || s.tiles[a] == null || s.tiles[b] == null) return 'Pick two tiles';
  const present = s.tiles.map((t) => t !== null);
  if (!isFree(s.slots, present, a) || !isFree(s.slots, present, b)) return 'Both tiles must be free';
  if (!sameFace(s.tiles[a]!, s.tiles[b]!)) return 'Those tiles are different';
  const removed = s.tiles.map((t, i) => (i === a || i === b ? null : t));
  const history: [number, number][] = [...s.history, [a, b]];
  return { ...s, tiles: removed, history, removedFaces: { ...s.removedFaces, [a]: s.tiles[a]!, [b]: s.tiles[b]! }, finishedAt: removed.every((t) => t === null) ? ctx.now() : null };
}

export const activePlayers = (s: TasState): Seat[] => (s.finishedAt === null ? [0] : []);
export function result(s: TasState): GameResult | null {
  if (s.finishedAt === null) return null;
  const secs = Math.round((s.finishedAt - s.startedAt) / 1000);
  return { winners: [0], message: `Cleared in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}${s.shuffles ? ` with ${s.shuffles} shuffle${s.shuffles > 1 ? 's' : ''}` : ''} 🀄` };
}
