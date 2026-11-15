/** Extra facts for the home page: when a game was added (for the "New" badge) and how long a game takes. */

/**
 * Games added after the first launch, with the day they went live. They carry a "New" badge
 * for NEW_DAYS days. When adding a game, add a line here.
 */
export const ADDED: Record<string, string> = {
  'hava-hokeyi': '2026-11-14',
  'kim-daha-cok': '2026-11-14',
  'iki-dogru-bir-yalan': '2026-11-14',
  'zeka-kupu': '2026-11-14',
  'bes-harf': '2026-11-15',
  'uzay-savunmasi': '2026-11-15',
  hafiza: '2026-11-15',
  'bilgi-yarisi': '2026-11-15',
  'kelime-ustasi': '2026-11-15',
  'kelimeyi-anlat': '2026-11-15',
  'gizli-gorev': '2026-11-15',
  'pis-yedili': '2026-11-15',
  'casus-kim': '2026-11-15',
  bric: '2026-11-15',
  'dost-kazigi': '2026-11-15',
  kemps: '2026-11-15',
  garbage: '2026-11-15',
  trash: '2026-11-15',
  go: '2026-11-15',
  'tugla-kirma': '2026-11-15',
  'kelime-zinciri': '2026-11-15',
};

export const NEW_DAYS = 14;

export function isNew(id: string, now = Date.now()): boolean {
  const day = ADDED[id];
  if (!day) return false;
  const age = (now - new Date(day + 'T00:00:00').getTime()) / 86400000;
  return age >= 0 && age < NEW_DAYS;
}

/** How long one game usually takes: quick (under 10 min), medium (10–30 min), long (30+ min) */
export type Length = 'quick' | 'medium' | 'long';

export const LENGTH: Record<string, Length> = {
  // Cards
  batak: 'long',
  'esli-batak': 'long',
  'balayi-batagi': 'medium',
  '3-5-8': 'medium',
  'uclu-gommeli': 'medium',
  king: 'long',
  pisti: 'medium',
  'pis-yedili': 'medium',
  'papaz-kacti': 'quick',
  '51': 'medium',
  konken: 'medium',
  holdem: 'long',
  poker: 'medium',
  bric: 'long',
  hearts: 'long',
  spades: 'long',
  kemps: 'medium',
  durak: 'medium',
  trash: 'medium',
  garbage: 'medium',
  'dost-kazigi': 'medium',
  bluff: 'quick',
  // Tiles and boards
  okey: 'medium',
  'okey-101': 'long',
  'esli-101': 'long',
  'kelime-ustasi': 'long',
  backgammon: 'medium',
  mahbusa: 'medium',
  'gul-bara': 'medium',
  'kizma-birader': 'medium',
  fetih: 'long',
  satranc: 'long',
  go: 'medium',
  dama: 'medium',
  mangala: 'quick',
  reversi: 'quick',
  gomoku: 'quick',
  'dokuz-tas': 'quick',
  'yilan-merdiven': 'quick',
  noktalar: 'quick',
  'amiral-batti': 'medium',
  xox: 'quick',
  'four-in-a-row': 'quick',
  // Party
  'vampir-koylu': 'long',
  'casus-kim': 'medium',
  'gizli-gorev': 'medium',
  'kelimeyi-anlat': 'medium',
  'iki-dogru-bir-yalan': 'medium',
  'kim-daha-cok': 'medium',
  'bilgi-yarisi': 'medium',
  'bes-harf': 'quick',
  'kelime-zinciri': 'quick',
  hafiza: 'quick',
  tombala: 'medium',
  'isim-sehir-hayvan': 'medium',
  'draw-guess': 'medium',
  'adam-asmaca': 'quick',
  generala: 'medium',
  'sayi-bulmaca': 'quick',
  rps: 'quick',
  'coin-flip': 'quick',
  // Solo and arcade
  marti: 'quick',
  'uzay-savunmasi': 'quick',
  'tugla-kirma': 'quick',
  'hava-hokeyi': 'quick',
  'zeka-kupu': 'medium',
  'tas-yagmuru': 'quick',
  yilan: 'quick',
  birlestir: 'medium',
  solitaire: 'medium',
  sudoku: 'medium',
  'mayin-tarlasi': 'quick',
  'kelime-avi': 'quick',
  nonogram: 'medium',
  kakuro: 'medium',
  'tas-esle': 'quick',
};

export const LENGTH_LABEL: Record<Length, string> = {
  quick: '⚡ under 10 min',
  medium: '⏱ 10–30 min',
  long: '⌛ 30+ min',
};
