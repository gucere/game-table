import type { GameOptions, GameResult, PlayerInfo, Seat } from './types';
import type { FileMeta, LocalAttachment } from './attachments';
import type { NightState } from './night';
import type { PollView } from './polls';

export interface ChatMsg {
  id: number;
  /** Sender's seat at the time, or null for room announcements */
  seat: Seat | null;
  name: string;
  text: string;
  /** Host clock */
  time: number;
  system?: boolean;
  attachment?: FileMeta;
  /** This message starts a poll (its id) */
  poll?: string;
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

/** A floating emoji someone sent to the table */
export interface Reaction {
  id: number;
  seat: Seat | null;
  name: string;
  emoji: string;
  time: number;
}

export interface VoiceState {
  /** Names of everyone in the voice chat */
  members: string[];
  on: boolean;
  muted: boolean;
  error?: string;
  microphone?: boolean;
  camera?: boolean;
  screen?: boolean;
  pending?: boolean;
  suppressed?: boolean;
  audioBlocked?: boolean;
  /** Browser-local media references. Never sent as game state or persisted. */
  localCamera?: MediaStream | null;
  localScreen?: MediaStream | null;
  videos?: { id: string; peerId: string; name: string; kind: 'camera' | 'screen'; stream: MediaStream }[];
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
  /** This device is watching (not playing): the seat whose view it follows */
  spectating?: Seat | null;
  /** Names of people watching the room */
  spectators?: string[];
  reactions?: Reaction[];
  voice?: VoiceState;
  attachments?: Record<string, LocalAttachment>;
  fileProgress?: { name: string; sent: number; total: number } | null;
  fileError?: string;
  publicLounge?: boolean;
  /** Lost the host for a moment and trying to get back in */
  reconnecting?: boolean;
  /** Turn timers: host-clock time by when each seat must move */
  deadlines?: Record<number, number>;
  /** After a game online: who wants a rematch */
  rematch?: { votes: Seat[]; needed: number } | null;
  night?: NightState | null;
  /** Players' own pictures by name (private rooms only) */
  pictures?: Record<string, string>;
  /** Polls in this room, as this person sees them */
  polls?: PollView[];
}

/** What the UI talks to, whether the game is local, hosted, or joined */
export interface Session {
  getSnapshot(): SessionSnapshot;
  subscribe(fn: () => void): () => void;
  submit(seat: Seat, move: unknown): void;
  leave(): void;
  // Online only:
  sendChat?(text: string): void;
  sendFile?(file: File): Promise<void>;
  requestFile?(id: string): void;
  startVote?(target: Seat): void;
  castVote?(yes: boolean): void;
  react?(emoji: string): void;
  /** Spectators: change whose view to watch */
  follow?(seat: Seat): void;
  /** Spectators: take a free seat (in the lobby) */
  sit?(): void;
  voiceJoin?(): void;
  voiceLeave?(): void;
  voiceMute?(muted: boolean): void;
  voiceListen?(): void;
  cameraStart?(): Promise<void>;
  cameraStop?(): void;
  screenStart?(): Promise<void>;
  screenStop?(): void;
  resumeAudio?(): void;
  /** Stop (or start again) hearing someone's voice on this device */
  hearPerson?(name: string, on: boolean): void;
  // Host / local only:
  restart?(): void;
  start?(): void;
  addBot?(): void;
  removeSeat?(seat: Seat): void;
  setGame?(gameId: string): void;
  setOption?(id: string, value: string): void;
  backToLobby?(): void;
  /** Online, after a game: ask for a rematch (majority starts it) */
  voteRematch?(): void;
  /** Polls (online rooms) */
  createPoll?(question: string, options: string[], multi: boolean, anonymous: boolean): void;
  votePoll?(id: string, choices: number[]): void;
  closePoll?(id: string): void;
  /** Game night (host / local only) */
  startNight?(queue: string[]): void;
  nextNight?(): void;
  endNight?(): void;
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
