import { useEffect, useState } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import { t as tx } from '../../i18n';
import * as L from './logic';

const PIPS = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function Die({ face, hit, hidden }: { face?: number; hit?: boolean; hidden?: boolean }) {
  return <span className={'ld-die' + (hit ? ' hit' : '') + (hidden ? ' hidden' : '')}>{hidden ? '?' : PIPS[face ?? 0]}</span>;
}

const bidText = (b: { count: number; face: number }) => tx('{count} × {face}', { count: b.count, face: PIPS[b.face] });

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.LiarView, L.LiarMove>) {
  const total = L.totalDice(v);
  const minFace = v.wild ? 2 : 1;
  const start = () => (v.bid ? (v.bid.face < 6 ? { count: v.bid.count, face: v.bid.face + 1 } : { count: v.bid.count + 1, face: minFace }) : { count: 1, face: minFace });
  const [pick, setPick] = useState(start);
  useEffect(() => setPick(start()), [v.bid?.count, v.bid?.face, v.turn]); // eslint-disable-line react-hooks/exhaustive-deps
  const ok = L.canBid(v, pick.count, pick.face, total);
  const r = v.reveal;

  return (
    <div className="stack center ld">
      <div className="ld-players">
        {players.map((p, i) => (
          <div key={i} className={'ld-player' + (v.turn === i && v.phase === 'bid' && v.winner === null ? ' on' : '') + (v.counts[i] === 0 ? ' out' : '')}>
            <strong className="small">{p.name}</strong>
            <span className="ld-dice">
              {r && v.phase === 'reveal'
                ? r.dice[i].map((d, k) => <Die key={k} face={d} hit={d === r.bid.face || (v.wild && d === 1)} />)
                : i === seat
                  ? v.mine.map((d, k) => <Die key={k} face={d} />)
                  : Array.from({ length: v.counts[i] }, (_, k) => <Die key={k} hidden />)}
              {v.counts[i] === 0 && <span className="small muted">{tx('out')}</span>}
            </span>
          </div>
        ))}
      </div>

      <p className="small muted">
        {tx('{n} dice on the table.', { n: total })} {v.wild ? tx('Ones are wild.') : ''}
      </p>

      {v.phase === 'bid' && (
        <div className="ld-bid">
          {v.bid ? (
            <p>
              {tx('{name} bids', { name: players[v.bid.by]?.name ?? '' })} <strong className="ld-big">{bidText(v.bid)}</strong>
            </p>
          ) : (
            <p className="muted">{tx('No bid yet: {name} opens.', { name: players[v.turn]?.name ?? '' })}</p>
          )}
          {v.history.length > 1 && (
            <p className="small muted">
              {v.history
                .slice(0, -1)
                .slice(-5)
                .map((b) => `${players[b.by]?.name}: ${bidText(b)}`)
                .join(' → ')}
            </p>
          )}
        </div>
      )}

      {r && (
        <div className="ld-reveal">
          <p>
            {tx('{caller} called {bidder}’s bid of {bid} a lie.', { caller: players[r.caller]?.name ?? '', bidder: players[r.bid.by]?.name ?? '', bid: bidText(r.bid) })}
          </p>
          <p>
            <strong>{tx('There are {n}.', { n: r.actual })}</strong> {tx('{name} loses a die.', { name: players[r.loser]?.name ?? '' })}
          </p>
        </div>
      )}

      {canMove && v.phase === 'bid' && (
        <div className="stack-sm center">
          <div className="row center-row">
            <button className="btn small" onClick={() => setPick((p) => ({ ...p, count: Math.max(1, p.count - 1) }))} aria-label={tx('Fewer')}>
              −
            </button>
            <strong className="ld-big">{pick.count}</strong>
            <button className="btn small" onClick={() => setPick((p) => ({ ...p, count: Math.min(total, p.count + 1) }))} aria-label={tx('More')}>
              +
            </button>
            <span>×</span>
            {[1, 2, 3, 4, 5, 6]
              .filter((f) => f >= minFace)
              .map((f) => (
                <button key={f} className={'ld-face' + (pick.face === f ? ' on' : '')} aria-pressed={pick.face === f} onClick={() => setPick((p) => ({ ...p, face: f }))}>
                  {PIPS[f]}
                </button>
              ))}
          </div>
          <div className="row center-row">
            <button className="btn primary" disabled={!ok} onClick={() => onMove({ type: 'bid', count: pick.count, face: pick.face })}>
              {tx('Bid {bid}', { bid: bidText(pick) })}
            </button>
            {v.bid && (
              <button className="btn danger-btn" onClick={() => onMove({ type: 'liar' })}>
                🤥 {tx('Liar!')}
              </button>
            )}
          </div>
          {!ok && <p className="small muted">{tx('Bid more dice, or the same number of a higher face.')}</p>}
        </div>
      )}
    </div>
  );
}

export const liarsDice: GameDef<L.LiarState, L.LiarMove, L.LiarView> = {
  id: 'yalanci-zar',
  name: 'Yalancı Zar',
  tagline: 'Hide your dice, bid boldly, and catch the liars.',
  icon: '🎲',
  minPlayers: 2,
  maxPlayers: 6,
  defaultPlayers: 3,
  hiddenInfo: true,
  options: [
    {
      id: 'dice',
      label: 'Dice each',
      default: '5',
      choices: [
        { value: '3', label: '3 (quick)' },
        { value: '5', label: '5' },
        { value: '6', label: '6' },
      ],
    },
    {
      id: 'wild',
      label: 'Ones are wild',
      default: 'on',
      choices: [
        { value: 'on', label: 'Yes' },
        { value: 'off', label: 'No' },
      ],
    },
  ],
  rules:
    'Everyone rolls their dice under a cup: you only see your own. In turn, raise the bid on how many dice on the whole table show one face, for example “four 5s”. A higher bid is more dice, or the same number of a higher face. Instead of raising, you can call the last bid a lie. Then all dice are shown: if there are at least as many as bid, the caller loses a die; if not, the bidder does. Everyone rolls again and the loser starts. With “ones are wild”, every 1 also counts as the face that was bid (and nobody bids on 1s). Lose all your dice and you’re out; the last one with dice wins.',
  setup: L.setup,
  activePlayers: (s) => (s.winner !== null || s.phase !== 'bid' ? [] : [s.turn]),
  view: L.view,
  isPrivate: () => true,
  move: L.move,
  result: L.result,
  timer: (s) => (s.phase === 'reveal' && s.winner === null ? s.until : null),
  onTimer: L.onTimer,
  bot: L.bot,
  botDelay: () => 1300,
  describeMove: (_v, m) => (m.type === 'liar' ? tx('Call it a lie.') : tx('Raise to {bid}.', { bid: bidText(m) })),
  Board,
};
