/**
 * Vampir Köylü: the hidden-role party game. At night the vampires pick a victim and the
 * special roles use their powers; by day everyone talks and votes someone out.
 * The village wins when the vampires (and any killer) are gone; the vampires win once their
 * side is as large as everyone else. The Jester wins alone by being voted out; the Killer
 * wins alone by being among the last two.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';
import { shuffle } from '../cards/cards';
import { countsFor } from './config';
import { ROLES, ROLE_IDS, onVampireSide, roleTeam, type Role } from './roles';

export { ROLES, type Role };

const DAWN_MS = 6000;
const SHOOT_MS = 30000;
type Clock = Pick<GameCtx, 'random' | 'now'>;

export type Cause = 'bite' | 'kill' | 'poison' | 'guard' | 'shot';
export type Act =
  | { kind: 'sleep' }
  | { kind: 'bite'; target: Seat }
  | { kind: 'protect'; target: Seat }
  | { kind: 'see'; target: Seat }
  | { kind: 'guard'; target: Seat }
  | { kind: 'kill'; target: Seat }
  | { kind: 'heal'; target: Seat }
  | { kind: 'poison'; target: Seat };

export type GameEvent =
  | { kind: 'died'; day: number; night: boolean; seat: Seat; cause: Cause; role: Role | null }
  | { kind: 'saved'; day: number }
  | { kind: 'quiet'; day: number }
  | { kind: 'banished'; day: number; seat: Seat; role: Role | null }
  | { kind: 'noble'; day: number; seat: Seat }
  | { kind: 'jester'; day: number; seat: Seat }
  | { kind: 'tie'; day: number };

export interface VampirState {
  n: number;
  roles: Role[];
  alive: boolean[];
  phase: 'night' | 'dawn' | 'day' | 'dusk' | 'shoot' | 'done';
  day: number;
  /** Tonight's choice of each player (everyone acts, so nobody can tell roles apart) */
  acts: (Act | null)[];
  /** Last person each Doctor protected / each Bodyguard guarded */
  lastTarget: (Seat | null)[];
  /** Witch potions still unused */
  potions: { heal: boolean; poison: boolean }[];
  elderHit: boolean[];
  nobleUsed: boolean[];
  seen: { seer: Seat; target: Seat; vampire: boolean; day: number }[];
  votes: (Seat | -1 | null)[];
  events: GameEvent[];
  /** Hunters who still get their last shot */
  shooters: Seat[];
  /** Where to go once announcements and shots are done */
  next: 'day' | 'night';
  reveal: boolean;
  dayMs: number | null;
  nightMs: number | null;
  deadline: number | null;
  winner: 'village' | 'vampires' | 'jester' | 'killer' | null;
  /** The Jester who won (if any) */
  jester: Seat | null;
}

export type VampirMove = { type: 'act'; act: Act } | { type: 'vote'; target: Seat | -1 } | { type: 'shoot'; target: Seat | -1 };

export interface VampirView {
  me: Seat;
  n: number;
  myRole: Role;
  phase: VampirState['phase'];
  day: number;
  alive: boolean[];
  /** Roles I know: mine, my allies, revealed ones, everyone at the end */
  known: (Role | null)[];
  /** Fellow vampires' picks tonight (vampires only) */
  bites: (Seat | null)[] | null;
  acted: boolean;
  lastTarget: Seat | null;
  potions: { heal: boolean; poison: boolean } | null;
  seen: { target: Seat; vampire: boolean; day: number }[];
  votes: (Seat | -1 | null)[];
  events: GameEvent[];
  /** The hunter taking a shot now */
  shooter: Seat | null;
  deadline: number | null;
  winner: VampirState['winner'];
}

export function dealRoles(n: number, options: Record<string, string>, random: () => number): Role[] {
  const counts = countsFor(n, options);
  const roles: Role[] = [];
  for (const r of ROLE_IDS) for (let k = 0; k < counts[r]; k++) roles.push(r);
  while (roles.length < n) roles.push('koylu');
  return shuffle(roles.slice(0, n), random);
}

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'random' | 'options' | 'now'>): VampirState {
  const n = ctx.numPlayers;
  const roles = dealRoles(n, ctx.options, ctx.random);
  const dayMs = ctx.options.timer === 'none' ? null : Number(ctx.options.timer ?? 120) * 1000;
  const nightMs = dayMs === null ? null : 45000;
  return {
    n,
    roles,
    alive: Array(n).fill(true),
    phase: 'night',
    day: 1,
    acts: Array(n).fill(null),
    lastTarget: Array(n).fill(null),
    potions: roles.map(() => ({ heal: true, poison: true })),
    elderHit: Array(n).fill(false),
    nobleUsed: Array(n).fill(false),
    seen: [],
    votes: Array(n).fill(null),
    events: [],
    shooters: [],
    next: 'day',
    reveal: ctx.options.reveal !== 'no',
    dayMs,
    nightMs,
    deadline: nightMs === null ? null : ctx.now() + nightMs,
    winner: null,
    jester: null,
  };
}

