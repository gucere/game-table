import { describe, expect, it } from 'vitest';
import type { GameCtx } from '../../engine/types';
import { card } from '../cards/cards';
import * as T from './logic';

function rng(seed = 1) {
  return () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
}
const context = (numPlayers = 2, options: Record<string, string> = {}, seed = 7): GameCtx => ({ numPlayers, options, random: rng(seed), now: () => 0 });
function play(s: T.TrashState, m: T.TrashMove, ctx = context()) {
  const next = T.move(s, s.turn, m, ctx);
  if (typeof next === 'string') throw new Error(next);
  return next;
}

describe('Trash', () => {
  it('uses separate physical cards for each deck and hides every unrevealed card', () => {
    for (const n of [2, 3, 4, 5, 6]) {
      const s = T.setup(context(n));
      const total = Math.ceil(n / 2) * 52;
      expect(new Set([...s.stock, ...s.layouts.flat()]).size).toBe(total);
      expect(s.layouts).toHaveLength(n);
      expect(s.layouts.every((row) => row.length === 10)).toBe(true);
      const view = T.view(s);
      expect(view).not.toHaveProperty('stock');
      expect(view.stockCount).toBe(total - n * 10);
      expect(view.layouts.flat().every((c) => c === null)).toBe(true);
      s.open[0][0] = true;
      expect(T.view(s).layouts[0][0]).toBe(s.layouts[0][0]);
      expect(T.view(s).layouts[1].every((c) => c === null)).toBe(true);
    }
  });

  it('matches ranks from every deck, uses Ace as one, and supports either wild rank', () => {
    const s = T.setup(context(6));
    for (const offset of [0, 52, 104]) {
      expect(T.slots(s, 0, card(0, 14) + offset)).toEqual([0]);
      expect(T.slots(s, 0, card(2, 10) + offset)).toEqual([9]);
      expect(T.slots(s, 0, card(1, 11) + offset)).toHaveLength(10);
      expect(T.slots(s, 0, card(1, 13) + offset)).toEqual([]);
      expect(T.slots({ ...s, wild: 13 }, 0, card(1, 13) + offset)).toHaveLength(10);
      expect(T.slots({ ...s, wild: 13 }, 0, card(1, 11) + offset)).toEqual([]);
    }
    s.sizes[0] = 6;
    s.layouts[0] = s.layouts[0].slice(0, 6);
    s.open[0] = s.open[0].slice(0, 6);
    expect(T.slots(s, 0, card(0, 7))).toEqual([]);
  });

  it('continues through uncovered cards and relocates a wild when its exact number arrives', () => {
    let s = T.setup(context());
    s = { ...s, held: card(1, 14), phase: 'place' };
    s.layouts[0][0] = card(1, 11);
    s.layouts[0][3] = card(2, 12);
    s = play(s, { type: 'place', slot: 0 });
    expect(s.held).toBe(card(1, 11));
    expect(s.open[0][0]).toBe(true);
    expect(s.turn).toBe(0);
    s = play(s, { type: 'place', slot: 3 });
    expect(s.held).toBe(card(2, 12));
    expect(s.layouts[0][3]).toBe(card(1, 11));
    s = play(s, { type: 'discard' });
    expect(s.turn).toBe(1);
    expect(s.discard[s.discard.length - 1]).toBe(card(2, 12));

    s = { ...s, turn: 0, held: card(0, 4), phase: 'place' };
    expect(T.slots(s, 0, s.held!)).toEqual([3]);
    s = play(s, { type: 'place', slot: 3 });
    expect(s.held).toBe(card(1, 11));
    expect(T.slots(s, 0, s.held!)).not.toContain(0);
    expect(T.slots(s, 0, s.held!)).not.toContain(3);
  });

  it('requires a legal placement, rejects unusable discards and preserves the discard top when recycling', () => {
    let s = T.setup(context());
    expect(T.move(s, 1, { type: 'draw', source: 'stock' }, context())).toBe('Not your turn');
    expect(T.move(s, 0, { type: 'draw', source: 'discard' }, context())).toBe('That card cannot be placed');
    s = { ...s, phase: 'place', held: card(0, 2) };
    expect(T.move(s, 0, { type: 'discard' }, context())).toBe('Place your card in an available slot');
    expect(T.move(s, 0, { type: 'place', slot: 2 }, context())).toBe('Choose a matching slot');
    s = { ...s, phase: 'draw', held: null, stock: [], discard: [card(0, 4), card(0, 5), card(0, 12)] };
    expect(T.move(s, 0, { type: 'draw', source: 'discard' }, context())).toBe('That card cannot be placed');
    s = play(s, { type: 'draw', source: 'stock' });
    expect(s.discard).toEqual([card(0, 12)]);
    expect([...s.stock, s.held!].sort((a, b) => a - b)).toEqual([card(0, 4), card(0, 5)]);
  });

  it('shrinks only the deal winner and ends each length at its advertised goal', () => {
    for (const [length, size, done] of [
      ['single', 10, true], ['quick', 7, true], ['quick', 10, false], ['full', 2, false], ['full', 1, true],
    ] as const) {
      const ctx = context(2, { length });
      let s = T.setup(ctx);
      s.sizes[0] = size;
      s.layouts[0] = s.layouts[0].slice(0, size);
      s.open[0] = Array(size).fill(true);
      s.open[0][0] = false;
      s.phase = 'place';
      s.held = card(1, 14);
      const displaced = s.layouts[0][0];
      s = play(s, { type: 'place', slot: 0 }, ctx);
      expect(s.sizes).toEqual([size - 1, 10]);
      expect(s.held).toBeNull();
      expect(s.discard[s.discard.length - 1]).toBe(displaced);
      expect(s.roundWinner).toBe(0);
      expect(s.phase).toBe(done ? 'done' : 'round');
      expect(T.result(s)).toEqual(done ? { winners: [0] } : null);
      if (!done) {
        s = play(s, { type: 'next' }, ctx);
        expect(s.round).toBe(2);
        expect(s.turn).toBe(0);
        expect(s.layouts.map((row) => row.length)).toEqual([size - 1, 10]);
        expect(s.open.flat().some(Boolean)).toBe(false);
      }
    }
  });

  for (const length of ['single', 'quick', 'full']) {
    it(`${length}: seeded bots finish at every table size without losing cards`, () => {
      for (const n of [2, 3, 4, 5, 6]) for (const wild of ['jack', 'king']) {
        const ctx = context(n, { length, wild }, 42);
        let s = T.setup(ctx);
        let steps = 0;
        for (; steps < 30000 && !T.result(s); steps++) {
          s = play(s, T.bot(T.view(s), s.turn, { random: ctx.random, level: 'normal' }), ctx);
          const cards = [...s.stock, ...s.discard, ...s.layouts.flat(), ...(s.held === null ? [] : [s.held])];
          expect(cards).toHaveLength(Math.ceil(n / 2) * 52);
          expect(new Set(cards).size).toBe(cards.length);
        }
        expect(T.result(s), `${n} players, ${wild}, ${steps} moves`).not.toBeNull();
        if (n === 2 && wild === 'jack') expect(steps).toBeLessThan(5000);
      }
    });
  }
});
