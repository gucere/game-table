import { describe, expect, it } from 'vitest';
import { checkPeople, decodeReveal, drawCycle, drawWithExclusions, encodeReveal } from './draw';

function rng(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

describe('Secret Santa', () => {
  it('everyone gives and receives exactly once, never to themselves, in one circle', () => {
    for (let n = 3; n <= 40; n++) {
      const r = drawCycle(n, rng(n));
      expect([...r].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
      r.forEach((x, i) => expect(x).not.toBe(i));
      // Following the circle from person 0 visits everyone
      let at = 0;
      const seen = new Set<number>();
      for (let k = 0; k < n; k++) {
        seen.add(at);
        at = r[at];
      }
      expect(seen.size).toBe(n);
      expect(at).toBe(0);
    }
  });

  it('private links round-trip (Turkish letters and emoji too) and hide the names', () => {
    const r = { g: 'Ayşe Gül', r: 'Çağrı Öztürk', b: '500 ₺', d: '2026-12-31', m: 'Hediyeler ağacın altına 🎄', l: 'tr' };
    const token = encodeReveal(r, rng(5));
    expect(decodeReveal(token)).toEqual(r);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(atob(token.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((token.length + 3) % 4))).not.toContain('Ayşe');
    expect(decodeReveal('nonsense')).toBeNull();
    expect(decodeReveal('')).toBeNull();
  });

  it('checks the list before drawing', () => {
    const ok = [
      { name: 'Ayla', email: 'ayla@example.com' },
      { name: 'Deniz', email: 'deniz@example.com' },
      { name: 'Mert', email: 'mert@example.com' },
    ];
    expect(checkPeople(ok)).toEqual([]);
    expect(checkPeople(ok.slice(0, 2))).toContain('Add at least 3 people.');
    expect(checkPeople([...ok, { name: 'ayla', email: 'x@example.com' }])).toHaveLength(1);
    expect(checkPeople([...ok, { name: 'Zeynep', email: 'not-an-email' }])).toContain('Check the email addresses.');
    expect(checkPeople([...ok, { name: 'Zeynep', email: 'AYLA@example.com' }])).toContain('Two people have the same email address.');
  });

  it('respects pairs who may not draw each other, and reports impossible ones', () => {
    for (let seed = 1; seed < 30; seed++) {
      const ex: [number, number][] = [
        [0, 1],
        [2, 3],
        [4, 0],
      ];
      const r = drawWithExclusions(6, ex, rng(seed))!;
      expect([...r].sort()).toEqual([0, 1, 2, 3, 4, 5]);
      r.forEach((x, g) => {
        expect(x).not.toBe(g);
        expect(ex.some(([a, b]) => (a === g && b === x) || (b === g && a === x))).toBe(false);
      });
    }
    // Three people where 0 can't draw 1 or 2: impossible
    expect(
      drawWithExclusions(
        3,
        [
          [0, 1],
          [0, 2],
        ],
        rng(2),
      ),
    ).toBeNull();
  });
});
