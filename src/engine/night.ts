/** Game night: several games in a row with one scoreboard across them. */
import type { GameDef, GameResult, PlayerInfo } from './types';

export interface NightState {
  /** Game ids, in order */
  queue: string[];
  /** Which game in the queue is on now */
  index: number;
  /** Points by player name */
  scores: Record<string, number>;
  /** The current game's points are already counted */
  scored: boolean;
  /** All games played: show the final scoreboard */
  finished: boolean;
}

export const NIGHT_WIN = 3;
export const NIGHT_DRAW = 1;
export const NIGHT_MAX_GAMES = 10;

/** Can this table play that game as part of the night? */
export function nightFits(game: GameDef, players: PlayerInfo[], online: boolean): boolean {
  const n = players.length;
  if (n < game.minPlayers || n > game.maxPlayers || game.maxPlayers < 2) return false;
  if (online ? game.localOnly : game.onlineOnly) return false;
  if (game.openSeats) return false;
  if (players.some((p) => p.kind === 'bot') && !game.bot) return false;
  return !game.validateOptions?.(n, Object.fromEntries((game.options ?? []).map((o) => [o.id, o.default])));
}

export function newNight(queue: string[], players: PlayerInfo[]): NightState {
  return { queue: queue.slice(0, NIGHT_MAX_GAMES), index: 0, scores: Object.fromEntries(players.map((p) => [p.name, 0])), scored: false, finished: false };
}

/** Adds the points for a finished game (once) */
export function scoreNight(night: NightState, players: PlayerInfo[], result: GameResult | null): NightState {
  if (!result || night.scored) return night;
  const scores = { ...night.scores };
  players.forEach((p, i) => {
    const pts = result.winners.includes(i) ? NIGHT_WIN : result.draw || result.winners.length === 0 ? NIGHT_DRAW : 0;
    scores[p.name] = (scores[p.name] ?? 0) + pts;
  });
  return { ...night, scores, scored: true };
}

export function nextNight(night: NightState): NightState {
  const index = night.index + 1;
  return index >= night.queue.length ? { ...night, finished: true } : { ...night, index, scored: false };
}

/** Names in scoreboard order, best first */
export function nightRanking(night: NightState): [string, number][] {
  return Object.entries(night.scores).sort((a, b) => b[1] - a[1]);
}
