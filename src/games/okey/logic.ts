/**
 * Okey (4 players). 106 tiles, 14 each (15 for the starter). On your turn draw from the pile
 * or take the tile the player before you discarded, then discard one. Finish by discarding
 * your 15th tile when the other 14 form sets/runs (or seven pairs).
 * Scoring: everyone starts with N points; when someone finishes, the others lose 2
 * (4 if they finished by discarding the okey or with pairs, 8 for both). Game ends when
 * someone reaches 0.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';
import { shuffle } from '../cards/cards';
import { allTiles, bestMelds, bestPairs, faceOf, isFake, isJoker, okeyFrom, type Face, type Meld, type Tile } from '../tiles/tiles';
import { tileValue, WILD_JOKERS } from '../okey101/logic';

export const RULES = { wrap: true };

export interface OkeyWin {
  seat: Seat;
  melds: Meld[];
  pairs: boolean;
  okeyDiscard: boolean;
  loss: number;
  /** Konken: what each player had to write down this hand */
  penalties?: number[];
  /** Çanak: points the winner took from the pot */
  canak?: number;
}

export interface OkeyState {
  n: number;
  dealer: Seat;
  round: number;
  hands: Tile[][];
  pile: Tile[];
  discards: Tile[][];
  indicator: Tile;
  okey: Face;
  turn: Seat;
  phase: 'draw' | 'discard' | 'done';
  scores: number[];
  lastWin: OkeyWin | null;
  notice: string;
  /** 'konken' = the same game with two card decks and two wild jokers, scored by leftover cards */
  variant?: 'okey' | 'konken';
  /** Çanak Okey: the pot (null when playing without one) */
  canak?: number | null;
  maxRounds?: number;
}

export interface OkeyView extends Omit<OkeyState, 'hands' | 'pile'> {
  me: Seat;
  hand: Tile[];
  handCounts: number[];
  pileCount: number;
}

export type OkeyMove = { type: 'draw'; from: 'pile' | 'left' } | { type: 'discard'; tile: Tile } | { type: 'finish'; tile: Tile };

const prev = (s: { n: number }, seat: Seat) => ((seat + s.n - 1) % s.n) as Seat;
const next = (s: { n: number }, seat: Seat) => ((seat + 1) % s.n) as Seat;

function deal(s: OkeyState, random: () => number): OkeyState {
  const tiles = shuffle(allTiles(), random);
  const konken = s.variant === 'konken';
  // Okey turns up an indicator; Konken just has two wild jokers
  const indicator = konken ? -1 : tiles.splice(tiles.findIndex((t) => !isFake(t)), 1)[0];
  const starter = next(s, s.dealer);
  const hands: Tile[][] = Array.from({ length: s.n }, (_, i) => tiles.splice(0, i === starter ? 15 : 14));
  // Çanak: everyone pays one point into the pot each hand
  const ante = s.canak !== null && s.canak !== undefined;
  return {
    ...s,
    hands,
    pile: tiles,
    discards: Array.from({ length: s.n }, () => []),
    indicator,
    okey: konken ? WILD_JOKERS : okeyFrom(indicator),
    turn: starter,
    phase: 'discard',
    scores: ante ? s.scores.map((x) => x - 1) : s.scores,
    canak: ante ? s.canak! + s.n : s.canak,
  };
}

/** Konken: value of the cards a player couldn't fit into melds */
export function deadwood(tiles: Tile[], okey: Face): number {
  const best = bestMelds(tiles, okey, RULES);
  const pairs = bestPairs(tiles, okey);
  const fromMelds = best.rest.reduce((a, t) => a + tileValue(t, okey), 0);
  // Seven pairs is a way to finish, so a hand close to it counts as nearly done too
  const fromPairs = pairs.rest.length <= 2 ? pairs.rest.reduce((a, t) => a + tileValue(t, okey), 0) : Infinity;
  return Math.min(fromMelds, fromPairs);
}

