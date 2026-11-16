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
  /** Ready-made avatar id (see profile/profile.ts) */
  avatar?: string;
}

export interface GameResult {
  winners: Seat[];
  draw?: boolean;
  message?: string;
}

export type GameOptions = Record<string, string>;

export interface GameOptionsProps {
  numPlayers: number;
  options: GameOptions;
  onChange?: (id: string, value: string) => void;
  readOnly?: boolean;
}

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
  /** People may join and leave while it runs (chat rooms) */
  openSeats?: boolean;
  options?: GameOption[];
  /** A game-specific options editor, shared by local setup, online rooms and the rules drawer. */
  OptionsExtra?: ComponentType<GameOptionsProps>;
  /** Validate the complete configuration against the current table size before starting. */
  validateOptions?(numPlayers: number, options: GameOptions): string | null;
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
  /** Whether this perspective may send room messages/reactions under the game rules. */
  canChat?(view: V): boolean;
  /** Explicit non-turn actions, such as a private team message during a night phase. */
  canSubmitOutsideTurn?(state: S, seat: Seat, move: M): boolean;
  /** Host-clock timestamp when `onTimer` should fire, or null */
  timer?(state: S): number | null;
  onTimer?(state: S, ctx: GameCtx): S;
  /** Turn timers make no sense here (real-time or solo games) */
  noTurnTimer?: boolean;
  /** Plain words for a move, used by hints ("Play e2 to e4") */
  describeMove?(view: V, move: M, seat: Seat): string;
  /** Teach-me mode: a tip about the position in front of this player, or null */
  teach?(view: V, seat: Seat): string | null;
  /** Games with a public leaderboard: the score this seat finished with (higher is better) */
  leaderboard?: {
    score(view: V, seat: Seat): number | null;
    /** Options that change the difficulty get their own boards */
    boardOptions?: string[];
  };
  Board: ComponentType<BoardProps<V, M>>;
  /** Extra panel on the setup screen (e.g. a question editor) */
  SetupExtra?: ComponentType;
}

export function defaultOptions(game: GameDef): GameOptions {
  const o: GameOptions = {};
  for (const opt of game.options ?? []) o[opt.id] = opt.default;
  return o;
}
