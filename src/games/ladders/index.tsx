/** Yılan Merdiven (snakes & ladders) on our own board: climb ladders, slide down snakes, land exactly on 100. */
import type { BoardProps, GameDef, GameResult, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';

export const LADDERS: Record<number, number> = { 3: 22, 8: 30, 19: 38, 27: 56, 36: 44, 50: 67, 63: 81, 71: 92, 80: 99 };
export const SNAKES: Record<number, number> = { 17: 4, 33: 12, 48: 26, 59: 40, 66: 47, 76: 55, 89: 68, 95: 74, 98: 79 };

export interface LadderState {
  n: number;
  pos: number[];
  turn: Seat;
  last: { seat: Seat; roll: number; from: number; to: number; via: 'ladder' | 'snake' | 'bounce' | null } | null;
  winner: Seat | null;
}
export type LadderMove = { type: 'roll' };

export function setup(ctx: { numPlayers: number; random: () => number }): LadderState {
  return { n: ctx.numPlayers, pos: Array(ctx.numPlayers).fill(0), turn: 0, last: null, winner: null };
}

export function move(s: LadderState, seat: Seat, m: LadderMove, ctx: { random: () => number }): LadderState | string {
  if (s.winner !== null) return 'The game is over';
  if (seat !== s.turn) return 'Not your turn';
  if (m?.type !== 'roll') return 'Roll the dice';
  const roll = 1 + Math.floor(ctx.random() * 6);
  const from = s.pos[seat];
  let to = from + roll;
  let via: 'ladder' | 'snake' | 'bounce' | null = null;
  // Overshooting 100 bounces back
  if (to > 100) {
    to = 200 - to;
    via = 'bounce';
  }
  if (LADDERS[to]) {
    to = LADDERS[to];
    via = 'ladder';
  } else if (SNAKES[to]) {
    to = SNAKES[to];
    via = 'snake';
  }
  const pos = s.pos.slice();
  pos[seat] = to;
  const winner = to === 100 ? seat : null;
  // A six rolls again
  const turn = winner !== null || roll === 6 ? seat : (((seat + 1) % s.n) as Seat);
  return { ...s, pos, turn, winner, last: { seat, roll, from, to, via } };
}

export const activePlayers = (s: LadderState): Seat[] => (s.winner === null ? [s.turn] : []);
export const result = (s: LadderState): GameResult | null => (s.winner === null ? null : { winners: [s.winner] });

/** Square number → grid position (row 0 at the top), snaking back and forth */
export function cell(sq: number): [number, number] {
  const i = sq - 1;
  const row = Math.floor(i / 10);
  const col = row % 2 === 0 ? i % 10 : 9 - (i % 10);
  return [col, 9 - row];
}

const DICE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const S = 40;
const center = (sq: number) => {
  const [c, r] = cell(sq);
  return [c * S + S / 2, r * S + S / 2];
};

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<LadderState, LadderMove>) {
  const myTurn = canMove && v.turn === seat;
  const l = v.last;
  return (
    <div className="stack center">
      <svg className="ld-board" viewBox={`0 0 ${10 * S} ${10 * S}`}>
        {Array.from({ length: 100 }, (_, k) => {
          const sq = k + 1;
          const [c, r] = cell(sq);
          return (
            <g key={sq}>
              <rect x={c * S} y={r * S} width={S} height={S} className={'ld-sq ' + ((c + r) % 2 ? 'a' : 'b')} />
              <text x={c * S + 3} y={r * S + 11} className="ld-num">
                {sq}
              </text>
            </g>
          );
        })}
        {Object.entries(LADDERS).map(([a, b]) => {
          const [x1, y1] = center(+a);
          const [x2, y2] = center(+b);
          const dx = (y2 - y1) / Math.hypot(x2 - x1, y2 - y1) * 6;
          const dy = -(x2 - x1) / Math.hypot(x2 - x1, y2 - y1) * 6;
          const rungs = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / 14));
          return (
            <g key={'l' + a} className="ld-ladder">
              <line x1={x1 + dx} y1={y1 + dy} x2={x2 + dx} y2={y2 + dy} />
              <line x1={x1 - dx} y1={y1 - dy} x2={x2 - dx} y2={y2 - dy} />
              {Array.from({ length: rungs }, (_, k) => {
                const t = (k + 0.5) / rungs;
                const x = x1 + (x2 - x1) * t;
                const y = y1 + (y2 - y1) * t;
                return <line key={k} x1={x + dx} y1={y + dy} x2={x - dx} y2={y - dy} />;
              })}
            </g>
          );
        })}
        {Object.entries(SNAKES).map(([a, b]) => {
          const [x1, y1] = center(+a);
          const [x2, y2] = center(+b);
          const mx = (x1 + x2) / 2 + (y2 - y1) * 0.25;
          const my = (y1 + y2) / 2 - (x2 - x1) * 0.25;
          return (
            <g key={'s' + a} className="ld-snake">
              <path d={`M${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`} />
              <circle cx={x1} cy={y1} r={6} />
            </g>
          );
        })}
        {v.pos.map((p, i) => {
          if (p === 0) return null;
          const [x, y] = center(p);
          const off = (i % 3) * 8 - 8;
          return <circle key={i} cx={x + off} cy={y + (i >= 3 ? 8 : -2)} r={9} className="ld-token" style={{ fill: `var(--p${i})` }} />;
        })}
      </svg>
      <div className="info-row">
        {players.map((p, i) => (
          <span key={i} className={'chip' + (v.turn === i && v.winner === null ? ' trump-chip' : '')}>
            <span className="seat-dot" style={{ background: `var(--p${i})` }} /> {i === seat ? tx('You') : p.name}: {v.pos[i] || tx('start')}
          </span>
        ))}
      </div>
      <div className="row center-row">
        <span className="kz-dice">{l ? DICE[l.roll] : '🎲'}</span>
        {myTurn && (
          <button className="btn primary" onClick={() => onMove({ type: 'roll' })} autoFocus>
            {tx('Roll')}
          </button>
        )}
      </div>
      {l && (
        <p className="small">
          {tx('{name} rolled {roll}: {from} → {to}', { name: l.seat === seat ? tx('You') : players[l.seat].name, roll: l.roll, from: l.from, to: l.to })}
          {l.via === 'ladder' ? ' 🪜' : l.via === 'snake' ? ' 🐍' : l.via === 'bounce' ? ' ↩' : ''}
        </p>
      )}
    </div>
  );
}

export const ladders: GameDef<LadderState, LadderMove, LadderState> = {
  id: 'yilan-merdiven',
  name: 'Yılan Merdiven',
  tagline: 'Climb the ladders, dodge the snakes, first to 100.',
  icon: '🪜',
  minPlayers: 1,
  maxPlayers: 6,
  defaultPlayers: 4,
  hiddenInfo: false,
  rules: 'Take turns rolling the dice and moving your token. Land at the foot of a ladder to climb it; land on a snake’s head to slide down to its tail. A six rolls again. You must land exactly on 100: rolling too high bounces you back by the extra.',
  setup,
  activePlayers,
  view: (s) => s,
  move: (s, seat, m, ctx) => move(s, seat, m, ctx),
  result,
  bot: () => ({ type: 'roll' }),
  botDelay: () => 700,
  Board,
};
