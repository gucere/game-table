import { useEffect, useState } from 'react';
import type { BoardProps, GameDef, Seat } from '../../engine/types';
import * as L from './logic';
import { t as tx } from '../../i18n';

const PIPS: Record<number, number[][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

function Die({ n, used }: { n: number; used?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={'die' + (used ? ' used' : '')} aria-label={tx('Die {n}', { n: n })}>
      <rect x="4" y="4" width="92" height="92" rx="18" fill="#fffdf6" stroke="rgba(0,0,0,.3)" strokeWidth="3" />
      {PIPS[n].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="9" fill="#222" />
      ))}
    </svg>
  );
}

function Checkers({ count, seat, top, highlight }: { count: number; seat: Seat; top: boolean; highlight?: boolean }) {
  if (!count) return null;
  const shown = Math.min(count, 5);
  return (
    <div className={'bg-stack' + (top ? ' top' : ' bottom')}>
      {Array.from({ length: shown }, (_, k) => (
        <span key={k} className={'checker' + (highlight && k === shown - 1 ? ' hl' : '')} style={{ background: `var(--p${seat})` }}>
          {k === shown - 1 && count > 5 ? count : ''}
        </span>
      ))}
    </div>
  );
}

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.BgState, L.BgMove>) {
  const me = seat as Seat;
  const them = (1 - me) as Seat;
  const [sel, setSel] = useState<L.From | null>(null);
  const myTurn = canMove && v.turn === me;
  const steps = myTurn && v.phase === 'move' ? L.legalSteps(v, me, v.dice) : [];
  const sources = new Set(steps.map((s) => s.from));
  const dests = sel === null ? [] : steps.filter((s) => s.from === sel);

  // Must enter from the bar first: select it automatically
  useEffect(() => {
    if (sources.has('bar')) setSel('bar');
    else if (sel !== null && !sources.has(sel)) setSel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.dice.length, v.turn, v.phase, v.board.join(',')]);

  const clickPoint = (i: L.From | 'off') => {
    if (!myTurn) return;
    const d = dests.find((s) => s.to === i);
    if (d) {
      onMove({ type: 'step', from: d.from, die: d.die });
      setSel(null);
      return;
    }
    if (i === 'bar' && sources.has('bar')) setSel('bar');
    else if (i !== 'off' && sources.has(i)) setSel(sel === i ? null : i);
    else setSel(null);
  };

  const top = me === 0 ? [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] : [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
  const bottom = me === 0 ? [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0] : [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

  const point = (i: number, isTop: boolean, col: number) => {
    const n0 = L.own(v, i, 0);
    const n1 = L.own(v, i, 1);
    const isDest = dests.some((d) => d.to === i);
    const isSrc = sources.has(i);
    // Numbered along this player's own path (Gul Bara paths differ from Tavla's)
    const pointNo = 24 - L.progress(v, me, i);
    return (
      <button
        key={i}
        className={'bg-point' + (isTop ? ' top' : ' bottom') + (col % 2 ? ' odd' : ' even') + (isDest ? ' dest' : '') + (sel === i ? ' sel' : '')}
        style={{ gridColumn: col < 6 ? col + 1 : col + 2, gridRow: isTop ? 1 : 3 }}
        onClick={() => clickPoint(i)}
        aria-label={tx('Point {pointNo}: {v}{v2}', { pointNo: pointNo, v: n0 ? `${n0} ${players[0].name}` : '', v2: n1 ? `${n1} ${players[1].name}` : '' })}
      >
        <span className="bg-num">{pointNo}</span>
        {v.pinned?.[i] != null && (
          <span className={'bg-pinned ' + (isTop ? 'top' : 'bottom')} style={{ background: `var(--p${v.pinned[i]})` }} title={tx('Trapped')}>
            ⛓
          </span>
        )}
        <Checkers count={n0 || n1} seat={n0 ? 0 : 1} top={isTop} highlight={isSrc && myTurn} />
      </button>
    );
  };

  const offDest = dests.some((d) => d.to === 'off');
  const remaining = v.dice.slice();
  const diceShown = v.rolled.length === 2 && v.rolled[0] === v.rolled[1] ? [v.rolled[0], v.rolled[0], v.rolled[0], v.rolled[0]] : v.rolled;
  const usedFlags = diceShown.map((d) => {
    const k = remaining.indexOf(d);
    if (k >= 0) {
      remaining.splice(k, 1);
      return false;
    }
    return true;
  });

  return (
    <div className="bg-wrap">
      <div className="info-row">
        {v.target > 1 && (
          <span className="chip">{tx('Match to {target}: {name} {score} – {score2} {name2}', { target: v.target, name: players[0].name, score: v.score[0], score2: v.score[1], name2: players[1].name })}
          </span>
        )}
        <span className="chip">{tx('Pips: you')}{' '}{L.pips(v, me)} · {players[them].name} {L.pips(v, them)}
        </span>
      </div>
      <div className="bg-board">
        {top.map((i, c) => point(i, true, c))}
        <div className="bg-bar" style={{ gridColumn: 7, gridRow: '1 / 4' }}>
          <Checkers count={v.bar[them]} seat={them} top />
          <span className="grow" />
          <button className={'bg-bar-btn' + (sel === 'bar' ? ' sel' : '')} onClick={() => clickPoint('bar')} aria-label={tx('Your bar: {bar}', { bar: v.bar[me] })}>
            <Checkers count={v.bar[me]} seat={me} top={false} highlight={sources.has('bar')} />
          </button>
        </div>
        <div className="bg-mid" style={{ gridColumn: '1 / 14', gridRow: 2 }}>
          {diceShown.length > 0 && (
            <div className="dice">
              {diceShown.map((d, k) => (
                <Die key={k} n={d} used={usedFlags[k] || v.phase === 'roll'} />
              ))}
            </div>
          )}
          {v.notice && <span className="small">{v.notice}</span>}
        </div>
        <div className="bg-off" style={{ gridColumn: 14, gridRow: '1 / 4' }}>
          <div className="bg-off-tray" aria-label={tx('{name} borne off: {off}', { name: players[them].name, off: v.off[them] })}>
            {Array.from({ length: v.off[them] }, (_, k) => (
              <span key={k} className="off-chip" style={{ background: `var(--p${them})` }} />
            ))}
          </div>
          <button className={'bg-off-tray mine' + (offDest ? ' dest' : '')} onClick={() => clickPoint('off')} aria-label={tx('Bear off ({off} off)', { off: v.off[me] })}>
            {Array.from({ length: v.off[me] }, (_, k) => (
              <span key={k} className="off-chip" style={{ background: `var(--p${me})` }} />
            ))}
          </button>
        </div>
        {bottom.map((i, c) => point(i, false, c))}
      </div>
      <div className="action-bar">
        {myTurn && v.phase === 'roll' && (
          <button className="btn primary" onClick={() => onMove({ type: 'roll' })}>{tx('🎲 Roll')}</button>
        )}
        {myTurn && v.phase === 'move' && (
          <>
            <span className="muted small center">{sel === null ? tx('Pick a checker to move.') : tx('Pick where it goes (highlighted).')}</span>
            <button className="btn small" onClick={() => onMove({ type: 'undo' })}>{tx('↶ Undo')}</button>
          </>
        )}
      </div>
    </div>
  );
}

export const backgammon: GameDef<L.BgState, L.BgMove, L.BgState> = {
  id: 'backgammon',
  name: 'Backgammon (Tavla)',
  tagline: 'Race your 15 checkers home and bear them off.',
  icon: '🎲',
  minPlayers: 2,
  maxPlayers: 2,
  hiddenInfo: false,
  options: [
    {
      id: 'match',
      label: 'Match length',
      default: '1',
      choices: [
        { value: '1', label: 'Single game' },
        { value: '3', label: 'First to 3 points' },
        { value: '5', label: 'First to 5 points' },
      ],
    },
  ],
  rules:
    'Move checkers by the numbers rolled; doubles are played four times. A single checker (blot) can be hit and sent to the bar, and must re-enter before anything else moves. Once all 15 are in your home board you can bear off. Winning before the opponent bears off any checker is a mars: 2 points.',
  setup: L.setup,
  activePlayers: (s) => (s.matchOver ? [] : [s.turn]),
  view: (s) => s,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  bot: L.bot,
  Board,
};

export const mahbusa: GameDef<L.BgState, L.BgMove, L.BgState> = {
  ...backgammon,
  id: 'mahbusa',
  name: 'Mahbusa',
  tagline: 'Tavla without hitting: trap a lone checker under yours.',
  icon: '⛓️',
  rules:
    'A Tavla variant. Both players start with all 15 checkers on their first point and race them home the usual way; doubles are played four times. There is no hitting: landing on a single enemy checker traps it under yours (⛓). A trapped checker can’t move until the trapping checkers all leave that point, and nobody else can land there. Once all your checkers are home, bear them off. Winning before the opponent bears off any checker is a mars: 2 points.',
  setup: (ctx) => L.setup(ctx, 'mahbusa'),
};

export const gulbara: GameDef<L.BgState, L.BgMove, L.BgState> = {
  ...backgammon,
  id: 'gul-bara',
  name: 'Gul Bara',
  tagline: 'Tavla where both players race the same way round.',
  icon: '🌹',
  rules:
    'A Tavla variant. Both players start with all 15 checkers on their first point, in opposite corners, and both race in the same direction round the board to their home in the last quarter. There is no hitting, and a single checker is enough to hold a point: nobody else can land there. From your fourth turn on, rolling a double also gives you every higher double after it (roll 4-4: play 4-4, then 5-5, then 6-6), as far as you can move. Bear off once all 15 are home. Winning before the opponent bears off any checker is a mars: 2 points.',
  setup: (ctx) => L.setup(ctx, 'gulbara'),
};
