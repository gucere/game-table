/**
 * Shared playing-card helpers.
 * A card is a number: suit * 13 + (rank - 2), with rank 2..14 (11 J, 12 Q, 13 K, 14 A).
 */
export type Card = number;
export type Suit = 0 | 1 | 2 | 3;

/** 0 spades (Maça), 1 hearts (Kupa), 2 clubs (Sinek), 3 diamonds (Karo) */
export const SUITS: Suit[] = [0, 1, 2, 3];
export const SUIT_SYMBOL = ['♠', '♥', '♣', '♦'];
export const SUIT_NAME = ['Spades', 'Hearts', 'Clubs', 'Diamonds'];
export const SUIT_NAME_TR = ['Maça', 'Kupa', 'Sinek', 'Karo'];

export const card = (suit: number, rank: number): Card => suit * 13 + (rank - 2);
export const suitOf = (c: Card) => Math.floor(c / 13) as Suit;
export const rankOf = (c: Card) => (c % 13) + 2;
export const isRed = (s: number) => s === 1 || s === 3;

export function rankLabel(r: number) {
  return ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' } as Record<number, string>)[r] ?? String(r);
}

export function cardLabel(c: Card) {
  return rankLabel(rankOf(c)) + SUIT_SYMBOL[suitOf(c)];
}

/** Standard 52-card deck, or a short deck starting at `minRank` (e.g. 6 for Durak) */
export function deck(minRank = 2): Card[] {
  const out: Card[] = [];
  for (const s of SUITS) for (let r = minRank; r <= 14; r++) out.push(card(s, r));
  return out;
}

export function shuffle<T>(arr: T[], random: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Group by suit (alternating colours, trump last), high to low within a suit */
export function sortHand(hand: Card[], trump: Suit | null = null): Card[] {
  const order = [0, 1, 2, 3].sort((a, b) => (a === trump ? 1 : 0) - (b === trump ? 1 : 0));
  return hand.slice().sort((a, b) => {
    const sa = order.indexOf(suitOf(a));
    const sb = order.indexOf(suitOf(b));
    return sa !== sb ? sa - sb : rankOf(b) - rankOf(a);
  });
}

export function sortByRank(hand: Card[]): Card[] {
  return hand.slice().sort((a, b) => rankOf(a) - rankOf(b) || suitOf(a) - suitOf(b));
}

export function remove(hand: Card[], cards: Card[]): Card[] {
  const set = new Set(cards);
  return hand.filter((c) => !set.has(c));
}
