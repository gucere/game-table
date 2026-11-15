/**
 * Kemps: the traditional partnership card game. Everyone holds four cards and swaps with four
 * cards in the middle, trying to collect four of a kind. Partners share a secret signal; when
 * your partner gives it, call "Kemps!". Suspect an opponent? Call "Stop!" on them.
 * Online, each team is dealt its secret signal from the same six emoji, so anyone can send any
 * of them and the other team has to work out which one matters.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';
import { deck, rankOf, shuffle, type Card } from '../cards/cards';

export const SIGNALS = ['😉', '👃', '🤙', '👆', '✌️', '🙃'];
export const WORD = 'KEMPS';

export interface KempsState {
  hands: Card[][];
  center: Card[];
  stock: Card[];
  used: Card[];
  /** Each team's secret signal */
  secret: [string, string];
  log: { seat: Seat; emoji: string; round: number }[];
  stuck: boolean[];
  letters: [number, number];
  target: number;
  round: number;
  phase: 'play' | 'between' | 'done';
  call: { by: Seat; kind: 'kemps' | 'stop'; target: Seat; right: boolean; scorer: 0 | 1 } | null;
}

export type KempsMove = { type: 'swap'; card: Card; i: number } | { type: 'signal'; emoji: string } | { type: 'stuck' } | { type: 'kemps' } | { type: 'stop'; target: Seat } | { type: 'next' };

export interface KempsView extends Omit<KempsState, 'hands' | 'stock' | 'secret'> {
  me: Seat;
  hand: Card[];
  mySignal: string;
  stockCount: number;
  /** Everyone's hand once a call is made */
  shown: Card[][] | null;
}

export const team = (s: Seat) => (s % 2) as 0 | 1;
export const partner = (s: Seat) => (s + 2) % 4;
export const hasFour = (hand: Card[]) => hand.length === 4 && hand.every((c) => rankOf(c) === rankOf(hand[0]));

function deal(base: Pick<KempsState, 'letters' | 'target' | 'round' | 'log'>, random: () => number): KempsState {
  const cards = shuffle(deck(), random);
  const hands = [0, 1, 2, 3].map(() => cards.splice(-4));
  const center = cards.splice(-4);
  const signals = shuffle(SIGNALS, random);
  return { ...base, hands, center, stock: cards, used: [], secret: [signals[0], signals[1]], stuck: [false, false, false, false], phase: 'play', call: null };
}

export function setup(ctx: Pick<GameCtx, 'random' | 'options'>): KempsState {
  const target = ctx.options.length === 'short' ? 3 : 5;
  return deal({ letters: [0, 0], target, round: 1, log: [] }, ctx.random);
}

function decide(s: KempsState, by: Seat, kind: 'kemps' | 'stop', target: Seat): KempsState {
  const right = hasFour(s.hands[target]);
  const scorer = right ? team(by) : ((1 - team(by)) as 0 | 1);
  const letters: [number, number] = [...s.letters];
  letters[scorer]++;
  return { ...s, letters, call: { by, kind, target, right, scorer }, phase: letters[scorer] >= s.target ? 'done' : 'between' };
}

