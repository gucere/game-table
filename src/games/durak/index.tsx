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
  const selected = sel !== null && v.hand.includes(sel) ? sel : null;

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

  const side = v.sideOnly ? L.sideAttacker(v) : null;
  const role = (s: Seat) =>
    v.out[s] ? tx('out ✓') : s === v.attacker ? tx('attacking') : s === v.defender ? tx('defending') : s === side ? tx('side attacker') : v.sideOnly ? tx('sitting out') : '';

  let prompt = '';
  if (myTurn) {
    if (v.phase === 'attack') prompt = tx('Attack {name}: play any card.', { name: players[v.defender].name });
    else if (v.phase === 'defend') prompt = selected !== null ? tx('Now pick which card to beat.') : tx('Beat each card with a higher card of the same suit or a trump, or take them all.');
    else if (v.phase === 'throw') prompt = v.taking ? tx('{name} is taking. Add more cards of the same ranks, or pass.', { name: players[v.defender].name }) : tx('Throw in another card of a rank on the table, or pass.');
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
            <span className="chip">{tx('Trump {SUIT_SYMBOL} {SUIT_NAME} · deck empty', { SUIT_SYMBOL: SUIT_SYMBOL[v.trump], SUIT_NAME: tx(SUIT_NAME[v.trump]) })}</span>
          )}
        </div>
        {v.table.length > 0 ? (
          <div className="durak-table">
            {v.table.map((p, i) => (
              <button
                key={p.a}
                className={'durak-pair' + (myTurn && v.phase === 'defend' && selected !== null && p.d === null && L.canBeat(p.a, selected, v.trump) ? ' target' : '')}
                disabled={!myTurn || v.phase !== 'defend' || selected === null || p.d !== null || !L.canBeat(p.a, selected, v.trump)}
                onClick={() => {
                  if (myTurn && v.phase === 'defend' && selected !== null && p.d === null && L.canBeat(p.a, selected, v.trump)) {
                    onMove({ type: 'beat', i, card: selected });
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
            {v.lastBout
              ? v.lastBout.defender === me
                ? v.lastBout.took
                  ? tx('You took the cards.')
                  : tx('You beat off the attack.')
                : v.lastBout.took
                  ? tx('{name} took the cards.', { name: players[v.lastBout.defender].name })
                  : tx('{name} beat off the attack.', { name: players[v.lastBout.defender].name })
              : tx('New game.')}
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
        {myTurn && v.phase === 'defend' && v.hand.some((c) => L.canTransfer(v, c)) && (
          <p className="small">{tx('You can also pass the attack on with a card of the same rank.')}</p>
        )}
        <Hand cards={hand} size="lg" playable={myTurn ? playable : undefined} selected={(c) => c === sel} onCard={myTurn ? clickCard : undefined} />
        {myTurn && (
          <div className="action-bar">
            {v.phase === 'defend' && (
              <button className="btn" onClick={() => onMove({ type: 'take' })}>{tx('Take the cards')}</button>
            )}
            {v.phase === 'defend' && selected !== null && L.canTransfer(v, selected) && (
              <button className="btn primary" onClick={() => { onMove({ type: 'transfer', card: selected }); setSel(null); }}>
                {tx('↪ Pass it on with {card}', { card: cardLabel(selected) })}
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
      id: 'attackers',
      label: 'Who may attack',
      default: 'side',
      choices: [
        { value: 'side', label: 'Attacker and side attacker' },
        { value: 'all', label: 'Everyone but the defender' },
      ],
    },
    {
      id: 'passing',
      label: 'Passing the attack on',
      default: 'on',
      choices: [
        { value: 'on', label: 'Allowed (with a card of the same rank)' },
        { value: 'off', label: 'Not allowed' },
      ],
    },
  ],
  rules:
    '36 cards (6 to Ace), 6 each. The bottom card of the deck sets trump, even when all cards are dealt. The attacker plays a card; the defender must beat it with a higher card of the same suit or any trump, or take everything. Who may attack: by default only the attacker and the side attacker (the next player still in the game after the defender) may add cards; you can let everyone except the defender add cards instead. Extra cards must match a rank on the table, up to 6 and no more than the defender can hold off. Passing the attack on (allowed by default): before beating anything, the defender may add a card of the same rank (any suit) to pass the whole attack to the next player, if they have enough cards. The player who passed becomes the attacker and the side attacker changes with the defender. The default is how our friends play: two attackers and passing on allowed. Everyone attacking without passing on is the classic throw-in game. If all are beaten, the defender attacks next; if they take, they skip their attack. Everyone refills to 6 from the deck. When the deck runs out, players who empty their hand are safe. The last one with cards is the durak.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m) => L.move(s, seat, m),
  result: L.result,
  bot: L.bot,
  botDelay: () => 800,
  Board,
};
