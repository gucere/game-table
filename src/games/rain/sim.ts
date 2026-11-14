/**
 * Taş Yağmuru: pairs of Okey tiles fall into a well. Line tiles up so that three or more
 * in a row or column form an Okey meld (a set: same number, different colours; or a run:
 * same colour, consecutive numbers). Melds vanish, tiles above drop, and chains score more.
 */

export const COLS = 7;
export const ROWS = 13;
export const JOKER = 4;

export interface RTile {
  /** 0..3 colour, 4 = joker */
  c: number;
  n: number;
}
export interface Piece {
  a: RTile;
  b: RTile;
  x: number;
  y: number;
  /** b sits to the right of a (horizontal) or below it (vertical) */
  vertical: boolean;
}
export interface Rain {
  grid: (RTile | null)[];
  piece: Piece | null;
  next: [RTile, RTile];
  score: number;
  melds: number;
  level: number;
  dead: boolean;
  maxNum: number;
  /** Cells cleared by the last lock (for a flash) and the chain length */
  flash: number[];
  chain: number;
}

const at = (x: number, y: number) => y * COLS + x;

export function randomTile(maxNum: number, random: () => number): RTile {
  if (random() < 0.04) return { c: JOKER, n: 0 };
  return { c: Math.floor(random() * 4), n: 1 + Math.floor(random() * maxNum) };
}

export function newRain(maxNum: number, random: () => number): Rain {
  const r: Rain = {
    grid: Array(COLS * ROWS).fill(null),
    piece: null,
    next: [randomTile(maxNum, random), randomTile(maxNum, random)],
    score: 0,
    melds: 0,
    level: 1,
    dead: false,
    maxNum,
    flash: [],
    chain: 0,
  };
  spawn(r, random);
  return r;
}

export function cellsOf(p: Piece): [number, number][] {
  return [
    [p.x, p.y],
    p.vertical ? [p.x, p.y + 1] : [p.x + 1, p.y],
  ];
}

function fits(r: Rain, p: Piece) {
  return cellsOf(p).every(([x, y]) => x >= 0 && x < COLS && y < ROWS && (y < 0 || !r.grid[at(x, y)]));
}

function spawn(r: Rain, random: () => number) {
  const [a, b] = r.next;
  r.next = [randomTile(r.maxNum, random), randomTile(r.maxNum, random)];
  const p: Piece = { a, b, x: 3, y: 0, vertical: false };
  if (!fits(r, p)) {
    r.dead = true;
    r.piece = null;
    return;
  }
  r.piece = p;
}

export function shift(r: Rain, dx: number) {
  if (!r.piece || r.dead) return;
  const p = { ...r.piece, x: r.piece.x + dx };
  if (fits(r, p)) r.piece = p;
}

/** Rotate: horizontal → vertical → horizontal with the tiles swapped */
export function rotate(r: Rain) {
  if (!r.piece || r.dead) return;
  const p = r.piece;
  const next: Piece = p.vertical ? { ...p, vertical: false, a: p.b, b: p.a } : { ...p, vertical: true };
  // Nudge left if rotating against the right wall or a tile
  for (const dx of [0, -1, 1]) {
    const q = { ...next, x: next.x + dx };
    if (fits(r, q)) {
      r.piece = q;
      return;
    }
  }
}

/** Is this line of tiles an Okey meld? Jokers stand in for anything. */
export function isMeld(tiles: RTile[]): boolean {
  if (tiles.length < 3) return false;
  const real = tiles.filter((t) => t.c !== JOKER);
  if (real.length === 0) return true;
  // Set: same number, all different colours (so at most 4)
  if (tiles.length <= 4 && real.every((t) => t.n === real[0].n) && new Set(real.map((t) => t.c)).size === real.length) return true;
  // Run: one colour, numbers going up (or down) by one, jokers filling in
  if (real.every((t) => t.c === real[0].c)) {
    for (const dir of [1, -1]) {
      const firstIdx = tiles.findIndex((t) => t.c !== JOKER);
      const start = tiles[firstIdx].n - dir * firstIdx;
      if (tiles.every((t, i) => t.c === JOKER || t.n === start + dir * i)) return true;
    }
  }
  return false;
}

/** Cells that belong to some meld of 3+ in a row or column */
export function findMelds(grid: (RTile | null)[]): Set<number> {
  const out = new Set<number>();
  const scan = (line: number[]) => {
    for (let len = Math.min(line.length, 7); len >= 3; len--) {
      for (let s = 0; s + len <= line.length; s++) {
        const idx = line.slice(s, s + len);
        const tiles = idx.map((i) => grid[i]);
        if (tiles.every(Boolean) && isMeld(tiles as RTile[])) idx.forEach((i) => out.add(i));
      }
    }
  };
  for (let y = 0; y < ROWS; y++) scan(Array.from({ length: COLS }, (_, x) => at(x, y)));
  for (let x = 0; x < COLS; x++) scan(Array.from({ length: ROWS }, (_, y) => at(x, y)));
  return out;
}

function gravity(grid: (RTile | null)[]) {
  for (let x = 0; x < COLS; x++) {
    const col = Array.from({ length: ROWS }, (_, y) => grid[at(x, y)]).filter(Boolean);
    for (let y = ROWS - 1; y >= 0; y--) grid[at(x, y)] = col.length ? col.pop()! : null;
  }
}

/** Land the piece, then clear melds (and the chains they set off) */
function lock(r: Rain, random: () => number) {
  const p = r.piece!;
  const [[ax, ay], [bx, by]] = cellsOf(p);
  if (ay < 0 || by < 0) {
    r.dead = true;
    return;
  }
  r.grid[at(ax, ay)] = p.a;
  r.grid[at(bx, by)] = p.b;
  r.piece = null;
  gravity(r.grid);
  r.flash = [];
  r.chain = 0;
  for (;;) {
    const m = findMelds(r.grid);
    if (!m.size) break;
    r.chain++;
    const pts = [...m].reduce((a, i) => a + (r.grid[i]!.c === JOKER ? 5 : r.grid[i]!.n), 0);
    r.score += pts * r.chain * (m.size >= 5 ? 2 : 1);
    r.melds++;
    r.flash.push(...m);
    m.forEach((i) => (r.grid[i] = null));
    gravity(r.grid);
  }
  r.level = 1 + Math.floor(r.melds / 8);
  spawn(r, random);
}

/** One step of gravity on the falling piece */
export function step(r: Rain, random: () => number) {
  if (!r.piece || r.dead) return;
  const p = { ...r.piece, y: r.piece.y + 1 };
  if (fits(r, p)) r.piece = p;
  else lock(r, random);
}

export function hardDrop(r: Rain, random: () => number) {
  if (!r.piece || r.dead) return;
  while (r.piece && fits(r, { ...r.piece, y: r.piece.y + 1 })) r.piece = { ...r.piece, y: r.piece.y + 1 };
  lock(r, random);
}

export const interval = (r: Rain) => Math.max(140, 850 - (r.level - 1) * 70);