export function setup(ctx: Pick<GameCtx, 'random' | 'options'> & { numPlayers?: number }, variant: 'okey' | 'konken' = 'okey'): OkeyState {
  const konken = variant === 'konken';
  const start = konken ? 0 : Number(ctx.options.points) || 20;
  const n = konken ? (ctx.numPlayers ?? 4) : 4;
  const base: OkeyState = {
    variant,
    canak: !konken && ctx.options.canak === 'yes' ? 0 : null,
    maxRounds: konken ? Number(ctx.options.hands ?? 5) : 0,
    n,
    dealer: Math.floor(ctx.random() * n),
    round: 1,
    hands: [],
    pile: [],
    discards: [],
    indicator: 0,
    okey: { color: 0, num: 1 },
    turn: 0,
    phase: 'discard',
    scores: Array(n).fill(start),
    lastWin: null,
    notice: '',
  };
  return deal(base, ctx.random);
}

/** Can these 14 tiles finish? Returns how (melds or pairs) or null */
export function winningHand(tiles: Tile[], okey: Face): { melds: Meld[]; pairs: boolean } | null {
  if (tiles.length !== 14) return null;
  const pairs = bestPairs(tiles, okey);
  if (pairs.pairs.length === 7) return { melds: pairs.pairs, pairs: true };
  const best = bestMelds(tiles, okey, RULES);
  if (best.score === 14) return { melds: best.melds, pairs: false };
  return null;
}

export function move(s: OkeyState, seat: Seat, m: OkeyMove, random: () => number): OkeyState | string {
  if (s.phase === 'done') return 'The game is over';
  if (seat !== s.turn) return 'Not your turn';
  const hand = s.hands[seat];
  if (s.phase === 'draw') {
    if (m.type !== 'draw') return 'Draw a tile first';
    const hands = s.hands.slice();
    if (m.from === 'left') {
      const pile = s.discards[prev(s, seat)];
      if (!pile.length) return 'Nothing to take';
      const t = pile[pile.length - 1];
      const discards = s.discards.map((d, i) => (i === prev(s, seat) ? d.slice(0, -1) : d));
      hands[seat] = [...hand, t];
      return { ...s, hands, discards, phase: 'discard', notice: '' };
    }
    if (!s.pile.length) {
      // Out of tiles: nobody wins this round
      if (s.variant === 'konken' && s.round >= (s.maxRounds ?? 0)) return { ...s, phase: 'done', notice: 'The pile ran out.' };
      return deal({ ...s, dealer: next(s, s.dealer), round: s.round + 1, notice: 'The pile ran out. Nobody finished, so the tiles are dealt again.' }, random);
    }
    const t = s.pile[s.pile.length - 1];
    hands[seat] = [...hand, t];
    return { ...s, hands, pile: s.pile.slice(0, -1), phase: 'discard', notice: '' };
  }
  // discard phase
  if ((m.type !== 'discard' && m.type !== 'finish') || !hand.includes(m.tile)) return 'Discard one of your tiles';
  const rest = hand.filter((t) => t !== m.tile);
  if (m.type === 'finish') {
    const win = winningHand(rest, s.okey);
    if (!win) return 'Those tiles do not finish yet';
    const okeyDiscard = isJoker(m.tile, s.okey);
    const mult = (win.pairs ? 2 : 1) * (okeyDiscard ? 2 : 1);
    const finalHands = s.hands.map((h, i) => (i === seat ? rest : h));
    if (s.variant === 'konken') {
      // Everyone else writes down the cards they couldn't meld
      const penalties = finalHands.map((h, i) => (i === seat ? 0 : deadwood(h, s.okey) * mult));
      const scores = s.scores.map((x, i) => x + penalties[i]);
      const lastWin: OkeyWin = { seat, melds: win.melds, pairs: win.pairs, okeyDiscard, loss: Math.max(...penalties), penalties };
      const ns: OkeyState = { ...s, scores, lastWin, notice: '' };
      if (s.round >= (s.maxRounds ?? 0)) return { ...ns, phase: 'done', hands: finalHands };
      return deal({ ...ns, dealer: next(s, s.dealer), round: s.round + 1 }, random);
    }
    const loss = 2 * mult;
    let scores = s.scores.map((x, i) => (i === seat ? x : x - loss));
    // Çanak: a flashy finish (okey discard or pairs) takes the pot
    let canak = s.canak;
    let won = 0;
    if (canak !== null && canak !== undefined && (okeyDiscard || win.pairs)) {
      won = canak;
      scores = scores.map((x, i) => (i === seat ? x + canak! : x));
      canak = 0;
    }
    const lastWin: OkeyWin = { seat, melds: win.melds, pairs: win.pairs, okeyDiscard, loss, canak: won };
    const ns: OkeyState = { ...s, scores, lastWin, canak, notice: '' };
    if (scores.some((x) => x <= 0)) return { ...ns, phase: 'done', hands: finalHands };
    return deal({ ...ns, dealer: next(s, s.dealer), round: s.round + 1 }, random);
  }
  const hands = s.hands.map((h, i) => (i === seat ? rest : h));
  const discards = s.discards.map((d, i) => (i === seat ? [...d, m.tile] : d));
  return { ...s, hands, discards, turn: next(s, seat), phase: 'draw' };
}

