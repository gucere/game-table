import { describe, expect, it } from 'vitest';
import type { GameCtx } from '../../engine/types';
import { card, deck } from '../cards/cards';
import * as D from './logic';

function rng(seed = 1) {
  return () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
}
const context = (numPlayers = 4, rounds = '1', seed = 7): GameCtx => ({ numPlayers, options: { rounds }, random: rng(seed), now: () => 0 });
function play(s: D.DostState, m: D.DostMove, ctx = context()) {
  const next = D.move(s, s.turn, m, ctx);
  if (typeof next === 'string') throw new Error(next);
  return next;
}

describe('Dost Kazığı', () => {
  it('deals four table cards and four per hand without exposing opponents or stock', () => {
    const s = D.setup(context());
    expect(s.table).toHaveLength(4);
    expect(s.hands.every((h) => h.length === 4)).toBe(true);
    expect(s.stock).toHaveLength(32);
    expect(new Set([...s.stock, ...s.table, ...s.hands.flat()]).size).toBe(52);
    const v = D.view(s, 1);
    expect(v).not.toHaveProperty('stock');
    expect(v).not.toHaveProperty('hands');
    expect(v.hand).toEqual(s.hands[1]);
    expect(v.handCounts).toEqual([4, 4, 4, 4]);
    expect(v.stockCount).toBe(32);
  });

  it('requires a match from anywhere in the hand and validates source and recipient', () => {
    let s = D.setup(context());
    s.hands[0] = [card(0, 3), card(0, 5)];
    s.table = [card(1, 3), card(2, 3), card(0, 8)];
    expect(D.move(s, 0, { type: 'unexpected', card: card(0, 3), source: { kind: 'table', index: 0 }, target: 1 } as unknown as D.DostMove, context())).toBe('Choose a card from your hand');
    expect(D.move(s, 0, { type: 'play', card: card(0, 5) }, context())).toBe('You must use an available match');
    for (const move of [
      { type: 'play', card: card(0, 3) },
      { type: 'play', card: card(0, 3), source: { kind: 'table', index: 2 }, target: 1 },
      { type: 'play', card: card(0, 3), source: { kind: 'table', index: 0 }, target: 0 },
      { type: 'play', card: card(0, 3), source: { kind: 'table', index: 0 }, target: 4 },
    ] as D.DostMove[]) expect(D.move(s, 0, move, context())).toBe('Choose a matching source and another player');
    s = play(s, { type: 'play', card: card(0, 3), source: { kind: 'table', index: 1 }, target: 2 });
    expect(s.piles[2]).toEqual([card(2, 3), card(0, 3)]);
    expect(s.table).toEqual([card(1, 3), card(0, 8)]);
    expect(s.hands[0]).toEqual([card(0, 5)]);
    expect(s.turn).toBe(1);
  });

  it('transfers only the contiguous same-rank group on top of a penalty pile', () => {
    let s = D.setup(context());
    s.hands[0] = [card(3, 7)];
    s.table = [];
    s.piles[1] = [card(0, 7), card(0, 4), card(1, 7), card(2, 7)];
    expect(D.sources(s, 0, card(3, 7))).toEqual([{ kind: 'pile', seat: 1 }]);
    expect(D.targets(s, 0, { kind: 'pile', seat: 1 })).toEqual([2, 3]);
    expect(D.move(s, 0, { type: 'play', card: card(3, 7), source: { kind: 'pile', seat: 1 }, target: 1 }, context())).toBe('Choose a matching source and another player');
    s = play(s, { type: 'play', card: card(3, 7), source: { kind: 'pile', seat: 1 }, target: 3 });
    expect(s.piles[1]).toEqual([card(0, 7), card(0, 4)]);
    expect(s.piles[3]).toEqual([card(1, 7), card(2, 7), card(3, 7)]);
  });

  it('allows escaping your own pile, with no impossible opponent-pile match in two-player games', () => {
    let s = D.setup(context(2));
    s.hands[0] = [card(2, 3), card(1, 7)];
    s.table = [];
    s.piles = [[card(0, 3), card(1, 3)], [card(0, 7)]];
    expect(D.sources(s, 0, card(1, 7))).toEqual([]);
    expect(D.sources(s, 0, card(2, 3))).toEqual([{ kind: 'pile', seat: 0 }]);
    s = play(s, { type: 'play', card: card(2, 3), source: { kind: 'pile', seat: 0 }, target: 1 }, context(2));
    expect(s.piles[0]).toEqual([]);
    expect(s.piles[1]).toEqual([card(0, 7), card(0, 3), card(1, 3), card(2, 3)]);
  });

  it('leaves unmatchable cards on the table and refills only after everyone empties their hand', () => {
    let s = D.setup(context(2));
    s.hands = [[card(0, 2)], [card(0, 3)]];
    s.table = [];
    s.piles = [[], []];
    s.stock = [card(0, 4), card(0, 5), card(0, 6), card(0, 7), card(0, 8), card(0, 9), card(0, 10), card(0, 11)];
    s = play(s, { type: 'play', card: card(0, 2) }, context(2));
    expect(s.hands.map((h) => h.length)).toEqual([0, 1]);
    expect(s.stock).toHaveLength(8);
    s = play(s, { type: 'play', card: card(0, 3) }, context(2));
    expect(s.hands.map((h) => h.length)).toEqual([4, 4]);
    expect(s.stock).toHaveLength(0);
    expect(s.table).toEqual([card(0, 2), card(0, 3)]);
    expect(s.turn).toBe(0);
  });

  it('scores penalties once per deal, carries totals forward and awards the lowest total', () => {
    expect([3, 11, 14, 12, 13, 2, 10].map((rank) => D.penalty(card(0, rank)))).toEqual([30, 20, 10, 10, 10, 2, 10]);
    expect(D.pileScore(deck())).toBe(524);
    let s = D.setup(context(2, '3'));
    s = { ...s, stock: [], hands: [[card(0, 2)], []], piles: [[card(0, 3)], [card(0, 11)]], table: [], scores: [5, 10] };
    s = play(s, { type: 'play', card: card(0, 2) }, context(2, '3'));
    expect(s.scores).toEqual([35, 30]);
    expect(s.phase).toBe('round');
    s = play(s, { type: 'next' }, context(2, '3'));
    expect(s.scores).toEqual([35, 30]);
    expect(s.round).toBe(2);
    expect(s.turn).toBe(1);
    expect(s.piles).toEqual([[], []]);
    expect(D.result({ ...s, phase: 'done' })).toEqual({ winners: [1] });
    expect(D.result({ ...s, scores: [30, 30], phase: 'done' })).toEqual({ winners: [0, 1] });
  });

  it('bots complete seeded multi-round matches with every card conserved', () => {
    for (const n of [2, 3, 4]) for (const seed of [3, 17, 42]) {
      const ctx = context(n, '3', seed);
      let s = D.setup(ctx);
      let roundTotals = Array(n).fill(0);
      for (let step = 0; step < 1000 && !D.result(s); step++) {
        s = play(s, D.bot(D.view(s, s.turn), s.turn, { random: ctx.random, level: (['easy', 'normal', 'hard'] as const)[step % 3] }), ctx);
        const cards = [...s.stock, ...s.table, ...s.hands.flat(), ...s.piles.flat()];
        expect(cards).toHaveLength(52);
        expect(new Set(cards).size).toBe(52);
        if (s.phase !== 'play') {
          roundTotals = roundTotals.map((score, i) => score + D.pileScore(s.piles[i]));
          expect(s.scores).toEqual(roundTotals);
          expect(D.pileScore(s.table) + s.piles.reduce((sum, pile) => sum + D.pileScore(pile), 0)).toBe(524);
        }
      }
      expect(D.result(s)).not.toBeNull();
      expect(s.round).toBe(3);
    }
  });
});
