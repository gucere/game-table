import { describe, expect, it } from 'vitest';
import { card } from './cards/cards';
import { CARDS } from './describe/cards';
import * as D from './describe/logic';
import * as M from './mission/logic';
import { WORDS } from './mission/words';
import * as P from './pisyedili/logic';
import * as S from './spy/logic';

function rng(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

describe('Pis Yedili', () => {
  const base = (over: Partial<P.PisState> = {}): P.PisState => ({ ...P.setup({ numPlayers: 3, random: rng(1), options: {} }), ...over });

  it('follows suit or rank; a jack goes on anything and names the suit', () => {
    const s = base({ pile: [card(1, 5)], suit: 1, hands: [[card(1, 9), card(2, 5), card(0, 9), card(3, 11)], [], []], turn: 0 });
    expect(P.canPlay(s, card(1, 9))).toBe(true);
    expect(P.canPlay(s, card(2, 5))).toBe(true);
    expect(P.canPlay(s, card(0, 9))).toBe(false);
    expect(typeof P.move(s, 0, { type: 'play', card: card(3, 11) }, { random: rng() })).toBe('string');
    const j = P.move(s, 0, { type: 'play', card: card(3, 11), suit: 0 }, { random: rng() }) as P.PisState;
    expect(j.suit).toBe(0);
    expect(j.turn).toBe(1);
  });

  it('sevens stack, eights skip, tens reverse', () => {
    let s = base({ pile: [card(0, 4)], suit: 0, hands: [[card(0, 7), card(0, 2)], [card(1, 7), card(1, 3)], [card(2, 2), card(2, 3)]], turn: 0 });
    s = P.move(s, 0, { type: 'play', card: card(0, 7) }, { random: rng() }) as P.PisState;
    expect(s.penalty).toBe(2);
    expect(P.canPlay(s, card(1, 3))).toBe(false);
    s = P.move(s, 1, { type: 'play', card: card(1, 7) }, { random: rng() }) as P.PisState;
    expect(s.penalty).toBe(4);
    expect(s.turn).toBe(2);
    s = P.move(s, 2, { type: 'draw' }, { random: rng() }) as P.PisState;
    expect(s.hands[2]).toHaveLength(6);
    expect(s.penalty).toBe(0);
    expect(s.turn).toBe(0);

    let t = base({ pile: [card(0, 4)], suit: 0, hands: [[card(0, 8), card(0, 2)], [card(1, 2)], [card(2, 2)]], turn: 0 });
    t = P.move(t, 0, { type: 'play', card: card(0, 8) }, { random: rng() }) as P.PisState;
    expect(t.turn).toBe(2);
    let r = base({ pile: [card(0, 4)], suit: 0, hands: [[card(0, 10), card(0, 2)], [card(1, 2)], [card(2, 2)]], turn: 0 });
    r = P.move(r, 0, { type: 'play', card: card(0, 10) }, { random: rng() }) as P.PisState;
    expect(r.dir).toBe(-1);
    expect(r.turn).toBe(2);
  });

  it('emptying your hand wins; the points game counts what is left', () => {
    const s = base({ mode: 'points', pile: [card(0, 4)], suit: 0, hands: [[card(0, 2)], [card(1, 11), card(1, 7)], [card(2, 14)]], turn: 0 });
    const e = P.move(s, 0, { type: 'play', card: card(0, 2) }, { random: rng() }) as P.PisState;
    expect(e.roundOver).toBe(true);
    expect(e.roundPoints).toEqual([0, 45, 11]);
    expect(e.over).toBe(false);
    const next = P.move(e, 0, { type: 'next' }, { random: rng() }) as P.PisState;
    expect(next.hands.every((h) => h.length === P.HAND)).toBe(true);
  });

  it('bots finish games with two decks', () => {
    const random = rng(5);
    let s = P.setup({ numPlayers: 6, random, options: { mode: 'points' } });
    for (let k = 0; k < 20000 && !P.result(s); k++) {
      const seat = P.activePlayers(s)[0];
      const next = P.move(s, seat, P.bot(P.view(s, seat), seat, { random, level: (['easy', 'normal', 'hard'] as const)[seat % 3] }), { random });
      if (typeof next === 'string') throw new Error(next);
      s = next;
    }
    expect(P.result(s)).not.toBeNull();
  });
});

describe('Kelimeyi Anlat', () => {
  it('has enough well-formed cards', () => {
    for (const lang of ['tr', 'en'] as const) {
      expect(CARDS[lang].length).toBeGreaterThanOrEqual(60);
      for (const [w, f] of CARDS[lang]) {
        expect(w.length).toBeGreaterThan(1);
        expect(f).toHaveLength(5);
      }
    }
  });

  it('scores marks for the describer’s team and hides the card from their teammates', () => {
    const clock = { t: 0, now: () => clock.t, random: rng(2) };
    let s = D.setup({ numPlayers: 4, random: rng(2), options: { passes: '3' } });
    expect(D.activePlayers(s)).toEqual([0]);
    s = D.move(s, 0, { type: 'start' }, clock) as D.DescribeState;
    expect(D.view(s, 0).card).not.toBeNull();
    expect(D.view(s, 2).card).toBeNull();
    expect(D.view(s, 1).card).not.toBeNull();
    expect(typeof D.move(s, 1, { type: 'mark', mark: 'buzz' }, clock)).toBe('string');
    s = D.move(s, 0, { type: 'mark', mark: 'ok' }, clock) as D.DescribeState;
    s = D.move(s, 0, { type: 'mark', mark: 'ok' }, clock) as D.DescribeState;
    s = D.move(s, 0, { type: 'mark', mark: 'buzz' }, clock) as D.DescribeState;
    for (let k = 0; k < 3; k++) s = D.move(s, 0, { type: 'mark', mark: 'pass' }, clock) as D.DescribeState;
    expect(typeof D.move(s, 0, { type: 'mark', mark: 'pass' }, clock)).toBe('string');
    expect(s.scores).toEqual([1, 0]);
    s = D.onTimer(s, clock);
    expect(s.phase).toBe('ready');
    expect(D.activePlayers(s)).toEqual([1]);
  });
});

describe('Gizli Görev', () => {
  it('deals 9 + 8 team words, 7 neutral and a bomb; only leaders see the key', () => {
    const s = M.setup({ numPlayers: 4, random: rng(3), options: {} });
    expect(new Set(s.words).size).toBe(25);
    const count = (k: M.Key) => s.key.filter((x) => x === k).length;
    expect([count('a'), count('b')].sort()).toEqual([8, 9]);
    expect(count('n')).toBe(7);
    expect(count('x')).toBe(1);
    expect(M.view(s, 0).key.every((k) => k !== null)).toBe(true);
    expect(M.view(s, 2).key.every((k) => k === null)).toBe(true);
    expect(new Set(WORDS.tr).size).toBeGreaterThan(100);
    expect(new Set(WORDS.en).size).toBeGreaterThan(100);
  });

  it('clues, guesses, turn changes and the bomb', () => {
    let s = M.setup({ numPlayers: 4, random: rng(4), options: { lang: 'en' } });
    s = { ...s, team: 0 };
    const leader = M.leaderOf(0);
    expect(typeof M.move(s, leader, { type: 'clue', word: 'two words', count: 1 })).toBe('string');
    expect(typeof M.move(s, leader, { type: 'clue', word: s.words[0], count: 1 })).toBe('string');
    s = M.move(s, leader, { type: 'clue', word: 'zzz', count: 1 }) as M.MissionState;
    expect(M.activePlayers(s)).toEqual([2]);
    const mine = s.key.findIndex((k) => k === 'a');
    const neutral = s.key.findIndex((k) => k === 'n');
    s = M.move(s, 2, { type: 'guess', i: mine }) as M.MissionState;
    expect(s.team).toBe(0);
    s = M.move(s, 2, { type: 'guess', i: neutral }) as M.MissionState;
    expect(s.team).toBe(1);
    expect(s.phase).toBe('clue');
    s = M.move(s, 1, { type: 'clue', word: 'yyy', count: 2 }) as M.MissionState;
    s = M.move(s, 3, { type: 'guess', i: s.key.indexOf('x') }) as M.MissionState;
    expect(M.result(s)).toEqual({ winners: [0, 2] });
  });
});

describe('Casus Kim?', () => {
  const now = () => 0;

  it('only the spy is kept in the dark, and nobody sees who the spy is', () => {
    const s = S.setup({ numPlayers: 5, random: rng(6), options: {}, now });
    for (let i = 0; i < 5; i++) {
      const v = S.view(s, i);
      expect(v.amSpy).toBe(i === s.spy);
      expect(v.myPlace).toBe(i === s.spy ? null : s.place);
      expect(v.spySeat).toBeNull();
      expect('spy' in v).toBe(false);
    }
  });

  it('a unanimous accusation decides; one “no” lets the game go on', () => {
    let s = S.setup({ numPlayers: 4, random: rng(7), options: {}, now });
    s = { ...s, spy: 3 };
    s = S.move(s, 0, { type: 'accuse', suspect: 1 }, { now }) as S.SpyState;
    expect(s.phase).toBe('accuse');
    s = S.move(s, 2, { type: 'vote', yes: false }, { now }) as S.SpyState;
    expect(s.phase).toBe('play');
    expect(typeof S.move(s, 0, { type: 'accuse', suspect: 3 }, { now })).toBe('string');
    s = S.move(s, 1, { type: 'accuse', suspect: 3 }, { now }) as S.SpyState;
    s = S.move(s, 0, { type: 'vote', yes: true }, { now }) as S.SpyState;
    s = S.move(s, 2, { type: 'vote', yes: true }, { now }) as S.SpyState;
    expect(S.result(s)).toEqual({ winners: [0, 1, 2] });
  });

  it('time runs out: the vote, then the spy’s last guess', () => {
    let s = S.setup({ numPlayers: 3, random: rng(8), options: {}, now });
    s = { ...s, spy: 2 };
    s = S.onTimer(s);
    expect(s.phase).toBe('final');
    s = S.move(s, 0, { type: 'final', suspect: 2 }, { now }) as S.SpyState;
    s = S.move(s, 1, { type: 'final', suspect: 2 }, { now }) as S.SpyState;
    s = S.move(s, 2, { type: 'final', suspect: 0 }, { now }) as S.SpyState;
    expect(s.phase).toBe('spyguess');
    expect(S.activePlayers(s)).toEqual([2]);
    s = S.move(s, 2, { type: 'guess', place: s.place }, { now }) as S.SpyState;
    expect(S.result(s)).toEqual({ winners: [2] });
  });
});
