import { useEffect, useState } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import { t as tx } from '../../i18n';
import * as L from './logic';

const S = 22;
const SQ3 = Math.sqrt(3);
const PAD = 6;
const centerOf = (i: number) => {
  const r = Math.floor(i / L.W);
  const c = i % L.W;
  return [S * SQ3 * (c + 0.5 * (r % 2)) + S * SQ3 * 0.5 + PAD, S * 1.5 * r + S + PAD];
};
const corner = (x: number, y: number, k: number) => {
  const a = (Math.PI / 180) * (60 * k - 30);
  return [x + S * Math.cos(a), y + S * Math.sin(a)];
};
/** Neighbour across each hex edge (edge k joins corners k and k+1), odd rows shifted right */
function across(i: number, k: number): number {
  const r = Math.floor(i / L.W);
  const c = i % L.W;
  const odd = r % 2 === 1;
  const d = [
    [0, 1],
    odd ? [1, 1] : [1, 0],
    odd ? [1, 0] : [1, -1],
    [0, -1],
    odd ? [-1, 0] : [-1, -1],
    odd ? [-1, 1] : [-1, 0],
  ][k];
  const rr = r + d[0];
  const cc = c + d[1];
  return rr >= 0 && rr < L.H && cc >= 0 && cc < L.W ? rr * L.W + cc : -1;
}

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.FetihState, L.FetihMove>) {
  const myTurn = canMove && v.turn === seat;
  const [sel, setSel] = useState<number | null>(null);
  const [amount, setAmount] = useState<'one' | 'all'>('all');
  useEffect(() => setSel(null), [v.phase, v.turn, v.owner, v.armies]);

  const mine = (k: number) => v.owner[k] === seat;
  const reach = sel !== null && v.phase === 'fortify' ? L.connected(v, sel) : null;
  const targetable = (k: number) => {
    if (!myTurn) return false;
    if (v.phase === 'place') return mine(k);
    if (v.phase === 'attack') return sel === null ? mine(k) && v.armies[k] >= 2 : (!mine(k) && v.terr[sel].adj.includes(k)) || (mine(k) && v.armies[k] >= 2);
    if (v.phase === 'fortify') return sel === null ? mine(k) && v.armies[k] >= 2 : mine(k);
    return false;
  };
  const click = (k: number) => {
    if (!targetable(k)) return;
    if (v.phase === 'place') return onMove({ type: 'place', t: k, n: amount === 'all' ? v.pending : 1 });
    if (v.phase === 'attack') {
      if (sel !== null && !mine(k)) return onMove({ type: 'attack', from: sel, to: k });
      return setSel(sel === k ? null : k);
    }
    if (v.phase === 'fortify') {
      if (sel !== null && k !== sel && reach?.has(k)) return onMove({ type: 'fortify', from: sel, to: k, n: amount === 'all' ? v.armies[sel] - 1 : Math.max(1, Math.floor((v.armies[sel] - 1) / 2)) });
      setSel(sel === k ? null : k);
    }
  };

  const width = S * SQ3 * (L.W + 0.5) + PAD * 2;
  const height = S * 1.5 * (L.H - 1) + S * 2 + PAD * 2;
  const counts = players.map((_, p) => v.owner.filter((o) => o === p).length);
  const last = v.last;
  const name = (p: number) => (p === seat ? tx('You') : players[p].name);

  let prompt = '';
  if (myTurn) {
    if (v.phase === 'place') prompt = tx('Place {n} reinforcements on your territories.', { n: v.pending });
    else if (v.phase === 'attack') prompt = sel === null ? tx('Pick one of your territories (2+ armies) to attack from, or end your attacks.') : tx('Now pick a neighbouring enemy territory.');
    else if (v.phase === 'fortify') prompt = sel === null ? tx('Optional: move armies between your connected territories, then your turn ends.') : tx('Pick where to move them.');
  }

  return (
    <div className="stack center">
      <div className="info-row">
        {players.map((p, i) =>
          v.alive[i] ? (
            <span key={i} className={'chip' + (v.turn === i && v.phase !== 'done' ? ' trump-chip' : '')}>
              <span className="seat-dot" style={{ background: `var(--p${i})` }} /> {name(i)}: {counts[i]}
            </span>
          ) : (
            <span key={i} className="chip muted">
              {p.name} ✕
            </span>
          ),
        )}
        <span className="chip">{v.maxRounds ? tx('Round {r} / {m}', { r: v.round, m: v.maxRounds }) : tx('Round {r}', { r: v.round })}</span>
      </div>
      {prompt && <p className="small">{prompt}</p>}
      <div className="ft-scroll">
        <svg className="ft-map" viewBox={`0 0 ${width} ${height}`} style={{ minWidth: Math.min(640, width) }}>
          {v.cellOf.map((k, i) => {
            const [x, y] = centerOf(i);
            const pts = Array.from({ length: 6 }, (_, c) => corner(x, y, c).join(',')).join(' ');
            const isSel = sel === k;
            const hot = targetable(k);
            return (
              <polygon
                key={i}
                points={pts}
                className={'ft-hex' + (hot ? ' hot' : '') + (isSel ? ' sel' : '') + (last && (last.to === k || last.from === k) ? ' last' : '')}
                style={{ fill: `var(--p${v.owner[k]})` }}
                onClick={() => click(k)}
              />
            );
          })}
          {v.cellOf.map((k, i) => {
            const [x, y] = centerOf(i);
            return [0, 1, 2, 3, 4, 5].map((e) => {
              const nb = across(i, e);
              if (nb >= 0 && v.cellOf[nb] === k) return null;
              const [x1, y1] = corner(x, y, e);
              const [x2, y2] = corner(x, y, e + 1);
              return <line key={`${i}-${e}`} x1={x1} y1={y1} x2={x2} y2={y2} className="ft-border" />;
            });
          })}
          {v.terr.map((t, k) => {
            const [x, y] = centerOf(t.center);
            return (
              <g key={k} className="ft-label" onClick={() => click(k)}>
                <circle cx={x} cy={y} r={11} />
                <text x={x} y={y + 4}>
                  {v.armies[k]}
                </text>
                {(t.village || t.castle) && (
                  <text x={x + 14} y={y - 8} className="ft-icon">
                    {t.castle ? '🏰' : '🏠'}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {myTurn && (
        <div className="action-bar">
          {(v.phase === 'place' || v.phase === 'fortify') && (
            <>
              <button className={'btn small' + (amount === 'one' ? ' primary' : '')} onClick={() => setAmount('one')}>
                {v.phase === 'place' ? tx('One at a time') : tx('Move half')}
              </button>
              <button className={'btn small' + (amount === 'all' ? ' primary' : '')} onClick={() => setAmount('all')}>
                {v.phase === 'place' ? tx('All at once') : tx('Move all')}
              </button>
            </>
          )}
          {v.phase === 'attack' && (
            <button className="btn" onClick={() => onMove({ type: 'endAttack' })}>
              {tx('End attacks')}
            </button>
          )}
          {(v.phase === 'attack' || v.phase === 'fortify') && (
            <button className="btn ghost" onClick={() => onMove({ type: 'endTurn' })}>
              {tx('End turn')}
            </button>
          )}
        </div>
      )}
      {last && (
        <p className="small">
          {tx('Battle: {a} + 🎲{ar} against {d} + 🎲{dr}{castle}.', {
            a: name(v.owner[last.from]),
            ar: last.aRoll,
            d: last.won ? tx('the defenders') : name(v.owner[last.to]),
            dr: last.dRoll,
            castle: v.terr[last.to].castle ? ' + 🏰2' : '',
          })}{' '}
          {last.won ? tx('Territory taken! 🎉') : tx('The attack failed.')}
        </p>
      )}
      <p className="small muted">{tx('Income: {n} per turn (half your territories, at least 3, +1 per 🏠 village). 🏰 Castles add 2 to defence.', { n: L.income(v, seat) })}</p>
    </div>
  );
}

export const fetih: GameDef<L.FetihState, L.FetihMove, L.FetihState> = {
  id: 'fetih',
  name: 'Fetih',
  tagline: 'Conquer a new hex map every game. Villages pay, castles hold.',
  icon: '🏰',
  minPlayers: 2,
  maxPlayers: 6,
  defaultPlayers: 4,
  hiddenInfo: false,
  options: [
    {
      id: 'rounds',
      label: 'Game ends',
      default: '25',
      choices: [
        { value: '15', label: 'After 15 rounds (most territories wins)' },
        { value: '25', label: 'After 25 rounds (most territories wins)' },
        { value: '0', label: 'When one player holds the whole map' },
      ],
    },
  ],
  rules:
    'Every game has a new map. Territories are dealt out with a few armies each. On your turn: 1) Reinforce: you get half your territory count (at least 3) plus 1 for each village 🏠 you hold. 2) Attack as often as you like from a territory with 2+ armies into a neighbouring enemy one: each side adds one die to its armies (the attacker counts all but one; a castle 🏰 gives the defender +2). Higher wins; ties go to the defender. Win and you move in; lose and you lose half your attacking armies. 3) Make one move of armies between your connected territories, which ends your turn. Take the whole map, or hold the most territories when the rounds run out.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: (s) => s,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  bot: L.bot,
  botDelay: (s) => (s.phase === 'attack' ? 700 : 450),
  Board,
};
