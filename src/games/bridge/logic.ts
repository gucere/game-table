/**
 * Contract bridge with duplicate board scoring and cumulative partnership totals.
 * Rule references: ACBL Laws 18–22 (auction), 41/44/45 (dummy and play), 77 (score).
 * https://cdn.acbl.org/wp-content/uploads/2014/01/Laws-of-Duplicate-Bridge.pdf
 * This is a single-table match: no comparison with other tables or rubber bonuses.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';
import { trickWinner, type Play } from '../batak/engine';
import { deck, rankOf, shuffle, suitOf, type Card, type Suit } from '../cards/cards';

export const STRAINS = ['C', 'D', 'H', 'S', 'NT'] as const;
export type Strain = typeof STRAINS[number];
export const STRAIN_LABEL: Record<Strain, string> = { C: '♣', D: '♦', H: '♥', S: '♠', NT: 'NT' };
export const DIRECTIONS = ['N', 'E', 'S', 'W'];
export type VulnerabilityMode = 'rotate' | 'none' | 'both' | 'ns' | 'ew';
export type Multiplier = 1 | 2 | 4;
export interface Bid { level: number; strain: Strain; bidder: Seat }
export interface Contract extends Bid { declarer: Seat; dummy: Seat; multiplier: Multiplier }
export type Call = { type: 'bid'; level: number; strain: Strain } | { type: 'pass' | 'double' | 'redouble' };
export interface AuctionEntry { seat: Seat; call: Call }
export type BridgeMove = Call | { type: 'play'; card: Card } | { type: 'next' };

export interface ScoreBreakdown {
  score: number;
  target: number;
  made: boolean;
  contractPoints: number;
  overtrickPoints: number;
  bonus: number;
  slamBonus: number;
  insult: number;
  penalty: number;
}
export interface DealSummary {
  board: number;
  dealer: Seat;
  vulnerable: [boolean, boolean];
  contract: Contract | null;
  tricks: [number, number];
  delta: [number, number];
  breakdown: ScoreBreakdown | null;
}
export interface BridgeState {
  hands: Card[][];
  board: number;
  deals: number;
  dealer: Seat;
  vulnerability: VulnerabilityMode;
  vulnerable: [boolean, boolean];
  phase: 'auction' | 'play' | 'between' | 'done';
  turn: Seat;
  auction: AuctionEntry[];
  highest: Bid | null;
  multiplier: Multiplier;
  passes: number;
  contract: Contract | null;
  dummyRevealed: boolean;
  trick: Play[];
  lastTrick: { plays: Play[]; winner: Seat } | null;
  played: Card[];
  tricks: [number, number];
  scores: [number, number];
  history: DealSummary[];
}
export interface BridgeView extends Omit<BridgeState, 'hands'> {
  me: Seat;
  hand: Card[];
  handCounts: number[];
  dummyHand: Card[] | null;
  legal: Card[];
}

export const team = (seat: Seat): 0 | 1 => seat % 2 as 0 | 1;
export const trumpOf = (strain: Strain): Suit | null => ({ C: 2, D: 3, H: 1, S: 0, NT: null } as const)[strain];
export const bidRank = (bid: Pick<Bid, 'level' | 'strain'>) => (bid.level - 1) * 5 + STRAINS.indexOf(bid.strain);
export const contractLabel = (contract: Pick<Contract, 'level' | 'strain' | 'multiplier'>) => `${contract.level}${STRAIN_LABEL[contract.strain]}${contract.multiplier === 4 ? ' XX' : contract.multiplier === 2 ? ' X' : ''}`;

/** Standard 16-board cycle, with seat 0 = North and seat 1 = East. */
export function vulnerabilityFor(board: number, mode: VulnerabilityMode): [boolean, boolean] {
  const cycle = ['none', 'ns', 'ew', 'both', 'ns', 'ew', 'both', 'none', 'ew', 'both', 'none', 'ns', 'both', 'none', 'ns', 'ew'];
  const value = mode === 'rotate' ? cycle[(board - 1) % 16] : mode;
  return [value === 'ns' || value === 'both', value === 'ew' || value === 'both'];
}

function deal(s: BridgeState, random: () => number): BridgeState {
  const cards = shuffle(deck(), random);
  return {
    ...s, hands: [0, 1, 2, 3].map((i) => cards.slice(i * 13, i * 13 + 13)),
    vulnerable: vulnerabilityFor(s.board, s.vulnerability), phase: 'auction', turn: s.dealer,
    auction: [], highest: null, multiplier: 1, passes: 0, contract: null, dummyRevealed: false,
    trick: [], lastTrick: null, played: [], tricks: [0, 0],
  };
}

