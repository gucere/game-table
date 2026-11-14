/** "My questions": a question pack kept in this browser, shareable as a link. */
import type { RawQ } from './questions';

const KEY = 'oyun-masasi:trivia-pack';
export const MAX_PACK = 200;
export const MAX_Q = 160;
export const MAX_A = 60;

/** Trim, cut to size, and drop questions without a question, an answer and at least one wrong answer */
export function cleanQ(raw: unknown): RawQ | null {
  if (!Array.isArray(raw)) return null;
  const parts = raw.map((x, i) => String(x ?? '').trim().slice(0, i === 0 ? MAX_Q : MAX_A));
  const [q, right, ...wrong] = parts;
  const wrongs = wrong.filter(Boolean).slice(0, 3);
  if (!q || !right || !wrongs.length) return null;
  if (wrongs.some((w) => w.toLocaleLowerCase() === right.toLocaleLowerCase())) return null;
  return [q, right, ...wrongs];
}

export function loadPack(): RawQ[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.map(cleanQ).filter((q): q is RawQ => !!q).slice(0, MAX_PACK) : [];
  } catch {
    return [];
  }
}

export function savePack(pack: RawQ[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(pack.slice(0, MAX_PACK)));
  } catch {
    /* storage full or unavailable */
  }
}

const toB64url = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export function encodePack(pack: RawQ[]) {
  return toB64url(new TextEncoder().encode(JSON.stringify(pack)));
}

export function decodePack(token: string): RawQ[] | null {
  try {
    const v = JSON.parse(new TextDecoder().decode(fromB64url(token)));
    if (!Array.isArray(v)) return null;
    const pack = v.map(cleanQ).filter((q): q is RawQ => !!q).slice(0, MAX_PACK);
    return pack.length ? pack : null;
  } catch {
    return null;
  }
}

/** Add questions, skipping ones already in the pack */
export function mergePacks(a: RawQ[], b: RawQ[]) {
  const seen = new Set(a.map((q) => q[0].toLocaleLowerCase()));
  return [...a, ...b.filter((q) => !seen.has(q[0].toLocaleLowerCase()))].slice(0, MAX_PACK);
}
