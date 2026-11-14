/**
 * Bilgi Yarışı: everyone answers the same multiple-choice question at once; right answers
 * score more the faster they come. Questions come from the built-in bank, the host's own
 * pack, or (party mode) from the players themselves.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';
import { shuffle } from '../cards/cards';
import { cleanQ, loadPack } from './pack';
import { BUILTIN, type RawQ } from './questions';

export const ANSWER_MS = 20000;
export const REVEAL_MS = 5000;

export interface Question {
  q: string;
  choices: string[];
  correct: number;
  /** Seat that wrote it (they sit that one out), or null */
  by: Seat | null;
}

export interface TriviaState {
  n: number;
  lang: 'tr' | 'en';
  phase: 'write' | 'ask' | 'reveal' | 'done';
  /** Party mode: how many questions each player writes */
  perPlayer: number;
  written: (RawQ[] | null)[];
  questions: Question[];
  round: number;
  askedAt: number;
  answers: ({ pick: number; ms: number } | null)[];
  gained: number[];
  scores: number[];
  deadline: number | null;
}

export type TriviaMove = { type: 'answer'; pick: number } | { type: 'write'; questions: RawQ[] };

export interface TriviaView {
  n: number;
  me: Seat;
  lang: 'tr' | 'en';
  phase: TriviaState['phase'];
  perPlayer: number;
  wroteCount: number;
  iWrote: boolean;
  round: number;
  total: number;
  question: Omit<Question, 'correct'> & { correct: number | null };
  /** My pick, and everyone's picks after the reveal */
  answers: (number | null)[];
  answered: boolean[];
  gained: number[];
  scores: number[];
  deadline: number | null;
}

function toQuestion(raw: RawQ, by: Seat | null, random: () => number): Question {
  const [q, right, ...wrong] = raw;
  const choices = shuffle([right, ...wrong], random);
  return { q, choices, correct: choices.indexOf(right), by };
}

export interface SetupExtras {
  /** Questions to use for "my questions" (defaults to the pack saved in this browser) */
  pack?: RawQ[];
}

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'random' | 'options' | 'now'>, extras: SetupExtras = {}): TriviaState {
  const lang = ctx.options.lang === 'en' ? 'en' : 'tr';
  const source = ctx.options.source ?? 'builtin';
  const count = Number(ctx.options.count ?? 10);
  const perPlayer = Number(ctx.options.perPlayer ?? 2);
  const base: Omit<TriviaState, 'phase' | 'questions'> = {
    n: ctx.numPlayers,
    lang,
    perPlayer,
    written: Array(ctx.numPlayers).fill(null),
    round: 0,
    askedAt: 0,
    answers: Array(ctx.numPlayers).fill(null),
    gained: Array(ctx.numPlayers).fill(0),
    scores: Array(ctx.numPlayers).fill(0),
    deadline: null,
  };
  if (source === 'players') return { ...base, phase: 'write', questions: [] };
  const mine = source === 'mine' || source === 'mix' ? (extras.pack ?? loadPack()) : [];
  let pool: RawQ[] = source === 'mine' ? mine : source === 'mix' ? [...mine, ...BUILTIN[lang]] : BUILTIN[lang];
  if (!pool.length) pool = BUILTIN[lang];
  const picked = shuffle(pool, ctx.random).slice(0, count);
  return startQuestion({ ...base, phase: 'ask', questions: picked.map((r) => toQuestion(r, null, ctx.random)) }, ctx.now());
}

const current = (s: TriviaState) => s.questions[s.round];

/** Players who should answer the current question (not its author) */
const answering = (s: TriviaState) => Array.from({ length: s.n }, (_, i) => i).filter((i) => current(s)?.by !== i);

export function activePlayers(s: TriviaState): Seat[] {
  if (s.phase === 'write') return s.written.flatMap((w, i) => (w ? [] : [i]));
  if (s.phase === 'ask') return answering(s).filter((i) => s.answers[i] === null);
  return [];
}

function startQuestion(s: TriviaState, now: number): TriviaState {
  return { ...s, phase: 'ask', askedAt: now, answers: Array(s.n).fill(null), gained: Array(s.n).fill(0), deadline: now + ANSWER_MS };
}

/** Right answers score 500, plus up to 500 more for speed */
export function points(ms: number) {
  return 500 + Math.round(500 * Math.max(0, 1 - ms / ANSWER_MS));
}

