import { Suspense, lazy } from 'react';
import type { BoardProps, GameDef, GameResult, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';
import type { CubeResult } from './CubeBoard';

// three.js is big: load it only when someone opens the cube
const CubeBoard = lazy(() => import('./CubeBoard'));

interface CubeState {
  n: number;
  result: CubeResult | null;
}
type CubeMove = { type: 'solved' } & CubeResult;

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
};

function Board({ view: v, canMove, onMove }: BoardProps<CubeState, CubeMove>) {
  if (v.result) {
    return (
      <div className="stack-sm center">
        <p className="big">🎉</p>
        <p>
          {v.result.solver
            ? v.result.moves === 0
              ? tx('The solver solved it for you.')
              : tx('Solved with the solver’s help ({moves} moves of your own).', { moves: v.result.moves })
            : tx('Solved in {time} with {moves} moves!', { time: fmt(v.result.ms), moves: v.result.moves })}
        </p>
      </div>
    );
  }
  if (!canMove) return null;
  return (
    <Suspense fallback={<p className="center muted">{tx('Loading the cube…')}</p>}>
      <CubeBoard n={v.n} onSolved={(r) => onMove({ type: 'solved', ...r })} />
    </Suspense>
  );
}

export const cube: GameDef<CubeState, CubeMove, CubeState> = {
  id: 'zeka-kupu',
  name: 'Zeka Küpü',
  tagline: 'The classic twisty puzzle cube, from 2×2 to 7×7, with a solver.',
  icon: '🧊',
  minPlayers: 1,
  maxPlayers: 1,
  hiddenInfo: false,
  localOnly: true,
  options: [
    {
      id: 'size',
      label: 'Size',
      default: '3',
      choices: [
        { value: '2', label: '2×2' },
        { value: '3', label: '3×3' },
        { value: '4', label: '4×4' },
        { value: '5', label: '5×5' },
        { value: '6', label: '6×6' },
        { value: '7', label: '7×7' },
      ],
    },
  ],
  rules:
    'The cube starts scrambled. Turn its layers until every face is a single color. Drag a sticker to turn its layer (the middle layers too), and drag the background to look around. On a keyboard, U D L R F B turn the faces; hold Shift to turn the other way. The clock starts with your first move. Stuck on a 2×2 or 3×3? "Solve it for me" finds a solution with Kociemba’s two-phase algorithm and plays it for you. Ported from the site author’s own cube solver.',
  setup: (ctx) => ({ n: Math.max(2, Math.min(7, Number(ctx.options.size ?? 3))), result: null }),
  activePlayers: (s) => (s.result ? [] : [0]),
  view: (s) => s,
  move: (s, _seat: Seat, m) => {
    if (s.result) return 'Already solved';
    if (m?.type !== 'solved' || !Number.isFinite(m.ms) || !Number.isFinite(m.moves)) return 'Bad move';
    return { ...s, result: { ms: m.ms, moves: m.moves, solver: !!m.solver } };
  },
  result: (s): GameResult | null => (s.result ? { winners: [0] } : null),
  Board,
};
