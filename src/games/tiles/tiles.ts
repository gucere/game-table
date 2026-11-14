/**
 * Shared Okey tile logic.
 * A tile is 0..105: 0..103 are numbered tiles (two copies of 1..13 in four colors),
 * 104 and 105 are the two false jokers (sahte okey).
 */
export type Tile = number;

export const COLOR_NAMES = ['Red', 'Black', 'Blue', 'Yellow'];
export const COLOR_NAMES_TR = ['Kırmızı', 'Siyah', 'Mavi', 'Sarı'];
export const COLOR_CSS = ['#d62828', '#1d1d1d', '#1666c5', '#d99a00'];

export const isFake = (t: Tile) => t >= 104;
export const colorOf = (t: Tile) => (t >= 104 ? -1 : Math.floor((t % 52) / 13));
export const numOf = (t: Tile) => (t >= 104 ? 0 : (t % 13) + 1);

export interface Face {
  color: number;
  num: number;
}

export function allTiles(): Tile[] {
  return Array.from({ length: 106 }, (_, i) => i);
}

/** The okey (wild tile) is the indicator's color, one number higher (13 wraps to 1) */
export function okeyFrom(indicator: Tile): Face {
  return { color: colorOf(indicator), num: (numOf(indicator) % 13) + 1 };
}

/** The wild tile. With `okey.color === -1` (card games like 51) the two printed jokers are wild instead. */
export const isJoker = (t: Tile, okey: Face) => (isFake(t) ? okey.color === -1 : colorOf(t) === okey.color && numOf(t) === okey.num);

/** What a non-wild tile counts as (false jokers stand in for the okey tile) */
export function faceOf(t: Tile, okey: Face): Face {
  return isFake(t) ? okey : { color: colorOf(t), num: numOf(t) };
}

export function tileLabel(t: Tile, okey?: Face) {
  if (okey && isJoker(t, okey)) return okey.color === -1 ? 'Joker' : 'Okey';
  if (isFake(t)) return 'False joker';
  return `${COLOR_NAMES[colorOf(t)]} ${numOf(t)}`;
}

export interface RuleSet {
  /** Allow 12-13-1 runs (regular Okey). 101 Okey says no. */
  wrap: boolean;
}

export type MeldKind = 'set' | 'run' | 'pair';

export interface Meld {
  kind: MeldKind;
  tiles: Tile[];
  /** The face each tile represents, aligned with `tiles` (jokers get a concrete face) */
  faces: Face[];
}

export function meldPoints(m: Meld) {
  return m.faces.reduce((a, f) => a + (f.num === 14 ? 1 : f.num), 0);
}

/**
 * Check whether `tiles` form a valid meld. Returns the meld with faces assigned,
 * or null. Jokers in runs are placed to make the meld worth as much as possible.
 */
export function asMeld(tiles: Tile[], okey: Face, rules: RuleSet, kinds: MeldKind[] = ['set', 'run']): Meld | null {
  const jokers = tiles.filter((t) => isJoker(t, okey));
  const real = tiles.filter((t) => !isJoker(t, okey));
  const faces = real.map((t) => faceOf(t, okey));

  if (kinds.includes('pair') && tiles.length === 2) {
    if (jokers.length >= 1 || (faces[0].color === faces[1].color && faces[0].num === faces[1].num)) {
      const f = faces[0] ?? okey;
      return { kind: 'pair', tiles, faces: [f, f] };
    }
  }

  if (kinds.includes('set') && (tiles.length === 3 || tiles.length === 4)) {
    const nums = new Set(faces.map((f) => f.num));
    const colors = new Set(faces.map((f) => f.color));
    if (nums.size <= 1 && colors.size === faces.length) {
      const num = faces[0]?.num ?? okey.num;
      const free = [0, 1, 2, 3].filter((c) => !colors.has(c));
      let k = 0;
      const out = tiles.map((t) => (isJoker(t, okey) ? { color: free[k++], num } : faceOf(t, okey)));
      return { kind: 'set', tiles, faces: out };
    }
  }

  if (kinds.includes('run') && tiles.length >= 3 && tiles.length <= 13 + (rules.wrap ? 1 : 0)) {
    const colors = new Set(faces.map((f) => f.color));
    if (colors.size > 1) return null;
    const color = faces[0]?.color ?? okey.color;
    const tryNums = (nums: number[]) => {
      const sorted = nums.slice().sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) if (sorted[i] === sorted[i - 1]) return null;
      const L = tiles.length;
      const top = rules.wrap ? 14 : 13;
      const lo = sorted.length ? sorted[0] : 1;
      const hi = sorted.length ? sorted[sorted.length - 1] : L;
      if (hi - lo + 1 > L) return null;
      // Highest-scoring placement: extend upwards as far as possible
      const start = Math.max(1, Math.min(lo, top - L + 1));
      if (start + L - 1 > top || start > lo || start + L - 1 < hi) return null;
      return start;
    };
    let nums = faces.map((f) => f.num);
    let start = tryNums(nums);
    if (start === null && rules.wrap && nums.includes(1)) {
      nums = nums.map((n) => (n === 1 ? 14 : n));
      start = tryNums(nums);
    }
    if (start !== null) {
      const L = tiles.length;
      const seq = Array.from({ length: L }, (_, i) => start! + i);
      const realByNum = new Map<number, Tile>();
      real.forEach((t, i) => realByNum.set(nums[i], t));
      const jq = jokers.slice();
      const ordered: Tile[] = [];
      const outFaces: Face[] = [];
      for (const n of seq) {
        const t = realByNum.get(n);
        ordered.push(t !== undefined ? t : jq.shift()!);
        outFaces.push({ color, num: n });
      }
      return { kind: 'run', tiles: ordered, faces: outFaces };
    }
  }
  return null;
}

