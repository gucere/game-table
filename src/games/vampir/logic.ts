/**
 * Vampir Köylü: the classic hidden-role party game (also known as Mafia or Werewolf).
 * At night the vampires secretly pick a victim, the doctor protects someone and the seer
 * checks someone. By day everyone votes on who to drive out of the village.
 * The village wins when every vampire is gone; the vampires win when they match the villagers.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';
import { shuffle } from '../cards/cards';

export type Role = 'vampir' | 'koylu' | 'doktor' | 'gozcu';

export const ROLES: Record<Role, { name: string; icon: string; desc: string }> = {
  vampir: { name: 'Vampir', icon: '🧛', desc: 'Each night, agree with the other vampires on a villager to bite. By day, blend in.' },
  koylu: { name: 'Köylü', icon: '🌾', desc: 'An ordinary villager. Find the vampires and vote them out.' },
  doktor: { name: 'Doktor', icon: '🩺', desc: 'Each night, protect one person from the vampires (not the same person two nights in a row).' },
  gozcu: { name: 'Gözcü', icon: '🔮', desc: 'Each night, look into one person and learn whether they are a vampire.' },
};

const DAWN_MS = 6000;

export type GameEvent =
  | { kind: 'bitten'; day: number; seat: Seat; role: Role | null }
  | { kind: 'saved'; day: number }
  | { kind: 'quiet'; day: number }
  | { kind: 'banished'; day: number; seat: Seat; role: Role | null }
  | { kind: 'tie'; day: number };

export interface VampirState {
  n: number;
  roles: Role[];
  alive: boolean[];
  phase: 'night' | 'dawn' | 'day' | 'dusk' | 'done';
  day: number;
  /** Night: what each vampire wants to bite */
  bites: (Seat | null)[];
  protect: Seat | null;
  lastProtect: Seat | null;
  acted: boolean[];
  seen: { seer: Seat; target: Seat; vampire: boolean; day: number }[];
  /** Day: each player's vote (-1 = nobody) */
  votes: (Seat | -1 | null)[];
  events: GameEvent[];
  reveal: boolean;
  dayMs: number | null;
  nightMs: number | null;
  deadline: number | null;
  winner: 'village' | 'vampires' | null;
}

export type VampirMove =
  | { type: 'bite'; target: Seat }
  | { type: 'protect'; target: Seat }
  | { type: 'see'; target: Seat }
  | { type: 'sleep' }
  | { type: 'vote'; target: Seat | -1 };

export interface VampirView {
  me: Seat;
  n: number;
  myRole: Role;
  phase: VampirState['phase'];
  day: number;
  alive: boolean[];
  /** Roles I know: my own, my fellow vampires, the dead (if revealed), everyone at the end */
  known: (Role | null)[];
  bites: (Seat | null)[] | null;
  acted: boolean;
  lastProtect: Seat | null;
  seen: { target: Seat; vampire: boolean; day: number }[];
  votes: (Seat | -1 | null)[];
  events: GameEvent[];
  deadline: number | null;
  winner: VampirState['winner'];
}

export function vampireCount(n: number, opt: string | undefined) {
  if (opt && opt !== 'auto') return Math.min(Number(opt), Math.floor((n - 1) / 2));
  return n <= 6 ? 1 : n <= 10 ? 2 : 3;
}

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'random' | 'options' | 'now'>): VampirState {
  const n = ctx.numPlayers;
  const v = Math.max(1, vampireCount(n, ctx.options.vampires));
  const specials = ctx.options.specials !== 'none';
  const roles: Role[] = [];
  for (let i = 0; i < v; i++) roles.push('vampir');
  if (specials && n - v >= 3) roles.push('doktor', 'gozcu');
  while (roles.length < n) roles.push('koylu');
  const dayMs = ctx.options.timer === 'none' ? null : Number(ctx.options.timer ?? 120) * 1000;
  const s: VampirState = {
    n,
    roles: shuffle(roles, ctx.random),
    alive: Array(n).fill(true),
    phase: 'night',
    day: 1,
    bites: Array(n).fill(null),
    protect: null,
    lastProtect: null,
    acted: Array(n).fill(false),
    seen: [],
    votes: Array(n).fill(null),
    events: [],
    reveal: ctx.options.reveal !== 'no',
    dayMs,
    nightMs: dayMs === null ? null : 45000,
    deadline: null,
    winner: null,
  };
  return { ...s, deadline: s.nightMs === null ? null : ctx.now() + s.nightMs };
}

const aliveSeats = (s: Pick<VampirState, 'alive'>) => s.alive.flatMap((a, i) => (a ? [i] : []));
const isVamp = (s: VampirState, i: Seat) => s.roles[i] === 'vampir';

function checkWinner(s: VampirState): VampirState['winner'] {
  const alive = aliveSeats(s);
  const v = alive.filter((i) => isVamp(s, i)).length;
  if (v === 0) return 'village';
  if (v >= alive.length - v) return 'vampires';
  return null;
}

