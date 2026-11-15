import { describe, expect, it } from 'vitest';
import * as Go from './go/logic';
import * as Chain from './chain/logic';
import * as B from './bricks/sim';
import { setDictionary } from './wordtiles/dict';

function rng(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const at = (size: number, r: number, c: number) => r * size + c;

describe('Go', () => {
  const fresh = (size = 9) => Go.setup({ options: { size: String(size), komi: '6.5' } });
  const playAll = (s: Go.GoState, moves: [number, number][]) => {
    for (const [r, c] of moves) {
      const n = Go.move(s, s.turn, { type: 'play', at: at(s.size, r, c) });
      if (typeof n === 'string') throw new Error(n);
      s = n;
    }
    return s;
  };

  it('captures a stone that loses its last liberty, and forbids suicide', () => {
    // Black surrounds a white stone at (1,1)
    let s = playAll(fresh(), [
      [0, 1],
      [1, 1],
      [1, 0],
      [8, 8],
      [1, 2],
      [8, 7],
    ]);
    s = playAll(s, [[2, 1]]);
    expect(s.board[at(9, 1, 1)]).toBe(0);
    expect(s.captures[0]).toBe(1);
    // White may not play back into the hole (no liberties, captures nothing)
    expect(Go.move(s, 1, { type: 'play', at: at(9, 1, 1) })).toMatch(/suicide/i);
  });

  it('applies the ko rule', () => {
    // Classic ko around (1,1)/(1,2)
    let s = playAll(fresh(), [
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 3],
      [2, 1],
      [2, 2],
      [8, 8],
      [1, 1],
    ]);
    // Black takes the ko at (1,2)
    s = playAll(s, [[1, 2]]);
    expect(s.board[at(9, 1, 1)]).toBe(0);
    // White can't retake at once
    expect(Go.move(s, 1, { type: 'play', at: at(9, 1, 1) })).toMatch(/ko/i);
    // After playing elsewhere, it's allowed again
    s = playAll(s, [
      [7, 7],
      [6, 6],
    ]);
    expect(typeof Go.move(s, 1, { type: 'play', at: at(9, 1, 1) })).not.toBe('string');
  });

  it('counts area and komi when both pass', () => {
    let s = fresh();
    // A black wall down column 4 and a white wall down column 5
    for (let r = 0; r < 9; r++) s = playAll(s, [
      [r, 4],
      [r, 5],
    ]);
    s = Go.move(s, 0, { type: 'pass' }) as Go.GoState;
    s = Go.move(s, 1, { type: 'pass' }) as Go.GoState;
    // Black: 9 stones + 36 empty; White: 9 stones + 27 empty + 6.5
    expect(s.over?.score).toEqual([45, 42.5]);
    expect(Go.result(s)).toEqual({ winners: [0] });
  });

  it('easy bots finish a 9×9 game', () => {
    const random = rng(7);
    let s = fresh();
    for (let k = 0; k < 2000 && !s.over; k++) {
      const m = Go.bot(s, s.turn, { random, level: 'easy' });
      const n = Go.move(s, s.turn, m);
      expect(typeof n).not.toBe('string');
      s = n as Go.GoState;
    }
    expect(Go.result(s)).not.toBeNull();
  });

  it('the thinking bot plays a legal move quickly on a small board', () => {
    const s = fresh();
    const t0 = Date.now();
    const m = Go.bot(s, 0, { random: rng(3), level: 'normal' });
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(typeof Go.move(s, 0, m)).not.toBe('string');
  });
});

