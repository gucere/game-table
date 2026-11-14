/**
 * Adam Asmaca (hangman). Guess the hidden word letter by letter before the drawing is finished.
 * The word comes from the computer, or players take turns choosing one for the others.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';
import { wordList } from '../draw-guess/words';

export const ALPHABET: Record<string, string[]> = {
  tr: 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ'.split(''),
  en: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
};
/** Rough letter frequency order, for bots */
const FREQ: Record<string, string> = { tr: 'AEİNRLIKDMYUTSBOÜŞZGÇHĞVCÖPFJ', en: 'EARIOTNSLCUDPMHGBFYWKVXZJQ' };
export const MAX_WRONG = 8;
const REVEAL_MS = 4000;

export const upper = (s: string, lang: string) => (lang === 'tr' ? s.toLocaleUpperCase('tr') : s.toUpperCase());

export function words(lang: string) {
  return wordList(lang)
    .filter((w) => !w.includes(' ') && w.length >= 4)
    .map((w) => upper(w, lang));
}

export interface HangState {
  n: number;
  lang: string;
  mode: 'computer' | 'players';
  rounds: number;
  round: number;
  setter: Seat | null;
  phase: 'set' | 'guess' | 'reveal' | 'done';
  word: string;
  guessed: string[];
  wrong: number;
  turn: Seat;
  scores: number[];
  solved: number;
  outcome: 'solved' | 'hanged' | null;
  deadline: number | null;
  used: string[];
}

export type HangMove = { type: 'set'; word: string } | { type: 'letter'; letter: string } | { type: 'solve'; word: string };

export interface HangView extends Omit<HangState, 'word' | 'used'> {
  me: Seat;
  /** The word with unguessed letters as null (the full word for its setter, or after the round) */
  mask: (string | null)[];
  word: string | null;
}

function newRound(s: HangState, round: number, random: () => number): HangState {
  const setter = s.mode === 'players' ? ((round % s.n) as Seat) : null;
  const base: HangState = { ...s, round, setter, guessed: [], wrong: 0, outcome: null, deadline: null, word: '' };
  const firstGuesser = setter === null ? ((round % s.n) as Seat) : (((setter + 1) % s.n) as Seat);
  if (setter !== null) return { ...base, phase: 'set', turn: setter };
  const pool = words(s.lang).filter((w) => !s.used.includes(w));
  const word = pool[Math.floor(random() * pool.length)] ?? words(s.lang)[0];
  return { ...base, phase: 'guess', word, used: [...s.used, word], turn: firstGuesser };
}

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'random' | 'options'>): HangState {
  const n = ctx.numPlayers;
  const s: HangState = {
    n,
    lang: ctx.options.lang === 'en' ? 'en' : 'tr',
    mode: ctx.options.mode === 'players' && n > 1 ? 'players' : 'computer',
    rounds: Number(ctx.options.rounds ?? 5),
    round: 0,
    setter: null,
    phase: 'guess',
    word: '',
    guessed: [],
    wrong: 0,
    turn: 0,
    scores: Array(n).fill(0),
    solved: 0,
    outcome: null,
    deadline: null,
    used: [],
  };
  // With players choosing, everyone gets the same number of turns choosing
  if (s.mode === 'players') s.rounds = Math.max(n, Math.ceil(s.rounds / n) * n);
  return newRound(s, 0, ctx.random);
}

const isGuesser = (s: HangState, seat: Seat) => seat !== s.setter;
function nextGuesser(s: HangState, from: Seat): Seat {
  for (let k = 1; k <= s.n; k++) {
    const t = ((from + k) % s.n) as Seat;
    if (isGuesser(s, t)) return t;
  }
  return from;
}

const complete = (s: HangState) => s.word.split('').every((ch) => s.guessed.includes(ch));

function finishRound(s: HangState, outcome: 'solved' | 'hanged', now: number): HangState {
  const scores = s.scores.slice();
  if (outcome === 'hanged' && s.setter !== null) scores[s.setter] += 50;
  return { ...s, scores, outcome, solved: s.solved + (outcome === 'solved' ? 1 : 0), phase: 'reveal', deadline: now + REVEAL_MS };
}

