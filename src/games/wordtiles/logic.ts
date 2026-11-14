/**
 * Kelime Ustası: an original crossword tile game. Its own bonus-square layout, letter counts
 * and values. Place tiles in one line to make words that join the ones on the board.
 */
import type { GameCtx, GameResult, Seat } from '../../engine/types';
import { shuffle } from '../cards/cards';
import { ALPHABET, hasWord, loadDictionary, dictionaryReady, type Lang } from './dict';

export type { Lang };
export const SIZE = 15;
export const CENTER = 112;
export const RACK = 7;
export const ALL_SEVEN = 50;
export const BLANK = '?';

/** letter: [how many tiles, points] */
export const TILESET: Record<Lang, Record<string, [number, number]>> = {
  en: {
    e: [11, 1], a: [9, 1], i: [8, 1], o: [7, 1], t: [7, 1], n: [6, 1], r: [6, 1], s: [6, 1], l: [4, 1], u: [4, 1],
    d: [4, 2], g: [3, 2], h: [3, 3], c: [3, 3], m: [3, 3], b: [2, 3], p: [2, 3], f: [2, 4], w: [2, 4], y: [2, 4],
    v: [1, 5], k: [1, 5], j: [1, 8], x: [1, 8], q: [1, 10], z: [1, 10],
  },
  tr: {
    a: [12, 1], e: [8, 1], i: [7, 1], k: [6, 1], l: [6, 1], r: [6, 1], n: [5, 1], t: [5, 1], ı: [4, 2], m: [4, 2],
    s: [3, 2], u: [3, 2], o: [3, 2], d: [3, 3], y: [3, 3], b: [2, 3], ü: [2, 3], ş: [2, 4], z: [2, 4], c: [2, 4],
    ç: [2, 4], g: [1, 5], h: [1, 5], p: [1, 5], v: [1, 7], ö: [1, 7], f: [1, 7], ğ: [1, 8], j: [1, 10],
  },
};
const BLANKS = 2;

export const letterValue = (lang: Lang, ch: string) => TILESET[lang][ch]?.[1] ?? 0;

export type Premium = '' | 'dl' | 'tl' | 'dw' | 'tw';
/** Our own layout, defined for one eighth of the board and mirrored */
export const PREMIUM: Premium[] = (() => {
  const out: Premium[] = Array(SIZE * SIZE).fill('');
  const octant: [Premium, [number, number][]][] = [
    ['tw', [[0, 4]]],
    ['dw', [[1, 1], [2, 6], [3, 3], [5, 5], [7, 7]]],
    ['tl', [[0, 7], [2, 2], [4, 6]]],
    ['dl', [[0, 0], [1, 4], [3, 7], [3, 5], [6, 6]]],
  ];
  const m = SIZE - 1;
  for (const [kind, cells] of octant)
    for (const [r, c] of cells)
      for (const [a, b] of [
        [r, c], [c, r], [m - r, c], [c, m - r], [r, m - c], [m - c, r], [m - r, m - c], [m - c, m - r],
      ])
        out[a * SIZE + b] = kind;
  return out;
})();

export interface Cell {
  ch: string;
  blank: boolean;
  by: Seat;
}
export interface Placement {
  i: number;
  ch: string;
  blank: boolean;
}

export interface Last {
  seat: Seat;
  kind: 'play' | 'swap' | 'pass';
  words?: string[];
  score?: number;
  tiles?: number[];
  count?: number;
}

export interface WordState {
  n: number;
  lang: Lang;
  board: (Cell | null)[];
  bag: string[];
  racks: string[][];
  scores: number[];
  turn: Seat;
  /** Turns in a row without points (passes, swaps): the game ends after three rounds of them */
  scoreless: number;
  last: Last | null;
  over: boolean;
  /** Rack adjustments at the end */
  endAdjust: number[] | null;
}

export type WordMove = { type: 'play'; tiles: Placement[] } | { type: 'swap'; tiles: string[] } | { type: 'pass' };

export interface WordView {
  n: number;
  me: Seat;
  lang: Lang;
  board: (Cell | null)[];
  rack: string[];
  rackCounts: number[];
  bagCount: number;
  scores: number[];
  turn: Seat;
  last: Last | null;
  over: boolean;
  endAdjust: number[] | null;
}