function finishIfOver(s: VampirState): VampirState {
  const w = checkWinner(s);
  return w ? { ...s, winner: w, phase: 'done', deadline: null } : s;
}

function plurality(targets: (Seat | -1 | null)[], random: () => number): { top: Seat | -1 | null; tied: boolean } {
  const count = new Map<Seat | -1, number>();
  for (const t of targets) if (t !== null) count.set(t, (count.get(t) ?? 0) + 1);
  if (!count.size) return { top: null, tied: false };
  const max = Math.max(...count.values());
  const tops = [...count.entries()].filter(([, c]) => c === max).map(([t]) => t);
  return { top: tops[Math.floor(random() * tops.length)], tied: tops.length > 1 };
}

function resolveNight(s: VampirState, ctx: Pick<GameCtx, 'random' | 'now'>): VampirState {
  const vampVotes = s.bites.filter((b, i) => b !== null && s.alive[i] && isVamp(s, i));
  // Vampires that disagree: the most popular choice wins, ties broken at random
  const { top } = plurality(vampVotes, ctx.random);
  const alive = s.alive.slice();
  let ev: GameEvent;
  if (top === null || top === -1) ev = { kind: 'quiet', day: s.day };
  else if (top === s.protect) ev = { kind: 'saved', day: s.day };
  else {
    alive[top] = false;
    ev = { kind: 'bitten', day: s.day, seat: top, role: s.reveal ? s.roles[top] : null };
  }
  const next: VampirState = {
    ...s,
    alive,
    events: [...s.events, ev],
    lastProtect: s.protect,
    protect: null,
    bites: Array(s.n).fill(null),
    acted: Array(s.n).fill(false),
    phase: 'dawn',
    deadline: ctx.now() + DAWN_MS,
  };
  return finishIfOver(next);
}

function resolveDay(s: VampirState, ctx: Pick<GameCtx, 'random' | 'now'>): VampirState {
  const votes = s.votes.filter((_, i) => s.alive[i]);
  const { top, tied } = plurality(votes, ctx.random);
  const alive = s.alive.slice();
  let ev: GameEvent;
  if (top === null || top === -1 || tied) ev = { kind: 'tie', day: s.day };
  else {
    alive[top] = false;
    ev = { kind: 'banished', day: s.day, seat: top, role: s.reveal ? s.roles[top] : null };
  }
  const next: VampirState = { ...s, alive, events: [...s.events, ev], phase: 'dusk', deadline: ctx.now() + DAWN_MS };
  return finishIfOver(next);
}

/** Who still has to do something tonight / today */
export function activePlayers(s: VampirState): Seat[] {
  if (s.phase === 'night') return aliveSeats(s).filter((i) => !s.acted[i]);
  if (s.phase === 'day') return aliveSeats(s).filter((i) => s.votes[i] === null);
  return [];
}

function startDay(s: VampirState, now: number): VampirState {
  return { ...s, phase: 'day', votes: Array(s.n).fill(null), deadline: s.dayMs === null ? null : now + s.dayMs };
}

function startNight(s: VampirState, now: number): VampirState {
  return { ...s, phase: 'night', day: s.day + 1, acted: Array(s.n).fill(false), deadline: s.nightMs === null ? null : now + s.nightMs };
}

export function move(s: VampirState, seat: Seat, m: VampirMove, ctx: Pick<GameCtx, 'random' | 'now'>): VampirState | string {
  if (s.phase === 'done') return 'The game is over';
  if (!s.alive[seat]) return 'The dead stay quiet 👻';
  const validTarget = (t: unknown): t is Seat => Number.isInteger(t) && (t as number) >= 0 && (t as number) < s.n && s.alive[t as number];

  if (s.phase === 'night') {
    if (s.acted[seat]) return 'You already acted tonight';
    const role = s.roles[seat];
    const acted = s.acted.slice();
    acted[seat] = true;
    let next: VampirState;
    if (m.type === 'sleep') {
      if (role !== 'koylu') return 'You have something to do tonight';
      next = { ...s, acted };
    } else if (m.type === 'bite') {
      if (role !== 'vampir') return 'Only vampires bite';
      if (!validTarget(m.target) || isVamp(s, m.target)) return 'Pick a living non-vampire';
      const bites = s.bites.slice();
      bites[seat] = m.target;
      next = { ...s, bites, acted };
    } else if (m.type === 'protect') {
      if (role !== 'doktor') return 'Only the doctor protects';
      if (!validTarget(m.target)) return 'Pick a living player';
      if (m.target === s.lastProtect) return 'You protected them last night; pick someone else';
      next = { ...s, protect: m.target, acted };
    } else if (m.type === 'see') {
      if (role !== 'gozcu') return 'Only the seer can look';
      if (!validTarget(m.target) || m.target === seat) return 'Pick another living player';
      next = { ...s, acted, seen: [...s.seen, { seer: seat, target: m.target, vampire: isVamp(s, m.target), day: s.day }] };
    } else return 'It is night';
    return activePlayers(next).length ? next : resolveNight(next, ctx);
  }

  if (s.phase === 'day') {
    if (m.type !== 'vote') return 'Vote for someone (or nobody)';
    if (s.votes[seat] !== null) return 'You already voted';
    if (m.target !== -1 && (!validTarget(m.target) || m.target === seat)) return 'Vote for another living player, or nobody';
    const votes = s.votes.slice();
    votes[seat] = m.target;
    const next = { ...s, votes };
    return activePlayers(next).length ? next : resolveDay(next, ctx);
  }
  return 'Wait for the next phase';
}

