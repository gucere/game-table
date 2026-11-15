/**
 * Durak, 2–6 players, 36-card deck (6..A). The bottom card of the deck sets trump.
 * The attacker leads, the defender beats each card, and attackers may throw in more cards
 * of ranks already on the table (max 6, and no more than the defender held). By default only
 * the attacker and the side attacker (the player on the defender's other side) may attack,
 * and the defender may pass the attack on with a card of the same rank. Last player holding
 * cards is the durak (fool).
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';
import { deck, rankOf, remove, shuffle, suitOf, type Card, type Suit } from '../cards/cards';

export interface Pair {
  a: Card;
  d: Card | null;
}

export interface DurakState {
  n: number;
  deck: Card[]; // draw from the end; deck[0] is the face-up trump card
  trumpCard: Card;
  trump: Suit;
  hands: Card[][];
  attacker: Seat;
  defender: Seat;
  table: Pair[];
  phase: 'attack' | 'defend' | 'throw' | 'done';
  taking: boolean;
  throwTurn: Seat;
  passed: boolean[];
  limit: number;
  out: boolean[];
  finishOrder: Seat[];
  durak: Seat | null;
  discarded: number;
  lastBout: { defender: Seat; took: boolean } | null;
  /** "Perevodnoy": the defender may pass the attack on with a card of the same rank */
  transfer?: boolean;
  /** Only the attacker and the side attacker may attack (otherwise everyone but the defender) */
  sideOnly?: boolean;
}

export interface DurakView extends Omit<DurakState, 'deck' | 'hands'> {
  me: Seat;
  hand: Card[];
  handCounts: number[];
  deckCount: number;
}

export type DurakMove = { type: 'transfer'; card: Card } | { type: 'attack'; card: Card } | { type: 'beat'; i: number; card: Card } | { type: 'take' } | { type: 'throw'; card: Card } | { type: 'pass' };

export const canBeat = (a: Card, d: Card, trump: Suit) =>
  (suitOf(a) === suitOf(d) && rankOf(d) > rankOf(a)) || (suitOf(d) === trump && suitOf(a) !== trump);

const nextLive = (s: { n: number; out: boolean[] }, seat: Seat, skip: Seat[] = []) => {
  let t = seat;
  for (let k = 0; k < s.n; k++) {
    t = (t + 1) % s.n;
    if (!s.out[t] && !skip.includes(t)) return t;
  }
  return seat;
};

/** Everyone but the defender, main attacker first, then round from the defender (refill order) */
function others(s: Pick<DurakState, 'n' | 'out' | 'attacker' | 'defender'>): Seat[] {
  const list: Seat[] = [s.attacker];
  let t = s.defender;
  for (let k = 0; k < s.n; k++) {
    t = (t + 1) % s.n;
    if (t !== s.attacker && t !== s.defender && !s.out[t]) list.push(t);
  }
  return list;
}

/** The player on the defender's other side (null when that is the attacker) */
export function sideAttacker(s: Pick<DurakState, 'n' | 'out' | 'attacker' | 'defender'>): Seat | null {
  const side = nextLive(s, s.defender);
  return side === s.attacker || side === s.defender ? null : side;
}

/** Who may attack, in throw order: the attacker, then the side attacker (or everyone else) */
export function throwers(s: Pick<DurakState, 'n' | 'out' | 'attacker' | 'defender' | 'sideOnly'> | DurakView): Seat[] {
  if (!s.sideOnly) return others(s);
  const side = sideAttacker(s);
  return side === null ? [s.attacker] : [s.attacker, side];
}

export function tableRanks(table: Pair[]) {
  return new Set(table.flatMap((p) => (p.d === null ? [rankOf(p.a)] : [rankOf(p.a), rankOf(p.d)])));
}

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'random'> & { options?: Record<string, string> }): DurakState {
  const n = ctx.numPlayers;
  const cards = shuffle(deck(6), ctx.random);
  // With six players every card is dealt, including the face-up trump.
  const trumpCard = cards[0];
  const hands: Card[][] = Array.from({ length: n }, () => []);
  for (let r = 0; r < 6; r++) for (let i = 0; i < n; i++) hands[i].push(cards.pop()!);
  const trump = suitOf(trumpCard);
  const mode = ctx.options?.mode ?? 'friends';
  const attackers = ctx.options?.attackers ?? 'variant';
  // Lowest trump starts
  let attacker: Seat = 0;
  let low = 99;
  hands.forEach((h, i) =>
    h.forEach((c) => {
      if (suitOf(c) === trump && rankOf(c) < low) {
        low = rankOf(c);
        attacker = i;
      }
    }),
  );
  const out = Array(n).fill(false);
  const defender = nextLive({ n, out }, attacker);
  return {
    n,
    deck: cards,
    trumpCard,
    trump,
    hands,
    attacker,
    defender,
    table: [],
    phase: 'attack',
    taking: false,
    throwTurn: attacker,
    passed: Array(n).fill(false),
    limit: Math.min(6, hands[defender].length),
    out,
    finishOrder: [],
    durak: null,
    discarded: 0,
    lastBout: null,
    transfer: mode === 'friends' || mode === 'transfer',
    sideOnly: attackers === 'side' || (attackers === 'variant' && mode === 'friends'),
  };
}

