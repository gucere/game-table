import type { BotCtx, GameResult, Seat } from '../../engine/types';

export type Choice = 'rock' | 'paper' | 'scissors';
export const CHOICES: Choice[] = ['rock', 'paper', 'scissors'];
const BEATS: Record<Choice, Choice> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

export const TARGET = 3;

export interface Round {
  choices: [Choice, Choice];
  winner: Seat | null;
}

export interface RpsState {
  /** Secret picks for the current round */
  picks: (Choice | null)[];
  scores: [number, number];
  history: Round[];
}

/** What one player may see: their own pick, and only *whether* the other picked */
export interface RpsView {
  mine: Choice | null;
  picked: boolean[];
  scores: [number, number];
  history: Round[];
}

export function setup(): RpsState {
  return { picks: [null, null], scores: [0, 0], history: [] };
}

export function roundWinner(a: Choice, b: Choice): Seat | null {
  if (a === b) return null;
  return BEATS[a] === b ? 0 : 1;
}

export function result(s: RpsState): GameResult | null {
  const w = s.scores.findIndex((x) => x >= TARGET);
  return w >= 0 ? { winners: [w] } : null;
}

export function activePlayers(s: RpsState): Seat[] {
  if (result(s)) return [];
  return [0, 1].filter((i) => s.picks[i] === null);
}

export function view(s: RpsState, seat: Seat): RpsView {
  return {
    mine: s.picks[seat] ?? null,
    picked: s.picks.map((p) => p !== null),
    scores: s.scores,
    history: s.history,
  };
}

export function move(s: RpsState, seat: Seat, choice: unknown): RpsState | string {
  if (!CHOICES.includes(choice as Choice)) return 'Pick rock, paper or scissors';
  if (s.picks[seat] !== null) return 'You already picked';
  const picks = s.picks.slice();
  picks[seat] = choice as Choice;
  if (picks.some((p) => p === null)) return { ...s, picks };
  const choices: [Choice, Choice] = [picks[0]!, picks[1]!];
  const winner = roundWinner(...choices);
  const scores: [number, number] = [...s.scores];
  if (winner !== null) scores[winner]++;
  return { picks: [null, null], scores, history: [...s.history, { choices, winner }] };
}

export function bot(v: RpsView, seat: Seat, ctx: BotCtx): Choice {
  const random = () => CHOICES[Math.floor(ctx.random() * 3)];
  if (ctx.level !== 'hard' || v.history.length < 2 || ctx.random() < 0.35) return random();
  // Counter the opponent's favourite pick
  const counts: Record<Choice, number> = { rock: 0, paper: 0, scissors: 0 };
  for (const r of v.history) counts[r.choices[1 - seat]]++;
  const fav = CHOICES.reduce((a, b) => (counts[b] > counts[a] ? b : a));
  return CHOICES.find((c) => BEATS[c] === fav)!;
}
