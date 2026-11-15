/**
 * Game stats and achievements, kept on this device for each profile (or for guests).
 * Nothing leaves the device unless you copy a backup code yourself.
 */
import { useSyncExternalStore } from 'react';
import { SECTIONS } from '../games/sections';
import { statsOwner } from './profile';

export interface GameStat {
  played: number;
  won: number;
  drawn: number;
  /** Current winning streak in this game */
  streak: number;
  best: number;
  last: number;
}

export interface Stats {
  games: Record<string, GameStat>;
  /** Winning streak across all games */
  streak: number;
  bestStreak: number;
  /** Days (YYYY-MM-DD) with at least one finished game, newest last, at most 60 */
  days: string[];
  online: number;
  hardWins: number;
  bigTables: number;
  nights: number;
  hintsUsed: number;
  /** Achievement id → when it was earned */
  achievements: Record<string, number>;
  /** Liked games: game id → when you liked it (positive) or un-liked it (negative), so devices agree on the latest */
  likes: Record<string, number>;
  /** Game id → when you last started it */
  opened: Record<string, number>;
}

export interface FinishedGame {
  gameId: string;
  won: boolean;
  draw: boolean;
  /** A game for one (puzzles): "won" means solved */
  solo: boolean;
  online: boolean;
  /** A hard bot was at the table and you won */
  beatHardBot: boolean;
  players: number;
}

const WORD_GAMES = ['bes-harf', 'kelime-ustasi', 'adam-asmaca', 'kelime-avi', 'kelime-zinciri', 'kelimeyi-anlat', 'isim-sehir-hayvan'];
const PUZZLES = ['sudoku', 'kakuro', 'nonogram', 'mayin-tarlasi', 'zeka-kupu', 'birlestir', 'solitaire', 'tas-esle', 'hafiza', 'kelime-avi'];
const CARD_GAMES = SECTIONS[0].ids;
const BOARD_GAMES = SECTIONS[1].ids.filter((id) => !id.includes('okey') && id !== 'kelime-ustasi' && id !== 'esli-101');

export interface AchievementDef {
  id: string;
  icon: string;
  name: string;
  description: string;
  check(s: Stats): boolean;
}

const wins = (s: Stats, ids?: string[]) => Object.entries(s.games).reduce((n, [id, g]) => n + (!ids || ids.includes(id) ? g.won : 0), 0);
const played = (s: Stats) => Object.values(s.games).reduce((n, g) => n + g.played, 0);
const kinds = (s: Stats) => Object.values(s.games).filter((g) => g.played > 0).length;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-game', icon: '🎲', name: 'First game', description: 'Finish any game.', check: (s) => played(s) >= 1 },
  { id: 'first-win', icon: '🏆', name: 'First win', description: 'Win a game or solve a puzzle.', check: (s) => wins(s) >= 1 },
  { id: 'wins-10', icon: '🥉', name: 'Ten wins', description: 'Win 10 times.', check: (s) => wins(s) >= 10 },
  { id: 'wins-50', icon: '🥈', name: 'Fifty wins', description: 'Win 50 times.', check: (s) => wins(s) >= 50 },
  { id: 'wins-200', icon: '🥇', name: 'Two hundred wins', description: 'Win 200 times.', check: (s) => wins(s) >= 200 },
  { id: 'streak-3', icon: '🔥', name: 'On fire', description: 'Win 3 games in a row.', check: (s) => s.bestStreak >= 3 },
  { id: 'streak-7', icon: '☄️', name: 'Unstoppable', description: 'Win 7 games in a row.', check: (s) => s.bestStreak >= 7 },
  { id: 'variety-5', icon: '🧭', name: 'Explorer', description: 'Play 5 different games.', check: (s) => kinds(s) >= 5 },
  { id: 'variety-20', icon: '🗺️', name: 'Globetrotter', description: 'Play 20 different games.', check: (s) => kinds(s) >= 20 },
  { id: 'hard-bot', icon: '🤖', name: 'Bot beater', description: 'Win against a hard bot.', check: (s) => s.hardWins >= 1 },
  { id: 'hard-bot-10', icon: '🦾', name: 'Machine tamer', description: 'Win against hard bots 10 times.', check: (s) => s.hardWins >= 10 },
  { id: 'online', icon: '🌐', name: 'Connected', description: 'Finish a game online.', check: (s) => s.online >= 1 },
  { id: 'online-25', icon: '📡', name: 'Regular', description: 'Finish 25 games online.', check: (s) => s.online >= 25 },
  { id: 'big-table', icon: '👥', name: 'Full house', description: 'Play a game with 6 or more players.', check: (s) => s.bigTables >= 1 },
  { id: 'night', icon: '🌙', name: 'Night owl', description: 'Finish a game night.', check: (s) => s.nights >= 1 },
  { id: 'words', icon: '📚', name: 'Wordsmith', description: 'Win 10 word games.', check: (s) => wins(s, WORD_GAMES) >= 10 },
  { id: 'puzzles', icon: '🧩', name: 'Puzzle solver', description: 'Solve 10 puzzles.', check: (s) => wins(s, PUZZLES) >= 10 },
  { id: 'cards', icon: '🃏', name: 'Card shark', description: 'Win 10 card games.', check: (s) => wins(s, CARD_GAMES) >= 10 },
  { id: 'boards', icon: '♟️', name: 'Strategist', description: 'Win 10 board games.', check: (s) => wins(s, BOARD_GAMES) >= 10 },
  { id: 'days-7', icon: '📅', name: 'Week of play', description: 'Play on 7 different days.', check: (s) => s.days.length >= 7 },
  { id: 'learner', icon: '💡', name: 'Quick learner', description: 'Use a hint, then win that game.', check: () => false },
];

