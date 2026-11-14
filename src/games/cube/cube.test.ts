import Cube from './vendor-cubejs.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { CubeModel, inverse, toFacelets } from './model';

function rng(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

describe('cube model', () => {
  it('four quarter turns are the identity, and inverses undo moves', () => {
    for (const n of [2, 3, 4, 5]) {
      const m = new CubeModel(n);
      let s = m.solved();
      for (const mv of ['R', 'U', "F'", '2R', 'Dw', 'B2']) {
        if (mv.startsWith('2') && n < 3) continue;
        let t = s;
        for (let k = 0; k < 4; k++) t = m.apply(t, mv.replace(/['2]/, ''));
        expect(t).toEqual(s);
        expect(m.apply(m.apply(s, mv), inverse(mv))).toEqual(s);
      }
      const scr = m.scramble(rng(n));
      for (const mv of scr) s = m.apply(s, mv);
      expect(m.isSolved(s)).toBe(false);
      for (const mv of [...scr].reverse()) s = m.apply(s, inverse(mv));
      expect(m.isSolved(s)).toBe(true);
    }
  });

  it('matches the solver after every face turn (same facelet layout and turn direction)', () => {
    const m = new CubeModel(3);
    for (const mv of ['U', 'R', 'F', 'D', 'L', 'B', "R'", 'U2', 'R U F', "L' D2 B R'"]) {
      let s = m.solved();
      for (const x of mv.split(' ')) s = m.apply(s, x);
      expect(toFacelets(m, s)).toBe(new Cube().move(mv).asString());
    }
  });
});

describe('cube solver', () => {
  beforeAll(() => {
    Cube.initSolver();
  }, 60000);

  it('solves scrambled 3x3 and 2x2 cubes, slice moves included', () => {
    for (const n of [3, 2]) {
      for (const seed of [1, 2, 3]) {
        const m = new CubeModel(n);
        let s = m.solved();
        for (const mv of m.scramble(rng(seed * 7 + n))) s = m.apply(s, mv);
        const solution: string = Cube.fromString(toFacelets(m, s)!).solve();
        for (const mv of solution.split(' ').filter(Boolean)) s = m.apply(s, mv);
        expect(m.isSolved(s)).toBe(true);
      }
    }
  }, 60000);
});
