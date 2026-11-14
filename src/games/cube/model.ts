/**
 * NxN cube model, ported from the author's own solver (github.com/gucere/Rubik-s-Cube-Solver-s-,
 * version_3/web/moves.js and cube.py). The cube is a flat array of sticker ids; every sticker has
 * a 3D position (doubled, so everything is an integer) and each move is a permutation of the array.
 */
export type Vec = [number, number, number];
export type Face = 'U' | 'D' | 'L' | 'R' | 'F' | 'B';

export const FACES: Face[] = ['U', 'D', 'L', 'R', 'F', 'B'];
export const FACE_AXES: Record<Face, Vec> = { U: [0, 1, 0], D: [0, -1, 0], L: [-1, 0, 0], R: [1, 0, 0], F: [0, 0, 1], B: [0, 0, -1] };
export const OPPOSITE: Record<Face, Face> = { U: 'D', D: 'U', L: 'R', R: 'L', F: 'B', B: 'F' };
/** Sticker colors, in the order the faces are stored: U L F R B D */
export const COLORS = [0xf5f5f5, 0xff8a1f, 0x18a957, 0xe0322f, 0x2766e8, 0xffd21f];

export const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Same layout as cube.py's sticker_geometry: faces U L F R B D, n*n stickers each */
export function stickerGeometry(n: number) {
  const centers: Vec[] = [];
  const normals: Vec[] = [];
  const N: Vec[] = [
    [0, 1, 0],
    [-1, 0, 0],
    [0, 0, 1],
    [1, 0, 0],
    [0, 0, -1],
    [0, -1, 0],
  ];
  for (let face = 0; face < 6; face++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const a = 2 * i - (n - 1);
        const b = 2 * j - (n - 1);
        const c: Vec[] = [
          [b, n, a],
          [-n, -a, b],
          [b, -a, n],
          [n, -a, -b],
          [-b, -a, -n],
          [b, -n, -a],
        ];
        centers.push(c[face]);
        normals.push(N[face]);
      }
    }
  }
  return { centers, normals };
}

