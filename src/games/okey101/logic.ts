/**
 * 101 Okey (4 players), following the rules on pagat.com:
 * 21 tiles each (22 for the starter). Open by laying down sets/runs worth 101+ in one turn,
 * or 5+ pairs. After opening you may lay down more and add tiles to any meld on the table.
 * A discard can only be taken if it is used in a meld that same turn.
 * Finish by melding everything and discarding your last tile. Lowest total wins.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';
import { shuffle } from '../cards/cards';
import {
  allTiles,
  asMeld,
  bestMelds,
  bestPairs,
  faceOf,
  isFake,
  isJoker,
  meldPoints,
  okeyFrom,
  type Face,
  type Meld,
  type MeldKind,
  type RuleSet,
  type Tile,
} from '../tiles/tiles';

export const RULES = { wrap: false };
export const OPEN_POINTS = 101;
export const OPEN_PAIRS = 5;

/** The same engine plays 101 Okey (tiles) and 51 (two card decks + two jokers) */
export interface RummyCfg {
  variant: '101' | '51';
  openPoints: number;
  openPairs: number;
  rules: RuleSet;
  handSize: number;
  winBonus: number;
  notOpened: number;
  discardPenalty: number;
  jokerValue: number;
  unit: string;
  joker: string;
}
export const CFG101: RummyCfg = { variant: '101', openPoints: 101, openPairs: 5, rules: { wrap: false }, handSize: 21, winBonus: 101, notOpened: 202, discardPenalty: 101, jokerValue: 101, unit: 'tiles', joker: 'okey' };
export const CFG51: RummyCfg = { variant: '51', openPoints: 51, openPairs: 5, rules: { wrap: true }, handSize: 14, winBonus: 51, notOpened: 102, discardPenalty: 51, jokerValue: 25, unit: 'cards', joker: 'joker' };
/** In 51 the printed jokers are wild (see isJoker) */
export const WILD_JOKERS: Face = { color: -1, num: 0 };
export const cfgFor = (okey: Face) => (okey.color === -1 ? CFG51 : CFG101);

/** Card value in 51: aces 11 (1 at the bottom of a run), J/Q/K 10 */
function cardValue(num: number, inRun: boolean) {
  if (num === 1) return inRun ? 1 : 11;
  if (num === 14) return 11;
  return num >= 11 ? 10 : num;
}

/** Points a meld is worth towards opening */
export function pointsOf(m: Meld, okey: Face) {
  if (cfgFor(okey).variant === '101') return meldPoints(m);
  return m.faces.reduce((a, f) => a + cardValue(f.num, m.kind === 'run'), 0);
}

export interface TableMeld extends Meld {
  id: number;
  owner: Seat;
}

export type Opened = 'none' | 'sets' | 'pairs';

export interface HandResult {
  winner: Seat | null;
  delta: number[];
  penalties: number[];
  reason: string;
}

export interface O101State {
  variant: '101' | '51';
  n: number;
  dealer: Seat;
  handNo: number;
  totalHands: number;
  hands: Tile[][];
  pile: Tile[];
  discards: Tile[][];
  indicator: Tile;
  okey: Face;
  turn: Seat;
  phase: 'draw' | 'play' | 'done';
  table: TableMeld[];
  opened: Opened[];
  took: Tile | null;
  meldedThisTurn: boolean;
  penalties: number[];
  totals: number[];
  history: HandResult[];
  nextId: number;
  notice: string;
}

export interface O101View extends Omit<O101State, 'hands' | 'pile'> {
  me: Seat;
  hand: Tile[];
  handCounts: number[];
  pileCount: number;
}

export type O101Move =
  | { type: 'draw'; from: 'pile' | 'left' }
  | { type: 'meld'; groups: Tile[][] }
  | { type: 'add'; meldId: number; tiles: Tile[] }
  | { type: 'discard'; tile: Tile }
  | { type: 'undoTake' };

const prev = (s: { n: number }, seat: Seat) => ((seat + s.n - 1) % s.n) as Seat;
const next = (s: { n: number }, seat: Seat) => ((seat + 1) % s.n) as Seat;

export function tileValue(t: Tile, okey: Face) {
  const cfg = cfgFor(okey);
  if (isJoker(t, okey)) return cfg.jokerValue;
  const num = faceOf(t, okey).num;
  return cfg.variant === '101' ? num : cardValue(num, false);
}