export function setup(ctx: Pick<GameCtx, 'options' | 'random'>): BridgeState {
  const vulnerability: VulnerabilityMode = ['none', 'both', 'ns', 'ew'].includes(ctx.options.vulnerability)
    ? ctx.options.vulnerability as VulnerabilityMode : 'rotate';
  const deals = ['1', '4', '8', '16'].includes(ctx.options.deals) ? Number(ctx.options.deals) : 4;
  return deal({
    hands: [], board: 1, deals, dealer: 0, vulnerability, vulnerable: [false, false], phase: 'auction', turn: 0,
    auction: [], highest: null, multiplier: 1, passes: 0, contract: null, dummyRevealed: false,
    trick: [], lastTrick: null, played: [], tricks: [0, 0], scores: [0, 0], history: [],
  }, ctx.random);
}

type AuctionState = Pick<BridgeState, 'phase' | 'highest' | 'multiplier' | 'turn'>;
export const canDouble = (s: AuctionState, seat: Seat) => s.phase === 'auction' && s.turn === seat && s.highest !== null && team(s.highest.bidder) !== team(seat) && s.multiplier === 1;
export const canRedouble = (s: AuctionState, seat: Seat) => s.phase === 'auction' && s.turn === seat && s.highest !== null && team(s.highest.bidder) === team(seat) && s.multiplier === 2;
export function legalBids(s: Pick<BridgeState, 'highest'>): { level: number; strain: Strain }[] {
  return Array.from({ length: 7 }, (_, i) => i + 1).flatMap((level) => STRAINS.map((strain) => ({ level, strain })))
    .filter((bid) => !s.highest || bidRank(bid) > bidRank(s.highest));
}

/** Signed score from the declaring partnership's perspective. */
export function scoreContract(contract: Pick<Contract, 'level' | 'strain' | 'multiplier'>, tricks: number, vulnerable: boolean): ScoreBreakdown {
  const { level, strain, multiplier } = contract;
  const target = level + 6;
  const base: ScoreBreakdown = { score: 0, target, made: tricks >= target, contractPoints: 0, overtrickPoints: 0, bonus: 0, slamBonus: 0, insult: 0, penalty: 0 };
  if (tricks < target) {
    const down = target - tricks;
    let penalty: number;
    if (multiplier === 1) penalty = down * (vulnerable ? 100 : 50);
    else {
      penalty = vulnerable ? 200 + (down - 1) * 300 : 100 + Math.min(2, down - 1) * 200 + Math.max(0, down - 3) * 300;
      if (multiplier === 4) penalty *= 2;
    }
    return { ...base, score: -penalty, penalty };
  }
  const minor = strain === 'C' || strain === 'D';
  const contractPoints = (level * (minor ? 20 : 30) + (strain === 'NT' ? 10 : 0)) * multiplier;
  const overtrickPoints = (tricks - target) * (multiplier === 1 ? minor ? 20 : 30 : (vulnerable ? 200 : 100) * multiplier / 2);
  const bonus = contractPoints >= 100 ? vulnerable ? 500 : 300 : 50;
  const slamBonus = level === 6 ? vulnerable ? 750 : 500 : level === 7 ? vulnerable ? 1500 : 1000 : 0;
  const insult = multiplier === 4 ? 100 : multiplier === 2 ? 50 : 0;
  return { ...base, contractPoints, overtrickPoints, bonus, slamBonus, insult, score: contractPoints + overtrickPoints + bonus + slamBonus + insult };
}

function finishDeal(s: BridgeState): BridgeState {
  const contract = s.contract;
  const declaringTeam = contract ? team(contract.declarer) : 0;
  const breakdown = contract ? scoreContract(contract, s.tricks[declaringTeam], s.vulnerable[declaringTeam]) : null;
  const ns = (breakdown?.score ?? 0) * (declaringTeam === 0 ? 1 : -1);
  const delta: [number, number] = [ns, -ns];
  const summary: DealSummary = { board: s.board, dealer: s.dealer, vulnerable: [...s.vulnerable], contract, tricks: [...s.tricks], delta, breakdown };
  return {
    ...s, phase: s.board >= s.deals ? 'done' : 'between', turn: (s.dealer + 1) % 4,
    scores: [s.scores[0] + delta[0], s.scores[1] + delta[1]], history: [...s.history, summary],
  };
}

