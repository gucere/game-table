/**
 * Shared trick-taking engine for the Batak family.
 * Each variant is just a config: player count, deal, bidding style, kitty, play obligations.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';
import { deck, rankOf, remove, shuffle, suitOf, type Card, type Suit } from '../cards/cards';

export interface BatakConfig {
  id: string;
  players: number;
  handSize: number;
  /** Cards left in the middle after the deal */
  kitty: number;
  /** auction: bid for the contract; targets: fixed 8/5/3 by seat (3-5-8) */
  mode: 'auction' | 'targets';
  /** bidder: contract winner takes the kitty and buries as many; dealer: dealer buries blind, then takes the kitty */
  kittyRule: 'none' | 'bidder' | 'dealer';
  /** Honeymoon-style draw phase instead of a deal (2 players) */
  draw: boolean;
  minBid: number;
  /** Must play higher than the best card of the led suit when you can */
  mustBeat: boolean;
  /** Must trump when out of the led suit (and over-trump when possible if mustBeat) */
  mustTrump: boolean;
  /** Trumps can't be led until someone has trumped (unless you only have trumps) */
  trumpLead: boolean;
  /** Fixed targets by position relative to the dealer: [dealer, left, right] */
  targets?: number[];
  /** Partners sit opposite (0 & 2, 1 & 3) and play the contract together */
  teams?: boolean;
}

/** Tricks the bidder's side has taken (the bidder alone, or with their partner) */
export function sideTricks(cfg: Pick<BatakConfig, 'teams'>, s: { tricks: number[]; n: number }, seat: Seat) {
  return cfg.teams ? s.tricks[seat] + s.tricks[(seat + 2) % s.n] : s.tricks[seat];
}

export interface Play {
  seat: Seat;
  card: Card;
}

export interface HandRecord {
  bidder: Seat | null;
  contract: number;
  trump: Suit | null;
  tricks: number[];
  delta: number[];
}

export interface TState {
  cfgId: string;
  n: number;
  dealer: Seat;
  handNo: number;
  totalHands: number;
  phase: 'draw' | 'bid' | 'bury' | 'trump' | 'play' | 'done';
  hands: Card[][];
  kitty: Card[];
  stock: Card[];
  turn: Seat;
  bids: (number | null)[];
  passed: boolean[];
  bidder: Seat | null;
  contract: number;
  targets: number[];
  trump: Suit | null;
  trumpBroken: boolean;
  trick: Play[];
  tricks: number[];
  lastTrick: { plays: Play[]; winner: Seat } | null;
  played: Card[];
  scores: number[];
  history: HandRecord[];
  notice: string;
}

export interface TView {
  cfgId: string;
  n: number;
  me: Seat;
  phase: TState['phase'];
  dealer: Seat;
  handNo: number;
  totalHands: number;
  hand: Card[];
  handCounts: number[];
  turn: Seat;
  bids: (number | null)[];
  passed: boolean[];
  bidder: Seat | null;
  contract: number;
  targets: number[];
  trump: Suit | null;
  trumpBroken: boolean;
  trick: Play[];
  tricks: number[];
  lastTrick: TState['lastTrick'];
  played: Card[];
  scores: number[];
  history: HandRecord[];
  legal: Card[];
  /** Cards you must bury now (0 if not your job) */
  buryCount: number;
  /** Top of the stock, only for the player drawing */
  drawCard: Card | null;
  stockCount: number;
  minBid: number;
  /** Must bid (everyone else passed) */
  forcedBid: boolean;
  notice: string;
}

export type TMove =
  | { type: 'bid'; n: number }
  | { type: 'pass' }
  | { type: 'trump'; suit: Suit }
  | { type: 'bury'; cards: Card[] }
  | { type: 'play'; card: Card }
  | { type: 'keep' }
  | { type: 'skip' };

const next = (s: { n: number }, seat: Seat) => ((seat + 1) % s.n) as Seat;

// ------------------------------------------------------------- deal

