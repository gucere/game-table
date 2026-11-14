/**
 * Casus Kim?: everyone gets the same secret place, except the spy, who doesn't know it.
 * Players ask each other questions out loud. Find the spy before time runs out, while the spy
 * tries to work out where you all are.
 */
import type { GameCtx, GameResult, Seat } from '../../engine/types';

/** Our own list of places: [Turkish, English] */
export const PLACES: [string, string][] = [
  ['Kapalıçarşı', 'Covered bazaar'],
  ['Boğaz vapuru', 'Ferry'],
  ['Düğün salonu', 'Wedding hall'],
  ['Hastane', 'Hospital'],
  ['İlkokul', 'Primary school'],
  ['Uçak', 'Airplane'],
  ['Plaj', 'Beach'],
  ['Kamp alanı', 'Campsite'],
  ['Sinema', 'Cinema'],
  ['Futbol stadyumu', 'Football stadium'],
  ['Berber', 'Barber shop'],
  ['Kahvehane', 'Coffeehouse'],
  ['Süpermarket', 'Supermarket'],
  ['Müze', 'Museum'],
  ['Hamam', 'Turkish bath'],
  ['Gece treni', 'Night train'],
  ['Lunapark', 'Funfair'],
  ['Kütüphane', 'Library'],
  ['Balık lokantası', 'Fish restaurant'],
  ['Otel', 'Hotel'],
  ['Karakol', 'Police station'],
  ['Çiftlik', 'Farm'],
  ['Spor salonu', 'Gym'],
  ['Uzay istasyonu', 'Space station'],
  ['Denizaltı', 'Submarine'],
  ['Korsan gemisi', 'Pirate ship'],
  ['Sirk', 'Circus'],
  ['Banka', 'Bank'],
  ['Kayak merkezi', 'Ski resort'],
  ['Hayvanat bahçesi', 'Zoo'],
];

export interface SpyState {
  n: number;
  lang: 'tr' | 'en';
  place: number;
  spy: Seat;
  firstAsker: Seat;
  phase: 'play' | 'accuse' | 'final' | 'spyguess' | 'done';
  deadline: number | null;
  /** Time left when the clock was paused for an accusation */
  pausedMs: number;
  accusation: { by: Seat; suspect: Seat; votes: (boolean | null)[] } | null;
  /** Each player may start one accusation per game */
  accused: boolean[];
  finalVotes: (Seat | null)[];
  winner: 'spy' | 'town' | null;
  reason: 'caught' | 'wrong' | 'escaped' | 'spy-guessed' | 'spy-missed' | null;
  guess: number | null;
}

export type SpyMove = { type: 'accuse'; suspect: Seat } | { type: 'vote'; yes: boolean } | { type: 'final'; suspect: Seat } | { type: 'guess'; place: number };

export interface SpyView extends Omit<SpyState, 'place' | 'spy' | 'finalVotes'> {
  me: Seat;
  amSpy: boolean;
  /** The place (null for the spy until the end) */
  myPlace: number | null;
  /** Revealed at the end */
  spySeat: Seat | null;
  place: number | null;
  finalVoted: boolean[];
  finalVotes: (Seat | null)[] | null;
}

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'random' | 'options' | 'now'>): SpyState {
  const minutes = Number(ctx.options.minutes ?? 8);
  return {
    n: ctx.numPlayers,
    lang: ctx.options.lang === 'en' ? 'en' : 'tr',
    place: Math.floor(ctx.random() * PLACES.length),
    spy: Math.floor(ctx.random() * ctx.numPlayers),
    firstAsker: Math.floor(ctx.random() * ctx.numPlayers),
    phase: 'play',
    deadline: ctx.now() + minutes * 60000,
    pausedMs: 0,
    accusation: null,
    accused: Array(ctx.numPlayers).fill(false),
    finalVotes: Array(ctx.numPlayers).fill(null),
    winner: null,
    reason: null,
    guess: null,
  };
}

const end = (s: SpyState, winner: 'spy' | 'town', reason: SpyState['reason'], extra: Partial<SpyState> = {}): SpyState => ({ ...s, ...extra, phase: 'done', winner, reason, deadline: null, accusation: null });

