/**
 * Kulaktan Kulağa Çizim: everyone writes a phrase; it travels around the table, drawn by the
 * next player, guessed from the drawing by the one after, drawn again… Each chain gets one
 * entry from every player. At the end the chains are shown step by step.
 */
import type { GameCtx, GameResult, Seat } from '../../engine/types';
import { CANVAS_H, CANVAS_W, type Stroke } from '../draw-guess/logic';

export type { Stroke };

export interface Entry {
  by: Seat;
  text?: string;
  strokes?: Stroke[];
}

export type Kind = 'write' | 'draw' | 'guess';

export interface PhoneState {
  n: number;
  lang: 'tr' | 'en';
  phase: 'play' | 'reveal' | 'done';
  step: number;
  /** Chain k was started by player k */
  chains: Entry[][];
  /** Who has handed in this step */
  done: boolean[];
  deadline: number;
  writeSecs: number;
  drawSecs: number;
  show: { chain: number; upto: number };
}

export interface PhoneView {
  n: number;
  lang: 'tr' | 'en';
  phase: PhoneState['phase'];
  step: number;
  kind: Kind;
  deadline: number;
  doneCount: number;
  mineDone: boolean;
  /** What you're working from: the previous entry of the chain you hold */
  prompt: Entry | null;
  /** Reveal: whose chain, and its entries shown so far */
  show: { chain: number; upto: number; entries: Entry[] } | null;
}

export type PhoneMove = { type: 'text'; text: string } | { type: 'draw'; strokes: Stroke[] } | { type: 'next' };

export const MAX_TEXT = 80;
const MAX_STROKES = 400;
const MAX_NUMBERS = 12000;
const COLOR = /^#[0-9a-f]{6}$/i;

export const kindOf = (step: number): Kind => (step === 0 ? 'write' : step % 2 === 1 ? 'draw' : 'guess');
/** The chain a player works on at a step */
export const chainFor = (seat: Seat, step: number, n: number) => (((seat - step) % n) + n) % n;

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'options' | 'now'>): PhoneState {
  const n = ctx.numPlayers;
  const drawSecs = Math.max(30, Number(ctx.options.time) || 90);
  return {
    n,
    lang: ctx.options.lang === 'en' ? 'en' : 'tr',
    phase: 'play',
    step: 0,
    chains: Array.from({ length: n }, () => []),
    done: Array(n).fill(false),
    deadline: ctx.now() + 60000,
    writeSecs: 45,
    drawSecs,
    show: { chain: 0, upto: 0 },
  };
}

/** Checks and shrinks a drawing: drops points that barely move */
export function cleanDrawing(raw: unknown): Stroke[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_STROKES) return null;
  const out: Stroke[] = [];
  let numbers = 0;
  for (const st of raw as Stroke[]) {
    if (!st || !Array.isArray(st.pts) || st.pts.length < 2 || typeof st.color !== 'string' || !COLOR.test(st.color)) return null;
    const size = Math.max(1, Math.min(60, Number(st.size) || 6));
    const pts: number[] = [];
    for (let i = 0; i + 1 < st.pts.length; i += 2) {
      const x = Math.max(0, Math.min(CANVAS_W, Math.round(Number(st.pts[i]) || 0)));
      const y = Math.max(0, Math.min(CANVAS_H, Math.round(Number(st.pts[i + 1]) || 0)));
      const n = pts.length;
      if (n >= 2 && i + 2 < st.pts.length && Math.abs(pts[n - 2] - x) + Math.abs(pts[n - 1] - y) < 4) continue;
      pts.push(x, y);
    }
    numbers += pts.length;
    if (numbers > MAX_NUMBERS) return null;
    out.push({ color: st.color, size, pts });
  }
  return out;
}

function advance(s: PhoneState, now: number): PhoneState {
  const step = s.step + 1;
  if (step >= s.n) return { ...s, phase: 'reveal', step, done: Array(s.n).fill(false), show: { chain: 0, upto: 0 } };
  return { ...s, step, done: Array(s.n).fill(false), deadline: now + (kindOf(step) === 'draw' ? s.drawSecs : s.writeSecs) * 1000 };
}

function handIn(s: PhoneState, seat: Seat, entry: Entry, now: number): PhoneState {
  const k = chainFor(seat, s.step, s.n);
  const chains = s.chains.map((c, i) => (i === k ? [...c, entry] : c));
  const done = s.done.map((d, i) => d || i === seat);
  const next = { ...s, chains, done };
  return done.every(Boolean) ? advance(next, now) : next;
}

