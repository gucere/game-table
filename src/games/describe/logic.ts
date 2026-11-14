/**
 * Kelimeyi Anlat: two teams take turns. The describer has a minute to get their team to say
 * as many words as possible, without using the word itself or any of its forbidden words.
 * The other team sees the card too, so they can catch a forbidden word.
 */
import type { GameCtx, GameResult, Seat } from '../../engine/types';
import { shuffle } from '../cards/cards';
import { CARDS } from './cards';

export type Mark = 'ok' | 'pass' | 'buzz';

export interface DescribeState {
  n: number;
  lang: 'tr' | 'en';
  seconds: number;
  passes: number;
  /** Order of describers (teams alternate: even seats vs odd seats) */
  order: Seat[];
  turn: number;
  phase: 'ready' | 'describe' | 'done';
  deck: number[];
  pos: number;
  deadline: number | null;
  scores: [number, number];
  passesLeft: number;
  /** What happened in the current (or last finished) turn */
  log: { card: number; mark: Mark }[];
}

export type DescribeMove = { type: 'start' } | { type: 'mark'; mark: Mark };

export interface DescribeView {
  n: number;
  lang: 'tr' | 'en';
  me: Seat;
  myTeam: 0 | 1;
  describer: Seat;
  phase: DescribeState['phase'];
  /** The word and its forbidden words, for the describer and the other team */
  card: [string, string[]] | null;
  turn: number;
  totalTurns: number;
  deadline: number | null;
  scores: [number, number];
  passesLeft: number;
  passLimit: number;
  log: { word: string; mark: Mark }[];
}

export const teamOf = (seat: Seat) => (seat % 2) as 0 | 1;

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'random' | 'options'>): DescribeState {
  const lang = ctx.options.lang === 'en' ? 'en' : 'tr';
  const rounds = Number(ctx.options.rounds ?? 1);
  const passes = Number(ctx.options.passes ?? 3);
  const order = Array.from({ length: ctx.numPlayers * rounds }, (_, i) => i % ctx.numPlayers);
  return {
    n: ctx.numPlayers,
    lang,
    seconds: Number(ctx.options.seconds ?? 60),
    passes,
    order,
    turn: 0,
    phase: 'ready',
    deck: shuffle(
      CARDS[lang].map((_, i) => i),
      ctx.random,
    ),
    pos: 0,
    deadline: null,
    scores: [0, 0],
    passesLeft: passes,
    log: [],
  };
}

export const describer = (s: DescribeState) => s.order[s.turn];

function nextCard(s: DescribeState, random: () => number): Pick<DescribeState, 'deck' | 'pos'> {
  // Out of cards: reshuffle the ones not yet used this game
  if (s.pos + 1 < s.deck.length) return { deck: s.deck, pos: s.pos + 1 };
  return { deck: shuffle(s.deck, random), pos: 0 };
}

export function move(s: DescribeState, seat: Seat, m: DescribeMove, ctx: Pick<GameCtx, 'now' | 'random'>): DescribeState | string {
  if (s.phase === 'done') return 'Game over';
  if (seat !== describer(s)) return 'Only the describer can do that';
  if (s.phase === 'ready') {
    if (m?.type !== 'start') return 'Press start when you are ready';
    return { ...s, phase: 'describe', deadline: ctx.now() + s.seconds * 1000, passesLeft: s.passes, log: [] };
  }
  if (m?.type !== 'mark' || !['ok', 'pass', 'buzz'].includes(m.mark)) return 'Mark the card';
  if (m.mark === 'pass' && s.passes > 0 && s.passesLeft <= 0) return 'No passes left';
  const team = teamOf(seat);
  const delta = m.mark === 'ok' ? 1 : m.mark === 'buzz' ? -1 : 0;
  const scores: [number, number] = [...s.scores];
  scores[team] += delta;
  return {
    ...s,
    scores,
    passesLeft: m.mark === 'pass' ? s.passesLeft - 1 : s.passesLeft,
    log: [...s.log, { card: s.deck[s.pos], mark: m.mark }],
    ...nextCard(s, ctx.random),
  };
}

/** Time's up: the card on screen is used up too, and the next describer gets ready */
export function onTimer(s: DescribeState, ctx: Pick<GameCtx, 'random'>): DescribeState {
  if (s.phase !== 'describe') return s;
  const turn = s.turn + 1;
  if (turn >= s.order.length) return { ...s, phase: 'done', deadline: null };
  return { ...s, turn, phase: 'ready', deadline: null, ...nextCard(s, ctx.random) };
}

export const activePlayers = (s: DescribeState): Seat[] => (s.phase === 'done' ? [] : [describer(s)]);

export function view(s: DescribeState, seat: Seat): DescribeView {
  const d = describer(s);
  const seesCard = s.phase === 'describe' && (seat === d || teamOf(seat) !== teamOf(d));
  const cards = CARDS[s.lang];
  return {
    n: s.n,
    lang: s.lang,
    me: seat,
    myTeam: teamOf(seat),
    describer: d,
    phase: s.phase,
    card: seesCard ? cards[s.deck[s.pos]] : null,
    turn: s.turn,
    totalTurns: s.order.length,
    deadline: s.deadline,
    scores: s.scores,
    passesLeft: s.passesLeft,
    passLimit: s.passes,
    log: s.log.map((l) => ({ word: cards[l.card][0], mark: l.mark })),
  };
}

export function result(s: DescribeState): GameResult | null {
  if (s.phase !== 'done') return null;
  const seats = Array.from({ length: s.n }, (_, i) => i);
  if (s.scores[0] === s.scores[1]) return { winners: seats, draw: true };
  const t = s.scores[0] > s.scores[1] ? 0 : 1;
  return { winners: seats.filter((i) => teamOf(i) === t) };
}
