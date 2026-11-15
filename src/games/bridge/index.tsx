import type { BoardProps, GameDef, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';
import { cardLabel, sortHand, type Card } from '../cards/cards';
import { Hand, PlayingCard } from '../cards/CardView';
import * as L from './logic';

const DIR_NAME = ['North', 'East', 'South', 'West'];
const strainColor = (s: L.Strain) => (s === 'H' || s === 'D' ? '#e63946' : undefined);

function callLabel(c: L.Call) {
  if (c.type === 'bid') return `${c.level}${L.STRAIN_LABEL[c.strain]}`;
  return c.type === 'pass' ? tx('Pass') : c.type === 'double' ? 'X' : 'XX';
}

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.BridgeView, L.BridgeMove>) {
  const me = seat as Seat;
  const name = (s: number) => `${tx(DIR_NAME[s])} · ${s === me ? tx('You') : players[s].name}`;
  // Me at the bottom, partner on top
  const at = (k: number) => ((me + k) % 4) as Seat;
  const contract = v.contract;
  const trump = contract ? L.trumpOf(contract.strain) : null;
  const declarer = contract?.declarer ?? null;
  const dummy = contract?.dummy ?? null;
  const playingFor = v.phase === 'play' && canMove ? v.turn : null;
  const iPlayDummy = playingFor !== null && playingFor === dummy && declarer === me;

  const vul = (t: 0 | 1) => (v.vulnerable[t] ? ' 🔴' : '');
  const trickCard = (s: Seat) => v.trick.find((p) => p.seat === s)?.card;

  const handFor = (cards: Card[], clickable: boolean) => (
    <Hand cards={sortHand(cards, trump)} size="md" playable={clickable ? (c) => v.legal.includes(c) : undefined} onCard={clickable ? (c) => onMove({ type: 'play', card: c }) : undefined} />
  );

  const seatBox = (s: Seat, pos: 'top' | 'left' | 'right') => (
    <div className={'br-seat br-' + pos + (v.turn === s && v.phase !== 'between' && v.phase !== 'done' ? ' active' : '')}>
      <span className="small">
        {name(s)}
        {s === declarer && ` · ${tx('declarer')}`}
        {s === dummy && ` · ${tx('dummy')}`}
      </span>
      {s === dummy && v.dummyHand ? handFor(v.dummyHand, iPlayDummy) : <span className="small muted">{tx('{n} cards', { n: v.handCounts[s] })}</span>}
    </div>
  );

  return (
    <div className="table br">
      <div className="info-row">
        <span className="chip">{tx('Board {n} / {m}', { n: v.board, m: v.deals })}</span>
        <span className="chip">
          {tx('N–S')}
          {vul(0)}: {v.scores[0]}
        </span>
        <span className="chip">
          {tx('E–W')}
          {vul(1)}: {v.scores[1]}
        </span>
        <span className="chip">{tx('Dealer: {d}', { d: tx(DIR_NAME[v.dealer]) })}</span>
        {contract && (
          <span className="chip trump-chip">
            {L.contractLabel(contract)} {tx('by {d}', { d: tx(DIR_NAME[contract.declarer]) })} · {tx('Tricks: {a}–{b}', { a: v.tricks[L.team(contract.declarer)], b: v.tricks[1 - L.team(contract.declarer)] })}
          </span>
        )}
      </div>

      {v.phase === 'auction' && (
        <div className="stack-sm center">
          <table className="br-auction">
            <thead>
              <tr>
                {[0, 1, 2, 3].map((s) => (
                  <th key={s}>
                    {tx(DIR_NAME[s])}
                    {s === me && ` (${tx('you')})`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const cells: (L.Call | null)[] = Array(v.dealer).fill(null);
                for (const a of v.auction) cells.push(a.call);
                const rows: (L.Call | null)[][] = [];
                for (let i = 0; i < cells.length; i += 4) rows.push(cells.slice(i, i + 4));
                return rows.map((r, i) => (
                  <tr key={i}>
                    {[0, 1, 2, 3].map((k) => (
                      <td key={k} style={{ color: r[k]?.type === 'bid' ? strainColor((r[k] as { strain: L.Strain }).strain) : undefined }}>
                        {r[k] ? callLabel(r[k]!) : ''}
                      </td>
                    ))}
                  </tr>
                ));
              })()}
            </tbody>
          </table>
          {canMove ? (
            <div className="br-bidbox">
              <div className="br-bids">
                {[1, 2, 3, 4, 5, 6, 7].map((level) =>
                  L.STRAINS.map((strain) => {
                    const ok = !v.highest || L.bidRank({ level, strain }) > L.bidRank(v.highest);
                    return (
                      <button key={`${level}${strain}`} className="btn small" disabled={!ok} style={{ color: ok ? strainColor(strain) : undefined }} onClick={() => onMove({ type: 'bid', level, strain })}>
                        {level}
                        {L.STRAIN_LABEL[strain]}
                      </button>
                    );
                  }),
                )}
              </div>
              <div className="row center">
                <button className="btn primary" onClick={() => onMove({ type: 'pass' })}>
                  {tx('Pass')}
                </button>
                <button className="btn" disabled={!L.canDouble(v, me)} onClick={() => onMove({ type: 'double' })}>
                  {tx('Double')} (X)
                </button>
                <button className="btn" disabled={!L.canRedouble(v, me)} onClick={() => onMove({ type: 'redouble' })}>
                  {tx('Redouble')} (XX)
                </button>
              </div>
            </div>
          ) : (
            <p className="small muted">{tx('Waiting for {name} to bid…', { name: name(v.turn) })}</p>
          )}
        </div>
      )}

      {v.phase === 'play' && (
        <div className="br-compass">
          {seatBox(at(2), 'top')}
          {seatBox(at(3), 'left')}
          <div className="br-trick">
            {(['top', 'left', 'right', 'bottom'] as const).map((pos, k) => {
              const c = trickCard(at([2, 3, 1, 0][k]));
              return (
                <span key={pos} className={'br-slot br-slot-' + pos}>
                  {c !== undefined ? <PlayingCard card={c} size="sm" /> : null}
                </span>
              );
            })}
          </div>
          {seatBox(at(1), 'right')}
        </div>
      )}

      {(v.phase === 'between' || v.phase === 'done') && v.history.length > 0 && (
        <div className="stack-sm center">
          {(() => {
            const d = v.history[v.history.length - 1];
            if (!d.contract) return <p>{tx('Everyone passed: no score on this board.')}</p>;
            const t = L.team(d.contract.declarer);
            const got = d.tricks[t];
            const need = d.contract.level + 6;
            return (
              <p>
                {L.contractLabel(d.contract)} {tx('by {d}', { d: tx(DIR_NAME[d.contract.declarer]) })}:{' '}
                {got >= need ? tx('made with {n} tricks', { n: got }) : tx('down {n}', { n: need - got })} · {tx('N–S')} {d.delta[0] >= 0 ? '+' : ''}
                {d.delta[0]}
              </p>
            );
          })()}
          {v.phase === 'between' && canMove && (
            <button className="btn primary" onClick={() => onMove({ type: 'next' })}>
              {tx('Next board')}
            </button>
          )}
        </div>
      )}

      <div className={'my-seat' + (canMove && !iPlayDummy ? ' active' : '')}>
        <div className="info-row">
          <span className="opp-name">
            {name(me)}
            {me === declarer && ` · ${tx('declarer')}`}
            {me === dummy && ` · ${tx('dummy')}`}
          </span>
          {iPlayDummy && <span className="small">{tx('You are declarer: play a card from dummy (above).')}</span>}
          {me === dummy && v.phase === 'play' && <span className="small muted">{tx('You are dummy: your partner plays your cards.')}</span>}
        </div>
        {v.phase === 'play' && me === dummy && v.dummyHand
          ? handFor(v.dummyHand, false)
          : handFor(v.hand, v.phase === 'play' && canMove && !iPlayDummy)}
      </div>
      {v.lastTrick && v.phase === 'play' && !v.trick.length && (
        <p className="small muted center">
          {tx('Last trick won by {name}', { name: name(v.lastTrick.winner) })}: {v.lastTrick.plays.map((p) => cardLabel(p.card)).join(' ')}
        </p>
      )}
    </div>
  );
}

export const bridge: GameDef<L.BridgeState, L.BridgeMove, L.BridgeView> = {
  id: 'bric',
  name: 'Briç',
  tagline: 'The classic partnership game: bid a contract, then make it.',
  icon: '🌉',
  minPlayers: 4,
  maxPlayers: 4,
  defaultPlayers: 4,
  hiddenInfo: true,
  options: [
    {
      id: 'deals',
      label: 'Boards',
      default: '4',
      choices: [
        { value: '1', label: '1' },
        { value: '4', label: '4' },
        { value: '8', label: '8' },
        { value: '16', label: '16' },
      ],
    },
    {
      id: 'vulnerability',
      label: 'Vulnerability',
      default: 'rotate',
      choices: [
        { value: 'rotate', label: 'Standard rotation' },
        { value: 'none', label: 'Nobody' },
        { value: 'both', label: 'Both sides' },
      ],
    },
  ],
  rules:
    'Four players in two partnerships: North–South against East–West; partners sit opposite. All 52 cards are dealt. The auction: starting with the dealer, each player bids (a number of tricks over six, 1–7, and a trump suit or No Trump), passes, doubles an opponent’s bid or redoubles a double. Each bid must be higher than the last (♣ < ♦ < ♥ < ♠ < NT). Three passes after a bid end the auction; the last bid is the contract. Whoever of that side first named the strain is declarer; their partner is dummy. The player to declarer’s left leads; then dummy’s cards are laid face up and declarer plays them. Follow suit if you can; the highest trump, or else the highest card of the suit led, wins the trick. Make the contract to score it (with bonuses for game, slams, doubles and overtricks); fall short and the other side scores penalties. Duplicate scoring, added up over the boards; red 🔴 marks a vulnerable side.',
  setup: (ctx) => L.setup(ctx),
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  bot: L.bot,
  botDelay: (s) => (s.trick.length === 0 && s.phase === 'play' ? 1100 : 800),
  isPrivate: (v) => v.phase === 'auction' || v.phase === 'play',
  Board,
};