export function move(s: PhoneState, seat: Seat, m: PhoneMove, ctx: Pick<GameCtx, 'now'>): PhoneState | string {
  if (m?.type === 'next') {
    if (s.phase !== 'reveal') return 'Not now';
    const { chain, upto } = s.show;
    if (upto + 1 < s.chains[chain].length) return { ...s, show: { chain, upto: upto + 1 } };
    if (chain + 1 < s.n) return { ...s, show: { chain: chain + 1, upto: 0 } };
    return { ...s, phase: 'done' };
  }
  if (s.phase !== 'play') return 'Not now';
  if (s.done[seat]) return 'You already handed this in';
  const kind = kindOf(s.step);
  if (m?.type === 'text' && kind !== 'draw') {
    const text = String(m.text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
    if (!text) return 'Write something first';
    return handIn(s, seat, { by: seat, text }, ctx.now());
  }
  if (m?.type === 'draw' && kind === 'draw') {
    const strokes = cleanDrawing(m.strokes);
    if (!strokes) return 'That drawing is too big';
    return handIn(s, seat, { by: seat, strokes }, ctx.now());
  }
  return 'Invalid move';
}

/** Time's up: whoever hasn't handed in passes on an empty page */
export function onTimer(s: PhoneState, ctx: Pick<GameCtx, 'now'>): PhoneState {
  if (s.phase !== 'play') return s;
  let x = s;
  const kind = kindOf(s.step);
  for (let seat = 0; seat < s.n; seat++) {
    if (x.phase !== 'play' || x.step !== s.step || x.done[seat]) continue;
    x = handIn(x, seat, kind === 'draw' ? { by: seat, strokes: [] } : { by: seat, text: '…' }, ctx.now());
  }
  return x;
}

export function activePlayers(s: PhoneState): Seat[] {
  if (s.phase === 'play') return s.done.flatMap((d, i) => (d ? [] : [i]));
  if (s.phase === 'reveal') return [s.show.chain];
  return [];
}

export function view(s: PhoneState, seat: Seat): PhoneView {
  const k = chainFor(seat, s.step, s.n);
  const chain = s.chains[k] ?? [];
  return {
    n: s.n,
    lang: s.lang,
    phase: s.phase,
    step: s.step,
    kind: kindOf(Math.min(s.step, s.n - 1)),
    deadline: s.deadline,
    doneCount: s.done.filter(Boolean).length,
    mineDone: !!s.done[seat],
    // Only the one entry you were handed: never the rest of the chain
    prompt: s.phase === 'play' && s.step > 0 ? (chain[chain.length - 1] ?? null) : null,
    show: s.phase === 'play' ? null : { chain: s.show.chain, upto: s.show.upto, entries: s.phase === 'done' ? [] : s.chains[s.show.chain].slice(0, s.show.upto + 1) },
  };
}

export function result(s: PhoneState): GameResult | null {
  return s.phase === 'done' ? { winners: [], draw: true, message: 'Thanks for playing! 🎨' } : null;
}

// Phrases to start from when you can't think of one (our own list)
export const IDEAS: Record<'tr' | 'en', string[]> = {
  tr: [
    'Balkonda çay içen penguen', 'Uzaya giden simitçi', 'Dans eden buzdolabı', 'Yağmurda kalan kardan adam', 'Kediyle satranç oynayan dede',
    'Pizza yiyen dinozor', 'Bisiklete binen ahtapot', 'Dondurma satan robot', 'Uçan halıda kahvaltı', 'Gözlüklü timsah',
    'Şemsiyeli zürafa', 'Denizde yüzen kale', 'Şarkı söyleyen kaktüs', 'Çorap arayan ayı', 'Vapurda balık tutan maymun',
    'Trafikte sıkışmış salyangoz', 'Pasta kesen uzaylı', 'Kayakla kayan kaplumbağa', 'Kitap okuyan baykuş', 'Halay çeken tavuklar',
    'Ayda piknik', 'Sihirli lamba', 'Uykucu ejderha', 'Futbol oynayan balinalar', 'Elinde mikrofonla kedi',
  ],
  en: [
    'A penguin drinking tea on a balcony', 'A pizza delivery to the moon', 'A dancing fridge', 'A snowman caught in the rain', 'Grandpa playing chess with a cat',
    'A dinosaur eating spaghetti', 'An octopus riding a bike', 'A robot selling ice cream', 'Breakfast on a flying carpet', 'A crocodile wearing glasses',
    'A giraffe with an umbrella', 'A castle floating at sea', 'A singing cactus', 'A bear looking for its socks', 'A monkey fishing from a ferry',
    'A snail stuck in traffic', 'An alien cutting a cake', 'A turtle on skis', 'An owl reading a book', 'Chickens doing a line dance',
    'A picnic on the moon', 'A magic lamp', 'A sleepy dragon', 'Whales playing football', 'A cat with a microphone',
  ],
};
