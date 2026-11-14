/**
 * Hafıza: cards lie face down in pairs. On your turn flip two; a pair is yours and you go again,
 * otherwise they turn back over and the next player goes. Most pairs wins.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';
import { shuffle } from '../cards/cards';

export const THEMES: Record<string, string[]> = {
  animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐢'],
  food: ['🍎', '🍌', '🍇', '🍓', '🍒', '🍑', '🍍', '🥝', '🍅', '🥕', '🌽', '🍆', '🥑', '🍋', '🍉', '🍐', '🥥', '🧀'],
  things: ['🎈', '⚽', '🎸', '🚲', '🚀', '🌈', '⭐', '🌙', '🔔', '🎁', '🧩', '🎲', '🪁', '⚓', '🌻', '🍀', '🔑', '💎'],
};
const FLIP_BACK_MS = 1100;
const LOG = 80;

export interface MemoryState {
  n: number;
  faces: string[];
  owner: (Seat | null)[];
  open: number[];
  turn: Seat;
  scores: number[];
  /** Pairs of cards flipped (for solo play) */
  tries: number;
  /** Cards everyone has seen so far, newest last: what a sharp memory could recall */
  seen: { i: number; face: string }[];
  deadline: number | null;
  startedAt: number;
  endedAt: number | null;
}
export type MemoryMove = { type: 'flip'; i: number };
export interface MemoryView {
  n: number;
  /** Face of each card when it's showing, otherwise null */
  faces: (string | null)[];
  owner: (Seat | null)[];
  open: number[];
  turn: Seat;
  scores: number[];
  tries: number;
  seen: { i: number; face: string }[];
  deadline: number | null;
  startedAt: number;
  endedAt: number | null;
}

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'random' | 'options' | 'now'>): MemoryState {
  const pairs = Math.max(2, Math.min(18, Number(ctx.options.pairs ?? 8)));
  const theme = THEMES[ctx.options.theme ?? 'animals'] ?? THEMES.animals;
  const chosen = shuffle(theme, ctx.random).slice(0, pairs);
  return {
    n: ctx.numPlayers,
    faces: shuffle([...chosen, ...chosen], ctx.random),
    owner: Array(pairs * 2).fill(null),
    open: [],
    turn: 0,
    scores: Array(ctx.numPlayers).fill(0),
    tries: 0,
    seen: [],
    deadline: null,
    startedAt: ctx.now(),
    endedAt: null,
  };
}

const finished = (s: MemoryState) => s.owner.every((o) => o !== null);

export function move(s: MemoryState, seat: Seat, m: MemoryMove, ctx: Pick<GameCtx, 'now'>): MemoryState | string {
  if (finished(s)) return 'Game over';
  if (seat !== s.turn) return 'Not your turn';
  if (s.open.length >= 2) return 'Wait for the cards to turn back';
  if (m?.type !== 'flip' || !Number.isInteger(m.i) || m.i < 0 || m.i >= s.faces.length) return 'Pick a card';
  if (s.owner[m.i] !== null || s.open.includes(m.i)) return 'Pick a face-down card';
  const open = [...s.open, m.i];
  const seen = [...s.seen, { i: m.i, face: s.faces[m.i] }].slice(-LOG);
  if (open.length < 2) return { ...s, open, seen };
  const [a, b] = open;
  const tries = s.tries + 1;
  if (s.faces[a] === s.faces[b]) {
    const owner = s.owner.map((o, i) => (i === a || i === b ? seat : o));
    const done = owner.every((o) => o !== null);
    return { ...s, owner, open: [], seen, tries, scores: s.scores.map((x, i) => (i === seat ? x + 1 : x)), endedAt: done ? ctx.now() : null };
  }
  return { ...s, open, seen, tries, deadline: ctx.now() + FLIP_BACK_MS };
}

/** Mismatched cards turn back over and the next player goes */
export function onTimer(s: MemoryState): MemoryState {
  if (s.open.length < 2) return s;
  return { ...s, open: [], deadline: null, turn: (s.turn + 1) % s.n };
}

export const activePlayers = (s: MemoryState): Seat[] => (finished(s) || s.open.length >= 2 ? [] : [s.turn]);

export function view(s: MemoryState): MemoryView {
  return { ...s, faces: s.faces.map((f, i) => (s.owner[i] !== null || s.open.includes(i) ? f : null)) };
}

export function result(s: MemoryState): GameResult | null {
  if (!finished(s)) return null;
  if (s.n === 1) return { winners: [0], message: `Done in ${s.tries} tries.` };
  const best = Math.max(...s.scores);
  const winners = s.scores.flatMap((x, i) => (x === best ? [i] : []));
  return winners.length > 1 ? { winners, draw: winners.length === s.n } : { winners };
}

/** Bots remember the last few cards they saw: easy a handful, hard nearly everything */
export function bot(v: MemoryView, _seat: Seat, ctx: BotCtx): MemoryMove {
  const span = ctx.level === 'hard' ? 60 : ctx.level === 'normal' ? 14 : 5;
  const memory = new Map<number, string>();
  for (const { i, face } of v.seen.slice(-span)) if (v.owner[i] === null) memory.set(i, face);
  const hidden = v.faces.flatMap((_f, i) => (v.owner[i] === null && !v.open.includes(i) ? [i] : []));
  const unknown = hidden.filter((i) => !memory.has(i));
  const pick = (list: number[]) => list[Math.floor(ctx.random() * list.length)];

  if (v.open.length === 1) {
    const face = v.faces[v.open[0]];
    const match = hidden.find((i) => memory.get(i) === face);
    if (match !== undefined) return { type: 'flip', i: match };
    return { type: 'flip', i: pick(unknown.length ? unknown : hidden) };
  }
  // A pair I already know?
  const byFace = new Map<string, number[]>();
  for (const i of hidden) if (memory.has(i)) byFace.set(memory.get(i)!, [...(byFace.get(memory.get(i)!) ?? []), i]);
  const known = [...byFace.values()].find((x) => x.length >= 2);
  if (known) return { type: 'flip', i: known[0] };
  return { type: 'flip', i: pick(unknown.length ? unknown : hidden) };
}
