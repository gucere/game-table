/**
 * Beş Harf: guess the hidden five-letter word in six tries. After each guess every letter is
 * marked: right letter in the right place, in the word but elsewhere, or not in the word.
 * Several players can race on the same word; they see each other's colors, never the letters.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';
import { ANSWERS } from './answers';

export type Lang = 'tr' | 'en';
/** g = right place, y = elsewhere in the word, x = not in the word */
export type Mark = 'g' | 'y' | 'x';
export const LETTERS = 5;
export const TRIES = 6;
export const ALPHABET: Record<Lang, string> = { tr: 'abcçdefgğhıijklmnoöprsştuüvyz', en: 'abcdefghijklmnopqrstuvwxyz' };

export interface FiveState {
  n: number;
  lang: Lang;
  answer: string;
  /** Daily puzzle number, or null for a random word */
  day: number | null;
  guesses: string[][];
  /** Time each player finished (solved or out of tries) */
  doneAt: (number | null)[];
}
export type FiveMove = { type: 'guess'; word: string };
export interface FiveView {
  n: number;
  lang: Lang;
  day: number | null;
  me: Seat;
  /** My own guesses with their letters */
  mine: string[];
  /** Everyone's marks (letters of other players stay hidden) */
  marks: Mark[][][];
  solved: boolean[];
  done: boolean[];
  /** Shown once I'm finished */
  answer: string | null;
  over: boolean;
}

export function lower(lang: Lang, s: string) {
  return lang === 'tr' ? s.replace(/I/g, 'ı').replace(/İ/g, 'i').toLocaleLowerCase('tr') : s.toLowerCase();
}

export function score(guess: string, answer: string): Mark[] {
  const g = [...guess];
  const a = [...answer];
  const marks: Mark[] = g.map((ch, i) => (ch === a[i] ? 'g' : 'x'));
  const left = new Map<string, number>();
  a.forEach((ch, i) => marks[i] !== 'g' && left.set(ch, (left.get(ch) ?? 0) + 1));
  g.forEach((ch, i) => {
    if (marks[i] === 'g') return;
    const k = left.get(ch) ?? 0;
    if (k > 0) {
      marks[i] = 'y';
      left.set(ch, k - 1);
    }
  });
  return marks;
}

/** Days since 1 Jan 2026 in the player's own time zone */
export function dayNumber(now = new Date()) {
  return Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(2026, 0, 1)) / 86400000);
}

/** The same word for everyone on a given day: answers walked in a fixed shuffled order */
export function dailyWord(lang: Lang, day: number) {
  const list = ANSWERS[lang];
  // A step coprime with the list length visits every word before repeating
  let step = 7919 % list.length || 1;
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  while (gcd(step, list.length) !== 1) step++;
  return list[(((day * step + 13) % list.length) + list.length) % list.length];
}

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'random' | 'options'>): FiveState {
  const lang: Lang = ctx.options.lang === 'en' ? 'en' : 'tr';
  const daily = ctx.options.mode === 'daily';
  const day = daily ? dayNumber() : null;
  const list = ANSWERS[lang];
  return {
    n: ctx.numPlayers,
    lang,
    answer: day !== null ? dailyWord(lang, day) : list[Math.floor(ctx.random() * list.length)],
    day,
    guesses: Array.from({ length: ctx.numPlayers }, () => []),
    doneAt: Array(ctx.numPlayers).fill(null),
  };
}

export function move(s: FiveState, seat: Seat, m: FiveMove, ctx: Pick<GameCtx, 'now'>): FiveState | string {
  if (s.doneAt[seat] !== null) return 'You have finished: wait for the others';
  if (m?.type !== 'guess' || typeof m.word !== 'string') return 'Type a word';
  const word = lower(s.lang, m.word.trim());
  if ([...word].length !== LETTERS) return 'Use five letters';
  if (![...word].every((ch) => ALPHABET[s.lang].includes(ch))) return 'Letters only';
  const mine = [...s.guesses[seat], word];
  const finished = word === s.answer || mine.length >= TRIES;
  return {
    ...s,
    guesses: s.guesses.map((g, i) => (i === seat ? mine : g)),
    doneAt: s.doneAt.map((d, i) => (i === seat && finished ? ctx.now() : d)),
  };
}

