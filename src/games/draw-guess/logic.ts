/**
 * Draw & Guess. Players take turns drawing a secret word; the others type guesses.
 * Faster correct guesses score more; the drawer scores for each player who gets it.
 */
import type { GameCtx, GameResult, Seat } from '../../engine/types';
import { distance, normalize, wordList } from './words';

export const CANVAS_W = 1000;
export const CANVAS_H = 700;
const CHOOSE_MS = 15000;
const REVEAL_MS = 6000;

export interface Stroke {
  color: string;
  size: number;
  /** Flat list x0,y0,x1,y1… in canvas units */
  pts: number[];
}

export interface ChatLine {
  seat: Seat;
  text: string;
  kind: 'guess' | 'correct' | 'close' | 'system';
  /** Only shown to this seat (e.g. "close!" hints) */
  onlyFor?: Seat;
}

export interface DGState {
  n: number;
  lang: string;
  drawSeconds: number;
  totalTurns: number;
  turnNo: number;
  drawer: Seat;
  phase: 'choose' | 'draw' | 'reveal' | 'done';
  choices: string[];
  word: string;
  strokes: Stroke[];
  guessed: Seat[];
  scores: number[];
  gained: number[];
  chat: ChatLine[];
  deadline: number;
  used: string[];
}

export interface DGView {
  n: number;
  me: Seat;
  drawer: Seat;
  phase: DGState['phase'];
  turnNo: number;
  totalTurns: number;
  choices: string[];
  /** The word for the drawer / after reveal; otherwise underscores */
  word: string;
  hint: string;
  strokes: Stroke[];
  guessed: Seat[];
  scores: number[];
  gained: number[];
  chat: ChatLine[];
  deadline: number;
  drawSeconds: number;
}

export type DGMove =
  | { type: 'choose'; i: number }
  | { type: 'stroke'; stroke: Stroke }
  | { type: 'undo' }
  | { type: 'clear' }
  | { type: 'guess'; text: string };

const COLORS_OK = /^#[0-9a-f]{6}$/i;

function pickChoices(s: Pick<DGState, 'lang' | 'used'>, random: () => number): string[] {
  const pool = wordList(s.lang).filter((w) => !s.used.includes(w));
  const src = pool.length >= 3 ? pool : wordList(s.lang);
  const out: string[] = [];
  while (out.length < 3) {
    const w = src[Math.floor(random() * src.length)];
    if (!out.includes(w)) out.push(w);
  }
  return out;
}

function startTurn(s: DGState, turnNo: number, ctx: Pick<GameCtx, 'random' | 'now'>): DGState {
  if (turnNo >= s.totalTurns) return { ...s, phase: 'done', turnNo };
  const drawer = turnNo % s.n;
  return {
    ...s,
    turnNo,
    drawer,
    phase: 'choose',
    choices: pickChoices(s, ctx.random),
    word: '',
    strokes: [],
    guessed: [],
    gained: Array(s.n).fill(0),
    deadline: ctx.now() + CHOOSE_MS,
  };
}

export function setup(ctx: GameCtx): DGState {
  const n = ctx.numPlayers;
  const base: DGState = {
    n,
    lang: ctx.options.lang ?? 'tr',
    drawSeconds: Number(ctx.options.time) || 80,
    totalTurns: n * (Number(ctx.options.rounds) || 1),
    turnNo: 0,
    drawer: 0,
    phase: 'choose',
    choices: [],
    word: '',
    strokes: [],
    guessed: [],
    scores: Array(n).fill(0),
    gained: Array(n).fill(0),
    chat: [],
    deadline: 0,
    used: [],
  };
  return startTurn(base, 0, ctx);
}

function choose(s: DGState, i: number, now: number): DGState {
  const word = s.choices[i] ?? s.choices[0];
  return { ...s, word, phase: 'draw', used: [...s.used, word], deadline: now + s.drawSeconds * 1000 };
}

function reveal(s: DGState, now: number): DGState {
  return {
    ...s,
    phase: 'reveal',
    deadline: now + REVEAL_MS,
    chat: [...s.chat, { seat: s.drawer, text: `The word was “${s.word}”.`, kind: 'system' as const }].slice(-60),
  };
}