export function emptyStats(): Stats {
  return { games: {}, streak: 0, bestStreak: 0, days: [], online: 0, hardWins: 0, bigTables: 0, nights: 0, hintsUsed: 0, achievements: {}, likes: {}, opened: {} };
}

const key = (owner: string) => 'oyun-masasi:stats:' + owner;

function read(owner: string): Stats {
  try {
    const raw = localStorage.getItem(key(owner));
    if (raw) return { ...emptyStats(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return emptyStats();
}

const listeners = new Set<() => void>();
let cache: { owner: string; stats: Stats } | null = null;

export function getStats(owner = statsOwner()): Stats {
  if (!cache || cache.owner !== owner) cache = { owner, stats: read(owner) };
  return cache.stats;
}

function write(owner: string, s: Stats) {
  cache = { owner, stats: s };
  try {
    localStorage.setItem(key(owner), JSON.stringify(s));
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn());
}

export function useStats(owner: string): Stats {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => getStats(owner),
  );
}

const today = () => new Date().toISOString().slice(0, 10);

/** Pure: the stats after one finished game, and the achievements it unlocked */
export function applyGame(prev: Stats, g: FinishedGame, usedHint = false, now = Date.now(), day = today()): { stats: Stats; unlocked: AchievementDef[] } {
  const s: Stats = { ...prev, games: { ...prev.games }, achievements: { ...prev.achievements } };
  const old = s.games[g.gameId] ?? { played: 0, won: 0, drawn: 0, streak: 0, best: 0, last: 0 };
  const gs: GameStat = { ...old, played: old.played + 1, last: now };
  if (g.won) {
    gs.won++;
    gs.streak++;
    gs.best = Math.max(gs.best, gs.streak);
  } else {
    if (g.draw) gs.drawn++;
    gs.streak = 0;
  }
  s.games[g.gameId] = gs;
  // Puzzles don't break the overall streak when you give up; games against others do
  if (g.won) {
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
  } else if (!g.solo) s.streak = 0;
  if (!s.days.includes(day)) s.days = [...s.days, day].slice(-60);
  if (g.online) s.online++;
  if (g.beatHardBot) s.hardWins++;
  if (g.players >= 6) s.bigTables++;
  if (usedHint) s.hintsUsed++;
  const unlocked: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (s.achievements[a.id]) continue;
    const ok = a.id === 'learner' ? usedHint && g.won : a.check(s);
    if (ok) {
      s.achievements[a.id] = now;
      unlocked.push(a);
    }
  }
  return { stats: s, unlocked };
}

export function recordGame(g: FinishedGame, usedHint = false): AchievementDef[] {
  const owner = statsOwner();
  const { stats, unlocked } = applyGame(getStats(owner), g, usedHint);
  write(owner, stats);
  return unlocked;
}

export function recordNight(): AchievementDef[] {
  const owner = statsOwner();
  const s = { ...getStats(owner), achievements: { ...getStats(owner).achievements } };
  s.nights++;
  const unlocked = ACHIEVEMENTS.filter((a) => !s.achievements[a.id] && a.id !== 'learner' && a.check(s));
  unlocked.forEach((a) => (s.achievements[a.id] = Date.now()));
  write(owner, s);
  return unlocked;
}

export function onStatsChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const newest = (s: Stats) => Math.max(0, ...Object.values(s.games).map((g) => g.last));

/** The newer like / un-like wins for each game */
function mergeLikes(a: Record<string, number>, b: Record<string, number>) {
  const out = { ...b };
  for (const [k, v] of Object.entries(a)) if (!(k in out) || Math.abs(v) > Math.abs(out[k])) out[k] = v;
  return out;
}

/**
 * Combines the stats of one person kept on two devices. Counters take the larger value and
 * achievements and days are joined, so merging the same data again changes nothing.
 */
export function mergeStats(a: Stats, b: Stats): Stats {
  const games: Record<string, GameStat> = {};
  for (const id of new Set([...Object.keys(a.games), ...Object.keys(b.games)])) {
    const x = a.games[id];
    const y = b.games[id];
    if (!x || !y) {
      games[id] = { ...(x ?? y)! };
      continue;
    }
    const later = x.last >= y.last ? x : y;
    games[id] = { played: Math.max(x.played, y.played), won: Math.max(x.won, y.won), drawn: Math.max(x.drawn, y.drawn), streak: later.streak, best: Math.max(x.best, y.best), last: later.last };
  }
  const achievements: Record<string, number> = { ...b.achievements };
  for (const [k, t] of Object.entries(a.achievements)) achievements[k] = achievements[k] ? Math.min(achievements[k], t) : t;
  const max = (k: 'bestStreak' | 'online' | 'hardWins' | 'bigTables' | 'nights' | 'hintsUsed') => Math.max(a[k] ?? 0, b[k] ?? 0);
  return {
    games,
    streak: (newest(a) >= newest(b) ? a : b).streak,
    bestStreak: max('bestStreak'),
    days: [...new Set([...a.days, ...b.days])].sort().slice(-60),
    online: max('online'),
    hardWins: max('hardWins'),
    bigTables: max('bigTables'),
    nights: max('nights'),
    hintsUsed: max('hintsUsed'),
    achievements,
    likes: mergeLikes(a.likes ?? {}, b.likes ?? {}),
    opened: Object.fromEntries([...new Set([...Object.keys(a.opened ?? {}), ...Object.keys(b.opened ?? {})])].map((k) => [k, Math.max(a.opened?.[k] ?? 0, b.opened?.[k] ?? 0)])),
  };
}

/** Clean stats from outside (the account database): wrong shapes become empty */
export function cleanStats(raw: unknown): Stats {
  const s = emptyStats();
  if (!raw || typeof raw !== 'object') return s;
  const r = raw as Partial<Stats>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  if (r.games && typeof r.games === 'object')
    for (const [id, g] of Object.entries(r.games).slice(0, 300)) {
      if (!g || typeof g !== 'object') continue;
      s.games[id.slice(0, 40)] = { played: num(g.played), won: num(g.won), drawn: num(g.drawn), streak: num(g.streak), best: num(g.best), last: num(g.last) };
    }
  for (const k of ['streak', 'bestStreak', 'online', 'hardWins', 'bigTables', 'nights', 'hintsUsed'] as const) s[k] = num(r[k]);
  const ids = (o: unknown) => (o && typeof o === 'object' ? Object.entries(o as Record<string, unknown>).slice(0, 300) : []);
  for (const [k, v] of ids(r.likes)) if (typeof v === 'number' && Number.isFinite(v) && v !== 0) s.likes[k.slice(0, 40)] = Math.trunc(v);
  for (const [k, v] of ids(r.opened)) if (num(v)) s.opened[k.slice(0, 40)] = num(v);
  if (Array.isArray(r.days)) s.days = r.days.filter((d) => typeof d === 'string' && /^\d{4}-\d\d-\d\d$/.test(d)).slice(-60);
  if (r.achievements && typeof r.achievements === 'object')
    for (const [k, t] of Object.entries(r.achievements)) if (ACHIEVEMENTS.some((a) => a.id === k)) s.achievements[k] = num(t) || Date.now();
  return s;
}

/** Clears stats and achievements; liked games stay */
export function resetStats(owner = statsOwner()) {
  const old = getStats(owner);
  write(owner, { ...emptyStats(), likes: old.likes ?? {}, opened: old.opened ?? {} });
}

// ---- Liked and recently played games (kept with the stats, so they follow the profile and account)

export const isLiked = (s: Stats, id: string) => (s.likes?.[id] ?? 0) > 0;

export function toggleLike(id: string) {
  const owner = statsOwner();
  const s = getStats(owner);
  const now = Date.now();
  write(owner, { ...s, likes: { ...(s.likes ?? {}), [id]: isLiked(s, id) ? -now : now } });
}

export function markOpened(id: string) {
  const owner = statsOwner();
  const s = getStats(owner);
  write(owner, { ...s, opened: { ...(s.opened ?? {}), [id]: Date.now() } });
}

/** Liked game ids, most recently liked first */
export const likedIds = (s: Stats) =>
  Object.entries(s.likes ?? {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);

/** Recently started or finished games, newest first */
export function recentIds(s: Stats, n = 8) {
  const at: Record<string, number> = { ...(s.opened ?? {}) };
  for (const [k, g] of Object.entries(s.games)) at[k] = Math.max(at[k] ?? 0, g.last);
  return Object.entries(at)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

// --- Backup codes: copy your profile and stats to another device by hand

export function backupCode(profile: object | null, owner = statsOwner()): string {
  const json = JSON.stringify({ v: 1, profile, stats: getStats(owner) });
  return btoa(String.fromCharCode(...new TextEncoder().encode(json)));
}

export function readBackup(code: string): { profile: Record<string, unknown> | null; stats: Stats } | null {
  try {
    const json = new TextDecoder().decode(Uint8Array.from(atob(code.trim()), (c) => c.charCodeAt(0)));
    const d = JSON.parse(json);
    if (d?.v !== 1 || typeof d.stats !== 'object' || typeof d.stats.games !== 'object') return null;
    return { profile: d.profile && typeof d.profile === 'object' ? d.profile : null, stats: { ...emptyStats(), ...d.stats } };
  } catch {
    return null;
  }
}

export function restoreStats(owner: string, stats: Stats) {
  write(owner, stats);
}
