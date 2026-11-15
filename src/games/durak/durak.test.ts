import { describe, expect, it } from 'vitest';
import { defaultOptions } from '../../engine/types';
import { card, rankOf, suitOf } from '../cards/cards';
import { durak } from './index';
import * as D from './logic';

function rng(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function play(s: D.DurakState, seat: number, m: D.DurakMove) {
  const next = D.move(s, seat, m);
  if (typeof next === 'string') throw new Error(next);
  return next;
}

/** Four seats, one rank available to each of the possible attackers. */
function table(): D.DurakState {
  return {
    ...D.setup({ numPlayers: 4, random: rng(1) }),
    attacker: 0,
    defender: 1,
    throwTurn: 0,
    trump: 3,
    hands: [
      [card(0, 9), card(1, 9), card(0, 14)],
      [card(0, 10), card(1, 10), card(2, 11)],
      [card(2, 9), card(2, 10), card(2, 14)],
      [card(3, 9), card(3, 10), card(3, 14)],
    ],
    limit: 3,
  };
}

describe('Durak Friends rules', () => {
  it('adds a default variant while keeping both previous variants and explicit attacker choices', () => {
    const options = defaultOptions(durak);
    expect(options.mode).toBe('friends');
    expect(D.setup({ numPlayers: 4, random: rng(), options })).toMatchObject({ transfer: true, sideOnly: true });
    expect(D.setup({ numPlayers: 4, random: rng() })).toMatchObject({ transfer: true, sideOnly: true });
    expect(D.setup({ numPlayers: 4, random: rng(), options: { ...options, mode: 'transfer' } })).toMatchObject({ transfer: true, sideOnly: false });
    expect(D.setup({ numPlayers: 4, random: rng(), options: { ...options, mode: 'throw' } })).toMatchObject({ transfer: false, sideOnly: false });
    expect(D.setup({ numPlayers: 4, random: rng(), options: { mode: 'transfer', attackers: 'side' } })).toMatchObject({ transfer: true, sideOnly: true });
    expect(D.setup({ numPlayers: 4, random: rng(), options: { mode: 'friends', attackers: 'all' } })).toMatchObject({ transfer: true, sideOnly: false });
  });

  it('limits attacks to the main attacker and the defender’s other neighbor', () => {
    let s = table();
    expect(D.throwers(s)).toEqual([0, 2]);
    expect(D.move(s, 2, { type: 'attack', card: card(2, 9) })).toBe('Not your turn');
    s = play(s, 0, { type: 'attack', card: card(0, 9) });
    expect(D.move(s, 3, { type: 'throw', card: card(3, 9) })).toBe('Not your turn');
    s = play(s, 1, { type: 'beat', i: 0, card: card(0, 10) });
    s = play(s, 0, { type: 'pass' });
    expect(D.activePlayers(s)).toEqual([2]);
    expect(D.move(s, 3, { type: 'throw', card: card(3, 9) })).toBe('Not your turn');
    s = play(s, 2, { type: 'throw', card: card(2, 9) });
    expect(s.phase).toBe('defend');
    expect(s.table.map((p) => p.a)).toEqual([card(0, 9), card(2, 9)]);
  });

  it('does not offer a nonattacker a throw when the defender takes', () => {
    let s = play(table(), 0, { type: 'attack', card: card(0, 9) });
    s = play(s, 1, { type: 'take' });
    s = play(s, 0, { type: 'pass' });
    expect(D.activePlayers(s)).toEqual([2]);
    s = play(s, 2, { type: 'pass' });
    expect(s.phase).toBe('attack');
    expect(s.attacker).toBe(2);
    expect(s.defender).toBe(3);
    expect(s.lastBout).toEqual({ defender: 1, took: true });
  });

  it('lets all nondefenders throw in the previous variants', () => {
    let s = play({ ...table(), sideOnly: false }, 0, { type: 'attack', card: card(0, 9) });
    s = play(s, 1, { type: 'take' });
    s = play(s, 0, { type: 'pass' });
    s = play(s, 2, { type: 'pass' });
    expect(D.activePlayers(s)).toEqual([3]);
    s = play(s, 3, { type: 'throw', card: card(3, 9) });
    expect(s.table).toHaveLength(2);
  });

  it('transfers by rank across suits and updates both attacker seats', () => {
    let s = table();
    s.hands[1] = [card(1, 9), card(0, 10), card(1, 10)];
    s.hands[0] = [card(0, 9), card(0, 14)];
    s = play(s, 0, { type: 'attack', card: card(0, 9) });
    expect(D.canTransfer(s, card(1, 9))).toBe(true);
    s = play(s, 1, { type: 'transfer', card: card(1, 9) });
    expect(s).toMatchObject({ attacker: 1, defender: 2, limit: 3 });
    expect(D.throwers(s)).toEqual([1, 3]);
    expect(s.hands[1]).not.toContain(card(1, 9));
    expect(s.table).toEqual([{ a: card(0, 9), d: null }, { a: card(1, 9), d: null }]);
    s = play(s, 2, { type: 'transfer', card: card(2, 9) });
    expect(s).toMatchObject({ attacker: 2, defender: 3, limit: 3 });
    expect(D.throwers(s)).toEqual([2, 0]);
    expect(s.table).toHaveLength(3);
    expect(D.canTransfer(s, card(3, 9))).toBe(false); // Seat 0 has only one card.
  });

  it('rejects transferring after a defense, by a wrong rank, or to a short hand', () => {
    let s = table();
    s.hands[0] = [card(0, 9), card(3, 10), card(0, 14)];
    s.hands[1] = [card(1, 9), card(0, 10), card(1, 10)];
    s.hands[3] = [card(3, 9), card(3, 14)];
    s = play(s, 0, { type: 'attack', card: card(0, 9) });
    expect(D.canTransfer(s, card(1, 10))).toBe(false);
    expect(D.canTransfer({ ...s, transfer: false }, card(1, 9))).toBe(false);
    expect(D.canTransfer({ ...s, hands: s.hands.map((h, i) => i === 2 ? [card(2, 6)] : h) }, card(1, 9))).toBe(false);
    expect(D.move(s, 1, { type: 'transfer', card: card(3, 9) })).toMatch(/same rank/); // Not in their hand.
    s = play(s, 1, { type: 'beat', i: 0, card: card(0, 10) });
    s = play(s, 0, { type: 'throw', card: card(3, 10) });
    expect(D.canTransfer(s, card(1, 9))).toBe(false);
  });

  it('skips eliminated seats for side attacks and transfers', () => {
    let s = table();
    s.out[2] = true;
    s.hands[2] = [];
    s.hands[0] = [card(0, 9), card(0, 14)];
    s.hands[1] = [card(1, 9), card(0, 10), card(1, 10)];
    expect(D.sideAttacker(s)).toBe(3);
    expect(D.throwers(s)).toEqual([0, 3]);
    s = play(s, 0, { type: 'attack', card: card(0, 9) });
    s = play(s, 1, { type: 'transfer', card: card(1, 9) });
    expect(s.defender).toBe(3);
    expect(D.throwers(s)).toEqual([1, 0]);
  });

  it('has one attacker with two players and can transfer back to them', () => {
    let s = D.setup({ numPlayers: 2, random: rng() });
    s = { ...s, attacker: 0, defender: 1, hands: [[card(0, 9), card(0, 10), card(0, 11)], [card(1, 9), card(1, 10)]] };
    expect(D.sideAttacker(s)).toBeNull();
    expect(D.throwers(s)).toEqual([0]);
    s = play(s, 0, { type: 'attack', card: card(0, 9) });
    s = play(s, 1, { type: 'transfer', card: card(1, 9) });
    expect(s).toMatchObject({ attacker: 1, defender: 0, limit: 2 });
    expect(D.throwers(s)).toEqual([1]);
  });

  it('keeps a real trump when six players receive the entire deck', () => {
    const s = D.setup({ numPlayers: 6, random: rng(7) });
    expect(s.deck).toHaveLength(0);
    expect(s.hands.flat()).toHaveLength(36);
    expect(s.hands.flat()).toContain(s.trumpCard);
    expect([0, 1, 2, 3]).toContain(s.trump);
    expect(s.trump).toBe(suitOf(s.trumpCard));
    const lowestTrump = Math.min(...s.hands.flat().filter((c) => suitOf(c) === s.trump).map(rankOf));
    expect(s.hands[s.attacker]).toContain(card(s.trump, lowestTrump));
  });

  for (const mode of ['friends', 'transfer', 'throw']) {
    it(`${mode}: bots finish with 2–6 players and conserve all cards`, () => {
      for (let n = 2; n <= 6; n++) {
        for (const seed of [3, 17, 42]) {
          const random = rng(seed);
          let s = D.setup({ numPlayers: n, random, options: { mode } });
          for (let step = 0; step < 5000 && !D.result(s); step++) {
            const seat = D.activePlayers(s)[0];
            if (s.phase === 'throw') expect(D.throwers(s)).toContain(seat);
            const move = D.bot(D.view(s, seat), seat, { random, level: (['easy', 'normal', 'hard'] as const)[step % 3] });
            s = play(s, seat, move);
            const cards = [...s.deck, ...s.hands.flat(), ...s.table.flatMap((p) => p.d === null ? [p.a] : [p.a, p.d])];
            expect(cards.length + s.discarded).toBe(36);
            expect(new Set(cards).size).toBe(cards.length);
          }
          expect(D.result(s)).not.toBeNull();
        }
      }
    });
  }
});
