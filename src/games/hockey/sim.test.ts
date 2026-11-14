import { describe, expect, it } from 'vitest';
import * as S from './sim';
import { hockey } from './index';

describe('Hava Hokeyi', () => {
  it('keeps mallets in their own half', () => {
    expect(S.clampMallet(0, 10, 0).y).toBeGreaterThanOrEqual(S.H / 2 + S.MALLET_R);
    expect(S.clampMallet(1, 10, S.H).y).toBeLessThanOrEqual(S.H / 2 - S.MALLET_R);
  });

  it('scores a goal when the puck goes into the top goal', () => {
    const r = S.newRink();
    r.pause = 0;
    r.puck = { x: S.W / 2, y: 100, vx: 0, vy: -900 };
    r.mallets[1].x = r.targets[1].x = 20; // keep the top mallet out of the way
    let goal = null;
    for (let i = 0; i < 200 && goal === null; i++) goal = S.step(r, 1 / 240);
    expect(goal).toBe(0);
    expect(r.score).toEqual([1, 0]);
  });

  it('bounces off the end wall beside the goal', () => {
    const r = S.newRink();
    r.pause = 0;
    r.puck = { x: 30, y: 60, vx: 0, vy: -600 };
    r.mallets[1].x = r.targets[1].x = S.W - 30;
    for (let i = 0; i < 120; i++) S.step(r, 1 / 240);
    expect(r.score).toEqual([0, 0]);
    expect(r.puck.vy).toBeGreaterThan(0);
  });

  it('a bot game keeps going and stays finite', () => {
    const r = S.newRink();
    for (let i = 0; i < 240 * 60; i++) {
      r.targets[1] = S.botTarget(r, 'hard');
      S.step(r, 1 / 240);
      expect(Number.isFinite(r.puck.x) && Number.isFinite(r.puck.y)).toBe(true);
    }
  });

  it('records the final score as the result', () => {
    const s = hockey.setup({ numPlayers: 2, options: { target: '5' }, random: Math.random, now: () => 0 } as never);
    const done = hockey.move(s, 0, { type: 'result', score: [5, 3] }, {} as never);
    expect(typeof done).toBe('object');
    expect(hockey.result(done as never)).toEqual({ winners: [0] });
    expect(typeof hockey.move(s, 0, { type: 'result', score: [-1, 2] } as never, {} as never)).toBe('string');
  });
});