export function deal(cfg: BatakConfig, s: TState, random: () => number): TState {
  const cards = shuffle(deck(), random);
  const n = cfg.players;
  const base: TState = {
    ...s,
    hands: Array.from({ length: n }, () => []),
    kitty: [],
    stock: [],
    bids: Array(n).fill(null),
    passed: Array(n).fill(false),
    bidder: null,
    contract: 0,
    targets: Array(n).fill(0),
    trump: null,
    trumpBroken: false,
    trick: [],
    tricks: Array(n).fill(0),
    lastTrick: s.lastTrick,
    played: [],
  };
  if (cfg.draw) {
    return { ...base, stock: cards, phase: 'draw', turn: next(base, s.dealer) };
  }
  for (let i = 0; i < n; i++) base.hands[i] = cards.slice(i * cfg.handSize, (i + 1) * cfg.handSize);
  base.kitty = cards.slice(n * cfg.handSize, n * cfg.handSize + cfg.kitty);
  if (cfg.mode === 'targets') {
    const t = cfg.targets ?? [8, 5, 3];
    const targets = Array(n).fill(0);
    for (let k = 0; k < n; k++) targets[(s.dealer + k) % n] = t[k];
    return { ...base, targets, phase: 'trump', turn: s.dealer, bidder: s.dealer };
  }
  return { ...base, phase: 'bid', turn: next(base, s.dealer) };
}

export function setupWith(cfg: BatakConfig, ctx: Pick<GameCtx, 'random' | 'options'>): TState {
  const n = cfg.players;
  const empty: TState = {
    cfgId: cfg.id,
    n,
    dealer: Math.floor(ctx.random() * n),
    handNo: 0,
    totalHands: Number(ctx.options.hands) || n,
    phase: 'bid',
    hands: [],
    kitty: [],
    stock: [],
    turn: 0,
    bids: [],
    passed: [],
    bidder: null,
    contract: 0,
    targets: [],
    trump: null,
    trumpBroken: false,
    trick: [],
    tricks: [],
    lastTrick: null,
    played: [],
    scores: Array(n).fill(0),
    history: [],
    notice: '',
  };
  return deal(cfg, empty, ctx.random);
}

// ------------------------------------------------------------- rules

export function trickWinner(plays: Play[], trump: Suit | null): Play {
  const led = suitOf(plays[0].card);
  let best = plays[0];
  for (const p of plays.slice(1)) {
    const s = suitOf(p.card);
    const bs = suitOf(best.card);
    if (s === bs && rankOf(p.card) > rankOf(best.card)) best = p;
    else if (s === trump && bs !== trump) best = p;
    else if (s === led && bs !== led && bs !== trump) best = p;
  }
  return best;
}

export function legalCards(cfg: BatakConfig, hand: Card[], trick: Play[], trump: Suit | null, trumpBroken: boolean): Card[] {
  if (!trick.length) {
    if (cfg.trumpLead && trump !== null && !trumpBroken) {
      const nonTrump = hand.filter((c) => suitOf(c) !== trump);
      if (nonTrump.length) return nonTrump;
    }
    return hand;
  }
  const led = suitOf(trick[0].card);
  const follow = hand.filter((c) => suitOf(c) === led);
  const trumped = led !== trump && trick.some((p) => suitOf(p.card) === trump);
  if (follow.length) {
    if (cfg.mustBeat && !trumped) {
      const hi = Math.max(...trick.filter((p) => suitOf(p.card) === led).map((p) => rankOf(p.card)));
      const higher = follow.filter((c) => rankOf(c) > hi);
      if (higher.length) return higher;
    }
    return follow;
  }
  const trumps = trump === null ? [] : hand.filter((c) => suitOf(c) === trump);
  if (cfg.mustTrump && trumps.length) {
    if (cfg.mustBeat && trumped) {
      const hiT = Math.max(...trick.filter((p) => suitOf(p.card) === trump).map((p) => rankOf(p.card)));
      const over = trumps.filter((c) => rankOf(c) > hiT);
      if (over.length) return over;
    }
    return trumps;
  }
  return hand;
}

function scoreHand(cfg: BatakConfig, s: TState): number[] {
  if (cfg.mode === 'targets') return s.tricks.map((t, i) => t - s.targets[i]);
  if (cfg.teams && s.bidder !== null) {
    // The bidder's team plays the contract together; falling short costs the bidder the bid
    const made = sideTricks(cfg, s, s.bidder) >= s.contract;
    const partner = (s.bidder + 2) % s.n;
    return s.tricks.map((t, i) => (i === s.bidder ? (made ? t : -s.contract) : i === partner ? (made ? t : 0) : t));
  }
  return s.tricks.map((t, i) => {
    if (i !== s.bidder) return t;
    return t >= s.contract ? t : -s.contract;
  });
}

