/**
 * İsim Şehir Hayvan: the pencil-and-paper word race.
 * A letter is drawn; everyone fills each category with a word starting with it.
 * Then everyone reviews the answers and can vote down the bad ones.
 * A unique answer is 10 points, a shared one 5, and 20 if you're the only one with an answer.
 */
import type { GameCtx, GameResult, Seat } from '../../engine/types';
import { shuffle } from '../cards/cards';
import { normalize } from '../draw-guess/words';

const CATS: Record<string, { tr: string[]; en: string[] }> = {
  classic: { tr: ['İsim', 'Şehir', 'Hayvan', 'Bitki', 'Eşya'], en: ['Name', 'City', 'Animal', 'Plant', 'Thing'] },
  more: {
    tr: ['İsim', 'Şehir', 'Hayvan', 'Bitki', 'Eşya', 'Ülke', 'Meslek', 'Yemek'],
    en: ['Name', 'City', 'Animal', 'Plant', 'Thing', 'Country', 'Job', 'Food'],
  },
};
const LETTERS: Record<string, string[]> = {
  tr: 'ABCÇDEFGHIİKLMNOÖPRSŞTUÜVYZ'.split(''),
  en: 'ABCDEFGHIJKLMNOPRSTUVW'.split(''),
};
const REVIEW_MS = 60000;
const SCORES_MS = 8000;
const STOP_GRACE_MS = 5000;

export interface IshState {
  n: number;
  lang: 'tr' | 'en';
  cats: string[];
  rounds: number;
  round: number;
  letters: string[];
  letter: string;
  phase: 'write' | 'review' | 'scores' | 'done';
  answers: string[][];
  /** rejects[seat][cat] = players voting that answer down */
  rejects: Seat[][][];
  ready: boolean[];
  stoppedBy: Seat | null;
  roundPoints: number[][];
  scores: number[];
  writeMs: number;
  deadline: number | null;
}

export type IshMove =
  | { type: 'answers'; answers: string[] }
  | { type: 'stop' }
  | { type: 'veto'; seat: Seat; cat: number }
  | { type: 'ready' };

export interface IshView extends Omit<IshState, 'answers' | 'letters'> {
  me: Seat;
  /** Everyone's answers once writing is over; only mine while writing */
  answers: string[][];
  valid: boolean[][] | null;
}

export function startsWith(text: string, letter: string, lang: string) {
  const t = text.trim();
  if (!t) return false;
  const first = lang === 'tr' ? t[0].toLocaleUpperCase('tr') : t[0].toUpperCase();
  return first === letter;
}

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'random' | 'options' | 'now'>): IshState {
  const lang = ctx.options.lang === 'en' ? 'en' : 'tr';
  const cats = (CATS[ctx.options.cats ?? 'classic'] ?? CATS.classic)[lang];
  const rounds = Number(ctx.options.rounds ?? 5);
  const letters = shuffle(LETTERS[lang], ctx.random).slice(0, rounds);
  const n = ctx.numPlayers;
  const writeMs = Number(ctx.options.time ?? 90) * 1000;
  return {
    n,
    lang,
    cats,
    rounds,
    round: 0,
    letters,
    letter: letters[0],
    phase: 'write',
    answers: Array.from({ length: n }, () => cats.map(() => '')),
    rejects: Array.from({ length: n }, () => cats.map(() => [])),
    ready: Array(n).fill(false),
    stoppedBy: null,
    roundPoints: [],
    scores: Array(n).fill(0),
    writeMs,
    deadline: ctx.now() + writeMs,
  };
}

/** Valid = starts with the letter and not voted down by more than half of the other players */
export function validity(s: IshState): boolean[][] {
  return s.answers.map((row, seat) => row.map((a, c) => startsWith(a, s.letter, s.lang) && s.rejects[seat][c].length * 2 <= s.n - 1));
}

export function score(s: IshState): number[] {
  const valid = validity(s);
  const pts = Array(s.n).fill(0);
  s.cats.forEach((_, c) => {
    const keys = s.answers.map((row, seat) => (valid[seat][c] ? normalize(row[c]) : null));
    const answered = keys.filter((k) => k !== null).length;
    keys.forEach((k, seat) => {
      if (k === null) return;
      if (answered === 1) pts[seat] += 20;
      else pts[seat] += keys.filter((x) => x === k).length > 1 ? 5 : 10;
    });
  });
  return pts;
}

