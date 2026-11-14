/**
 * Bluff (Blöf / Cheat). All 52 cards are dealt. The leader names a rank and plays 1–4 cards
 * face down claiming they are that rank. Others, in turn, play more cards "of the same rank",
 * pass, or call "Bluff!" on the previous play. A caught liar picks up the pile; a wrong
 * accuser picks it up instead. If everyone passes, the pile is cleared. First to empty
 * their hand (and survive a challenge) wins.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';
import { deck, rankOf, remove, shuffle, type Card } from '../cards/cards';

export interface BluffPlay {
  seat: Seat;
  cards: Card[];
}

export interface Reveal {
  seat: Seat;
  caller: Seat;
  cards: Card[];
  claim: number;
  lie: boolean;
}

export interface BluffState {
  n: number;
  hands: Card[][];
  pile: BluffPlay[];
  claim: number | null;
  turn: Seat;
  passes: number;
  reveal: Reveal | null;
  winner: Seat | null;
  cleared: number;
  log: string[];
}

export interface BluffView {
  n: number;
  me: Seat;
  hand: Card[];
  handCounts: number[];
  pile: { seat: Seat; count: number }[];
  pileCount: number;
  claim: number | null;
  turn: Seat;
  passes: number;
  reveal: Reveal | null;
  winner: Seat | null;
  log: string[];
}

export type BluffMove = { type: 'play'; cards: Card[]; rank?: number } | { type: 'pass' } | { type: 'call' };

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'random'>): BluffState {
  const n = ctx.numPlayers;
  const cards = shuffle(deck(), ctx.random);
  const hands: Card[][] = Array.from({ length: n }, () => []);
  cards.forEach((c, i) => hands[i % n].push(c));
  return { n, hands, pile: [], claim: null, turn: Math.floor(ctx.random() * n), passes: 0, reveal: null, winner: null, cleared: 0, log: [] };
}

const next = (s: BluffState, seat: Seat) => ((seat + 1) % s.n) as Seat;

const lastPlay = (s: BluffState): BluffPlay | undefined => s.pile[s.pile.length - 1];

/** A player who emptied their hand wins once the next player doesn't challenge */
function checkSurvivor(s: BluffState): BluffState | null {
  const lp = lastPlay(s);
  if (lp && s.hands[lp.seat].length === 0) return { ...s, winner: lp.seat };
  return null;
}

export function move(s: BluffState, seat: Seat, m: BluffMove): BluffState | string {
  if (s.winner !== null) return 'The game is over';
  if (seat !== s.turn) return 'Not your turn';
  const hand = s.hands[seat];
  const lp = lastPlay(s);

  if (m.type === 'call') {
    if (!lp || lp.seat === seat) return 'Nothing to challenge';
    const lie = lp.cards.some((c) => rankOf(c) !== s.claim);
    const loser = lie ? lp.seat : seat;
    const all = s.pile.flatMap((p) => p.cards);
    const hands = s.hands.map((h, i) => (i === loser ? [...h, ...all] : h));
    const reveal: Reveal = { seat: lp.seat, caller: seat, cards: lp.cards, claim: s.claim!, lie };
    const ns: BluffState = { ...s, hands, pile: [], claim: null, passes: 0, reveal };
    // The truthful one leads; if that is someone who just emptied their hand, they win
    const leader = lie ? seat : lp.seat;
    if (!lie && hands[lp.seat].length === 0) return { ...ns, winner: lp.seat };
    return { ...ns, turn: leader };
  }

  if (m.type === 'pass') {
    if (!lp || s.claim === null) return 'You have to lead';
    const won = checkSurvivor(s);
    if (won) return won;
    const passes = s.passes + 1;
    if (passes >= s.n - 1) {
      // Everyone passed since the last play: the pile is cleared, last player leads
      const cleared = s.cleared + s.pile.reduce((a, p) => a + p.cards.length, 0);
      return { ...s, pile: [], claim: null, passes: 0, cleared, turn: lp.seat, reveal: null };
    }
    return { ...s, passes, turn: next(s, seat), reveal: null };
  }

  if (m.type === 'play') {
    const cards = m.cards ?? [];
    if (cards.length < 1 || cards.length > 4 || new Set(cards).size !== cards.length || !cards.every((c) => hand.includes(c))) return 'Play 1 to 4 of your cards';
    let claim = s.claim;
    if (claim === null) {
      if (!Number.isInteger(m.rank) || m.rank! < 2 || m.rank! > 14) return 'Name a rank';
      claim = m.rank!;
    }
    const won = checkSurvivor(s);
    if (won) return won;
    const hands = s.hands.map((h, i) => (i === seat ? remove(h, cards) : h));
    return { ...s, hands, pile: [...s.pile, { seat, cards }], claim, passes: 0, turn: next(s, seat), reveal: null };
  }
  return 'Unknown move';
}