describe('Kelime Zinciri', () => {
  setDictionary('en', ['apple', 'eagle', 'egg', 'grape', 'elephant', 'tiger', 'rabbit', 'table', 'echo', 'orange', 'ant', 'tea']);
  setDictionary('tr', ['dağ', 'araba', 'ağaç', 'çanta', 'armut', 'tavuk', 'kalem', 'masa', 'ayva']);
  const ctx = (now = 0) => ({ numPlayers: 2, random: rng(1), options: { lang: 'en', seconds: '20', lives: '2', min: '3' }, now: () => now });

  it('checks the letter, the word list and repeats', () => {
    let s = { ...Chain.setup(ctx()), start: 'a' };
    expect(Chain.move(s, 0, { type: 'word', word: 'Tiger' }, ctx())).toMatch(/start with/);
    expect(Chain.move(s, 0, { type: 'word', word: 'axolotl' }, ctx())).toMatch(/word list/);
    s = Chain.move(s, 0, { type: 'word', word: ' Apple ' }, ctx(5)) as Chain.ChainState;
    expect(s.turn).toBe(1);
    expect(s.scores[0]).toBe(5);
    expect(Chain.required(s)).toBe('e');
    expect(s.deadline).toBe(5 + 20000);
    s = Chain.move(s, 1, { type: 'word', word: 'eagle' }, ctx()) as Chain.ChainState;
    expect(Chain.move(s, 0, { type: 'word', word: 'eagle' }, ctx())).toMatch(/already used/);
  });

  it('loses lives on time-outs and ends with the last one standing', () => {
    let s = Chain.setup(ctx());
    s = Chain.onTimer(s, ctx(1));
    expect(s.lives).toEqual([1, 2]);
    expect(s.turn).toBe(1);
    s = Chain.move(s, 1, { type: 'giveup' }, ctx()) as Chain.ChainState;
    s = Chain.onTimer(s, ctx());
    expect(s.over).toBe(true);
    expect(Chain.result(s)).toEqual({ winners: [1] });
  });

  it('skips a final ğ in Turkish', () => {
    expect(Chain.nextLetter('tr', 'dağ')).toBe('a');
    expect(Chain.nextLetter('tr', 'kalem')).toBe('m');
    const s = { ...Chain.setup({ ...ctx(), options: { lang: 'tr', min: '3' } }), start: 'd' };
    const n = Chain.move(s, 0, { type: 'word', word: 'DAĞ' }, ctx()) as Chain.ChainState;
    expect(Chain.required(n)).toBe('a');
    expect(typeof Chain.move(n, 1, { type: 'word', word: 'Araba' }, ctx())).not.toBe('string');
  });

  it('bots play from the word list and the game ends', () => {
    const random = rng(4);
    let s = Chain.setup({ ...ctx(), random });
    for (let k = 0; k < 200 && !s.over; k++) {
      const m = Chain.bot(s, s.turn, { random, level: 'normal' });
      expect(m).not.toBeNull();
      const n = Chain.move(s, s.turn, m!, ctx());
      expect(typeof n).not.toBe('string');
      s = n as Chain.ChainState;
    }
    expect(s.over).toBe(true);
  });
});

describe('Tuğla Kırma', () => {
  it('every level has bricks inside the field', () => {
    for (let l = 1; l <= 12; l++) {
      const bricks = B.layout(l);
      expect(bricks.length).toBeGreaterThan(10);
      for (const b of bricks) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + B.BRICK_W).toBeLessThanOrEqual(B.W);
        expect(b.y + B.BRICK_H).toBeLessThan(B.PADDLE_Y - 100);
      }
    }
  });

  it('the ball breaks bricks, and missing it costs a life', () => {
    const s = B.newBricks(rng(2));
    const idle: B.Input = { left: false, right: false, targetX: null, launch: false };
    for (let k = 0; k < 120; k++) B.step(s, 1 / 60, idle);
    B.step(s, 1 / 60, { ...idle, launch: true });
    // Follow the ball with the paddle for a while: bricks break
    for (let k = 0; k < 60 * 20; k++) B.step(s, 1 / 60, { ...idle, targetX: s.balls[0]?.x ?? null });
    expect(s.score).toBeGreaterThan(0);
    // Now move the paddle away and let the ball drop
    const lives = s.lives;
    for (let k = 0; k < 60 * 30 && s.lives === lives && !s.over; k++) {
      if (s.balls.some((b) => b.stuck)) B.step(s, 1 / 60, { ...idle, launch: true });
      else B.step(s, 1 / 60, { ...idle, targetX: s.balls[0].x > B.W / 2 ? 0 : B.W });
    }
    expect(s.lives).toBe(lives - 1);
  });
});