function endAuction(s: BridgeState): BridgeState {
  if (!s.highest) return finishDeal(s);
  const highest = s.highest;
  const first = s.auction.find((entry) => entry.call.type === 'bid' && entry.call.strain === highest.strain && team(entry.seat) === team(highest.bidder))!;
  const contract: Contract = { ...highest, multiplier: s.multiplier, declarer: first.seat, dummy: (first.seat + 2) % 4 };
  return { ...s, contract, phase: 'play', turn: (contract.declarer + 1) % 4 };
}

/** The declarer submits both their own plays and dummy's plays. */
export function activePlayers(s: Pick<BridgeState, 'phase' | 'turn' | 'contract'>): Seat[] {
  if (s.phase === 'done') return [];
  return [s.phase === 'play' && s.contract && s.turn === s.contract.dummy ? s.contract.declarer : s.turn];
}

export function legalCards(trick: Play[], hand: Card[]): Card[] {
  if (!trick.length) return [...hand];
  const follow = hand.filter((card) => suitOf(card) === suitOf(trick[0].card));
  return follow.length ? follow : [...hand];
}

export function move(s: BridgeState, seat: Seat, m: BridgeMove, ctx: Pick<GameCtx, 'random'>): BridgeState | string {
  if (s.phase === 'done') return 'The game is over';
  if (!activePlayers(s).includes(seat)) return 'Not your turn';
  if (!m || typeof m !== 'object') return 'Choose a bridge action';
  if (s.phase === 'between') return m.type === 'next' ? deal({ ...s, board: s.board + 1, dealer: (s.dealer + 1) % 4 }, ctx.random) : 'Start the next deal';
  if (s.phase === 'auction') {
    let highest = s.highest;
    let multiplier = s.multiplier;
    let passes = 0;
    if (m.type === 'bid') {
      if (!Number.isInteger(m.level) || m.level < 1 || m.level > 7 || !STRAINS.includes(m.strain)
        || (highest && bidRank(m) <= bidRank(highest))) return 'Make a higher bid from 1 to 7';
      highest = { level: m.level, strain: m.strain, bidder: seat };
      multiplier = 1;
    } else if (m.type === 'pass') passes = s.passes + 1;
    else if (m.type === 'double') {
      if (!canDouble(s, seat)) return 'Only an opponent can double an undoubled bid';
      multiplier = 2;
    } else if (m.type === 'redouble') {
      if (!canRedouble(s, seat)) return 'Only the declaring side can redouble a doubled bid';
      multiplier = 4;
    } else return 'Bid, pass, double or redouble';
    const next: BridgeState = { ...s, highest, multiplier, passes, auction: [...s.auction, { seat, call: m }], turn: (seat + 1) % 4 };
    return passes >= (highest ? 3 : 4) ? endAuction(next) : next;
  }
  if (m.type !== 'play' || !legalCards(s.trick, s.hands[s.turn]).includes(m.card)) return 'Play a card from the correct hand and follow suit';
  const playedSeat = s.turn;
  const hands = s.hands.map((hand, i) => i === playedSeat ? hand.filter((card) => card !== m.card) : hand);
  const trick = [...s.trick, { seat: playedSeat, card: m.card }];
  if (trick.length < 4) return { ...s, hands, trick, dummyRevealed: true, turn: (playedSeat + 1) % 4 };
  const winner = trickWinner(trick, trumpOf(s.contract!.strain)).seat;
  const tricks: [number, number] = [...s.tricks];
  tricks[team(winner)]++;
  const next: BridgeState = { ...s, hands, trick: [], dummyRevealed: true, turn: winner, tricks, played: [...s.played, ...trick.map((p) => p.card)], lastTrick: { plays: trick, winner } };
  return next.played.length === 52 ? finishDeal(next) : next;
}

export function view(s: BridgeState, seat: Seat): BridgeView {
  const { hands, ...rest } = s;
  const privatePhase = s.phase === 'auction' || s.phase === 'play';
  return {
    ...rest, me: seat, hand: privatePhase ? [...hands[seat]] : [], handCounts: hands.map((hand) => hand.length),
    dummyHand: s.dummyRevealed && s.contract ? [...hands[s.contract.dummy]] : null,
    legal: s.phase === 'play' && activePlayers(s).includes(seat) ? legalCards(s.trick, hands[s.turn]) : [],
  };
}