export function move(s: HangState, seat: Seat, m: HangMove, ctx: Pick<GameCtx, 'now' | 'random'>): HangState | string {
  if (seat !== s.turn) return 'Not your turn';
  if (s.phase === 'set') {
    if (m.type !== 'set') return 'Choose a word';
    const w = upper(String(m.word ?? '').trim(), s.lang);
    if (w.length < 3 || w.length > 16) return 'Use a word of 3 to 16 letters';
    if (!w.split('').every((ch) => ALPHABET[s.lang].includes(ch))) return 'Letters only, no spaces';
    return { ...s, word: w, phase: 'guess', turn: nextGuesser(s, seat) };
  }
  if (s.phase !== 'guess') return 'Wait for the next round';
  if (m.type === 'letter') {
    const L = upper(String(m.letter ?? ''), s.lang);
    if (!ALPHABET[s.lang].includes(L)) return 'Pick a letter';
    if (s.guessed.includes(L)) return 'Already guessed';
    const hits = s.word.split('').filter((ch) => ch === L).length;
    const scores = s.scores.slice();
    scores[seat] += hits * 10;
    const next: HangState = { ...s, guessed: [...s.guessed, L], scores, wrong: s.wrong + (hits ? 0 : 1) };
    if (hits && complete(next)) {
      next.scores[seat] += 20;
      return finishRound(next, 'solved', ctx.now());
    }
    if (!hits && next.wrong >= MAX_WRONG) return finishRound(next, 'hanged', ctx.now());
    return hits ? next : { ...next, turn: nextGuesser(s, seat) };
  }
  if (m.type === 'solve') {
    const w = upper(String(m.word ?? '').trim(), s.lang);
    if (!w) return 'Type the word';
    if (w === s.word) {
      const hidden = s.word.split('').filter((ch) => !s.guessed.includes(ch)).length;
      const scores = s.scores.slice();
      scores[seat] += hidden * 5 + 20;
      return finishRound({ ...s, scores, guessed: [...new Set([...s.guessed, ...s.word.split('')])] }, 'solved', ctx.now());
    }
    const next = { ...s, wrong: s.wrong + 1 };
    if (next.wrong >= MAX_WRONG) return finishRound(next, 'hanged', ctx.now());
    return { ...next, turn: nextGuesser(s, seat) };
  }
  return 'Guess a letter';
}

export function onTimer(s: HangState, ctx: GameCtx): HangState {
  if (s.phase !== 'reveal') return s;
  const round = s.round + 1;
  if (round >= s.rounds) return { ...s, phase: 'done', deadline: null };
  return newRound(s, round, ctx.random);
}

export const activePlayers = (s: HangState): Seat[] => (s.phase === 'set' || s.phase === 'guess' ? [s.turn] : []);

export function view(s: HangState, seat: Seat): HangView {
  const open = s.phase === 'reveal' || s.phase === 'done' || seat === s.setter;
  const { used: _used, ...rest } = s;
  return {
    ...rest,
    me: seat,
    word: open ? s.word : null,
    mask: s.word.split('').map((ch) => (open || s.guessed.includes(ch) ? ch : null)),
  };
}

export function result(s: HangState): GameResult | null {
  if (s.phase !== 'done') return null;
  if (s.n === 1) return { winners: [0], message: `You solved ${s.solved} of ${s.rounds} words · ${s.scores[0]} points` };
  const best = Math.max(...s.scores);
  return { winners: s.scores.map((x, i) => (x === best ? i : -1)).filter((i) => i >= 0) };
}

export function bot(v: HangView, _seat: Seat, ctx: BotCtx): HangMove {
  const list = words(v.lang);
  if (v.phase === 'set') return { type: 'set', word: list[Math.floor(ctx.random() * list.length)] };
  const left = ALPHABET[v.lang].filter((l) => !v.guessed.includes(l));
  if (ctx.level === 'easy') {
    const common = FREQ[v.lang].split('').filter((l) => left.includes(l)).slice(0, 10);
    return { type: 'letter', letter: common[Math.floor(ctx.random() * common.length)] ?? left[0] };
  }
  // Words from the list that fit what we know so far
  const wrongLetters = v.guessed.filter((l) => !v.mask.includes(l));
  const cands = list.filter(
    (w) => w.length === v.mask.length && v.mask.every((ch, i) => (ch === null ? !v.guessed.includes(w[i]) : w[i] === ch)) && !wrongLetters.some((l) => w.includes(l)),
  );
  if (cands.length === 1 && ctx.level === 'hard') return { type: 'solve', word: cands[0] };
  if (cands.length) {
    const count = new Map<string, number>();
    for (const w of cands) for (const ch of new Set(w.split(''))) if (left.includes(ch)) count.set(ch, (count.get(ch) ?? 0) + 1);
    const best = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) return { type: 'letter', letter: best[0] };
  }
  const byFreq = FREQ[v.lang].split('').find((l) => left.includes(l));
  return { type: 'letter', letter: byFreq ?? left[0] };
}
