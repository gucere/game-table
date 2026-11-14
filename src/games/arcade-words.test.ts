import { describe, expect, it } from 'vitest';
import { ANSWERS } from './fiveletters/answers';
import * as F from './fiveletters/logic';
import trWords from './fiveletters/words-tr';
import enWords from './fiveletters/words-en';
import * as S from './space/sim';

function rng(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

describe('Beş Harf', () => {
  it('marks letters, counting repeated letters correctly', () => {
    expect(F.score('kalem', 'kalem').join('')).toBe('ggggg');
    expect(F.score('mekal', 'kalem').join('')).toBe('yyyyy');
    // Only one A in the answer: the first extra A is yellow, the second gray
    expect(F.score('aabbb', 'cdaee').join('')).toBe('yxxxx');
    expect(F.score('speed', 'abide').join('')).toBe('xxyxy');
    expect(F.score('ççççç', 'çiçek').join('')).toBe('gxgxx');
  });

  it('every answer is a real five-letter word in its dictionary', () => {
    for (const [lang, dict] of [
      ['tr', trWords],
      ['en', enWords],
    ] as const) {
      const words = new Set(dict.split(' '));
      for (const w of ANSWERS[lang]) {
        expect([...w]).toHaveLength(5);
        expect(words.has(w)).toBe(true);
        expect([...w].every((ch) => F.ALPHABET[lang].includes(ch))).toBe(true);
      }
      expect(new Set(ANSWERS[lang]).size).toBe(ANSWERS[lang].length);
    }
  });

  it('the daily word is the same all day and changes the next', () => {
    expect(F.dailyWord('tr', 100)).toBe(F.dailyWord('tr', 100));
    const days = new Set(Array.from({ length: 60 }, (_, d) => F.dailyWord('en', d)));
    expect(days.size).toBe(60);
  });

  it('lowercases Turkish I correctly', () => {
    expect(F.lower('tr', 'IŞIK')).toBe('ışık');
    expect(F.lower('tr', 'İNCİR')).toBe('incir');
    expect(F.lower('en', 'TIGER')).toBe('tiger');
  });

  it('a race: fewest guesses wins, letters stay hidden from the others', () => {
    const now = { t: 0, now: () => now.t };
    let s = F.setup({ numPlayers: 2, random: rng(3), options: { lang: 'en', mode: 'random' } });
    s = { ...s, answer: 'pearl' };
    s = F.move(s, 0, { type: 'guess', word: 'PEACH' }, now) as F.FiveState;
    const v1 = F.view(s, 1);
    expect(v1.mine).toEqual([]);
    expect(v1.marks[0][0].join('')).toBe('gggxx');
    expect(v1.answer).toBeNull();
    s = F.move(s, 1, { type: 'guess', word: 'pearl' }, now) as F.FiveState;
    expect(F.view(s, 1).answer).toBe('pearl');
    expect(F.result(s)).toBeNull();
    expect(typeof F.move(s, 1, { type: 'guess', word: 'peach' }, now)).toBe('string');
    now.t = 5;
    s = F.move(s, 0, { type: 'guess', word: 'pearl' }, now) as F.FiveState;
    expect(F.result(s)).toEqual({ winners: [1] });
    expect(typeof F.move(F.setup({ numPlayers: 1, random: rng(), options: {} }), 0, { type: 'guess', word: 'abc' }, now)).toBe('string');
  });

  it('a normal bot usually solves within six tries', () => {
    let solved = 0;
    const random = rng(9);
    for (let k = 0; k < 40; k++) {
      let s = F.setup({ numPlayers: 1, random, options: { lang: k % 2 ? 'en' : 'tr' } });
      while (!F.result(s)) s = F.move(s, 0, F.bot(F.view(s, 0), 0, { random, level: 'normal' }), { now: () => 0 }) as F.FiveState;
      if (F.solvedBy(s, 0)) solved++;
    }
    expect(solved).toBeGreaterThan(32);
  });
});

describe('Uzay Savunması', () => {
  const still: S.Input = { left: false, right: false, targetX: null };

  it('the formation turns and steps down at the edge', () => {
    const s = S.newSpace();
    const y0 = s.oy;
    for (let i = 0; i < 2000 && s.dir === 1; i++) S.step(s, 1 / 60, still, () => 0.99);
    expect(s.dir).toBe(-1);
    expect(s.oy).toBe(y0 + 14);
  });

  it('a bullet destroys a drone and scores', () => {
    const s = S.newSpace();
    const e = s.enemies.find((x) => x.type === 1)!;
    const p = S.enemyPos(s, e);
    s.cool = 99;
    s.bullets.push({ x: p.x, y: p.y + 5, vx: 0, vy: -100 });
    S.step(s, 1 / 60, still, () => 0.99);
    expect(e.alive).toBe(false);
    expect(s.score).toBe(20);
  });

  it('getting hit costs a life, a shield absorbs one hit, three hits end the game', () => {
    const s = S.newSpace();
    s.power.shield = 5;
    const shoot = () => s.bolts.push({ x: s.shipX, y: S.SHIP_Y, vx: 0, vy: 0 });
    shoot();
    S.step(s, 1 / 60, still, () => 0.99);
    expect(s.lives).toBe(3);
    for (let k = 0; k < 3; k++) {
      s.safe = 0;
      shoot();
      S.step(s, 1 / 60, still, () => 0.99);
    }
    expect(s.lives).toBe(0);
    expect(s.over).toBe(true);
  });

  it('clearing a wave starts the next, and wave 5 is the hive', () => {
    const s = S.newSpace();
    for (let w = 1; w < 5; w++) {
      s.enemies.forEach((e) => (e.alive = false));
      for (let i = 0; i < 200 && s.wave === w; i++) S.step(s, 1 / 60, still, () => 0.99);
      expect(s.wave).toBe(w + 1);
    }
    expect(s.boss).not.toBeNull();
    s.boss!.hp = 0;
    for (let i = 0; i < 200 && s.wave === 5; i++) S.step(s, 1 / 60, still, () => 0.99);
    expect(s.wave).toBe(6);
    expect(s.boss).toBeNull();
  });

  it('an idle ship eventually loses, and the game state stays sane', () => {
    const s = S.newSpace();
    const random = rng(4);
    for (let i = 0; i < 60 * 600 && !s.over; i++) S.step(s, 1 / 60, { left: false, right: false, targetX: 60 + (i % 240) }, random);
    expect(s.over).toBe(true);
    expect(s.score).toBeGreaterThan(0);
  });
});
