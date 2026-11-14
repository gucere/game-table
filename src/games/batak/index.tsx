import { useState } from 'react';
import type { BoardProps, GameDef, GameOption, Seat } from '../../engine/types';
import { sortHand, SUIT_NAME, SUIT_NAME_TR, SUIT_SYMBOL, isRed, type Card, type Suit } from '../cards/cards';
import { Hand, Opponent, PlayingCard } from '../cards/CardView';
import * as E from './engine';
import { t as tx } from '../../i18n';

function SuitBadge({ suit }: { suit: Suit | null }) {
  if (suit === null) return <span className="chip">{tx('No trump yet')}</span>;
  return (
    <span className="chip trump-chip">{tx('Trump (koz):')}{' '}<b style={{ color: isRed(suit) ? '#ff6b6b' : undefined }}>{SUIT_SYMBOL[suit]}</b> {SUIT_NAME[suit]} ({SUIT_NAME_TR[suit]})
    </span>
  );
}

function makeBoard(cfg: E.BatakConfig) {
  return function BatakBoard({ view: v, seat, players, canMove, onMove }: BoardProps<E.TView, E.TMove>) {
    const [bury, setBury] = useState<Card[]>([]);
    const myTurn = canMove && v.turn === seat;
    const hand = sortHand(v.hand, v.trump);
    const others = Array.from({ length: v.n - 1 }, (_, k) => ((seat + 1 + k) % v.n) as Seat);
    const showTrick = v.trick.length ? v.trick : v.phase === 'play' || v.phase === 'bid' || v.phase === 'draw' ? v.lastTrick?.plays ?? [] : [];
    const showingLast = !v.trick.length && showTrick.length > 0;
    const winnerSeat = showingLast ? v.lastTrick!.winner : null;

    const infoFor = (s: Seat) => {
      const bits: string[] = [];
      if (v.phase === 'bid') {
        if (v.passed[s]) bits.push(tx('passed'));
        else if (v.bids[s]) bits.push(tx('bid {n}', { n: v.bids[s]! }));
      }
      if (v.phase === 'play' || v.phase === 'trump' || v.phase === 'bury') {
        bits.push(tx('{n} tricks', { n: v.tricks[s] ?? 0 }));
        if (cfg.mode === 'targets') bits.push(tx('target {n}', { n: v.targets[s] }));
        else if (v.bidder === s) bits.push(tx('contract {n}', { n: v.contract }));
      }
      if (cfg.teams && s === (seat + 2) % v.n) bits.push(tx('partner'));
      if (s === v.dealer) bits.push(tx('dealer'));
      return bits.join(' · ');
    };

    return (
      <div className="table">
        <div className="opponents">
          {others.map((s) => (
            <Opponent key={s} player={players[s]} seat={s} count={v.handCounts[s]} active={v.turn === s && v.phase !== 'done'}>
              <span className="opp-info">{infoFor(s)}</span>
            </Opponent>
          ))}
        </div>

        <div className="felt">
          <div className="info-row">
            <span className="chip">{tx('Hand {v} / {totalHands}', { v: Math.min(v.handNo + 1, v.totalHands), totalHands: v.totalHands })}
            </span>
            {(v.phase === 'play' || v.phase === 'bury') && <SuitBadge suit={v.trump} />}
            {v.phase === 'play' && cfg.mode === 'auction' && v.bidder !== null && cfg.teams && (
            <span className="chip">
              {tx('{name} & {partner} need {contract} (have {tricks})', {
                name: players[v.bidder].name,
                partner: players[(v.bidder + 2) % v.n].name,
                contract: v.contract,
                tricks: E.sideTricks(cfg, v, v.bidder),
              })}
            </span>
          )}
          {v.phase === 'play' && cfg.mode === 'auction' && v.bidder !== null && !cfg.teams && (
              <span className="chip">
                {tx('{name} needs {contract} (has {tricks})', { name: players[v.bidder].name, contract: v.contract, tricks: v.tricks[v.bidder] })}</span>
            )}
            {v.phase === 'draw' && <span className="chip">{tx('Cards left to draw: {stockCount}', { stockCount: v.stockCount })}</span>}
          </div>

          {showTrick.length > 0 && (
            <div className="trick">
              {showTrick.map((p) => (
                <div key={p.card} className={'trick-slot' + (winnerSeat === p.seat ? ' win' : '')}>
                  <PlayingCard card={p.card} size="lg" />
                  <span>{p.seat === seat ? tx('You') : players[p.seat].name}</span>
                </div>
              ))}
            </div>
          )}
          {showingLast && <span className="small muted">{winnerSeat === seat ? tx('You took') : tx('{name} took', { name: players[winnerSeat!].name })}{' '}{tx('the last trick')}</span>}
          {v.notice && v.phase === 'bid' && <span className="small">{v.notice}</span>}

          {myTurn && v.phase === 'draw' && v.drawCard !== null && (
            <div className="stack-sm center">
              <span className="small">{tx('Top card. Keep it (the next card is thrown away unseen), or throw it away and take the next one blind.')}</span>
              <PlayingCard card={v.drawCard} size="lg" />
              <div className="action-bar">
                <button className="btn primary" onClick={() => onMove({ type: 'keep' })}>{tx('Keep')}</button>
                <button className="btn" onClick={() => onMove({ type: 'skip' })}>{tx('Throw away, take next')}</button>
              </div>
            </div>
          )}

          {myTurn && v.phase === 'bid' && (
            <div className="stack-sm center">
              <span className="small">{v.forcedBid ? tx('Everyone passed: you must bid.') : tx('How many tricks will you take? (The highest bid picks trump and leads.)')}</span>
              <div className="action-bar">
                {Array.from({ length: Math.min(8, cfg.handSize - v.minBid + 1) }, (_, k) => v.minBid + k).map((n) => (
                  <button key={n} className="btn" onClick={() => onMove({ type: 'bid', n })}>
                    {n}
                  </button>
                ))}
                {!v.forcedBid && (
                  <button className="btn ghost" onClick={() => onMove({ type: 'pass' })}>{tx('Pass')}</button>
                )}
              </div>
            </div>
          )}

          {myTurn && v.phase === 'trump' && (
            <div className="stack-sm center">
              <span className="small">{cfg.mode === 'targets' ? tx('You are the dealer: pick trump.') : tx('You won the bid with {contract}. Pick trump.', { contract: v.contract })}</span>
              <div className="action-bar">
                {([0, 1, 2, 3] as Suit[]).map((s) => (
                  <button key={s} className="btn suit-btn" onClick={() => onMove({ type: 'trump', suit: s })} style={{ color: isRed(s) ? '#ff6b6b' : undefined }}>
                    {SUIT_SYMBOL[s]} {SUIT_NAME_TR[s]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {myTurn && v.phase === 'bury' && (
            <div className="stack-sm center">
              <span className="small">
                {cfg.kittyRule === 'dealer'
                  ? tx('Throw away {buryCount} cards; then you get the {buryCount2} cards from the middle.', { buryCount: v.buryCount, buryCount2: v.buryCount })
                  : tx('You took the {buryCount} middle cards. Bury {buryCount2} cards ({length}/{buryCount3}).', { buryCount: v.buryCount, buryCount2: v.buryCount, length: bury.length, buryCount3: v.buryCount })}
              </span>
              <button
                className="btn primary"
                disabled={bury.length !== v.buryCount}
                onClick={() => {
                  onMove({ type: 'bury', cards: bury });
                  setBury([]);
                }}
              >{tx('Bury selected')}</button>
            </div>
          )}

          {!myTurn && v.phase !== 'done' && v.phase !== 'play' && (
            <span className="small muted">
              {v.phase === 'bid' ? tx('Bidding…') : v.phase === 'draw' ? tx('Drawing cards…') : v.phase === 'trump' ? tx('Choosing trump…') : tx('Burying cards…')}
            </span>
          )}
        </div>

        <div className={'my-seat' + (myTurn ? ' active' : '')}>
          <div className="info-row">
            <span className="opp-name">
              <span className="seat-dot" style={{ background: `var(--p${seat})` }} />{' '}{tx('You')}</span>
            <span className="small muted">{infoFor(seat)}</span>
          </div>
          <Hand
            cards={hand}
            size="lg"
            playable={v.phase === 'play' && myTurn ? (c) => v.legal.includes(c) : undefined}
            selected={(c) => bury.includes(c)}
            onCard={
              myTurn && v.phase === 'play'
                ? (c) => onMove({ type: 'play', card: c })
                : myTurn && v.phase === 'bury'
                  ? (c) => setBury((b) => (b.includes(c) ? b.filter((x) => x !== c) : b.length < v.buryCount ? [...b, c] : b))
                  : undefined
            }
          />
        </div>

        <ScoreTable v={v} players={players} cfg={cfg} />
      </div>
    );
  };
}

function ScoreTable({ v, players, cfg }: { v: E.TView; players: { name: string }[]; cfg: E.BatakConfig }) {
  if (!v.history.length) return null;
  return (
    <details className="rules" open={v.phase === 'done'}>
      <summary>{tx('Scores: {v}', { v: players.map((p, i) => `${p.name} ${v.scores[i]}`).join(' · ') })}
      </summary>
      <table className="score-table">
        <thead>
          <tr>
            <th>#</th>
            {cfg.mode === 'auction' && <th>{tx('Contract')}</th>}
            {players.map((p, i) => (
              <th key={i}>{p.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {v.history.map((h, k) => (
            <tr key={k}>
              <td>{k + 1}</td>
              {cfg.mode === 'auction' && (
                <td>
                  {h.bidder !== null ? `${players[h.bidder].name} ${h.contract}` : '–'} {h.trump !== null ? SUIT_SYMBOL[h.trump] : ''}
                </td>
              )}
              {h.delta.map((d, i) => (
                <td key={i} className={h.bidder === i ? 'mine-tag' : ''}>
                  {d > 0 ? `+${d}` : d} <span className="muted">({h.tricks[i]})</span>
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td>Σ</td>
            {cfg.mode === 'auction' && <td />}
            {v.scores.map((x, i) => (
              <td key={i}>
                <b>{x}</b>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </details>
  );
}

function makeGame(
  cfg: E.BatakConfig,
  meta: { name: string; tagline: string; icon: string; rules: string; hands: GameOption },
): GameDef<E.TState, E.TMove, E.TView> {
  return {
    id: cfg.id,
    name: meta.name,
    tagline: meta.tagline,
    icon: meta.icon,
    minPlayers: cfg.players,
    maxPlayers: cfg.players,
    hiddenInfo: true,
    options: [meta.hands],
    rules: meta.rules,
    setup: (ctx) => E.setupWith(cfg, ctx),
    activePlayers: (s) => (s.phase === 'done' ? [] : [s.turn]),
    view: (s, seat) => E.viewOf(cfg, s, seat),
    move: (s, seat, m, ctx) => E.applyMove(cfg, s, seat, m, ctx.random),
    result: (s) => E.resultOf(s, cfg),
    bot: (v, _seat, ctx) => E.botMove(cfg, v, ctx),
    botDelay: (s) => (s.phase === 'play' && !s.trick.length && s.lastTrick ? 1600 : 750),
    Board: makeBoard(cfg),
  };
}

const handsOption = (values: number[], def: number): GameOption => ({
  id: 'hands',
  label: 'Number of hands',
  default: String(def),
  choices: values.map((v) => ({ value: String(v), label: `${v} hands` })),
});

const OBLIGATIONS =
  'Follow suit if you can, and play higher than the best card of that suit on the table if you can. If you are out of that suit you must trump (and over-trump if you can). Trumps cannot be led until someone has trumped.';

export const batak = makeGame(
  { id: 'batak', players: 4, handSize: 13, kitty: 0, mode: 'auction', kittyRule: 'none', draw: false, minBid: 5, mustBeat: true, mustTrump: true, trumpLead: true },
  {
    name: 'Batak',
    tagline: 'Bid for tricks, pick trump, don’t sink.',
    icon: '♠️',
    hands: handsOption([4, 8, 12], 4),
    rules: `4 players, 13 cards each. Players bid how many tricks they will take (minimum 5); the highest bidder picks trump and leads.\n${OBLIGATIONS}\nScoring: the bidder scores their tricks if they make the contract, otherwise loses the bid amount. Everyone else scores the tricks they took.`,
  },
);

export const esliBatak = makeGame(
  { id: 'esli-batak', players: 4, handSize: 13, kitty: 0, mode: 'auction', kittyRule: 'none', draw: false, minBid: 7, mustBeat: true, mustTrump: true, trumpLead: true, teams: true },
  {
    name: 'Eşli Batak',
    tagline: 'Partners Batak: bid together, sink together.',
    icon: '🤝',
    hands: handsOption([4, 8, 12], 4),
    rules: `4 players in two teams; partners sit opposite. 13 cards each. Bid how many tricks your team will take (minimum 7); the highest bidder picks trump and leads.\n${OBLIGATIONS}\nScoring: if the bidder and partner together reach the contract, both score the tricks they took; if not, the bidder loses the bid amount and the partner scores nothing. The other team scores its tricks. Highest team total wins.`,
  },
);

export const balayi = makeGame(
  { id: 'balayi-batagi', players: 2, handSize: 13, kitty: 0, mode: 'auction', kittyRule: 'none', draw: true, minBid: 7, mustBeat: true, mustTrump: true, trumpLead: true },
  {
    name: 'Balayı Batağı',
    tagline: 'Two-player Batak with a drafting phase.',
    icon: '💞',
    hands: handsOption([4, 6, 10], 4),
    rules: `2 players. Instead of a deal, take turns looking at the top card of the deck: keep it (the next card is discarded unseen) or discard it and take the next card blind. After 13 cards each, bid (minimum 7), pick trump and play 13 tricks.\n${OBLIGATIONS}\nScoring as in Batak.`,
  },
);

export const ucBesSekiz = makeGame(
  {
    id: '3-5-8',
    players: 3,
    handSize: 16,
    kitty: 4,
    mode: 'targets',
    kittyRule: 'dealer',
    draw: false,
    minBid: 0,
    mustBeat: false,
    mustTrump: false,
    trumpLead: false,
    targets: [8, 5, 3],
  },
  {
    name: '3-5-8',
    tagline: 'Three players, fixed targets: 8, 5 and 3 tricks.',
    icon: '🃏',
    hands: handsOption([3, 6, 9], 6),
    rules:
      '3 players, 16 cards each, 4 in the middle. The dealer must take 8 tricks, the player on their left 5, the other 3. The dealer picks trump, throws away 4 cards, then takes the 4 middle cards. The player left of the dealer leads.\nFollow suit if you can; otherwise play anything. Each hand you score tricks taken minus your target.',
  },
);

export const ucluGommeli = makeGame(
  { id: 'uclu-gommeli', players: 3, handSize: 16, kitty: 4, mode: 'auction', kittyRule: 'bidder', draw: false, minBid: 6, mustBeat: true, mustTrump: true, trumpLead: true },
  {
    name: "3'lü Gömmeli",
    tagline: 'Three-player Batak with buried cards.',
    icon: '🂠',
    hands: handsOption([3, 6, 9], 6),
    rules: `3 players, 16 cards each, 4 face down in the middle. Bid for tricks (minimum 6). The winner takes the 4 middle cards, buries 4 cards (gömme), picks trump and leads.\n${OBLIGATIONS}\nScoring as in Batak.`,
  },
);
