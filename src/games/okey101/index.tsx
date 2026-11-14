import { useEffect, useState } from 'react';
import type { BoardProps, GameDef, Seat } from '../../engine/types';
import { OkeyInfo } from '../okey';
import { Rack, useRackOrder } from '../tiles/Rack';
import { asMeld, isJoker, type Tile } from '../tiles/tiles';
import { TileView } from '../tiles/TileView';
import * as L from './logic';
import { t as tx } from '../../i18n';

export function RummyBoard({ view: v, seat, players, canMove, onMove }: BoardProps<L.O101View, L.O101Move>) {
  const cfg = L.cfgFor(v.okey);
  const unit = cfg.unit;
  const me = seat as Seat;
  const [sel, setSel] = useState<Tile[]>([]);
  const [staged, setStaged] = useState<Tile[][]>([]);
  const [order, setOrder] = useRackOrder(v.hand, me);
  const myTurn = canMove && v.turn === me;
  const left = ((me + v.n - 1) % v.n) as Seat;
  const leftTop = v.discards[left]?.[v.discards[left].length - 1];
  const opened = v.opened[me];
  const stagedSet = new Set(staged.flat());
  const rackHand = v.hand.filter((t) => !stagedSet.has(t));

  useEffect(() => {
    setSel((s) => s.filter((t) => v.hand.includes(t)));
    setStaged((g) => g.filter((grp) => grp.every((t) => v.hand.includes(t))));
  }, [v.hand]);

  useEffect(() => {
    if (!myTurn) setStaged([]);
  }, [myTurn]);

  const toggle = (t: Tile) => setSel((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));

  const pairsMode = opened === 'pairs' || (opened === 'none' && staged.length > 0 && staged.every((g) => g.length === 2));
  const selMeld = sel.length >= 2 ? asMeld(sel, v.okey, cfg.rules, sel.length === 2 ? ['pair'] : ['set', 'run']) : null;
  const check = staged.length ? L.checkGroups(staged, opened, v.okey) : null;
  const stagedPoints = staged.reduce((a, g) => {
    const m = asMeld(g, v.okey, cfg.rules, g.length === 2 ? ['pair'] : ['set', 'run']);
    return a + (m ? L.pointsOf(m, v.okey) : 0);
  }, 0);

  const addTarget = (id: number) => {
    if (!myTurn || !sel.length || opened === 'none') return;
    onMove({ type: 'add', meldId: id, tiles: sel });
    setSel([]);
  };
  const fits = (m: L.TableMeld) => myTurn && opened !== 'none' && sel.length > 0 && m.kind !== 'pair' && !!asMeld([...m.tiles, ...sel], v.okey, cfg.rules, [m.kind]);

  const others = Array.from({ length: v.n - 1 }, (_, k) => ((me + k + 1) % v.n) as Seat);
  const openedLabel = (o: L.Opened) => (o === 'none' ? 'not opened' : o === 'pairs' ? 'opened (pairs)' : 'opened');
  const lastHand = v.history[v.history.length - 1];

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
                {v.handCounts[s]} {unit} · {openedLabel(v.opened[s])}{' '}{tx('· total {totals}', { totals: v.totals[s] })}
              </span>
              <span className="discard-spot">{d.length ? <TileView tile={d[d.length - 1]} okey={v.okey} size="sm" /> : <span className="empty-slot" />}{tx('discard')}</span>
            </div>
          );
        })}
      </div>

      <div className="felt">
        <div className="info-row">
          {cfg.variant === '101' && <OkeyInfo v={v} />}
          <span className="chip">{tx('Hand {v} / {totalHands}', { v: Math.min(v.handNo + 1, v.totalHands), totalHands: v.totalHands })}
          </span>
        </div>
        <div className="info-row">
          <button className={'btn' + (myTurn && v.phase === 'draw' ? ' primary' : '')} disabled={!myTurn || v.phase !== 'draw'} onClick={() => onMove({ type: 'draw', from: 'pile' })}>
            {v.pileCount ? tx('Draw ({pileCount})', { pileCount: v.pileCount }) : tx('Pile empty: end hand')}
          </button>
          <span className="discard-spot">
            {leftTop !== undefined ? (
              <TileView tile={leftTop} okey={v.okey} onClick={myTurn && v.phase === 'draw' ? () => onMove({ type: 'draw', from: 'left' }) : undefined} />
            ) : (
              <span className="empty-slot" />
            )}{tx('from {name}', { name: players[left].name })}
          </span>
        </div>
        {v.table.length > 0 ? (
          <div className="melds">
            {v.table.map((m) => (
              <button key={m.id} className={'meld' + (fits(m) ? ' target' : '')} onClick={() => fits(m) && addTarget(m.id)} title={tx('{name}\'s {kind}', { name: players[m.owner].name, kind: m.kind })}>
                <span className="seat-dot" style={{ background: `var(--p${m.owner})`, alignSelf: 'center' }} />
                {m.tiles.map((t) => (
                  <TileView key={t} tile={t} okey={v.okey} size="sm" />
                ))}
              </button>
            ))}
          </div>
        ) : (
          <span className="small muted">{tx('No melds on the table yet. Open with {openPoints} points of sets/runs, or {openPairs} pairs.', { openPoints: cfg.openPoints, openPairs: cfg.openPairs })}</span>
        )}
        {v.notice && <span className="small">{v.notice}</span>}
      </div>

      <div className={'my-seat' + (myTurn ? ' active' : '')}>
        <div className="info-row">
          <span className="opp-name">
            <span className="seat-dot" style={{ background: `var(--p${me})` }} />{' '}{tx('You ·')}{' '}{openedLabel(opened)}{' '}{tx('· total {totals}', { totals: v.totals[me] })}
            {v.penalties[me] ? tx(' · penalties +{penalties}', { penalties: v.penalties[me] }) : ''}
          </span>
          {myTurn && (
            <span className="small">
              {v.phase === 'draw'
                ? tx('Draw from the pile, or take the left {v} (only if you lay it down this turn).', { v: unit === 'cards' ? 'card' : 'tile' })
                : tx('Select {unit} to lay down or add to a meld, then discard one.', { unit: unit })}
            </span>
          )}
        </div>

        {staged.length > 0 && (
          <div className="stack-sm center">
            <div className="melds">
              {staged.map((g, i) => (
                <button key={i} className="meld" onClick={() => setStaged((x) => x.filter((_, k) => k !== i))} title={tx('Tap to take back')}>
                  {g.map((t) => (
                    <TileView key={t} tile={t} okey={v.okey} size="sm" />
                  ))}
                </button>
              ))}
            </div>
            <span className="small">
              {pairsMode ? tx('{length} pairs', { length: staged.length }) : tx('{stagedPoints} points', { stagedPoints: stagedPoints })}
              {typeof check === 'string' ? ` · ${check}` : ''}
            </span>
          </div>
        )}

        <Rack order={order.filter((t) => !stagedSet.has(t))} setOrder={(o) => setOrder([...o, ...staged.flat()])} okey={v.okey} rules={cfg.rules} hand={rackHand} selected={sel} onToggle={toggle} />

        {myTurn && v.phase === 'play' && (
          <div className="action-bar">
            <button
              className="btn"
              disabled={!selMeld}
              onClick={() => {
                setStaged((g) => [...g, sel]);
                setSel([]);
              }}
              title={tx('Group the selected tiles')}
            >{tx('+ Group')}{' '}{selMeld ? `(${selMeld.kind})` : ''}
            </button>
            <button
              className="btn primary"
              disabled={!staged.length || typeof check === 'string'}
              onClick={() => {
                onMove({ type: 'meld', groups: staged });
                setStaged([]);
              }}
            >
              {opened === 'none' ? tx('Open') : tx('Lay down')}
            </button>
            <button
              className="btn"
              disabled={sel.length !== 1 || staged.length > 0}
              onClick={() => {
                onMove({ type: 'discard', tile: sel[0] });
                setSel([]);
              }}
            >{tx('Discard selected')}{sel.length === 1 && isJoker(sel[0], v.okey)
                ? ` (${cfg.joker}! +${cfg.discardPenalty})`
                : sel.length === 1 && L.extendsTable(sel[0], v.table, v.okey) && v.hand.length > 1
                  ? tx(' (fits a meld: +{discardPenalty})', { discardPenalty: cfg.discardPenalty })
                  : ''}
            </button>
            {v.took !== null && v.hand.includes(v.took) && !v.meldedThisTurn && (
              <button className="btn ghost" onClick={() => onMove({ type: 'undoTake' })}>{tx('Put back the taken')}{' '}{unit === 'cards' ? 'card' : 'tile'}
              </button>
            )}
          </div>
        )}
      </div>

      {v.history.length > 0 && (
        <details className="rules" open={v.phase === 'done'}>
          <summary>{tx('Totals (lowest wins): {v}', { v: players.map((p, i) => `${p.name} ${v.totals[i]}`).join(' · ') })}
            {lastHand && tx(' · last hand: {v}', { v: lastHand.winner === null ? 'no winner' : players[lastHand.winner].name })}
          </summary>
          <table className="score-table">
            <thead>
              <tr>
                <th>#</th>
                {players.map((p, i) => (
                  <th key={i}>{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {v.history.map((h, k) => (
                <tr key={k}>
                  <td>{k + 1}</td>
                  {h.delta.map((d, i) => (
                    <td key={i} className={h.winner === i ? 'mine-tag' : ''}>
                      {d + h.penalties[i]}
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

export const okey101: GameDef<L.O101State, L.O101Move, L.O101View> = {
  id: 'okey-101',
  name: '101 Okey',
  tagline: 'Open with 101 points, lay it all down.',
  icon: '💯',
  minPlayers: 4,
  maxPlayers: 4,
  hiddenInfo: true,
  options: [
    {
      id: 'hands',
      label: 'Number of hands',
      default: '3',
      choices: [
        { value: '1', label: '1 hand' },
        { value: '3', label: '3 hands' },
        { value: '5', label: '5 hands' },
        { value: '9', label: '9 hands' },
      ],
    },
  ],
  rules:
    '21 tiles each (22 for the starter). The okey is wild; false jokers count as the okey tile. Runs cannot wrap (no 13-1).\nOpen by laying down sets and runs worth at least 101 points in one turn (a meld is worth the sum of its numbers), or at least 5 pairs. After opening, lay down more and add tiles to any meld on the table. You may take the previous discard only if you lay it down that turn.\nEvery turn ends with a discard; finish by discarding your last tile. Others score the tiles left in their hand (okey = 101); unopened players score 202. Finishing with the okey or with pairs doubles everything. Discarding the okey or a tile that fits a table meld is +101. Lowest total wins.',
  setup: L.setup,
  activePlayers: (s) => (s.phase === 'done' ? [] : [s.turn]),
  view: L.view,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx.random),
  result: L.result,
  bot: L.bot,
  botDelay: () => 650,
  Board: RummyBoard,
};