// ------------------------------------------------------------ hand search

interface Counts {
  /** counts[color*15 + num] for num 1..14 (14 = high ace mirror, unused in counts) */
  c: number[];
  jokers: number;
  /** Tile ids still available per slot */
  ids: Tile[][];
}

function toCounts(tiles: Tile[], okey: Face): Counts {
  const c = Array(60).fill(0);
  const ids: Tile[][] = Array.from({ length: 60 }, () => []);
  let jokers = 0;
  for (const t of tiles) {
    if (isJoker(t, okey)) {
      jokers++;
      continue;
    }
    const f = faceOf(t, okey);
    c[f.color * 15 + f.num]++;
    ids[f.color * 15 + f.num].push(t);
  }
  return { c, jokers, ids };
}

/** Abstract meld: list of slots (color*15+num) or -1 for a joker */
type Shape = number[];

/**
 * Find the arrangement of `tiles` into sets and runs that maximizes the score
 * (tiles covered, or points for 101). Leftover tiles are returned as `rest`.
 */
export function bestMelds(
  tiles: Tile[],
  okey: Face,
  rules: RuleSet,
  scoreBy: 'tiles' | 'points' = 'tiles',
): { melds: Meld[]; rest: Tile[]; score: number } {
  const { c, jokers, ids } = toCounts(tiles, okey);
  const memo = new Map<string, { score: number; shapes: Shape[] }>();
  const top = rules.wrap ? 14 : 13;
  const slotOf = (color: number, num: number) => color * 15 + (num === 14 ? 1 : num);

  const shapeScore = (s: Shape, firstNum: number, kind: 'set' | 'run', start: number) => {
    if (scoreBy === 'tiles') return s.length;
    return kind === 'set' ? firstNum * s.length : s.reduce((a, _, i) => a + Math.min(start + i, 13) * 1, 0);
  };

  function solve(j: number): { score: number; shapes: Shape[] } {
    let first = -1;
    for (let i = 0; i < 60; i++)
      if (c[i] > 0) {
        first = i;
        break;
      }
    if (first < 0) return { score: 0, shapes: [] };
    const key = c.join('') + '|' + j;
    const hit = memo.get(key);
    if (hit) return hit;

    // Option 1: this tile stays in hand
    c[first]--;
    let best = solve(j);
    c[first]++;

    const color = Math.floor(first / 15);
    const num = first % 15;

    // Option 2: sets with this number
    const others = [0, 1, 2, 3].filter((x) => x !== color && c[x * 15 + num] > 0);
    for (let mask = 0; mask < 1 << others.length; mask++) {
      const chosen = others.filter((_, i) => mask & (1 << i));
      for (let useJ = 0; useJ <= Math.min(j, 3); useJ++) {
        const size = 1 + chosen.length + useJ;
        if (size < 3 || size > 4) continue;
        const shape: Shape = [first, ...chosen.map((x) => x * 15 + num)];
        shape.forEach((s) => c[s]--);
        const sub = solve(j - useJ);
        shape.forEach((s) => c[s]++);
        const full = [...shape, ...Array(useJ).fill(-1)];
        const sc = sub.score + shapeScore(full, num, 'set', num);
        if (sc > best.score) best = { score: sc, shapes: [full, ...sub.shapes] };
      }
    }

    // Option 3: runs that contain this tile as the lowest real tile
    for (let pre = 0; pre <= j && num - pre >= 1; pre++) {
      const used: number[] = [first];
      let jUsed = pre;
      let n = num + 1;
      const shape: Shape = [...Array(pre).fill(-1), first];
      c[first]--;
      while (n <= top) {
        const slot = slotOf(color, n);
        if (c[slot] > 0) {
          c[slot]--;
          used.push(slot);
          shape.push(slot);
        } else if (jUsed < j) {
          jUsed++;
          shape.push(-1);
        } else break;
        // Runs may also end in jokers (A-2-J): asMeld checks the result fits on the board
        if (shape.length >= 3) {
          const sub = solve(j - jUsed);
          const sc = sub.score + shapeScore(shape, num, 'run', num - pre);
          if (sc > best.score) best = { score: sc, shapes: [shape.slice(), ...sub.shapes] };
        }
        n++;
      }
      // Trailing joker runs (e.g. 5-6-J)
      if (shape.length >= 2 && jUsed < j && shape.length + 1 >= 3 && n <= top + 1) {
        const ext = [...shape, -1];
        const sub = solve(j - jUsed - 1);
        const sc = sub.score + shapeScore(ext, num, 'run', num - pre);
        if (sc > best.score) best = { score: sc, shapes: [ext, ...sub.shapes] };
      }
      used.forEach((s) => c[s]++);
    }

    memo.set(key, best);
    return best;
  }

  const res = solve(jokers);
  // Turn abstract shapes back into tiles
  const pool = ids.map((a) => a.slice());
  const jokerTiles = tiles.filter((t) => isJoker(t, okey));
  const melds: Meld[] = [];
  for (const shape of res.shapes) {
    const ts = shape.map((s) => (s === -1 ? jokerTiles.shift()! : pool[s].shift()!));
    const m = asMeld(ts, okey, rules);
    if (m) melds.push(m);
  }
  const usedSet = new Set(melds.flatMap((m) => m.tiles));
  return { melds, rest: tiles.filter((t) => !usedSet.has(t)), score: res.score };
}