export function makeBag(lang: Lang, random: () => number) {
  const bag: string[] = [];
  for (const [ch, [count]] of Object.entries(TILESET[lang])) for (let k = 0; k < count; k++) bag.push(ch);
  for (let k = 0; k < BLANKS; k++) bag.push(BLANK);
  return shuffle(bag, random);
}

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'random' | 'options'>): WordState {
  const lang: Lang = ctx.options.lang === 'en' ? 'en' : 'tr';
  // Start fetching the word list now so it's ready by the first move
  loadDictionary(lang).catch(() => {});
  const bag = makeBag(lang, ctx.random);
  const racks = Array.from({ length: ctx.numPlayers }, () => bag.splice(-RACK));
  return { n: ctx.numPlayers, lang, board: Array(SIZE * SIZE).fill(null), bag, racks, scores: Array(ctx.numPlayers).fill(0), turn: 0, scoreless: 0, last: null, over: false, endAdjust: null };
}

const rowOf = (i: number) => Math.floor(i / SIZE);
const colOf = (i: number) => i % SIZE;

export interface Evaluation {
  score: number;
  words: { word: string; score: number }[];
}

/**
 * Check a placement and score it. `isWord` decides what counts as a word.
 * Returns an error message when the placement isn't allowed.
 */
export function evaluate(board: (Cell | null)[], lang: Lang, tiles: Placement[], isWord: (w: string) => boolean): Evaluation | string {
  if (!tiles.length) return 'Place some tiles first';
  const at = new Map<number, Placement>();
  for (const t of tiles) {
    if (!Number.isInteger(t.i) || t.i < 0 || t.i >= SIZE * SIZE) return 'That square is off the board';
    if (board[t.i] || at.has(t.i)) return 'That square is taken';
    if (!ALPHABET[lang].includes(t.ch) || [...t.ch].length !== 1) return 'Unknown letter';
    at.set(t.i, t);
  }
  const letterAt = (i: number) => at.get(i)?.ch ?? board[i]?.ch ?? null;
  const filled = (r: number, c: number) => r >= 0 && r < SIZE && c >= 0 && c < SIZE && letterAt(r * SIZE + c) !== null;
  const rows = new Set(tiles.map((t) => rowOf(t.i)));
  const cols = new Set(tiles.map((t) => colOf(t.i)));
  if (rows.size > 1 && cols.size > 1) return 'Tiles must be in one row or one column';
  const empty = board.every((c) => !c);
  if (empty && !at.has(CENTER)) return 'The first word must cover the ★ in the middle';

  // Direction of the main word
  const horizontal = rows.size === 1 && (tiles.length > 1 || filled(rowOf(tiles[0].i), colOf(tiles[0].i) - 1) || filled(rowOf(tiles[0].i), colOf(tiles[0].i) + 1));
  const step = (i: number, d: number, h: boolean) => (h ? (colOf(i) + d >= 0 && colOf(i) + d < SIZE ? i + d : -1) : rowOf(i) + d >= 0 && rowOf(i) + d < SIZE ? i + d * SIZE : -1);

  // No gaps between the first and last new tile
  const sorted = [...tiles].sort((a, b) => a.i - b.i);
  for (let i = sorted[0].i; i !== sorted[sorted.length - 1].i; i = step(i, 1, horizontal)) if (letterAt(i) === null) return 'Tiles must be in one line with no gaps';

  const wordThrough = (i: number, h: boolean) => {
    let s = i;
    while (step(s, -1, h) >= 0 && letterAt(step(s, -1, h)) !== null) s = step(s, -1, h);
    const cells: number[] = [];
    for (let k = s; k >= 0 && letterAt(k) !== null; k = step(k, 1, h)) cells.push(k);
    return cells;
  };
  const scoreOf = (cells: number[]) => {
    let sum = 0;
    let mult = 1;
    for (const k of cells) {
      const p = at.get(k);
      const v = p ? (p.blank ? 0 : letterValue(lang, p.ch)) : board[k]!.blank ? 0 : letterValue(lang, board[k]!.ch);
      const prem = p ? PREMIUM[k] : '';
      sum += v * (prem === 'dl' ? 2 : prem === 'tl' ? 3 : 1);
      if (prem === 'dw') mult *= 2;
      if (prem === 'tw') mult *= 3;
    }
    return sum * mult;
  };

  const words: { cells: number[] }[] = [];
  const main = wordThrough(sorted[0].i, horizontal);
  if (main.length > 1) words.push({ cells: main });
  for (const t of tiles) {
    const cross = wordThrough(t.i, !horizontal);
    if (cross.length > 1) words.push({ cells: cross });
  }
  if (!words.length) return empty ? 'A word needs at least two letters' : 'New tiles must join the words on the board';
  if (!empty) {
    const touches = words.some((w) => w.cells.some((k) => !at.has(k)));
    if (!touches) return 'New tiles must join the words on the board';
  }
  const out: Evaluation = { score: 0, words: [] };
  for (const w of words) {
    const word = w.cells.map((k) => letterAt(k)!).join('');
    if (!isWord(word)) return `“${word.toLocaleUpperCase(lang === 'tr' ? 'tr' : 'en')}” is not in the word list`;
    const sc = scoreOf(w.cells);
    out.words.push({ word, score: sc });
    out.score += sc;
  }
  if (tiles.length === RACK) out.score += ALL_SEVEN;
  return out;
}