function toReview(s: IshState, now: number): IshState {
  return { ...s, phase: 'review', ready: Array(s.n).fill(false), deadline: now + REVIEW_MS };
}

function toScores(s: IshState, now: number): IshState {
  const pts = score(s);
  return { ...s, phase: 'scores', roundPoints: [...s.roundPoints, pts], scores: s.scores.map((x, i) => x + pts[i]), deadline: now + SCORES_MS };
}

function nextRound(s: IshState, now: number): IshState {
  const round = s.round + 1;
  if (round >= s.rounds) return { ...s, phase: 'done', deadline: null };
  return {
    ...s,
    round,
    letter: s.letters[round],
    phase: 'write',
    answers: Array.from({ length: s.n }, () => s.cats.map(() => '')),
    rejects: Array.from({ length: s.n }, () => s.cats.map(() => [])),
    ready: Array(s.n).fill(false),
    stoppedBy: null,
    deadline: now + s.writeMs,
  };
}

export function activePlayers(s: IshState): Seat[] {
  const all = Array.from({ length: s.n }, (_, i) => i);
  if (s.phase === 'write') return all;
  if (s.phase === 'review') return all.filter((i) => !s.ready[i]);
  return [];
}

export function move(s: IshState, seat: Seat, m: IshMove, ctx: Pick<GameCtx, 'now'>): IshState | string {
  if (s.phase === 'write') {
    if (m.type === 'answers') {
      if (!Array.isArray(m.answers)) return 'Bad answers';
      const row = s.cats.map((_, c) => String(m.answers[c] ?? '').slice(0, 30));
      return { ...s, answers: s.answers.map((r, i) => (i === seat ? row : r)) };
    }
    if (m.type === 'stop') {
      if (s.stoppedBy !== null) return 'Someone already called stop';
      const filled = s.answers[seat].every((a) => startsWith(a, s.letter, s.lang));
      if (!filled) return 'Fill every category with the right letter first';
      return { ...s, stoppedBy: seat, deadline: Math.min(s.deadline ?? Infinity, ctx.now() + STOP_GRACE_MS) };
    }
    return 'Keep writing!';
  }
  if (s.phase === 'review') {
    if (m.type === 'veto') {
      if (m.seat === seat || !Number.isInteger(m.seat) || m.seat < 0 || m.seat >= s.n || !s.cats[m.cat]) return 'You can only vote on other players';
      const list = s.rejects[m.seat][m.cat];
      const next = list.includes(seat) ? list.filter((x) => x !== seat) : [...list, seat];
      const rejects = s.rejects.map((row, i) => (i === m.seat ? row.map((l, c) => (c === m.cat ? next : l)) : row));
      return { ...s, rejects };
    }
    if (m.type === 'ready') {
      const ready = s.ready.map((r, i) => r || i === seat);
      const next = { ...s, ready };
      return ready.every(Boolean) ? toScores(next, ctx.now()) : next;
    }
    return 'Review the answers';
  }
  return 'Wait for the next round';
}

export function onTimer(s: IshState, ctx: GameCtx): IshState {
  if (s.phase === 'write') return toReview(s, ctx.now());
  if (s.phase === 'review') return toScores(s, ctx.now());
  if (s.phase === 'scores') return nextRound(s, ctx.now());
  return s;
}

export function view(s: IshState, seat: Seat): IshView {
  const open = s.phase !== 'write';
  const { letters: _letters, ...rest } = s;
  return {
    ...rest,
    me: seat,
    answers: open ? s.answers : s.answers.map((row, i) => (i === seat ? row : row.map(() => ''))),
    valid: open ? validity(s) : null,
  };
}

export function result(s: IshState): GameResult | null {
  if (s.phase !== 'done') return null;
  const best = Math.max(...s.scores);
  return { winners: s.scores.map((x, i) => (x === best ? i : -1)).filter((i) => i >= 0) };
}
