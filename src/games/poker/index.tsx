import { useEffect, useState } from 'react';
import type { BoardProps, GameDef, GameOption, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';
import { sortByRank, type Card } from '../cards/cards';
import { Hand, Opponent, PlayingCard } from '../cards/CardView';
import { best, handName } from './eval';
import * as L from './logic';

const action = (a: string | null) => {
  if (!a) return '';
  // "call 20", "raise to 80", "all-in 300" → translate the words, keep the number
  const m = /^(.*?)(\s\d+)?$/.exec(a)!;
  return tx(m[1]) + (m[2] ?? '');
};

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.PokerView, L.PokerMove>) {
  const myTurn = canMove && v.toAct === seat;
  const [raise, setRaise] = useState(v.minRaiseTo);
  const [swap, setSwap] = useState<Card[]>([]);
  useEffect(() => setRaise(v.minRaiseTo), [v.minRaiseTo, v.toAct, v.street]);
  useEffect(() => setSwap([]), [v.handNo, v.phase]);

  const others = Array.from({ length: v.n - 1 }, (_, k) => ((seat + 1 + k) % v.n) as Seat);
  const mine = v.hand.length ? (v.variant === 'holdem' ? (v.board.length >= 3 ? best([...v.hand, ...v.board]).score : null) : best(v.hand).score) : null;
  const winners = new Map((v.result?.winners ?? []).map((w) => [w.seat, w]));
  const name = (s: Seat) => (s === seat ? tx('You') : players[s].name);

  const seatInfo = (s: Seat) => (
    <span className="opp-info">
      {v.chips[s] === 0 && !v.live[s] && v.contributed[s] === 0 ? tx('out') : `💰 ${v.chips[s]}`}
      {v.bet[s] > 0 && ` · ${tx('bet')} ${v.bet[s]}`}
      {s === v.dealer && ' · Ⓓ'}
      {v.lastAction[s] && ` · ${action(v.lastAction[s])}`}
    </span>
  );

  return (
    <div className="table poker">
      <div className="opponents">
        {others.map((s) => (
          <Opponent key={s} player={players[s]} seat={s} count={v.shown[s] ? 0 : v.holeCounts[s]} active={v.toAct === s && (v.phase === 'bet' || v.phase === 'draw')}>
            {seatInfo(s)}
            {v.shown[s] && (
              <span className="row center-row">
                {v.shown[s]!.map((c) => (
                  <PlayingCard key={c} card={c} size="sm" />
                ))}
              </span>
            )}
            {winners.has(s) && (
              <span className="small pk-win">
                +{winners.get(s)!.amount} {winners.get(s)!.hand && `· ${tx(winners.get(s)!.hand)}`}
              </span>
            )}
          </Opponent>
        ))}
      </div>

      <div className="felt">
        <div className="info-row">
          <span className="chip">{tx('Hand {n}', { n: v.handNo })}</span>
          <span className="chip">{tx('Blinds {sb}/{bb}', { sb: v.sb, bb: v.bb })}</span>
          <span className="chip trump-chip">{tx('Pot {pot}', { pot: v.pot })}</span>
          {(v.phase === 'bet' || v.phase === 'draw') && <span className="chip">{v.phase === 'draw' ? tx('Draw') : tx(L.streetName(v))}</span>}
        </div>
        {v.variant === 'holdem' && (
          <div className="pk-board">
            {Array.from({ length: 5 }, (_, i) =>
              v.board[i] !== undefined ? <PlayingCard key={i} card={v.board[i]} size="lg" /> : <span key={i} className="pk-slot" />,
            )}
          </div>
        )}
        {v.result && (
          <p className="pk-result">
            {v.result.winners.map((w) => `${name(w.seat)} +${w.amount}${w.hand ? ` (${tx(w.hand)})` : ''}`).join(' · ')}
          </p>
        )}
      </div>

      <div className={'my-seat' + (myTurn ? ' active' : '')}>
        <div className="info-row">
          <span className="opp-name">
            <span className="seat-dot" style={{ background: `var(--p${seat})` }} /> {tx('You')}
          </span>
          {seatInfo(seat)}
          {mine !== null && v.live[seat] && <span className="chip">{tx(handName(mine))}</span>}
          {winners.has(seat) && <span className="chip trump-chip">+{winners.get(seat)!.amount} 🎉</span>}
        </div>
        <Hand
          cards={v.variant === 'draw' ? sortByRank(v.hand) : v.hand}
          size="lg"
          selected={(c) => swap.includes(c)}
          onCard={
            myTurn && v.phase === 'draw' ? (c) => setSwap((x) => (x.includes(c) ? x.filter((y) => y !== c) : x.length < 4 ? [...x, c] : x)) : undefined
          }
        />

        {myTurn && v.phase === 'draw' && (
          <div className="action-bar">
            <span className="small">{tx('Tap up to 4 cards to swap.')}</span>
            <button className="btn primary" onClick={() => onMove({ type: 'draw', discard: swap })}>
              {swap.length ? tx('Swap {n}', { n: swap.length }) : tx('Stand pat')}
            </button>
          </div>
        )}

        {myTurn && v.phase === 'bet' && (
          <div className="stack-sm">
            <div className="action-bar">
              {v.toCall > 0 && (
                <button className="btn" onClick={() => onMove({ type: 'fold' })}>
                  {tx('Fold')}
                </button>
              )}
              {v.toCall === 0 ? (
                <button className="btn" onClick={() => onMove({ type: 'check' })}>
                  {tx('Check')}
                </button>
              ) : (
                <button className="btn" onClick={() => onMove({ type: 'call' })}>
                  {v.toCall >= v.chips[seat] ? tx('All-in {n}', { n: v.chips[seat] }) : tx('Call {n}', { n: v.toCall })}
                </button>
              )}
              {v.maxRaiseTo > v.currentBet && v.chips[seat] > v.toCall && (
                <button className="btn primary" onClick={() => onMove({ type: 'raise', to: raise })}>
                  {raise >= v.maxRaiseTo ? tx('All-in {n}', { n: raise }) : v.currentBet === 0 ? tx('Bet {n}', { n: raise }) : tx('Raise to {n}', { n: raise })}
                </button>
              )}
            </div>
            {v.maxRaiseTo > v.currentBet && v.chips[seat] > v.toCall && (
              <div className="pk-raise">
                <input
                  type="range"
                  min={v.minRaiseTo}
                  max={v.maxRaiseTo}
                  step={Math.max(1, Math.round(v.bb / 2))}
                  value={raise}
                  onChange={(e) => setRaise(Number(e.target.value))}
                  aria-label={tx('Raise amount')}
                />
                {[
                  [tx('½ pot'), v.currentBet + Math.round(v.pot / 2)],
                  [tx('Pot'), v.currentBet + v.pot],
                  [tx('All-in'), v.maxRaiseTo],
                ].map(([label, amt]) => (
                  <button key={label} className="btn small ghost" onClick={() => setRaise(Math.max(v.minRaiseTo, Math.min(v.maxRaiseTo, Number(amt))))}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const OPTIONS: GameOption[] = [
  {
    id: 'chips',
    label: 'Starting chips',
    default: '1000',
    choices: [
      { value: '500', label: '500' },
      { value: '1000', label: '1000' },
      { value: '5000', label: '5000' },
    ],
  },
  {
    id: 'blinds',
    label: 'Blinds double every',
    default: '10',
    choices: [
      { value: '5', label: '5 hands' },
      { value: '10', label: '10 hands' },
      { value: '0', label: 'Never' },
    ],
  },
  {
    id: 'hands',
    label: 'Game ends',
    default: '0',
    choices: [
      { value: '0', label: 'When one player has all the chips' },
      { value: '10', label: 'After 10 hands (most chips wins)' },
      { value: '25', label: 'After 25 hands (most chips wins)' },
    ],
  },
];

const common = {
  minPlayers: 2,
  maxPlayers: 9,
  defaultPlayers: 5,
  hiddenInfo: true,
  options: OPTIONS,
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s: L.PokerState, seat: Seat, m: L.PokerMove, ctx: { random: () => number; now: () => number }) => L.move(s, seat, m, ctx),
  result: L.result,
  bot: L.bot,
  botDelay: () => 900,
  timer: (s: L.PokerState) => s.deadline,
  onTimer: L.onTimer,
  Board,
};

export const holdem: GameDef<L.PokerState, L.PokerMove, L.PokerView> = {
  ...common,
  id: 'holdem',
  name: "Texas Hold'em",
  tagline: 'Two cards each, five on the table, play chips only.',
  icon: '♠️',
  rules:
    "Play-money No-Limit Texas Hold'em. Everyone gets two hidden cards; five shared cards come out in stages (flop: 3, turn: 1, river: 1), with a betting round before each and after the last. On your turn: fold, check (if nothing to pay), call, or raise. The two players after the dealer post the small and big blinds. The best five-card hand from your two cards and the five on the table wins the pot; all-ins create side pots. Hands, best to worst: straight flush, four of a kind, full house, flush, straight, three of a kind, two pair, pair, high card. Chips are just for fun.",
  setup: (ctx) => L.setup(ctx, 'holdem'),
};

export const poker: GameDef<L.PokerState, L.PokerMove, L.PokerView> = {
  ...common,
  maxPlayers: 6,
  defaultPlayers: 4,
  id: 'poker',
  name: 'Five-Card Draw',
  tagline: 'Classic poker: five cards, one swap, bluff your way through.',
  icon: '🂡',
  rules:
    'Play-money No-Limit Five-Card Draw. Everyone gets five hidden cards and there is a betting round. Then, in turn, each player may swap up to four cards for new ones. A second betting round follows, then the showdown: best five-card hand wins. Blinds work like in Hold\'em. Hands, best to worst: straight flush, four of a kind, full house, flush, straight, three of a kind, two pair, pair, high card. Chips are just for fun.',
  setup: (ctx) => L.setup(ctx, 'draw'),
};