export const solvedBy = (s: Pick<FiveState, 'guesses' | 'answer'>, seat: Seat) => s.guesses[seat].includes(s.answer);
export const activePlayers = (s: FiveState): Seat[] => s.doneAt.flatMap((d, i) => (d === null ? [i] : []));

export function view(s: FiveState, seat: Seat): FiveView {
  const over = s.doneAt.every((d) => d !== null);
  return {
    n: s.n,
    lang: s.lang,
    day: s.day,
    me: seat,
    mine: s.guesses[seat] ?? [],
    marks: s.guesses.map((gs) => gs.map((g) => score(g, s.answer))),
    solved: s.guesses.map((_, i) => solvedBy(s, i)),
    done: s.doneAt.map((d) => d !== null),
    answer: over || s.doneAt[seat] !== null ? s.answer : null,
    over,
  };
}

/** Fewest guesses wins; a tie goes to whoever finished first */
export function result(s: FiveState): GameResult | null {
  if (!s.doneAt.every((d) => d !== null)) return null;
  const solvers = s.guesses.flatMap((_g, i) => (solvedBy(s, i) ? [i] : []));
  if (!solvers.length) return { winners: [], draw: true, message: `The word was ${s.answer.toLocaleUpperCase(s.lang === 'tr' ? 'tr' : 'en')}.` };
  const fewest = Math.min(...solvers.map((i) => s.guesses[i].length));
  const best = solvers.filter((i) => s.guesses[i].length === fewest);
  const first = Math.min(...best.map((i) => s.doneAt[i]!));
  return { winners: best.filter((i) => s.doneAt[i] === first) };
}

/** Does `word` fit everything my earlier guesses showed? */
export function fits(word: string, guesses: string[], marks: Mark[][]) {
  return guesses.every((g, k) => score(g, word).join('') === marks[k].join(''));
}

const START: Record<Lang, string[]> = { tr: ['kalem', 'sabah', 'deniz', 'tarak', 'masal'], en: ['slate', 'crane', 'train', 'heart', 'stone'] };

/** Bots only know the answer list. Easy guesses loosely, normal and hard keep to every clue */
export function bot(v: FiveView, seat: Seat, ctx: BotCtx): FiveMove {
  const list = ANSWERS[v.lang];
  const marks = v.marks[seat] ?? [];
  if (!v.mine.length) return { type: 'guess', word: START[v.lang][Math.floor(ctx.random() * START[v.lang].length)] };
  let pool = list.filter((w) => !v.mine.includes(w) && fits(w, v.mine, marks));
  if (ctx.level === 'easy' && ctx.random() < 0.5) {
    // Only trust the greens
    pool = list.filter((w) => !v.mine.includes(w) && v.mine.every((g, k) => marks[k].every((mk, i) => mk !== 'g' || w[i] === g[i])));
  }
  if (!pool.length) pool = list.filter((w) => !v.mine.includes(w));
  if (ctx.level === 'hard' && pool.length > 2) {
    // Prefer words with many common, different letters among the remaining candidates
    const freq = new Map<string, number>();
    for (const w of pool) for (const ch of new Set(w)) freq.set(ch, (freq.get(ch) ?? 0) + 1);
    const value = (w: string) => [...new Set(w)].reduce((a, ch) => a + (freq.get(ch) ?? 0), 0);
    pool.sort((a, b) => value(b) - value(a));
    pool = pool.slice(0, 3);
  }
  return { type: 'guess', word: pool[Math.floor(ctx.random() * pool.length)] };
}