const aliveSeats = (s: Pick<VampirState, 'alive'>) => s.alive.flatMap((a, i) => (a ? [i] : []));
/** What the Seer sees */
const looksLikeVampire = (role: Role) => role === 'vampir' || role === 'lanetli';

export function checkWinner(s: VampirState): VampirState['winner'] {
  const alive = aliveSeats(s);
  const killerAlive = alive.some((i) => s.roles[i] === 'katil');
  if (killerAlive && alive.length <= 2) return 'killer';
  const vampires = alive.filter((i) => s.roles[i] === 'vampir').length;
  const vampSide = alive.filter((i) => onVampireSide(s.roles[i])).length;
  if (!vampires && !killerAlive) return 'village';
  if (vampires && !killerAlive && vampSide >= alive.length - vampSide) return 'vampires';
  if (!alive.length) return 'village';
  return null;
}

function finishIfOver(s: VampirState): VampirState {
  if (s.shooters.length) return s;
  const w = checkWinner(s);
  return w ? { ...s, winner: w, phase: 'done', deadline: null } : s;
}

function plurality(targets: (Seat | -1 | null)[], random: () => number) {
  const count = new Map<Seat | -1, number>();
  for (const t of targets) if (t !== null) count.set(t, (count.get(t) ?? 0) + 1);
  if (!count.size) return { top: null as Seat | -1 | null, tied: false };
  const max = Math.max(...count.values());
  const tops = [...count.entries()].filter(([, c]) => c === max).map(([t]) => t);
  return { top: tops[Math.floor(random() * tops.length)], tied: tops.length > 1 };
}

/** What each role may do tonight, given a target */
export function allowedAct(s: Pick<VampirState, 'roles' | 'alive' | 'lastTarget' | 'potions' | 'n'>, seat: Seat, act: Act): string | null {
  const role = s.roles[seat];
  const living = (t: unknown): t is Seat => Number.isInteger(t) && (t as number) >= 0 && (t as number) < s.n && s.alive[t as number];
  if (act.kind === 'sleep') return ['vampir', 'doktor', 'gozcu', 'koruma', 'katil'].includes(role) ? 'You have something to do tonight' : null;
  const t = act.target;
  if (!living(t)) return 'Pick a living player';
  switch (act.kind) {
    case 'bite':
      return role !== 'vampir' ? 'Only vampires bite' : s.roles[t] === 'vampir' ? 'Pick someone who isn’t a vampire' : null;
    case 'protect':
      return role !== 'doktor' ? 'Only the Doctor protects' : t === s.lastTarget[seat] ? 'You protected them last night; pick someone else' : null;
    case 'guard':
      return role !== 'koruma' ? 'Only the Bodyguard guards' : t === seat ? 'Guard someone else' : t === s.lastTarget[seat] ? 'You guarded them last night; pick someone else' : null;
    case 'see':
      return role !== 'gozcu' ? 'Only the Seer can look' : t === seat ? 'Pick someone else' : null;
    case 'kill':
      return role !== 'katil' ? 'Only the Killer kills' : t === seat ? 'Pick someone else' : null;
    case 'heal':
      return role !== 'cadi' ? 'Only the Witch has potions' : !s.potions[seat].heal ? 'Your healing potion is used up' : null;
    case 'poison':
      return role !== 'cadi' ? 'Only the Witch has potions' : !s.potions[seat].poison ? 'Your poison is used up' : t === seat ? 'Pick someone else' : null;
  }
  return 'Unknown action';
}