/** "3Rw'" -> face R, layers 1-3, turns -1 */
export function parseMove(name: string) {
  const m = /^(\d*)([UDLRFB])(w?)(['2]?)$/.exec(name);
  if (!m) throw new Error('unknown move ' + name);
  const number = m[1] ? parseInt(m[1], 10) : null;
  const layers: number[] = [];
  if (m[3] === 'w') for (let k = 1; k <= (number || 2); k++) layers.push(k);
  else layers.push(number || 1);
  const turns = m[4] === "'" ? -1 : m[4] === '2' ? 2 : 1;
  return { face: m[2] as Face, layers, turns };
}

export function inverse(name: string) {
  if (name.endsWith("'")) return name.slice(0, -1);
  if (name.endsWith('2')) return name;
  return name + "'";
}

/** Clockwise (looking at the face) is -90 degrees around its axis */
function rotate(v: Vec, axis: Vec, clockwise: boolean): Vec {
  const d = dot(axis, v);
  const c = cross(axis, v);
  const s = clockwise ? -1 : 1;
  return [d * axis[0] + s * c[0], d * axis[1] + s * c[1], d * axis[2] + s * c[2]];
}

export class CubeModel {
  readonly centers: Vec[];
  readonly normals: Vec[];
  private index: Map<string, number>;
  private cache = new Map<string, number[]>();

  constructor(readonly n: number) {
    const g = stickerGeometry(n);
    this.centers = g.centers;
    this.normals = g.normals;
    this.index = new Map(this.centers.map((c, i) => [c.join(','), i]));
  }

  solved() {
    return this.centers.map((_, i) => i);
  }

  /** Where the sticker's piece is along an axis */
  depth(p: number, axis: Vec) {
    const c = this.centers[p];
    const nr = this.normals[p];
    return (c[0] - nr[0]) * axis[0] + (c[1] - nr[1]) * axis[1] + (c[2] - nr[2]) * axis[2];
  }

  layerDepths(name: string) {
    return parseMove(name).layers.map((k) => this.n - 1 - 2 * (k - 1));
  }

  /** new_state[q] = state[perm[q]] */
  permutation(name: string) {
    const hit = this.cache.get(name);
    if (hit) return hit;
    const { face, turns } = parseMove(name);
    const axis = FACE_AXES[face];
    const targets = this.layerDepths(name);
    const perm = this.solved();
    for (let p = 0; p < this.centers.length; p++) {
      if (!targets.includes(this.depth(p, axis))) continue;
      let v = this.centers[p];
      for (let t = 0; t < Math.abs(turns); t++) v = rotate(v, axis, turns > 0);
      perm[this.index.get(v.join(','))!] = p;
    }
    this.cache.set(name, perm);
    return perm;
  }

  apply(state: number[], name: string) {
    return this.permutation(name).map((p) => state[p]);
  }

  colorAt(state: number[], p: number) {
    return Math.floor(state[p] / (this.n * this.n));
  }

  /** Every face one color, whichever way the cube is facing */
  isSolved(state: number[]) {
    const size = this.n * this.n;
    for (let f = 0; f < 6; f++) {
      const color = Math.floor(state[f * size] / size);
      for (let k = 1; k < size; k++) if (Math.floor(state[f * size + k] / size) !== color) return false;
    }
    return true;
  }

  /** Name of the move that turns one layer, counted from a face (layer n is the opposite face) */
  layerMoveName(face: Face, layer: number, clockwise: boolean) {
    if (layer === this.n) {
      face = OPPOSITE[face];
      layer = 1;
      clockwise = !clockwise;
    }
    return (layer === 1 ? '' : layer) + face + (clockwise ? '' : "'");
  }

  scramble(random: () => number, count = this.n === 2 ? 12 : this.n === 3 ? 25 : 20 + this.n * 5) {
    const moves: string[] = [];
    let last: Face | null = null;
    while (moves.length < count) {
      const face = FACES[Math.floor(random() * 6)];
      if (last && (face === last || face === OPPOSITE[last])) continue;
      const layer = 1 + Math.floor(random() * Math.max(1, Math.floor(this.n / 2)));
      const suffix = ['', "'", '2'][Math.floor(random() * 3)];
      moves.push((layer === 1 ? '' : layer) + face + suffix);
      last = face;
    }
    return moves;
  }
}

// ---------- talking to the 3x3 solver (cubejs, Kociemba's two-phase algorithm) ----------

const SOLVER_FACES: Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];
/** How each solver face is laid out when you look at it: [right, down] */
const FACE_VIEW: Record<Face, [Vec, Vec]> = {
  U: [
    [1, 0, 0],
    [0, 0, 1],
  ],
  R: [
    [0, 0, -1],
    [0, -1, 0],
  ],
  F: [
    [1, 0, 0],
    [0, -1, 0],
  ],
  D: [
    [1, 0, 0],
    [0, 0, -1],
  ],
  L: [
    [0, 0, 1],
    [0, -1, 0],
  ],
  B: [
    [-1, 0, 0],
    [0, -1, 0],
  ],
};
/** Face of each stored color (U L F R B D) and its opposite */
const COLOR_FACE: Face[] = ['U', 'L', 'F', 'R', 'B', 'D'];
const OPPOSITE_COLOR = [5, 3, 4, 1, 2, 0];

/** Index (0..53) of a sticker in the solver's facelet string */
function faceletIndex(normal: Vec, center: Vec) {
  const face = FACES.find((f) => dot(FACE_AXES[f], normal) === 1)!;
  const [right, down] = FACE_VIEW[face];
  const col = Math.sign(dot(center, right)) + 1;
  const row = Math.sign(dot(center, down)) + 1;
  return SOLVER_FACES.indexOf(face) * 9 + row * 3 + col;
}

/**
 * The cube as the solver's 54-letter facelet string, or null for sizes it can't solve.
 * A 2x2 is solved as the corners of a 3x3 whose edges and centers are already in place.
 */
export function toFacelets(model: CubeModel, state: number[]): string | null {
  const { n } = model;
  if (n !== 2 && n !== 3) return null;
  // Which face each color belongs to right now
  const letter: Face[] = Array(6);
  if (n === 3) {
    for (let p = 0; p < model.centers.length; p++) {
      const c = model.centers[p];
      if (c.filter((x) => x === 0).length === 2) letter[model.colorAt(state, p)] = FACES.find((f) => dot(FACE_AXES[f], model.normals[p]) === 1)!;
    }
  } else {
    // A 2x2 has no centers: the down-back-left corner never moves in the solver's moves, so it sets the colors
    for (let p = 0; p < model.centers.length; p++) {
      const piece = model.centers[p].map((x, i) => x - model.normals[p][i]);
      if (piece[0] < 0 && piece[1] < 0 && piece[2] < 0) {
        const face = FACES.find((f) => dot(FACE_AXES[f], model.normals[p]) === 1)!;
        const color = model.colorAt(state, p);
        letter[color] = face;
        letter[OPPOSITE_COLOR[color]] = OPPOSITE[face];
      }
    }
  }
  if (letter.some((x) => !x) || new Set(letter).size !== 6) return null;
  const out: string[] = Array(54);
  if (n === 2) for (let f = 0; f < 6; f++) for (let k = 0; k < 9; k++) out[f * 9 + k] = SOLVER_FACES[f];
  for (let p = 0; p < model.centers.length; p++) out[faceletIndex(model.normals[p], model.centers[p])] = letter[model.colorAt(state, p)];
  return out.join('');
}

/** For tests: the plain face letter each stored color has on a solved cube */
export const colorFace = (color: number) => COLOR_FACE[color];