/** Pairs: identical tiles (jokers pair with anything) */
export function bestPairs(tiles: Tile[], okey: Face): { pairs: Meld[]; rest: Tile[] } {
  const jokers = tiles.filter((t) => isJoker(t, okey));
  const bySlot = new Map<string, Tile[]>();
  for (const t of tiles) {
    if (isJoker(t, okey)) continue;
    const f = faceOf(t, okey);
    const k = `${f.color}-${f.num}`;
    bySlot.set(k, [...(bySlot.get(k) ?? []), t]);
  }
  const pairs: Meld[] = [];
  const rest: Tile[] = [];
  for (const ts of bySlot.values()) {
    while (ts.length >= 2) {
      const a = ts.shift()!;
      const b = ts.shift()!;
      pairs.push(asMeld([a, b], okey, { wrap: false }, ['pair'])!);
    }
    rest.push(...ts);
  }
  // Use jokers on the highest leftover tiles
  rest.sort((a, b) => faceOf(b, okey).num - faceOf(a, okey).num);
  while (jokers.length && rest.length) {
    pairs.push(asMeld([rest.shift()!, jokers.shift()!], okey, { wrap: false }, ['pair'])!);
  }
  while (jokers.length >= 2) pairs.push(asMeld([jokers.shift()!, jokers.shift()!], okey, { wrap: false }, ['pair'])!);
  rest.push(...jokers);
  return { pairs, rest };
}

/** Sort a rack: by color then number, jokers last */
export function sortTiles(tiles: Tile[], okey: Face, by: 'runs' | 'sets' = 'runs'): Tile[] {
  return tiles.slice().sort((a, b) => {
    const ja = isJoker(a, okey) ? 1 : 0;
    const jb = isJoker(b, okey) ? 1 : 0;
    if (ja !== jb) return ja - jb;
    const fa = faceOf(a, okey);
    const fb = faceOf(b, okey);
    return by === 'runs' ? fa.color - fb.color || fa.num - fb.num : fa.num - fb.num || fa.color - fb.color;
  });
}
