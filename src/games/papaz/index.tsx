import type { BoardProps, GameDef, Seat } from '../../engine/types';
import { cardLabel, rankLabel, rankOf } from '../cards/cards';
import { Hand, Opponent, PlayingCard } from '../cards/CardView';
import * as L from './logic';
import { t as tx } from '../../i18n';

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.PapazView, L.PapazMove>) {
  const myTurn = canMove && v.turn === seat && v.target !== null;
  const others = Array.from({ length: v.n - 1 }, (_, k) => ((seat + 1 + k) % v.n) as Seat);
  const name = (s: Seat) => (s === seat ? tx('You') : players[s].name);

  let lastText = '';
  const l = v.last;
  if (l) {
    const vars = { name: name(l.drawer), target: name(l.target), card: l.card !== null ? cardLabel(l.card) : '' };
    const papaz = l.card !== null && rankOf(l.card) === 13;
    if (l.drawer === seat) {
      lastText = l.card !== null ? tx('You drew {card} from {target}.', vars) : tx('You drew a card from {target}.', vars);
      if (papaz) lastText += ' ' + tx('😱 The papaz!');
    } else if (l.target === seat) {
      lastText = l.card !== null ? tx('{name} took your {card}.', vars) : tx('{name} took one of your cards.', vars);
      if (papaz) lastText += ' ' + tx('😌 The papaz is gone!');
    } else {
      lastText = tx('{name} drew a card from {target}.', vars);
    }
    if (l.pair !== null) lastText += ' ' + tx('A pair of {rank} was thrown away.', { rank: rankLabel(l.pair) });
  }

  const reaching = v.target === seat && v.pointing !== null && !v.done;
  const pointed = reaching ? v.hand[v.pointing!] : null;
  const iAmOut = v.out.includes(seat) && !v.done;

  return (
    <div className="table">
      <div className="opponents">
        {others.map((s) => (
          <Opponent key={s} player={players[s]} seat={s} count={v.counts[s]} active={v.turn === s && !v.done}>
            <span className="opp-info">
              {v.out.includes(s) ? tx('safe ✓') : v.target === s && !v.done ? tx('{v} draws from here', { v: name(v.turn) }) : ''}
              {v.loser === s ? tx('holding the papaz 👑') : ''}
            </span>
          </Opponent>
        ))}
      </div>

      <div className="felt">
        <div className="info-row">
          <span className="chip">{tx('Thrown away: {discardCount}', { discardCount: v.discardCount })}</span>
          {v.out.length > 0 && <span className="chip">{tx('Safe: {v}', { v: v.out.map(name).join(', ') })}</span>}
        </div>

        {v.lastPair && (
          <div className="papaz-pair" aria-label={tx('Last pair thrown away')}>
            {v.lastPair.map((c, i) => (
              <PlayingCard key={c} card={c} size="md" style={{ marginLeft: i ? -26 : 0, transform: `rotate(${i ? 8 : -8}deg)` }} />
            ))}
          </div>
        )}

        {myTurn && (
          <div className="stack-sm center">
            <span className="small">{tx('Pick a card from {v}\'s hand. Tap once to reach for it ({v2} can see where your hand is), tap again to take it.', { v: name(v.target!), v2: name(v.target!) })}</span>
            <div className="papaz-fan">
              {Array.from({ length: v.counts[v.target!] }, (_, i) => (
                <button
                  key={i}
                  className={'papaz-pick' + (v.pointing === i ? ' on' : '')}
                  aria-label={tx('Card {v}{v2}', { v: i + 1, v2: v.pointing === i ? ', reaching' : '' })}
                  onClick={() => onMove(v.pointing === i ? { type: 'draw', index: i } : { type: 'point', index: i })}
                >
                  <PlayingCard back size="lg" />
                </button>
              ))}
            </div>
            {v.pointing !== null && (
              <button className="btn primary" onClick={() => onMove({ type: 'draw', index: v.pointing! })}>{tx('Take it')}</button>
            )}
          </div>
        )}

        {!myTurn && !v.done && v.target !== null && (
          <span className="small muted">
            {reaching ? tx('{v} is reaching for one of your cards…', { v: name(v.turn) }) : tx('{v} is drawing from {v2}…', { v: name(v.turn), v2: name(v.target) })}
          </span>
        )}

        {lastText && <p className="small">{lastText}</p>}

        {v.done && v.loser !== null && (
          <div className="stack-sm center">
            {v.papaz !== null && <PlayingCard card={v.papaz} size="lg" />}
            <p className="pisti-flash">{v.loser === seat ? tx('You are left holding the papaz! 👑') : tx('{name} is left holding the papaz! 👑', { name: players[v.loser].name })}</p>
          </div>
        )}
      </div>

      <div className={'my-seat' + (myTurn ? ' active' : '')}>
        <div className="info-row">
          <span className="opp-name">
            <span className="seat-dot" style={{ background: `var(--p${seat})` }} />{' '}{tx('You')}</span>
          <span className="small muted">{iAmOut ? tx('You\'re out of cards: safe! 🎉') : tx('{length} cards', { length: v.hand.length })}</span>
        </div>
        {/* Shown in the order the drawer sees them, so you can watch where their hand goes */}
        <Hand cards={v.hand} size="lg" selected={(c) => c === pointed} />
        {reaching && <span className="small center">{tx('⬆ {v} is reaching for this one', { v: name(v.turn) })}</span>}
      </div>
    </div>
  );
}

export const papaz: GameDef<L.PapazState, L.PapazMove, L.PapazView> = {
  id: 'papaz-kacti',
  name: 'Papaz Kaçtı',
  tagline: "Pass the pairs, dodge the king. Don't be left holding the papaz!",
  icon: '🤴',
  minPlayers: 2,
  maxPlayers: 8,
  defaultPlayers: 4,
  hiddenInfo: true,
  rules:
    'Three of the four kings are taken out of the deck, so the last king (the papaz) has no partner. All cards are dealt and everyone throws away their pairs (two cards of the same rank). Then, in turn, draw one card blind from the next player who still has cards: if it pairs with one of yours, throw the pair away. Run out of cards and you are safe. The last player holding the papaz loses. Tip: when you reach for a card, its owner sees which one, so watch their face (or the chat)!',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  bot: L.bot,
  botDelay: (s) => (s.pointing === null ? 900 : 1300),
  Board,
};
