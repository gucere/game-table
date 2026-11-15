import { describe, expect, it } from 'vitest';
import * as SX from './superxox/logic';
import * as LD from './liarsdice/logic';
import * as TP from './telephone/logic';
import { fairRoll } from '../ui/DicePage';

function rng(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

describe('Süper XOX', () => {
  it('sends the opponent to the matching board, or anywhere if it is decided', () => {
    let s = SX.setup();
    s = SX.move(s, 0, 4 * 9 + 2) as SX.SuperState; // centre board, top-right square
    expect(s.forced).toBe(2);
    expect(SX.move(s, 1, 4 * 9 + 0)).toMatch(/can’t play/);
    // X takes the top-left board: 0,1,2 there
    const cells = s.cells.slice();
    cells[0] = 0;
    cells[1] = 0;
    s = { ...s, cells, turn: 0, forced: 0 };
    s = SX.apply(s, 2);
    expect(s.boards[0]).toBe(0);
    // Being sent to board 0 (already won) means any open board
    s = { ...s, turn: 1, forced: null };
    const after = SX.apply(s, 3 * 9 + 0);
    expect(after.forced).toBeNull();
  });

  it('wins with three small boards in a row', () => {
    const s = { ...SX.setup(), boards: [0, 0, null, null, null, null, null, null, null] as SX.Owner[], turn: 0 as const, forced: 2 };
    const cells = s.cells.slice();
    cells[2 * 9 + 0] = 0;
    cells[2 * 9 + 1] = 0;
    const done = SX.apply({ ...s, cells }, 2 * 9 + 2);
    expect(done.winner).toBe(0);
    expect(SX.result(done)).toEqual({ winners: [0] });
  });

  it('easy bots finish games with only legal moves; the thinking bot answers quickly', () => {
    for (const seed of [1, 2, 3]) {
      const random = rng(seed);
      let s = SX.setup();
      for (let k = 0; k < 81 && !s.over; k++) {
        const m = SX.bot(s, s.turn, { random, level: 'easy' });
        const n = SX.move(s, s.turn, m);
        expect(typeof n).not.toBe('string');
        s = n as SX.SuperState;
      }
      expect(SX.result(s)).not.toBeNull();
    }
    const t0 = Date.now();
    const m = SX.bot(SX.setup(), 0, { random: rng(9), level: 'normal' });
    expect(Date.now() - t0).toBeLessThan(1500);
    expect(SX.legalMoves(SX.setup())).toContain(m);
  });
});

describe('Yalancı Zar', () => {
  const ctx = (o: Record<string, string> = {}) => ({ numPlayers: 3, random: rng(5), options: { dice: '5', wild: 'on', ...o }, now: () => 1000 });

  it('only accepts higher bids, and never bids on wild ones', () => {
    const s = { ...LD.setup(ctx()), turn: 0 };
    expect(LD.move(s, 0, { type: 'liar' }, ctx())).toMatch(/no bid/);
    expect(LD.move(s, 0, { type: 'bid', count: 2, face: 1 }, ctx())).toMatch(/higher/);
    const a = LD.move(s, 0, { type: 'bid', count: 2, face: 4 }, ctx()) as LD.LiarState;
    expect(LD.move(a, 1, { type: 'bid', count: 2, face: 3 }, ctx())).toMatch(/higher/);
    expect(typeof LD.move(a, 1, { type: 'bid', count: 2, face: 5 }, ctx())).not.toBe('string');
    expect(typeof LD.move(a, 1, { type: 'bid', count: 3, face: 2 }, ctx())).not.toBe('string');
  });

  it('calling a lie: the right player loses a die, and ones count when wild', () => {
    const dice = [
      [1, 4, 4],
      [2, 3, 6],
      [4, 5, 5],
    ];
    const base = { ...LD.setup(ctx()), dice, turn: 1, bid: { count: 4, face: 4, by: 0 } };
    // Three 4s plus one wild 1 = 4: the bid was true, the caller (1) loses
    const r = LD.move(base, 1, { type: 'liar' }, ctx()) as LD.LiarState;
    expect(r.reveal).toMatchObject({ actual: 4, loser: 1 });
    const next = LD.onTimer(r, ctx());
    expect(next.dice.map((d) => d.length)).toEqual([3, 2, 3]);
    expect(next.turn).toBe(1);
    // Without wild ones there are only three 4s: the bidder (0) loses
    const noWild = LD.move({ ...base, wild: false }, 1, { type: 'liar' }, ctx()) as LD.LiarState;
    expect(noWild.reveal).toMatchObject({ actual: 3, loser: 0 });
  });

  it('players only see their own dice', () => {
    const s = LD.setup(ctx());
    const v = LD.view(s, 1);
    expect(v.mine).toEqual(s.dice[1]);
    expect(v.counts).toEqual([5, 5, 5]);
    expect(JSON.stringify(v)).not.toContain(JSON.stringify(s.dice[0]).slice(1, -1) + ']');
  });
});

describe('Kulaktan Kulağa Çizim', () => {
  const ctx = { numPlayers: 4, options: { lang: 'en' }, now: () => 0 };
  const drawing = [{ color: '#111111', size: 6, pts: [10, 10, 200, 200, 201, 201, 400, 120] }];

  it('every chain passes through everyone, alternating drawing and guessing', () => {
    let s = TP.setup(ctx);
    for (let step = 0; step < 4; step++) {
      expect(TP.kindOf(step)).toBe(step === 0 ? 'write' : step % 2 ? 'draw' : 'guess');
      for (let seat = 0; seat < 4; seat++) {
        const v = TP.view(s, seat);
        if (step > 0) expect(v.prompt?.by).toBe((seat + 3) % 4);
        const m: TP.PhoneMove = TP.kindOf(step) === 'draw' ? { type: 'draw', strokes: drawing } : { type: 'text', text: `p${seat} s${step}` };
        s = TP.move(s, seat, m, ctx) as TP.PhoneState;
      }
    }
    expect(s.phase).toBe('reveal');
    expect(s.chains.every((c) => c.length === 4 && new Set(c.map((e) => e.by)).size === 4)).toBe(true);
    expect(s.chains[0][0].text).toBe('p0 s0');
    // Reveal step by step, chain by chain, then done
    for (let k = 0; k < 16; k++) s = TP.move(s, 2, { type: 'next' }, ctx) as TP.PhoneState;
    expect(s.phase).toBe('done');
    expect(TP.result(s)).toMatchObject({ draw: true });
  });

  it('time running out passes on an empty page; nobody sees more than the one entry', () => {
    let s = TP.setup(ctx);
    s = TP.move(s, 0, { type: 'text', text: 'a dancing fridge' }, ctx) as TP.PhoneState;
    s = TP.onTimer(s, ctx);
    expect(s.step).toBe(1);
    expect(s.chains[1][0].text).toBe('…');
    const v = TP.view(s, 1);
    expect(v.prompt?.text).toBe('a dancing fridge');
    expect(JSON.stringify(v)).not.toContain('…');
  });

  it('rejects broken or huge drawings', () => {
    expect(TP.cleanDrawing([{ color: 'red', size: 4, pts: [1, 2, 3, 4] }])).toBeNull();
    expect(TP.cleanDrawing([{ color: '#123456', size: 4, pts: Array.from({ length: 20000 }, (_, i) => i % 900) }])).toBeNull();
    expect(TP.cleanDrawing(drawing)![0].pts.length).toBeLessThanOrEqual(8);
  });
});

describe('dice tool', () => {
  it('rolls every face with about the same chance', () => {
    const counts = Array(7).fill(0);
    for (let i = 0; i < 6000; i++) counts[fairRoll(6)]++;
    expect(counts[0]).toBe(0);
    for (let f = 1; f <= 6; f++) expect(counts[f]).toBeGreaterThan(800);
    for (let i = 0; i < 200; i++) expect(fairRoll(100)).toBeLessThanOrEqual(100);
  });
});
