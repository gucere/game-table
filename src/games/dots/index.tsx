/**
 * Kutu Kapmaca (dots & boxes): take turns drawing a line between two dots.
 * Close the fourth side of a box to claim it and draw again. Most boxes wins.
 */
import type { BoardProps, BotCtx, GameDef, GameResult, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';

export interface DotsState {
  n: number;
  rows: number;
  cols: number;
  /** Horizontal edges first ((rows+1)·cols), then vertical (rows·(cols+1)); value = who drew it */
  edges: (Seat | null)[];
  boxes: (Seat | null)[];
  turn: Seat;
  last: number | null;
}
export type DotsMove = { edge: number };

export function setup(ctx: { numPlayers: number; options: Record<string, string> }): DotsState {
  const size = Number(ctx.options.size ?? 4);
  const rows = size;
  const cols = size;
  return { n: ctx.numPlayers, rows, cols, edges: Array((rows + 1) * cols + rows * (cols + 1)).fill(null), boxes: Array(rows * cols).fill(null), turn: 0, last: null };
}

const H = (s: Pick<DotsState, 'cols'>, r: number, c: number) => r * s.cols + c;
const V = (s: Pick<DotsState, 'rows' | 'cols'>, r: number, c: number) => (s.rows + 1) * s.cols + r * (s.cols + 1) + c;
export const sidesOf = (s: Pick<DotsState, 'rows' | 'cols'>, b: number) => {
  const r = Math.floor(b / s.cols);
  const c = b % s.cols;
  return [H(s, r, c), H(s, r + 1, c), V(s, r, c), V(s, r, c + 1)];
};
/** The boxes on either side of an edge */
function boxesOf(s: Pick<DotsState, 'rows' | 'cols'>, e: number): number[] {
  const out: number[] = [];
  const hCount = (s.rows + 1) * s.cols;
  if (e < hCount) {
    const r = Math.floor(e / s.cols);
    const c = e % s.cols;
    if (r > 0) out.push((r - 1) * s.cols + c);
    if (r < s.rows) out.push(r * s.cols + c);
  } else {
    const k = e - hCount;
    const r = Math.floor(k / (s.cols + 1));
    const c = k % (s.cols + 1);
    if (c > 0) out.push(r * s.cols + c - 1);
    if (c < s.cols) out.push(r * s.cols + c);
  }
  return out;
}

const drawn = (s: DotsState, b: number) => sidesOf(s, b).filter((e) => s.edges[e] !== null).length;

export function apply(s: DotsState, e: number): DotsState {
  const edges = s.edges.slice();
  edges[e] = s.turn;
  const next = { ...s, edges, boxes: s.boxes.slice(), last: e };
  let scored = false;
  for (const b of boxesOf(s, e)) {
    if (sidesOf(s, b).every((x) => edges[x] !== null)) {
      next.boxes[b] = s.turn;
      scored = true;
    }
  }
  return { ...next, turn: scored ? s.turn : (((s.turn + 1) % s.n) as Seat) };
}

export function move(s: DotsState, seat: Seat, m: DotsMove): DotsState | string {
  if (seat !== s.turn) return 'Not your turn';
  if (!Number.isInteger(m?.edge) || s.edges[m.edge] !== null || m.edge < 0 || m.edge >= s.edges.length) return 'Pick an empty line';
  return apply(s, m.edge);
}

const over = (s: DotsState) => s.boxes.every((b) => b !== null);
export const activePlayers = (s: DotsState): Seat[] => (over(s) ? [] : [s.turn]);
export function result(s: DotsState): GameResult | null {
  if (!over(s)) return null;
  const counts = Array.from({ length: s.n }, (_, i) => s.boxes.filter((b) => b === i).length);
  const best = Math.max(...counts);
  const winners = counts.flatMap((c, i) => (c === best ? [i] : []));
  return winners.length === s.n ? { winners: [], draw: true } : { winners };
}

/** How many boxes the next player could take in a row after this edge */
function giveaway(s: DotsState, e: number) {
  let t = apply(s, e);
  if (t.turn === s.turn) return -1; // we scored: great
  let n = 0;
  for (;;) {
    const grab = t.edges.findIndex((x, i) => x === null && boxesOf(t, i).some((b) => t.boxes[b] === null && drawn(t, b) === 3));
    if (grab < 0) break;
    t = apply(t, grab);
    n++;
  }
  return n;
}

export function bot(v: DotsState, _seat: Seat, ctx: BotCtx): DotsMove {
  const free = v.edges.flatMap((x, i) => (x === null ? [i] : []));
  // Take any box that's ready
  const take = free.find((e) => boxesOf(v, e).some((b) => drawn(v, b) === 3));
  if (take !== undefined && (ctx.level !== 'easy' || ctx.random() < 0.8)) return { edge: take };
  if (ctx.level === 'easy') return { edge: free[Math.floor(ctx.random() * free.length)] };
  // Safe lines don't make a third side anywhere
  const safe = free.filter((e) => boxesOf(v, e).every((b) => drawn(v, b) < 2));
  if (safe.length) return { edge: safe[Math.floor(ctx.random() * safe.length)] };
  // Otherwise give away as little as possible
  const scored = free.map((e) => ({ e, g: giveaway(v, e) })).sort((a, b) => a.g - b.g);
  return { edge: scored[0].e };
}

const GAP = 56;
function Board({ view: v, seat, players, canMove, onMove }: BoardProps<DotsState, DotsMove>) {
  const myTurn = canMove && v.turn === seat;
  const W = v.cols * GAP + 24;
  const Hh = v.rows * GAP + 24;
  const xy = (r: number, c: number) => [c * GAP + 12, r * GAP + 12];
  const counts = players.map((_, i) => v.boxes.filter((b) => b === i).length);
  const line = (e: number, x1: number, y1: number, x2: number, y2: number) => {
    const who = v.edges[e];
    return (
      <g key={e} className={'dx-edge' + (who === null && myTurn ? ' can' : '') + (v.last === e ? ' last' : '')} onClick={() => myTurn && who === null && onMove({ edge: e })}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} className="dx-hit" />
        <line x1={x1} y1={y1} x2={x2} y2={y2} className="dx-line" style={who !== null ? { stroke: `var(--p${who})` } : undefined} />
      </g>
    );
  };
  return (
    <div className="stack center">
      <div className="info-row">
        {players.map((p, i) => (
          <span key={i} className={'chip' + (v.turn === i ? ' trump-chip' : '')}>
            <span className="seat-dot" style={{ background: `var(--p${i})` }} /> {i === seat ? tx('You') : p.name}: {counts[i]}
          </span>
        ))}
      </div>
      <svg className="dx-board" viewBox={`0 0 ${W} ${Hh}`}>
        {v.boxes.map((b, i) => {
          if (b === null) return null;
          const [x, y] = xy(Math.floor(i / v.cols), i % v.cols);
          return <rect key={'b' + i} x={x + 3} y={y + 3} width={GAP - 6} height={GAP - 6} rx={6} style={{ fill: `var(--p${b})` }} className="dx-box" />;
        })}
        {Array.from({ length: (v.rows + 1) * v.cols }, (_, e) => {
          const r = Math.floor(e / v.cols);
          const c = e % v.cols;
          const [x1, y1] = xy(r, c);
          return line(e, x1, y1, x1 + GAP, y1);
        })}
        {Array.from({ length: v.rows * (v.cols + 1) }, (_, k) => {
          const r = Math.floor(k / (v.cols + 1));
          const c = k % (v.cols + 1);
          const [x1, y1] = xy(r, c);
          return line((v.rows + 1) * v.cols + k, x1, y1, x1, y1 + GAP);
        })}
        {Array.from({ length: (v.rows + 1) * (v.cols + 1) }, (_, k) => {
          const [x, y] = xy(Math.floor(k / (v.cols + 1)), k % (v.cols + 1));
          return <circle key={'d' + k} cx={x} cy={y} r={5} className="dx-dot" />;
        })}
      </svg>
      {myTurn && <p className="small muted">{tx('Tap a gap between two dots to draw a line.')}</p>}
    </div>
  );
}

export const dots: GameDef<DotsState, DotsMove, DotsState> = {
  id: 'noktalar',
  name: 'Kutu Kapmaca',
  tagline: 'Draw lines, close boxes, keep the chain going.',
  icon: '🔲',
  minPlayers: 2,
  maxPlayers: 4,
  hiddenInfo: false,
  options: [
    {
      id: 'size',
      label: 'Board',
      default: '4',
      choices: [
        { value: '3', label: '3 × 3 boxes' },
        { value: '4', label: '4 × 4 boxes' },
        { value: '5', label: '5 × 5 boxes' },
        { value: '6', label: '6 × 6 boxes' },
      ],
    },
  ],
  rules: 'Take turns drawing a line between two neighbouring dots. If your line closes the fourth side of a box, the box is yours and you draw again. When every box is taken, whoever has the most wins. Tip: avoid drawing the third side of a box.',
  setup,
  activePlayers,
  view: (s) => s,
  move: (s, seat, m) => move(s, seat, m),
  result,
  bot,
  botDelay: () => 500,
  Board,
};
