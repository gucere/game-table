/**
 * Two Truths and a Lie. In turn, each player writes three statements about themselves,
 * one of them false. Everyone else votes for the lie. Spot it for a point; the teller
 * scores a point for everyone they fooled.
 */
import { useState } from 'react';
import type { BoardProps, GameCtx, GameDef, GameResult, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';
import { Countdown } from '../shared/Countdown';

const REVEAL_MS = 7000;

export interface TruthsState {
  n: number;
  order: Seat[];
  turn: number;
  phase: 'write' | 'vote' | 'reveal' | 'done';
  statements: string[];
  lie: number | null;
  votes: (number | null)[];
  scores: number[];
  deadline: number | null;
}
export type TruthsMove = { type: 'write'; statements: string[]; lie: number } | { type: 'vote'; pick: number };
export type TruthsView = Omit<TruthsState, 'lie' | 'votes'> & { me: Seat; teller: Seat; lie: number | null; votes: (number | null)[]; voted: boolean[] };

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'options'>): TruthsState {
  const n = ctx.numPlayers;
  const rounds = Number(ctx.options.rounds ?? 1);
  const order = Array.from({ length: n * rounds }, (_, i) => i % n);
  return { n, order, turn: 0, phase: 'write', statements: [], lie: null, votes: Array(n).fill(null), scores: Array(n).fill(0), deadline: null };
}

const tellerOf = (s: TruthsState) => s.order[s.turn];

export function move(s: TruthsState, seat: Seat, m: TruthsMove, ctx: Pick<GameCtx, 'now'>): TruthsState | string {
  const teller = tellerOf(s);
  if (s.phase === 'write') {
    if (seat !== teller) return 'Not your turn to write';
    if (m.type !== 'write') return 'Write your three statements';
    const st = (m.statements ?? []).map((x) => String(x ?? '').trim().slice(0, 140));
    if (st.length !== 3 || st.some((x) => !x)) return 'Write all three statements';
    if (![0, 1, 2].includes(m.lie)) return 'Mark which one is the lie';
    return { ...s, statements: st, lie: m.lie, phase: 'vote', votes: Array(s.n).fill(null) };
  }
  if (s.phase === 'vote') {
    if (seat === teller) return 'You wrote these: let the others guess';
    if (m.type !== 'vote' || ![0, 1, 2].includes(m.pick)) return 'Pick the statement you think is the lie';
    if (s.votes[seat] !== null) return 'You already voted';
    const votes = s.votes.map((v, i) => (i === seat ? m.pick : v));
    const next = { ...s, votes };
    if (votes.every((v, i) => i === teller || v !== null)) {
      const scores = s.scores.map((x, i) => {
        if (i === teller) return x + votes.filter((v, k) => k !== teller && v !== s.lie).length;
        return x + (votes[i] === s.lie ? 1 : 0);
      });
      return { ...next, scores, phase: 'reveal', deadline: ctx.now() + REVEAL_MS };
    }
    return next;
  }
  return 'Wait for the next round';
}

export function onTimer(s: TruthsState, _ctx: GameCtx): TruthsState {
  if (s.phase !== 'reveal') return s;
  const turn = s.turn + 1;
  if (turn >= s.order.length) return { ...s, phase: 'done', deadline: null };
  return { ...s, turn, phase: 'write', statements: [], lie: null, votes: Array(s.n).fill(null), deadline: null };
}

export function activePlayers(s: TruthsState): Seat[] {
  const teller = tellerOf(s);
  if (s.phase === 'write') return [teller];
  if (s.phase === 'vote') return s.votes.flatMap((v, i) => (i !== teller && v === null ? [i] : []));
  return [];
}

export function view(s: TruthsState, seat: Seat): TruthsView {
  const teller = tellerOf(s);
  const open = s.phase === 'reveal' || s.phase === 'done';
  return {
    ...s,
    me: seat,
    teller,
    // The lie stays with the teller until the reveal; votes stay secret too
    lie: open || seat === teller ? s.lie : null,
    votes: open ? s.votes : s.votes.map((v, i) => (i === seat ? v : null)),
    voted: s.votes.map((v) => v !== null),
  };
}

export function result(s: TruthsState): GameResult | null {
  if (s.phase !== 'done') return null;
  const best = Math.max(...s.scores);
  return { winners: s.scores.flatMap((x, i) => (x === best ? [i] : [])) };
}

