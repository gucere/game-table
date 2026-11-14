/**
 * King: the Turkish trick-taking game of contracts.
 * Four players, 13 cards each. Before each hand the caller picks a contract: one of six
 * penalties (avoid tricks, hearts, kings & jacks, queens, the king of hearts, the last two
 * tricks) or a trump game (koz) where every trick scores. In a full game everyone calls five
 * times: three penalties and two trump games, and each penalty is played twice in total.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';
import { deck, rankOf, shuffle, suitOf, type Card, type Suit } from '../cards/cards';
import { botMove as batakBot, bestTrump, estimateTricks, trickWinner, type Play } from '../batak/engine';

export type Penalty = 'el' | 'kupa' | 'erkek' | 'kiz' | 'rifki' | 'sonIki';
export type Contract = Penalty | 'koz';

export const PENALTIES: Penalty[] = ['el', 'kupa', 'erkek', 'kiz', 'rifki', 'sonIki'];

export const CONTRACTS: Record<Contract, { name: string; en: string; desc: string }> = {
  el: { name: 'El almaz', en: 'No tricks', desc: '−50 for every trick you take.' },
  kupa: { name: 'Kupa almaz', en: 'No hearts', desc: '−30 for every heart you take.' },
  erkek: { name: 'Erkek almaz', en: 'No kings or jacks', desc: '−60 for every K or J you take.' },
  kiz: { name: 'Kız almaz', en: 'No queens', desc: '−100 for every queen you take.' },
  rifki: { name: 'Rıfkı', en: 'King of hearts', desc: '−320 for whoever takes the K♥.' },
  sonIki: { name: 'Son iki', en: 'Last two tricks', desc: '−180 for each of the last two tricks.' },
  koz: { name: 'Koz', en: 'Trump game', desc: '+50 for every trick you take.' },
};

const K_HEARTS = 1 * 13 + (13 - 2);

export interface KingState {
  n: 4;
  /** Calls per player: 5 for a full game (20 hands), 2 for a quick one (8 hands) */
  callsEach: number;
  handNo: number;
  totalHands: number;
  firstCaller: Seat;
  phase: 'call' | 'play' | 'done';
  hands: Card[][];
  contract: Contract | null;
  trump: Suit | null;
  /** How many times each penalty has been played */
  used: Record<Penalty, number>;
  /** Calls made so far by each player */
  calls: { pen: number; koz: number }[];
  trick: Play[];
  turn: Seat;
  lastTrick: { plays: Play[]; winner: Seat } | null;
  trickNo: number;
  /** Cards each player has taken this hand */
  taken: Card[][];
  tricks: number[];
  /** Winners of tricks 12 and 13 (for Son iki) */
  lastTwo: Seat[];
  broken: boolean;
  played: Card[];
  scores: number[];
  history: { caller: Seat; contract: Contract; trump: Suit | null; delta: number[] }[];
}

export type KingMove = { type: 'call'; contract: Contract; suit?: Suit } | { type: 'play'; card: Card };

export interface KingView {
  me: Seat;
  n: 4;
  phase: KingState['phase'];
  turn: Seat;
  caller: Seat;
  hand: Card[];
  handCounts: number[];
  contract: Contract | null;
  trump: Suit | null;
  trick: Play[];
  lastTrick: KingState['lastTrick'];
  legal: Card[];
  allowed: Contract[];
  tricks: number[];
  /** Penalty points each player has picked up so far this hand */
  running: number[];
  used: Record<Penalty, number>;
  calls: KingState['calls'];
  callsEach: number;
  handNo: number;
  totalHands: number;
  scores: number[];
  history: KingState['history'];
  played: Card[];
  /** For the bots: the batak-style "bidder" is the koz caller */
  bidder: Seat | null;
}

const limits = (s: Pick<KingState, 'callsEach'>) => {
  const koz = s.callsEach >= 5 ? 2 : 1;
  return { koz, pen: s.callsEach - koz, perPenalty: s.callsEach >= 5 ? 2 : 1 };
};

