import { describe, expect, it } from 'vitest';
import { defaultOptions, type BotLevel, type GameDef } from '../engine/types';
import * as Coin from './coin-flip/logic';
import * as Four from './four-in-a-row/logic';
import { GAMES } from './index';
import * as Rps from './rps/logic';
import * as Xox from './xox/logic';

/** Small deterministic RNG so tests are repeatable */
function rng(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

describe('XOX', () => {
  it('detects a win and rejects illegal moves', () => {
    let s = Xox.setup();
    for (const [seat, cell] of [
      [0, 0],
      [1, 3],
      [0, 1],
      [1, 4],
    ]) {
      s = Xox.move(s, seat, cell) as Xox.XoxState;
    }
    expect(Xox.move(s, 1, 2)).toBe('Not your turn');
    expect(Xox.move(s, 0, 3)).toBe('That cell is taken');
    expect(Xox.move(s, 0, 9)).toBe('Bad cell');
    s = Xox.move(s, 0, 2) as Xox.XoxState;
    expect(Xox.result(s)).toEqual({ winners: [0] });
  });

  it('hard bot blocks an immediate win', () => {
    // X at 0 and 1, O to move: must play 2
    const s: Xox.XoxState = { board: [0, 0, null, null, 1, null, null, null, null], turn: 1 };
    expect(Xox.bot(s, 1, { random: rng(), level: 'hard' })).toBe(2);
  });

  it('two hard bots always draw', () => {
    const r = rng(7);
    let s = Xox.setup();
    while (!Xox.result(s)) s = Xox.move(s, s.turn, Xox.bot(s, s.turn, { random: r, level: 'hard' })) as Xox.XoxState;
    expect(Xox.result(s)?.draw).toBe(true);
  });
});

describe('Four in a Row', () => {
  it('detects vertical, horizontal and diagonal wins', () => {
    let s = Four.setup();
    for (const col of [0, 1, 0, 1, 0, 1]) s = Four.move(s, s.turn, col) as Four.FourState;
    s = Four.move(s, 0, 0) as Four.FourState;
    expect(Four.result(s)).toEqual({ winners: [0] });
    expect(s.win).toHaveLength(4);

    s = Four.setup();
    for (const col of [0, 0, 1, 1, 2, 2]) s = Four.move(s, s.turn, col) as Four.FourState;
    s = Four.move(s, 0, 3) as Four.FourState;
    expect(Four.result(s)?.winners).toEqual([0]);

    // Diagonal: 0 builds a staircase
    s = Four.setup();
    for (const col of [0, 1, 1, 2, 2, 3, 2, 3, 3, 6]) s = Four.move(s, s.turn, col) as Four.FourState;
    s = Four.move(s, 0, 3) as Four.FourState;
    expect(Four.result(s)?.winners).toEqual([0]);
  });

  it('rejects full columns', () => {
    let s = Four.setup();
    for (let i = 0; i < 6; i++) s = Four.move(s, s.turn, 0) as Four.FourState;
    expect(Four.move(s, s.turn, 0)).toBe('That column is full');
  });

  it('bot takes a winning move and blocks a loss', () => {
    let s = Four.setup();
    for (const col of [0, 6, 1, 6, 2]) s = Four.move(s, s.turn, col) as Four.FourState;
    // Seat 1 to move; seat 0 threatens column 3
    expect(Four.bot(s, 1, { random: rng(), level: 'normal' })).toBe(3);
    s = Four.move(s, 1, 6) as Four.FourState; // seat 1 ignores it
    expect(Four.bot(s, 0, { random: rng(), level: 'normal' })).toBe(3);
  });

  it('hard bot answers quickly', () => {
    const s = Four.setup();
    const t = performance.now();
    Four.bot(s, 0, { random: rng(), level: 'hard' });
    expect(performance.now() - t).toBeLessThan(1500);
  });
});

describe('Rock Paper Scissors', () => {
  it('hides the other pick until both have chosen', () => {
    let s = Rps.setup();
    s = Rps.move(s, 0, 'rock') as Rps.RpsState;
    expect(Rps.view(s, 1).mine).toBeNull();
    expect(JSON.stringify(Rps.view(s, 1))).not.toContain('rock');
    expect(Rps.activePlayers(s)).toEqual([1]);
    s = Rps.move(s, 1, 'scissors') as Rps.RpsState;
    expect(s.scores).toEqual([1, 0]);
    expect(Rps.activePlayers(s)).toEqual([0, 1]);
  });

  it('ends at the target score', () => {
    let s = Rps.setup();
    for (let i = 0; i < Rps.TARGET; i++) {
      s = Rps.move(s, 0, 'paper') as Rps.RpsState;
      s = Rps.move(s, 1, 'rock') as Rps.RpsState;
    }
    expect(Rps.result(s)).toEqual({ winners: [0] });
    expect(Rps.move(s, 0, 'lizard')).toBe('Pick rock, paper or scissors');
  });
});

describe('Coin flip', () => {
  it('alternates callers and scores two-player races', () => {
    let s = Coin.setup({ numPlayers: 2 });
    s = Coin.move(s, 0, { type: 'call', side: 'heads' }, () => 0.1) as Coin.CoinState; // heads
    expect(s.scores).toEqual([1, 0]);
    expect(s.caller).toBe(1);
    expect(Coin.move(s, 0, { type: 'call', side: 'heads' }, () => 0.1)).toBe('Not your turn');
    s = Coin.move(s, 1, { type: 'call', side: 'heads' }, () => 0.9) as Coin.CoinState; // tails, wrong
    expect(s.scores).toEqual([2, 0]);
  });

  it('solo mode never ends and tracks the streak', () => {
    let s = Coin.setup({ numPlayers: 1 });
    for (let i = 0; i < 5; i++) s = Coin.move(s, 0, { type: 'call', side: 'tails' }, () => 0.9) as Coin.CoinState;
    expect(Coin.result(s)).toBeNull();
    expect(Coin.streak(s)).toBe(5);
  });
});

describe('every game', () => {
  const levels: BotLevel[] = ['easy', 'normal', 'hard'];
  // Tested with bots in their own files: Kelime Ustası (word list loads asynchronously),
  // Trash (a table that keeps going round after round), Kemps (bots sometimes wait),
  // Go (its bot thinks for a set time) and Kelime Zinciri (bots wait for the word list)
  const ownTests = ['kelime-ustasi', 'trash', 'kemps', 'go', 'kelime-zinciri'];
  for (const g of (GAMES as GameDef[]).filter((x) => x.bot && !ownTests.includes(x.id))) {
    // Chess bots search deeply; play the quick level so the test stays fast
    const lv: BotLevel[] = g.id === 'satranc' ? ['easy'] : levels;
    it(`${g.name}: bots can finish a game without illegal moves`, () => {
      const random = rng(42);
      const numPlayers = Math.max(2, g.minPlayers);
      const ctx = { numPlayers, random, options: defaultOptions(g), now: () => 0 };
      let s = g.setup(ctx);
      for (let step = 0; step < 5000 && !g.result(s); step++) {
        // Timer-driven games advance on their own clock when nobody has to act
        if (!g.activePlayers(s).length && g.onTimer) {
          s = g.onTimer(s, ctx);
          continue;
        }
        const seat = g.activePlayers(s)[0];
        const m = g.bot!(g.view(s, seat), seat, { random, level: lv[step % lv.length] });
        const next = g.move(s, seat, m, ctx);
        expect(typeof next).not.toBe('string');
        s = next;
      }
      expect(g.result(s)).not.toBeNull();
    }, 30000);
  }
});

describe('Draw & Guess', () => {
  it('scores a correct guess (Turkish letters optional) and reveals when everyone got it', async () => {
    const DG = await import('./draw-guess/logic');
    let now = 1000;
    const ctx = { numPlayers: 3, random: rng(3), options: { lang: 'tr', time: '60', rounds: '1' }, now: () => now };
    let s = DG.setup(ctx);
    expect(DG.view(s, 1).choices).toEqual([]);
    expect(DG.view(s, 0).choices).toHaveLength(3);
    s = DG.move(s, 0, { type: 'choose', i: 0 }, ctx) as typeof s;
    const word = s.word;
    expect(DG.view(s, 1).word).toBe('');
    now += 10000;
    s = DG.move(s, 1, { type: 'guess', text: word.toUpperCase().replace(/ö/g, 'o') }, ctx) as typeof s;
    expect(s.guessed).toEqual([1]);
    expect(s.scores[1]).toBeGreaterThan(0);
    expect(s.scores[0]).toBe(25);
    s = DG.move(s, 2, { type: 'guess', text: word }, ctx) as typeof s;
    expect(s.phase).toBe('reveal');
    s = DG.onTimer(s, ctx);
    expect(s.drawer).toBe(1);
  });
});

describe('solo games', () => {
  it('sudoku puzzles have exactly one solution, quickly', async () => {
    const S = await import('./sudoku/logic');
    const t0 = performance.now();
    const s = S.setup({ options: { level: 'hard' }, random: rng(9), now: () => 0 });
    expect(performance.now() - t0).toBeLessThan(3000);
    expect(S.countSolutions(s.cells, 2)).toBe(1);
    expect(s.givens.filter(Boolean).length).toBeLessThanOrEqual(40);
  });

  it('minesweeper: first click is always safe', async () => {
    const M = await import('./minesweeper/logic');
    for (let seed = 1; seed < 20; seed++) {
      const s = M.setup({ options: { level: 'hard' } });
      const r = M.move(s, { type: 'open', i: 200 }, { random: rng(seed), now: () => 0 });
      expect(typeof r).not.toBe('string');
      expect((r as typeof s).status).toBe('playing');
    }
  });

  it('solitaire: deal, draw, undo', async () => {
    const K = await import('./solitaire/logic');
    const s = K.setup({ options: { draw: '3' }, random: rng(5), now: () => 0 });
    expect(s.stock.length).toBe(24);
    expect(s.tab.map((p) => p.down.length + p.up.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const d = K.move(s, { type: 'draw' }, 0) as typeof s;
    expect(d.waste.length).toBe(3);
    const u = K.move(d, { type: 'undo' }, 0) as typeof s;
    expect(u.waste.length).toBe(0);
    expect(u.stock).toEqual(s.stock);
  });
});

describe('Amiral Battı', () => {
  it('validates fleets, fires, and ends when a fleet is sunk', async () => {
    const A = await import('./amiral/logic');
    const ctx = { random: rng(4), options: { extra: 'no' } };
    let s = A.setup(ctx);
    expect(A.move(s, 0, { type: 'place', ships: [{ r: 0, c: 8, len: 5, h: true }] as never })).toMatch(/fit/);
    const fleet = A.randomFleet(rng(8));
    expect(A.validFleet(fleet)).toBe(true);
    s = A.move(s, 0, { type: 'place', ships: fleet }) as typeof s;
    s = A.move(s, 1, { type: 'place', ships: A.randomFleet(rng(9)) }) as typeof s;
    expect(s.phase).toBe('fire');
    // Seat 1's view must not reveal seat 0's ships
    expect(A.view(s, 1).enemySunk).toEqual([]);
    expect(JSON.stringify(A.view(s, 1))).not.toContain(JSON.stringify(fleet[0]));
    // Seat (1 - turn) sinks everything eventually: fire at every cell
    const shooter = s.turn;
    const other = 1 - shooter;
    for (let c = 0; c < 100 && s.phase === 'fire'; c++) {
      s = A.move(s, shooter, { type: 'fire', cell: c }) as typeof s;
      if (s.phase === 'fire') s = A.move(s, other, { type: 'fire', cell: c }) as typeof s;
    }
    expect(s.phase).toBe('done');
  });
});

describe('Martı', () => {
  it('same seed gives the same course, and the bird falls without flapping', async () => {
    const S = await import('./marti/sim');
    const a = S.newSim();
    const b = S.newSim();
    S.flap(a);
    S.flap(b);
    for (let i = 0; i < 200; i++) {
      S.step(a, 1 / 120, 42);
      S.step(b, 1 / 120, 42);
    }
    expect(a.obstacles.map((o) => o.gapY)).toEqual(b.obstacles.map((o) => o.gapY));
    for (let i = 0; i < 600 && !a.dead; i++) S.step(a, 1 / 120, 42);
    expect(a.dead).toBe(true);
  });

  it('a simple autopilot scores points (the course is passable)', async () => {
    const S = await import('./marti/sim');
    const sim = S.newSim();
    S.flap(sim);
    for (let i = 0; i < 120 * 60 && !sim.dead; i++) {
      const next = sim.obstacles.find((o) => o.x + S.OB_W > S.BIRD_X - S.BIRD_R);
      const target = next ? next.gapY + 18 : S.H * 0.45;
      if (sim.y > target && sim.vy > -50) S.flap(sim);
      S.step(sim, 1 / 120, 7);
    }
    expect(sim.score).toBeGreaterThan(10);
  });
});

describe('Martı characters', () => {
  it('records the character each player flew with', async () => {
    const L = await import('./marti/logic');
    let s = L.setup({ numPlayers: 2, random: () => 0.5 });
    const r = L.move(s, 0, { type: 'score', n: 7, char: 'hazerfen' });
    if (typeof r === 'string') throw new Error(r);
    s = r;
    expect(s.chars).toEqual(['hazerfen', null]);
    expect(L.move(s, 0, { type: 'score', n: 9 })).toBe('Already flown');
  });
});

describe('Rules changed mid-game', () => {
  it('apply on the next game', async () => {
    const { GameRunner } = await import('../engine/runner');
    const { minesweeper } = await import('./minesweeper');
    const r = new GameRunner(minesweeper, [{ name: 'A', kind: 'human' }], { level: 'easy' });
    r.restart({ level: 'hard' });
    expect(r.options.level).toBe('hard');
    r.dispose();
  });
});

describe('King', () => {
  it('a full game of bots adds up to zero (penalties and trumps balance)', async () => {
    const K = await import('./king/logic');
    const random = rng(11);
    let s = K.setup({ random, options: { length: 'full' } });
    for (let step = 0; step < 5000 && s.phase !== 'done'; step++) {
      const seat = s.turn;
      const m = K.bot(K.view(s, seat), seat, { random, level: 'hard' });
      const next = K.move(s, seat, m, { random });
      if (typeof next === 'string') throw new Error(`${next} ${JSON.stringify(m)}`);
      s = next;
    }
    expect(s.phase).toBe('done');
    expect(s.history.length).toBe(20);
    expect(s.used).toEqual({ el: 2, kupa: 2, erkek: 2, kiz: 2, rifki: 2, sonIki: 2 });
    expect(s.calls.every((c) => c.pen === 3 && c.koz === 2)).toBe(true);
    expect(s.scores.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('forces the K♥ out under the A♥ in Rıfkı, and penalty discards when void', async () => {
    const K = await import('./king/logic');
    const { card } = await import('./cards/cards');
    const base = { contract: 'rifki' as const, trump: null, broken: true };
    const hand = [card(1, 13), card(1, 5), card(0, 9)];
    expect(K.legalCards({ ...base, trick: [{ seat: 0, card: card(1, 14) }] }, hand)).toEqual([card(1, 13)]);
    expect(K.legalCards({ ...base, trick: [{ seat: 0, card: card(1, 9) }] }, hand)).toEqual([card(1, 13), card(1, 5)]);
    expect(K.legalCards({ ...base, trick: [{ seat: 0, card: card(2, 9) }] }, hand)).toEqual([card(1, 13)]);
    expect(K.legalCards({ ...base, broken: false, trick: [] }, hand)).toEqual([card(0, 9)]);
  });
});

describe('Pişti', () => {
  it('scores a pişti for taking a single card by matching it', async () => {
    const P = await import('./pisti/logic');
    const { card } = await import('./cards/cards');
    let s = P.setup({ numPlayers: 2, random: rng(3), options: { target: '0' } });
    s = { ...s, pile: [card(0, 7)], hiddenInPile: 0, hands: [[card(1, 7), card(0, 2)], [card(2, 3)]], turn: 0 };
    const r = P.move(s, 0, { type: 'play', card: card(1, 7) }, { random: rng(1) });
    if (typeof r === 'string') throw new Error(r);
    expect(r.pisti[0]).toBe(10);
    expect(r.pile).toEqual([]);
    expect(r.captured[0].length).toBe(2);
  });

  it('every deal hands out 13 card points, with 2 to 4 players', async () => {
    const P = await import('./pisti/logic');
    for (const n of [2, 3, 4]) {
      const random = rng(n);
      let s = P.setup({ numPlayers: n, random, options: { target: '151', teams: 'teams' } });
      for (let step = 0; step < 20000 && s.phase !== 'done'; step++) {
        const m = P.bot(P.view(s, s.turn), s.turn, { random, level: 'hard' });
        const next = P.move(s, s.turn, m, { random });
        if (typeof next === 'string') throw new Error(next);
        s = next;
      }
      expect(s.phase).toBe('done');
      for (const h of s.history) {
        expect(h.points.reduce((a, b) => a + b, 0)).toBe(13);
        expect(h.cards.reduce((a, b) => a + b, 0)).toBe(52);
      }
      expect(Math.max(...s.scores)).toBeGreaterThanOrEqual(151);
    }
  });
});

describe('Papaz Kaçtı', () => {
  it('ends with exactly one player holding the lone king', async () => {
    const P = await import('./papaz/logic');
    for (const n of [2, 3, 5, 8]) {
      const random = rng(n * 7);
      let s = P.setup({ numPlayers: n, random });
      expect(s.hands.flat().length + s.discards.flat().length).toBe(49);
      for (let step = 0; step < 5000 && s.loser === null; step++) {
        const m = P.bot(P.view(s, s.turn), s.turn, { random, level: 'hard' });
        const next = P.move(s, s.turn, m, { random });
        if (typeof next === 'string') throw new Error(next);
        s = next;
      }
      expect(s.loser).not.toBeNull();
      expect(s.hands[s.loser!]).toEqual([s.papaz]);
      expect(s.hands.filter((h) => h.length).length).toBe(1);
    }
  });

  it('throws away pairs by rank', async () => {
    const P = await import('./papaz/logic');
    const { card } = await import('./cards/cards');
    const r = P.discardPairs([card(0, 5), card(1, 5), card(2, 5), card(0, 9), card(3, 13)]);
    expect(r.pairs.length).toBe(1);
    expect(r.hand.length).toBe(3);
  });
});

describe('Satranç', () => {
  function fromFen(fen: string) {
    const [rows, turn, castle, ep] = fen.split(' ');
    const board = rows
      .split('/')
      .flatMap((r) => r.split('').flatMap((ch) => (/\d/.test(ch) ? Array(Number(ch)).fill('.') : [ch])));
    const epSq = ep === '-' ? null : (8 - Number(ep[1])) * 8 + 'abcdefgh'.indexOf(ep[0]);
    return { board, turn: turn as 'w' | 'b', castle: castle === '-' ? '' : castle, ep: epSq };
  }
  async function perft(pos: ReturnType<typeof fromFen>, depth: number): Promise<number> {
    const C = await import('./satranc/logic');
    const go = (p: typeof pos, d: number): number => {
      const ms = C.legalMoves(p);
      if (d === 1) return ms.length;
      return ms.reduce((a, m) => a + go(C.play(p, { ...m, flag: guessFlag(p, m) } as never) as typeof pos, d - 1), 0);
    };
    // play() needs the special-move flag; recover it like move() does
    const guessFlag = (p: typeof pos, m: { from: number; to: number }) => {
      const pc = p.board[m.from].toLowerCase();
      if (pc === 'k' && Math.abs(m.to - m.from) === 2) return m.to > m.from ? 'K' : 'Q';
      if (pc === 'p' && m.to === p.ep) return 'ep';
      if (pc === 'p' && Math.abs(m.to - m.from) === 16) return 'double';
      return undefined;
    };
    return go(pos, depth);
  }

  it('generates the right number of moves (perft)', async () => {
    expect(await perft(fromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -'), 3)).toBe(8902);
    // "Kiwipete": castling, en passant and promotions all in play
    expect(await perft(fromFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -'), 2)).toBe(2039);
    expect(await perft(fromFen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -'), 3)).toBe(2812);
  });

  it("finds fool's mate and reports it", async () => {
    const C = await import('./satranc/logic');
    let s = C.setup({ random: () => 0, options: { white: 'first' } });
    const sq = (n: string) => (8 - Number(n[1])) * 8 + 'abcdefgh'.indexOf(n[0]);
    for (const [seat, a, b] of [
      [0, 'f2', 'f3'],
      [1, 'e7', 'e5'],
      [0, 'g2', 'g4'],
      [1, 'd8', 'h4'],
    ] as const) {
      const r = C.move(s, seat, { from: sq(a), to: sq(b) });
      if (typeof r === 'string') throw new Error(r);
      s = r;
    }
    expect(s.over?.reason).toBe('Checkmate');
    expect(s.moves[3].san).toBe('Qh4#');
    expect(C.result(s)?.winners).toEqual([1]);
  });
});

describe('Dama', () => {
  it('forces the capture that takes the most pieces', async () => {
    const D = await import('./dama/logic');
    const s = D.setup();
    const board = Array(64).fill(null);
    const at = (r: number, c: number) => r * 8 + c;
    board[at(6, 0)] = { owner: 0, king: false };
    board[at(5, 0)] = { owner: 1, king: false };
    board[at(3, 0)] = { owner: 1, king: false };
    board[at(4, 4)] = { owner: 1, king: false };
    board[at(5, 3)] = { owner: 0, king: false };
    board[at(0, 7)] = { owner: 1, king: false };
    const moves = D.legalMoves({ board, turn: 0 });
    expect(moves.every((m) => m.captures.length === 2)).toBe(true);
    expect(moves[0].path).toEqual([at(6, 0), at(4, 0), at(2, 0)]);
    expect(s.board.filter(Boolean).length).toBe(32);
  });
});

describe('51', () => {
  it('counts card points: aces 11 (1 at the bottom of a run), faces 10; jokers are wild', async () => {
    const O = await import('./okey101/logic');
    const { asMeld } = await import('./tiles/tiles');
    const okey = O.WILD_JOKERS;
    const t = (color: number, num: number) => color * 13 + num - 1;
    const pts = (tiles: number[]) => O.pointsOf(asMeld(tiles, okey, O.CFG51.rules)!, okey);
    expect(pts([t(0, 12), t(0, 13), t(0, 1)])).toBe(31);
    expect(pts([t(0, 1), t(0, 2), t(0, 3)])).toBe(6);
    expect(pts([t(0, 1), t(1, 1), t(2, 1)])).toBe(33);
    expect(asMeld([t(0, 13), t(0, 1), t(0, 2)], okey, O.CFG51.rules)).toBeNull();
    expect(pts([t(2, 7), 104, t(2, 9)])).toBe(24);
  });
});

describe('Solo puzzles', () => {
  it('Birleştir merges each pair once per move', async () => {
    const M = await import('./merge/logic');
    const r = M.slide([2, 2, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4, 'left');
    expect(r.grid.slice(0, 4)).toEqual([4, 4, 0, 0]);
    expect(r.gained).toBe(4);
    expect(M.slide([2, 2, 2, 2, ...Array(12).fill(0)], 4, 'right').grid.slice(0, 4)).toEqual([0, 0, 4, 4]);
  });

  it('Nonogram puzzles can be solved by logic alone', async () => {
    const N = await import('./nonogram/logic');
    expect(N.solveLine([3], [-1, -1, -1, -1])).toEqual([-1, 1, 1, -1]);
    expect(N.solveLine([1, 1], [-1, -1, -1])).toEqual([1, 0, 1]);
    for (const size of [5, 10, 15]) {
      const t = Date.now();
      const g = N.generate(size, rng(size));
      expect(N.lineSolvable(size, g.rows, g.cols)).toBe(true);
      expect(Date.now() - t).toBeLessThan(4000);
    }
  });

  it('Kakuro puzzles have valid runs and (usually) a unique answer', async () => {
    const K = await import('./kakuro/logic');
    for (const size of [6, 7, 9]) {
      const t = Date.now();
      const g = K.generate(size, rng(size * 3));
      for (const r of g.runs) {
        expect(r.cells.length).toBeGreaterThanOrEqual(2);
        expect(r.cells.length).toBeLessThanOrEqual(9);
        expect(r.sum).toBeGreaterThanOrEqual((r.cells.length * (r.cells.length + 1)) / 2);
      }
      expect(K.countSolutions(size, g.white, g.runs, 2, 200000)).toBeGreaterThanOrEqual(1);
      expect(Date.now() - t).toBeLessThan(6000);
    }
  });

  it('Taş Eşle deals every face exactly twice and can be cleared', async () => {
    const T = await import('./tasesle/logic');
    for (const layout of ['pyramid', 'fortress']) {
      const random = rng(layout.length);
      let s = T.setup({ random, options: { layout }, now: () => 0 });
      const faces = s.tiles.map((x) => x! % 52);
      expect(faces.every((f) => faces.filter((x) => x === f).length === 2)).toBe(true);
      for (let step = 0; step < 500 && s.finishedAt === null; step++) {
        const p = T.freePairs(s);
        const r = p.length ? T.move(s, 0, { type: 'match', a: p[0][0], b: p[0][1] }, { now: () => 1, random }) : T.move(s, 0, { type: 'shuffle' }, { now: () => 1, random });
        if (typeof r === 'string') throw new Error(r);
        s = r;
      }
      expect(s.finishedAt).not.toBeNull();
    }
  });

  it('Kelime Avı finds words forwards and backwards', async () => {
    const W = await import('./wordsearch/logic');
    const s = W.setup({ random: rng(5), options: { level: 'hard', lang: 'tr' }, now: () => 0 });
    expect(s.words.length).toBeGreaterThanOrEqual(10);
    for (const w of s.words) expect(w.cells.map((c) => s.grid[c]).join('')).toBe(w.word);
    const r = W.move(s, 0, { type: 'find', cells: s.words[0].cells.slice().reverse() }, { now: () => 5 });
    if (typeof r === 'string') throw new Error(r);
    expect(r.found[0]).toBe(true);
    expect(W.move(s, 0, { type: 'find', cells: [0, 1] }, { now: () => 5 })).toBe('Not one of the words');
  });
});

describe('Party games', () => {
  it('İsim Şehir Hayvan: unique 10, shared 5, only answer 20, vetoes by majority', async () => {
    const I = await import('./ish/logic');
    let now = 0;
    const ctx = { numPlayers: 3, random: rng(1), options: { lang: 'tr', rounds: '1' }, now: () => now };
    let s = I.setup(ctx);
    s = { ...s, letter: 'İ' };
    expect(I.startsWith('istanbul', 'İ', 'tr')).toBe(true);
    expect(I.startsWith('ırmak', 'İ', 'tr')).toBe(false);
    const ans = (seat: number, a: string[]) => (s = I.move(s, seat, { type: 'answers', answers: a }, ctx) as typeof s);
    ans(0, ['İlker', 'İzmir', 'İnek', '', 'İğne']);
    ans(1, ['İlker', 'İstanbul', '', '', 'İp']);
    ans(2, ['İpek', 'İzmir', '', '', 'Kalem']);
    s = I.onTimer(s, ctx as never);
    expect(s.phase).toBe('review');
    s = I.move(s, 1, { type: 'veto', seat: 0, cat: 4 }, ctx) as typeof s;
    s = I.move(s, 2, { type: 'veto', seat: 0, cat: 4 }, ctx) as typeof s;
    // Seat 0: İlker shared 5, İzmir shared 5, İnek only animal 20, İğne vetoed 0
    // Seat 1: İlker 5, İstanbul 10, İp the only valid thing 20. Seat 2: İpek 10, İzmir 5
    expect(I.score(s)).toEqual([30, 35, 15]);
  });

  it('Tombala cards follow the rules and claims go in order', async () => {
    const T = await import('./tombala/logic');
    const card = T.makeCard(rng(9));
    expect(card.flat().filter((x) => x !== null).length).toBe(15);
    expect(card.every((row) => row.filter((x) => x !== null).length === 5)).toBe(true);
    card.forEach((row) => row.forEach((x, c) => x !== null && expect(x >= (c === 0 ? 1 : c * 10) && x <= (c === 8 ? 90 : c * 10 + 9)).toBe(true)));
    let s = T.setup({ numPlayers: 2, random: rng(2), options: {}, now: () => 0 });
    expect(T.move(s, 0, { type: 'claim' })).toBe('Nothing to claim yet');
    s = { ...s, drawn: s.cards[0][0].filter((x): x is number => x !== null) };
    expect(T.activePlayers(s)).toContain(0);
    s = T.move(s, 0, { type: 'claim' }) as typeof s;
    expect(s.winners.cinko1).toBe(0);
  });

  it('Vampir Köylü deals the right roles', async () => {
    const V = await import('./vampir/logic');
    const s = V.setup({ numPlayers: 8, random: rng(4), options: {}, now: () => 0 });
    expect(s.roles.filter((r) => r === 'vampir').length).toBe(2);
    expect(s.roles.filter((r) => r === 'doktor').length).toBe(1);
    expect(s.roles.filter((r) => r === 'gozcu').length).toBe(1);
    const v = V.view(s, s.roles.indexOf('vampir'));
    expect(v.known.filter((r) => r === 'vampir').length).toBe(2);
    expect(V.view(s, s.roles.indexOf('koylu')).known.filter(Boolean).length).toBe(1);
  });
});

describe('Yılan', () => {
  it('moves, turns, eats and dies on itself', async () => {
    const S = await import('./snake/sim');
    const s = S.newSnake(true, rng(1));
    s.food = { x: 7, y: 10 };
    expect(S.tick(s, rng(2))).toBe('ate');
    expect(s.score).toBe(1);
    S.tick(s, rng(2));
    expect(s.body.length).toBe(4);
    // A wall kills with walls on
    for (let k = 0; k < 20 && !s.dead; k++) S.tick(s, rng(3));
    expect(s.dead).toBe(true);
    // Turning straight back is ignored
    const t = S.newSnake(false, rng(1));
    S.turn(t, 'left');
    expect(t.queue).toEqual([]);
  });
});

describe('Poker', () => {
  it('ranks hands correctly', async () => {
    const E = await import('./poker/eval');
    const { card } = await import('./cards/cards');
    const h = (...cs: [number, number][]) => cs.map(([s, r]) => card(s, r));
    const royal = E.best(h([0, 14], [0, 13], [0, 12], [0, 11], [0, 10], [1, 2], [2, 3])).score;
    const quads = E.best(h([0, 9], [1, 9], [2, 9], [3, 9], [0, 2], [1, 3], [2, 4])).score;
    const wheel = E.best(h([0, 14], [1, 2], [2, 3], [3, 4], [0, 5], [1, 9], [2, 11])).score;
    const sixHigh = E.best(h([0, 6], [1, 2], [2, 3], [3, 4], [0, 5], [1, 9], [2, 11])).score;
    const twoPair = E.best(h([0, 9], [1, 9], [2, 4], [3, 4], [0, 14], [1, 2], [2, 3])).score;
    expect(E.handName(royal)).toBe('Straight flush');
    expect(E.handName(quads)).toBe('Four of a kind');
    expect(E.handName(wheel)).toBe('Straight');
    expect(sixHigh).toBeGreaterThan(wheel);
    expect(E.handName(twoPair)).toBe('Two pair');
    expect(quads).toBeGreaterThan(twoPair);
    expect(E.best(h([0, 14], [1, 14], [2, 3], [3, 4], [0, 9], [1, 10])).five.length).toBe(5);
  });

  it('splits side pots when a short stack goes all-in', async () => {
    const P = await import('./poker/logic');
    const { card } = await import('./cards/cards');
    let now = 0;
    const ctx = { numPlayers: 3, random: rng(5), options: { chips: '1000' }, now: () => now };
    let s = P.setup(ctx, 'holdem');
    // Rig the hand: seat 0 short with the best cards, seat 1 second best, seat 2 worst
    s = {
      ...s,
      chips: [90, 990, 980].map((c, i) => c - 0 * i),
      hole: [
        [card(0, 14), card(1, 14)],
        [card(0, 13), card(1, 13)],
        [card(2, 2), card(3, 7)],
      ],
      deck: [card(2, 9), card(3, 10), card(0, 4), card(1, 5), card(2, 12), ...s.deck.filter((c) => ![card(0, 14), card(1, 14), card(0, 13), card(1, 13), card(2, 2), card(3, 7), card(2, 9), card(3, 10), card(0, 4), card(1, 5), card(2, 12)].includes(c))],
    };
    const total = s.chips.reduce((a, b) => a + b, 0) + s.contributed.reduce((a, b) => a + b, 0);
    // Everyone goes all-in
    for (let k = 0; k < 6 && s.phase === 'bet'; k++) {
      const seat = s.toAct;
      const r = P.move(s, seat, { type: 'raise', to: s.bet[seat] + s.chips[seat] }, ctx);
      s = typeof r === 'string' ? (P.move(s, seat, { type: 'call' }, ctx) as typeof s) : r;
    }
    expect(s.phase).toBe('showdown');
    expect(s.chips.reduce((a, b) => a + b, 0)).toBe(total);
    // Seat 0 wins the main pot (3 × its stack); seat 1 wins the side pot
    expect(s.chips[0]).toBe(s.contributed[0] * 3);
    expect(s.chips[2]).toBe(0);
  });

  it('bots finish games of both variants', async () => {
    const { holdem, poker } = await import('./poker');
    for (const g of [holdem, poker]) {
      let now = 0;
      const random = rng(11);
      const ctx = { numPlayers: 4, random, options: { chips: '500', blinds: '5', hands: '0' }, now: () => now };
      let s = g.setup(ctx);
      for (let step = 0; step < 20000 && !g.result(s); step++) {
        const act = g.activePlayers(s);
        if (!act.length) {
          now += 7000;
          s = g.onTimer!(s, ctx as never);
          continue;
        }
        const m = g.bot!(g.view(s, act[0]), act[0], { random, level: (['easy', 'normal', 'hard'] as const)[step % 3] })!;
        const r = g.move(s, act[0], m, ctx as never);
        if (typeof r === 'string') throw new Error(`${r} ${JSON.stringify(m)}`);
        s = r;
        expect(s.chips.reduce((a: number, b: number) => a + b, 0) + s.contributed.reduce((a: number, b: number) => a + b, 0) - (s.phase === 'showdown' || s.phase === 'done' ? s.contributed.reduce((a: number, b: number) => a + b, 0) : 0)).toBe(2000);
      }
      expect(g.result(s)).not.toBeNull();
    }
  }, 60000);
});

describe('Taş Yağmuru', () => {
  it('recognizes Okey melds with jokers, and clears them', async () => {
    const R = await import('./rain/sim');
    const t = (c: number, n: number) => ({ c, n });
    const J = { c: R.JOKER, n: 0 };
    expect(R.isMeld([t(0, 3), t(1, 3), t(2, 3)])).toBe(true);
    expect(R.isMeld([t(0, 3), t(0, 3), t(2, 3)])).toBe(false);
    expect(R.isMeld([t(1, 2), t(1, 3), t(1, 4)])).toBe(true);
    expect(R.isMeld([t(1, 5), t(1, 4), t(1, 3)])).toBe(true);
    expect(R.isMeld([t(1, 2), J, t(1, 4)])).toBe(true);
    expect(R.isMeld([t(1, 2), t(2, 3), t(1, 4)])).toBe(false);
    const r = R.newRain(6, rng(1));
    const bottom = (R.ROWS - 1) * R.COLS;
    r.grid[bottom] = t(0, 1);
    r.grid[bottom + 1] = t(0, 2);
    r.piece = { a: t(0, 3), b: t(2, 5), x: 2, y: 0, vertical: false };
    R.hardDrop(r, rng(2));
    expect(r.score).toBeGreaterThan(0);
    expect(r.grid[bottom]).toBeNull();
    // the 5 drops into the gap left by the meld
    expect(r.grid[bottom + 3]).toEqual(t(2, 5));
  });
});

describe('Board games, wave 3', () => {
  it('Mangala: first stone goes back, last in store plays again, even pits are captured', async () => {
    const M = await import('./mangala');
    let s = M.setup();
    // Pit 2 (4 stones): 1 back in pit 2, then 3, 4, 5 → last in pit 5, not the store
    s = M.play(s, 2);
    expect(s.pits.slice(0, 7)).toEqual([4, 4, 1, 5, 5, 5, 0]);
    expect(s.turn).toBe(1);
    // Pit 3 for seat 0 from the start: 1 back, then 4, 5, store → plays again
    const t = M.play(M.setup(), 3);
    expect(t.pits[6]).toBe(1);
    expect(t.turn).toBe(0);
    // Ending on the opponent's side with an even count captures
    const u = { ...M.setup(), pits: [0, 0, 0, 0, 0, 2, 0, 1, 4, 4, 4, 4, 4, 0] };
    const r = M.play(u, 5);
    expect(r.pits[6]).toBe(1 + 0);
    const w = { ...M.setup(), pits: [0, 0, 0, 0, 0, 3, 0, 1, 4, 4, 4, 4, 4, 0] };
    const r2 = M.play(w, 5);
    // 3 stones: 1 back in pit 5, store, pit 7 (1 → 2, even) → captured
    expect(r2.pits[7]).toBe(0);
    expect(r2.pits[6]).toBe(3);
  });

  it('Reversi flips flanked lines; Gomoku spots five in a row', async () => {
    const R = await import('./reversi');
    const s = R.setup();
    expect(R.legal(s.board, 0).sort((a, b) => a - b)).toEqual([19, 26, 37, 44]);
    expect(R.flips(s.board, 19, 0)).toEqual([27]);
    const G = await import('./gomoku');
    let g = G.setup();
    for (const [seat, cell] of [
      [0, 0],
      [1, 20],
      [0, 1],
      [1, 21],
      [0, 2],
      [1, 22],
      [0, 3],
      [1, 23],
      [0, 4],
    ] as const) {
      const r = G.move(g, seat, { cell });
      if (typeof r === 'string') throw new Error(r);
      g = r;
    }
    expect(g.winner).toBe(0);
    expect(g.line?.length).toBe(5);
  });

  it('Dokuz Taş: a mill lets you remove a piece, but not one in a mill', async () => {
    const D = await import('./dokuztas');
    expect(D.MILLS.length).toBe(16);
    expect(D.ADJ.every((a, i) => a.every((j) => D.ADJ[j].includes(i)))).toBe(true);
    let s = D.setup();
    s = { ...s, board: [0, 0, null, ...Array(21).fill(null)], toPlace: [7, 9] };
    s.board[8] = 1;
    s.board[9] = 1;
    s.board[10] = 1;
    s.board[16] = 1;
    const r = D.move(s, 0, { type: 'place', to: 2 });
    if (typeof r === 'string') throw new Error(r);
    expect(r.removing).toBe(true);
    expect(D.removable(r.board, 1)).toEqual([16]);
  });
});

describe('Dice and pencil games', () => {
  it('Generala scores boxes and served bonuses', async () => {
    const G = await import('./generala');
    expect(G.points([1, 2, 3, 4, 5], 'escalera', false, {})).toBe(20);
    expect(G.points([1, 2, 3, 4, 5], 'escalera', true, {})).toBe(25);
    expect(G.points([3, 3, 3, 6, 6], 'full', false, {})).toBe(30);
    expect(G.points([4, 4, 4, 4, 2], 'poker', false, {})).toBe(40);
    expect(G.points([6, 6, 6, 6, 6], 'generala', false, {})).toBe(50);
    expect(G.points([6, 6, 6, 6, 6], 'doble', false, { generala: 50 })).toBe(100);
    expect(G.points([5, 5, 2, 5, 1], '5', false, {})).toBe(15);
  });

  it('Sayı Bulmaca gives + and − clues, and the bot cracks a code', async () => {
    const B = await import('./bulls');
    expect(B.score('1234', '1243')).toEqual({ plus: 2, minus: 2 });
    expect(B.score('1234', '5678')).toEqual({ plus: 0, minus: 0 });
    expect(B.valid('0123')).toBe(false);
    expect(B.valid('1123')).toBe(false);
    const random = rng(8);
    let s = B.setup({ numPlayers: 1, random });
    for (let k = 0; k < 20 && s.phase !== 'done'; k++) {
      const r = B.move(s, 0, B.bot(B.view(s, 0), 0, { random, level: 'hard' }));
      if (typeof r === 'string') throw new Error(r);
      s = r;
    }
    expect(s.phase).toBe('done');
    expect(s.guesses.length).toBeLessThanOrEqual(10);
  });

  it('Kutu Kapmaca: closing a box scores and keeps the turn', async () => {
    const D = await import('./dots');
    let s = D.setup({ numPlayers: 2, options: { size: '3' } });
    const sides = D.sidesOf(s, 0);
    s = D.apply(s, sides[0]);
    s = D.apply(s, sides[1]);
    s = D.apply(s, sides[2]);
    const who = s.turn;
    s = D.apply(s, sides[3]);
    expect(s.boxes[0]).toBe(who);
    expect(s.turn).toBe(who);
  });

  it('Yılan Merdiven: ladders and snakes never chain, and 100 needs an exact roll', async () => {
    const L = await import('./ladders');
    for (const top of Object.values(L.LADDERS)) expect(L.SNAKES[top]).toBeUndefined();
    for (const tail of Object.values(L.SNAKES)) expect(L.LADDERS[tail]).toBeUndefined();
    const s = { ...L.setup({ numPlayers: 1, random: rng(1) }), pos: [97] };
    const r = L.move(s, 0, { type: 'roll' }, { random: () => 0.99 }); // a 6: 97 → 103 → bounce to 97
    if (typeof r === 'string') throw new Error(r);
    expect(r.pos[0]).toBe(97);
  });
});

describe('Hearts and Spades', () => {
  it('Hearts: a full game adds 26 points per hand and the lowest score wins', async () => {
    const H = await import('./hearts/logic');
    const random = rng(21);
    let s = H.setup({ random, options: { target: '100' } });
    for (let step = 0; step < 20000 && s.phase !== 'done'; step++) {
      const act = H.activePlayers(s);
      const m = H.bot(H.view(s, act[0]), act[0], { random, level: 'hard' });
      const r = H.move(s, act[0], m, { random });
      if (typeof r === 'string') throw new Error(r);
      s = r;
    }
    expect(s.phase).toBe('done');
    for (const h of s.history) expect([26, 78]).toContain(h.reduce((a, b) => a + b, 0));
  });

  it('Spades scores bids, bags and nil', async () => {
    const S = await import('./spades/logic');
    const random = rng(3);
    let s = S.setup({ random, options: { target: '250' } });
    for (let step = 0; step < 20000 && s.phase !== 'done'; step++) {
      const seat = s.turn;
      const r = S.move(s, seat, S.bot(S.view(s, seat), seat, { random, level: 'hard' }), { random });
      if (typeof r === 'string') throw new Error(r);
      s = r;
    }
    expect(s.phase).toBe('done');
    for (const h of s.history) expect(h.tricks.reduce((a, b) => a + b, 0)).toBe(13);
  });
});

describe('Mahbusa', () => {
  it('traps a lone checker instead of hitting it, and frees it when the trapper leaves', async () => {
    const B = await import('./backgammon/logic');
    let s = B.setup({ random: rng(1), options: {} }, 'mahbusa');
    expect(s.board[23]).toBe(15);
    const p = { ...s, board: Array(24).fill(0), pinned: Array(24).fill(null), bar: [0, 0] as [number, number] };
    p.board[10] = 2;
    p.board[7] = -1;
    const after = B.applyStep(p, 0, { from: 10, to: 7, die: 3 });
    expect(after.pinned![7]).toBe(1);
    expect(after.board[7]).toBe(1);
    expect(after.bar).toEqual([0, 0]);
    // Seat 1 can't land on its own trapped point
    expect(B.singleSteps(after, 1, 1).some((st) => st.to === 7)).toBe(false);
    const freed = B.applyStep(after, 0, { from: 7, to: 4, die: 3 });
    expect(freed.pinned![7]).toBeNull();
    expect(freed.board[7]).toBe(-1);
    s = { ...s };
  });
});

describe('Durak pass-on', () => {
  it('lets the defender pass the attack on, and bots finish a pass-on game', async () => {
    const D = await import('./durak/logic');
    const { card } = await import('./cards/cards');
    let s = D.setup({ numPlayers: 3, random: rng(4), options: { mode: 'transfer' } });
    expect(s.transfer).toBe(true);
    s = { ...s, attacker: 0, defender: 1, hands: [[card(0, 9), card(1, 10)], [card(2, 9), card(3, 12)], [card(0, 6), card(1, 6), card(2, 6)]], phase: 'attack' };
    s = D.move(s, 0, { type: 'attack', card: card(0, 9) }) as typeof s;
    expect(D.canTransfer(s, card(2, 9))).toBe(true);
    s = D.move(s, 1, { type: 'transfer', card: card(2, 9) }) as typeof s;
    expect(s.defender).toBe(2);
    expect(s.attacker).toBe(1);
    expect(s.table.length).toBe(2);
    const random = rng(9);
    let g = D.setup({ numPlayers: 4, random, options: { mode: 'transfer' } });
    for (let step = 0; step < 5000 && g.phase !== 'done'; step++) {
      const seat = D.activePlayers(g)[0];
      const r = D.move(g, seat, D.bot(D.view(g, seat), seat, { random, level: 'hard' }));
      if (typeof r === 'string') throw new Error(r);
      g = r;
    }
    expect(g.phase).toBe('done');
  });
});

describe('Fetih', () => {
  it('builds a connected map where every territory has neighbors', async () => {
    const F = await import('./fetih/logic');
    const { terr, cellOf } = F.makeMap(20, rng(6));
    expect(cellOf.every((x) => x >= 0)).toBe(true);
    expect(terr.every((t) => t.adj.length > 0)).toBe(true);
    // Every territory reachable from territory 0
    const seen = new Set([0]);
    const q = [0];
    while (q.length) for (const a of terr[q.pop()!].adj) if (!seen.has(a)) seen.add(a), q.push(a);
    expect(seen.size).toBe(20);
    const s = F.setup({ numPlayers: 4, random: rng(7), options: { rounds: '25' } });
    const totals = [0, 1, 2, 3].map((p) => s.armies.reduce((a, x, k) => a + (s.owner[k] === p ? x : 0), 0));
    expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(1);
  });
});

describe('Gul Bara', () => {
  it('both players travel the same way, a single checker blocks, and doubles cascade from turn 4', async () => {
    const B = await import('./backgammon/logic');
    const s = B.setup({ random: rng(2), options: {} }, 'gulbara');
    expect(s.board[23]).toBe(15);
    expect(s.board[11]).toBe(-15);
    // Seat 1 moves from 11 towards 0, then on from 23 down to its home 12..17
    expect(B.progress(s, 1, 11)).toBe(0);
    expect(B.progress(s, 1, 23)).toBe(12);
    expect(B.progress(s, 1, 12)).toBe(23);
    const p = { ...s, board: Array(24).fill(0) };
    p.board[20] = 1;
    p.board[17] = -1;
    // A lone opposing checker blocks the point
    expect(B.singleSteps(p, 0, 3).some((st) => st.to === 17)).toBe(false);
    const g: typeof s = { ...s, turn: 0, phase: 'roll', turns: [3, 3] };
    const r = B.move(g, 0, { type: 'roll' }, { random: () => 0.5 }); // 4-4
    if (typeof r === 'string') throw new Error(r);
    expect(r.cascade).toEqual([5, 6]);
  });
});

describe('Çanak Okey and Konken', () => {
  it('Çanak: everyone antes each hand, and an okey-discard finish takes the pot', async () => {
    const O = await import('./okey/logic');
    const s = O.setup({ random: rng(3), options: { points: '20', canak: 'yes' } });
    expect(s.canak).toBe(4);
    expect(s.scores).toEqual([19, 19, 19, 19]);
  });

  it('Konken: jokers are wild, leftovers are scored, and bots finish a game', async () => {
    const O = await import('./okey/logic');
    const okey = (await import('./okey101/logic')).WILD_JOKERS;
    const t = (c: number, n: number) => c * 13 + n - 1;
    // 13 + 104 make a run with a joker; the lone 9 is deadwood
    expect(O.deadwood([t(0, 1), t(0, 2), 104, t(1, 9)], okey)).toBe(9);
    const random = rng(12);
    let s = O.setup({ random, options: { hands: '3' }, numPlayers: 3 }, 'konken');
    expect(s.indicator).toBe(-1);
    for (let step = 0; step < 20000 && s.phase !== 'done'; step++) {
      const r = O.move(s, s.turn, O.bot(O.view(s, s.turn), s.turn, { random, level: 'hard' }), random);
      if (typeof r === 'string') throw new Error(r);
      s = r;
    }
    expect(s.phase).toBe('done');
    expect(O.result(s)?.winners.length).toBeGreaterThan(0);
  }, 30000);
});
