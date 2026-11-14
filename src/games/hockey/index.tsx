import { useEffect, useRef, useState } from 'react';
import type { BoardProps, GameDef, GameResult, PlayerInfo, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';
import * as S from './sim';

interface HockeyState {
  target: number;
  score: [number, number] | null;
}
type HockeyMove = { type: 'result'; score: [number, number] };

const cssVar = (name: string, fallback: string) => {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  } catch {
    return fallback;
  }
};

function draw(ctx: CanvasRenderingContext2D, r: S.Rink, colors: [string, string]) {
  const { W, H } = S;
  ctx.fillStyle = '#e8f6ff';
  ctx.fillRect(0, 0, W, H);
  // Rink markings
  ctx.strokeStyle = 'rgba(30, 90, 160, 0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 50, 0, Math.PI * 2);
  ctx.stroke();
  for (const [y, start, end] of [
    [0, 0, Math.PI],
    [H, Math.PI, Math.PI * 2],
  ] as const) {
    ctx.beginPath();
    ctx.arc(W / 2, y, S.GOAL_W / 2 + 10, start, end);
    ctx.stroke();
  }
  // Goals
  ctx.fillStyle = '#1b2b3d';
  ctx.fillRect(W / 2 - S.GOAL_W / 2, 0, S.GOAL_W, 6);
  ctx.fillRect(W / 2 - S.GOAL_W / 2, H - 6, S.GOAL_W, 6);
  // Score watermark
  ctx.fillStyle = 'rgba(30, 90, 160, 0.18)';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(r.score[1]), W / 2, H / 2 - 80);
  ctx.fillText(String(r.score[0]), W / 2, H / 2 + 120);
  // Mallets
  r.mallets.forEach((m, i) => {
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.arc(m.x, m.y, S.MALLET_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(m.x, m.y, S.MALLET_R * 0.45, 0, Math.PI * 2);
    ctx.fill();
  });
  // Puck
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(r.puck.x, r.puck.y, S.PUCK_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f2c14e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(r.puck.x, r.puck.y, S.PUCK_R - 4, 0, Math.PI * 2);
  ctx.stroke();
}

function Game({ target, players, onDone }: { target: number; players: PlayerInfo[]; onDone: (score: [number, number]) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rink = useRef(S.newRink());
  const pointers = useRef(new Map<number, 0 | 1>());
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const topBot = players[1]?.kind === 'bot' ? (players[1].level ?? 'normal') : null;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let finished = false;
    const colors: [string, string] = [cssVar('--p0', '#e63946'), cssVar('--p1', '#3a86ff')];
    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const r = rink.current;
      if (topBot) r.targets[1] = S.botTarget(r, topBot);
      let goal: 0 | 1 | null = null;
      for (let k = 0; k < 4; k++) goal = S.step(r, dt / 4) ?? goal;
      if (goal !== null) setScore([r.score[0], r.score[1]]);
      const ctx = ref.current?.getContext('2d');
      if (ctx) draw(ctx, r, colors);
      if (!finished && Math.max(...r.score) >= target) {
        finished = true;
        setTimeout(() => onDone([r.score[0], r.score[1]]), 900);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toRink = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - b.left) / b.width) * S.W, y: ((e.clientY - b.top) / b.height) * S.H };
  };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const p = toRink(e);
    // Each finger controls the mallet on its half (the top one only if it's a person)
    const side: 0 | 1 = p.y < S.H / 2 && !topBot ? 1 : 0;
    pointers.current.set(e.pointerId, side);
    rink.current.targets[side] = p;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* some browsers refuse capture for synthetic events */
    }
  };
  const onMoveP = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const side = pointers.current.get(e.pointerId) ?? (e.pointerType === 'mouse' ? 0 : undefined);
    if (side === undefined) return;
    rink.current.targets[side] = toRink(e);
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => pointers.current.delete(e.pointerId);

  return (
    <div className="stack-sm center">
      <div className="info-row">
        <span className="chip">
          <span className="seat-dot" style={{ background: 'var(--p1)' }} /> {players[1]?.name}: {score[1]}
        </span>
        <span className="chip">{tx('First to {n}', { n: target })}</span>
        <span className="chip">
          <span className="seat-dot" style={{ background: 'var(--p0)' }} /> {players[0]?.name}: {score[0]}
        </span>
      </div>
      <canvas
        ref={ref}
        width={S.W}
        height={S.H}
        className="hk-canvas"
        onPointerDown={onDown}
        onPointerMove={onMoveP}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        aria-label={tx('Air hockey table')}
      />
      <p className="small muted">{topBot ? tx('Drag your mallet in the bottom half. Score in the top goal.') : tx('Each player drags the mallet on their own half. Two fingers work at once.')}</p>
    </div>
  );
}

function Board({ view: v, players, canMove, onMove }: BoardProps<HockeyState, HockeyMove>) {
  if (v.score || !canMove) return <p className="center muted">{v.score ? `${players[0].name} ${v.score[0]} – ${v.score[1]} ${players[1].name}` : ''}</p>;
  return <Game target={v.target} players={players} onDone={(score) => onMove({ type: 'result', score })} />;
}

export const hockey: GameDef<HockeyState, HockeyMove, HockeyState> = {
  id: 'hava-hokeyi',
  name: 'Hava Hokeyi',
  tagline: 'Air hockey for two on one screen, or against a bot.',
  icon: '🏒',
  minPlayers: 2,
  maxPlayers: 2,
  hiddenInfo: false,
  localOnly: true,
  options: [
    {
      id: 'target',
      label: 'Play to',
      default: '7',
      choices: [
        { value: '5', label: '5 goals' },
        { value: '7', label: '7 goals' },
        { value: '10', label: '10 goals' },
      ],
    },
  ],
  rules:
    'Two players share one screen: the bottom half is one player’s, the top half the other’s. Drag your mallet to hit the puck into the other player’s goal; you can’t cross the middle line. Against a bot you play the bottom half. On a phone or tablet, two fingers work at the same time. First to the target wins.',
  setup: (ctx) => ({ target: Number(ctx.options.target ?? 7), score: null }),
  activePlayers: (s) => (s.score ? [] : [0]),
  view: (s) => s,
  move: (s, _seat: Seat, m) =>
    s.score ? 'Game over' : m?.type === 'result' && Array.isArray(m.score) && m.score.every((x) => Number.isInteger(x) && x >= 0) ? { ...s, score: [m.score[0], m.score[1]] } : 'Bad result',
  result: (s): GameResult | null => {
    if (!s.score) return null;
    if (s.score[0] === s.score[1]) return { winners: [], draw: true };
    return { winners: [s.score[0] > s.score[1] ? 0 : 1] };
  },
  // The bot plays inside the rink (see botTarget); this only lets you pick a bot opponent
  bot: () => ({ type: 'result', score: [0, 0] }),
  Board,
};