export function view(s: OkeyState, seat: Seat): OkeyView {
  const { hands, pile, ...rest } = s;
  return { ...rest, me: seat, hand: hands[seat], handCounts: hands.map((h) => h.length), pileCount: pile.length };
}

export function result(s: OkeyState): GameResult | null {
  if (s.phase !== 'done') return null;
  // Okey counts down (most left wins); Konken counts penalties (fewest wins)
  const best = s.variant === 'konken' ? Math.min(...s.scores) : Math.max(...s.scores);
  return { winners: s.scores.map((x, i) => (x === best ? i : -1)).filter((i) => i >= 0) };
}

// ------------------------------------------------------------- bot

function handScore(tiles: Tile[], okey: Face): number {
  const melds = bestMelds(tiles, okey, RULES).score;
  const pairs = bestPairs(tiles, okey).pairs.length * 2;
  return Math.max(melds, pairs * 0.85) + nearness(tiles, okey) * 0.05;
}

/** Small bonus for tiles that are close to each other (potential melds) */
function nearness(tiles: Tile[], okey: Face): number {
  let n = 0;
  const faces = tiles.filter((t) => !isJoker(t, okey)).map((t) => faceOf(t, okey));
  for (let i = 0; i < faces.length; i++)
    for (let j = i + 1; j < faces.length; j++) {
      const a = faces[i];
      const b = faces[j];
      if (a.color === b.color && Math.abs(a.num - b.num) <= 2) n++;
      else if (a.num === b.num && a.color !== b.color) n++;
    }
  return n;
}

function bestDiscard(hand: Tile[], okey: Face): { tile: Tile; score: number } {
  let best = { tile: hand[0], score: -Infinity };
  for (const t of hand) {
    if (isJoker(t, okey)) continue;
    const sc = handScore(hand.filter((x) => x !== t), okey);
    if (sc > best.score) best = { tile: t, score: sc };
  }
  return best;
}

export function bot(v: OkeyView, seat: Seat, ctx: BotCtx): OkeyMove {
  const okey = v.okey;
  if (v.phase === 'draw') {
    const leftPile = v.discards[prev(v, seat)];
    const top = leftPile[leftPile.length - 1];
    if (top !== undefined && ctx.level !== 'easy') {
      const now = handScore(v.hand, okey);
      const withTop = bestDiscard([...v.hand, top], okey);
      if (isJoker(top, okey) || withTop.score >= now + 1 || winningHand([...v.hand, top].filter((t) => t !== withTop.tile), okey)) {
        return { type: 'draw', from: 'left' };
      }
    }
    return { type: 'draw', from: 'pile' };
  }
  // Can we finish? Prefer finishing with the okey for the bonus
  const order = v.hand.slice().sort((a, b) => (isJoker(b, okey) ? 1 : 0) - (isJoker(a, okey) ? 1 : 0));
  for (const t of order) if (winningHand(v.hand.filter((x) => x !== t), okey)) return { type: 'finish', tile: t };
  if (ctx.level === 'easy' && ctx.random() < 0.3) {
    const pool = v.hand.filter((t) => !isJoker(t, okey));
    return { type: 'discard', tile: pool[Math.floor(ctx.random() * pool.length)] };
  }
  return { type: 'discard', tile: bestDiscard(v.hand, okey).tile };
}