function resolveNight(s: VampirState, ctx: Clock): VampirState {
  const actsOf = (kind: Act['kind']) => s.acts.flatMap((a, i) => (a && a.kind === kind && s.alive[i] ? [{ seat: i, target: (a as { target: Seat }).target }] : []));
  const protectedSeats = new Set([...actsOf('protect'), ...actsOf('heal')].map((x) => x.target));
  const guards = actsOf('guard');
  const deaths = new Map<Seat, Cause>();
  const elderHit = s.elderHit.slice();
  let attacked = false;
  let saved = false;

  const attack = (victim: Seat, cause: 'bite' | 'kill') => {
    attacked = true;
    if (protectedSeats.has(victim)) {
      saved = true;
      return;
    }
    const guard = guards.find((g) => g.target === victim && !deaths.has(g.seat));
    if (guard) {
      deaths.set(guard.seat, 'guard');
      return;
    }
    if (cause === 'bite' && s.roles[victim] === 'yasli' && !elderHit[victim]) {
      elderHit[victim] = true;
      saved = true;
      return;
    }
    if (!deaths.has(victim)) deaths.set(victim, cause);
  };

  const bites = s.acts.flatMap((a, i) => (a?.kind === 'bite' && s.alive[i] && s.roles[i] === 'vampir' ? [a.target] : []));
  const { top } = plurality(bites, ctx.random);
  if (top !== null && top !== -1) attack(top, 'bite');
  for (const k of actsOf('kill')) attack(k.target, 'kill');
  for (const p of actsOf('poison')) {
    attacked = true;
    deaths.set(p.target, 'poison');
  }

  const potions = s.potions.map((p, i) => {
    const a = s.acts[i];
    return a?.kind === 'heal' ? { ...p, heal: false } : a?.kind === 'poison' ? { ...p, poison: false } : p;
  });
  const lastTarget = s.lastTarget.map((t, i) => {
    const a = s.acts[i];
    return a && (a.kind === 'protect' || a.kind === 'guard') ? a.target : s.roles[i] === 'doktor' || s.roles[i] === 'koruma' ? null : t;
  });

  const alive = s.alive.slice();
  const events: GameEvent[] = [...s.events];
  for (const [seat, cause] of deaths) {
    alive[seat] = false;
    events.push({ kind: 'died', day: s.day, night: true, seat, cause, role: s.reveal ? s.roles[seat] : null });
  }
  if (!deaths.size) events.push(attacked && saved ? { kind: 'saved', day: s.day } : { kind: 'quiet', day: s.day });
  const shooters = [...deaths.keys()].filter((i) => s.roles[i] === 'avci');
  const next: VampirState = {
    ...s,
    alive,
    events,
    elderHit,
    potions,
    lastTarget,
    shooters,
    next: 'day',
    acts: Array(s.n).fill(null),
    phase: 'dawn',
    deadline: ctx.now() + DAWN_MS,
  };
  return finishIfOver(next);
}

function resolveDay(s: VampirState, ctx: Clock): VampirState {
  const { top, tied } = plurality(
    s.votes.filter((_, i) => s.alive[i]),
    ctx.random,
  );
  const next: VampirState = { ...s, phase: 'dusk', next: 'night', deadline: ctx.now() + DAWN_MS };
  if (top === null || top === -1 || tied) return finishIfOver({ ...next, events: [...s.events, { kind: 'tie', day: s.day }] });
  if (s.roles[top] === 'aga' && !s.nobleUsed[top]) {
    const nobleUsed = s.nobleUsed.map((u, i) => u || i === top);
    return { ...next, nobleUsed, events: [...s.events, { kind: 'noble', day: s.day, seat: top }] };
  }
  const alive = s.alive.map((a, i) => a && i !== top);
  const events: GameEvent[] = [...s.events, { kind: 'banished', day: s.day, seat: top, role: s.reveal ? s.roles[top] : null }];
  // The Jester wins the moment the village votes them out, and the game ends
  if (s.roles[top] === 'soytari') return { ...next, alive, events: [...events, { kind: 'jester', day: s.day, seat: top }], phase: 'done', deadline: null, winner: 'jester', jester: top };
  return finishIfOver({ ...next, alive, events, shooters: s.roles[top] === 'avci' ? [top] : [] });
}

export function activePlayers(s: VampirState): Seat[] {
  if (s.phase === 'night') return aliveSeats(s).filter((i) => s.acts[i] === null);
  if (s.phase === 'day') return aliveSeats(s).filter((i) => s.votes[i] === null);
  if (s.phase === 'shoot') return s.shooters.slice(0, 1);
  return [];
}

function startDay(s: VampirState, now: number): VampirState {
  return { ...s, phase: 'day', votes: Array(s.n).fill(null), deadline: s.dayMs === null ? null : now + s.dayMs };
}

function startNight(s: VampirState, now: number): VampirState {
  return { ...s, phase: 'night', day: s.day + 1, acts: Array(s.n).fill(null), deadline: s.nightMs === null ? null : now + s.nightMs };
}