function endHand(cfg: BatakConfig, s: TState, random: () => number): TState {
  const delta = scoreHand(cfg, s);
  const scores = s.scores.map((x, i) => x + delta[i]);
  const rec: HandRecord = { bidder: s.bidder, contract: cfg.mode === 'targets' ? 0 : s.contract, trump: s.trump, tricks: s.tricks, delta };
  const history = [...s.history, rec];
  const handNo = s.handNo + 1;
  let notice = '';
  if (cfg.mode === 'auction' && s.bidder !== null) {
    const got = sideTricks(cfg, s, s.bidder);
    notice = got >= s.contract ? `Contract made (${got}/${s.contract}).` : `Contract failed (${got}/${s.contract}).`;
  }
  const after: TState = { ...s, scores, history, handNo, notice };
  if (handNo >= s.totalHands) return { ...after, phase: 'done' };
  return deal(cfg, { ...after, dealer: next(s, s.dealer) }, random);
}

function startPlay(s: TState, leader: Seat): TState {
  return { ...s, phase: 'play', turn: leader, trick: [] };
}

export function applyMove(cfg: BatakConfig, s: TState, seat: Seat, m: TMove, random: () => number): TState | string {
  if (s.phase === 'done') return 'The game is over';
  if (seat !== s.turn) return 'Not your turn';
  const hand = s.hands[seat];

  switch (s.phase) {
    case 'draw': {
      if (m.type !== 'keep' && m.type !== 'skip') return 'Keep or pass the card';
      const stock = s.stock.slice();
      const top = stock.shift()!;
      const second = stock.shift()!;
      const take = m.type === 'keep' ? top : second;
      const hands = s.hands.map((h, i) => (i === seat ? [...h, take] : h));
      const ns: TState = { ...s, stock, hands, turn: next(s, seat) };
      if (!stock.length) return { ...ns, phase: 'bid', turn: next(s, s.dealer) };
      return ns;
    }

    case 'bid': {
      const high = Math.max(0, ...s.bids.map((b) => b ?? 0));
      const others = s.passed.filter((p, i) => p && i !== seat).length;
      const forced = others === s.n - 1 && high === 0;
      if (m.type === 'pass') {
        if (forced) return 'Everyone else passed: you must bid';
        const passed = s.passed.slice();
        passed[seat] = true;
        return advanceBidding(cfg, { ...s, passed }, seat);
      }
      if (m.type !== 'bid') return 'Bid or pass';
      const max = cfg.handSize;
      if (!Number.isInteger(m.n) || m.n < Math.max(cfg.minBid, high + 1) || m.n > max) return 'Bid must be higher than the current bid';
      const bids = s.bids.slice();
      bids[seat] = m.n;
      return advanceBidding(cfg, { ...s, bids }, seat);
    }

    case 'bury': {
      if (m.type !== 'bury') return 'Choose cards to bury';
      const cards = m.cards ?? [];
      if (cards.length !== cfg.kitty || new Set(cards).size !== cards.length || !cards.every((c) => hand.includes(c))) return `Pick exactly ${cfg.kitty} cards`;
      let newHand = remove(hand, cards);
      if (cfg.kittyRule === 'dealer') {
        newHand = [...newHand, ...s.kitty];
        const hands = s.hands.map((h, i) => (i === seat ? newHand : h));
        return startPlay({ ...s, hands, kitty: [] }, next(s, s.dealer));
      }
      const hands = s.hands.map((h, i) => (i === seat ? newHand : h));
      return { ...s, hands, kitty: [], phase: 'trump' };
    }

    case 'trump': {
      if (m.type !== 'trump' || ![0, 1, 2, 3].includes(m.suit)) return 'Pick a trump suit';
      const ns = { ...s, trump: m.suit };
      if (cfg.kittyRule === 'dealer') return { ...ns, phase: 'bury' };
      return startPlay(ns, s.bidder!);
    }

    case 'play': {
      if (m.type !== 'play') return 'Play a card';
      const legal = legalCards(cfg, hand, s.trick, s.trump, s.trumpBroken);
      if (!legal.includes(m.card)) return 'You can’t play that card now';
      const trick = [...s.trick, { seat, card: m.card }];
      const hands = s.hands.map((h, i) => (i === seat ? remove(h, [m.card]) : h));
      const trumpBroken = s.trumpBroken || suitOf(m.card) === s.trump;
      const played = [...s.played, m.card];
      if (trick.length < s.n) return { ...s, hands, trick, trumpBroken, played, turn: next(s, seat) };
      const w = trickWinner(trick, s.trump).seat;
      const tricks = s.tricks.slice();
      tricks[w]++;
      const ns: TState = { ...s, hands, trick: [], trumpBroken, played, tricks, lastTrick: { plays: trick, winner: w }, turn: w };
      if (hands.every((h) => h.length === 0)) return endHand(cfg, ns, random);
      return ns;
    }
  }
  return 'Unknown move';
}