export const callerOf = (s: Pick<KingState, 'firstCaller' | 'handNo' | 'n'>) => ((s.firstCaller + s.handNo) % s.n) as Seat;

export function allowedContracts(s: KingState, seat: Seat): Contract[] {
  const lim = limits(s);
  const c = s.calls[seat];
  const out: Contract[] = [];
  if (c.pen < lim.pen) for (const p of PENALTIES) if (s.used[p] < lim.perPenalty) out.push(p);
  if (c.koz < lim.koz) out.push('koz');
  return out;
}

function deal(s: KingState, random: () => number): KingState {
  const cards = shuffle(deck(), random);
  const hands = [0, 1, 2, 3].map((i) => cards.slice(i * 13, i * 13 + 13));
  const caller = callerOf(s);
  return {
    ...s,
    phase: 'call',
    hands,
    contract: null,
    trump: null,
    trick: [],
    turn: caller,
    trickNo: 0,
    taken: [[], [], [], []],
    tricks: [0, 0, 0, 0],
    lastTwo: [],
    broken: false,
    played: [],
  };
}

export function setup(ctx: Pick<GameCtx, 'random' | 'options'>): KingState {
  const callsEach = ctx.options.length === 'quick' ? 2 : 5;
  const base: KingState = {
    n: 4,
    callsEach,
    handNo: 0,
    totalHands: callsEach * 4,
    firstCaller: Math.floor(ctx.random() * 4),
    phase: 'call',
    hands: [],
    contract: null,
    trump: null,
    used: { el: 0, kupa: 0, erkek: 0, kiz: 0, rifki: 0, sonIki: 0 },
    calls: [0, 1, 2, 3].map(() => ({ pen: 0, koz: 0 })),
    trick: [],
    turn: 0,
    lastTrick: null,
    trickNo: 0,
    taken: [[], [], [], []],
    tricks: [0, 0, 0, 0],
    lastTwo: [],
    broken: false,
    played: [],
    scores: [0, 0, 0, 0],
    history: [],
  };
  return deal(base, ctx.random);
}

/** Cards that cost points in this contract */
export function isPenaltyCard(contract: Contract | null, c: Card) {
  const r = rankOf(c);
  switch (contract) {
    case 'kupa':
      return suitOf(c) === 1;
    case 'erkek':
      return r === 13 || r === 11;
    case 'kiz':
      return r === 12;
    case 'rifki':
      return c === K_HEARTS;
    default:
      return false;
  }
}

export function legalCards(s: Pick<KingState, 'contract' | 'trump' | 'trick' | 'broken'>, hand: Card[]): Card[] {
  const { contract, trump, trick } = s;
  if (!trick.length) {
    // Hearts (or trumps) can't be led until one has been discarded, unless that's all you have
    const blocked = contract === 'koz' ? trump : contract === 'kupa' || contract === 'rifki' ? 1 : null;
    if (blocked !== null && !s.broken) {
      const other = hand.filter((c) => suitOf(c) !== blocked);
      if (other.length) return other;
    }
    return hand;
  }
  const led = suitOf(trick[0].card);
  const follow = hand.filter((c) => suitOf(c) === led);

  if (contract === 'koz') {
    const trumped = led !== trump && trick.some((p) => suitOf(p.card) === trump);
    if (follow.length) {
      if (!trumped) {
        const hi = Math.max(...trick.filter((p) => suitOf(p.card) === led).map((p) => rankOf(p.card)));
        const higher = follow.filter((c) => rankOf(c) > hi);
        if (higher.length) return higher;
      }
      return follow;
    }
    const trumps = hand.filter((c) => suitOf(c) === trump);
    if (trumps.length) {
      if (trumped) {
        const hiT = Math.max(...trick.filter((p) => suitOf(p.card) === trump).map((p) => rankOf(p.card)));
        const over = trumps.filter((c) => rankOf(c) > hiT);
        if (over.length) return over;
      }
      return trumps;
    }
    return hand;
  }

  if (follow.length) {
    // A penalty card that can no longer win this trick must be given up
    if (contract === 'rifki' || contract === 'kiz' || contract === 'erkek') {
      const hi = Math.max(...trick.filter((p) => suitOf(p.card) === led).map((p) => rankOf(p.card)));
      const safe = follow.filter((c) => isPenaltyCard(contract, c) && rankOf(c) < hi);
      if (safe.length) return safe;
    }
    return follow;
  }
  // Out of the suit led: a penalty card must be thrown if you have one
  const pen = hand.filter((c) => isPenaltyCard(contract, c));
  if (pen.length) return pen;
  return hand;
}