/** Can the defender pass the attack on to the next player with this card? */
export function canTransfer(s: Pick<DurakState, 'transfer' | 'table' | 'n' | 'out' | 'defender'> & { hands?: Card[][]; handCounts?: number[] }, card: Card): boolean {
  if (!s.transfer || !s.table.length || s.table.some((p) => p.d !== null)) return false;
  if (rankOf(card) !== rankOf(s.table[0].a)) return false;
  const next = nextLive(s, s.defender);
  const nextCount = s.hands ? s.hands[next].length : (s.handCounts?.[next] ?? 0);
  return next !== s.defender && nextCount >= s.table.length + 1;
}

function beginThrowRound(s: DurakState): DurakState {
  const order = throwers(s).filter((t) => s.hands[t].length > 0);
  if (!order.length) return endBout(s);
  return { ...s, phase: 'throw', throwTurn: order[0], passed: Array(s.n).fill(false) };
}

function endBout(s: DurakState): DurakState {
  const hands = s.hands.map((h) => h.slice());
  const tableCards = s.table.flatMap((p) => (p.d === null ? [p.a] : [p.a, p.d]));
  let discarded = s.discarded;
  if (s.taking) hands[s.defender].push(...tableCards);
  else discarded += tableCards.length;
  // Draw back up to 6: attackers first, defender last
  const deckCards = s.deck.slice();
  for (const t of [...others(s), s.defender]) {
    while (hands[t].length < 6 && deckCards.length) hands[t].push(deckCards.pop()!);
  }
  const out = s.out.slice();
  const finishOrder = s.finishOrder.slice();
  if (!deckCards.length) {
    for (let i = 0; i < s.n; i++) {
      if (!out[i] && hands[i].length === 0) {
        out[i] = true;
        finishOrder.push(i);
      }
    }
  }
  const live = out.map((o, i) => (!o ? i : -1)).filter((i) => i >= 0);
  const base: DurakState = { ...s, hands, deck: deckCards, out, finishOrder, discarded, table: [], taking: false, lastBout: { defender: s.defender, took: s.taking } };
  if (live.length <= 1) return { ...base, phase: 'done', durak: live.length === 1 ? live[0] : null };
  // Who attacks next?
  let attacker: Seat;
  if (s.taking) attacker = nextLive(base, s.defender);
  else attacker = out[s.defender] ? nextLive(base, s.defender) : s.defender;
  const defender = nextLive(base, attacker);
  return {
    ...base,
    attacker,
    defender,
    phase: 'attack',
    throwTurn: attacker,
    passed: Array(s.n).fill(false),
    limit: Math.min(6, hands[defender].length),
  };
}

