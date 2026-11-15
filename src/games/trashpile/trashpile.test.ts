import { describe, expect, it } from 'vitest';
import { card } from '../cards/cards';
import * as T from './logic';

function rng(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}
const clock = { random: rng(3), now: () => 1000 };
const c = (rank: number, suit = 0) => card(suit, rank);

/** A table in play, seat 0 to move, with the given cards */
function table(over: Partial<T.TrashState>): T.TrashState {
  const s = T.setup({ random: rng(1) });
  return { ...s, phase: 'play', turn: 0, ready: [true, true, true, true], ...over };
}
function play(s: T.TrashState, seat: number, m: T.TrashMove) {
  const next = T.move(s, seat, m, clock);
  if (typeof next === 'string') throw new Error(next);
  return next;
}

describe('Trash', () => {
  it('deals 3 face-down, 3 face-up and 4 in hand to four players, 12 in the stock', () => {
    const s = T.setup({ random: rng(2) });
    expect(s.hands.map((h) => h.length)).toEqual([4, 4, 4, 4]);
    expect(s.up.every((u) => u.length === 3 && u.every((x) => x !== null))).toBe(true);
    expect(s.down.every((d) => d.length === 3 && d.every((x) => x !== null))).toBe(true);
    expect(s.stock).toHaveLength(12);
    const v = T.view(s, 1);
    expect(v.hand).toEqual(s.hands[1]);
    expect(v.down[0]).toEqual([true, true, true]);
    expect('stock' in v).toBe(false);
  });

  it('works out the rank to beat, looking through 8s; 2 and an empty pile mean anything', () => {
    expect(T.effective([])).toBe(T.ANY);
    expect(T.effective([c(12), c(8), c(8, 1)])).toBe(12);
    expect(T.effective([c(9), c(2)])).toBe(T.ANY);
    expect(T.effective([c(2), c(8)])).toBe(T.ANY);
    expect(T.effective([c(8), c(8, 1)])).toBe(T.ANY);
    expect(T.legal(c(13), [c(12), c(8)])).toBe(true);
    expect(T.legal(c(11), [c(12), c(8)])).toBe(false);
    expect(T.legal(c(9), [c(7)])).toBe(true);
    expect(T.legal(c(7), [c(9)])).toBe(false);
    for (const special of [2, 8, 10]) expect(T.legal(c(special), [c(14)])).toBe(true);
  });

  it('a 10 trashes the pile; you draw back up to four from the stock', () => {
    let s = table({ hands: [[c(10), c(3), c(4), c(5)], [c(6)], [c(7)], [c(9)]], pile: [c(12), c(13)], stock: [c(14), c(11)] });
    s = play(s, 0, { type: 'play', card: c(10) });
    expect(s.pile).toEqual([]);
    expect(s.trashed).toBe(3);
    expect(s.hands[0]).toHaveLength(4);
    expect(s.turn).toBe(1);
    expect(typeof T.move(s, 1, { type: 'pickup' }, clock)).toBe('string');
  });

  it('no draw after picking up, and you must pick up when nothing fits', () => {
    let s = table({ hands: [[c(3), c(4)], [c(5)], [c(6)], [c(7)]], pile: [c(14)], stock: [c(9)] });
    expect(typeof T.move(s, 0, { type: 'play', card: c(3) }, clock)).toBe('string');
    s = play(s, 0, { type: 'pickup' });
    expect(s.hands[0]).toHaveLength(3);
    expect(s.stock).toHaveLength(1);
  });

  it('a face-up card that can’t beat the pile is shown, then picked up', () => {
    let s = table({
      hands: [[], [c(5)], [c(6)], [c(7)]],
      up: [[c(4), c(3), null], [null, null, null], [null, null, null], [null, null, null]],
      pile: [c(12)],
      stock: [],
    });
    s = play(s, 0, { type: 'up', slot: 0 });
    expect(s.phase).toBe('reveal');
    expect(s.pile.slice(-1)[0]).toBe(c(4));
    expect(T.activePlayers(s)).toEqual([]);
    s = T.onTimer(s);
    expect(s.hands[0]).toEqual([c(12), c(4)]);
    expect(s.pile).toEqual([]);
    expect(s.turn).toBe(1);
  });

  it('you must play a face-up card that fits if you have one', () => {
    const s = table({ hands: [[], [c(5)], [c(6)], [c(7)]], up: [[c(4), c(14), null], [null, null, null], [null, null, null], [null, null, null]], pile: [c(12)], stock: [] });
    expect(T.move(s, 0, { type: 'up', slot: 0 }, clock)).toMatch(/fits/);
  });

  it('the last card out wins the round, even a 10; wins carry over', () => {
    let s = table({ hands: [[], [c(5)], [c(6)], [c(7)]], up: [[null, null, null], [null, null, null], [null, null, null], [null, null, null]], down: [[c(10), null, null], [c(3), null, null], [c(3), null, null], [c(3), null, null]], pile: [c(14)], stock: [] });
    s = play(s, 0, { type: 'flip', slot: 0 });
    expect(s.phase).toBe('roundover');
    expect(s.wins).toEqual([1, 0, 0, 0]);
    s = play(s, 2, { type: 'next' });
    expect(s.phase).toBe('swap');
    expect(s.wins).toEqual([1, 0, 0, 0]);
    expect(s.round).toBe(2);
  });

  it('a failed last face-down flip is not a win', () => {
    let s = table({ hands: [[], [c(5)], [c(6)], [c(7)]], up: [[null, null, null], [null, null, null], [null, null, null], [null, null, null]], down: [[c(3), null, null], [c(3), null, null], [c(3), null, null], [c(3), null, null]], pile: [c(14)], stock: [] });
    s = play(s, 0, { type: 'flip', slot: 0 });
    expect(s.phase).toBe('reveal');
    s = T.onTimer(s);
    expect(s.hands[0]).toEqual([c(14), c(3)]);
    expect(s.wins).toEqual([0, 0, 0, 0]);
  });

  it('swapping before play, then a random starter', () => {
    let s = T.setup({ random: rng(4) });
    const h = s.hands[0][0];
    const u = s.up[0][1]!;
    s = play(s, 0, { type: 'swap', card: h, slot: 1 });
    expect(s.up[0][1]).toBe(h);
    expect(s.hands[0]).toContain(u);
    expect(typeof T.move(s, 0, { type: 'play', card: s.hands[0][0] }, clock)).toBe('string');
    for (const seat of [0, 1, 2, 3]) s = play(s, seat, { type: 'ready' });
    expect(s.phase).toBe('play');
  });

  it('bots play many rounds without an illegal move', () => {
    const random = rng(9);
    let s = T.setup({ random });
    let rounds = 0;
    for (let step = 0; step < 20000 && rounds < 6; step++) {
      if (s.phase === 'reveal') {
        s = T.onTimer(s);
        continue;
      }
      if (s.phase === 'roundover') rounds++;
      const seat = T.activePlayers(s)[0];
      const m = T.bot(T.view(s, seat), seat, { random, level: (['easy', 'normal', 'hard'] as const)[seat % 3] });
      const next = T.move(s, seat, m, { random, now: () => 0 });
      if (typeof next === 'string') throw new Error(`${next} ${JSON.stringify(m)}`);
      s = next;
    }
    expect(rounds).toBe(6);
    expect(s.wins.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(5);
  });
});