export function move(s: DGState, seat: Seat, m: DGMove, ctx: Pick<GameCtx, 'now'>): DGState | string {
  const now = ctx.now();
  switch (m?.type) {
    case 'choose':
      if (s.phase !== 'choose' || seat !== s.drawer) return 'Not your turn to choose';
      return choose(s, Number(m.i) || 0, now);
    case 'stroke': {
      if (s.phase !== 'draw' || seat !== s.drawer) return 'Only the drawer can draw';
      const st = m.stroke;
      if (!st || !Array.isArray(st.pts) || st.pts.length < 2 || st.pts.length > 2000 || !COLORS_OK.test(st.color)) return 'Bad stroke';
      const pts = st.pts.map((v) => Math.max(0, Math.min(CANVAS_W, Math.round(Number(v) || 0))));
      const size = Math.max(1, Math.min(60, Number(st.size) || 6));
      if (s.strokes.length > 3000) return 'Too many strokes';
      return { ...s, strokes: [...s.strokes, { color: st.color, size, pts }] };
    }
    case 'undo':
      if (s.phase !== 'draw' || seat !== s.drawer) return 'Only the drawer can undo';
      return { ...s, strokes: s.strokes.slice(0, -1) };
    case 'clear':
      if (s.phase !== 'draw' || seat !== s.drawer) return 'Only the drawer can clear';
      return { ...s, strokes: [] };
    case 'guess': {
      if (s.phase !== 'draw') return 'Not guessing time';
      if (seat === s.drawer) return 'You are drawing!';
      if (s.guessed.includes(seat)) return 'You already got it';
      const text = String(m.text ?? '').slice(0, 60).trim();
      if (!text) return 'Type a guess';
      const g = normalize(text);
      const w = normalize(s.word);
      if (g === w) {
        const left = Math.max(0, s.deadline - now) / (s.drawSeconds * 1000);
        const pts = Math.max(20, Math.round(50 + 100 * left)) - s.guessed.length * 5;
        const scores = s.scores.slice();
        const gained = s.gained.slice();
        scores[seat] += pts;
        gained[seat] += pts;
        scores[s.drawer] += 25;
        gained[s.drawer] += 25;
        const guessed = [...s.guessed, seat];
        const chat = [...s.chat, { seat, text: 'guessed the word!', kind: 'correct' as const }].slice(-60);
        const ns = { ...s, scores, gained, guessed, chat };
        if (guessed.length >= s.n - 1) return reveal(ns, now);
        return ns;
      }
      const close = w.length > 3 && distance(g, w) === 1;
      const chat: ChatLine[] = [...s.chat, { seat, text, kind: 'guess' as const }];
      if (close) chat.push({ seat, text: `“${text}” is close!`, kind: 'close', onlyFor: seat });
      return { ...s, chat: chat.slice(-60) };
    }
  }
  return 'Unknown move';
}

export function onTimer(s: DGState, ctx: GameCtx): DGState {
  const now = ctx.now();
  if (s.phase === 'choose') return choose(s, Math.floor(ctx.random() * 3), now);
  if (s.phase === 'draw') return reveal(s, now);
  if (s.phase === 'reveal') return startTurn(s, s.turnNo + 1, ctx);
  return s;
}

export function activePlayers(s: DGState): Seat[] {
  if (s.phase === 'choose') return [s.drawer];
  if (s.phase === 'draw') return Array.from({ length: s.n }, (_, i) => i).filter((i) => i === s.drawer || !s.guessed.includes(i));
  return [];
}

function hintFor(word: string): string {
  return [...word].map((ch) => (ch === ' ' ? '  ' : '_')).join(' ');
}

export function view(s: DGState, seat: Seat): DGView {
  const isDrawer = seat === s.drawer;
  const knows = isDrawer || s.phase === 'reveal' || s.phase === 'done' || s.guessed.includes(seat);
  return {
    n: s.n,
    me: seat,
    drawer: s.drawer,
    phase: s.phase,
    turnNo: s.turnNo,
    totalTurns: s.totalTurns,
    choices: isDrawer && s.phase === 'choose' ? s.choices : [],
    word: knows ? s.word : '',
    hint: hintFor(s.word),
    strokes: s.strokes,
    guessed: s.guessed,
    scores: s.scores,
    gained: s.gained,
    chat: s.chat.filter((c) => c.onlyFor === undefined || c.onlyFor === seat),
    deadline: s.deadline,
    drawSeconds: s.drawSeconds,
  };
}

export function result(s: DGState): GameResult | null {
  if (s.phase !== 'done') return null;
  const best = Math.max(...s.scores);
  return { winners: s.scores.map((x, i) => (x === best ? i : -1)).filter((i) => i >= 0) };
}
