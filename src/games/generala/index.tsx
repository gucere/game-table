/**
 * Generala: the traditional five-dice game. Roll up to three times, keeping any dice,
 * then score the roll in one of ten boxes. Each box is used once; highest total wins.
 */
import { useEffect, useState } from 'react';
import type { BoardProps, BotCtx, GameDef, GameResult, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';

export const CATS = ['1', '2', '3', '4', '5', '6', 'escalera', 'full', 'poker', 'generala', 'doble'] as const;
export type Cat = (typeof CATS)[number];
export const CAT_NAMES: Record<Cat, string> = {
  '1': 'Ones',
  '2': 'Twos',
  '3': 'Threes',
  '4': 'Fours',
  '5': 'Fives',
  '6': 'Sixes',
  escalera: 'Straight',
  full: 'Full house',
  poker: 'Four of a kind',
  generala: 'Generala',
  doble: 'Double Generala',
};

export interface GeneralaState {
  n: number;
  dice: number[];
  rolls: number;
  turn: Seat;
  sheets: Partial<Record<Cat, number>>[];
  last: { seat: Seat; cat: Cat; points: number } | null;
  over: boolean;
}
export type GeneralaMove = { type: 'roll'; keep: boolean[] } | { type: 'score'; cat: Cat };

const counts = (d: number[]) => [1, 2, 3, 4, 5, 6].map((f) => d.filter((x) => x === f).length);

/** Points for scoring these dice in a box (served = made on the first roll) */
export function points(dice: number[], cat: Cat, served: boolean, sheet: Partial<Record<Cat, number>>): number {
  const c = counts(dice);
  const sorted = dice.slice().sort().join('');
  switch (cat) {
    case 'escalera':
      return sorted === '12345' || sorted === '23456' || sorted === '13456' ? (served ? 25 : 20) : 0;
    case 'full':
      return c.includes(3) && c.includes(2) ? (served ? 35 : 30) : 0;
    case 'poker':
      return c.some((x) => x >= 4) ? (served ? 45 : 40) : 0;
    case 'generala':
      return c.includes(5) ? 50 : 0;
    case 'doble':
      return c.includes(5) && (sheet.generala ?? 0) > 0 ? 100 : 0;
    default:
      return c[Number(cat) - 1] * Number(cat);
  }
}

export function setup(ctx: { numPlayers: number }): GeneralaState {
  return { n: ctx.numPlayers, dice: [], rolls: 0, turn: 0, sheets: Array.from({ length: ctx.numPlayers }, () => ({})), last: null, over: false };
}

const total = (sheet: Partial<Record<Cat, number>>) => Object.values(sheet).reduce((a, b) => a + (b ?? 0), 0);

export function move(s: GeneralaState, seat: Seat, m: GeneralaMove, ctx: { random: () => number }): GeneralaState | string {
  if (s.over) return 'The game is over';
  if (seat !== s.turn) return 'Not your turn';
  if (m.type === 'roll') {
    if (s.rolls >= 3) return 'No rolls left: pick a box';
    const keep = s.rolls === 0 ? [false, false, false, false, false] : (m.keep ?? []).slice(0, 5);
    const dice = Array.from({ length: 5 }, (_, i) => (keep[i] && s.dice[i] ? s.dice[i] : 1 + Math.floor(ctx.random() * 6)));
    return { ...s, dice, rolls: s.rolls + 1 };
  }
  if (s.rolls === 0) return 'Roll first';
  if (!CATS.includes(m.cat) || s.sheets[seat][m.cat] !== undefined) return 'Pick an empty box';
  // Double Generala only opens up after a Generala
  if (m.cat === 'doble' && s.sheets[seat].generala === undefined) return 'Fill Generala first';
  const p = points(s.dice, m.cat, s.rolls === 1, s.sheets[seat]);
  const sheets = s.sheets.map((sh, i) => (i === seat ? { ...sh, [m.cat]: p } : sh));
  // A Generala on the first roll wins on the spot
  const servedGenerala = m.cat === 'generala' && p === 50 && s.rolls === 1;
  const done = sheets.every((sh) => CATS.every((c) => sh[c] !== undefined));
  const next: GeneralaState = { ...s, sheets, dice: [], rolls: 0, turn: ((seat + 1) % s.n) as Seat, last: { seat, cat: m.cat, points: p }, over: done || servedGenerala };
  return servedGenerala ? { ...next, turn: seat } : next;
}

export const activePlayers = (s: GeneralaState): Seat[] => (s.over ? [] : [s.turn]);
export function result(s: GeneralaState): GameResult | null {
  if (!s.over) return null;
  const served = s.last?.cat === 'generala' && s.last.points === 50 && !s.sheets.every((sh) => CATS.every((c) => sh[c] !== undefined));
  if (served) return { winners: [s.last!.seat], message: tx('Generala servida! 🎲 Instant win.') };
  const tots = s.sheets.map(total);
  const best = Math.max(...tots);
  return { winners: tots.map((t, i) => (t === best ? i : -1)).filter((i) => i >= 0) };
}

// ------------------------------------------------------------- bot

export function bot(v: GeneralaState, seat: Seat, ctx: BotCtx): GeneralaMove {
  const sheet = v.sheets[seat];
  const open = CATS.filter((c) => sheet[c] === undefined && (c !== 'doble' || sheet.generala !== undefined));
  if (v.rolls === 0) return { type: 'roll', keep: [] };
  const best = open.map((c) => ({ c, p: points(v.dice, c, v.rolls === 1, sheet) })).sort((a, b) => b.p - a.p)[0];
  const isBig = (c: Cat) => ['escalera', 'full', 'poker', 'generala', 'doble'].includes(c);
  if (v.rolls < 3 && !(best.p >= 30 && isBig(best.c))) {
    // Keep the most common face (prefer high faces), or a straight draw
    const c = counts(v.dice);
    const sorted = [...new Set(v.dice)].sort();
    if (sorted.length >= 4 && open.includes('escalera') && Math.max(...c) <= 2) {
      const seen = new Set<number>();
      return { type: 'roll', keep: v.dice.map((d) => (seen.has(d) ? false : (seen.add(d), true))) };
    }
    let face = 0;
    for (let f = 6; f >= 1; f--) if (c[f - 1] > (face ? c[face - 1] : 0)) face = f;
    if (ctx.level === 'easy' && ctx.random() < 0.3) face = v.dice[Math.floor(ctx.random() * 5)];
    return { type: 'roll', keep: v.dice.map((d) => d === face) };
  }
  // Score: best points, but scratch a cheap box (ones) rather than waste a big one on zero
  if (best.p > 0) return { type: 'score', cat: best.c };
  const order: Cat[] = ['1', '2', 'doble', '3', 'generala', '4', 'poker', '5', 'escalera', '6', 'full'];
  return { type: 'score', cat: order.find((c) => open.includes(c)) ?? open[0] };
}

const PIPS = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<GeneralaState, GeneralaMove>) {
  const myTurn = canMove && v.turn === seat;
  const [keep, setKeep] = useState([false, false, false, false, false]);
  useEffect(() => setKeep([false, false, false, false, false]), [v.turn, v.rolls === 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const sheet = v.sheets[v.turn];
  const name = (s: Seat) => (s === seat ? tx('You') : players[s].name);
  return (
    <div className="stack center">
      <div className="gn-dice">
        {v.dice.length
          ? v.dice.map((d, i) => (
              <button key={i} className={'gn-die' + (keep[i] ? ' kept' : '')} disabled={!myTurn || v.rolls >= 3} onClick={() => setKeep((k) => k.map((x, j) => (j === i ? !x : x)))}>
                {PIPS[d]}
              </button>
            ))
          : [0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="gn-die empty">
                🎲
              </span>
            ))}
      </div>
      {myTurn && (
        <div className="action-bar">
          <button className="btn primary" disabled={v.rolls >= 3} onClick={() => onMove({ type: 'roll', keep })}>
            {v.rolls === 0 ? tx('Roll') : tx('Roll again ({n} left)', { n: 3 - v.rolls })}
          </button>
          {v.rolls > 0 && v.rolls < 3 && <span className="small muted">{tx('Tap dice to keep them.')}</span>}
        </div>
      )}
      {v.last && <p className="small">{tx('{name} scored {points} in {cat}.', { name: name(v.last.seat), points: v.last.points, cat: tx(CAT_NAMES[v.last.cat]) })}</p>}
      <div className="ish-table-wrap">
        <table className="score-table gn-sheet">
          <thead>
            <tr>
              <th />
              {players.map((_p, i) => (
                <th key={i} className={v.turn === i && !v.over ? 'mine-tag' : ''}>
                  {name(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CATS.map((c) => (
              <tr key={c}>
                <td>{tx(CAT_NAMES[c])}</td>
                {players.map((_, i) => {
                  const val = v.sheets[i][c];
                  const can = myTurn && i === seat && v.rolls > 0 && val === undefined && (c !== 'doble' || sheet.generala !== undefined);
                  return (
                    <td key={i}>
                      {can ? (
                        <button className="btn small ghost" onClick={() => onMove({ type: 'score', cat: c })}>
                          {points(v.dice, c, v.rolls === 1, sheet)}
                        </button>
                      ) : val === undefined ? (
                        ''
                      ) : (
                        val
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td>
                <b>{tx('Total')}</b>
              </td>
              {v.sheets.map((sh, i) => (
                <td key={i}>
                  <b>{total(sh)}</b>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const generala: GameDef<GeneralaState, GeneralaMove, GeneralaState> = {
  id: 'generala',
  name: 'Generala',
  tagline: 'Five dice, three rolls, eleven boxes to fill.',
  icon: '🎲',
  minPlayers: 1,
  maxPlayers: 6,
  defaultPlayers: 2,
  hiddenInfo: false,
  rules:
    'On your turn roll five dice up to three times; between rolls tap dice to keep them. Then score the dice in an empty box (a box can be scored as 0). Ones to Sixes: the sum of that face. Straight (1-2-3-4-5, 2-3-4-5-6 or 3-4-5-6-1): 20. Full house (three + two): 30. Four of a kind: 40. Made on the first roll ("served"), these are worth 5 more. Generala (five of a kind): 50, and a served Generala wins the game on the spot. Double Generala: 100, only after a Generala. Highest total wins.',
  setup,
  activePlayers,
  view: (s) => s,
  move: (s, seat, m, ctx) => move(s, seat, m, ctx),
  result,
  bot,
  botDelay: (s) => (s.rolls === 0 ? 600 : 1000),
  Board,
};