function deal(s: O101State, random: () => number): O101State {
  const tiles = shuffle(allTiles(), random);
  const cfg = s.variant === '51' ? CFG51 : CFG101;
  // 101 turns up an indicator tile; in 51 the jokers are simply wild
  const indicator = cfg.variant === '51' ? -1 : tiles.splice(tiles.findIndex((t) => !isFake(t)), 1)[0];
  const starter = next(s, s.dealer);
  const hands = Array.from({ length: s.n }, (_, i) => tiles.splice(0, i === starter ? cfg.handSize + 1 : cfg.handSize));
  return {
    ...s,
    hands,
    pile: tiles,
    discards: Array.from({ length: s.n }, () => []),
    indicator,
    okey: cfg.variant === '51' ? WILD_JOKERS : okeyFrom(indicator),
    turn: starter,
    phase: 'play',
    table: [],
    opened: Array(s.n).fill('none'),
    took: null,
    meldedThisTurn: false,
    penalties: Array(s.n).fill(0),
  };
}

export function setup(ctx: Pick<GameCtx, 'random' | 'options'> & { numPlayers?: number }, variant: '101' | '51' = '101'): O101State {
  const n = variant === '51' ? (ctx.numPlayers ?? 4) : 4;
  const base: O101State = {
    variant,
    n,
    dealer: Math.floor(ctx.random() * n),
    handNo: 0,
    totalHands: Number(ctx.options.hands) || 3,
    hands: [],
    pile: [],
    discards: [],
    indicator: 0,
    okey: { color: 0, num: 1 },
    turn: 0,
    phase: 'play',
    table: [],
    opened: [],
    took: null,
    meldedThisTurn: false,
    penalties: [],
    totals: Array(n).fill(0),
    history: [],
    nextId: 1,
    notice: '',
  };
  return deal(base, ctx.random);
}

/** Validate groups for laying down. Returns melds or an error message. */
export function checkGroups(groups: Tile[][], opened: Opened, okey: Face): { melds: Meld[]; points: number; kind: 'sets' | 'pairs' } | string {
  if (!groups.length) return 'Nothing to lay down';
  const flat = groups.flat();
  if (new Set(flat).size !== flat.length) return 'A tile is used twice';
  const pairsOnly = groups.every((g) => g.length === 2);
  const cfg = cfgFor(okey);
  const kinds: MeldKind[] = opened === 'pairs' || (opened === 'none' && pairsOnly) ? ['pair'] : ['set', 'run'];
  const melds: Meld[] = [];
  for (const g of groups) {
    const m = asMeld(g, okey, cfg.rules, kinds);
    if (!m) return kinds[0] === 'pair' ? 'Pairs must be two identical tiles' : 'Each group must be a set (same number, different colours) or a run (same colour in a row)';
    melds.push(m);
  }
  const kind = kinds[0] === 'pair' ? 'pairs' : 'sets';
  const points = melds.reduce((a, m) => a + pointsOf(m, okey), 0);
  if (opened === 'none') {
    if (kind === 'pairs' && melds.length < cfg.openPairs) return `Opening with pairs needs at least ${cfg.openPairs} pairs`;
    if (kind === 'sets' && points < cfg.openPoints) return `Opening needs at least ${cfg.openPoints} points (you have ${points})`;
  }
  return { melds, points, kind };
}

/** Could this tile be added to some meld on the table? */
export function extendsTable(t: Tile, table: TableMeld[], okey: Face): TableMeld | null {
  for (const m of table) {
    if (m.kind === 'pair') continue;
    if (asMeld([...m.tiles, t], okey, cfgFor(okey).rules, [m.kind])) return m;
  }
  return null;
}

function handValue(tiles: Tile[], okey: Face) {
  return tiles.reduce((a, t) => a + tileValue(t, okey), 0);
}

function endHand(s: O101State, winner: Seat | null, lastTile: Tile | null, random: () => number): O101State {
  const delta = Array(s.n).fill(0);
  let reason: string;
  if (winner === null) {
    reason = 'The pile ran out: only penalties count.';
  } else {
    const jokerDiscard = lastTile !== null && isJoker(lastTile, s.okey);
    const pairsWin = s.opened[winner] === 'pairs';
    const m = (jokerDiscard ? 2 : 1) * (pairsWin ? 2 : 1);
    const cfg = cfgFor(s.okey);
    for (let i = 0; i < s.n; i++) {
      if (i === winner) delta[i] = -cfg.winBonus * m;
      else if (s.opened[i] === 'none') delta[i] = cfg.notOpened * (m > 1 ? 2 : 1);
      else delta[i] = handValue(s.hands[i], s.okey) * m * (s.opened[i] === 'pairs' ? 2 : 1);
    }
    reason = `${pairsWin ? 'Finished with pairs' : 'Finished'}${jokerDiscard ? ` by discarding the ${cfg.joker}` : ''}.`;
  }
  const totals = s.totals.map((x, i) => x + delta[i] + s.penalties[i]);
  const history = [...s.history, { winner, delta, penalties: s.penalties, reason }];
  const handNo = s.handNo + 1;
  const ns: O101State = { ...s, totals, history, handNo, notice: reason };
  if (handNo >= s.totalHands) return { ...ns, phase: 'done' };
  return deal({ ...ns, dealer: next(s, s.dealer) }, random);
}

