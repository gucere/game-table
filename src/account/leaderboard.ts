/**
 * Public leaderboards for score games (Martı, Uzay Savunması…).
 *
 * Firestore: leaderboards/{board}/scores/{uid}  { name, avatar, score, at }
 * One entry per player per board, their best. Anyone can read; only signed-in players write
 * their own entry, and only to raise it (rules in firebase/firestore.rules).
 * Scores come from the player's own browser, so a determined cheat could fake one.
 */
import type { Fb } from './account';
import type { GameDef, GameOptions } from '../engine/types';
import { defaultOptions } from '../engine/types';
import { avatarById, getProfile } from '../profile/profile';

export interface Entry {
  uid: string;
  name: string;
  avatar: string;
  score: number;
}

export const MAX_SCORE = 10_000_000;
const SAFE = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'x';

/** Board id: the game, plus the values of options that change difficulty ("yilan~walls~90") */
export function boardId(game: GameDef, options: GameOptions = {}): string {
  const opts = { ...defaultOptions(game), ...options };
  const parts = (game.leaderboard?.boardOptions ?? []).map((id) => SAFE(String(opts[id] ?? '')));
  return [game.id, ...parts].join('~');
}

/** Every board a game has (all option combinations), for clean-up */
export function allBoards(game: GameDef): string[] {
  let combos: GameOptions[] = [{}];
  for (const id of game.leaderboard?.boardOptions ?? []) {
    const choices = game.options?.find((o) => o.id === id)?.choices ?? [];
    combos = combos.flatMap((c) => choices.map((ch) => ({ ...c, [id]: ch.value })));
  }
  return combos.map((c) => boardId(game, c));
}

/** Labels of the options that make this board, e.g. ["Walls (harder)", "Fast"] */
export function boardLabels(game: GameDef, options: GameOptions = {}): string[] {
  const opts = { ...defaultOptions(game), ...options };
  return (game.leaderboard?.boardOptions ?? []).map((id) => {
    const o = game.options?.find((x) => x.id === id);
    return o?.choices.find((c) => c.value === opts[id])?.label ?? String(opts[id]);
  });
}

const clean = (uid: string, d: Record<string, unknown>): Entry => ({
  uid,
  name: typeof d.name === 'string' ? d.name.slice(0, 20) : '?',
  avatar: typeof d.avatar === 'string' ? d.avatar : '',
  score: typeof d.score === 'number' ? d.score : 0,
});

export async function topScores(f: Fb, board: string, n = 10): Promise<Entry[]> {
  const { collection, query, orderBy, limit, getDocs } = f.store;
  const snap = await getDocs(query(collection(f.db, 'leaderboards', board, 'scores'), orderBy('score', 'desc'), limit(n)));
  return snap.docs.map((d) => clean(d.id, d.data()));
}

export async function myEntry(f: Fb, board: string, uid: string): Promise<{ entry: Entry; rank: number } | null> {
  const { doc, getDoc, collection, query, where, getCountFromServer } = f.store;
  const snap = await getDoc(doc(f.db, 'leaderboards', board, 'scores', uid));
  if (!snap.exists()) return null;
  const entry = clean(uid, snap.data());
  const above = await getCountFromServer(query(collection(f.db, 'leaderboards', board, 'scores'), where('score', '>', entry.score)));
  return { entry, rank: above.data().count + 1 };
}

/** Saves a score if it beats your entry. Returns your best afterwards. */
export async function postScore(f: Fb, board: string, uid: string, score: number): Promise<{ best: number; improved: boolean }> {
  const s = Math.floor(score);
  if (!Number.isFinite(s) || s <= 0 || s > MAX_SCORE) return { best: 0, improved: false };
  const { doc, getDoc, setDoc, serverTimestamp } = f.store;
  const ref = doc(f.db, 'leaderboards', board, 'scores', uid);
  const old = await getDoc(ref);
  const best = old.exists() ? Number(old.data().score) || 0 : 0;
  if (s <= best) return { best, improved: false };
  const p = getProfile('acct_' + uid);
  await setDoc(ref, {
    name: (p?.name ?? 'Player').trim().slice(0, 20) || 'Player',
    avatar: p && avatarById(p.avatar) ? p.avatar : 'fox',
    score: s,
    at: serverTimestamp(),
  });
  return { best: s, improved: true };
}

/** Deleting the account: remove your entries from every board */
export async function purgeScores(f: Fb, uid: string) {
  const { GAMES } = await import('../games');
  const boards = GAMES.filter((g) => g.leaderboard).flatMap(allBoards);
  await Promise.all(boards.map((b) => f.store.deleteDoc(f.store.doc(f.db, 'leaderboards', b, 'scores', uid)).catch(() => {})));
}

// ---- "Always add my best scores" (per device)

const AUTO_KEY = 'oyun-masasi:leaderboard-auto';
export function autoPost(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) === '1';
  } catch {
    return false;
  }
}
export function setAutoPost(on: boolean) {
  try {
    localStorage.setItem(AUTO_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}
