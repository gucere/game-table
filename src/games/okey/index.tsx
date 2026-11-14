import { useEffect, useState } from 'react';
import type { BoardProps, GameDef, Seat } from '../../engine/types';
import { Rack, useRackOrder } from '../tiles/Rack';
import { COLOR_NAMES, type Tile } from '../tiles/tiles';
import { TileView } from '../tiles/TileView';
import * as L from './logic';
import { t as tx } from '../../i18n';

function OkeyInfo({ v }: { v: { indicator: Tile; okey: { color: number; num: number } } }) {
  return (
    <div className="info-row">
      <span className="discard-spot">
        <TileView tile={v.indicator} size="sm" />{tx('indicator')}</span>
      <span className="small">{tx('Okey (wild):')}{' '}<b>{COLOR_NAMES[v.okey.color]} {v.okey.num}</b> ★
      </span>
    </div>
  );
}

export { OkeyInfo };

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.OkeyView, L.OkeyMove>) {
  const me = seat as Seat;
  const [sel, setSel] = useState<Tile | null>(null);
  const [order, setOrder] = useRackOrder(v.hand, me);
  const myTurn = canMove && v.turn === me;
  const left = ((me + v.n - 1) % v.n) as Seat;
  const leftTop = v.discards[left]?.[v.discards[left].length - 1];
  const canFinish = myTurn && v.phase === 'discard' && sel !== null && !!L.winningHand(v.hand.filter((t) => t !== sel), v.okey);

  useEffect(() => {
    if (sel !== null && !v.hand.includes(sel)) setSel(null);
  }, [v.hand, sel]);

  const others = Array.from({ length: v.n - 1 }, (_, k) => ((me + k + 1) % v.n) as Seat);
  const konken = v.variant === 'konken';
  const unit = konken ? tx('cards') : tx('tiles');

  return (
    <div className="table">
      <div className="opponents">
        {others.map((s) => {
          const d = v.discards[s];
          return (
            <div key={s} className={'opponent' + (v.turn === s && v.phase !== 'done' ? ' active' : '')}>
              <div className="opp-name">
                <span className="seat-dot" style={{ background: `var(--p${s})` }} />
                {players[s].name}
                {players[s].kind === 'bot' && ' 🤖'}
              </div>
              <span className="opp-info">
                {tx('{handCounts} {unit} · {scores} pts', { handCounts: v.handCounts[s], unit, scores: v.scores[s] })}</span>
              <span className="discard-spot">{d.length ? <TileView tile={d[d.length - 1]} okey={v.okey} size="sm" /> : <span className="empty-slot" />}{tx('discard')}</span>
            </div>
          );
        })}
      </div>

      <div className="felt">
        {!konken && <OkeyInfo v={v} />}
        {konken && <span className="chip">{tx('Hand {n} / {m} · jokers are wild', { n: v.round, m: v.maxRounds ?? 0 })}</span>}
        {v.canak !== null && v.canak !== undefined && <span className="chip trump-chip">{tx('Çanak (pot): {n}', { n: v.canak })}</span>}
        <div className="info-row">
          <button className={'btn' + (myTurn && v.phase === 'draw' ? ' primary' : '')} disabled={!myTurn || v.phase !== 'draw'} onClick={() => onMove({ type: 'draw', from: 'pile' })}>
            {v.pileCount ? tx('Draw from pile ({pileCount})', { pileCount: v.pileCount }) : tx('Pile empty: end round')}
          </button>
          <span className="discard-spot">
            {leftTop !== undefined ? (
              <TileView tile={leftTop} okey={v.okey} onClick={myTurn && v.phase === 'draw' ? () => onMove({ type: 'draw', from: 'left' }) : undefined} />
            ) : (
              <span className="empty-slot" />
            )}{tx('from {name}', { name: players[left].name })}
          </span>
        </div>
        {v.notice && <span className="small">{v.notice}</span>}
        {v.lastWin && (
          <div className="stack-sm center">
            <span className="small">{v.lastWin.seat === me ? tx('You won the round') : tx('{name} won the round', { name: players[v.lastWin.seat].name })}
              {v.lastWin.pairs ? tx(' with pairs') : ''}
              {v.lastWin.okeyDiscard ? (konken ? tx(' by discarding a joker') : tx(' by discarding the okey')) : ''}
              {konken
                ? tx(': others wrote down {list}', { list: (v.lastWin.penalties ?? []).flatMap((p, i) => (i === v.lastWin!.seat ? [] : [`${players[i].name} ${p}`])).join(', ') })
                : tx(': others −{loss}', { loss: v.lastWin.loss })}
              {v.lastWin.canak ? tx(' and took the çanak (+{n})!', { n: v.lastWin.canak }) : ''}
            </span>
            <div className="melds">
              {v.lastWin.melds.map((m, i) => (
                <div key={i} className="meld">
                  {m.tiles.map((t) => (
                    <TileView key={t} tile={t} okey={v.okey} size="sm" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={'my-seat' + (myTurn ? ' active' : '')}>
        <div className="info-row">
          <span className="opp-name">
            <span className="seat-dot" style={{ background: `var(--p${me})` }} />{' '}{tx('You · {scores} pts · round {round}', { scores: v.scores[me], round: v.round })}
          </span>
          {myTurn && <span className="small">{v.phase === 'draw' ? (konken ? tx('Draw from the pile or take the card on your left.') : tx('Draw from the pile or take the tile on your left.')) : (konken ? tx('Pick a card, then discard it (or finish).') : tx('Pick a tile, then discard it (or finish).'))}</span>}
        </div>
        <Rack order={order} setOrder={setOrder} okey={v.okey} rules={L.RULES} hand={v.hand} selected={sel === null ? [] : [sel]} onToggle={(t) => setSel(sel === t ? null : t)} />
        {myTurn && v.phase === 'discard' && (
          <div className="action-bar">
            <button className="btn primary" disabled={sel === null} onClick={() => sel !== null && onMove({ type: 'discard', tile: sel })}>{tx('Discard selected')}</button>
            <button className={'btn' + (canFinish ? ' primary' : '')} disabled={!canFinish} onClick={() => sel !== null && onMove({ type: 'finish', tile: sel })}>{tx('🏁 Finish with selected')}</button>
          </div>
        )}
      </div>
    </div>
  );
}

export const okey: GameDef<L.OkeyState, L.OkeyMove, L.OkeyView> = {
  id: 'okey',
  name: 'Okey',
  tagline: 'The coffeehouse tile classic.',
  icon: '🀄',
  minPlayers: 4,
  maxPlayers: 4,
  hiddenInfo: true,
  options: [
    {
      id: 'points',
      label: 'Starting points',
      default: '10',
      choices: [
        { value: '6', label: '6 (quick)' },
        { value: '10', label: '10' },
        { value: '20', label: '20 (long)' },
      ],
    },
    {
      id: 'canak',
      label: 'Çanak (pot)',
      default: 'no',
      choices: [
        { value: 'no', label: 'No' },
        { value: 'yes', label: 'Yes: everyone pays 1 a hand; a flashy finish takes the pot' },
      ],
    },
  ],
  rules:
    'Tiles 1–13 in four colors (two of each) plus two false jokers. The tile after the indicator (same color, +1) is the okey: a wild tile. False jokers count as that tile.\nDraw from the pile or take the tile the player on your left just discarded, then discard one. Finish when your 14 tiles form sets (same number, different colors) and runs (same color in a row; 12-13-1 is allowed), or seven pairs, and discard the 15th.\nEveryone starts with the chosen points. When someone finishes, the others lose 2 (doubled for finishing with pairs, doubled again for discarding the okey). The game ends when someone reaches 0.\nWith the çanak (pot) on: everyone puts 1 point into the pot each hand, and whoever finishes by discarding the okey or with seven pairs also takes the whole pot. Otherwise it keeps growing.',
  setup: (ctx) => L.setup(ctx),
  activePlayers: (s) => (s.phase === 'done' ? [] : [s.turn]),
  view: L.view,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx.random),
  result: L.result,
  bot: L.bot,
  botDelay: () => 700,
  Board,
};

export const konken: GameDef<L.OkeyState, L.OkeyMove, L.OkeyView> = {
  ...okey,
  id: 'konken',
  name: 'Konken',
  tagline: 'Okey with cards: two decks, wild jokers, leftovers cost you.',
  icon: '🎴',
  minPlayers: 2,
  maxPlayers: 4,
  defaultPlayers: 4,
  options: [
    {
      id: 'hands',
      label: 'Number of hands',
      default: '5',
      choices: [
        { value: '3', label: '3 hands' },
        { value: '5', label: '5 hands' },
        { value: '9', label: '9 hands' },
      ],
    },
  ],
  rules:
    'Played like Okey, but with two card decks and two jokers (jokers are wild). Everyone gets 14 cards (the starter 15). Draw from the pile or take the card the player on your left just threw, then discard one. Finish by discarding your 15th card when the other 14 are all sets (same rank, different suits) and runs (same suit in order; ace low or high), or seven pairs. Everyone else writes down the cards they couldn’t fit into melds: aces 11, J/Q/K 10, jokers 25, others face value; doubled if you finished with pairs or by throwing a joker. Lowest total after the last hand wins. Rules vary between groups; this is our version.',
  setup: (ctx) => L.setup(ctx, 'konken'),
};