export function move(s: O101State, seat: Seat, m: O101Move, random: () => number): O101State | string {
  if (s.phase === 'done') return 'The game is over';
  if (seat !== s.turn) return 'Not your turn';
  const hand = s.hands[seat];
  const setHand = (h: Tile[]) => s.hands.map((x, i) => (i === seat ? h : x));

  if (s.phase === 'draw') {
    if (m.type !== 'draw') return 'Draw a tile first';
    if (m.from === 'left') {
      const d = s.discards[prev(s, seat)];
      if (!d.length) return 'Nothing to take';
      const t = d[d.length - 1];
      return {
        ...s,
        hands: setHand([...hand, t]),
        discards: s.discards.map((x, i) => (i === prev(s, seat) ? x.slice(0, -1) : x)),
        took: t,
        phase: 'play',
        meldedThisTurn: false,
        notice: '',
      };
    }
    if (!s.pile.length) return endHand(s, null, null, random);
    const t = s.pile[s.pile.length - 1];
    return { ...s, hands: setHand([...hand, t]), pile: s.pile.slice(0, -1), took: null, phase: 'play', meldedThisTurn: false, notice: '' };
  }

  switch (m.type) {
    case 'undoTake': {
      if (s.took === null || s.meldedThisTurn || !hand.includes(s.took)) return 'Nothing to put back';
      const left = prev(s, seat);
      return { ...s, hands: setHand(hand.filter((t) => t !== s.took)), discards: s.discards.map((x, i) => (i === left ? [...x, s.took!] : x)), took: null, phase: 'draw' };
    }
    case 'meld': {
      const groups = m.groups ?? [];
      if (!groups.flat().every((t) => hand.includes(t))) return 'Those tiles are not in your hand';
      const check = checkGroups(groups, s.opened[seat], s.okey);
      if (typeof check === 'string') return check;
      const used = new Set(groups.flat());
      if (s.opened[seat] === 'none' && s.took !== null && !used.has(s.took)) return 'Your opening must use the tile you took';
      const rest = hand.filter((t) => !used.has(t));
      if (!rest.length) return 'Keep one tile to discard';
      let id = s.nextId;
      const table = [...s.table, ...check.melds.map((mm) => ({ ...mm, id: id++, owner: seat }))];
      const opened = s.opened.slice();
      if (opened[seat] === 'none') opened[seat] = check.kind;
      return { ...s, hands: setHand(rest), table, nextId: id, opened, took: s.took !== null && used.has(s.took) ? null : s.took, meldedThisTurn: true };
    }
    case 'add': {
      if (s.opened[seat] === 'none') return 'Open first before adding to melds';
      const target = s.table.find((t) => t.id === m.meldId);
      if (!target || target.kind === 'pair') return 'Pick a set or run';
      const tiles = m.tiles ?? [];
      if (!tiles.length || !tiles.every((t) => hand.includes(t))) return 'Pick tiles from your hand';
      const merged = asMeld([...target.tiles, ...tiles], s.okey, cfgFor(s.okey).rules, [target.kind]);
      if (!merged) return 'Those tiles do not fit that meld';
      const rest = hand.filter((t) => !tiles.includes(t));
      if (!rest.length) return 'Keep one tile to discard';
      const table = s.table.map((t) => (t.id === target.id ? { ...t, ...merged } : t));
      return { ...s, hands: setHand(rest), table, took: s.took !== null && tiles.includes(s.took) ? null : s.took, meldedThisTurn: true };
    }
    case 'discard': {
      if (!hand.includes(m.tile)) return 'Discard one of your tiles';
      if (s.took !== null && hand.includes(s.took)) return 'You must use the tile you took (or put it back)';
      const rest = hand.filter((t) => t !== m.tile);
      const penalties = s.penalties.slice();
      const notes: string[] = [];
      const cfg = cfgFor(s.okey);
      const pen = cfg.discardPenalty;
      if (isJoker(m.tile, s.okey) && rest.length) {
        penalties[seat] += pen;
        notes.push(`discarded the ${cfg.joker} (+${pen})`);
      }
      if (rest.length && extendsTable(m.tile, s.table, s.okey)) {
        penalties[seat] += pen;
        notes.push(`discarded a ${cfg.unit === 'cards' ? 'card' : 'tile'} that fits a meld (+${pen})`);
      }
      const ns: O101State = {
        ...s,
        hands: setHand(rest),
        discards: s.discards.map((x, i) => (i === seat ? [...x, m.tile] : x)),
        penalties,
        took: null,
        notice: notes.length ? `Penalty: ${notes.join(', ')}` : '',
      };
      if (!rest.length) return endHand(ns, seat, m.tile, random);
      return { ...ns, turn: next(s, seat), phase: 'draw', meldedThisTurn: false };
    }
  }
  return 'Unknown move';
}