/** Points each player has collected in the current hand, so far */
export function handPoints(s: KingState): number[] {
  const count = (seat: number, f: (c: Card) => boolean) => s.taken[seat].filter(f).length;
  return [0, 1, 2, 3].map((i) => {
    switch (s.contract) {
      case 'el':
        return -50 * s.tricks[i];
      case 'kupa':
        return -30 * count(i, (c) => suitOf(c) === 1);
      case 'erkek':
        return -60 * count(i, (c) => rankOf(c) === 13 || rankOf(c) === 11);
      case 'kiz':
        return -100 * count(i, (c) => rankOf(c) === 12);
      case 'rifki':
        return s.taken[i].includes(K_HEARTS) ? -320 : 0;
      case 'sonIki':
        return -180 * s.lastTwo.filter((w) => w === i).length;
      case 'koz':
        return 50 * s.tricks[i];
      default:
        return 0;
    }
  });
}

/** Penalty hands stop as soon as every penalty card is gone */
function handOver(s: KingState) {
  if (s.trickNo >= 13) return true;
  const all = s.taken.flat();
  switch (s.contract) {
    case 'kupa':
      return all.filter((c) => suitOf(c) === 1).length === 13;
    case 'erkek':
      return all.filter((c) => rankOf(c) === 13 || rankOf(c) === 11).length === 8;
    case 'kiz':
      return all.filter((c) => rankOf(c) === 12).length === 4;
    case 'rifki':
      return all.includes(K_HEARTS);
    default:
      return false;
  }
}

function finishHand(s: KingState, random: () => number): KingState {
  const delta = handPoints(s);
  const scores = s.scores.map((x, i) => x + delta[i]);
  const history = [...s.history, { caller: callerOf(s), contract: s.contract!, trump: s.trump, delta }];
  const next = { ...s, scores, history, handNo: s.handNo + 1 };
  if (next.handNo >= s.totalHands) return { ...next, phase: 'done' };
  return deal(next, random);
}

export function move(s: KingState, seat: Seat, m: KingMove, ctx: Pick<GameCtx, 'random'>): KingState | string {
  if (s.phase === 'done') return 'The game is over';
  if (seat !== s.turn) return 'Not your turn';
  if (s.phase === 'call') {
    if (m.type !== 'call') return 'Choose a contract first';
    if (!allowedContracts(s, seat).includes(m.contract)) return 'You cannot call that contract now';
    let trump: Suit | null = null;
    if (m.contract === 'koz') {
      if (m.suit === undefined || ![0, 1, 2, 3].includes(m.suit)) return 'Pick a trump suit';
      trump = m.suit;
    }
    const calls = s.calls.map((c, i) => (i === seat ? (m.contract === 'koz' ? { ...c, koz: c.koz + 1 } : { ...c, pen: c.pen + 1 }) : c));
    const used = m.contract === 'koz' ? s.used : { ...s.used, [m.contract]: s.used[m.contract] + 1 };
    // The caller leads the first trick
    return { ...s, phase: 'play', contract: m.contract, trump, calls, used, turn: seat };
  }
  if (m.type !== 'play') return 'Play a card';
  const hand = s.hands[seat];
  if (!hand.includes(m.card)) return 'You do not have that card';
  if (!legalCards(s, hand).includes(m.card)) return 'You must follow the rules for this contract';
  const hands = s.hands.map((h, i) => (i === seat ? h.filter((c) => c !== m.card) : h));
  const trick = [...s.trick, { seat, card: m.card }];
  const blocked = s.contract === 'koz' ? s.trump : 1;
  const broken = s.broken || (trick.length > 1 && suitOf(m.card) === blocked && suitOf(trick[0].card) !== blocked) || (trick.length === 1 && suitOf(m.card) === blocked);
  const played = [...s.played, m.card];
  if (trick.length < 4) return { ...s, hands, trick, broken, played, turn: ((seat + 1) % 4) as Seat };

  const win = trickWinner(trick, s.contract === 'koz' ? s.trump : null).seat as Seat;
  const taken = s.taken.map((t, i) => (i === win ? [...t, ...trick.map((p) => p.card)] : t));
  const tricks = s.tricks.map((t, i) => (i === win ? t + 1 : t));
  const trickNo = s.trickNo + 1;
  const lastTwo = trickNo >= 12 ? [...s.lastTwo, win] : s.lastTwo;
  const next: KingState = { ...s, hands, trick: [], broken, played, taken, tricks, trickNo, lastTwo, lastTrick: { plays: trick, winner: win }, turn: win };
  return handOver(next) ? finishHand(next, ctx.random) : next;
}

