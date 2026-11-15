/** Secret Santa: the draw, and the private links that carry each person's result. */

export interface Person {
  name: string;
  email: string;
}

export interface Reveal {
  /** giver */
  g: string;
  /** receiver */
  r: string;
  /** budget, date, note, language */
  b?: string;
  d?: string;
  m?: string;
  l?: string;
}

export const MAX_PEOPLE = 40;
export const isEmail = (s: string) => /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]{2,}$/.test(s.trim());

/**
 * Who buys for whom: receiver[i] is the person i buys a present for. Shuffles everyone into one
 * big circle, so nobody draws themselves and no two people simply swap presents (with 3+ people).
 */
export function drawCycle(n: number, random: () => number = Math.random): number[] {
  if (n < 2) throw new Error('Need at least 2 people');
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const receiver = Array(n).fill(-1);
  for (let k = 0; k < n; k++) receiver[order[k]] = order[(k + 1) % n];
  return receiver;
}

/**
 * A draw where some pairs may not draw each other (couples, siblings…), either way round.
 * Tries the single-circle draw first, then searches; null if the rules make it impossible.
 */
export function drawWithExclusions(n: number, exclusions: [number, number][], random: () => number = Math.random): number[] | null {
  const banned = new Set(exclusions.flatMap(([a, b]) => [`${a}>${b}`, `${b}>${a}`]));
  const ok = (g: number, r: number) => g !== r && !banned.has(`${g}>${r}`);
  for (let k = 0; k < 200; k++) {
    const r = drawCycle(n, random);
    if (r.every((x, g) => ok(g, x))) return r;
  }
  // Backtracking over a random order of givers and candidates
  const order = Array.from({ length: n }, (_, i) => i).sort(() => random() - 0.5);
  const receiver = Array(n).fill(-1);
  const used = new Set<number>();
  const place = (k: number): boolean => {
    if (k === n) return true;
    const g = order[k];
    const options = Array.from({ length: n }, (_, i) => i)
      .filter((r) => !used.has(r) && ok(g, r))
      .sort(() => random() - 0.5);
    for (const r of options) {
      receiver[g] = r;
      used.add(r);
      if (place(k + 1)) return true;
      used.delete(r);
    }
    return false;
  };
  return place(0) ? receiver : null;
}

// The result is scrambled into the link so the organizer doesn't see it by accident while
// sending. It is not encryption: anyone determined could decode a link they have.
function keystream(salt: number, len: number) {
  const out = new Uint8Array(len);
  let x = salt >>> 0 || 1;
  for (let i = 0; i < len; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    out[i] = x & 0xff;
  }
  return out;
}

const toB64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export function encodeReveal(r: Reveal, random: () => number = Math.random): string {
  const data = new TextEncoder().encode(JSON.stringify(r));
  const salt = Math.floor(random() * 0xffffffff) >>> 0;
  const ks = keystream(salt, data.length);
  const out = new Uint8Array(4 + data.length);
  out.set([salt >>> 24, (salt >>> 16) & 0xff, (salt >>> 8) & 0xff, salt & 0xff]);
  data.forEach((b, i) => (out[4 + i] = b ^ ks[i]));
  return toB64url(out);
}

export function decodeReveal(token: string): Reveal | null {
  try {
    const bytes = fromB64url(token);
    if (bytes.length < 5) return null;
    const salt = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
    const ks = keystream(salt, bytes.length - 4);
    const data = bytes.slice(4).map((b, i) => b ^ ks[i]);
    const r = JSON.parse(new TextDecoder().decode(data)) as Reveal;
    return typeof r?.g === 'string' && typeof r?.r === 'string' ? r : null;
  } catch {
    return null;
  }
}

/** Problems with the list, or [] when it's ready to draw */
export function checkPeople(people: Person[]): string[] {
  const errors: string[] = [];
  if (people.length < 3) errors.push('Add at least 3 people.');
  if (people.length > MAX_PEOPLE) errors.push('At most {n} people.');
  if (people.some((p) => !p.name.trim())) errors.push('Every person needs a name.');
  if (people.some((p) => !isEmail(p.email))) errors.push('Check the email addresses.');
  const names = people.map((p) => p.name.trim().toLocaleLowerCase());
  if (new Set(names).size !== names.length) errors.push('Two people have the same name; add an initial to tell them apart.');
  const emails = people.map((p) => p.email.trim().toLowerCase());
  if (new Set(emails).size !== emails.length) errors.push('Two people have the same email address.');
  return errors;
}