export function view(s: O101State, seat: Seat): O101View {
  const { hands, pile, ...rest } = s;
  return { ...rest, me: seat, hand: hands[seat], handCounts: hands.map((h) => h.length), pileCount: pile.length };
}

export function result(s: O101State): GameResult | null {
  if (s.phase !== 'done') return null;
  const best = Math.min(...s.totals);
  return { winners: s.totals.map((x, i) => (x === best ? i : -1)).filter((i) => i >= 0) };
}

// ------------------------------------------------------------- bot

function neighborsCount(t: Tile, hand: Tile[], okey: Face) {
  const f = faceOf(t, okey);
  return hand.filter((x) => {
    if (x === t || isJoker(x, okey)) return false;
    const g = faceOf(x, okey);
    return (g.color === f.color && Math.abs(g.num - f.num) <= 2) || (g.num === f.num && g.color !== f.color);
  }).length;
}

/** Drop groups until at least one tile is left in hand */
function keepOne(groups: Tile[][], handSize: number) {
  const out = groups.slice();
  while (out.length && out.flat().length >= handSize) out.pop();
  return out;
}

export function bot(v: O101View, seat: Seat, ctx: BotCtx): O101Move {
  const okey = v.okey;
  const cfg = cfgFor(okey);
  const RULES = cfg.rules;
  const OPEN_POINTS = cfg.openPoints;
  const OPEN_PAIRS = cfg.openPairs;
  if (v.phase === 'draw') return { type: 'draw', from: 'pile' };
  const hand = v.hand;
  const opened = v.opened[seat];

  if (opened === 'none') {
    const best = bestMelds(hand, okey, RULES, 'points');
    const groups = keepOne(
      best.melds.map((m) => m.tiles),
      hand.length,
    );
    const pts = groups.reduce((a, g) => a + pointsOf(asMeld(g, okey, RULES)!, okey), 0);
    if (pts >= OPEN_POINTS) return { type: 'meld', groups };
    const pairs = keepOne(
      bestPairs(hand, okey).pairs.map((p) => p.tiles),
      hand.length,
    );
    if (pairs.length >= (ctx.level === 'hard' ? OPEN_PAIRS : OPEN_PAIRS + 1)) return { type: 'meld', groups: pairs };
  } else {
    if (opened === 'sets') {
      const best = bestMelds(hand, okey, RULES, 'tiles');
      const groups = keepOne(
        best.melds.map((m) => m.tiles),
        hand.length,
      );
      if (groups.length) return { type: 'meld', groups };
    } else {
      const pairs = bestPairs(hand, okey).pairs;
      const groups = keepOne(
        pairs.map((p) => p.tiles),
        hand.length,
      );
      if (groups.length) return { type: 'meld', groups };
    }
    if (hand.length > 1) {
      for (const t of hand) {
        const m = extendsTable(t, v.table, okey);
        if (m) return { type: 'add', meldId: m.id, tiles: [t] };
      }
    }
  }

  // Discard: avoid jokers and tiles that would earn a penalty, prefer high lonely tiles
  if (hand.length === 1) return { type: 'discard', tile: hand[0] };
  const safe = hand.filter((t) => !isJoker(t, okey) && !extendsTable(t, v.table, okey));
  const pool = safe.length ? safe : hand.filter((t) => !isJoker(t, okey)).length ? hand.filter((t) => !isJoker(t, okey)) : hand;
  if (ctx.level === 'easy' && ctx.random() < 0.3) return { type: 'discard', tile: pool[Math.floor(ctx.random() * pool.length)] };
  const score = (t: Tile) => faceOf(t, okey).num - neighborsCount(t, hand, okey) * 6;
  const tile = pool.slice().sort((a, b) => score(b) - score(a))[0];
  return { type: 'discard', tile };
}
