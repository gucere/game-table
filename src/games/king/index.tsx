import { useState } from 'react';
import type { BoardProps, GameDef, PlayerInfo, Seat } from '../../engine/types';
import { isRed, sortHand, SUIT_NAME_TR, SUIT_SYMBOL, type Suit } from '../cards/cards';
import { Hand, Opponent, PlayingCard } from '../cards/CardView';
import * as L from './logic';
import { t as tx } from '../../i18n';

function contractLabel(c: L.Contract, trump: Suit | null) {
  if (c === 'koz' && trump !== null) return `Koz ${SUIT_SYMBOL[trump]} ${SUIT_NAME_TR[trump]}`;
  return L.CONTRACTS[c].name;
}

function CallPanel({ v, onMove }: { v: L.KingView; onMove: (m: L.KingMove) => void }) {
  const [koz, setKoz] = useState(false);
  const per = v.callsEach >= 5 ? 2 : 1;
  if (koz) {
    return (
      <div className="stack-sm center">
        <span className="small">{tx('Pick the trump suit. You lead first.')}</span>
        <div className="action-bar">
          {([0, 1, 2, 3] as Suit[]).map((s) => (
            <button key={s} className="btn suit-btn" onClick={() => onMove({ type: 'call', contract: 'koz', suit: s })} style={{ color: isRed(s) ? '#ff6b6b' : undefined }}>
              {SUIT_SYMBOL[s]} {SUIT_NAME_TR[s]}
            </button>
          ))}
          <button className="btn ghost" onClick={() => setKoz(false)}>{tx('Back')}</button>
        </div>
      </div>
    );
  }
  return (
    <div className="stack-sm center">
      <span className="small">{tx('Your call: pick this hand\'s game. You lead first.')}</span>
      <div className="king-calls">
        {(Object.keys(L.CONTRACTS) as L.Contract[]).map((c) => {
          const ok = v.allowed.includes(c);
          const left = c === 'koz' ? null : per - v.used[c];
          return (
            <button key={c} className={'king-call' + (c === 'koz' ? ' koz' : '')} disabled={!ok} onClick={() => (c === 'koz' ? setKoz(true) : onMove({ type: 'call', contract: c }))}>
              <strong>{L.CONTRACTS[c].name}</strong>
              <span className="small">{L.CONTRACTS[c].desc}</span>
              {left !== null && <span className="small muted">{left > 0 ? tx('{left} left in the game', { left: left }) : tx('used up')}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function callsInfo(v: L.KingView, s: Seat) {
  const kozMax = v.callsEach >= 5 ? 2 : 1;
  const c = v.calls[s];
  return `calls: ${c.pen}/${v.callsEach - kozMax} penalty, ${c.koz}/${kozMax} koz`;
}

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.KingView, L.KingMove>) {
  const myTurn = canMove && v.turn === seat;
  const hand = sortHand(v.hand, v.trump);
  const others = [1, 2, 3].map((k) => ((seat + k) % 4) as Seat);
  const showTrick = v.trick.length ? v.trick : v.phase !== 'done' ? (v.lastTrick?.plays ?? []) : [];
  const showingLast = !v.trick.length && showTrick.length > 0;
  const winnerSeat = showingLast ? v.lastTrick!.winner : null;

  const infoFor = (s: Seat) => {
    const bits: string[] = [];
    if (v.phase === 'play') {
      bits.push(`${v.tricks[s]} tricks`);
      if (v.running[s]) bits.push(`${v.running[s] > 0 ? '+' : ''}${v.running[s]}`);
    }
    if (s === v.caller && v.phase !== 'done') bits.push('caller');
    return bits.join(' · ');
  };

  return (
    <div className="table">
      <div className="opponents">
        {others.map((s) => (
          <Opponent key={s} player={players[s]} seat={s} count={v.handCounts[s]} active={v.turn === s && v.phase !== 'done'}>
            <span className="opp-info">{infoFor(s)}</span>
          </Opponent>
        ))}
      </div>

      <div className="felt">
        <div className="info-row">
          <span className="chip">{tx('Hand {v} / {totalHands}', { v: Math.min(v.handNo + 1, v.totalHands), totalHands: v.totalHands })}
          </span>
          {v.contract && v.phase === 'play' && (
            <span className={'chip' + (v.contract === 'koz' ? ' trump-chip' : '')} title={L.CONTRACTS[v.contract].desc}>
              {contractLabel(v.contract, v.trump)}: {L.CONTRACTS[v.contract].desc}
            </span>
          )}
        </div>

        {showTrick.length > 0 && (
          <div className="trick">
            {showTrick.map((p) => (
              <div key={p.card} className={'trick-slot' + (winnerSeat === p.seat ? ' win' : '')}>
                <PlayingCard card={p.card} size="lg" highlight={L.isPenaltyCard(v.contract, p.card)} />
                <span>{p.seat === seat ? tx('You') : players[p.seat].name}</span>
              </div>
            ))}
          </div>
        )}
        {showingLast && <span className="small muted">{winnerSeat === seat ? tx('You took') : tx('{name} took', { name: players[winnerSeat!].name })}{' '}{tx('the last trick')}</span>}

        {myTurn && v.phase === 'call' && <CallPanel key={v.handNo} v={v} onMove={onMove} />}
        {!myTurn && v.phase === 'call' && <span className="small muted">{tx('{name} is choosing the game…', { name: players[v.caller].name })}</span>}
      </div>

      <div className={'my-seat' + (myTurn ? ' active' : '')}>
        <div className="info-row">
          <span className="opp-name">
            <span className="seat-dot" style={{ background: `var(--p${seat})` }} />{' '}{tx('You')}</span>
          <span className="small muted">{[infoFor(seat), callsInfo(v, seat)].filter(Boolean).join(' · ')}</span>
        </div>
        <Hand
          cards={hand}
          size="lg"
          playable={v.phase === 'play' && myTurn ? (c) => v.legal.includes(c) : undefined}
          onCard={myTurn && v.phase === 'play' ? (c) => onMove({ type: 'play', card: c }) : undefined}
        />
      </div>

      <ScoreTable v={v} players={players} />
    </div>
  );
}

function ScoreTable({ v, players }: { v: L.KingView; players: PlayerInfo[] }) {
  if (!v.history.length) return null;
  return (
    <details className="rules" open={v.phase === 'done'}>
      <summary>{tx('Scores: {v}', { v: players.map((p, i) => `${p.name} ${v.scores[i]}`).join(' · ') })}</summary>
      <table className="score-table">
        <thead>
          <tr>
            <th>#</th>
            <th>{tx('Game')}</th>
            {players.map((p, i) => (
              <th key={i}>{p.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {v.history.map((h, k) => (
            <tr key={k}>
              <td>{k + 1}</td>
              <td>
                {contractLabel(h.contract, h.trump)} <span className="muted">({players[h.caller].name})</span>
              </td>
              {h.delta.map((d, i) => (
                <td key={i}>{d > 0 ? `+${d}` : d}</td>
              ))}
            </tr>
          ))}
          <tr>
            <td>Σ</td>
            <td />
            {v.scores.map((x, i) => (
              <td key={i}>
                <b>{x}</b>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </details>
  );
}

export const king: GameDef<L.KingState, L.KingMove, L.KingView> = {
  id: 'king',
  name: 'King',
  tagline: 'Twenty hands of penalties and trumps. Pick your poison.',
  icon: '👑',
  minPlayers: 4,
  maxPlayers: 4,
  hiddenInfo: true,
  options: [
    {
      id: 'length',
      label: 'Game length',
      default: 'full',
      choices: [
        { value: 'full', label: 'Full: 20 hands (3 penalties + 2 koz each)' },
        { value: 'quick', label: 'Quick: 8 hands (1 penalty + 1 koz each)' },
      ],
    },
  ],
  rules:
    'Before each hand the caller (it rotates) picks the game. Penalties: El almaz (−50 a trick), Kupa almaz (−30 a heart), Erkek almaz (−60 a K or J), Kız almaz (−100 a queen), Rıfkı (−320 for the K♥), Son iki (−180 for each of the last two tricks). Koz: the caller picks trump and every trick is +50. In a full game everyone calls 3 penalties and 2 koz games, and each penalty is played twice. Always follow suit. In koz you must beat the trick if you can, and trump when you are out of the suit. In penalty games, if you are out of the suit you must throw a penalty card if you have one, and a penalty card that can no longer win the trick (like the K♥ under the A♥) must be played. Hearts (or trumps in koz) can\'t be led until one has been thrown, unless that\'s all you hold. A penalty hand ends early once every penalty card is taken. Highest total wins.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  bot: L.bot,
  botDelay: (s) => (s.phase === 'play' && !s.trick.length && s.lastTrick ? 1500 : 700),
  Board,
};
