/**
 * Amiral Battı (sea battle), the classic pencil-and-paper game.
 * Each player secretly places a fleet on a 10×10 grid, then players take turns firing.
 * Sink every enemy ship to win.
 */
import type { BotCtx, GameCtx, GameResult, Seat } from '../../engine/types';

export const SIZE = 10;
export const FLEET = [
  { name: 'Carrier', nameTr: 'Uçak gemisi', len: 5 },
  { name: 'Frigate', nameTr: 'Fırkateyn', len: 4 },
  { name: 'Cruiser', nameTr: 'Kruvazör', len: 3 },
  { name: 'Submarine', nameTr: 'Denizaltı', len: 3 },
  { name: 'Patrol boat', nameTr: 'Hücumbot', len: 2 },
];

export interface Ship {
  r: number;
  c: number;
  len: number;
  /** true = horizontal */
  h: boolean;
}

export interface AmState {
  phase: 'place' | 'fire' | 'done';
  ships: (Ship[] | null)[];
  /** shots[s] = cells seat s has fired at on the enemy board (index r*10+c) */
  shots: number[][];
  turn: Seat;
  extraOnHit: boolean;
  winner: Seat | null;
  last: { seat: Seat; cell: number; hit: boolean; sunk: string | null } | null;
}

export type Mark = 'miss' | 'hit' | 'sunk';

export interface AmView {
  me: Seat;
  phase: AmState['phase'];
  turn: Seat;
  myShips: Ship[] | null;
  ready: boolean[];
  /** Shots the enemy fired at me */
  incoming: Record<number, Mark>;
  /** My shots on the enemy board */
  outgoing: Record<number, Mark>;
  /** Enemy ships that are sunk (fully revealed), or all of them when the game ends */
  enemySunk: Ship[];
  enemyLeft: number;
  myLeft: number;
  last: AmState['last'];
  extraOnHit: boolean;
}

export type AmMove = { type: 'place'; ships: Ship[] } | { type: 'fire'; cell: number };

export const cellsOf = (s: Ship) => Array.from({ length: s.len }, (_, k) => (s.r + (s.h ? 0 : k)) * SIZE + (s.c + (s.h ? k : 0)));

export function validFleet(ships: unknown): ships is Ship[] {
  if (!Array.isArray(ships) || ships.length !== FLEET.length) return false;
  const lens = ships.map((s) => s?.len).sort();
  const want = FLEET.map((f) => f.len).sort();
  if (lens.join() !== want.join()) return false;
  const used = new Set<number>();
  for (const s of ships as Ship[]) {
    if (![s.r, s.c].every((v) => Number.isInteger(v) && v >= 0 && v < SIZE)) return false;
    if (s.h ? s.c + s.len > SIZE : s.r + s.len > SIZE) return false;
    for (const cell of cellsOf(s)) {
      if (used.has(cell)) return false;
      used.add(cell);
    }
  }
  return true;
}

export function randomFleet(random: () => number): Ship[] {
  for (;;) {
    const ships: Ship[] = [];
    const used = new Set<number>();
    let ok = true;
    for (const f of FLEET) {
      let placed = false;
      for (let tries = 0; tries < 200 && !placed; tries++) {
        const h = random() < 0.5;
        const r = Math.floor(random() * (h ? SIZE : SIZE - f.len + 1));
        const c = Math.floor(random() * (h ? SIZE - f.len + 1 : SIZE));
        const s = { r, c, len: f.len, h };
        if (cellsOf(s).some((x) => used.has(x))) continue;
        cellsOf(s).forEach((x) => used.add(x));
        ships.push(s);
        placed = true;
      }
      if (!placed) ok = false;
    }
    if (ok) return ships;
  }
}

export function setup(ctx: Pick<GameCtx, 'random' | 'options'>): AmState {
  return {
    phase: 'place',
    ships: [null, null],
    shots: [[], []],
    turn: Math.floor(ctx.random() * 2),
    extraOnHit: ctx.options.extra === 'yes',
    winner: null,
    last: null,
  };
}

function shipAt(ships: Ship[], cell: number) {
  return ships.find((s) => cellsOf(s).includes(cell)) ?? null;
}

function isSunk(ship: Ship, shots: number[]) {
  return cellsOf(ship).every((c) => shots.includes(c));
}