const rackValue = (lang: Lang, rack: string[]) => rack.reduce((a, ch) => a + letterValue(lang, ch), 0);

function endGame(s: WordState, finisher: Seat | null): WordState {
  const loss = s.racks.map((r) => rackValue(s.lang, r));
  const total = loss.reduce((a, b) => a + b, 0);
  const endAdjust = loss.map((l, i) => (i === finisher ? total : -l));
  return { ...s, over: true, endAdjust, scores: s.scores.map((x, i) => x + endAdjust[i]) };
}

/** Remove letters from a rack (blanks are '?'); null if the rack doesn't have them */
function takeFrom(rack: string[], letters: string[]) {
  const left = [...rack];
  for (const l of letters) {
    const k = left.indexOf(l);
    if (k < 0) return null;
    left.splice(k, 1);
  }
  return left;
}

export function move(s: WordState, seat: Seat, m: WordMove, ctx: Pick<GameCtx, 'random'>): WordState | string {
  if (s.over) return 'Game over';
  if (seat !== s.turn) return 'Not your turn';
  const next = (seat + 1) % s.n;
  if (m?.type === 'pass') {
    const t: WordState = { ...s, turn: next, scoreless: s.scoreless + 1, last: { seat, kind: 'pass' } };
    return t.scoreless >= s.n * 3 ? endGame(t, null) : t;
  }
  if (m?.type === 'swap') {
    if (s.bag.length < RACK) return 'Too few tiles left in the bag to swap';
    const tiles = Array.isArray(m.tiles) ? m.tiles : [];
    if (!tiles.length) return 'Pick tiles to swap';
    const left = takeFrom(s.racks[seat], tiles);
    if (!left) return 'Those tiles aren’t on your rack';
    const bag = [...s.bag];
    const drawn = bag.splice(-tiles.length);
    const newBag = shuffle([...bag, ...tiles], ctx.random);
    const t: WordState = {
      ...s,
      bag: newBag,
      racks: s.racks.map((r, i) => (i === seat ? [...left, ...drawn] : r)),
      turn: next,
      scoreless: s.scoreless + 1,
      last: { seat, kind: 'swap', count: tiles.length },
    };
    return t.scoreless >= s.n * 3 ? endGame(t, null) : t;
  }
  if (m?.type !== 'play' || !Array.isArray(m.tiles)) return 'Place some tiles first';
  if (!dictionaryReady(s.lang)) return 'The word list is still loading. Try again in a moment.';
  const tiles = m.tiles.map((t) => ({ i: Number(t.i), ch: String(t.ch ?? ''), blank: !!t.blank }));
  const left = takeFrom(
    s.racks[seat],
    tiles.map((t) => (t.blank ? BLANK : t.ch)),
  );
  if (!left) return 'Those tiles aren’t on your rack';
  const ev = evaluate(s.board, s.lang, tiles, (w) => hasWord(s.lang, w));
  if (typeof ev === 'string') return ev;
  const board = [...s.board];
  for (const t of tiles) board[t.i] = { ch: t.ch, blank: t.blank, by: seat };
  const bag = [...s.bag];
  const drawn = bag.splice(-Math.min(bag.length, tiles.length));
  const rack = [...left, ...drawn];
  const t: WordState = {
    ...s,
    board,
    bag,
    racks: s.racks.map((r, i) => (i === seat ? rack : r)),
    scores: s.scores.map((x, i) => (i === seat ? x + ev.score : x)),
    turn: next,
    scoreless: 0,
    last: { seat, kind: 'play', words: ev.words.map((w) => w.word), score: ev.score, tiles: tiles.map((x) => x.i) },
  };
  return !rack.length && !bag.length ? endGame(t, seat) : t;
}

export const activePlayers = (s: WordState): Seat[] => (s.over ? [] : [s.turn]);

export function view(s: WordState, seat: Seat): WordView {
  return {
    n: s.n,
    me: seat,
    lang: s.lang,
    board: s.board,
    rack: s.racks[seat] ?? [],
    rackCounts: s.racks.map((r) => r.length),
    bagCount: s.bag.length,
    scores: s.scores,
    turn: s.turn,
    last: s.last,
    over: s.over,
    endAdjust: s.endAdjust,
  };
}

export function result(s: WordState): GameResult | null {
  if (!s.over) return null;
  const best = Math.max(...s.scores);
  const winners = s.scores.flatMap((x, i) => (x === best ? [i] : []));
  return winners.length === s.n && s.n > 1 ? { winners, draw: true } : { winners };
}