/** After announcements: hunters shoot, then the game goes on (or ends) */
function proceed(s: VampirState, now: number): VampirState {
  if (s.shooters.length) return { ...s, phase: 'shoot', deadline: now + SHOOT_MS };
  const done = finishIfOver(s);
  if (done.phase === 'done') return done;
  return s.next === 'day' ? startDay(s, now) : startNight(s, now);
}

function shoot(s: VampirState, target: Seat | -1, now: number): VampirState {
  const rest = s.shooters.slice(1);
  let next: VampirState = { ...s, shooters: rest };
  if (target !== -1 && s.alive[target]) {
    next = {
      ...next,
      alive: s.alive.map((a, i) => a && i !== target),
      events: [...s.events, { kind: 'died', day: s.day, night: s.next === 'day', seat: target, cause: 'shot', role: s.reveal ? s.roles[target] : null }],
      // A hunter shot by a hunter gets a shot too
      shooters: s.roles[target] === 'avci' ? [...rest, target] : rest,
    };
  }
  return proceed(next, now);
}

export function move(s: VampirState, seat: Seat, m: VampirMove, ctx: Clock): VampirState | string {
  if (s.phase === 'done') return 'The game is over';
  if (s.phase === 'shoot') {
    if (m?.type !== 'shoot' || seat !== s.shooters[0]) return 'Wait for the hunter';
    if (m.target !== -1 && (!Number.isInteger(m.target) || !s.alive[m.target] || m.target === seat)) return 'Pick a living player, or nobody';
    return shoot(s, m.target, ctx.now());
  }
  if (!s.alive[seat]) return 'The dead stay quiet 👻';
  if (s.phase === 'night') {
    if (m?.type !== 'act' || !m.act) return 'It is night';
    if (s.acts[seat]) return 'You already acted tonight';
    const err = allowedAct(s, seat, m.act);
    if (err) return err;
    const acts = s.acts.map((a, i) => (i === seat ? m.act : a));
    let next: VampirState = { ...s, acts };
    if (m.act.kind === 'see') {
      const t = m.act.target;
      next = { ...next, seen: [...s.seen, { seer: seat, target: t, vampire: looksLikeVampire(s.roles[t]), day: s.day }] };
    }
    return activePlayers(next).length ? next : resolveNight(next, ctx);
  }
  if (s.phase === 'day') {
    if (m?.type !== 'vote') return 'Vote for someone (or nobody)';
    if (s.votes[seat] !== null) return 'You already voted';
    if (m.target !== -1 && (!Number.isInteger(m.target) || !s.alive[m.target] || m.target === seat)) return 'Vote for another living player, or nobody';
    const votes = s.votes.map((v, i) => (i === seat ? m.target : v));
    const next = { ...s, votes };
    return activePlayers(next).length ? next : resolveDay(next, ctx);
  }
  return 'Wait for the next phase';
}

export function onTimer(s: VampirState, ctx: GameCtx): VampirState {
  if (s.phase === 'night') return resolveNight(s, ctx);
  if (s.phase === 'day') return resolveDay(s, ctx);
  if (s.phase === 'shoot') return shoot(s, -1, ctx.now());
  if (s.phase === 'dawn' || s.phase === 'dusk') return proceed(s, ctx.now());
  return s;
}

export function view(s: VampirState, seat: Seat): VampirView {
  const mine = s.roles[seat];
  const all = s.phase === 'done' || !s.alive[seat];
  const revealedDead = (i: number) => {
    for (const e of s.events) if ((e.kind === 'died' || e.kind === 'banished') && e.seat === i && e.role) return e.role;
    return null;
  };
  const noble = (i: number) => s.nobleUsed[i];
  const knows = (i: number) => {
    if (all || i === seat) return true;
    const r = s.roles[i];
    if ((mine === 'vampir' || mine === 'hain') && r === 'vampir') return true;
    if (mine === 'kardes' && r === 'kardes') return true;
    return false;
  };
  return {
    me: seat,
    n: s.n,
    myRole: mine,
    phase: s.phase,
    day: s.day,
    alive: s.alive,
    known: s.roles.map((r, i) => (knows(i) ? r : noble(i) ? 'aga' : !s.alive[i] ? revealedDead(i) : null)),
    bites: mine === 'vampir' || all ? s.acts.map((a) => (a?.kind === 'bite' ? a.target : null)) : null,
    acted: s.acts[seat] !== null,
    lastTarget: mine === 'doktor' || mine === 'koruma' ? s.lastTarget[seat] : null,
    potions: mine === 'cadi' ? s.potions[seat] : null,
    seen: s.seen.filter((x) => x.seer === seat || all).map(({ target, vampire, day }) => ({ target, vampire, day })),
    votes: s.votes,
    events: s.events,
    shooter: s.phase === 'shoot' ? (s.shooters[0] ?? null) : null,
    deadline: s.deadline,
    winner: s.winner,
  };
}