export function move(s: AmState, seat: Seat, m: AmMove): AmState | string {
  if (s.phase === 'done') return 'The game is over';
  if (s.phase === 'place') {
    if (m.type !== 'place') return 'Place your fleet first';
    if (s.ships[seat]) return 'Your fleet is already placed';
    if (!validFleet(m.ships)) return 'Ships must fit on the board without overlapping';
    const ships = s.ships.slice();
    ships[seat] = m.ships.map((x) => ({ r: x.r, c: x.c, len: x.len, h: !!x.h }));
    return { ...s, ships, phase: ships.every(Boolean) ? 'fire' : 'place' };
  }
  if (m.type !== 'fire') return 'Fire at the enemy board';
  if (seat !== s.turn) return 'Not your turn';
  if (!Number.isInteger(m.cell) || m.cell < 0 || m.cell >= SIZE * SIZE) return 'Pick a square';
  if (s.shots[seat].includes(m.cell)) return 'You already fired there';
  const enemy = (1 - seat) as Seat;
  const shots = s.shots.map((x, i) => (i === seat ? [...x, m.cell] : x));
  const target = shipAt(s.ships[enemy]!, m.cell);
  const hit = !!target;
  const sunkShip = target && isSunk(target, shots[seat]) ? target : null;
  const sunkName = sunkShip ? (FLEET[s.ships[enemy]!.indexOf(sunkShip)] ?? FLEET.find((f) => f.len === sunkShip.len)!).name : null;
  const won = s.ships[enemy]!.every((sh) => isSunk(sh, shots[seat]));
  const last = { seat, cell: m.cell, hit, sunk: sunkName };
  if (won) return { ...s, shots, phase: 'done', winner: seat, last };
  return { ...s, shots, last, turn: hit && s.extraOnHit ? seat : enemy };
}

export function activePlayers(s: AmState): Seat[] {
  if (s.phase === 'done') return [];
  if (s.phase === 'place') return [0, 1].filter((i) => !s.ships[i]);
  return [s.turn];
}

function marks(shots: number[], ships: Ship[] | null): Record<number, Mark> {
  const out: Record<number, Mark> = {};
  for (const c of shots) {
    const sh = ships ? shipAt(ships, c) : null;
    out[c] = !sh ? 'miss' : isSunk(sh, shots) ? 'sunk' : 'hit';
  }
  return out;
}

export function view(s: AmState, seat: Seat): AmView {
  const enemy = (1 - seat) as Seat;
  const enemyShips = s.ships[enemy] ?? [];
  const myShips = s.ships[seat];
  return {
    me: seat,
    phase: s.phase,
    turn: s.turn,
    myShips,
    ready: s.ships.map(Boolean),
    incoming: marks(s.shots[enemy], myShips),
    outgoing: marks(s.shots[seat], s.ships[enemy]),
    enemySunk: s.phase === 'done' ? enemyShips : enemyShips.filter((sh) => isSunk(sh, s.shots[seat])),
    enemyLeft: enemyShips.filter((sh) => !isSunk(sh, s.shots[seat])).length || (s.phase === 'place' ? FLEET.length : 0),
    myLeft: myShips ? myShips.filter((sh) => !isSunk(sh, s.shots[enemy])).length : FLEET.length,
    last: s.last,
    extraOnHit: s.extraOnHit,
  };
}

export function result(s: AmState): GameResult | null {
  return s.winner === null ? null : { winners: [s.winner] };
}

// ------------------------------------------------------------- bot

export function bot(v: AmView, _seat: Seat, ctx: BotCtx): AmMove {
  if (v.phase === 'place') return { type: 'place', ships: randomFleet(ctx.random) };
  const shot = (c: number) => c in v.outgoing;
  const free = Array.from({ length: SIZE * SIZE }, (_, i) => i).filter((c) => !shot(c));
  const pick = (cells: number[]) => cells[Math.floor(ctx.random() * cells.length)];
  if (ctx.level === 'easy' && ctx.random() < 0.5) return { type: 'fire', cell: pick(free) };

  // Target mode: open hits (not yet sunk)
  const hits = Object.entries(v.outgoing)
    .filter(([, m]) => m === 'hit')
    .map(([c]) => Number(c));
  if (hits.length) {
    const rc = (c: number) => [Math.floor(c / SIZE), c % SIZE];
    const inb = (r: number, c: number) => r >= 0 && c >= 0 && r < SIZE && c < SIZE;
    let cands: number[] = [];
    if (hits.length >= 2) {
      // Extend the line of hits
      const [r0, c0] = rc(hits[0]);
      const sameRow = hits.every((h) => rc(h)[0] === r0);
      const sameCol = hits.every((h) => rc(h)[1] === c0);
      if (sameRow || sameCol) {
        const along = hits.map((h) => (sameRow ? rc(h)[1] : rc(h)[0]));
        const lo = Math.min(...along) - 1;
        const hi = Math.max(...along) + 1;
        for (const k of [lo, hi]) {
          const [r, c] = sameRow ? [r0, k] : [k, c0];
          if (inb(r, c) && !shot(r * SIZE + c)) cands.push(r * SIZE + c);
        }
      }
    }
    if (!cands.length) {
      for (const h of hits) {
        const [r, c] = rc(h);
        for (const [dr, dc] of [
          [0, 1],
          [1, 0],
          [0, -1],
          [-1, 0],
        ]) {
          if (inb(r + dr, c + dc) && !shot((r + dr) * SIZE + c + dc)) cands.push((r + dr) * SIZE + c + dc);
        }
      }
    }
    if (cands.length) return { type: 'fire', cell: pick(cands) };
  }
  // Hunt mode: checkerboard pattern is enough to find every ship of length ≥ 2
  const parity = ctx.level === 'hard' ? free.filter((c) => (Math.floor(c / SIZE) + (c % SIZE)) % 2 === 0) : free;
  return { type: 'fire', cell: pick(parity.length ? parity : free) };
}
