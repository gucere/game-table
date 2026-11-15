import { useEffect, useRef, useState } from 'react';
import type { BoardProps, GameDef, PlayerInfo } from '../../engine/types';
import { t as tx } from '../../i18n';
import { Canvas, PALETTE, SIZES } from '../draw-guess';
import * as L from './logic';

function Countdown({ deadline, offset }: { deadline: number; offset: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);
  const secs = Math.max(0, Math.ceil((deadline + offset - Date.now()) / 1000));
  return <span className={'chip' + (secs <= 10 ? ' urgent' : '')}>⏱ {secs}</span>;
}

/** A finished drawing, read-only */
function Picture({ strokes }: { strokes: L.Stroke[] }) {
  return (
    <div className="dg-canvas-wrap tp-picture">
      <Canvas strokes={strokes} canDraw={false} onStroke={() => {}} color="#111111" size={4} />
    </div>
  );
}

function Draw({ text, onDone }: { text: string; onDone: (strokes: L.Stroke[]) => void }) {
  const [strokes, setStrokes] = useState<L.Stroke[]>([]);
  const [color, setColor] = useState(PALETTE[0]);
  const [size, setSize] = useState(SIZES[1]);
  // Where each pen-down started, so Undo takes back a whole line
  const marks = useRef<number[]>([]);
  return (
    <div className="stack-sm">
      <p className="tp-prompt">
        {tx('Draw this:')} <strong>{text}</strong>
      </p>
      <div className="dg-canvas-wrap" onPointerDownCapture={() => marks.current.push(strokes.length)}>
        <Canvas strokes={strokes} canDraw onStroke={(st) => setStrokes((x) => [...x, st])} color={color} size={size} />
      </div>
      <div className="dg-tools">
        {PALETTE.map((c) => (
          <button key={c} className={'dg-color' + (c === color ? ' on' : '')} style={{ background: c }} onClick={() => setColor(c)} aria-label={tx('Color {c}', { c })} />
        ))}
        {SIZES.map((sz) => (
          <button key={sz} className={'dg-size' + (sz === size ? ' on' : '')} onClick={() => setSize(sz)} aria-label={tx('Brush {sz}', { sz })}>
            <span style={{ width: sz / 2 + 4, height: sz / 2 + 4 }} />
          </button>
        ))}
        <button className="btn small" disabled={!strokes.length} onClick={() => setStrokes((x) => x.slice(0, marks.current.pop() ?? 0))}>
          {tx('↶ Undo')}
        </button>
        <button
          className="btn small ghost"
          onClick={() => {
            marks.current = [];
            setStrokes([]);
          }}
        >
          {tx('Clear')}
        </button>
      </div>
      <button className="btn primary" onClick={() => onDone(strokes)}>
        {tx('Done, pass it on')}
      </button>
    </div>
  );
}

function Write({ v, onDone }: { v: L.PhoneView; onDone: (text: string) => void }) {
  const [text, setText] = useState('');
  const guess = v.kind === 'guess';
  return (
    <form
      className="stack-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onDone(text);
      }}
    >
      {guess ? (
        <>
          <p className="tp-prompt">{tx('What is this a drawing of?')}</p>
          <Picture strokes={v.prompt?.strokes ?? []} />
        </>
      ) : (
        <p className="tp-prompt">{tx('Write something for the next player to draw: a person, an animal, a funny scene…')}</p>
      )}
      <div className="row">
        <input className="input grow" value={text} maxLength={L.MAX_TEXT} autoFocus placeholder={guess ? tx('Your guess') : tx('Your phrase')} onChange={(e) => setText(e.target.value)} />
        {!guess && (
          <button type="button" className="btn small" onClick={() => setText(L.IDEAS[v.lang][Math.floor(Math.random() * L.IDEAS[v.lang].length)])}>
            💡 {tx('Give me an idea')}
          </button>
        )}
      </div>
      <button className="btn primary" type="submit" disabled={!text.trim()}>
        {tx('Done, pass it on')}
      </button>
    </form>
  );
}

