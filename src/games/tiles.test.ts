import { describe, expect, it } from 'vitest';
import { asMeld, bestMelds, okeyFrom, type Tile } from './tiles/tiles';
import { winningHand } from './okey/logic';
import { checkGroups } from './okey101/logic';

// tile id helper: color 0..3, number 1..13, copy 0/1
const t = (color: number, num: number, copy = 0): Tile => copy * 52 + color * 13 + (num - 1);
const okey = okeyFrom(t(3, 4)); // okey = yellow 5
const J = t(3, 5); // the okey tile (wild)

describe('tiles', () => {
  it('validates sets and runs', () => {
    expect(asMeld([t(0, 7), t(1, 7), t(2, 7)], okey, { wrap: false })?.kind).toBe('set');
    expect(asMeld([t(0, 7), t(0, 7, 1), t(2, 7)], okey, { wrap: false })).toBeNull();
    expect(asMeld([t(0, 3), t(0, 4), t(0, 5)], okey, { wrap: false })?.kind).toBe('run');
    expect(asMeld([t(0, 3), J, t(0, 5)], okey, { wrap: false })?.kind).toBe('run');
    expect(asMeld([t(0, 12), t(0, 13), t(0, 1)], okey, { wrap: false })).toBeNull();
    expect(asMeld([t(0, 12), t(0, 13), t(0, 1)], okey, { wrap: true })?.kind).toBe('run');
  });

  it('finds a full okey hand with a joker', () => {
    const hand = [
      t(0, 1), t(0, 2), t(0, 3), t(0, 4),
      t(1, 9), t(2, 9), t(3, 9),
      t(2, 11), t(2, 12), J,
      t(1, 6), t(1, 7), t(1, 8), t(0, 6),
    ];
    // 0-6 is the odd one out; swap it for something that fits
    expect(winningHand(hand, okey)).toBeNull();
    const fixed = hand.slice(0, 13).concat(t(1, 5));
    expect(winningHand(fixed, okey)).not.toBeNull();
    expect(bestMelds(fixed, okey, { wrap: true }).score).toBe(14);
  });

  it('accepts seven pairs', () => {
    const pairs = [1, 2, 3, 4, 5, 6].flatMap((n) => [t(0, n), t(0, n, 1)]).concat([t(1, 9), J]);
    expect(winningHand(pairs, okey)?.pairs).toBe(true);
  });

  it('101: opening needs 101 points', () => {
    const low = [[t(0, 1), t(0, 2), t(0, 3)]];
    expect(typeof checkGroups(low, 'none', okey)).toBe('string');
    const high = [
      [t(0, 11), t(0, 12), t(0, 13)],
      [t(1, 13), t(2, 13), t(3, 13)],
      [t(0, 10), t(1, 10), t(2, 10), t(3, 10)],
    ];
    const r = checkGroups(high, 'none', okey);
    expect(typeof r).not.toBe('string');
    if (typeof r !== 'string') expect(r.points).toBe(36 + 39 + 40);
  });
});
