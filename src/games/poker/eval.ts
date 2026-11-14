/** Poker hand evaluation: best 5 cards out of up to 7, as a comparable number. */
import { rankOf, suitOf, type Card } from '../cards/cards';

export const HAND_NAMES = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];

/** Score of exactly five cards: category * 15^5 + tie-breakers */
export function eval5(cards: Card[]): number {
  const ranks = cards.map(rankOf).sort((a, b) => b - a);
  const flush = cards.every((c) => suitOf(c) === suitOf(cards[0]));
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  // Group by count, then rank (e.g. full house: trips first)
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const uniq = [...new Set(ranks)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
    else if (uniq.join() === '14,5,4,3,2') straightHigh = 5; // the wheel: A-2-3-4-5
  }
  const tb = (rs: number[]) => rs.reduce((a, r) => a * 15 + r, 0);
  const base = (cat: number) => cat * 15 ** 5;
  if (straightHigh && flush) return base(8) + straightHigh;
  if (groups[0][1] === 4) return base(7) + tb([groups[0][0], groups[1][0]]);
  if (groups[0][1] === 3 && groups[1][1] === 2) return base(6) + tb([groups[0][0], groups[1][0]]);
  if (flush) return base(5) + tb(ranks);
  if (straightHigh) return base(4) + straightHigh;
  if (groups[0][1] === 3) return base(3) + tb(groups.map((g) => g[0]));
  if (groups[0][1] === 2 && groups[1][1] === 2) return base(2) + tb(groups.map((g) => g[0]));
  if (groups[0][1] === 2) return base(1) + tb(groups.map((g) => g[0]));
  return base(0) + tb(ranks);
}

export const category = (score: number) => Math.floor(score / 15 ** 5);

/** Best score from 5–7 cards, and the five cards that make it */
export function best(cards: Card[]): { score: number; five: Card[] } {
  if (cards.length <= 5) return { score: eval5(cards), five: cards };
  let top = -1;
  let five: Card[] = [];
  const n = cards.length;
  const pick: Card[] = [];
  const go = (start: number) => {
    if (pick.length === 5) {
      const s = eval5(pick);
      if (s > top) {
        top = s;
        five = pick.slice();
      }
      return;
    }
    for (let i = start; i <= n - (5 - pick.length); i++) {
      pick.push(cards[i]);
      go(i + 1);
      pick.pop();
    }
  };
  go(0);
  return { score: top, five };
}

export const handName = (score: number) => HAND_NAMES[category(score)];
