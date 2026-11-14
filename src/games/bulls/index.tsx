/**
 * Sayı Bulmaca (bulls & cows): crack a secret 4-digit number with all-different digits.
 * Each guess is answered with +n (right digit, right place) and −n (right digit, wrong place).
 * Alone you crack the computer's number; with two players you race to crack each other's.
 */
import { useState } from 'react';
import type { BoardProps, BotCtx, GameDef, GameResult, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';

export interface BullsState {
  n: number;
  secrets: (string | null)[];
  guesses: { seat: Seat; guess: string; plus: number; minus: number }[];
  phase: 'set' | 'guess' | 'done';
  turn: Seat;
  winner: Seat | null;
}
export type BullsMove = { type: 'set'; secret: string } | { type: 'guess'; guess: string };
export interface BullsView extends Omit<BullsState, 'secrets'> {
  me: Seat;
  mySecret: string | null;
  /** Revealed at the end */
  secrets: (string | null)[];
}

export const valid = (s: string) => /^[1-9]\d{3}$/.test(s) && new Set(s).size === 4;

export function score(secret: string, guess: string) {
  let plus = 0;
  let minus = 0;
  for (let i = 0; i < 4; i++) {
    if (guess[i] === secret[i]) plus++;
    else if (secret.includes(guess[i])) minus++;
  }
  return { plus, minus };
}

export const ALL = Array.from({ length: 9000 }, (_, i) => String(1000 + i)).filter(valid);

export function setup(ctx: { numPlayers: number; random: () => number }): BullsState {
  const n = ctx.numPlayers;
  // Alone: the computer picks the number
  if (n === 1) return { n, secrets: [ALL[Math.floor(ctx.random() * ALL.length)]], guesses: [], phase: 'guess', turn: 0, winner: null };
  return { n, secrets: Array(n).fill(null), guesses: [], phase: 'set', turn: 0, winner: null };
}

/** Whose secret does this player try to crack? (the next player's) */
export const targetOf = (s: Pick<BullsState, 'n'>, seat: Seat) => (s.n === 1 ? 0 : (seat + 1) % s.n);

export function move(s: BullsState, seat: Seat, m: BullsMove): BullsState | string {
  if (s.phase === 'done') return 'The game is over';
  if (s.phase === 'set') {
    if (m.type !== 'set') return 'Choose your secret number first';
    if (s.secrets[seat] !== null) return 'Already set';
    if (!valid(m.secret)) return 'Use 4 different digits, not starting with 0';
    const secrets = s.secrets.map((x, i) => (i === seat ? m.secret : x));
    return { ...s, secrets, phase: secrets.every(Boolean) ? 'guess' : 'set' };
  }
  if (seat !== s.turn) return 'Not your turn';
  if (m.type !== 'guess' || !valid(m.guess)) return 'Guess 4 different digits, not starting with 0';
  const target = targetOf(s, seat);
  const r = score(s.secrets[target]!, m.guess);
  const guesses = [...s.guesses, { seat, guess: m.guess, ...r }];
  if (r.plus === 4) return { ...s, guesses, phase: 'done', winner: seat };
  return { ...s, guesses, turn: ((seat + 1) % s.n) as Seat };
}

export function activePlayers(s: BullsState): Seat[] {
  if (s.phase === 'set') return s.secrets.flatMap((x, i) => (x === null ? [i] : []));
  if (s.phase === 'guess') return [s.turn];
  return [];
}

export function view(s: BullsState, seat: Seat): BullsView {
  return { ...s, me: seat, mySecret: s.n === 1 ? null : s.secrets[seat], secrets: s.phase === 'done' ? s.secrets : s.secrets.map(() => null) };
}

export function result(s: BullsState): GameResult | null {
  if (s.phase !== 'done') return null;
  if (s.n === 1) return { winners: [0], message: tx('Cracked it in {n} guesses! 🔓', { n: s.guesses.length }) };
  return { winners: [s.winner!] };
}

export function bot(v: BullsView, seat: Seat, ctx: BotCtx): BullsMove {
  if (v.phase === 'set') return { type: 'set', secret: ALL[Math.floor(ctx.random() * ALL.length)] };
  // Keep only numbers that would have given the same answers to my earlier guesses
  const mine = v.guesses.filter((g) => g.seat === seat);
  const cands = ALL.filter((c) => mine.every((g) => {
    const r = score(c, g.guess);
    return r.plus === g.plus && r.minus === g.minus;
  }));
  if (ctx.level === 'easy' && ctx.random() < 0.4) return { type: 'guess', guess: ALL[Math.floor(ctx.random() * ALL.length)] };
  return { type: 'guess', guess: cands[Math.floor(ctx.random() * cands.length)] ?? ALL[0] };
}

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<BullsView, BullsMove>) {
  const [entry, setEntry] = useState('');
  // On a shared screen, keep your own secret hidden unless you ask for it
  const [peek, setPeek] = useState(false);
  const ok = valid(entry);
  const submit = () => {
    if (!ok) return;
    onMove(v.phase === 'set' ? { type: 'set', secret: entry } : { type: 'guess', guess: entry });
    setEntry('');
  };
  const name = (s: Seat) => (s === seat ? tx('You') : players[s].name);
  return (
    <div className="stack center bulls">
      {v.mySecret && (
        <button className="chip" onClick={() => setPeek((x) => !x)}>
          {tx('Your secret number: {n}', { n: peek ? v.mySecret : '••••' })} 👁
        </button>
      )}
      {canMove && (
        <form
          className="stack-sm center"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <span className="small">
            {v.phase === 'set'
              ? tx('Pick a secret number: 4 different digits, not starting with 0.')
              : v.n === 1
                ? tx('Guess the number.')
                : tx("Guess {name}'s number.", { name: players[targetOf(v, seat)].name })}
          </span>
          <input
            className="input bl-input"
            type={v.phase === 'set' ? 'password' : 'text'}
            inputMode="numeric"
            maxLength={4}
            value={entry}
            onChange={(e) => setEntry(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={(e) => e.stopPropagation()}
            autoFocus
          />
          <button className="btn primary" disabled={!ok}>
            {v.phase === 'set' ? tx('Set number') : tx('Guess')}
          </button>
          {entry.length === 4 && !ok && <span className="small muted">{tx('Digits must all be different, and the first can’t be 0.')}</span>}
        </form>
      )}
      {!canMove && v.phase === 'set' && <p className="muted">{tx('Waiting for everyone to pick a secret number…')}</p>}
      <div className="bl-cols">
        {Array.from({ length: v.n }, (_, p) => (
          <div key={p} className="stack-sm">
            <strong className="small">{v.n === 1 ? tx('Your guesses') : tx('{name} guessing', { name: name(p) })}</strong>
            <ol className="bl-list">
              {v.guesses
                .filter((g) => g.seat === p)
                .map((g, k) => (
                  <li key={k}>
                    <span className="bl-guess">{g.guess}</span>
                    <span className="bl-plus">+{g.plus}</span>
                    <span className="bl-minus">−{g.minus}</span>
                  </li>
                ))}
            </ol>
          </div>
        ))}
      </div>
      {v.phase === 'done' && v.n > 1 && <p className="small">{v.secrets.map((x, i) => `${name(i)}: ${x}`).join(' · ')}</p>}
    </div>
  );
}

export const bulls: GameDef<BullsState, BullsMove, BullsView> = {
  id: 'sayi-bulmaca',
  name: 'Sayı Bulmaca',
  tagline: 'Crack the 4-digit code with + and − clues.',
  icon: '🔢',
  minPlayers: 1,
  maxPlayers: 2,
  hiddenInfo: true,
  rules:
    'The secret is a 4-digit number with all-different digits (not starting with 0). After each guess you get a clue: +n means n digits are right and in the right place, −n means n more digits are in the number but in the wrong place. Alone, crack the computer’s number in as few guesses as you can. With two players, each picks a secret and you take turns guessing the other’s: first to crack it wins.',
  setup,
  activePlayers,
  view,
  move: (s, seat, m) => move(s, seat, m),
  result,
  bot,
  botDelay: () => 900,
  isPrivate: (v) => v.phase === 'set',
  Board,
};
