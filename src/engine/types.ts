import type { ComponentType } from 'react';

/** Seat index: 0..numPlayers-1 */
export type Seat = number;

export type BotLevel = 'easy' | 'normal' | 'hard';

export interface PlayerInfo {
  name: string;
  /** human = plays on this device, remote = plays over the network, bot = computer */
  kind: 'human' | 'remote' | 'bot';
  level?: BotLevel;
  connected?: boolean;
}

export interface GameResult {
  winners: Seat[];
  draw?: boolean;
  message?: string;
}

export type GameOptions = Record<string, string>;

/** A setting picked before the game starts (difficulty, number of hands…) */
export interface GameOption {
  id: string;
  label: string;
  choices: { value: string; label: string }[];
  default: string;
}

export interface GameCtx {
  numPlayers: number;
  random: () => number;
  options: GameOptions;
  /** Host clock, ms */
  now: () => number;
}

export interface BotCtx {
  random: () => number;
  level: BotLevel;
}

export interface BoardProps<V, M> {
  view: V;
  /** The seat whose perspective is being shown */
  seat: Seat;
  players: PlayerInfo[];
  /** Seats whose move is awaited */
  active: Seat[];
  /** True when `seat` may move right now */
  canMove: boolean;
  onMove: (move: M) => void;
  result: GameResult | null;
  /** Add to a host timestamp to get the local clock (0 unless joined online) */
  clockOffset: number;
}

/**
 * Every game is a pure rules module + a React board.
 * The same module powers same-device play, online play (the host runs the rules)
 * and bots, so each game only has to be written once.
 */
export interface GameDef<S = any, M = any, V = any> {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  minPlayers: number;
  maxPlayers: number;
  /** Table size the setup screen starts with (defaults: card games full, others minimum) */
  defaultPlayers?: number;
  /** Players have secrets (hands, picks): hide the screen between turns on a shared device */
  hiddenInfo: boolean;
  /** Only playable online (e.g. needs each player on their own screen) */
  onlineOnly?: boolean;
  /** Only playable on one device (fast real-time games) */
  localOnly?: boolean;
  options?: GameOption[];
  /** Short rules shown under the board */
  rules?: string;
  setup(ctx: GameCtx): S;
  /** Seats expected to move now (empty when the game is over) */
  activePlayers(state: S): Seat[];
  /** What `seat` is allowed to see. Must not leak other players' secrets. */
  view(state: S, seat: Seat): V;
  /** Returns the new state, or an error string if the move is illegal */
  move(state: S, seat: Seat, move: M, ctx: GameCtx): S | string;
  result(state: S): GameResult | null;
  /** Bots only get their own view, so they cannot cheat */
  bot?(view: V, seat: Seat, ctx: BotCtx): M | null;
  /** Pause before a bot moves (ms), e.g. longer right after a trick completes */
  botDelay?(state: S): number;
  /** For hidden-info games: false when the current view has no secrets (skip the pass screen) */
  isPrivate?(view: V): boolean;
  /** Host-clock timestamp when `onTimer` should fire, or null */
  timer?(state: S): number | null;
  onTimer?(state: S, ctx: GameCtx): S;
  Board: ComponentType<BoardProps<V, M>>;
  /** Extra panel on the setup screen (e.g. a question editor) */
  SetupExtra?: ComponentType;
}

export function defaultOptions(game: GameDef): GameOptions {
  const o: GameOptions = {};
  for (const opt of game.options ?? []) o[opt.id] = opt.default;
  return o;
}
