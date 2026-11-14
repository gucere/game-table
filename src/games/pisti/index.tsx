import type { BoardProps, GameDef, PlayerInfo, Seat } from '../../engine/types';
import { cardLabel, sortByRank } from '../cards/cards';
import { Hand, Opponent, PlayingCard } from '../cards/CardView';
import * as L from './logic';
import { t as tx } from '../../i18n';

function sideName(v: L.PistiView, side: number, players: PlayerInfo[], me: Seat) {
  const nm = (s: Seat) => (s === me ? 'You' : players[s].name);
  if (!v.teams) return nm(side);
  return `${nm(side)} & ${nm(side + 2)}`;
}

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.PistiView, L.PistiMove>) {
  const myTurn = canMove && v.turn === seat;
  const others = Array.from({ length: v.n - 1 }, (_, k) => ((seat + 1 + k) % v.n) as Seat);
  const sides = v.scores.map((_, i) => i);
  const mySide = v.teams ? seat % 2 : seat;

  const lastText = (() => {
    const l = v.last;
    if (!l) return '';
    const vars = { name: players[l.seat].name, card: cardLabel(l.card), n: l.pisti || l.took || 0 };
    const mine = l.seat === seat;
    if (l.pisti) return mine ? tx('You played {card} and made a PİŞTİ! +{n} 🎉', vars) : tx('{name} played {card} and made a PİŞTİ! +{n} 🎉', vars);
    if (l.took) return mine ? tx('You played {card} and took {n} cards.', vars) : tx('{name} played {card} and took {n} cards.', vars);
    return mine ? tx('You played {card}.', vars) : tx('{name} played {card}.', vars);
  })();

  return (
    <div className="table">
      <div className="opponents">
        {others.map((s) => (
          <Opponent key={s} player={players[s]} seat={s} count={v.handCounts[s]} active={v.turn === s && v.phase !== 'done'}>
            <span className="opp-info">
              {tx('{capturedCounts} taken', { capturedCounts: v.capturedCounts[s] })}{v.pisti[s] ? tx(' · pişti {pisti}', { pisti: v.pisti[s] }) : ''}
              {v.teams && s % 2 === mySide ? tx(' · partner') : ''}
            </span>
          </Opponent>
        ))}
      </div>

      <div className="felt">
        <div className="info-row">
          <span className="chip">{tx('Deck: {stockCount}', { stockCount: v.stockCount })}</span>
          <span className="chip">{v.target ? tx('Playing to {target}', { target: v.target }) : tx('Single deal')}</span>
          {sides.map((i) => (
            <span key={i} className={'chip' + (i === mySide ? ' trump-chip' : '')}>
              {sideName(v, i, players, seat)}: {v.scores[i]}
            </span>
          ))}
        </div>

        <div className="pisti-pile" aria-label={tx('Pile: {pileCount} cards', { pileCount: v.pileCount })}>
          {v.pileCount === 0 ? (
            <span className="pisti-empty small muted">{tx('Empty table')}</span>
          ) : (
            <>
              {Array.from({ length: Math.min(3, v.pileCount - 1) }, (_, i) => (
                <PlayingCard key={i} back size="lg" style={{ position: 'absolute', transform: `rotate(${(i - 1) * 9}deg)` }} />
              ))}
              {v.top !== null && <PlayingCard card={v.top} size="lg" style={{ position: 'relative' }} />}
            </>
          )}
        </div>
        <span className="small muted">{tx('{pileCount} card', { pileCount: v.pileCount })}{v.pileCount === 1 ? '' : 's'}{' '}{tx('on the table')}</span>
        {lastText && <p className={'small' + (v.last?.pisti ? ' pisti-flash' : '')}>{lastText}</p>}
      </div>

      <div className={'my-seat' + (myTurn ? ' active' : '')}>
        <div className="info-row">
          <span className="opp-name">
            <span className="seat-dot" style={{ background: `var(--p${seat})` }} />{' '}{tx('You')}</span>
          <span className="small muted">
            {tx('{capturedCounts} taken', { capturedCounts: v.capturedCounts[seat] })}{v.pisti[seat] ? tx(' · pişti {pisti}', { pisti: v.pisti[seat] }) : ''}
          </span>
        </div>
        <Hand cards={sortByRank(v.hand)} size="lg" onCard={myTurn ? (c) => onMove({ type: 'play', card: c }) : undefined} />
        {myTurn && <span className="small muted center">{tx('Match the top card or play a jack (J) to take the pile.')}</span>}
      </div>

      {v.history.length > 0 && (
        <details className="rules" open={v.phase === 'done'}>
          <summary>{tx('Deals: {v}', { v: sides.map((i) => `${sideName(v, i, players, seat)} ${v.scores[i]}`).join(' · ') })}</summary>
          <table className="score-table">
            <thead>
              <tr>
                <th>#</th>
                {sides.map((i) => (
                  <th key={i}>{sideName(v, i, players, seat)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {v.history.map((h, k) => (
                <tr key={k}>
                  <td>{k + 1}</td>
                  {h.total.map((t, i) => (
                    <td key={i} title={tx('{cards} cards · card points {points} · pişti {pisti} · most cards {most}', { cards: h.cards[i], points: h.points[i], pisti: h.pisti[i], most: h.most[i] })}>
                      +{t}{' '}
                      <span className="muted small">{tx('({cards} cards', { cards: h.cards[i] })}{h.pisti[i] ? tx(', pişti {pisti}', { pisti: h.pisti[i] }) : ''}
                        {h.most[i] ? tx(', most') : ''})
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

export const pisti: GameDef<L.PistiState, L.PistiMove, L.PistiView> = {
  id: 'pisti',
  name: 'Pişti',
  tagline: 'Match the top card, grab the pile, shout "Pişti!"',
  icon: '🎴',
  minPlayers: 2,
  maxPlayers: 4,
  hiddenInfo: true,
  options: [
    {
      id: 'target',
      label: 'Play to',
      default: '101',
      choices: [
        { value: '0', label: 'One deal' },
        { value: '51', label: '51 points' },
        { value: '101', label: '101 points' },
        { value: '151', label: '151 points' },
      ],
    },
    {
      id: 'teams',
      label: 'With 4 players',
      default: 'teams',
      choices: [
        { value: 'teams', label: 'Partners sit opposite' },
        { value: 'solo', label: 'Everyone for themselves' },
      ],
    },
  ],
  rules:
    'Four cards go on the table (only the top one face up) and everyone gets four. Take turns playing one card onto the pile. If it matches the rank of the top card, or it is a jack (J), you take the whole pile. Taking a single card by matching it is a pişti: 10 points, or 20 for a jack on a jack. When hands run out, four more are dealt until the deck is empty; leftover table cards go to whoever took last. Scoring per deal: each ace and jack 1, 2♣ 2, 10♦ 3, most cards 3, plus pişti points.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  bot: L.bot,
  botDelay: () => 900,
  Board,
};