export function result(s: BridgeState): GameResult | null {
  if (s.phase !== 'done') return null;
  if (s.scores[0] === s.scores[1]) return { winners: [], draw: true };
  const winner = s.scores[0] > s.scores[1] ? 0 : 1;
  return { winners: [winner, winner + 2] };
}

export const highCardPoints = (hand: Card[]) => hand.reduce((sum, card) => sum + Math.max(0, rankOf(card) - 10), 0);

/** Simple natural bidding only; bots use their own hand and the public auction. */
function botCall(v: BridgeView, seat: Seat, ctx: BotCtx): Call {
  const points = highCardPoints(v.hand);
  const lengths = STRAINS.slice(0, 4).map((strain) => ({ strain, length: v.hand.filter((card) => suitOf(card) === trumpOf(strain)).length }));
  const longest = [...lengths].sort((a, b) => b.length - a.length || STRAINS.indexOf(b.strain) - STRAINS.indexOf(a.strain))[0];
  const balanced = lengths.every((suit) => suit.length >= 2) && lengths.filter((suit) => suit.length === 2).length <= 1;
  const ownBid = v.auction.some((entry) => entry.seat === seat && entry.call.type === 'bid');
  const highest = v.highest;
  if (canRedouble(v, seat) && points >= 18) return { type: 'redouble' };
  if (canDouble(v, seat) && highest!.level >= 4 && points >= 18 && ctx.level !== 'easy') return { type: 'double' };
  if (ownBid) return { type: 'pass' };
  const bidIn = (strain: Strain, minLevel = 1, maxLevel = 7): Call => {
    const bid = legalBids(v).find((bid) => bid.strain === strain && bid.level >= minLevel && bid.level <= maxLevel);
    return bid ? { type: 'bid', ...bid } : { type: 'pass' };
  };
  if (!highest) {
    if (points < 12) return { type: 'pass' };
    if (balanced && points >= 15 && points <= 17) return bidIn('NT');
    if (longest.length >= 5) return bidIn(longest.strain);
    const minor = [...lengths].filter((suit) => suit.strain === 'C' || suit.strain === 'D').sort((a, b) => b.length - a.length)[0];
    return bidIn(minor.strain);
  }
  if (team(highest.bidder) === team(seat)) {
    if (points < 6) return { type: 'pass' };
    const support = lengths.find((suit) => suit.strain === highest.strain)?.length ?? 0;
    if (highest.strain === 'NT') return points >= 10 ? bidIn('NT', 3, 3) : points >= 8 ? bidIn('NT', 2, 2) : { type: 'pass' };
    if (support >= 3 && (highest.strain === 'H' || highest.strain === 'S')) return bidIn(highest.strain, points >= 13 ? 4 : points >= 10 ? 3 : 2, 4);
    if (support >= 4) return bidIn(highest.strain, points >= 16 ? 5 : points >= 10 ? 3 : 2, points >= 16 ? 5 : 3);
    if (balanced && points >= 10) return bidIn('NT', points >= 13 ? 3 : 2, 3);
    if (longest.length >= 5 && points >= 8) return bidIn(longest.strain, 1, 2);
    return { type: 'pass' };
  }
  if (points >= 13 && longest.length >= 5) return bidIn(longest.strain, 1, 2);
  if (points >= 17 && balanced) return bidIn('NT', 1, 2);
  return { type: 'pass' };
}

export function bot(v: BridgeView, seat: Seat, ctx: BotCtx): BridgeMove {
  if (v.phase === 'between') return { type: 'next' };
  if (v.phase === 'auction') return botCall(v, seat, ctx);
  const trump = trumpOf(v.contract!.strain);
  const cost = (card: Card) => rankOf(card) + (suitOf(card) === trump ? 20 : 0);
  const low = (cards: Card[]) => [...cards].sort((a, b) => cost(a) - cost(b))[0];
  if (ctx.level === 'easy' && ctx.random() < 0.3) return { type: 'play', card: v.legal[Math.floor(ctx.random() * v.legal.length)] };
  if (!v.trick.length) {
    const aces = v.legal.filter((card) => rankOf(card) === 14);
    return { type: 'play', card: aces.length ? low(aces) : low(v.legal) };
  }
  const current = trickWinner(v.trick, trump).seat;
  if (team(current) === team(v.turn)) return { type: 'play', card: low(v.legal) };
  const winners = v.legal.filter((card) => trickWinner([...v.trick, { seat: v.turn, card }], trump).seat === v.turn);
  return { type: 'play', card: low(winners.length ? winners : v.legal) };
}