export function view(s: BluffState, seat: Seat): BluffView {
  return {
    n: s.n,
    me: seat,
    hand: s.hands[seat],
    handCounts: s.hands.map((h) => h.length),
    pile: s.pile.map((p) => ({ seat: p.seat, count: p.cards.length })),
    pileCount: s.pile.reduce((a, p) => a + p.cards.length, 0),
    claim: s.claim,
    turn: s.turn,
    passes: s.passes,
    reveal: s.reveal,
    winner: s.winner,
    log: s.log,
  };
}

export function result(s: BluffState): GameResult | null {
  return s.winner === null ? null : { winners: [s.winner] };
}

// ------------------------------------------------------------- bot

export function bot(v: BluffView, seat: Seat, ctx: BotCtx): BluffMove {
  const r = ctx.random;
  const byRank = new Map<number, Card[]>();
  for (const c of v.hand) byRank.set(rankOf(c), [...(byRank.get(rankOf(c)) ?? []), c]);
  const lp = v.pile[v.pile.length - 1];

  if (v.claim === null) {
    // Lead the rank we hold most of, truthfully
    let best = rankOf(v.hand[0]);
    for (const [rk, cs] of byRank) if (cs.length > (byRank.get(best)?.length ?? 0)) best = rk;
    const cards = byRank.get(best)!.slice(0, 4);
    if (ctx.level === 'hard' && cards.length < 4 && v.hand.length > cards.length + 2 && r() < 0.4) {
      const extra = v.hand.find((c) => rankOf(c) !== best && (byRank.get(rankOf(c))?.length ?? 0) === 1);
      if (extra !== undefined) cards.push(extra);
    }
    return { type: 'play', cards, rank: best };
  }

  // Should we call?
  if (lp && lp.seat !== seat) {
    const mine = byRank.get(v.claim)?.length ?? 0;
    const claimedThisRound = v.pile.reduce((a, p) => a + p.count, 0);
    if (lp.count + mine > 4) return { type: 'call' };
    if (v.handCounts[lp.seat] === 0) return { type: 'call' };
    const suspicion = ctx.level === 'easy' ? 0.1 : Math.min(0.6, 0.08 + (claimedThisRound + mine > 4 ? 0.35 : 0) + (lp.count >= 3 ? 0.15 : 0));
    if (r() < suspicion) return { type: 'call' };
  }

  const truth = byRank.get(v.claim) ?? [];
  if (truth.length) return { type: 'play', cards: truth.slice(0, 4) };
  const bluffChance = { easy: 0.3, normal: 0.45, hard: 0.6 }[ctx.level];
  if (r() < bluffChance) {
    // Get rid of a lonely card
    const lonely = v.hand.slice().sort((a, b) => (byRank.get(rankOf(a))!.length - byRank.get(rankOf(b))!.length))[0];
    return { type: 'play', cards: [lonely] };
  }
  return { type: 'pass' };
}
