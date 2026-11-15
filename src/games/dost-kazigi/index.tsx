import { useState } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import { Hand, PlayingCard } from '../cards/CardView';
import { cardLabel } from '../cards/cards';
import { t as tx } from '../../i18n';
import * as L from './logic';

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.DostView, L.DostMove>) {
  const [selected, setSelected] = useState<number | null>(null);
  const [source, setSource] = useState<L.Source | null>(null);
  const card = selected !== null && v.hand.includes(selected) ? selected : null;
  const choices = card === null ? [] : L.sources(v, seat, card);
  const matchKey = (s: L.Source) => s.kind === 'table' ? `t${s.index}` : `p${s.seat}`;
  const currentSource = source && choices.find((s) => matchKey(s) === matchKey(source));
  const mustMatch = v.hand.some((c) => L.sources(v, seat, c).length > 0);
  const play = (target?: number) => {
    if (!canMove || card === null) return;
    onMove({ type: 'play', card, ...(currentSource ? { source: currentSource, target } : {}) }); setSelected(null); setSource(null);
  };
  return <div className="stack">
    <div className="info-row"><span className="chip">{tx('Round {n}', { n: v.round })} / {v.rounds}</span><span>{tx('Stock: {n}', { n: v.stockCount })}</span></div>
    <div className="row" style={{ flexWrap: 'wrap' }}>{v.piles.map((pile, p) => <div className="panel stack-sm" key={p}><strong>{players[p].name}</strong>
      <span>{tx('Penalty: {n}', { n: L.pileScore(pile) })} · {tx('Total: {n}', { n: v.scores[p] })}</span>
      {pile.length > 0 ? <PlayingCard card={pile[pile.length - 1]} size="sm" /> : <span className="muted">{tx('No penalty cards')}</span>}
      <span className="small">{tx('{n} cards in hand', { n: v.handCounts[p] })}</span></div>)}</div>
    <section className="stack-sm"><strong>{tx('Cards on the table')}</strong><div className="row" style={{ flexWrap: 'wrap' }}>{v.table.map((c) => <PlayingCard key={c} card={c} size="sm" />)}</div></section>
    {canMove && v.phase === 'play' && <p className="status yours">{tx(mustMatch ? 'You have a match: choose a card, its source, then a recipient.' : 'No matches: choose a card to leave on the table.')}</p>}
    <Hand cards={v.hand} selected={(c) => c === card} playable={(c) => canMove && (!mustMatch || L.sources(v, seat, c).length > 0)} onCard={(c) => { setSelected(c); setSource(null); }} />
    {canMove && card !== null && v.phase === 'play' && <div className="stack-sm">
      {!!choices.length && <div className="row" style={{ flexWrap: 'wrap' }}>{choices.map((s) => <button key={matchKey(s)} className={'btn' + (currentSource && matchKey(currentSource) === matchKey(s) ? ' primary' : '')} onClick={() => setSource(s)}>
        {s.kind === 'table' ? tx('Table: {card}', { card: cardLabel(v.table[s.index]) }) : tx('{name}’s penalty pile', { name: players[s.seat].name })}</button>)}</div>}
      {currentSource && <div className="row" style={{ flexWrap: 'wrap' }}>{L.targets(v, seat, currentSource).map((p) => <button className="btn primary" key={p} onClick={() => play(p)}>{tx('Give to {name}', { name: players[p].name })}</button>)}</div>}
      {!choices.length && !mustMatch && <button className="btn primary" onClick={() => play()}>{tx('Leave on the table')}</button>}
    </div>}
    {v.phase === 'round' && canMove && <button className="btn primary" onClick={() => onMove({ type: 'next' })}>{tx('Next round')}</button>}
  </div>;
}
export const dostKazigi: GameDef<L.DostState, L.DostMove, L.DostView> = {
  id: 'dost-kazigi', name: 'Dost Kazığı', icon: '🃏', tagline: 'Match cards and pass the penalties to your friends.',
  minPlayers: 2, maxPlayers: 4, defaultPlayers: 4, hiddenInfo: true,
  options: [{ id: 'rounds', label: 'Rounds', default: '1', choices: [{ value: '1', label: '1' }, { value: '3', label: '3' }, { value: '5', label: '5' }] }],
  rules: 'One deck, four cards on the table and four per player. If you can match a rank, you must: combine your card with one matching table card, or the same-rank group on top of a penalty pile. Send those cards to another player (not the source of a transferred pile). You can move your own penalty cards this way. With no match in hand, leave any card on the table. Refill everyone with four when hands are empty. At the end of the deck, score penalty piles: 3 = 30, Jack = 20, Ace/Queen/King = 10, others their number. Unmatched table cards score nothing. Lowest total across the selected rounds wins; ties share victory. Turns proceed in seat order.',
  setup: L.setup, move: L.move, view: L.view, result: L.result, activePlayers: L.activePlayers, bot: L.bot, Board,
};
