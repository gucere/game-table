/**
 * Remembers the room this device was in, so a refresh (or a phone waking up) can get back in.
 * Guests remember the room code; the host remembers the whole game so it can reopen the room.
 */
import type { GameOptions, PlayerInfo } from './types';

const GUEST_KEY = 'oyun-masasi:last-room';
const HOST_KEY = 'oyun-masasi:hosted-room';
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

export interface LastRoom {
  code: string;
  name: string;
  at: number;
}

export interface HostedRoom {
  code: string;
  hostName: string;
  gameId: string;
  options: GameOptions;
  seats: PlayerInfo[];
  /** Device id behind each seat, so returning players get their own seat back */
  seatIds: (string | null)[];
  phase: 'lobby' | 'playing';
  state: unknown;
  at: number;
}

function read<T extends { at: number }>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as T;
    if (!v || Date.now() - v.at > MAX_AGE_MS) return null;
    return v;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable: rejoining just won't be offered */
  }
}

export const loadLastRoom = () => read<LastRoom>(GUEST_KEY);
export const saveLastRoom = (r: LastRoom | null) => write(GUEST_KEY, r);
export const loadHostedRoom = () => read<HostedRoom>(HOST_KEY);
export const saveHostedRoom = (r: HostedRoom | null) => write(HOST_KEY, r);

/**
 * While a room is open in this tab we hold a Web Lock named after it, so another tab of the
 * same browser can tell the room is still live and doesn't offer to "rejoin" or "reopen" it.
 */
type Role = 'host' | 'guest';
const lockName = (role: Role, code: string) => `oyun-masasi:${role}:${code}`;

export function holdRoom(role: Role, code: string): () => void {
  let release = () => {};
  try {
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (!locks) return release;
    const done = new Promise<void>((r) => (release = r));
    locks.request(lockName(role, code), { ifAvailable: true }, (lock) => (lock ? done : undefined)).catch(() => {});
  } catch {
    /* no Web Locks: the rejoin banner just shows a little more often */
  }
  return () => release();
}

export async function roomOpenElsewhere(role: Role, code: string): Promise<boolean> {
  try {
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (!locks) return false;
    const q = await locks.query();
    return (q.held ?? []).some((l) => l.name === lockName(role, code));
  } catch {
    return false;
  }
}
