import { useState } from 'react';
import type { BoardProps, GameDef, Seat } from '../../engine/types';
import { cardLabel, rankOf, sortHand, SUIT_NAME, SUIT_SYMBOL, type Card } from '../cards/cards';
import { Hand, Opponent, PlayingCard } from '../cards/CardView';
import * as L from './logic';
import { t as tx } from '../../i18n';

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.DurakView, L.DurakMove>) {
  const [sel, setSel] = useState<Card | null>(null);
  const me = seat as Seat;
  const hand = sortHand(v.hand, v.trump);
  const others = Array.from({ length: v.n - 1 }, (_, k) => ((me + 1 + k) % v.n) as Seat);
  const ranks = L.tableRanks(v.table);
  const myTurn = canMove;
  const unbeaten = v.table.map((p, i) => (p.d === null ? i : -1)).filter((i) => i >= 0);
  const full = v.table.length >= v.limit || (!v.taking && unbeaten.length + 1 > v.handCounts[v.defender]);

  const playable = (c: Card) => {
    if (!myTurn) return false;
    if (v.phase === 'attack') return true;
    if (v.phase === 'throw') return !full && ranks.has(rankOf(c));
    if (v.phase === 'defend') return unbeaten.some((i) => L.canBeat(v.table[i].a, c, v.trump)) || L.canTransfer(v, c);
    return false;
  };

  const clickCard = (c: Card) => {
    if (!playable(c)) return;
    if (v.phase === 'attack') onMove({ type: 'attack', card: c });
    else if (v.phase === 'throw') onMove({ type: 'throw', card: c });
    else if (v.phase === 'defend') {
      const targets = unbeaten.filter((i) => L.canBeat(v.table[i].a, c, v.trump));
      if (!targets.length && L.canTransfer(v, c)) {
        onMove({ type: 'transfer', card: c });
        setSel(null);
      } else if (targets.length === 1 && !L.canTransfer(v, c)) {
        onMove({ type: 'beat', i: targets[0], card: c });
        setSel(null);
      } else setSel(sel === c ? null : c);
    }
  };

  const role = (s: Seat) => (v.out[s] ? 'out ✓' : s === v.attacker ? 'attacking' : s === v.defender ? 'defending' : '');

  let prompt = '';
  if (myTurn) {
    if (v.phase === 'attack') prompt = `Attack ${players[v.defender].name}: play any card.`;
    else if (v.phase === 'defend') prompt = sel !== null ? 'Now pick which card to beat.' : 'Beat each card with a higher card of the same suit or a trump, or take them all.';
    else if (v.phase === 'throw') prompt = v.taking ? `${players[v.defender].name} is taking. Add more cards of the same ranks, or pass.` : 'Throw in another card of a rank on the table, or pass.';
  }

  return (
    <div className="table">
      <div className="opponents">
        {others.map((s) => (
          <Opponent key={s} player={players[s]} seat={s} count={v.handCounts[s]} active={!v.out[s] && (v.phase === 'defend' ? s === v.defender : v.phase === 'attack' ? s === v.attacker : s === v.throwTurn)}>
            <span className="opp-info">{role(s)}</span>
          </Opponent>
        ))}
      </div>

      <div className="felt durak-felt">
        <div className="durak-deck">
          {v.deckCount > 0 ? (
            <>
              <PlayingCard card={v.trumpCard} size="sm" style={{ transform: 'rotate(90deg)', marginRight: -10 }} />
              {v.deckCount > 1 && <PlayingCard back size="sm" />}
              <span className="small">{tx('{deckCount} left', { deckCount: v.deckCount })}</span>
            </>
          ) : (
            <span className="chip">{tx('Trump {SUIT_SYMBOL} {SUIT_NAME} · deck empty', { SUIT_SYMBOL: SUIT_SYMBOL[v.trump], SUIT_NAME: SUIT_NAME[v.trump] })}</span>
          )}
        </div>
        {v.table.length > 0 ? (
          <div className="durak-table">
            {v.table.map((p, i) => (
              <button
                key={p.a}
                className={'durak-pair' + (sel !== null && p.d === null && L.canBeat(p.a, sel, v.trump) ? ' target' : '')}
                onClick={() => {
                  if (sel !== null && p.d === null && L.canBeat(p.a, sel, v.trump)) {
                    onMove({ type: 'beat', i, card: sel });
                    setSel(null);
                  }
                }}
              >
                <PlayingCard card={p.a} />
                {p.d !== null && <PlayingCard card={p.d} style={{ position: 'absolute', left: 16, top: 18 }} />}
              </button>
            ))}
          </div>
        ) : (
          <span className="small muted">
            {v.lastBout ? `${v.lastBout.defender === me ? tx('You') : players[v.lastBout.defender].name} ${v.lastBout.took ? tx('took the cards.') : tx('beat off the attack.')}` : tx('New game.')}
          </span>
        )}
        {v.taking && <span className="chip">{tx('{name} is taking', { name: players[v.defender].name })}</span>}
      </div>

      <div className={'my-seat' + (myTurn ? ' active' : '')}>
        <div className="info-row">
          <span className="opp-name">
            <span className="seat-dot" style={{ background: `var(--p${me})` }} />{' '}{tx('You')}{' '}{role(me) && `· ${role(me)}`}
          </span>
          {prompt && <span className="small">{prompt}</span>}
        </div>
        <Hand cards={hand} size="lg" playable={myTurn ? playable : undefined} selected={(c) => c === sel} onCard={myTurn ? clickCard : undefined} />
        {myTurn && (
          <div className="action-bar">
            {v.phase === 'defend' && (
              <button className="btn" onClick={() => onMove({ type: 'take' })}>{tx('Take the cards')}</button>
            )}
            {v.phase === 'defend' && sel !== null && L.canTransfer(v, sel) && (
              <button className="btn primary" onClick={() => { onMove({ type: 'transfer', card: sel }); setSel(null); }}>
                {tx('↪ Pass it on with {card}', { card: cardLabel(sel) })}
              </button>
            )}
            {v.phase === 'throw' && (
              <button className="btn primary" onClick={() => onMove({ type: 'pass' })}>
                {v.taking ? tx('Done, let them take') : tx('Pass (bito)')}
              </button>
            )}
          </div>
        )}
      </div>
      {v.phase === 'done' && v.durak !== null && <p className="center status">{v.durak === me ? tx('You are the durak! 🤡') : tx('{name} is the durak! 🤡', { name: players[v.durak].name })}</p>}
    </div>
  );
}

export const durak: GameDef<L.DurakState, L.DurakMove, L.DurakView> = {
  id: 'durak',
  name: 'Durak',
  tagline: 'Russian classic: don’t be the last one holding cards.',
  icon: '🛡️',
  minPlayers: 2,
  maxPlayers: 6,
  hiddenInfo: true,
  options: [
    {
      id: 'mode',
      label: 'Variant',
      default: 'throw',
      choices: [
        { value: 'throw', label: 'Throw-in (podkidnoy)' },
        { value: 'transfer', label: 'Pass-on (perevodnoy)' },
      ],
    },
  ],
  rules:
    '36 cards (6 to Ace), 6 each. The bottom card of the deck sets trump. The attacker plays a card; the defender must beat it with a higher card of the same suit or any trump, or take everything. Other players may throw in cards of ranks already on the table (up to 6). If all are beaten, the defender attacks next; if they take, they skip their attack. Everyone refills to 6 from the deck. When the deck runs out, players who empty their hand are safe. The last one with cards is the durak. In the pass-on variant, before beating anything the defender may add a card of the same rank to pass the whole attack on to the next player (if they have enough cards).',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m) => L.move(s, seat, m),
  result: L.result,
  bot: L.bot,
  botDelay: () => 800,
  Board,
};
