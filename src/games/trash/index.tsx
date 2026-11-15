import type { BoardProps, GameDef } from '../../engine/types';
import { PlayingCard as CardView } from '../cards/CardView';
import { t as tx } from '../../i18n';
import * as L from './logic';
import './trash.css';

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.TrashView, L.TrashMove>) {
  const available = canMove && v.held !== null ? L.slots(v, seat, v.held) : [];
  const top = v.discard[v.discard.length - 1];
  return <div className="stack">
    <div className="info-row"><span className="chip">{tx('Round {n}', { n: v.round })}</span><span>{tx('Stock: {n}', { n: v.stockCount })}</span></div>
    {v.phase === 'draw' && canMove && <div className="row center-row"><button className="btn primary" onClick={() => onMove({ type: 'draw', source: 'stock' })}>{tx('Draw from stock')}</button>
      <button className="btn" disabled={top === undefined || !L.slots(v, seat, top).length} onClick={() => onMove({ type: 'draw', source: 'discard' })}>{tx('Take the discard')}</button></div>}
    <div className="row center-row">{top !== undefined && <div className="stack-sm center"><span>{tx('Discard')}</span><CardView card={top % 52} /></div>}
      {v.held !== null && <div className="stack-sm center"><span>{tx('Current card')}</span><CardView card={v.held % 52} /></div>}</div>
    {v.phase === 'place' && canMove && (available.length ? <p className="status yours">{tx('Choose a highlighted slot. The card underneath continues your turn.')}</p> : <button className="btn center-self" onClick={() => onMove({ type: 'discard' })}>{tx('Discard and end turn')}</button>)}
    {v.layouts.map((row, p) => <section key={p} className="stack-sm"><strong>{players[p].name} · {tx('{n} slots left', { n: v.sizes[p] })}</strong>
      <div className="trash-layout">{row.map((c, i) => <button key={i} className={'trash-slot' + (p === seat && available.includes(i) ? ' can' : '')} disabled={p !== seat || !available.includes(i)} onClick={() => onMove({ type: 'place', slot: i })} aria-label={tx('{name}, slot {n}', { name: players[p].name, n: i + 1 })}>
        <span className="small">{i === 0 ? 'A' : i + 1}</span><CardView card={c === null ? null : c % 52} />
      </button>)}</div></section>)}
    {v.phase === 'round' && <div className="center stack-sm"><p>{tx('{name} completed their layout!', { name: players[v.roundWinner!].name })}</p>{canMove && <button className="btn primary" onClick={() => onMove({ type: 'next' })}>{tx('Next round')}</button>}</div>}
  </div>;
}
export const garbage: GameDef<L.TrashState, L.TrashMove, L.TrashView> = {
  id: 'garbage', name: 'As’tan On’a', icon: '🔟', tagline: 'Turn over your cards in order, from Ace to Ten.',
  minPlayers: 2, maxPlayers: 6, defaultPlayers: 2, hiddenInfo: false,
  options: [
    { id: 'length', label: 'Game length', default: 'full', choices: [{ value: 'full', label: 'Full: ten slots down to one' }, { value: 'quick', label: 'Quick: first to six slots' }, { value: 'single', label: 'One deal' }] },
    { id: 'wild', label: 'Wild card', default: 'jack', choices: [{ value: 'jack', label: 'Jack' }, { value: 'king', label: 'King' }] },
  ],
  rules: 'Arrange ten face-down cards in two rows. Nobody may peek. Draw from the stock or take a usable discard. Aces fill slot 1; numbers fill their matching slots. Jacks are wild by default (Kings can be selected instead). Replace a face-down card and play the card you uncover. A matching number can also move a wild card to a new empty slot. Discard an unplayable card to end your turn. First to fill every slot wins the deal, loses one slot and starts the next deal. Win the final one-slot deal to win the match. Quick play ends at six slots; One deal ends after the first completed layout.',
  setup: L.setup, move: L.move, activePlayers: L.activePlayers, view: L.view, result: L.result, bot: L.bot, Board,
};