export function move(s: DurakState, seat: Seat, m: DurakMove): DurakState | string {
  if (s.phase === 'done') return 'The game is over';
  const hand = s.hands[seat];
  const without = (c: Card) => s.hands.map((h, i) => (i === seat ? remove(h, [c]) : h));
  switch (s.phase) {
    case 'attack': {
      if (seat !== s.attacker) return 'Not your turn';
      if (m.type !== 'attack' || !hand.includes(m.card)) return 'Lead a card';
      return { ...s, hands: without(m.card), table: [{ a: m.card, d: null }], phase: 'defend' };
    }
    case 'defend': {
      if (seat !== s.defender) return 'Not your turn';
      if (m.type === 'take') return beginThrowRound({ ...s, taking: true });
      if (m.type === 'transfer') {
        if (!hand.includes(m.card) || !canTransfer(s, m.card)) return 'You can only pass it on with a card of the same rank, before beating anything';
        const defender = nextLive(s, s.defender);
        const hands = without(m.card);
        return { ...s, hands, table: [...s.table, { a: m.card, d: null }], attacker: s.defender, defender, limit: Math.min(6, hands[defender].length) };
      }
      if (m.type !== 'beat') return 'Beat a card or take';
      const pair = s.table[m.i];
      if (!pair || pair.d !== null) return 'Pick an unbeaten card';
      if (!hand.includes(m.card) || !canBeat(pair.a, m.card, s.trump)) return 'That card does not beat it';
      const table = s.table.map((p, i) => (i === m.i ? { ...p, d: m.card } : p));
      const ns = { ...s, hands: without(m.card), table };
      if (table.every((p) => p.d !== null)) return beginThrowRound(ns);
      return ns;
    }
    case 'throw': {
      if (seat !== s.throwTurn) return 'Not your turn';
      const order = throwers(s).filter((t) => s.hands[t].length > 0);
      if (m.type === 'pass') {
        const passed = s.passed.slice();
        passed[seat] = true;
        const left = order.filter((t) => !passed[t]);
        if (!left.length) return endBout({ ...s, passed });
        const idx = order.indexOf(seat);
        const nextT = [...order.slice(idx + 1), ...order.slice(0, idx + 1)].find((t) => !passed[t])!;
        return { ...s, passed, throwTurn: nextT };
      }
      if (m.type !== 'throw' || !hand.includes(m.card)) return 'Throw in a card or pass';
      if (!tableRanks(s.table).has(rankOf(m.card))) return 'Only ranks already on the table';
      const unbeaten = s.table.filter((p) => p.d === null).length;
      if (s.table.length >= s.limit) return 'The table is full';
      if (!s.taking && unbeaten + 1 > s.hands[s.defender].length) return 'The defender has no cards left to beat it';
      const table = [...s.table, { a: m.card, d: null }];
      const ns = { ...s, hands: without(m.card), table, passed: Array(s.n).fill(false) };
      return s.taking ? ns : { ...ns, phase: 'defend' };
    }
  }
  return 'Unknown move';
}

export function activePlayers(s: DurakState): Seat[] {
  if (s.phase === 'done') return [];
  if (s.phase === 'attack') return [s.attacker];
  if (s.phase === 'defend') return [s.defender];
  return [s.throwTurn];
}

export function view(s: DurakState, seat: Seat): DurakView {
  const { deck: d, hands, ...rest } = s;
  return { ...rest, me: seat, hand: hands[seat], handCounts: hands.map((h) => h.length), deckCount: d.length };
}

export function result(s: DurakState): GameResult | null {
  if (s.phase !== 'done') return null;
  if (s.durak === null) return { winners: [], draw: true, message: 'Nobody is left holding cards: a draw!' };
  return { winners: Array.from({ length: s.n }, (_, i) => i).filter((i) => i !== s.durak) };
}

// ------------------------------------------------------------- bot

function cost(c: Card, trump: Suit) {
  return rankOf(c) + (suitOf(c) === trump ? 20 : 0);
}

export function bot(v: DurakView, seat: Seat, ctx: BotCtx): DurakMove {
  const byCost = v.hand.slice().sort((a, b) => cost(a, v.trump) - cost(b, v.trump));
  if (ctx.level === 'easy' && ctx.random() < 0.3 && v.phase === 'attack') {
    return { type: 'attack', card: v.hand[Math.floor(ctx.random() * v.hand.length)] };
  }
  if (v.phase === 'attack') return { type: 'attack', card: byCost[0] };
  if (v.phase === 'defend') {
    // Passing it on is usually cheaper than beating
    const pass = byCost.find((c) => canTransfer(v, c) && (suitOf(c) !== v.trump || v.deckCount === 0));
    if (pass !== undefined && ctx.level !== 'easy') return { type: 'transfer', card: pass };
    const used = new Set<Card>();
    for (let i = 0; i < v.table.length; i++) {
      const p = v.table[i];
      if (p.d !== null) continue;
      const beater = byCost.find((c) => !used.has(c) && canBeat(p.a, c, v.trump));
      if (beater === undefined) return { type: 'take' };
      // Don't burn a high trump on a cheap card early in the game
      if (ctx.level === 'hard' && v.deckCount > 8 && suitOf(beater) === v.trump && rankOf(beater) >= 12 && rankOf(p.a) < 10) return { type: 'take' };
      return { type: 'beat', i, card: beater };
    }
    return { type: 'take' };
  }
  // throw-in
  const ranks = tableRanks(v.table);
  const full = v.table.length >= v.limit || (!v.taking && v.table.filter((p) => p.d === null).length + 1 > v.handCounts[v.defender]);
  if (!full) {
    const candidates = byCost.filter((c) => ranks.has(rankOf(c)) && (suitOf(c) !== v.trump || v.deckCount === 0) && (rankOf(c) <= 11 || v.deckCount === 0 || v.taking));
    if (candidates.length && seat !== v.defender) return { type: 'throw', card: candidates[0] };
  }
  return { type: 'pass' };
}
