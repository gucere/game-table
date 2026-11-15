/**
 * Kelime Zinciri: each word starts with the last letter of the one before.
 * In Turkish no word starts with ğ, so after a word ending in ğ you use the letter before it.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';
import { ALPHABET, dictionaryReady, hasWord, loadDictionary, wordList, type Lang } from '../wordtiles/dict';

export type { Lang };

export interface ChainEvent {
  seat: Seat;
  kind: 'word' | 'timeout' | 'giveup';
  word?: string;
  /** That player is out of lives */
  out?: boolean;
}

export interface ChainState {
  lang: Lang;
  n: number;
  lives: number[];
  scores: number[];
  turn: Seat;
  chain: { w: string; by: Seat }[];
  /** First letter of the very first word */
  start: string;
  secs: number;
  minLen: number;
  /** Host clock */
  deadline: number;
  event: ChainEvent | null;
  over: boolean;
}

export type ChainMove = { type: 'word'; word: string } | { type: 'giveup' };

// Letters that plenty of words start with, for the opening letter
const STARTS: Record<Lang, string> = { tr: 'abcdeghikmnoprstuy', en: 'abcdefghlmnoprstw' };

export const lower = (lang: Lang, s: string) => s.trim().toLocaleLowerCase(lang === 'tr' ? 'tr' : 'en').replace(/\s+/g, '');
export const upper = (lang: Lang, s: string) => s.toLocaleUpperCase(lang === 'tr' ? 'tr' : 'en');

export function nextLetter(lang: Lang, word: string): string {
  const ch = [...word];
  let i = ch.length - 1;
  if (lang === 'tr') while (i > 0 && ch[i] === 'ğ') i--;
  return ch[i];
}

export const required = (s: Pick<ChainState, 'chain' | 'start' | 'lang'>) => (s.chain.length ? nextLetter(s.lang, s.chain[s.chain.length - 1].w) : s.start);

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'random' | 'options' | 'now'>): ChainState {
  const lang: Lang = ctx.options.lang === 'en' ? 'en' : 'tr';
  // The host checks words, so it needs the list: start loading it now
  void loadDictionary(lang).catch(() => {});
  const lives = Math.max(1, Number(ctx.options.lives) || 3);
  const secs = Math.max(5, Number(ctx.options.seconds) || 20);
  const starts = STARTS[lang];
  return {
    lang,
    n: ctx.numPlayers,
    lives: Array(ctx.numPlayers).fill(lives),
    scores: Array(ctx.numPlayers).fill(0),
    turn: 0,
    chain: [],
    start: starts[Math.floor(ctx.random() * starts.length)],
    secs,
    minLen: Math.max(2, Number(ctx.options.min) || 3),
    deadline: ctx.now() + secs * 1000 + 3000,
    event: null,
    over: false,
  };
}

/** Why a word isn't allowed (English, for translation), or null if it's fine */
export function problem(s: ChainState, raw: string): { msg: string; params?: Record<string, string | number> } | null {
  const w = lower(s.lang, raw);
  if (!w) return { msg: 'Type a word.' };
  if ([...w].some((c) => !ALPHABET[s.lang].includes(c))) return { msg: 'Letters only, please.' };
  if ([...w].length < s.minLen) return { msg: 'Too short: at least {n} letters.', params: { n: s.minLen } };
  const need = required(s);
  if (!w.startsWith(need)) return { msg: 'The word has to start with {l}.', params: { l: upper(s.lang, need) } };
  if (s.chain.some((c) => c.w === w)) return { msg: 'That word was already used.' };
  if (!dictionaryReady(s.lang)) return { msg: 'The word list is still loading…' };
  if (!hasWord(s.lang, w)) return { msg: 'Not in the word list.' };
  return null;
}

const alive = (s: ChainState) => s.lives.flatMap((l, i) => (l > 0 ? [i] : []));

function nextTurn(s: ChainState, from: Seat): Seat {
  for (let k = 1; k <= s.n; k++) {
    const i = (from + k) % s.n;
    if (s.lives[i] > 0) return i;
  }
  return from;
}

function loseLife(s: ChainState, seat: Seat, kind: 'timeout' | 'giveup', now: number): ChainState {
  const lives = s.lives.slice();
  lives[seat] = Math.max(0, lives[seat] - 1);
  const next: ChainState = { ...s, lives, event: { seat, kind, out: lives[seat] === 0 } };
  const left = alive(next);
  next.over = s.n === 1 ? lives[0] === 0 : left.length <= 1;
  if (!next.over) {
    // Same letter, next player (alone, you just get a fresh clock)
    next.turn = s.n === 1 ? 0 : nextTurn(next, seat);
    next.deadline = now + s.secs * 1000;
  }
  return next;
}

export function move(s: ChainState, seat: Seat, m: ChainMove, ctx: Pick<GameCtx, 'now'>): ChainState | string {
  if (s.over) return 'The game is over';
  if (seat !== s.turn) return 'Not your turn';
  if (m?.type === 'giveup') return loseLife(s, seat, 'giveup', ctx.now());
  if (m?.type !== 'word' || typeof m.word !== 'string') return 'Invalid move';
  const p = problem(s, m.word);
  if (p) return p.msg;
  const w = lower(s.lang, m.word);
  const scores = s.scores.slice();
  scores[seat] += [...w].length;
  const next: ChainState = { ...s, scores, chain: [...s.chain, { w, by: seat }], event: { seat, kind: 'word', word: w } };
  next.turn = nextTurn(next, seat);
  next.deadline = ctx.now() + s.secs * 1000;
  return next;
}

export function onTimer(s: ChainState, ctx: Pick<GameCtx, 'now'>): ChainState {
  return s.over ? s : loseLife(s, s.turn, 'timeout', ctx.now());
}

export function result(s: ChainState): GameResult | null {
  if (!s.over) return null;
  if (s.n === 1) return { winners: s.chain.length >= 10 ? [0] : [], message: `🔗 ${s.chain.length}` };
  return { winners: alive(s) };
}

// ---- Bot

const buckets: Partial<Record<Lang, Map<string, string[]>>> = {};
function bucket(lang: Lang, letter: string): string[] | null {
  if (!buckets[lang]) {
    const list = wordList(lang);
    if (!list) return null;
    const m = new Map<string, string[]>();
    for (const w of list) {
      const first = [...w][0];
      if (!m.has(first)) m.set(first, []);
      m.get(first)!.push(w);
    }
    buckets[lang] = m;
  }
  return buckets[lang]!.get(letter) ?? [];
}

export function bot(s: ChainState, _seat: Seat, ctx: BotCtx): ChainMove | null {
  if (!dictionaryReady(s.lang)) {
    void loadDictionary(s.lang).catch(() => {});
    return null;
  }
  const giveUp = { easy: 0.12, normal: 0.05, hard: 0.01 }[ctx.level];
  if (ctx.random() < giveUp) return { type: 'giveup' };
  const words = bucket(s.lang, required(s)) ?? [];
  const used = new Set(s.chain.map((c) => c.w));
  const maxLen = ctx.level === 'easy' ? 6 : ctx.level === 'normal' ? 8 : 15;
  for (let k = 0; k < 400 && words.length; k++) {
    const w = words[Math.floor(ctx.random() * words.length)];
    const len = [...w].length;
    if (len >= s.minLen && len <= maxLen && !used.has(w)) return { type: 'word', word: w };
  }
  const any = words.find((w) => [...w].length >= s.minLen && !used.has(w));
  return any ? { type: 'word', word: any } : { type: 'giveup' };
}
