import { useState } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import { useSecondsLeft } from '../shared/Countdown';
import * as L from './logic';
import { t as tx } from '../../i18n';

function CardGrid({ card, marked, onCell, small }: { card: L.TCard; marked: Set<number>; onCell?: (n: number) => void; small?: boolean }) {
  return (
    <div className={'tb-card' + (small ? ' small' : '')}>
      {card.map((row, r) =>
        row.map((x, c) => (
          <button
            key={`${r}-${c}`}
            className={'tb-cell' + (x === null ? ' blank' : '') + (x !== null && marked.has(x) ? ' marked' : '')}
            disabled={x === null || !onCell}
            onClick={() => x !== null && onCell?.(x)}
            aria-label={x === null ? 'empty' : `${x}${marked.has(x) ? tx(' marked') : ''}`}
          >
            {x ?? ''}
          </button>
        )),
      )}
    </div>
  );
}

function Board({ view: v, seat, players, canMove, onMove, clockOffset }: BoardProps<L.TombalaView, L.TombalaMove>) {
  const [auto, setAuto] = useState(true);
  const [manual, setManual] = useState<Set<number>>(new Set());
  const drawn = new Set(v.drawn);
  const marked = auto ? drawn : new Set([...manual].filter((x) => drawn.has(x)));
  const last = v.drawn[v.drawn.length - 1];
  const secs = useSecondsLeft(v.deadline, clockOffset);
  const prize = L.nextPrize(v);

  return (
    <div className="stack tombala">
      <div className="info-row">
        {L.PRIZES.map((p) => (
          <span key={p} className={'chip' + (p === prize ? ' trump-chip' : '')}>
            {L.PRIZE_NAMES[p]}: {v.winners[p] === null ? '—' : v.winners[p] === seat ? tx('You! 🎉') : players[v.winners[p]!].name}
          </span>
        ))}
      </div>

      <div className="tb-draw">
        <div className="tb-ball" aria-live="polite">
          {last ?? '?'}
        </div>
        <div className="stack-sm">
          <span className="small muted">
            {v.drawn.length ? tx('{length} drawn', { length: v.drawn.length }) : tx('Get ready…')}
            {secs !== null && v.phase === 'play' && tx(' · next in {secs}s', { secs: secs })}
          </span>
          <span className="tb-recent">{v.drawn.slice(-6, -1).reverse().join(' · ')}</span>
        </div>
      </div>

      {canMove && v.claimable && (
        <button className="btn primary tb-claim" onClick={() => onMove({ type: 'claim' })}>
          {v.claimable === 'tombala' ? tx('TOMBALA! 🎉') : `${L.PRIZE_NAMES[v.claimable]}!`}
        </button>
      )}

      <div className="stack-sm center">
        <div className="row center-row">
          <strong>{tx('Your card')}</strong>
          <label className="small">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />{' '}{tx('Mark numbers for me')}</label>
        </div>
        <CardGrid
          card={v.cards[seat]}
          marked={marked}
          onCell={
            auto
              ? undefined
              : (x) =>
                  setManual((m) => {
                    const next = new Set(m);
                    if (next.has(x)) next.delete(x);
                    else next.add(x);
                    return next;
                  })
          }
        />
        {!auto && <span className="small muted">{tx('Tap numbers as they\'re called. Only called numbers count.')}</span>}
      </div>

      {v.n > 1 && (
        <div className="tb-others">
          {players.map((p, i) =>
            i === seat ? null : (
              <div key={i} className="stack-sm">
                <span className="small">
                  <span className="seat-dot" style={{ background: `var(--p${i % 8})` }} /> {p.name} · {L.fullRows(v.cards[i], v.drawn)}{' '}{tx('row')}{L.fullRows(v.cards[i], v.drawn) === 1 ? '' : 's'}
                </span>
                <CardGrid card={v.cards[i]} marked={drawn} small />
              </div>
            ),
          )}
        </div>
      )}

      <details className="rules">
        <summary>{tx('All drawn numbers')}</summary>
        <div className="tb-all">
          {Array.from({ length: 90 }, (_, i) => (
            <span key={i} className={drawn.has(i + 1) ? 'on' : ''}>
              {i + 1}
            </span>
          ))}
        </div>
      </details>
    </div>
  );
}

export const tombala: GameDef<L.TombalaState, L.TombalaMove, L.TombalaView> = {
  id: 'tombala',
  name: 'Tombala',
  tagline: "The New Year's bingo: çinko, çinko, TOMBALA!",
  icon: '🎱',
  minPlayers: 1,
  maxPlayers: 12,
  defaultPlayers: 4,
  hiddenInfo: false,
  options: [
    {
      id: 'speed',
      label: 'A new number every',
      default: '4',
      choices: [
        { value: '3', label: '3 seconds' },
        { value: '4', label: '4 seconds' },
        { value: '6', label: '6 seconds' },
        { value: '9', label: '9 seconds' },
      ],
    },
  ],
  rules:
    'Everyone gets a card with 15 numbers in three rows. Numbers from 1 to 90 are drawn one at a time. Fill a whole row first and shout 1. Çinko; two rows for 2. Çinko; all 15 for TOMBALA, which wins the game. The button only lights up when your card really is complete, but be quick: the first one to press it takes the prize!',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m) => L.move(s, seat, m),
  result: L.result,
  bot: () => L.bot(),
  botDelay: () => 1600,
  timer: (s) => s.deadline,
  onTimer: L.onTimer,
  Board,
};