function advanceBidding(cfg: BatakConfig, s: TState, from: Seat): TState {
  const high = Math.max(0, ...s.bids.map((b) => b ?? 0));
  const remaining = s.passed.map((p, i) => (!p ? i : -1)).filter((i) => i >= 0);
  const highSeat = s.bids.findIndex((b) => b === high && high > 0);
  // Auction over: one player left who holds the high bid, or the max was bid
  if ((remaining.length === 1 && highSeat === remaining[0]) || high === cfg.handSize) {
    return contractWon(cfg, { ...s, bidder: highSeat, contract: high });
  }
  if (remaining.length === 0) {
    // Everybody passed (only possible if forced rule was skipped): dealer plays minimum
    return contractWon(cfg, { ...s, bidder: s.dealer, contract: cfg.minBid });
  }
  let t = next(s, from);
  while (s.passed[t]) t = next(s, t);
  return { ...s, turn: t };
}

function contractWon(cfg: BatakConfig, s: TState): TState {
  const b = s.bidder!;
  const targets = Array(s.n).fill(0);
  targets[b] = s.contract;
  if (cfg.kittyRule === 'bidder' && s.kitty.length) {
    const hands = s.hands.map((h, i) => (i === b ? [...h, ...s.kitty] : h));
    return { ...s, hands, targets, phase: 'bury', turn: b };
  }
  return { ...s, targets, phase: 'trump', turn: b };
}

// ------------------------------------------------------------- view

export function viewOf(cfg: BatakConfig, s: TState, seat: Seat): TView {
  const myTurn = s.turn === seat;
  const high = Math.max(0, ...s.bids.map((b) => b ?? 0));
  return {
    cfgId: s.cfgId,
    n: s.n,
    me: seat,
    phase: s.phase,
    dealer: s.dealer,
    handNo: s.handNo,
    totalHands: s.totalHands,
    hand: s.hands[seat] ?? [],
    handCounts: s.hands.map((h) => h.length),
    turn: s.turn,
    bids: s.bids,
    passed: s.passed,
    bidder: s.bidder,
    contract: s.contract,
    targets: s.targets,
    trump: s.trump,
    trumpBroken: s.trumpBroken,
    trick: s.trick,
    tricks: s.tricks,
    lastTrick: s.lastTrick,
    played: s.played,
    scores: s.scores,
    history: s.history,
    legal: myTurn && s.phase === 'play' ? legalCards(cfg, s.hands[seat], s.trick, s.trump, s.trumpBroken) : [],
    buryCount: myTurn && s.phase === 'bury' ? cfg.kitty : 0,
    drawCard: myTurn && s.phase === 'draw' ? s.stock[0] ?? null : null,
    stockCount: s.stock.length,
    minBid: Math.max(cfg.minBid, high + 1),
    forcedBid: s.phase === 'bid' && high === 0 && s.passed.filter((p, i) => p && i !== seat).length === s.n - 1,
    notice: s.notice,
  };
}

export function resultOf(s: TState, cfg?: BatakConfig): GameResult | null {
  if (s.phase !== 'done') return null;
  if (cfg?.teams) {
    const team = [s.scores[0] + s.scores[2], s.scores[1] + s.scores[3]];
    if (team[0] === team[1]) return { winners: [], draw: true };
    const t = team[0] > team[1] ? 0 : 1;
    return { winners: [t, t + 2] };
  }
  const best = Math.max(...s.scores);
  return { winners: s.scores.map((x, i) => (x === best ? i : -1)).filter((i) => i >= 0) };
}

// ------------------------------------------------------------- bot

function suitStrength(hand: Card[], suit: number) {
  const cards = hand.filter((c) => suitOf(c) === suit);
  return cards.length * 1.2 + cards.reduce((a, c) => a + Math.max(0, rankOf(c) - 10) * 0.5, 0);
}

export function bestTrump(hand: Card[]): Suit {
  let best: Suit = 0;
  for (const s of [0, 1, 2, 3] as Suit[]) if (suitStrength(hand, s) > suitStrength(hand, best)) best = s;
  return best;
}

