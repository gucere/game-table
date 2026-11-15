import { describe, expect, it } from 'vitest';
import { card } from '../cards/cards';
import * as K from './logic';

function rng(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}
const ctx = { random: rng(2) };

describe('Kemps', () => {
  it('deals four each and four in the middle; each team sees only its own signal', () => {
    const s = K.setup({ random: rng(1), options: {} });
    expect(s.hands.every((h) => h.length === 4)).toBe(true);
    expect(s.center).toHaveLength(4);
    expect(s.stock).toHaveLength(52 - 20);
    expect(s.secret[0]).not.toBe(s.secret[1]);
    expect(K.view(s, 0).mySignal).toBe(s.secret[0]);
    expect(K.view(s, 2).mySignal).toBe(s.secret[0]);
    expect(K.view(s, 1).mySignal).toBe(s.secret[1]);
    expect('secret' in K.view(s, 1)).toBe(false);
    expect(K.view(s, 1).shown).toBeNull();
  });

  it('swaps a card with the middle, and fresh middle cards once everyone is stuck', () => {
    let s = K.setup({ random: rng(3), options: {} });
    const mine = s.hands[0][0];
    const mid = s.center[2];
    s = K.move(s, 0, { type: 'swap', card: mine, i: 2 }, ctx) as K.KempsState;
    expect(s.hands[0]).toContain(mid);
    expect(s.center[2]).toBe(mine);
    const before = s.center.slice();
    for (const seat of [0, 1, 2, 3]) s = K.move(s, seat, { type: 'stuck' }, ctx) as K.KempsState;
    expect(s.center).not.toEqual(before);
    expect(s.stuck).toEqual([false, false, false, false]);
  });

  it('a right Kemps call scores for the caller’s team; a wrong one for the other team', () => {
    let s = K.setup({ random: rng(4), options: {} });
    s = { ...s, hands: [s.hands[0], s.hands[1], [card(0, 9), card(1, 9), card(2, 9), card(3, 9)], s.hands[3]] };
    const right = K.move(s, 0, { type: 'kemps' }, ctx) as K.KempsState;
    expect(right.call).toMatchObject({ right: true, scorer: 0 });
    expect(right.letters).toEqual([1, 0]);
    expect(K.view(right, 1).shown).not.toBeNull();
    const wrong = K.move(s, 1, { type: 'kemps' }, ctx) as K.KempsState;
    expect(wrong.letters).toEqual([1, 0]);
    expect(typeof K.move(s, 0, { type: 'stop', target: 2 }, ctx)).toBe('string');
    const stop = K.move(s, 1, { type: 'stop', target: 2 }, ctx) as K.KempsState;
    expect(stop.letters).toEqual([0, 1]);
  });

  it('first team to spell the word wins', () => {
    let s = K.setup({ random: rng(5), options: { length: 'short' } });
    s = { ...s, letters: [2, 0], hands: [s.hands[0], s.hands[1], [card(0, 4), card(1, 4), card(2, 4), card(3, 4)], s.hands[3]] };
    s = K.move(s, 0, { type: 'kemps' }, ctx) as K.KempsState;
    expect(K.result(s)).toEqual({ winners: [0, 2] });
  });

  it('bots finish a game: they collect, signal and call', () => {
    const random = rng(11);
    let s = K.setup({ random, options: { length: 'short' } });
    let waits = 0;
    for (let step = 0; step < 50000 && !K.result(s); step++) {
      const seat = step % 4;
      const m = K.bot(K.view(s, seat), seat, { random, level: 'hard' });
      if (m === null) {
        waits++;
        continue;
      }
      const next = K.move(s, seat, m, { random });
      if (typeof next === 'string') throw new Error(`${next} ${JSON.stringify(m)}`);
      s = next;
    }
    expect(K.result(s)).not.toBeNull();
    expect(waits).toBeGreaterThan(0);
  });
});
