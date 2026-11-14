import { useEffect, useState } from 'react';
import type { BoardProps, GameDef, Seat } from '../../engine/types';
import { rankLabel, rankOf, sortByRank, type Card } from '../cards/cards';
import { Hand, Opponent, PlayingCard } from '../cards/CardView';
import * as L from './logic';
import { t as tx } from '../../i18n';

const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.BluffView, L.BluffMove>) {
  const me = seat as Seat;
  const [sel, setSel] = useState<Card[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const hand = sortByRank(v.hand);
  const others = Array.from({ length: v.n - 1 }, (_, k) => ((me + 1 + k) % v.n) as Seat);
  const lp = v.pile[v.pile.length - 1];
  const leading = v.claim === null;

  useEffect(() => {
    setSel([]);
    setRank(null);
  }, [v.turn, v.claim, v.pileCount]);

  const toggle = (c: Card) => setSel((s) => (s.includes(c) ? s.filter((x) => x !== c) : s.length < 4 ? [...s, c] : s));
  const claimRank = leading ? rank : v.claim;
  const plural = (r: number) => `${rankLabel(r)}${r === 6 ? "'es" : "'s"}`;

  return (
    <div className="table">
      <div className="opponents">
        {others.map((s) => (
          <Opponent key={s} player={players[s]} seat={s} count={v.handCounts[s]} active={v.turn === s && v.winner === null} />
        ))}
      </div>

      <div className="felt">
        <div className="info-row">
          {v.claim !== null ? <span className="chip trump-chip">{tx('Current rank: {v}', { v: plural(v.claim) })}</span> : <span className="chip">{tx('New round')}</span>}
          <span className="chip">{tx('Pile: {pileCount} cards', { pileCount: v.pileCount })}</span>
        </div>
        {v.pile.length > 0 && (
          <div className="bluff-pile">
            {v.pile.map((p, i) => (
              <div key={i} className="trick-slot">
                <div className="opp-cards">
                  {Array.from({ length: p.count }, (_, k) => (
                    <PlayingCard key={k} back size="sm" style={{ marginLeft: k ? -26 : 0 }} />
                  ))}
                </div>
                <span>
                  {p.seat === me ? tx('You') : players[p.seat].name}: {p.count}× {v.claim !== null ? rankLabel(v.claim) : ''}
                </span>
              </div>
            ))}
          </div>
        )}
        {v.reveal && (
          <div className="stack-sm center">
            <span className="small">
              {v.reveal.caller === me ? tx('You') : players[v.reveal.caller].name}{' '}{tx('called bluff on')}{' '}{v.reveal.seat === me ? 'you' : players[v.reveal.seat].name}:
            </span>
            <div className="trick">
              {v.reveal.cards.map((c) => (
                <PlayingCard key={c} card={c} highlight={rankOf(c) !== v.reveal!.claim} />
              ))}
            </div>
            <span className="small">
              {v.reveal.lie
                ? tx('Caught lying! {v} up the pile.', { v: v.reveal.seat === me ? 'You pick' : players[v.reveal.seat].name + ' picks' })
                : tx('It was the truth. {v} up the pile.', { v: v.reveal.caller === me ? 'You pick' : players[v.reveal.caller].name + ' picks' })}
            </span>
          </div>
        )}
        {v.passes > 0 && <span className="small muted">{tx('{passes} pass', { passes: v.passes })}{v.passes > 1 ? 'es' : ''}{' '}{tx('in a row')}</span>}
      </div>

      <div className={'my-seat' + (canMove ? ' active' : '')}>
        <div className="info-row">
          <span className="opp-name">
            <span className="seat-dot" style={{ background: `var(--p${me})` }} />{' '}{tx('You · {length} cards', { length: v.hand.length })}</span>
          {canMove && (
            <span className="small">
              {leading ? tx('You lead: pick a rank to claim, then 1–4 cards (they can be anything!).') : tx('Play 1–4 cards as {v}, pass, or call bluff.', { v: plural(v.claim!) })}
            </span>
          )}
        </div>
        {canMove && leading && (
          <div className="action-bar rank-picker">
            {RANKS.map((r) => (
              <button key={r} className={'btn small' + (rank === r ? ' primary' : '')} onClick={() => setRank(r)}>
                {rankLabel(r)}
              </button>
            ))}
          </div>
        )}
        <Hand cards={hand} size="lg" selected={(c) => sel.includes(c)} onCard={canMove ? toggle : undefined} />
        {canMove && (
          <div className="action-bar">
            <button
              className="btn primary"
              disabled={!sel.length || claimRank === null}
              onClick={() => onMove({ type: 'play', cards: sel, rank: leading ? rank! : undefined })}
            >{tx('Play')}{' '}{sel.length || ''}{' '}{tx('as')}{' '}{claimRank !== null ? plural(claimRank) : '…'}
            </button>
            {!leading && (
              <button className="btn" onClick={() => onMove({ type: 'pass' })}>{tx('Pass')}</button>
            )}
            {lp && lp.seat !== me && (
              <button className="btn bluff-btn" onClick={() => onMove({ type: 'call' })}>{tx('Bluff! ({name})', { name: players[lp.seat].name })}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const bluff: GameDef<L.BluffState, L.BluffMove, L.BluffView> = {
  id: 'bluff',
  name: 'Bluff',
  tagline: 'Lie with a straight face. Catch the liars.',
  icon: '🤥',
  minPlayers: 2,
  maxPlayers: 8,
  hiddenInfo: true,
  rules:
    'All cards are dealt. The leader names a rank and plays 1–4 cards face down "of that rank" (true or not). Going around, each player plays more cards claiming the same rank, passes, or calls "Bluff!" on the previous play. If it was a lie, the liar takes the whole pile; if it was true, the caller takes it. If everyone passes, the pile is cleared and the last player leads. First to get rid of all their cards wins.',
  setup: L.setup,
  activePlayers: (s) => (s.winner === null ? [s.turn] : []),
  view: L.view,
  move: (s, seat, m) => L.move(s, seat, m),
  result: L.result,
  bot: L.bot,
  botDelay: (s) => (s.reveal ? 2200 : 900),
  Board,
};