export function move(s: KempsState, seat: Seat, m: KempsMove, ctx: Pick<GameCtx, 'random'>): KempsState | string {
  if (s.phase === 'done') return 'Game over';
  if (s.phase === 'between') {
    if (m?.type !== 'next') return 'Start the next round';
    return deal({ letters: s.letters, target: s.target, round: s.round + 1, log: s.log }, ctx.random);
  }
  switch (m?.type) {
    case 'swap': {
      const i = m.i;
      if (!Number.isInteger(i) || i < 0 || i >= s.center.length) return 'Pick a card in the middle';
      if (!s.hands[seat].includes(m.card)) return 'That card was just taken: try again';
      const taken = s.center[i];
      return {
        ...s,
        hands: s.hands.map((h, k) => (k === seat ? h.map((c) => (c === m.card ? taken : c)) : h)),
        center: s.center.map((c, k) => (k === i ? m.card : c)),
        // New cards in the middle: everyone may want to look again
        stuck: [false, false, false, false],
      };
    }
    case 'signal':
      if (!SIGNALS.includes(m.emoji)) return 'Pick a signal';
      return { ...s, log: [...s.log, { seat, emoji: m.emoji, round: s.round }].slice(-30) };
    case 'stuck': {
      const stuck = s.stuck.map((x, k) => x || k === seat);
      if (!stuck.every(Boolean)) return { ...s, stuck };
      // Nobody wants the middle cards: four fresh ones (shuffling the used ones back if needed)
      let stock = s.stock;
      let used = [...s.used, ...s.center];
      if (stock.length < 4) {
        stock = shuffle([...stock, ...used], ctx.random);
        used = [];
      }
      return { ...s, stock: stock.slice(0, -4), center: stock.slice(-4), used, stuck: [false, false, false, false] };
    }
    case 'kemps':
      return decide(s, seat, 'kemps', partner(seat));
    case 'stop':
      if (!Number.isInteger(m.target) || team(m.target) === team(seat)) return 'Call Stop on an opponent';
      return decide(s, seat, 'stop', m.target);
  }
  return 'Swap, signal or call';
}

export const activePlayers = (s: KempsState): Seat[] => (s.phase === 'done' ? [] : [0, 1, 2, 3]);

export function view(s: KempsState, seat: Seat): KempsView {
  const { hands, stock, secret, ...rest } = s;
  return { ...rest, me: seat, hand: hands[seat] ?? [], mySignal: secret[team(seat)], stockCount: stock.length, shown: s.phase === 'play' ? null : hands };
}

export function result(s: KempsState): GameResult | null {
  if (s.phase !== 'done') return null;
  const t = s.letters[0] >= s.target ? 0 : 1;
  return { winners: [t, t + 2] };
}

// ------------------------------------------------------------- bot

/** Bots go for the rank they hold most of, signal when they have four, and listen for their partner */
export function bot(v: KempsView, seat: Seat, ctx: BotCtx): KempsMove | null {
  if (v.phase === 'between') return { type: 'next' };
  const thisRound = v.log.filter((l) => l.round === v.round);
  const p = partner(seat);
  const sharp = ctx.level === 'hard' ? 0.9 : ctx.level === 'normal' ? 0.7 : 0.4;

  // Partner gave our signal: Kemps!
  if (thisRound.some((l) => l.seat === p && l.emoji === v.mySignal) && ctx.random() < sharp) return { type: 'kemps' };

  // An opponent repeating the same signal looks suspicious
  if (ctx.level !== 'easy') {
    for (const opp of [(seat + 1) % 4, (seat + 3) % 4]) {
      const mine = thisRound.filter((l) => l.seat === opp).map((l) => l.emoji);
      const repeated = mine.some((e, i) => mine.indexOf(e) !== i);
      if (repeated && ctx.random() < (ctx.level === 'hard' ? 0.35 : 0.15)) return { type: 'stop', target: opp };
    }
  }

  // Four of a kind: tell the partner (once per round, sometimes after a decoy)
  if (hasFour(v.hand)) {
    if (!thisRound.some((l) => l.seat === seat && l.emoji === v.mySignal)) return { type: 'signal', emoji: v.mySignal };
    return null;
  }
  if (ctx.level === 'hard' && ctx.random() < 0.05) {
    const decoys = ['😉', '👃', '🤙', '👆', '✌️', '🙃'].filter((e) => e !== v.mySignal);
    return { type: 'signal', emoji: decoys[Math.floor(ctx.random() * decoys.length)] };
  }

  // Swap toward the rank we hold most of
  const count = new Map<number, number>();
  for (const c of v.hand) count.set(rankOf(c), (count.get(rankOf(c)) ?? 0) + 1);
  const goal = [...count.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  const want = v.center.findIndex((c) => rankOf(c) === goal);
  const spare = v.hand.find((c) => rankOf(c) !== goal);
  if (want >= 0 && spare !== undefined) return { type: 'swap', card: spare, i: want };
  // Swap a pair for a better pair now and then
  if (!v.stuck[seat]) return { type: 'stuck' };
  return null;
}
