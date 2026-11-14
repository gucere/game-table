/**
 * Gizli Görev: two teams, a 5×5 grid of words. Each team's leader knows which words belong to
 * their team and gives one-word clues with a number; teammates guess. Find all your team's words
 * first, and never touch the bomb.
 */
import type { GameCtx, GameResult, Seat } from '../../engine/types';
import { shuffle } from '../cards/cards';
import { WORDS } from './words';

/** a = team A, b = team B, n = neutral, x = bomb */
export type Key = 'a' | 'b' | 'n' | 'x';
export const TEAM_KEY: Key[] = ['a', 'b'];

export interface MissionState {
  n: number;
  lang: 'tr' | 'en';
  words: string[];
  key: Key[];
  revealed: boolean[];
  team: 0 | 1;
  phase: 'clue' | 'guess' | 'done';
  clue: { word: string; count: number } | null;
  guesses: number;
  winner: 0 | 1 | null;
  bomb: boolean;
  log: { team: 0 | 1; word: string; count: number; picks: number[] }[];
}

export type MissionMove = { type: 'clue'; word: string; count: number } | { type: 'guess'; i: number } | { type: 'stop' };

export interface MissionView extends Omit<MissionState, 'key'> {
  me: Seat;
  myTeam: 0 | 1;
  leader: boolean;
  /** Full key for leaders; only revealed cards for everyone else (and everything at the end) */
  key: (Key | null)[];
  /** Words each team still has to find (public: everyone knows the totals) */
  remaining: [number, number];
}

export const teamOf = (seat: Seat) => (seat % 2) as 0 | 1;
/** The first player of each team leads it (seats 1 and 2 in the lobby) */
export const leaderOf = (team: 0 | 1): Seat => team;

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'random' | 'options'>): MissionState {
  const lang = ctx.options.lang === 'en' ? 'en' : 'tr';
  const words = shuffle([...new Set(WORDS[lang])], ctx.random).slice(0, 25);
  const first = (ctx.random() < 0.5 ? 0 : 1) as 0 | 1;
  const cards: Key[] = [...Array(9).fill(TEAM_KEY[first]), ...Array(8).fill(TEAM_KEY[1 - first]), ...Array(7).fill('n'), 'x'];
  return {
    n: ctx.numPlayers,
    lang,
    words,
    key: shuffle(cards, ctx.random),
    revealed: Array(25).fill(false),
    team: first,
    phase: 'clue',
    clue: null,
    guesses: 0,
    winner: null,
    bomb: false,
    log: [],
  };
}

export const left = (s: Pick<MissionState, 'key' | 'revealed'>, team: 0 | 1) => s.key.filter((k, i) => k === TEAM_KEY[team] && !s.revealed[i]).length;

const switchTeam = (s: MissionState): MissionState => ({ ...s, team: (1 - s.team) as 0 | 1, phase: 'clue', clue: null, guesses: 0 });

export function move(s: MissionState, seat: Seat, m: MissionMove): MissionState | string {
  if (s.phase === 'done') return 'Game over';
  if (teamOf(seat) !== s.team) return 'It’s the other team’s turn';
  const isLeader = seat === leaderOf(s.team);
  if (s.phase === 'clue') {
    if (!isLeader) return 'Wait for your leader’s clue';
    if (m?.type !== 'clue') return 'Give a clue';
    const word = String(m.word ?? '').trim();
    if (!word || /\s/.test(word) || word.length > 30) return 'The clue must be a single word';
    const lower = (x: string) => x.toLocaleLowerCase(s.lang === 'tr' ? 'tr' : 'en');
    if (s.words.some((w, i) => !s.revealed[i] && lower(w) === lower(word))) return 'The clue can’t be a word on the board';
    if (!Number.isInteger(m.count) || m.count < 1 || m.count > 9) return 'Pick a number from 1 to 9';
    return { ...s, phase: 'guess', clue: { word, count: m.count }, guesses: 0, log: [...s.log, { team: s.team, word, count: m.count, picks: [] }] };
  }
  if (isLeader) return 'Leaders don’t guess: let your team pick';
  if (m?.type === 'stop') {
    if (!s.guesses) return 'Make at least one guess first';
    return switchTeam(s);
  }
  if (m?.type !== 'guess' || !Number.isInteger(m.i) || m.i < 0 || m.i >= 25 || s.revealed[m.i]) return 'Pick a hidden word';
  const revealed = s.revealed.map((r, i) => r || i === m.i);
  const log = s.log.map((l, i) => (i === s.log.length - 1 ? { ...l, picks: [...l.picks, m.i] } : l));
  const k = s.key[m.i];
  const next: MissionState = { ...s, revealed, log, guesses: s.guesses + 1 };
  const other = (1 - s.team) as 0 | 1;
  if (k === 'x') return { ...next, phase: 'done', winner: other, bomb: true };
  if (left(next, 0) === 0) return { ...next, phase: 'done', winner: 0 };
  if (left(next, 1) === 0) return { ...next, phase: 'done', winner: 1 };
  if (k !== TEAM_KEY[s.team]) return switchTeam(next);
  // One bonus guess beyond the clue's number
  if (next.guesses > (s.clue?.count ?? 0)) return switchTeam(next);
  return next;
}

export function activePlayers(s: MissionState): Seat[] {
  if (s.phase === 'done') return [];
  if (s.phase === 'clue') return [leaderOf(s.team)];
  return Array.from({ length: s.n }, (_, i) => i).filter((i) => teamOf(i) === s.team && i !== leaderOf(s.team));
}

export function view(s: MissionState, seat: Seat): MissionView {
  const leader = seat === leaderOf(0) || seat === leaderOf(1);
  const all = leader || s.phase === 'done';
  return { ...s, me: seat, myTeam: teamOf(seat), leader, key: s.key.map((k, i) => (all || s.revealed[i] ? k : null)), remaining: [left(s, 0), left(s, 1)] };
}

export function result(s: MissionState): GameResult | null {
  if (s.phase !== 'done' || s.winner === null) return null;
  return { winners: Array.from({ length: s.n }, (_, i) => i).filter((i) => teamOf(i) === s.winner) };
}
