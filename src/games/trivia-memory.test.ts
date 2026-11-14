import { describe, expect, it } from 'vitest';
import * as M from './memory/logic';
import * as T from './trivia/logic';
import { cleanQ, decodePack, encodePack, mergePacks } from './trivia/pack';
import { BUILTIN } from './trivia/questions';

function rng(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

describe('Bilgi Yarışı', () => {
  it('built-in questions are well formed', () => {
    for (const lang of ['tr', 'en'] as const) {
      expect(BUILTIN[lang].length).toBeGreaterThan(60);
      for (const q of BUILTIN[lang]) {
        expect(cleanQ(q)).toEqual(q);
        expect(new Set(q.slice(1)).size).toBe(q.length - 1);
      }
    }
  });

  it('scores right answers, faster ones more, and hides the answer until the reveal', () => {
    const clock = { t: 1000, now: () => clock.t, random: rng(2) };
    let s = T.setup({ numPlayers: 3, random: rng(2), options: { lang: 'en', source: 'builtin', count: '5' }, now: clock.now });
    expect(s.questions).toHaveLength(5);
    expect(T.view(s, 0).question.correct).toBeNull();
    const right = s.questions[0].correct;
    const wrong = (right + 1) % s.questions[0].choices.length;
    clock.t = 3000;
    s = T.move(s, 0, { type: 'answer', pick: right }, clock) as T.TriviaState;
    expect(T.view(s, 1).answers[0]).toBeNull();
    clock.t = 15000;
    s = T.move(s, 1, { type: 'answer', pick: right }, clock) as T.TriviaState;
    s = T.move(s, 2, { type: 'answer', pick: wrong }, clock) as T.TriviaState;
    expect(s.phase).toBe('reveal');
    expect(s.gained[0]).toBe(T.points(2000));
    expect(s.gained[0]).toBeGreaterThan(s.gained[1]);
    expect(s.gained[2]).toBe(0);
    expect(T.view(s, 2).question.correct).toBe(right);
    s = T.onTimer(s, clock);
    expect(s.phase).toBe('ask');
    expect(s.round).toBe(1);
  });

  it('nobody answering moves on when time runs out', () => {
    const clock = { now: () => 0 };
    let s = T.setup({ numPlayers: 2, random: rng(3), options: { source: 'builtin', count: '5' }, now: clock.now });
    s = T.onTimer(s, clock);
    expect(s.phase).toBe('reveal');
    expect(s.scores).toEqual([0, 0]);
  });

  it('my questions and mix use the given pack', () => {
    const pack = [['Who made this site?', 'Friends', 'Robots', 'Nobody'] as [string, string, ...string[]]];
    const s = T.setup({ numPlayers: 1, random: rng(), options: { source: 'mine', count: '10' }, now: () => 0 }, { pack });
    expect(s.questions.map((q) => q.q)).toEqual(['Who made this site?']);
    const mix = T.setup({ numPlayers: 1, random: rng(), options: { source: 'mix', count: '20', lang: 'en' }, now: () => 0 }, { pack });
    expect(mix.questions).toHaveLength(20);
  });

  it('everyone writes: authors sit out their own questions', () => {
    const clock = { now: () => 0, random: rng(5) };
    let s = T.setup({ numPlayers: 3, random: rng(5), options: { source: 'players', perPlayer: '1' }, now: clock.now });
    expect(s.phase).toBe('write');
    expect(T.activePlayers(s)).toEqual([0, 1, 2]);
    expect(typeof T.move(s, 0, { type: 'write', questions: [['Only a question', '', '']] }, clock)).toBe('string');
    for (const seat of [0, 1, 2]) s = T.move(s, seat, { type: 'write', questions: [[`Question from ${seat}?`, 'yes', 'no']] }, clock) as T.TriviaState;
    expect(s.phase).toBe('ask');
    expect(s.questions).toHaveLength(3);
    const author = s.questions[0].by!;
    expect(T.activePlayers(s)).not.toContain(author);
    expect(typeof T.move(s, author, { type: 'answer', pick: 0 }, clock)).toBe('string');
    for (const seat of T.activePlayers(s)) s = T.move(s, seat, { type: 'answer', pick: s.questions[0].correct }, clock) as T.TriviaState;
    expect(s.phase).toBe('reveal');
    expect(s.gained[author]).toBe(0);
  });

  it('question packs survive a share link, and bad entries are dropped', () => {
    const pack: [string, string, ...string[]][] = [
      ['İstanbul’un eski adı?', 'Konstantinopolis', 'Roma', 'Atina'],
      ['2 + 2?', '4', '5'],
    ];
    expect(decodePack(encodePack(pack))).toEqual(pack);
    expect(decodePack('???')).toBeNull();
    expect(cleanQ(['No wrong answers', 'x', '', ''])).toBeNull();
    expect(cleanQ(['Same as right', 'Yes', 'yes'])).toBeNull();
    expect(mergePacks(pack, [['2 + 2?', '4', '3'], ['New?', 'a', 'b']])).toHaveLength(3);
  });
});

describe('Hafıza', () => {
  const now = () => 0;

  it('a pair scores and keeps the turn; a miss flips back and passes the turn', () => {
    let s = M.setup({ numPlayers: 2, random: rng(4), options: { pairs: '8' }, now });
    expect(M.view(s).faces.every((f) => f === null)).toBe(true);
    const a = 0;
    const twin = s.faces.findIndex((f, i) => i !== a && f === s.faces[a]);
    const other = s.faces.findIndex((f) => f !== s.faces[a]);
    s = M.move(s, 0, { type: 'flip', i: a }, { now }) as M.MemoryState;
    expect(M.view(s).faces[a]).toBe(s.faces[a]);
    s = M.move(s, 0, { type: 'flip', i: twin }, { now }) as M.MemoryState;
    expect(s.scores).toEqual([1, 0]);
    expect(s.turn).toBe(0);
    expect(typeof M.move(s, 0, { type: 'flip', i: a }, { now })).toBe('string');
    const b = s.faces.findIndex((f, i) => s.owner[i] === null && i !== other && f !== s.faces[other]);
    s = M.move(s, 0, { type: 'flip', i: other }, { now }) as M.MemoryState;
    s = M.move(s, 0, { type: 'flip', i: b }, { now }) as M.MemoryState;
    expect(M.activePlayers(s)).toEqual([]);
    s = M.onTimer(s);
    expect(s.turn).toBe(1);
    expect(M.view(s).faces[other]).toBeNull();
  });

  it('a hard bot clears the table in fewer tries than an easy one', () => {
    const play = (level: 'easy' | 'hard') => {
      let total = 0;
      for (let k = 0; k < 10; k++) {
        const random = rng(k + 1);
        let s = M.setup({ numPlayers: 1, random, options: { pairs: '12' }, now });
        while (!M.result(s)) {
          if (!M.activePlayers(s).length) s = M.onTimer(s);
          else s = M.move(s, 0, M.bot(M.view(s), 0, { random, level }), { now }) as M.MemoryState;
        }
        total += s.tries;
      }
      return total;
    };
    expect(play('hard')).toBeLessThan(play('easy'));
  });
});
