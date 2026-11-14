import { beforeAll, describe, expect, it } from 'vitest';
import { bot, findMoves } from './wordtiles/bot';
import { decode, hasWord, setDictionary } from './wordtiles/dict';
import enData from './wordtiles/dict-en';
import trData from './wordtiles/dict-tr';
import * as L from './wordtiles/logic';

function rng(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

beforeAll(() => {
  setDictionary('en', decode(enData));
  setDictionary('tr', decode(trData));
});

const word = (lang: L.Lang) => (w: string) => hasWord(lang, w);
const row = (r: number, c: number, letters: string): L.Placement[] => [...letters].map((ch, k) => ({ i: r * L.SIZE + c + k, ch, blank: false }));
const col = (r: number, c: number, letters: string): L.Placement[] => [...letters].map((ch, k) => ({ i: (r + k) * L.SIZE + c, ch, blank: false }));
function put(board: (L.Cell | null)[], tiles: L.Placement[]) {
  const b = [...board];
  for (const t of tiles) b[t.i] = { ch: t.ch, blank: t.blank, by: 0 };
  return b;
}

describe('Kelime Ustası', () => {
  it('decodes the word lists', () => {
    for (const w of ['hello', 'quiz', 'zebra', 'aa']) expect(hasWord('en', w)).toBe(true);
    for (const w of ['kalem', 'çiçek', 'ağaç', 'ışık', 'göz']) expect(hasWord('tr', w)).toBe(true);
    expect(hasWord('en', 'qzxv')).toBe(false);
  });

  it('has a symmetric bonus layout and 100+ tiles per language', () => {
    for (let i = 0; i < L.SIZE * L.SIZE; i++) {
      const r = Math.floor(i / L.SIZE);
      const c = i % L.SIZE;
      expect(L.PREMIUM[c * L.SIZE + r]).toBe(L.PREMIUM[i]);
      expect(L.PREMIUM[(14 - r) * L.SIZE + c]).toBe(L.PREMIUM[i]);
    }
    expect(L.PREMIUM[L.CENTER]).toBe('dw');
    expect(L.PREMIUM[0]).toBe('dl');
    for (const lang of ['tr', 'en'] as const) expect(L.makeBag(lang, rng()).length).toBeGreaterThanOrEqual(100);
  });

  it('checks placements and scores them', () => {
    const empty: (L.Cell | null)[] = Array(L.SIZE * L.SIZE).fill(null);
    expect(L.evaluate(empty, 'en', row(0, 0, 'cat'), word('en'))).toMatch(/★/);
    // CAT across the center star (double word): (3 + 1 + 1) × 2
    const cat = row(7, 6, 'cat');
    expect(L.evaluate(empty, 'en', cat, word('en'))).toEqual({ score: 10, words: [{ word: 'cat', score: 10 }] });
    expect(L.evaluate(empty, 'en', row(7, 6, 'cxq'), word('en'))).toMatch(/not in the word list/);
    expect(L.evaluate(empty, 'en', [...row(7, 7, 'c'), ...row(7, 9, 't')], word('en'))).toMatch(/no gaps/);
    const b = put(empty, cat);
    // Playing down from the A of CAT makes APE
    const star = col(8, 7, 'pe');
    const ev = L.evaluate(b, 'en', star, word('en'));
    expect(typeof ev).toBe('object');
    expect((ev as L.Evaluation).words.map((w) => w.word)).toEqual(['ape']);
    expect(L.evaluate(b, 'en', row(0, 0, 'dog'), word('en'))).toMatch(/join/);
    // A blank S on the end: CATS scores only the old letters (3 + 1 + 1, no bonus reused)
    const cats = L.evaluate(b, 'en', [{ i: 7 * L.SIZE + 9, ch: 's', blank: true }], word('en'));
    expect(cats).toEqual({ score: 5, words: [{ word: 'cats', score: 5 }] });
  });

  it('all seven tiles earn the bonus', () => {
    const empty: (L.Cell | null)[] = Array(L.SIZE * L.SIZE).fill(null);
    const ev = L.evaluate(empty, 'en', row(7, 4, 'reading'), word('en')) as L.Evaluation;
    expect(ev.score).toBeGreaterThan(L.ALL_SEVEN);
  });

  it('the move finder only finds legal moves, and finds good ones', () => {
    const empty: (L.Cell | null)[] = Array(L.SIZE * L.SIZE).fill(null);
    const moves = findMoves(empty, [...'retains'], 'en', 5000);
    expect(moves.length).toBeGreaterThan(10);
    expect(moves.some((m) => m.tiles.length === 7)).toBe(true);
    for (const m of moves.slice(0, 50)) expect(typeof L.evaluate(empty, 'en', m.tiles, word('en'))).toBe('object');
    const b = put(empty, row(7, 5, 'kalem'));
    const tr = findMoves(b, [...'aerntı?'], 'tr', 5000);
    expect(tr.length).toBeGreaterThan(10);
    for (const m of tr.slice(0, 50)) expect(typeof L.evaluate(b, 'tr', m.tiles, word('tr'))).toBe('object');
  }, 30000);

  for (const lang of ['tr', 'en'] as const) {
    it(`two bots play a whole ${lang} game without illegal moves`, () => {
      const random = rng(lang === 'tr' ? 7 : 11);
      let s = L.setup({ numPlayers: 2, random, options: { lang } });
      let turns = 0;
      while (!L.result(s) && turns < 200) {
        const seat = s.turn;
        const m = bot(L.view(s, seat), seat, { random, level: seat ? 'hard' : 'normal' })!;
        const next = L.move(s, seat, m, { random });
        if (typeof next === 'string') throw new Error(`${next} ${JSON.stringify(m)}`);
        s = next;
        turns++;
      }
      expect(L.result(s)).not.toBeNull();
      expect(s.board.filter(Boolean).length).toBeGreaterThan(40);
    }, 120000);
  }
});