function reveal(s: TriviaState, now: number): TriviaState {
  const q = current(s);
  const gained = s.answers.map((a) => (a && a.pick === q.correct ? points(a.ms) : 0));
  return { ...s, phase: 'reveal', gained, scores: s.scores.map((x, i) => x + gained[i]), deadline: now + REVEAL_MS };
}

export function move(s: TriviaState, seat: Seat, m: TriviaMove, ctx: Pick<GameCtx, 'now' | 'random'>): TriviaState | string {
  if (s.phase === 'write') {
    if (m?.type !== 'write') return 'Write your questions first';
    if (s.written[seat]) return 'You already sent your questions';
    const qs = (Array.isArray(m.questions) ? m.questions : []).map(cleanQ).filter((q): q is RawQ => !!q);
    if (qs.length < s.perPlayer) return 'Fill in every question, its answer and at least one wrong answer';
    const written = s.written.map((w, i) => (i === seat ? qs.slice(0, s.perPlayer) : w));
    if (written.some((w) => !w)) return { ...s, written };
    const all = written.flatMap((w, i) => w!.map((r) => toQuestion(r, i, ctx.random)));
    return startQuestion({ ...s, written, questions: shuffle(all, ctx.random), round: 0 }, ctx.now());
  }
  if (s.phase !== 'ask') return 'Wait for the next question';
  if (m?.type !== 'answer') return 'Pick an answer';
  const q = current(s);
  if (q.by === seat) return 'You wrote this one: let the others answer';
  if (s.answers[seat]) return 'You already answered';
  if (!Number.isInteger(m.pick) || m.pick < 0 || m.pick >= q.choices.length) return 'Pick an answer';
  const answers = s.answers.map((a, i) => (i === seat ? { pick: m.pick, ms: Math.max(0, ctx.now() - s.askedAt) } : a));
  const next = { ...s, answers };
  return answering(s).every((i) => answers[i]) ? reveal(next, ctx.now()) : next;
}

export function onTimer(s: TriviaState, ctx: Pick<GameCtx, 'now'>): TriviaState {
  if (s.phase === 'ask') return reveal(s, ctx.now());
  if (s.phase !== 'reveal') return s;
  if (s.round + 1 >= s.questions.length) return { ...s, phase: 'done', deadline: null };
  return startQuestion({ ...s, round: s.round + 1 }, ctx.now());
}

export const timer = (s: TriviaState) => s.deadline;

export function view(s: TriviaState, seat: Seat): TriviaView {
  const q = current(s) ?? { q: '', choices: [], correct: 0, by: null };
  const open = s.phase === 'reveal' || s.phase === 'done';
  return {
    n: s.n,
    me: seat,
    lang: s.lang,
    phase: s.phase,
    perPlayer: s.perPlayer,
    wroteCount: s.written.filter(Boolean).length,
    iWrote: !!s.written[seat],
    round: s.round,
    total: s.questions.length,
    question: { q: q.q, choices: q.choices, by: q.by, correct: open ? q.correct : null },
    answers: s.answers.map((a, i) => (a && (open || i === seat) ? a.pick : null)),
    answered: s.answers.map((a) => !!a),
    gained: s.gained,
    scores: s.scores,
    deadline: s.deadline,
  };
}

export function result(s: TriviaState): GameResult | null {
  if (s.phase !== 'done') return null;
  const best = Math.max(...s.scores);
  return { winners: s.scores.flatMap((x, i) => (x === best ? [i] : [])) };
}

/** Bots know the built-in questions (better at higher levels) and guess on everyone else's */
const KNOWN = new Map<string, string>([...BUILTIN.tr, ...BUILTIN.en].map((r) => [r[0], r[1]]));

export function bot(v: TriviaView, _seat: Seat, ctx: BotCtx): TriviaMove {
  if (v.phase === 'write') {
    const pool = BUILTIN[v.lang];
    return { type: 'write', questions: Array.from({ length: v.perPlayer }, () => pool[Math.floor(ctx.random() * pool.length)]) };
  }
  const { q, choices } = v.question;
  const right = KNOWN.get(q);
  const skill = ctx.level === 'hard' ? 0.85 : ctx.level === 'normal' ? 0.65 : 0.45;
  if (right && ctx.random() < skill) return { type: 'answer', pick: choices.indexOf(right) };
  return { type: 'answer', pick: Math.floor(ctx.random() * choices.length) };
}