export function onTimer(s: VampirState, ctx: GameCtx): VampirState {
  if (s.phase === 'night') return resolveNight(s, ctx);
  if (s.phase === 'day') return resolveDay(s, ctx);
  if (s.phase === 'dawn') return startDay(s, ctx.now());
  if (s.phase === 'dusk') return startNight(s, ctx.now());
  return s;
}

export function view(s: VampirState, seat: Seat): VampirView {
  const meVamp = isVamp(s, seat);
  const all = s.phase === 'done' || !s.alive[seat];
  const deadRole = (i: number) => {
    const ev = s.events.find((e) => (e.kind === 'bitten' || e.kind === 'banished') && e.seat === i);
    return ev && 'role' in ev ? ev.role : null;
  };
  return {
    me: seat,
    n: s.n,
    myRole: s.roles[seat],
    phase: s.phase,
    day: s.day,
    alive: s.alive,
    known: s.roles.map((r, i) => (all || i === seat || (meVamp && r === 'vampir') ? r : !s.alive[i] ? deadRole(i) : null)),
    bites: meVamp || all ? s.bites : null,
    acted: s.acted[seat],
    lastProtect: s.roles[seat] === 'doktor' ? s.lastProtect : null,
    seen: s.seen.filter((x) => x.seer === seat || all).map(({ target, vampire, day }) => ({ target, vampire, day })),
    votes: s.votes,
    events: s.events,
    deadline: s.deadline,
    winner: s.winner,
  };
}

export function result(s: VampirState): GameResult | null {
  if (!s.winner) return null;
  const winners = s.roles.flatMap((r, i) => ((r === 'vampir') === (s.winner === 'vampires') ? [i] : []));
  return { winners, message: s.winner === 'village' ? 'The village wins! Every vampire is gone. 🌅' : 'The vampires win! 🧛 The village has fallen.' };
}

// ------------------------------------------------------------- bot

export function bot(v: VampirView, _seat: Seat, ctx: BotCtx): VampirMove {
  const r = ctx.random;
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const others = v.alive.flatMap((a, i) => (a && i !== v.me ? [i] : []));
  const nonVamps = others.filter((i) => v.known[i] !== 'vampir');
  const knownVamp = v.seen.find((x) => x.vampire && v.alive[x.target])?.target;
  const cleared = new Set(v.seen.filter((x) => !x.vampire).map((x) => x.target));

  if (v.phase === 'night') {
    switch (v.myRole) {
      case 'vampir': {
        // Go along with a fellow vampire's choice if there is one
        const chosen = (v.bites ?? []).filter((b): b is Seat => b !== null && b !== -1 && nonVamps.includes(b));
        return { type: 'bite', target: chosen.length && ctx.level !== 'easy' ? chosen[0] : pick(nonVamps) };
      }
      case 'doktor': {
        const options = v.alive.flatMap((a, i) => (a && i !== v.lastProtect ? [i] : []));
        const self = options.includes(v.me) && r() < (ctx.level === 'hard' ? 0.35 : 0.15);
        return { type: 'protect', target: self ? v.me : pick(options) };
      }
      case 'gozcu': {
        const unknown = others.filter((i) => !v.seen.some((x) => x.target === i));
        return { type: 'see', target: pick(unknown.length ? unknown : others) };
      }
      default:
        return { type: 'sleep' };
    }
  }

  // Day: count the votes so far
  const tally = new Map<number, number>();
  for (const x of v.votes) if (x !== null && x !== -1) tally.set(x, (tally.get(x) ?? 0) + 1);
  const leader = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (v.myRole === 'vampir') {
    if (leader !== undefined && v.known[leader] !== 'vampir' && leader !== v.me) return { type: 'vote', target: leader };
    return { type: 'vote', target: nonVamps.length ? pick(nonVamps) : -1 };
  }
  if (knownVamp !== undefined) return { type: 'vote', target: knownVamp };
  const suspects = others.filter((i) => !cleared.has(i));
  if (leader !== undefined && leader !== v.me && !cleared.has(leader) && r() < (ctx.level === 'easy' ? 0.3 : 0.6)) return { type: 'vote', target: leader };
  if (!suspects.length || r() < 0.1) return { type: 'vote', target: -1 };
  return { type: 'vote', target: pick(suspects) };
}
