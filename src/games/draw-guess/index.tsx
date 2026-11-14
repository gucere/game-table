import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import * as L from './logic';
import { t as tx } from '../../i18n';

const PALETTE = ['#111111', '#ffffff', '#e63946', '#f4a261', '#ffd23f', '#2a9d8f', '#3a86ff', '#8338ec', '#ff70a6', '#8d6e63'];
const SIZES = [4, 10, 24];
const SEND_EVERY_MS = 120;

function drawStroke(ctx: CanvasRenderingContext2D, st: L.Stroke) {
  const p = st.pts;
  ctx.strokeStyle = st.color;
  ctx.fillStyle = st.color;
  ctx.lineWidth = st.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (p.length === 2) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], st.size / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
  ctx.stroke();
}

function Canvas({ strokes, canDraw, onStroke, color, size }: { strokes: L.Stroke[]; canDraw: boolean; onStroke: (s: L.Stroke) => void; color: string; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cur = useRef<number[] | null>(null);
  const lastSent = useRef(0);
  // Strokes sent but not yet echoed back from the host, so drawing feels instant
  const pending = useRef<L.Stroke[]>([]);

  const redraw = () => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, L.CANVAS_W, L.CANVAS_H);
    for (const st of strokes) drawStroke(ctx, st);
    for (const st of pending.current) drawStroke(ctx, st);
    if (cur.current && cur.current.length >= 2) drawStroke(ctx, { color, size, pts: cur.current });
  };

  useEffect(() => {
    pending.current = [];
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

  const toCanvas = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * L.CANVAS_W), Math.round(((e.clientY - r.top) / r.height) * L.CANVAS_H)];
  };

  const flush = (final: boolean) => {
    const pts = cur.current;
    if (!pts || pts.length < 2) return;
    if (!final && pts.length < 4) return;
    const st = { color, size, pts: pts.slice() };
    pending.current.push(st);
    onStroke(st);
    lastSent.current = Date.now();
    // Continue the line from the last point
    cur.current = final ? null : pts.slice(-2);
  };

  return (
    <canvas
      ref={ref}
      width={L.CANVAS_W}
      height={L.CANVAS_H}
      className={'dg-canvas' + (canDraw ? ' can-draw' : '')}
      onPointerDown={(e) => {
        if (!canDraw) return;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* some pointers can't be captured; drawing still works */
        }
        cur.current = toCanvas(e);
        redraw();
      }}
      onPointerMove={(e) => {
        if (!canDraw || !cur.current) return;
        cur.current.push(...toCanvas(e));
        redraw();
        if (Date.now() - lastSent.current > SEND_EVERY_MS) flush(false);
      }}
      onPointerUp={() => flush(true)}
      onPointerCancel={() => flush(true)}
    />
  );
}

function Countdown({ deadline, offset }: { deadline: number; offset: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.ceil((deadline + offset - now) / 1000));
  return <span className={'chip' + (secs <= 10 ? ' urgent' : '')}>{tx('⏱ {secs}s', { secs: secs })}</span>;
}