export function view(s: KingState, seat: Seat): KingView {
  const caller = callerOf({ ...s, handNo: Math.min(s.handNo, s.totalHands - 1) });
  return {
    me: seat,
    n: 4,
    phase: s.phase,
    turn: s.turn,
    caller,
    hand: s.hands[seat] ?? [],
    handCounts: s.hands.map((h) => h.length),
    contract: s.contract,
    trump: s.trump,
    trick: s.trick,
    lastTrick: s.lastTrick,
    legal: s.phase === 'play' && s.turn === seat ? legalCards(s, s.hands[seat]) : [],
    allowed: s.phase === 'call' && s.turn === seat ? allowedContracts(s, seat) : [],
    tricks: s.tricks,
    running: s.phase === 'play' ? handPoints(s) : [0, 0, 0, 0],
    used: s.used,
    calls: s.calls,
    callsEach: s.callsEach,
    handNo: s.handNo,
    totalHands: s.totalHands,
    scores: s.scores,
    history: s.history,
    played: s.played,
    bidder: s.contract === 'koz' ? caller : null,
  };
}

export const activePlayers = (s: KingState): Seat[] => (s.phase === 'done' ? [] : [s.turn]);

export function result(s: KingState): GameResult | null {
  if (s.phase !== 'done') return null;
  const best = Math.max(...s.scores);
  return { winners: s.scores.map((x, i) => (x === best ? i : -1)).filter((i) => i >= 0) };
}

// ------------------------------------------------------------- bot

/** Rough expected loss for each penalty with this hand (lower is better) */
export function penaltyRisk(hand: Card[], p: Penalty): number {
  const ranks = (suit: number) => hand.filter((c) => suitOf(c) === suit).map(rankOf);
  const high = hand.filter((c) => rankOf(c) >= 11).length;
  const veryHigh = hand.filter((c) => rankOf(c) >= 13).length;
  const lows = hand.filter((c) => rankOf(c) <= 6).length;
  switch (p) {
    case 'el':
      return 50 * (veryHigh * 0.7 + high * 0.3 - lows * 0.15 + 1.5);
    case 'kupa': {
      const h = ranks(1);
      return 30 * (h.filter((r) => r >= 10).length * 1.2 + h.length * 0.4 + veryHigh * 0.3 + 1);
    }
    case 'erkek': {
      const kj = hand.filter((c) => rankOf(c) === 13 || rankOf(c) === 11).length;
      return 60 * (kj * 0.55 + hand.filter((c) => rankOf(c) === 14).length * 0.3 + 1);
    }
    case 'kiz': {
      const q = hand.filter((c) => rankOf(c) === 12);
      const guarded = q.filter((c) => ranks(suitOf(c)).filter((r) => r < 12).length >= 3).length;
      return 100 * ((q.length - guarded) * 0.6 + guarded * 0.25 + hand.filter((c) => rankOf(c) >= 13).length * 0.12 + 0.5);
    }
    case 'rifki': {
      const h = ranks(1);
      const hasK = hand.includes(K_HEARTS);
      const hasA = h.includes(14);
      const lowHearts = h.filter((r) => r < 13).length;
      return 320 * ((hasK ? (lowHearts >= 3 ? 0.35 : 0.7) : 0.18) + (hasA ? 0.25 : 0) - Math.min(0.1, lowHearts * 0.02));
    }
    case 'sonIki':
      return 180 * (veryHigh * 0.18 + high * 0.08 - lows * 0.05 + 0.4);
  }
}

