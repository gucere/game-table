import type { GameCtx, GameResult } from '../../engine/types';
import { deck, isRed, rankOf, shuffle, suitOf, type Card } from '../cards/cards';

export interface Pile {
  down: Card[];
  up: Card[];
}

export interface SolState {
  draw: 1 | 3;
  stock: Card[]; // top = last
  waste: Card[]; // top = last
  found: Card[][]; // 4 piles, A..K of one suit
  tab: Pile[];
  moves: number;
  startedAt: number;
  endedAt: number | null;
  /** Previous states for undo (most recent last) */
  history: Omit<SolState, 'history'>[];
}

export interface SolView {
  draw: 1 | 3;
  stockCount: number;
  waste: Card[];
  found: Card[][];
  tab: { down: number; up: Card[] }[];
  moves: number;
  canUndo: boolean;
  startedAt: number;
  endedAt: number | null;
}

export type Src = { t: 'waste' } | { t: 'found'; i: number } | { t: 'tab'; i: number; k: number };
export type Dst = { t: 'found'; i: number } | { t: 'tab'; i: number };
export type SolMove = { type: 'draw' } | { type: 'undo' } | { type: 'auto' } | { type: 'move'; from: Src; to: Dst };

/** Ace is low in Klondike */
export const val = (c: Card) => (rankOf(c) === 14 ? 1 : rankOf(c));

export function setup(ctx: Pick<GameCtx, 'options' | 'random' | 'now'>): SolState {
  const cards = shuffle(deck(), ctx.random);
  const tab: Pile[] = [];
  for (let i = 0; i < 7; i++) {
    const pile = cards.splice(0, i + 1);
    tab.push({ down: pile.slice(0, -1), up: pile.slice(-1) });
  }
  return {
    draw: ctx.options.draw === '3' ? 3 : 1,
    stock: cards,
    waste: [],
    found: [[], [], [], []],
    tab,
    moves: 0,
    startedAt: ctx.now(),
    endedAt: null,
    history: [],
  };
}

const top = <T,>(a: T[]) => a[a.length - 1];

export function canFound(c: Card, pile: Card[]) {
  if (!pile.length) return val(c) === 1;
  return suitOf(top(pile)) === suitOf(c) && val(c) === val(top(pile)) + 1;
}

export function canTab(c: Card, pile: { up: Card[]; down: Card[] | number }) {
  const downN = typeof pile.down === 'number' ? pile.down : pile.down.length;
  if (!pile.up.length) return downN === 0 && val(c) === 13;
  const t = top(pile.up);
  return isRed(suitOf(t)) !== isRed(suitOf(c)) && val(c) === val(t) - 1;
}

/** Cards a source would move (bottom card first) */
export function picked(s: { waste: Card[]; found: Card[][]; tab: { up: Card[] }[] }, from: Src): Card[] {
  if (from.t === 'waste') return s.waste.length ? [top(s.waste)] : [];
  if (from.t === 'found') return s.found[from.i]?.length ? [top(s.found[from.i])] : [];
  const up = s.tab[from.i]?.up ?? [];
  return from.k >= 0 && from.k < up.length ? up.slice(from.k) : [];
}

function snapshot(s: SolState): Omit<SolState, 'history'> {
  const { history: _h, ...rest } = s;
  return rest;
}

function withHistory(prev: SolState, next: Omit<SolState, 'history'>): SolState {
  return { ...next, history: [...prev.history.slice(-60), snapshot(prev)] };
}

function won(s: Omit<SolState, 'history'>) {
  return s.found.every((f) => f.length === 13);
}

function applyMove(s: SolState, from: Src, to: Dst, now: number): SolState | string {
  const cards = picked(s, from);
  if (!cards.length) return 'Nothing to move';
  const first = cards[0];
  if (to.t === 'found') {
    if (cards.length !== 1) return 'Move one card at a time to a foundation';
    if (from.t === 'found' && from.i === to.i) return 'Same pile';
    if (!canFound(first, s.found[to.i])) return 'Not allowed there';
  } else {
    if (from.t === 'tab' && from.i === to.i) return 'Same pile';
    if (!canTab(first, s.tab[to.i])) return 'Not allowed there';
  }
  const next: Omit<SolState, 'history'> = {
    ...snapshot(s),
    waste: s.waste.slice(),
    found: s.found.map((f) => f.slice()),
    tab: s.tab.map((p) => ({ down: p.down.slice(), up: p.up.slice() })),
    moves: s.moves + 1,
  };
  if (from.t === 'waste') next.waste.pop();
  else if (from.t === 'found') next.found[from.i].pop();
  else {
    const p = next.tab[from.i];
    p.up = p.up.slice(0, from.k);
    if (!p.up.length && p.down.length) p.up = [p.down.pop()!];
  }
  if (to.t === 'found') next.found[to.i].push(first);
  else next.tab[to.i].up.push(...cards);
  if (won(next)) next.endedAt = now;
  return withHistory(s, next);
}