export function result(s: VampirState): GameResult | null {
  if (!s.winner) return null;
  const seats = s.roles.map((_, i) => i);
  if (s.winner === 'jester') return { winners: [s.jester!], message: 'The Jester fooled everyone and wins! 🃏' };
  if (s.winner === 'killer') return { winners: seats.filter((i) => s.roles[i] === 'katil'), message: 'The Killer wins! 🔪' };
  if (s.winner === 'vampires') return { winners: seats.filter((i) => onVampireSide(s.roles[i])), message: 'The vampires win! 🧛 The village has fallen.' };
  return { winners: seats.filter((i) => roleTeam(s.roles[i]) === 'village'), message: 'The village wins! Every threat is gone. 🌅' };
}

// ------------------------------------------------------------- bot

export function bot(v: VampirView, seat: Seat, ctx: BotCtx): VampirMove {
  const r = ctx.random;
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const others = v.alive.flatMap((a, i) => (a && i !== seat ? [i] : []));
  const vampAlly = (i: number) => v.known[i] === 'vampir';
  const knownVamp = v.seen.find((x) => x.vampire && v.alive[x.target])?.target;
  const cleared = new Set(v.seen.filter((x) => !x.vampire).map((x) => x.target));

  if (v.phase === 'shoot') {
    const target = knownVamp ?? (others.length ? pick(others.filter((i) => !cleared.has(i)).length ? others.filter((i) => !cleared.has(i)) : others) : -1);
    return { type: 'shoot', target: target ?? -1 };
  }

  if (v.phase === 'night') {
    const act = (a: Act): VampirMove => ({ type: 'act', act: a });
    switch (v.myRole) {
      case 'vampir': {
        const victims = others.filter((i) => !vampAlly(i));
        const chosen = (v.bites ?? []).filter((b): b is Seat => b !== null && victims.includes(b));
        return act({ kind: 'bite', target: chosen.length && ctx.level !== 'easy' ? chosen[0] : pick(victims) });
      }
      case 'doktor': {
        const opts = v.alive.flatMap((a, i) => (a && i !== v.lastTarget ? [i] : []));
        const self = opts.includes(seat) && r() < (ctx.level === 'hard' ? 0.35 : 0.15);
        return act({ kind: 'protect', target: self ? seat : pick(opts) });
      }
      case 'koruma': {
        const opts = others.filter((i) => i !== v.lastTarget);
        return opts.length ? act({ kind: 'guard', target: pick(opts) }) : act({ kind: 'guard', target: others[0] });
      }
      case 'gozcu': {
        const unknown = others.filter((i) => !v.seen.some((x) => x.target === i));
        return act({ kind: 'see', target: pick(unknown.length ? unknown : others) });
      }
      case 'katil':
        return act({ kind: 'kill', target: pick(others) });
      case 'cadi': {
        if (v.potions?.poison && knownVamp !== undefined) return act({ kind: 'poison', target: knownVamp });
        if (v.potions?.heal && v.day > 1 && r() < 0.3) return act({ kind: 'heal', target: pick(v.alive.flatMap((a, i) => (a ? [i] : []))) });
        return act({ kind: 'sleep' });
      }
      default:
        return act({ kind: 'sleep' });
    }
  }

  // Day vote
  const tally = new Map<number, number>();
  for (const x of v.votes) if (x !== null && x !== -1) tally.set(x, (tally.get(x) ?? 0) + 1);
  const leader = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (v.myRole === 'vampir' || v.myRole === 'hain') {
    const safe = others.filter((i) => !vampAlly(i));
    if (leader !== undefined && !vampAlly(leader) && leader !== seat) return { type: 'vote', target: leader };
    return { type: 'vote', target: safe.length ? pick(safe) : -1 };
  }
  if (knownVamp !== undefined) return { type: 'vote', target: knownVamp };
  const suspects = others.filter((i) => !cleared.has(i) && !(v.myRole === 'kardes' && v.known[i] === 'kardes'));
  if (leader !== undefined && leader !== seat && !cleared.has(leader) && r() < (ctx.level === 'easy' ? 0.3 : 0.6)) return { type: 'vote', target: leader };
  if (!suspects.length || r() < 0.1) return { type: 'vote', target: -1 };
  return { type: 'vote', target: pick(suspects) };
}
