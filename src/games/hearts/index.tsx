import { useEffect, useState } from 'react';
import type { BoardProps, GameDef, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';
import { sortHand, type Card } from '../cards/cards';
import { Hand, Opponent, PlayingCard } from '../cards/CardView';
import * as L from './logic';

const DIR_TEXT = { left: 'Pass three cards to the left', right: 'Pass three cards to the right', across: 'Pass three cards across', none: '' };

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.HeartsView, L.HeartsMove>) {
  const [sel, setSel] = useState<Card[]>([]);
  useEffect(() => setSel([]), [v.handNo, v.phase]);
  const myTurn = canMove && (v.phase === 'pass' ? !v.passed[seat] : v.turn === seat);
  const others = [1, 2, 3].map((k) => ((seat + k) % 4) as Seat);
  const showTrick = v.trick.length ? v.trick : (v.lastTrick?.plays ?? []);
  const winnerSeat = !v.trick.length ? v.lastTrick?.winner : undefined;
  return (
    <div className="table">
      <div className="opponents">
        {others.map((s) => (
          <Opponent key={s} player={players[s]} seat={s} count={v.handCounts[s]} active={v.phase === 'play' ? v.turn === s : v.phase === 'pass' && !v.passed[s]}>
            <span className="opp-info">{tx('{n} pts this hand · total {t}', { n: v.points[s], t: v.scores[s] })}</span>
          </Opponent>
        ))}
      </div>
      <div className="felt">
        <div className="info-row">
          <span className="chip">{tx('Hand {n}', { n: v.handNo + 1 })}</span>
          <span className="chip">{tx('Game to {n}', { n: v.target })}</span>
          {v.broken && <span className="chip">{tx('Hearts broken ♥')}</span>}
        </div>
        {showTrick.length > 0 && v.phase === 'play' && (
          <div className="trick">
            {showTrick.map((p) => (
              <div key={p.card} className={'trick-slot' + (winnerSeat === p.seat ? ' win' : '')}>
                <PlayingCard card={p.card} size="lg" highlight={L.pointsOf(p.card) > 0} />
                <span>{p.seat === seat ? tx('You') : players[p.seat].name}</span>
              </div>
            ))}
          </div>
        )}
        {v.phase === 'pass' &&
          (myTurn ? (
            <div className="stack-sm center">
              <span className="small">{tx(DIR_TEXT[v.passDir])}</span>
              <button className="btn primary" disabled={sel.length !== 3} onClick={() => onMove({ type: 'pass', cards: sel })}>
                {tx('Pass {n}/3', { n: sel.length })}
              </button>
            </div>
          ) : (
            <span className="small muted">{tx('Waiting for everyone to pass…')}</span>
          ))}
        {v.moon !== null && v.phase !== 'done' && <p className="small">{tx('{name} shot the moon! 🌙', { name: v.moon === seat ? tx('You') : players[v.moon].name })}</p>}
      </div>
      <div className={'my-seat' + (myTurn ? ' active' : '')}>
        <div className="info-row">
          <span className="opp-name">
            <span className="seat-dot" style={{ background: `var(--p${seat})` }} /> {tx('You')}
          </span>
          <span className="small muted">{tx('{n} pts this hand · total {t}', { n: v.points[seat], t: v.scores[seat] })}</span>
        </div>
        <Hand
          cards={sortHand(v.hand)}
          size="lg"
          playable={v.phase === 'play' && myTurn ? (c) => v.legal.includes(c) : undefined}
          selected={(c) => sel.includes(c)}
          onCard={
            !myTurn
              ? undefined
              : v.phase === 'pass'
                ? (c) => setSel((x) => (x.includes(c) ? x.filter((y) => y !== c) : x.length < 3 ? [...x, c] : x))
                : (c) => onMove({ type: 'play', card: c })
          }
        />
      </div>
      {v.history.length > 0 && (
        <details className="rules" open={v.phase === 'done'}>
          <summary>{tx('Scores: {v}', { v: players.map((p, i) => `${p.name} ${v.scores[i]}`).join(' · ') })}</summary>
          <table className="score-table">
            <thead>
              <tr>
                <th>#</th>
                {players.map((p, i) => (
                  <th key={i}>{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {v.history.map((h, k) => (
                <tr key={k}>
                  <td>{k + 1}</td>
                  {h.map((d, i) => (
                    <td key={i}>{d}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

export const hearts: GameDef<L.HeartsState, L.HeartsMove, L.HeartsView> = {
  id: 'hearts',
  name: 'Hearts',
  tagline: 'Dodge the hearts and the queen of spades, or take them all.',
  icon: '♥️',
  minPlayers: 4,
  maxPlayers: 4,
  hiddenInfo: true,
  options: [
    {
      id: 'target',
      label: 'Game ends at',
      default: '100',
      choices: [
        { value: '50', label: '50 points' },
        { value: '100', label: '100 points' },
      ],
    },
  ],
  rules:
    'Avoid taking tricks with hearts (1 point each) or the queen of spades (13 points). Before each hand pass three cards: left, then right, then across, then no passing. The 2♣ leads the first trick and no points may be played on it if you can avoid it. Follow suit if you can; hearts can’t be led until one has been played. Take all 13 hearts and the Q♠ ("shoot the moon") and everyone else gets 26 points instead. When someone reaches the limit, the lowest score wins.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  bot: L.bot,
  botDelay: (s) => (s.phase === 'play' && !s.trick.length && s.lastTrick ? 1400 : 700),
  isPrivate: () => true,
  Board,
};