function lowest(cs: Card[]) {
  return cs.slice().sort((a, b) => rankOf(a) - rankOf(b))[0];
}

function highest(cs: Card[]) {
  return cs.slice().sort((a, b) => rankOf(b) - rankOf(a))[0];
}

export function bot(v: KingView, _seat: Seat, ctx: BotCtx): KingMove {
  const r = ctx.random;
  if (v.phase === 'call') {
    const allowed = v.allowed;
    const pens = allowed.filter((c): c is Penalty => c !== 'koz');
    const est = estimateTricks(v.hand, 4);
    const lim = v.callsEach >= 5 ? 2 : 1;
    const kozLeft = lim - v.calls[v.me].koz;
    const callsLeft = v.callsEach - v.calls[v.me].koz - v.calls[v.me].pen;
    const mustKoz = !pens.length || (kozLeft > 0 && kozLeft >= callsLeft);
    if (allowed.includes('koz') && (mustKoz || est >= (ctx.level === 'easy' ? 3.5 : 4.3))) {
      return { type: 'call', contract: 'koz', suit: bestTrump(v.hand) };
    }
    if (ctx.level === 'easy') return { type: 'call', contract: pens[Math.floor(r() * pens.length)] };
    const best = pens.slice().sort((a, b) => penaltyRisk(v.hand, a) - penaltyRisk(v.hand, b))[0];
    return { type: 'call', contract: best };
  }

  const legal = v.legal;
  if (v.contract === 'koz') {
    // Trump games play like Batak: reuse its card play
    const m = batakBot({} as never, { ...v, phase: 'play', bidder: v.bidder } as never, ctx);
    if (m.type === 'play' && legal.includes(m.card)) return { type: 'play', card: m.card };
    return { type: 'play', card: legal[0] };
  }
  if (ctx.level === 'easy' && r() < 0.35) return { type: 'play', card: legal[Math.floor(r() * legal.length)] };

  const late = v.contract === 'sonIki' && v.hand.length <= 3;
  if (!v.trick.length) {
    // Lead low, away from penalty cards
    const safe = legal.filter((c) => !isPenaltyCard(v.contract, c));
    if (v.contract === 'sonIki' && !late) return { type: 'play', card: highest(legal) };
    return { type: 'play', card: lowest(safe.length ? safe : legal) };
  }
  const led = suitOf(v.trick[0].card);
  const following = legal.some((c) => suitOf(c) === led);
  if (!following) {
    // Discard: penalty cards first (forced anyway), then our most dangerous high card
    return { type: 'play', card: highest(legal) };
  }
  const hi = Math.max(...v.trick.filter((p) => suitOf(p.card) === led).map((p) => rankOf(p.card)));
  const under = legal.filter((c) => rankOf(c) < hi);
  if (v.contract === 'sonIki' && !late) {
    // Early in Son iki, tricks are free: get rid of high cards
    return { type: 'play', card: highest(legal) };
  }
  if (under.length) return { type: 'play', card: highest(under) };
  const last = v.trick.length === 3;
  const trickHasPenalty = v.trick.some((p) => isPenaltyCard(v.contract, p.card));
  // We will win this trick anyway: if it's harmless and we're last, win it with our highest
  if (last && !trickHasPenalty && v.contract !== 'el' && !late) {
    const nonPen = legal.filter((c) => !isPenaltyCard(v.contract, c));
    return { type: 'play', card: highest(nonPen.length ? nonPen : legal) };
  }
  return { type: 'play', card: lowest(legal) };
}
