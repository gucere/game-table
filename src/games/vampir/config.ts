/** Role lineups: suggestions for each table size, and custom counts chosen by the host. */
import type { GameOptions } from '../../engine/types';
import { ROLE_IDS, onVampireSide, roleTeam, type Role } from './roles';

export type RoleCounts = Record<Role, number>;

export const emptyCounts = (): RoleCounts => Object.fromEntries(ROLE_IDS.map((r) => [r, 0])) as RoleCounts;

/** Suggested lineups: a good starting point, not perfect balance */
const SUGGESTED: Record<number, Partial<RoleCounts>> = {
  4: { vampir: 1, doktor: 1, gozcu: 1 },
  5: { vampir: 1, doktor: 1, gozcu: 1 },
  6: { vampir: 1, doktor: 1, gozcu: 1, avci: 1 },
  7: { vampir: 2, doktor: 1, gozcu: 1, avci: 1 },
  8: { vampir: 2, doktor: 1, gozcu: 1, avci: 1, cadi: 1 },
  9: { vampir: 2, doktor: 1, gozcu: 1, avci: 1, cadi: 1, soytari: 1 },
  10: { vampir: 2, hain: 1, doktor: 1, gozcu: 1, avci: 1, cadi: 1, koruma: 1, soytari: 1 },
  11: { vampir: 3, doktor: 1, gozcu: 1, avci: 1, cadi: 1, koruma: 1, soytari: 1, kardes: 2 },
  12: { vampir: 3, hain: 1, doktor: 1, gozcu: 1, avci: 1, cadi: 1, koruma: 1, soytari: 1, kardes: 2 },
};

export function suggestedCounts(n: number): RoleCounts {
  const counts = { ...emptyCounts(), ...(SUGGESTED[Math.max(4, Math.min(12, n))] ?? {}) };
  const used = Object.values(counts).reduce((a, b) => a + b, 0);
  counts.koylu += Math.max(0, n - used);
  return counts;
}

/** Problems with a lineup for this table, or null when it can be played */
export function checkCounts(n: number, c: RoleCounts): string | null {
  if (ROLE_IDS.some((r) => !Number.isInteger(c[r]) || c[r] < 0 || c[r] > 12)) return 'Every role count must be a whole number from 0 to 12.';
  const total = ROLE_IDS.reduce((a, r) => a + c[r], 0);
  if (total !== n) return 'The roles must add up to the number of players.';
  if (c.vampir < 1) return 'Include at least one vampire.';
  const vampSide = ROLE_IDS.reduce((a, r) => a + (onVampireSide(r) ? c[r] : 0), 0);
  if (vampSide * 2 >= n) return 'The vampire side must be smaller than everyone else.';
  if (!ROLE_IDS.some((r) => roleTeam(r) === 'village' && c[r] > 0)) return 'Include at least one village role.';
  return null;
}

/** A custom lineup from the options, or null if it is malformed */
function parseRoster(roster: string): RoleCounts | null {
  try {
    const parsed: unknown = JSON.parse(roster);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const entries = Object.entries(parsed as Record<string, unknown>);
    if (entries.some(([k, v]) => !(ROLE_IDS as readonly string[]).includes(k) || typeof v !== 'number')) return null;
    return { ...emptyCounts(), ...(parsed as Partial<RoleCounts>) };
  } catch {
    return null;
  }
}

/** The lineup the options describe: 'auto' (or nothing) means the suggestion for this table size */
export function countsFor(n: number, options: GameOptions): RoleCounts {
  if (!options.roster || options.roster === 'auto') return suggestedCounts(n);
  return parseRoster(options.roster) ?? suggestedCounts(n);
}

export function validateRoster(n: number, options: GameOptions): string | null {
  if (!Number.isInteger(n) || n < 4 || n > 12) return 'Vampir Köylü needs 4–12 players.';
  if (options.roster && options.roster !== 'auto' && !parseRoster(options.roster)) return 'The role lineup is invalid. Use the suggestion to reset it.';
  return checkCounts(n, countsFor(n, options));
}
