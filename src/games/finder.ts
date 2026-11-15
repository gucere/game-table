/** Finding a game on the home page: search (Turkish letters optional) and filters. */
import type { GameDef } from '../engine/types';
import { GAME_NAMES, GAME_TEXT_TR } from '../i18n/games';
import { SECTIONS } from './sections';
import { LENGTH, isNew, type Length } from './meta';

export type Mode = 'any' | 'bots' | 'device' | 'online';

export interface Filters {
  q: string;
  /** Number of players (6 means 6 or more), or null for any */
  players: number | null;
  mode: Mode;
  liked: boolean;
  /** How long a game takes, or null for any */
  length: Length | null;
  /** Only games added recently */
  fresh: boolean;
}

export const NO_FILTERS: Filters = { q: '', players: null, mode: 'any', liked: false, length: null, fresh: false };
export const filtering = (f: Filters) => !!f.q.trim() || f.players !== null || f.mode !== 'any' || f.liked || f.length !== null || f.fresh;

/** Lowercase without accents, so "satranc" finds "Satranç" and "kizma" finds "Kızma" */
export function fold(s: string): string {
  return s
    .replace(/[İIı]/g, 'i')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Extra words per section, so "card", "kart", "board" or "parti" find the whole group
const SECTION_WORDS: Record<string, string> = {
  'Card games': 'card cards kart kartlar kagit iskambil',
  'Tiles & boards': 'board tiles tahta tas masa oyunu strateji strategy',
  Party: 'party parti grup group friends arkadas',
  'Solo & arcade': 'solo arcade puzzle bulmaca tek kisilik atari',
};

const sectionOf = new Map(SECTIONS.flatMap((s) => s.ids.map((id) => [id, s.title] as const)));

interface Indexed {
  names: string;
  rest: string;
}
const cache = new Map<string, Indexed>();

function indexOf(g: GameDef): Indexed {
  let x = cache.get(g.id);
  if (!x) {
    const n = GAME_NAMES[g.id];
    const section = sectionOf.get(g.id) ?? '';
    x = {
      names: fold([g.name, n?.en, n?.tr, g.id.replace(/-/g, ' ')].filter(Boolean).join(' ')),
      rest: fold([g.tagline, GAME_TEXT_TR[g.id]?.tagline, section, SECTION_WORDS[section]].filter(Boolean).join(' ')),
    };
    cache.set(g.id, x);
  }
  return x;
}

/** 0 = no match; higher is a better match */
export function score(g: GameDef, q: string): number {
  const words = fold(q).split(' ').filter(Boolean);
  if (!words.length) return 1;
  const { names, rest } = indexOf(g);
  let total = 0;
  for (const w of words) {
    if (names.split(' ').some((n) => n.startsWith(w))) total += names.startsWith(w) ? 4 : 3;
    else if (names.includes(w)) total += 2;
    else if (rest.split(' ').some((n) => n.startsWith(w))) total += 1;
    else return 0;
  }
  return total;
}

export function fits(g: GameDef, f: Filters, liked: (id: string) => boolean): boolean {
  if (f.liked && !liked(g.id)) return false;
  if (f.length && LENGTH[g.id] !== f.length) return false;
  if (f.fresh && !isNew(g.id)) return false;
  if (f.players !== null) {
    if (f.players >= 6 ? g.maxPlayers < 6 : f.players < g.minPlayers || f.players > g.maxPlayers) return false;
  }
  if (f.mode === 'bots' && !g.bot) return false;
  if (f.mode === 'device' && g.onlineOnly) return false;
  if (f.mode === 'online' && (g.maxPlayers < 2 || g.localOnly)) return false;
  return true;
}

/** Games that match, best first (in their usual order when there's no search text) */
export function findGames(games: GameDef[], f: Filters, liked: (id: string) => boolean): GameDef[] {
  return games
    .map((g, i) => ({ g, i, s: fits(g, f, liked) ? score(g, f.q) : 0 }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.g);
}