export function estimateTricks(hand: Card[], players: number, bonus = 0): number {
  let raw = 0;
  const trump = bestTrump(hand);
  for (const s of [0, 1, 2, 3]) {
    const cards = hand.filter((c) => suitOf(c) === s).map(rankOf);
    const len = cards.length;
    if (cards.includes(14)) raw += 1;
    if (cards.includes(13) && len >= 2) raw += 0.7;
    if (cards.includes(12) && len >= 3) raw += 0.35;
    if (s === trump) raw += Math.max(0, len - 2) * 0.85;
    else if (len <= 1) raw += 0.3; // void/singleton: can trump in
  }
  return (raw + bonus) * (hand.length / 13) * Math.min(2, 4 / players) * (players === 4 ? 1 : 0.85);
}

function winsNow(trick: Play[], card: Card, trump: Suit | null) {
  return trickWinner([...trick, { seat: -1, card }], trump).seat === -1;
}

export function botMove(cfg: BatakConfig, v: TView, ctx: BotCtx): TMove {
  const r = ctx.random;
  switch (v.phase) {
    case 'draw': {
      const c = v.drawCard!;
      // Keep high cards and cards of our longest suit
      const sameSuit = v.hand.filter((x) => suitOf(x) === suitOf(c)).length;
      return rankOf(c) >= 11 || sameSuit >= 4 ? { type: 'keep' } : { type: 'skip' };
    }
    case 'bid': {
      const bonus = cfg.kittyRule === 'bidder' ? 0.6 : 0;
      let est = estimateTricks(v.hand, v.n, bonus) + (cfg.teams ? 2.6 : 0);
      if (ctx.level === 'easy') est += (r() - 0.5) * 2;
      if (ctx.level === 'normal') est -= 0.3;
      const want = Math.floor(est);
      if (v.forcedBid) return { type: 'bid', n: v.minBid };
      if (want >= v.minBid) return { type: 'bid', n: v.minBid };
      return { type: 'pass' };
    }
    case 'bury': {
      const trump = bestTrump(v.hand);
      const keepScore = (c: Card) => (suitOf(c) === trump ? 100 : 0) + rankOf(c) * 2 + v.hand.filter((x) => suitOf(x) === suitOf(c)).length;
      const cards = v.hand.slice().sort((a, b) => keepScore(a) - keepScore(b)).slice(0, v.buryCount);
      return { type: 'bury', cards };
    }
    case 'trump':
      return { type: 'trump', suit: bestTrump(v.hand) };
    case 'play': {
      const legal = v.legal;
      if (ctx.level === 'easy' && r() < 0.4) return { type: 'play', card: legal[Math.floor(r() * legal.length)] };
      const low = (cs: Card[]) => cs.slice().sort((a, b) => rankOf(a) - rankOf(b) + (suitOf(a) === v.trump ? 20 : 0) - (suitOf(b) === v.trump ? 20 : 0))[0];
      if (!v.trick.length) {
        // Lead a card that is the highest remaining in its suit
        const gone = new Set(v.played);
        const boss = legal.filter((c) => {
          for (let rk = rankOf(c) + 1; rk <= 14; rk++) {
            const higher = suitOf(c) * 13 + (rk - 2);
            if (!gone.has(higher) && !v.hand.includes(higher)) return false;
          }
          return suitOf(c) !== v.trump || v.bidder === v.me;
        });
        if (boss.length) return { type: 'play', card: boss.sort((a, b) => rankOf(b) - rankOf(a))[0] };
        const myTrumps = legal.filter((c) => suitOf(c) === v.trump);
        if (v.bidder === v.me && myTrumps.length >= 3 && ctx.level === 'hard') {
          return { type: 'play', card: myTrumps.sort((a, b) => rankOf(b) - rankOf(a))[0] };
        }
        return { type: 'play', card: low(legal) };
      }
      const winners = legal.filter((c) => winsNow(v.trick, c, v.trump));
      // Partner already has this trick: keep our high cards
      if (cfg.teams && trickWinner(v.trick, v.trump).seat === (v.me + 2) % v.n) return { type: 'play', card: low(legal) };
      const last = v.trick.length === v.n - 1;
      // In 3-5-8 a player who already hit their target still wants overtricks; in Batak everyone wants tricks
      if (winners.length) {
        const sorted = winners.sort((a, b) => rankOf(a) - rankOf(b) + (suitOf(a) === v.trump ? 20 : 0) - (suitOf(b) === v.trump ? 20 : 0));
        return { type: 'play', card: last || ctx.level !== 'hard' ? sorted[0] : sorted[sorted.length - 1] };
      }
      return { type: 'play', card: low(legal) };
    }
  }
  return { type: 'pass' };
}
