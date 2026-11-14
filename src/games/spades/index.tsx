import type { BoardProps, GameDef, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';
import { sortHand } from '../cards/cards';
import { Hand, Opponent, PlayingCard } from '../cards/CardView';
import * as L from './logic';

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.SpadesView, L.SpadesMove>) {
  const myTurn = canMove && v.turn === seat;
  const others = [1, 2, 3].map((k) => ((seat + k) % 4) as Seat);
  const showTrick = v.trick.length ? v.trick : v.phase === 'play' ? (v.lastTrick?.plays ?? []) : [];
  const winnerSeat = !v.trick.length ? v.lastTrick?.winner : undefined;
  const bidText = (s: Seat) => (v.bids[s] === null ? tx('no bid yet') : v.bids[s] === 0 ? tx('nil') : tx('bid {n}', { n: v.bids[s]! }));
  const myTeam = L.team(seat);
  const teamName = (t: number) => `${t === myTeam ? tx('You') : players[t].name} & ${t === myTeam ? players[(seat + 2) % 4].name : players[t + 2].name}`;
  return (
    <div className="table">
      <div className="opponents">
        {others.map((s) => (
          <Opponent key={s} player={players[s]} seat={s} count={v.handCounts[s]} active={v.turn === s && v.phase !== 'done'}>
            <span className="opp-info">
              {bidText(s)} · {tx('{n} tricks', { n: v.tricks[s] })}
              {L.team(s) === myTeam ? ` · ${tx('partner')}` : ''}
            </span>
          </Opponent>
        ))}
      </div>
      <div className="felt">
        <div className="info-row">
          {[0, 1].map((t) => (
            <span key={t} className={'chip' + (t === myTeam ? ' trump-chip' : '')}>
              {teamName(t)}: {v.scores[t]} ({tx('{n} bags', { n: v.bags[t] })})
            </span>
          ))}
          <span className="chip">{tx('Game to {n}', { n: v.target })}</span>
        </div>
        {showTrick.length > 0 && (
          <div className="trick">
            {showTrick.map((p) => (
              <div key={p.card} className={'trick-slot' + (winnerSeat === p.seat ? ' win' : '')}>
                <PlayingCard card={p.card} size="lg" />
                <span>{p.seat === seat ? tx('You') : players[p.seat].name}</span>
              </div>
            ))}
          </div>
        )}
        {myTurn && v.phase === 'bid' && (
          <div className="stack-sm center">
            <span className="small">{tx('How many tricks will you take? Your partner’s bid adds to yours. Nil = none at all (±100).')}</span>
            <div className="action-bar">
              <button className="btn" onClick={() => onMove({ type: 'bid', n: 0 })}>
                {tx('Nil')}
              </button>
              {Array.from({ length: 13 }, (_, k) => k + 1).map((n) => (
                <button key={n} className="btn small" onClick={() => onMove({ type: 'bid', n })}>
                  {n}
                </button>
              ))}
            </div>
            <span className="small muted">{tx('Suggested: about {n}', { n: Math.max(1, Math.round(L.estimate(v.hand))) })}</span>
          </div>
        )}
      </div>
      <div className={'my-seat' + (myTurn ? ' active' : '')}>
        <div className="info-row">
          <span className="opp-name">
            <span className="seat-dot" style={{ background: `var(--p${seat})` }} /> {tx('You')}
          </span>
          <span className="small muted">
            {bidText(seat)} · {tx('{n} tricks', { n: v.tricks[seat] })}
          </span>
        </div>
        <Hand
          cards={sortHand(v.hand, 0)}
          size="lg"
          playable={v.phase === 'play' && myTurn ? (c) => v.legal.includes(c) : undefined}
          onCard={myTurn && v.phase === 'play' ? (c) => onMove({ type: 'play', card: c }) : undefined}
        />
      </div>
    </div>
  );
}

export const spades: GameDef<L.SpadesState, L.SpadesMove, L.SpadesView> = {
  id: 'spades',
  name: 'Spades',
  tagline: 'Partners bid together; spades always trump.',
  icon: '🖤',
  minPlayers: 4,
  maxPlayers: 4,
  hiddenInfo: true,
  options: [
    {
      id: 'target',
      label: 'Play to',
      default: '500',
      choices: [
        { value: '250', label: '250 points' },
        { value: '500', label: '500 points' },
      ],
    },
  ],
  rules:
    'Four players in two teams; partners sit opposite. Spades are always trump and can’t be led until one has been played. Each player bids how many tricks they expect to take; partners’ bids are added. Make your team’s bid: 10 points per trick bid, plus 1 per extra trick (a "bag"); fall short: lose 10 per trick bid. Bid nil to take no tricks at all: +100 if you manage it, −100 if not. Every 10 bags cost 100 points. First team to the target wins.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  bot: L.bot,
  botDelay: (s) => (s.phase === 'play' && !s.trick.length && s.lastTrick ? 1400 : 700),
  Board,
};