function Board({ view: v, seat, players, onMove, clockOffset }: BoardProps<L.DGView, L.DGMove>) {
  const [color, setColor] = useState(PALETTE[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [guess, setGuess] = useState('');
  const chatEnd = useRef<HTMLDivElement>(null);
  const drawing = seat === v.drawer;
  const iKnow = drawing || v.guessed.includes(seat);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [v.chat.length]);

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!guess.trim()) return;
    onMove({ type: 'guess', text: guess });
    setGuess('');
  };

  return (
    <div className="dg">
      <div className="info-row">
        <span className="chip">{tx('Turn {v} / {totalTurns}', { v: Math.min(v.turnNo + 1, v.totalTurns), totalTurns: v.totalTurns })}
        </span>
        {v.phase !== 'done' && <Countdown deadline={v.deadline} offset={clockOffset} />}
        <span className="chip">{drawing ? tx('You are drawing') : tx('{name} is drawing', { name: players[v.drawer].name })}</span>
      </div>

      <div className="dg-word">
        {v.phase === 'choose' ? (drawing ? tx('Pick a word to draw') : tx('{name} is picking a word…', { name: players[v.drawer].name })) : v.word ? v.word : v.hint}
      </div>

      {drawing && v.phase === 'choose' && (
        <div className="action-bar">
          {v.choices.map((w, i) => (
            <button key={w} className="btn primary" onClick={() => onMove({ type: 'choose', i })}>
              {w}
            </button>
          ))}
        </div>
      )}

      <div className="dg-main">
        <div className="dg-canvas-wrap">
          <Canvas strokes={v.strokes} canDraw={drawing && v.phase === 'draw'} onStroke={(stroke) => onMove({ type: 'stroke', stroke })} color={color} size={size} />
          {drawing && v.phase === 'draw' && (
            <div className="dg-tools">
              {PALETTE.map((c) => (
                <button key={c} className={'dg-color' + (c === color ? ' on' : '')} style={{ background: c }} onClick={() => setColor(c)} aria-label={tx('Colour {c}', { c: c })} />
              ))}
              {SIZES.map((sz) => (
                <button key={sz} className={'dg-size' + (sz === size ? ' on' : '')} onClick={() => setSize(sz)} aria-label={tx('Brush {sz}', { sz: sz })}>
                  <span style={{ width: Math.min(22, sz), height: Math.min(22, sz) }} />
                </button>
              ))}
              <button className="btn small" onClick={() => onMove({ type: 'undo' })}>{tx('↶ Undo')}</button>
              <button className="btn small ghost" onClick={() => onMove({ type: 'clear' })}>{tx('Clear')}</button>
            </div>
          )}
        </div>

        <div className="dg-side">
          <div className="dg-scores">
            {players.map((p, i) => (
              <div key={i} className={'dg-score' + (v.guessed.includes(i) ? ' got' : '') + (i === v.drawer ? ' drawer' : '')}>
                <span className="seat-dot" style={{ background: `var(--p${i})` }} />
                <span className="grow">
                  {p.name}
                  {i === v.drawer ? ' ✏️' : v.guessed.includes(i) ? ' ✓' : ''}
                </span>
                <b>{v.scores[i]}</b>
                {v.gained[i] > 0 && <span className="small good-text">+{v.gained[i]}</span>}
              </div>
            ))}
          </div>
          <div className="dg-chat" aria-live="polite">
            {v.chat.map((c, i) => (
              <div key={i} className={'dg-line ' + c.kind}>
                {c.kind !== 'system' && <b style={{ color: `var(--p${c.seat})` }}>{c.seat === seat ? tx('You') : players[c.seat].name}: </b>}
                {c.text}
              </div>
            ))}
            <div ref={chatEnd} />
          </div>
          {!iKnow && v.phase === 'draw' && (
            <form className="row" onSubmit={send}>
              <input className="input grow" value={guess} maxLength={60} placeholder={tx('Type your guess…')} onChange={(e) => setGuess(e.target.value)} autoComplete="off" />
              <button className="btn primary" type="submit">{tx('Guess')}</button>
            </form>
          )}
          {iKnow && !drawing && v.phase === 'draw' && <p className="small center">{tx('You got it! Waiting for the others…')}</p>}
        </div>
      </div>
    </div>
  );
}

export const drawGuess: GameDef<L.DGState, L.DGMove, L.DGView> = {
  id: 'draw-guess',
  name: 'Draw & Guess',
  tagline: 'One draws, everyone guesses. Online party game.',
  icon: '🎨',
  minPlayers: 2,
  maxPlayers: 8,
  hiddenInfo: true,
  onlineOnly: true,
  options: [
    {
      id: 'lang',
      label: 'Words',
      default: 'tr',
      choices: [
        { value: 'tr', label: 'Türkçe' },
        { value: 'en', label: 'English' },
      ],
    },
    {
      id: 'time',
      label: 'Drawing time',
      default: '80',
      choices: [
        { value: '60', label: '60 seconds' },
        { value: '80', label: '80 seconds' },
        { value: '120', label: '120 seconds' },
      ],
    },
    {
      id: 'rounds',
      label: 'Rounds',
      default: '1',
      choices: [
        { value: '1', label: 'Everyone draws once' },
        { value: '2', label: 'Everyone draws twice' },
        { value: '3', label: 'Everyone draws 3 times' },
      ],
    },
  ],
  rules:
    'Each turn one player picks a word and draws it. Everyone else types guesses; typing without Turkish letters is fine (kopek = köpek). Faster correct guesses score more, and the drawer earns points for every player who gets it. No letters or numbers in the drawing!',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  timer: (s) => (s.phase === 'done' ? null : s.deadline),
  onTimer: L.onTimer,
  Board,
};
