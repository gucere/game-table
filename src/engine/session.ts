import type { GameOptions, GameResult, PlayerInfo, Seat } from './types';

export interface ChatMsg {
  id: number;
  /** Sender's seat at the time, or null for room announcements */
  seat: Seat | null;
  name: string;
  text: string;
  /** Host clock */
  time: number;
  system?: boolean;
}

export interface VoteInfo {
  target: Seat;
  targetName: string;
  starter: string;
  /** Seats that may vote (connected people, except the target) */
  voters: Seat[];
  yes: Seat[];
  no: Seat[];
  needed: number;
  /** Host-clock time when the vote expires */
  endsAt: number;
}

export interface SessionSnapshot {
  phase: 'connecting' | 'lobby' | 'playing' | 'closed';
  error?: string;
  notice?: string;
  online: boolean;
  isHost: boolean;
  roomCode?: string;
  gameId: string;
  players: PlayerInfo[];
  /** Seats controlled by people on this device */
  localSeats: Seat[];
  /** View for each local seat */
  views: Record<number, unknown>;
  active: Seat[];
  result: GameResult | null;
  /** Bumps on every state change */
  version: number;
  options: GameOptions;
  /** Add to host timestamps to get local time */
  clockOffset: number;
  /** Online only: room chat, oldest first */
  chat?: ChatMsg[];
  /** Online only: a vote to remove a player, if one is running */
  vote?: VoteInfo | null;
}

/** What the UI talks to, whether the game is local, hosted, or joined */
export interface Session {
  getSnapshot(): SessionSnapshot;
  subscribe(fn: () => void): () => void;
  submit(seat: Seat, move: unknown): void;
  leave(): void;
  // Online only:
  sendChat?(text: string): void;
  startVote?(target: Seat): void;
  castVote?(yes: boolean): void;
  // Host / local only:
  restart?(): void;
  start?(): void;
  addBot?(): void;
  removeSeat?(seat: Seat): void;
  setGame?(gameId: string): void;
  setOption?(id: string, value: string): void;
  backToLobby?(): void;
}

export class Emitter {
  private listeners = new Set<() => void>();
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  emit() {
    this.listeners.forEach((fn) => fn());
  }
}