export function move(s: SpyState, seat: Seat, m: SpyMove, ctx: Pick<GameCtx, 'now'>): SpyState | string {
  if (s.phase === 'done') return 'Game over';
  const valid = (x: unknown): x is Seat => Number.isInteger(x) && (x as number) >= 0 && (x as number) < s.n;

  if (m?.type === 'guess') {
    if (seat !== s.spy) return 'Only the spy can guess the place';
    if (s.phase !== 'play' && s.phase !== 'spyguess') return 'Not now';
    if (!Number.isInteger(m.place) || m.place < 0 || m.place >= PLACES.length) return 'Pick a place';
    return m.place === s.place ? end(s, 'spy', 'spy-guessed', { guess: m.place }) : end(s, 'town', 'spy-missed', { guess: m.place });
  }
  if (s.phase === 'play') {
    if (m?.type !== 'accuse') return 'Ask questions, or accuse someone';
    if (s.accused[seat]) return 'You already made your accusation';
    if (!valid(m.suspect) || m.suspect === seat) return 'Pick someone else';
    const votes = Array<boolean | null>(s.n).fill(null);
    votes[seat] = true;
    return {
      ...s,
      phase: 'accuse',
      pausedMs: Math.max(0, (s.deadline ?? ctx.now()) - ctx.now()),
      deadline: null,
      accused: s.accused.map((a, i) => a || i === seat),
      accusation: { by: seat, suspect: m.suspect, votes },
    };
  }
  if (s.phase === 'accuse') {
    const a = s.accusation!;
    if (m?.type !== 'vote') return 'Vote on the accusation';
    if (seat === a.suspect) return 'You are the one accused: you can’t vote';
    if (a.votes[seat] !== null) return 'You already voted';
    const votes = a.votes.map((v, i) => (i === seat ? !!m.yes : v));
    if (!m.yes) return { ...s, phase: 'play', accusation: null, deadline: ctx.now() + s.pausedMs };
    const done = votes.every((v, i) => i === a.suspect || v !== null);
    if (!done) return { ...s, accusation: { ...a, votes } };
    return a.suspect === s.spy ? end(s, 'town', 'caught') : end(s, 'spy', 'wrong');
  }
  if (s.phase === 'final') {
    if (m?.type !== 'final') return 'Vote for who you think the spy is';
    if (s.finalVotes[seat] !== null) return 'You already voted';
    if (!valid(m.suspect) || m.suspect === seat) return 'Pick someone else';
    const finalVotes = s.finalVotes.map((v, i) => (i === seat ? m.suspect : v));
    if (finalVotes.some((v) => v === null)) return { ...s, finalVotes };
    const count = Array(s.n).fill(0);
    for (const v of finalVotes) count[v!]++;
    const top = Math.max(...count);
    const leaders = count.flatMap((c, i) => (c === top ? [i] : []));
    // Caught only with a clear majority pick; then the spy gets one last guess at the place
    if (leaders.length === 1 && leaders[0] === s.spy) return { ...s, finalVotes, phase: 'spyguess' };
    return end(s, 'spy', 'escaped', { finalVotes });
  }
  return 'Not now';
}

export function onTimer(s: SpyState): SpyState {
  if (s.phase !== 'play') return s;
  return { ...s, phase: 'final', deadline: null };
}

export function activePlayers(s: SpyState): Seat[] {
  const all = Array.from({ length: s.n }, (_, i) => i);
  if (s.phase === 'play') return all;
  if (s.phase === 'accuse') return all.filter((i) => i !== s.accusation!.suspect && s.accusation!.votes[i] === null);
  if (s.phase === 'final') return all.filter((i) => s.finalVotes[i] === null);
  if (s.phase === 'spyguess') return [s.spy];
  return [];
}

export function view(s: SpyState, seat: Seat): SpyView {
  const done = s.phase === 'done';
  const amSpy = seat === s.spy;
  // Never pass the spy's seat or the place along: only what this player may know
  const { place: _place, spy: _spy, finalVotes: _votes, ...open } = s;
  return {
    ...open,
    me: seat,
    amSpy,
    myPlace: amSpy && !done ? null : s.place,
    spySeat: done ? s.spy : null,
    place: done ? s.place : null,
    finalVoted: s.finalVotes.map((v) => v !== null),
    finalVotes: done ? s.finalVotes : null,
  };
}

export function result(s: SpyState): GameResult | null {
  if (s.phase !== 'done') return null;
  if (s.winner === 'spy') return { winners: [s.spy] };
  return { winners: Array.from({ length: s.n }, (_, i) => i).filter((i) => i !== s.spy) };
}
