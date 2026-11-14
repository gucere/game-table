import { describe, expect, it } from 'vitest';
import { defaultOptions, type GameDef } from '../engine/types';
import { getGame } from './index';
import * as Likely from './likely';
import * as Truths from './truths';

function rng(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

describe('partners games', () => {
  for (const id of ['esli-batak', 'esli-101']) {
    it(`${id}: bots finish and the winners are a pair of partners`, () => {
      const g = getGame(id) as GameDef;
      for (const seed of [3, 8, 21]) {
        const random = rng(seed);
        const ctx = { numPlayers: 4, random, options: defaultOptions(g), now: () => 0 };
        let s = g.setup(ctx);
        for (let step = 0; step < 20000 && !g.result(s); step++) {
          if (!g.activePlayers(s).length && g.onTimer) {
            s = g.onTimer(s, ctx);
            continue;
          }
          const seat = g.activePlayers(s)[0];
          const next = g.move(s, seat, g.bot!(g.view(s, seat), seat, { random, level: 'normal' }), ctx);
          if (typeof next === 'string') throw new Error(next);
          s = next;
        }
        const r = g.result(s)!;
        expect(r).not.toBeNull();
        if (!r.draw) {
          expect(r.winners).toHaveLength(2);
          expect((r.winners[1] - r.winners[0]) % 4).toBe(2);
        }
      }
    }, 60000);
  }
});

describe('Two Truths and a Lie', () => {
  it('scores spotters and the teller, then moves to the next teller', () => {
    const now = () => 0;
    let s = Truths.setup({ numPlayers: 4, options: { rounds: '1' } });
    expect(Truths.activePlayers(s)).toEqual([0]);
    expect(typeof Truths.move(s, 1, { type: 'write', statements: ['a', 'b', 'c'], lie: 0 }, { now })).toBe('string');
    s = Truths.move(s, 0, { type: 'write', statements: ['I can juggle', 'I have a cat', 'I met a king'], lie: 2 }, { now }) as Truths.TruthsState;
    // Others don't see the lie yet; the teller does
    expect(Truths.view(s, 1).lie).toBeNull();
    expect(Truths.view(s, 0).lie).toBe(2);
    s = Truths.move(s, 1, { type: 'vote', pick: 2 }, { now }) as Truths.TruthsState;
    s = Truths.move(s, 2, { type: 'vote', pick: 0 }, { now }) as Truths.TruthsState;
    expect(Truths.view(s, 3).votes).toEqual([null, null, null, null]);
    s = Truths.move(s, 3, { type: 'vote', pick: 1 }, { now }) as Truths.TruthsState;
    expect(s.phase).toBe('reveal');
    expect(s.scores).toEqual([2, 1, 0, 0]);
    s = Truths.onTimer(s, {} as never);
    expect(Truths.activePlayers(s)).toEqual([1]);
  });
});

describe('Kim Daha Çok?', () => {
  it('crowns the most-voted player and rewards the voters who agreed', () => {
    const now = () => 0;
    let s = Likely.setup({ numPlayers: 4, random: rng(2), options: { lang: 'en', rounds: '6' } });
    expect(s.prompts).toHaveLength(6);
    for (const [seat, pick] of [
      [0, 2],
      [1, 2],
      [2, 3],
      [3, 2],
    ]) s = Likely.move(s, seat, { type: 'vote', seat: pick }, { now }) as Likely.LikelyState;
    expect(s.phase).toBe('reveal');
    expect(s.picked).toEqual([2]);
    expect(s.titles).toEqual([0, 0, 1, 0]);
    expect(s.scores).toEqual([1, 1, 0, 1]);
    s = Likely.onTimer(s);
    expect(s.phase).toBe('vote');
    expect(s.round).toBe(1);
  });
});