/** Best destination for a click on a card (foundation first) */
export function smartTarget(s: SolView | SolState, from: Src): Dst | null {
  const cards = picked(s as SolState, from);
  if (!cards.length) return null;
  const c = cards[0];
  if (cards.length === 1 && from.t !== 'found') {
    for (let i = 0; i < 4; i++) if (canFound(c, s.found[i])) return { t: 'found', i };
  }
  const tabs = s.tab as { up: Card[]; down: Card[] | number }[];
  for (let i = 0; i < 7; i++) {
    if (from.t === 'tab' && from.i === i) continue;
    if (tabs[i].up.length && canTab(c, tabs[i])) return { t: 'tab', i };
  }
  // Empty column: only worth it if the king isn't already at the bottom of a column
  const fromBottomOfEmpty = from.t === 'tab' && from.k === 0 && (typeof tabs[from.i].down === 'number' ? tabs[from.i].down === 0 : (tabs[from.i].down as Card[]).length === 0);
  if (!fromBottomOfEmpty) for (let i = 0; i < 7; i++) if (!tabs[i].up.length && canTab(c, tabs[i])) return { t: 'tab', i };
  return null;
}

export function move(s: SolState, m: SolMove, now: number): SolState | string {
  if (s.endedAt) return 'Solved already';
  switch (m?.type) {
    case 'draw': {
      const next = { ...snapshot(s), moves: s.moves + 1 };
      if (!s.stock.length) {
        if (!s.waste.length) return 'No cards left to draw';
        next.stock = s.waste.slice().reverse();
        next.waste = [];
      } else {
        const n = Math.min(s.draw, s.stock.length);
        const drawn = s.stock.slice(-n).reverse();
        next.stock = s.stock.slice(0, -n);
        next.waste = [...s.waste, ...drawn];
      }
      return withHistory(s, next);
    }
    case 'undo': {
      const prev = s.history[s.history.length - 1];
      if (!prev) return 'Nothing to undo';
      return { ...prev, history: s.history.slice(0, -1) };
    }
    case 'auto': {
      // Send everything possible to the foundations
      let cur: SolState = s;
      for (let guard = 0; guard < 60 && !cur.endedAt; guard++) {
        let moved = false;
        const sources: Src[] = [{ t: 'waste' }, ...cur.tab.map((p, i) => ({ t: 'tab' as const, i, k: p.up.length - 1 }))];
        for (const from of sources) {
          const c = picked(cur, from)[0];
          if (c === undefined) continue;
          const i = cur.found.findIndex((f) => canFound(c, f));
          if (i < 0) continue;
          const r = applyMove(cur, from, { t: 'found', i }, now);
          if (typeof r !== 'string') {
            cur = { ...r, history: s.history.concat(snapshot(s)) };
            moved = true;
            break;
          }
        }
        if (!moved) break;
      }
      return cur === s ? 'Nothing to send up' : cur;
    }
    case 'move':
      return applyMove(s, m.from, m.to, now);
    default:
      return 'Unknown move';
  }
}

export function result(s: SolState): GameResult | null {
  if (!s.endedAt) return null;
  const secs = Math.round((s.endedAt - s.startedAt) / 1000);
  return { winners: [0], message: `Solved in ${s.moves} moves, ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}! 🎉` };
}

export function view(s: SolState): SolView {
  return {
    draw: s.draw,
    stockCount: s.stock.length,
    waste: s.waste,
    found: s.found,
    tab: s.tab.map((p) => ({ down: p.down.length, up: p.up })),
    moves: s.moves,
    canUndo: s.history.length > 0,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
  };
}

/** All face-down cards turned and stock empty: the rest is a formality */
export function canAutoFinish(v: SolView) {
  return v.stockCount === 0 && v.waste.length <= 1 && v.tab.every((p) => p.down === 0);
}
