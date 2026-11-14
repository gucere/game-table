import { useState } from 'react';
import type { BoardProps, GameDef, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';
import { SUIT_SYMBOL, cardLabel, isRed, type Suit } from '../cards/cards';
import { Opponent, PlayingCard } from '../cards/CardView';
import * as L from './logic';

const suitName = (s: Suit) => tx(['Spades', 'Hearts', 'Clubs', 'Diamonds'][s]);

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.PisView, L.PisMove>) {
  const [jack, setJack] = useState<number | null>(null);
  const me = seat as Seat;
  const others = Array.from({ length: v.n - 1 }, (_, k) => ((me + 1 + k) % v.n) as Seat);
  const top = L.top(v);
  const myTurn = canMove && !v.roundOver;
  const hand = [...v.hand].sort((a, b) => L.suit(a) - L.suit(b) || L.rank(a) - L.rank(b));
  const name = (s: number) => (s === me ? tx('You') : players[s].name);

  const lastText = (() => {
    const l = v.last;
    if (!l) return '';
    const who = name(l.seat);
    if (l.kind === 'pass') return tx('{name} passed.', { name: who });
    if (l.kind === 'draw') return tx('{name} drew {n}.', { name: who, n: l.count ?? 1 });
    const c = cardLabel(L.face(l.card!));
    const r = L.rank(l.card!);
    if (r === 11) return tx('{name} played {card} and chose {suit}.', { name: who, card: c, suit: suitName(l.suit!) });
    if (r === 7) return tx('{name} played {card}: draw {n}!', { name: who, card: c, n: v.penalty });
    if (r === 8) return tx('{name} played {card}: the next player is skipped.', { name: who, card: c });
    if (r === 10) return tx('{name} played {card}: direction reversed.', { name: who, card: c });
    return tx('{name} played {card}.', { name: who, card: c });
  })();

  const play = (c: number) => {
    if (!myTurn || !L.canPlay(v, c)) return;
    if (L.rank(c) === 11) setJack(c);
    else onMove({ type: 'play', card: c });
  };

  return (
    <div className="table">
      <div className="opponents">
        {others.map((s) => (
          <Opponent key={s} player={players[s]} seat={s} count={v.counts[s]} active={v.turn === s && !v.roundOver}>
            {v.mode === 'points' && <span className="opp-info small">{tx('{n} pts', { n: v.totals[s] })}</span>}
          </Opponent>
        ))}
      </div>

      <div className="felt">
        <div className="info-row">
          <span className="chip">{v.dir === 1 ? '↻' : '↺'} {tx('Direction')}</span>
          <span className="chip" style={{ color: isRed(v.suit) ? '#e63946' : undefined }}>
            {tx('Suit: {s}', { s: `${SUIT_SYMBOL[v.suit]} ${suitName(v.suit)}` })}
          </span>
          {v.penalty > 0 && <span className="chip trump-chip">{tx('Draw {n} or add a 7!', { n: v.penalty })}</span>}
          {v.mode === 'points' && <span className="chip">{tx('You: {n} pts', { n: v.totals[me] })}</span>}
        </div>
        <div className="py-center">
          <button className="py-stock" disabled={!myTurn || (v.drew && v.penalty === 0)} onClick={() => onMove({ type: 'draw' })} aria-label={tx('Draw')}>
            <PlayingCard back />
            <span className="small">{v.penalty > 0 ? tx('Take {n}', { n: v.penalty }) : tx('Draw')}</span>
            <span className="small muted">{v.stockCount}</span>
          </button>
          <PlayingCard card={L.face(top)} size="lg" />
        </div>
        {lastText && <p className="small center">{lastText}</p>}

        {v.roundOver && v.shown && (
          <div className="stack-sm center">
            <strong>{tx('{name} is out!', { name: name(v.roundWinner!) })}</strong>
            {v.mode === 'points' && v.roundPoints && (
              <div className="info-row">
                {players.map((_, i) => (
                  <span key={i} className="chip">
                    {name(i)}: +{v.roundPoints![i]} → {v.totals[i]}
                  </span>
                ))}
              </div>
            )}
            {!v.over && canMove && (
              <button className="btn primary" onClick={() => onMove({ type: 'next' })}>
                {tx('Next round')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="hand hand-md">
        {hand.map((c) => {
          const ok = myTurn && L.canPlay(v, c);
          return <PlayingCard key={c} card={L.face(c)} dim={myTurn && !ok} onClick={() => play(c)} disabled={!ok} />;
        })}
      </div>
      {myTurn && v.drew && v.penalty === 0 && (
        <div className="row center">
          <button className="btn" onClick={() => onMove({ type: 'pass' })}>
            {tx('Pass')}
          </button>
        </div>
      )}
      {myTurn && <p className="small muted center">{v.penalty > 0 ? tx('Play a 7 to pass it on, or take the cards.') : v.drew ? tx('Play the card you drew if it fits, or pass.') : tx('Match the suit or the rank. A jack goes on anything.')}</p>}

      {jack !== null && (
        <div className="wt-blank-pick" role="dialog" aria-label={tx('Pick a suit')}>
          <p className="small">{tx('Pick a suit')}</p>
          <div className="row center">
            {([0, 1, 2, 3] as Suit[]).map((st) => (
              <button
                key={st}
                className="btn"
                style={{ color: isRed(st) ? '#e63946' : undefined, fontSize: '1.4rem' }}
                onClick={() => {
                  onMove({ type: 'play', card: jack, suit: st });
                  setJack(null);
                }}
                aria-label={suitName(st)}
              >
                {SUIT_SYMBOL[st]}
              </button>
            ))}
          </div>
          <button className="btn ghost small" onClick={() => setJack(null)}>
            {tx('Cancel')}
          </button>
        </div>
      )}
    </div>
  );
}

export const pisYedili: GameDef<L.PisState, L.PisMove, L.PisView> = {
  id: 'pis-yedili',
  name: 'Pis Yedili',
  tagline: 'Match suit or rank, dodge the sevens, be first to empty your hand.',
  icon: '7️⃣',
  minPlayers: 2,
  maxPlayers: 8,
  defaultPlayers: 4,
  hiddenInfo: true,
  options: [
    {
      id: 'mode',
      label: 'Game length',
      default: 'round',
      choices: [
        { value: 'round', label: 'One round' },
        { value: 'points', label: 'Rounds to 101 points' },
      ],
    },
  ],
  rules:
    'Everyone gets 7 cards (two decks with 5 or more players). On your turn, play a card that matches the top card’s suit or rank. If you can’t (or don’t want to), draw one; play it if it fits, otherwise pass. Special cards: 7 makes the next player draw 2 unless they play a 7 too, and then the next draws 4, and so on; 8 skips the next player; 10 reverses the direction; a jack goes on anything and you name the suit to follow. The first to empty their hand wins the round. In the points game, everyone else scores what is left in their hand (jack 25, seven 20, ace 11, pictures and tens 10, others their number); when someone reaches 101, the lowest total wins. House rules vary from place to place; these are a common set.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  bot: L.bot,
  botDelay: () => 900,
  isPrivate: (v) => !v.roundOver,
  Board,
};