function WriteForm({ onMove }: { onMove: (m: TruthsMove) => void }) {
  const [st, setSt] = useState(['', '', '']);
  const [lie, setLie] = useState<number | null>(null);
  const ready = st.every((x) => x.trim()) && lie !== null;
  return (
    <form
      className="stack-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onMove({ type: 'write', statements: st, lie: lie! });
      }}
    >
      <p className="small">{tx('Write two true things about yourself and one lie, then mark the lie. Make them hard to tell apart!')}</p>
      {st.map((x, i) => (
        <label key={i} className="tt-write">
          <input type="radio" name="lie" checked={lie === i} onChange={() => setLie(i)} aria-label={tx('This one is the lie')} />
          <input
            className="input"
            value={x}
            maxLength={140}
            placeholder={tx('Statement {n}', { n: i + 1 })}
            onChange={(e) => setSt((a) => a.map((y, k) => (k === i ? e.target.value : y)))}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </label>
      ))}
      <span className="small muted">{tx('Tick the circle next to the lie.')}</span>
      <button className="btn primary" disabled={!ready}>
        {tx('Share my statements')}
      </button>
    </form>
  );
}

function Board({ view: v, seat, players, canMove, onMove, clockOffset }: BoardProps<TruthsView, TruthsMove>) {
  const name = (s: Seat) => (s === seat ? tx('You') : players[s].name);
  const tellerName = name(v.teller);

  return (
    <div className="stack tt">
      <div className="info-row">
        <span className="chip">{tx('Round {n} / {m}', { n: v.turn + 1, m: v.order.length })}</span>
        {v.phase === 'reveal' && <Countdown deadline={v.deadline} offset={clockOffset} />}
        {players.map((_p, i) => (
          <span key={i} className={'chip' + (i === v.teller ? ' trump-chip' : '')}>
            {name(i)}: {v.scores[i]}
          </span>
        ))}
      </div>

      {v.phase === 'write' &&
        (canMove ? (
          <WriteForm key={v.turn} onMove={onMove} />
        ) : (
          <p className="center muted">{tx('{name} is writing two truths and a lie…', { name: tellerName })}</p>
        ))}

      {(v.phase === 'vote' || v.phase === 'reveal' || v.phase === 'done') && v.statements.length > 0 && (
        <div className="stack-sm">
          <p className="small center">
            {v.phase === 'vote'
              ? seat === v.teller
                ? tx('The others are guessing which one is your lie…')
                : tx("Which of {name}'s statements is the lie?", { name: tellerName })
              : tx("{name}'s lie was:", { name: tellerName })}
          </p>
          {v.statements.map((x, i) => {
            const voters = v.votes.flatMap((p, k) => (p === i ? [name(k)] : []));
            const isLie = v.lie === i;
            const mine = v.votes[seat] === i;
            const revealed = v.phase !== 'vote';
            return (
              <button
                key={i}
                className={'tt-card' + (revealed && isLie ? ' lie' : '') + (revealed && !isLie ? ' truth' : '') + (mine ? ' mine' : '') + (!revealed && seat === v.teller && isLie ? ' secret' : '')}
                disabled={!canMove || v.phase !== 'vote'}
                onClick={() => onMove({ type: 'vote', pick: i })}
              >
                <span>{x}</span>
                {revealed && <span className="small">{isLie ? tx('🤥 Lie') : tx('✅ True')}</span>}
                {revealed && voters.length > 0 && <span className="small muted">{tx('Votes: {names}', { names: voters.join(', ') })}</span>}
              </button>
            );
          })}
          {v.phase === 'vote' && (
            <p className="small muted center">
              {tx('Voted: {n} / {m}', { n: v.voted.filter((x, i) => x && i !== v.teller).length, m: v.n - 1 })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export const truths: GameDef<TruthsState, TruthsMove, TruthsView> = {
  id: 'iki-dogru-bir-yalan',
  name: 'Two Truths and a Lie',
  tagline: 'Two facts, one fib. Can your friends tell which?',
  icon: '🤥',
  minPlayers: 3,
  maxPlayers: 12,
  defaultPlayers: 4,
  hiddenInfo: true,
  options: [
    {
      id: 'rounds',
      label: 'Turns each',
      default: '1',
      choices: [
        { value: '1', label: 'Once each' },
        { value: '2', label: 'Twice each' },
      ],
    },
  ],
  rules:
    'Players take turns as the teller. The teller writes three statements about themselves (two true, one a lie) and secretly marks the lie. Everyone else votes for the statement they think is the lie. Then it is revealed: each player who spotted the lie scores 1 point, and the teller scores 1 point for every player they fooled. Most points at the end wins. Best with friends on a call or around a table.',
  setup,
  activePlayers,
  view,
  move: (s, seat, m, ctx) => move(s, seat, m, ctx),
  result,
  isPrivate: (v) => v.phase === 'write' || v.phase === 'vote',
  timer: (s) => s.deadline,
  onTimer,
  Board,
};
