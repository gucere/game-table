import { useState } from 'react';
import type { BoardProps, GameDef, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';
import { cardLabel, rankLabel } from '../cards/cards';
import { PlayingCard } from '../cards/CardView';
import * as L from './logic';

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.TrashView, L.TrashMove>) {
  const [swapCard, setSwapCard] = useState<number | null>(null);
  const me = seat as Seat;
  const name = (s: number) => (s === me ? tx('You') : players[s].name);
  const others = [1, 2, 3].map((k) => ((me + k) % L.PLAYERS) as Seat);
  const myTurn = canMove && v.phase === 'play' && v.turn === me;
  const z = L.zone({ up: v.up, stock: [], handCounts: v.handCounts }, me);
  const eff = L.effective(v.pile);
  const hand = [...v.hand].sort((a, b) => L.ORDER.indexOf(L.rank(a)) - L.ORDER.indexOf(L.rank(b)) || L.rank(a) - L.rank(b));
  const anyUpFits = v.up[me].some((c) => c !== null && L.legal(c, v.pile));

  const lastText = (() => {
    if (v.reveal) {
      const c = cardLabel(v.reveal.card);
      return v.reveal.from === 'up' ? tx('{name} played face-up {card} — picks up.', { name: name(v.reveal.seat), card: c }) : tx('{name} flipped {card} — picks up.', { name: name(v.reveal.seat), card: c });
    }
    const l = v.last;
    if (!l) return '';
    if (l.kind === 'pickup') return tx('{name} picked up the pile ({n} cards).', { name: name(l.seat), n: l.count ?? 0 });
    if (l.kind === 'trash') return tx('{name} played a 10: Trash! The pile is gone.', { name: name(l.seat) });
    return tx('{name} played {card}.', { name: name(l.seat), card: cardLabel(l.card!) });
  })();

  const Area = ({ s, mine }: { s: Seat; mine: boolean }) => (
    <div className="tp-area">
      <div className="tp-slots">
        {[0, 1, 2].map((k) => {
          const up = v.up[s][k];
          const down = v.down[s][k];
          const canUp = mine && myTurn && z === 'up' && up !== null && (L.legal(up, v.pile) || !anyUpFits);
          const canFlip = mine && myTurn && z === 'down' && down;
          const swapping = mine && v.phase === 'swap' && !v.ready[me] && swapCard !== null && up !== null;
          return (
            <div key={k} className="tp-slot">
              {down && <PlayingCard back size="sm" onClick={canFlip ? () => onMove({ type: 'flip', slot: k }) : undefined} disabled={!canFlip} highlight={!!canFlip} />}
              {up !== null && (
                <span className="tp-up">
                  <PlayingCard
                    card={up}
                    size="sm"
                    highlight={canUp || swapping}
                    onClick={
                      canUp
                        ? () => onMove({ type: 'up', slot: k })
                        : swapping
                          ? () => {
                              onMove({ type: 'swap', card: swapCard!, slot: k });
                              setSwapCard(null);
                            }
                          : undefined
                    }
                    disabled={!(canUp || swapping)}
                  />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="table tp">
      <div className="opponents">
        {others.map((s) => (
          <div key={s} className={'opponent' + (v.turn === s && v.phase === 'play' ? ' active' : '')}>
            <div className="opp-name">
              <span className="seat-dot" style={{ background: `var(--p${s})` }} /> {players[s].name}
              {players[s].kind === 'bot' && ' 🤖'} · 🏆 {v.wins[s]}
            </div>
            <span className="small muted">
              {tx('{n} in hand', { n: v.handCounts[s] })}
              {v.phase === 'swap' && (v.ready[s] ? ' · ✓' : ` · ${tx('swapping…')}`)}
            </span>
            <Area s={s} mine={false} />
          </div>
        ))}
      </div>

      <div className="felt">
        <div className="info-row">
          <span className="chip">{tx('Round {n}', { n: v.round })}</span>
          <span className="chip">🂠 {tx('Stock: {n}', { n: v.stockCount })}</span>
          <span className="chip">🗑️ {tx('Trashed: {n}', { n: v.trashed })}</span>
          <span className="chip">{eff === L.ANY ? tx('Anything goes') : tx('Beat: {r} or higher', { r: rankLabel(eff) })}</span>
        </div>
        <div className="tp-pile">
          {v.pile.length ? v.pile.slice(-4).map((c, i) => <PlayingCard key={`${c}-${i}`} card={c} size="md" style={{ marginLeft: i ? -34 : 0 }} highlight={!!v.reveal && i === Math.min(3, v.pile.length - 1)} />) : <span className="small muted">{tx('Empty pile: any card can start it.')}</span>}
        </div>
        {lastText && <p className={'small center' + (v.reveal ? ' tp-reveal' : '')}>{lastText}</p>}
        {v.phase === 'roundover' && v.winner !== null && (
          <div className="stack-sm center">
            <strong>{tx('{name} is out of cards and wins the round! 🎉', { name: name(v.winner) })}</strong>
            <div className="info-row">
              {players.map((_p, i) => (
                <span key={i} className="chip">
                  {name(i)}: 🏆 {v.wins[i]} · {tx('{n} cards left', { n: v.handCounts[i] + v.up[i].filter((c) => c !== null).length + v.down[i].filter(Boolean).length })}
                </span>
              ))}
            </div>
            {canMove && (
              <button className="btn primary" onClick={() => onMove({ type: 'next' })}>
                {tx('Play again')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className={'my-seat' + (myTurn ? ' active' : '')}>
        <div className="info-row">
          <span className="opp-name">
            {tx('You')} · 🏆 {v.wins[me]}
          </span>
          {v.phase === 'swap' && !v.ready[me] && <span className="small">{tx('Swap: tap a card in your hand, then one of your face-up cards. Press Ready when happy.')}</span>}
          {myTurn && <span className="small">{z === 'hand' ? tx('Play one card from your hand, equal or higher, or pick up the pile.') : z === 'up' ? tx('Your hand is empty: play a face-up card.') : tx('Flip one of your face-down cards and hope!')}</span>}
        </div>
        <Area s={me} mine />
        <div className="hand hand-md">
          {hand.map((c) => {
            const ok = myTurn && z === 'hand' && L.legal(c, v.pile);
            const swap = v.phase === 'swap' && !v.ready[me];
            return (
              <PlayingCard
                key={c}
                card={c}
                selected={swapCard === c}
                dim={myTurn && z === 'hand' && !ok}
                onClick={ok ? () => onMove({ type: 'play', card: c }) : swap ? () => setSwapCard(swapCard === c ? null : c) : undefined}
                disabled={!(ok || swap)}
              />
            );
          })}
        </div>
        <div className="action-bar">
          {v.phase === 'swap' && !v.ready[me] && canMove && (
            <button className="btn primary" onClick={() => onMove({ type: 'ready' })}>
              ✓ {tx('Ready')}
            </button>
          )}
          {myTurn && v.pile.length > 0 && (
            <button className="btn" onClick={() => onMove({ type: 'pickup' })}>
              {tx('Pick up the pile ({n})', { n: v.pile.length })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const trashPile: GameDef<L.TrashState, L.TrashMove, L.TrashView> = {
  id: 'trash',
  name: 'Trash',
  tagline: 'Four players, one card a turn: beat the pile, trash it with a 10, be first out.',
  icon: '🗑️',
  minPlayers: 4,
  maxPlayers: 4,
  defaultPlayers: 4,
  hiddenInfo: true,
  rules:
    'Always four players (bots fill empty seats) and one deck. Everyone gets 3 face-down cards, 3 face-up cards on top of them and 4 in hand; 12 cards make the stock. Before play, swap cards between your hand and your face-up cards as you like, then press Ready. A random player starts each round. On your turn play exactly one card, equal or higher than the pile (3 4 5 6 7 9 J Q K A), or pick up the whole pile. Specials go on anything: 2 resets (anything may follow), 8 copies the card under it (look through 8s), 10 trashes the whole pile and the next player starts a new one. After playing, draw one card if the stock has cards and you hold 3 or fewer. With your hand empty and the stock gone, play your face-up cards (a fitting one if you can; if none fits, it is shown and you pick up the pile with it), then flip your face-down cards blind (if it doesn’t fit, it is shown and you pick up). The first player with no cards left wins the round. Wins are counted for each seat round after round.',
  setup: (ctx) => L.setup(ctx),
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  bot: L.bot,
  botDelay: (s) => (s.phase === 'roundover' ? 7000 : s.phase === 'swap' ? 700 : 1250),
  isPrivate: (v) => v.phase !== 'roundover',
  timer: (s) => s.deadline,
  onTimer: (s) => L.onTimer(s),
  Board,
};