function Reveal({ v, players, onNext }: { v: L.PhoneView; players: PlayerInfo[]; onNext: () => void }) {
  const show = v.show!;
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // (Newer browsers return a promise from scrollIntoView: it must not become the effect's cleanup)
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [show.upto, show.chain]);
  const lastOfChain = show.upto + 1 >= v.n;
  const lastChain = show.chain + 1 >= v.n;
  return (
    <div className="stack-sm">
      <h3 className="center">{tx('{name}’s chain', { name: players[show.chain]?.name ?? '' })}</h3>
      {show.entries.map((e, i) => (
        <div key={i} className="tp-entry">
          <span className="small muted">
            {e.strokes ? tx('{name} drew:', { name: players[e.by]?.name ?? '' }) : i === 0 ? tx('{name} wrote:', { name: players[e.by]?.name ?? '' }) : tx('{name} guessed:', { name: players[e.by]?.name ?? '' })}
          </span>
          {e.strokes ? <Picture strokes={e.strokes} /> : <p className="tp-text">{e.text}</p>}
        </div>
      ))}
      <div ref={end} />
      <button className="btn primary" onClick={onNext}>
        {!lastOfChain ? tx('Show the next step') : !lastChain ? tx('Next chain →') : tx('Finish')}
      </button>
    </div>
  );
}

function Board({ view: v, players, onMove, clockOffset }: BoardProps<L.PhoneView, L.PhoneMove>) {
  if (v.phase === 'done') return <p className="center">{tx('That’s every chain. Play again for new ones!')}</p>;
  if (v.phase === 'reveal') return <Reveal v={v} players={players} onNext={() => onMove({ type: 'next' })} />;
  const label = v.kind === 'write' ? tx('Write') : v.kind === 'draw' ? tx('Draw') : tx('Guess');
  return (
    <div className="stack-sm tp">
      <div className="info-row">
        <span className="chip">{tx('Step {i} of {n}: {what}', { i: v.step + 1, n: v.n, what: label })}</span>
        <Countdown deadline={v.deadline} offset={clockOffset} />
        <span className="chip">{tx('{done}/{n} ready', { done: v.doneCount, n: v.n })}</span>
      </div>
      {v.mineDone ? (
        <p className="center muted">{tx('Passed on! Waiting for the others…')}</p>
      ) : v.kind === 'draw' ? (
        <Draw key={v.step} text={v.prompt?.text ?? '…'} onDone={(strokes) => onMove({ type: 'draw', strokes })} />
      ) : (
        <Write key={v.step} v={v} onDone={(text) => onMove({ type: 'text', text })} />
      )}
    </div>
  );
}

export const telephone: GameDef<L.PhoneState, L.PhoneMove, L.PhoneView> = {
  id: 'kulaktan-kulaga-cizim',
  name: 'Kulaktan Kulağa Çizim',
  tagline: 'Write, draw, guess, draw again… and see how far it drifts.',
  icon: '🖍️',
  minPlayers: 3,
  maxPlayers: 10,
  defaultPlayers: 4,
  hiddenInfo: true,
  onlineOnly: true,
  noTurnTimer: true,
  options: [
    {
      id: 'lang',
      label: 'Language',
      default: 'tr',
      choices: [
        { value: 'tr', label: 'Türkçe' },
        { value: 'en', label: 'English' },
      ],
    },
    {
      id: 'time',
      label: 'Time to draw',
      default: '90',
      choices: [
        { value: '60', label: '1 minute' },
        { value: '90', label: '1.5 minutes' },
        { value: '120', label: '2 minutes' },
      ],
    },
  ],
  rules:
    'Everyone writes a phrase at the same time. Then each phrase moves to the next player, who draws it. The drawing moves on to the next player, who writes what they think it shows, without seeing the original. The next player draws that guess, and so on, until every chain has passed through everyone. Nobody wins: at the end, each chain is shown step by step, from the first phrase to where it ended up. If time runs out, an empty page is passed on.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: L.view,
  isPrivate: (v) => v.phase === 'play',
  move: L.move,
  result: L.result,
  timer: (s) => (s.phase === 'play' ? s.deadline : null),
  onTimer: L.onTimer,
  canSubmitOutsideTurn: (_s, _seat, m) => m?.type === 'next',
  Board,
};
