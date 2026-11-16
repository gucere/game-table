/**
 * Peer-to-peer online play over WebRTC (PeerJS).
 *
 * The free public PeerJS broker is only used so browsers can find each other
 * (a few small messages); after that, game traffic flows directly between
 * players. The host's browser runs the rules and sends each player only the
 * view they are allowed to see.
 *
 * Also here: chat (with pictures and files), emoji reactions, vote to remove, spectators,
 * voice and video calls with screen sharing,
 * and getting back into a room after a refresh (guests and the host).
 */
import { Peer, type DataConnection } from 'peerjs';
import { AttachmentCache, FileReceiver, cleanFileMeta, newFileId, sendFilePackets, type FileMeta, type FilePacket } from './attachments';
import { RoomMedia } from './roomMedia';
import { getGame } from '../games';
import { holdRoom, loadHostedRoom, saveHostedRoom, saveLastRoom, type HostedRoom } from './rejoin';
import { GameRunner } from './runner';
import { Emitter, type ChatMsg, type Reaction, type Session, type SessionSnapshot, type VoiceState, type VoteInfo } from './session';
import { defaultOptions, type GameOptions, type GameResult, type PlayerInfo, type Seat } from './types';
import { newNight, nextNight, nightFits, scoreNight, type NightState } from './night';
import { MAX_POLLS, makePoll, viewPoll, vote, type Poll, type PollView } from './polls';
import { avatarById, isSafePicture, myLook } from '../profile/profile';

const PREFIX = 'oyunmasasi-v1-';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const CONNECT_TIMEOUT_MS = 20000;
const CHAT_MAX_LEN = 200;
const CHAT_HISTORY = 100;
/** At most this many chat messages (or reactions) per player per CHAT_WINDOW_MS */
const CHAT_BURST = 6;
const CHAT_WINDOW_MS = 5000;
const VOTE_MS = 30000;
/** After the host reopens a room, players who don't come back within this time get a bot */
const RETURN_GRACE_MS = 45000;
const RECONNECT_TRIES = 20;
/** Internal: a public room's code is already hosted by someone else */
export const LOUNGE_TAKEN = 'lounge-taken';
export const REACTIONS = ['👍', '😂', '😮', '😡', '👏', '🎉', '😭', '🤔'];

export function makeRoomCode(random = Math.random) {
  let s = '';
  for (let i = 0; i < CODE_LENGTH; i++) s += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return s;
}

export function normalizeRoomCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
}

export function cleanName(name: unknown, fallback = 'Player') {
  const s = typeof name === 'string' ? name.trim().slice(0, 20) : '';
  return s || fallback;
}

export function cleanChat(text: unknown) {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX_LEN) : '';
}

/**
 * A random id remembered on this device. It lets a player who refreshes get their
 * own seat back, and keeps a player who was voted out from simply rejoining.
 * (Not bulletproof: a private window gets a new id.)
 */
export function clientId() {
  const KEY = 'oyun-masasi:client-id';
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

type ToHost =
  | { t: 'hello'; name: string; id?: string; avatar?: string; pic?: string }
  | { t: 'rematch' }
  | { t: 'poll'; question: unknown; options: unknown; multi: unknown; anonymous: unknown }
  | { t: 'pollvote'; id: string; choices: unknown }
  | { t: 'pollclose'; id: string }
  | { t: 'move'; move: unknown }
  | { t: 'chat'; text: string }
  | { t: 'react'; emoji: string }
  | { t: 'votekick'; target: Seat }
  | { t: 'vote'; yes: boolean }
  | { t: 'follow'; seat: Seat }
  | { t: 'sit' }
  | { t: 'voice'; on: boolean }
  | FilePacket;

interface ClientState {
  phase: 'lobby' | 'playing';
  gameId: string;
  players: PlayerInfo[];
  seat: Seat;
  /** Set when this connection is watching rather than playing */
  spectate: Seat | null;
  view: unknown;
  active: Seat[];
  result: GameResult | null;
  notice?: string;
  options: GameOptions;
  hostTime: number;
  vote: VoteInfo | null;
  spectators: string[];
  /** Peer ids and names of everyone in the voice chat */
  voice: { peerId: string; name: string }[];
  deadlines?: Record<number, number>;
  rematch?: { votes: Seat[]; needed: number } | null;
  night?: NightState | null;
  polls?: PollView[];
}

type ToClient =
  | { t: 'state'; state: ClientState }
  | { t: 'error'; message: string }
  | { t: 'chat'; msg: ChatMsg }
  | { t: 'chatlog'; msgs: ChatMsg[] }
  | { t: 'react'; r: Reaction }
  | { t: 'closed'; reason: string }
  | { t: 'pics'; pics: Record<string, string> }
  | FilePacket;

function peerErrorMessage(err: { type?: string; message?: string }) {
  switch (err.type) {
    case 'peer-unavailable':
      return 'Room not found. Check the code, and make sure the host still has the room open.';
    case 'browser-incompatible':
      return 'This browser does not support peer-to-peer connections.';
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return 'Could not reach the matchmaking server. Check your internet connection and try again.';
    default:
      return err.message || 'Connection error';
  }
}

// ---------------------------------------------------------------- Host

/** A voter: the host or a player's connection */
type Voter = DataConnection | 'host';

interface Spectator {
  conn: DataConnection;
  id: string | null;
  name: string;
  follow: Seat;
}

export class HostSession implements Session {
  private emitter = new Emitter();
  subscribe = this.emitter.subscribe;
  private snapshot!: SessionSnapshot;
  private version = 0;

  private peer: Peer | null = null;
  private roomCode = '';
  private phase: SessionSnapshot['phase'] = 'connecting';
  private error?: string;
  private notice?: string;
  private gameId: string;
  private options: GameOptions;
  private seats: PlayerInfo[];
  /** Connection for each seat (null for the host and bots), aligned with `seats` */
  private conns: (DataConnection | null)[];
  /** Device id behind each seat, so a player who refreshes gets their seat back */
  private seatIds: (string | null)[];
  /** Names players joined with (a bot standing in shows "(bot)") */
  private seatNames: string[];
  private spectators: Spectator[] = [];
  private runner: GameRunner | null = null;
  private closed = false;
  private hostName: string;

  private chatLog: ChatMsg[] = [];
  private chatId = 0;
  private chatTimes = new Map<DataConnection | 'host', number[]>();
  private clientIds = new Map<DataConnection, string>();
  /** Device ids of players voted out of this room */
  private banned = new Set<string>();
  private vote: {
    target: DataConnection;
    starter: string;
    yes: Set<Voter>;
    no: Set<Voter>;
    endsAt: number;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  private reactions: Reaction[] = [];
  private reactionId = 0;
  /** Voice chat members: peer id → name */
  private voiceRoster = new Map<string, string>();
  private voice: RoomMedia;
  private restoring: HostedRoom | null;
  /** Files people send in the chat: assembled here, then passed on to everyone */
  private receiver = new FileReceiver();
  private files = new AttachmentCache();
  private fileError?: string;

  /** A public room: fixed code, chat and calls only, nothing saved for reopening */
  private lounge: boolean;
  /** Players' own pictures by name (never in public rooms) */
  private pictures: Record<string, string> = {};
  private rematchVotes = new Set<Seat>();
  private night: NightState | null = null;
  private polls: Poll[] = [];
  private pollSeq = 0;

  constructor(gameId: string, hostName: string, restore: HostedRoom | null = null, opts: { code?: string; lounge?: boolean } = {}) {
    this.lounge = !!opts.lounge;
    this.restoring = restore;
    this.gameId = restore?.gameId ?? gameId;
    this.hostName = cleanName(restore?.hostName ?? hostName, 'Host');
    this.options = restore?.options ?? defaultOptions(getGame(this.gameId)!);
    if (restore) {
      // Everyone but the host and bots has to reconnect
      this.seats = restore.seats.map((p, i) => (i > 0 && p.kind === 'remote' ? { ...p, connected: false } : p));
      this.seatIds = restore.seatIds.slice();
      this.seatNames = restore.seats.map((p) => p.name.replace(/ \(bot\)$/, ''));
    } else {
      const look = myLook(!this.lounge);
      this.seats = [{ name: this.hostName, kind: 'human', connected: true, avatar: look.avatar }];
      if (look.picture) this.pictures[this.hostName] = look.picture;
      this.seatIds = [null];
      this.seatNames = [this.hostName];
    }
    this.conns = this.seats.map(() => null);
    this.voice = new RoomMedia(
      () => this.peer,
      () => this.refresh(),
    );
    this.refresh();
    this.openPeer(0, restore?.code ?? opts.code);
  }

  private openPeer(attempt: number, code = makeRoomCode()) {
    const peer = new Peer(PREFIX + code);
    this.peer = peer;
    this.voice.attach(peer);
    peer.on('open', () => {
      this.roomCode = code;
      this.unlock();
      this.unlock = holdRoom('host', code);
      if (this.restoring) this.finishRestore();
      else this.phase = 'lobby';
      this.refresh();
      // Public rooms go straight to chatting
      if (this.lounge) this.start();
    });
    peer.on('connection', (conn) => this.onConnection(conn));
    peer.on('disconnected', () => {
      // Lost the matchmaking server; existing player connections keep working.
      if (!this.closed && !peer.destroyed) peer.reconnect();
    });
    peer.on('error', (err) => {
      if (err.type === 'unavailable-id' && this.lounge) {
        // Someone else is already hosting this public room: join them instead
        peer.destroy();
        this.phase = 'closed';
        this.error = LOUNGE_TAKEN;
        this.refresh();
        return;
      }
      if (err.type === 'unavailable-id') {
        peer.destroy();
        // Reopening: the broker may still hold the old room for a few seconds, so keep trying it
        if (this.restoring && attempt < 15) {
          this.notice = 'Reopening your room…';
          this.refresh();
          setTimeout(() => !this.closed && this.openPeer(attempt + 1, code), 2000);
          return;
        }
        if (attempt < 3) {
          this.restoring = null;
          this.openPeer(attempt + 1);
          return;
        }
      }
      // Errors after the room is open (e.g. a flaky broker) aren't fatal
      if (this.phase === 'connecting') {
        this.phase = 'closed';
        this.error = peerErrorMessage(err);
      } else {
        this.notice = peerErrorMessage(err);
      }
      this.refresh();
    });
  }

  /** The host reloaded: pick the saved game back up and wait for everyone to return */
  private finishRestore() {
    const r = this.restoring!;
    this.restoring = null;
    if (r.phase === 'playing') {
      this.runner = new GameRunner(this.game, [...this.seats], this.options, r.state);
      this.runner.onChange(() => this.runnerChanged());
      this.runner.restoreState(r.state);
      this.phase = 'playing';
      setTimeout(() => this.botForMissing(), RETURN_GRACE_MS);
    } else {
      // In the lobby, missing players simply drop out
      for (let i = this.seats.length - 1; i > 0; i--) {
        if (this.seats[i].kind === 'remote') this.removeAt(i);
      }
      this.phase = 'lobby';
    }
    this.notice = 'Room reopened. Players will reconnect automatically.';
    this.system('The host reopened the room.');
  }

  private botForMissing() {
    if (this.closed || this.phase !== 'playing') return;
    this.seats.forEach((p, i) => {
      if (i > 0 && p.kind === 'remote' && !this.conns[i]) this.dropSeat(i, 'left');
    });
  }

  private get game() {
    return getGame(this.gameId)!;
  }

  private spectatorOf(conn: DataConnection) {
    return this.spectators.find((s) => s.conn === conn);
  }

  private onConnection(conn: DataConnection) {
    let greeted = false;
    conn.on('data', (raw) => {
      const msg = raw as ToHost;
      if (!msg || typeof msg !== 'object') return;
      if (!greeted) {
        if (msg.t !== 'hello') return;
        greeted = true;
        const id = typeof msg.id === 'string' ? msg.id.slice(0, 64) : null;
        if (id) this.clientIds.set(conn, id);
        this.admit(conn, cleanName(msg.name), id, { avatar: msg.avatar, pic: msg.pic });
        return;
      }
      const from = this.conns.indexOf(conn);
      const spec = this.spectatorOf(conn);
      switch (msg.t) {
        case 'chat':
          if (!this.allow(conn)) return;
          if (from >= 0) this.chatFrom(from, msg.text);
          else if (spec) this.addChat({ seat: null, name: `👀 ${spec.name}`, text: cleanChat(msg.text) });
          return;
        case 'react':
          if (!this.allow(conn)) return;
          if (from >= 0) this.addReaction(from, this.seats[from].name, msg.emoji);
          else if (spec) this.addReaction(null, `👀 ${spec.name}`, msg.emoji);
          return;
        case 'votekick':
          if (from >= 0) this.beginVote(from, Number(msg.target));
          return;
        case 'rematch':
          if (from >= 0) this.rematchFrom(from);
          return;
        case 'poll':
          if (!this.allow(conn)) return;
          if (from >= 0 || spec) this.pollFrom(from >= 0 ? from : null, from >= 0 ? this.seats[from].name : spec!.name, msg, conn);
          return;
        case 'pollvote':
          if (from >= 0 || spec) this.pollVote(from >= 0 ? this.seats[from].name : spec!.name, String(msg.id), msg.choices, conn);
          return;
        case 'pollclose':
          if (from >= 0 || spec) this.pollClose(from >= 0 ? this.seats[from].name : spec!.name, String(msg.id), false);
          return;
        case 'vote':
          if (from >= 0) this.voteFrom(from, !!msg.yes);
          return;
        case 'follow':
          if (spec && Number.isInteger(msg.seat) && msg.seat >= 0 && msg.seat < this.seats.length) {
            spec.follow = msg.seat;
            this.refresh();
          }
          return;
        case 'sit':
          if (spec) this.seatSpectator(spec);
          return;
        case 'voice':
          if (from < 0 && !spec) return;
          if (msg.on) this.voiceRoster.set(conn.peer, from >= 0 ? this.seats[from].name : spec!.name);
          else this.voiceRoster.delete(conn.peer);
          this.refresh();
          return;
        case 'move': {
          if (from < 0 || !this.runner) return;
          const err = this.runner.submit(from, msg.move);
          if (err) this.send(conn, { t: 'error', message: err });
          return;
        }
        case 'file-begin': {
          if ((from < 0 && !spec) || !this.allow(conn)) return;
          if (this.lounge) {
            this.send(conn, { t: 'error', message: 'Pictures and files can’t be shared in public rooms.' });
            return;
          }
          const err = this.receiver.begin(conn.peer, msg.file);
          if (err) this.send(conn, { t: 'error', message: err });
          return;
        }
        case 'file-chunk': {
          const err = this.receiver.chunk(conn.peer, msg.id, msg.index, msg.bytes);
          if (err) this.send(conn, { t: 'error', message: err });
          return;
        }
        case 'file-end': {
          const done = this.receiver.finish(conn.peer, msg.id);
          if (!done) return;
          const who = from >= 0 ? { seat: from as Seat | null, name: this.seats[from].name } : { seat: null, name: `👀 ${spec?.name ?? ''}` };
          void this.shareFile(done.file, done.blob, conn, who);
          return;
        }
      }
    });
    conn.on('close', () => {
      this.receiver.clear(conn.peer);
      this.onDisconnect(conn);
    });
    conn.on('error', () => this.onDisconnect(conn));
  }

  /** Keep a file here, send it on to everyone else, and post it in the chat */
  private async shareFile(file: FileMeta, blob: Blob, from: DataConnection | null, who: { seat: Seat | null; name: string }) {
    await this.files.add(file, blob);
    // Show it on the host's own screen too
    if (this.snapshot) this.snapshot = { ...this.snapshot, attachments: this.files.snapshot() };
    for (const c of this.everyone()) {
      if (c === from) continue;
      sendFilePackets(c, file, blob, () => !this.closed && c.open).catch(() => {});
    }
    this.addChat({ seat: who.seat, name: who.name, text: `📎 ${file.name}`, attachment: file });
  }

  async sendFile(f: File) {
    if (this.lounge) {
      this.fileError = 'Pictures and files can’t be shared in public rooms.';
      this.refresh();
      return;
    }
    const file = cleanFileMeta({ id: newFileId(), name: f.name, size: f.size, mime: f.type || 'application/octet-stream' });
    if (!file) {
      this.fileError = 'Choose a file between 1 byte and 8 MB.';
      this.refresh();
      return;
    }
    if (!this.allow('host')) return;
    this.fileError = undefined;
    await this.shareFile(file, f, null, { seat: 0, name: this.seats[0].name });
    this.refresh();
  }

  /** Everyone gets the latest pictures (they're too big to send with every move) */
  private sendPics() {
    if (this.lounge) return;
    for (const c of this.everyone()) this.send(c, { t: 'pics', pics: this.pictures });
  }

  private admit(conn: DataConnection, name: string, id: string | null, look: { avatar?: unknown; pic?: unknown } = {}) {
    const avatar = typeof look.avatar === 'string' && avatarById(look.avatar) ? look.avatar : undefined;
    const pic = !this.lounge && isSafePicture(look.pic) ? look.pic : undefined;
    if (id && this.banned.has(id)) {
      this.reject(conn, 'You were voted out of this room.');
      return;
    }
    // A player coming back (after a refresh or a dropped connection) gets their own seat back
    const back = id ? this.seatIds.findIndex((s, i) => i > 0 && s === id && !this.conns[i]?.open) : -1;
    if (back > 0) {
      const info: PlayerInfo = { name: this.seatNames[back] ?? name, kind: 'remote', connected: true, avatar };
      if (pic) this.pictures[info.name] = pic;
      this.conns[back] = conn;
      this.seats[back] = info;
      if (this.runner) this.runner.players = this.runner.players.map((p, i) => (i === back ? info : p));
      this.notice = `${info.name} is back.`;
      this.refresh();
      this.send(conn, { t: 'chatlog', msgs: this.chatLog });
      this.system(`${info.name} is back.`);
      this.sendPics();
      return;
    }
    // Two people with the same name get told apart: "Ayla", "Ayla 2"
    const taken = new Set([...this.seats.map((p) => p.name), ...this.spectators.map((s) => s.name)]);
    for (let k = 2; taken.has(name); k++) name = `${name.replace(/ \d+$/, '')} ${k}`;
    const info: PlayerInfo = { name, kind: 'remote', connected: true, avatar };
    if (pic) this.pictures[name] = pic;
    if (this.phase === 'playing' && this.game.openSeats && this.seats.length < this.game.maxPlayers) {
      this.seats.push(info);
      this.conns.push(conn);
      this.seatIds.push(id);
      this.seatNames.push(name);
      if (this.runner) this.runner.players = [...this.runner.players, info];
    } else if (this.phase === 'lobby' && this.seats.length < this.game.maxPlayers) {
      this.seats.push(info);
      this.conns.push(conn);
      this.seatIds.push(id);
      this.seatNames.push(name);
    } else if (this.phase === 'lobby' && this.seats.some((p) => p.kind === 'bot')) {
      // Room full: take over a bot seat
      const botSeat = this.seats.findIndex((p) => p.kind === 'bot');
      this.seats[botSeat] = info;
      this.conns[botSeat] = conn;
      this.seatIds[botSeat] = id;
      this.seatNames[botSeat] = name;
    } else {
      // Game running or room full: come in and watch
      this.spectators.push({ conn, id, name, follow: 0 });
      this.refresh();
      this.send(conn, { t: 'chatlog', msgs: this.chatLog });
      this.system(`${name} is watching.`);
      this.sendPics();
      return;
    }
    this.notice = `${name} joined the room.`;
    this.refresh();
    this.send(conn, { t: 'chatlog', msgs: this.chatLog });
    this.system(`${name} joined the room.`);
    this.sendPics();
  }

  private seatSpectator(spec: Spectator) {
    if (this.phase !== 'lobby' || this.seats.length >= this.game.maxPlayers) return;
    this.spectators = this.spectators.filter((s) => s !== spec);
    this.seats.push({ name: spec.name, kind: 'remote', connected: true });
    this.conns.push(spec.conn);
    this.seatIds.push(spec.id);
    this.seatNames.push(spec.name);
    this.system(`${spec.name} took a seat.`);
    this.refresh();
  }

  private reject(conn: DataConnection, reason: string) {
    this.send(conn, { t: 'closed', reason });
    setTimeout(() => conn.close(), 300);
  }

  private onDisconnect(conn: DataConnection) {
    this.chatTimes.delete(conn);
    if (this.voiceRoster.delete(conn.peer)) this.refresh();
    const spec = this.spectatorOf(conn);
    if (spec) {
      this.spectators = this.spectators.filter((s) => s !== spec);
      this.system(`${spec.name} stopped watching.`);
      this.refresh();
      return;
    }
    const seat = this.conns.indexOf(conn);
    if (seat < 0) return;
    this.dropSeat(seat, 'left');
  }

  private removeAt(seat: Seat) {
    this.seats.splice(seat, 1);
    this.conns.splice(seat, 1);
    this.seatIds.splice(seat, 1);
    this.seatNames.splice(seat, 1);
  }

  /** Remove a remote player: in the lobby the seat goes away, mid-game a bot takes over */
  private dropSeat(seat: Seat, how: 'left' | 'was voted out') {
    const name = this.seatNames[seat] ?? this.seats[seat].name;
    if (this.phase === 'lobby' || this.game.openSeats) {
      this.removeAt(seat);
      if (this.runner) this.runner.players = this.runner.players.filter((_, i) => i !== seat);
      this.notice = `${name} ${how}.`;
    } else {
      this.conns[seat] = null;
      // A voted-out player can't come back to their seat
      if (how === 'was voted out') this.seatIds[seat] = null;
      const replaced: PlayerInfo = this.game.bot
        ? { name: `${name} (bot)`, kind: 'bot', level: 'normal' }
        : { ...this.seats[seat], connected: false };
      this.seats[seat] = replaced;
      this.notice = this.game.bot ? `${name} ${how}. A bot took their seat.` : `${name} ${how}.`;
      // The runner keeps its own copy of the players
      if (this.runner) this.runner.players = this.runner.players.map((p, i) => (i === seat ? replaced : p));
    }
    this.system(`${name} ${how}.`);
    if (this.vote) this.checkVote();
    else this.refresh();
    this.runner?.scheduleBots();
  }

  // ------------------------------------------------------------ chat and reactions

  private allow(who: DataConnection | 'host') {
    const now = Date.now();
    const recent = (this.chatTimes.get(who) ?? []).filter((t) => now - t < CHAT_WINDOW_MS);
    if (recent.length >= CHAT_BURST) {
      if (who !== 'host') this.send(who, { t: 'error', message: 'Slow down a little: too many messages.' });
      return false;
    }
    recent.push(now);
    this.chatTimes.set(who, recent);
    return true;
  }

  private chatFrom(seat: Seat, text: unknown) {
    const clean = cleanChat(text);
    if (!clean || !this.seats[seat]) return;
    if (this.runner && this.game.canChat && !this.game.canChat(this.runner.view(seat))) return;
    this.addChat({ seat, name: this.seats[seat].name, text: clean });
  }

  private system(text: string) {
    this.addChat({ seat: null, name: '', text, system: true });
  }

  private everyone(): DataConnection[] {
    return [...this.conns.filter((c): c is DataConnection => !!c), ...this.spectators.map((s) => s.conn)];
  }

  private addChat(m: Omit<ChatMsg, 'id' | 'time'>) {
    if (!m.text) return;
    const msg: ChatMsg = { ...m, id: ++this.chatId, time: Date.now() };
    this.chatLog = [...this.chatLog, msg].slice(-CHAT_HISTORY);
    this.everyone().forEach((c) => this.send(c, { t: 'chat', msg }));
    if (this.snapshot) {
      this.snapshot = { ...this.snapshot, chat: this.chatLog, version: ++this.version };
      this.emitter.emit();
    }
  }

  private addReaction(seat: Seat | null, name: string, emoji: string) {
    if (!REACTIONS.includes(emoji)) return;
    if (seat !== null && this.runner && this.game.canChat && !this.game.canChat(this.runner.view(seat))) return;
    const r: Reaction = { id: ++this.reactionId, seat, name, emoji, time: Date.now() };
    this.reactions = [...this.reactions, r].slice(-12);
    this.everyone().forEach((c) => this.send(c, { t: 'react', r }));
    if (this.snapshot) {
      this.snapshot = { ...this.snapshot, reactions: this.reactions, version: ++this.version };
      this.emitter.emit();
    }
  }

  react(emoji: string) {
    if (this.allow('host')) this.addReaction(0, this.seats[0].name, emoji);
  }

  // ------------------------------------------------------------ vote to remove

  private voterOf(seat: Seat): Voter | null {
    return seat === 0 ? 'host' : (this.conns[seat] ?? null);
  }

  private seatOfVoter(v: Voter): Seat {
    return v === 'host' ? 0 : this.conns.indexOf(v);
  }

  /** Connected people who may vote, excluding the player being voted on */
  private eligible(): Voter[] {
    const out: Voter[] = [];
    this.seats.forEach((p, i) => {
      const v = this.voterOf(i);
      if (!v || v === this.vote?.target) return;
      if (i === 0 || (p.kind === 'remote' && p.connected !== false)) out.push(v);
    });
    return out;
  }

  private beginVote(by: Seat, target: Seat) {
    const conn = this.voterOf(by);
    const reply = (message: string) => {
      if (conn && conn !== 'host') this.send(conn, { t: 'error', message });
      else {
        this.notice = message;
        this.refresh();
      }
    };
    if (this.vote) return reply('A vote is already running.');
    const targetConn = Number.isInteger(target) && target > 0 ? this.conns[target] : null;
    if (!conn || !targetConn || target === by) return reply('You can only vote to remove another player who joined the room.');
    const starter = this.seats[by].name;
    this.vote = {
      target: targetConn,
      starter,
      yes: new Set([conn]),
      no: new Set(),
      endsAt: Date.now() + VOTE_MS,
      timer: setTimeout(() => this.failVote('Time ran out on the vote.'), VOTE_MS),
    };
    this.system(`${starter} started a vote to remove ${this.seats[target].name}.`);
    this.checkVote();
  }

  private voteFrom(seat: Seat, yes: boolean) {
    const v = this.vote;
    const voter = this.voterOf(seat);
    if (!v || !voter || !this.eligible().includes(voter)) return;
    (yes ? v.no : v.yes).delete(voter);
    (yes ? v.yes : v.no).add(voter);
    this.checkVote();
  }

  private voteInfo(): VoteInfo | null {
    const v = this.vote;
    if (!v) return null;
    const target = this.conns.indexOf(v.target);
    if (target < 0) return null;
    const elig = this.eligible();
    const count = (set: Set<Voter>) => [...set].filter((x) => elig.includes(x)).map((x) => this.seatOfVoter(x));
    return {
      target,
      targetName: this.seats[target].name,
      starter: v.starter,
      voters: elig.map((x) => this.seatOfVoter(x)),
      yes: count(v.yes),
      no: count(v.no),
      needed: Math.floor(elig.length / 2) + 1,
      endsAt: v.endsAt,
    };
  }

  private checkVote() {
    const v = this.vote;
    if (!v) return this.refresh();
    const info = this.voteInfo();
    if (!info) {
      // The player left on their own
      clearTimeout(v.timer);
      this.vote = null;
      return this.refresh();
    }
    if (info.yes.length >= info.needed) {
      clearTimeout(v.timer);
      this.vote = null;
      const id = this.clientIds.get(v.target);
      if (id) this.banned.add(id);
      this.reject(v.target, 'You were voted out of this room.');
      this.dropSeat(info.target, 'was voted out');
      return;
    }
    if (info.voters.length - info.no.length < info.needed) return this.failVote(`Not enough votes to remove ${info.targetName}.`);
    this.refresh();
  }

  private failVote(text: string) {
    if (!this.vote) return;
    clearTimeout(this.vote.timer);
    this.vote = null;
    this.system(text);
    this.refresh();
  }

  sendChat(text: string) {
    if (this.allow('host')) this.chatFrom(0, text);
  }

  startVote(target: Seat) {
    this.beginVote(0, target);
  }

  castVote(yes: boolean) {
    this.voteFrom(0, yes);
  }

  // ------------------------------------------------------------ voice

  /** Put the host on the call list (with or without a microphone) */
  private enterCall() {
    const myId = this.peer?.id;
    if (!myId) return;
    this.voiceRoster.set(myId, this.seats[0].name);
    this.refresh();
  }

  async voiceJoin() {
    if (await this.voice.join()) this.enterCall();
  }

  voiceListen() {
    this.voice.listen();
    this.enterCall();
  }

  voiceLeave() {
    this.voice.leave();
    if (this.peer?.id) this.voiceRoster.delete(this.peer.id);
    this.refresh();
  }

  voiceMute(m: boolean) {
    this.voice.setMuted(m);
  }

  async cameraStart() {
    if (!this.voice.on) this.voiceListen();
    await this.voice.startVisual('camera');
  }

  cameraStop() {
    this.voice.stop('camera');
  }

  async screenStart() {
    if (!this.voice.on) this.voiceListen();
    await this.voice.startVisual('screen');
  }

  screenStop() {
    this.voice.stop('screen');
  }

  resumeAudio() {
    void this.voice.resumeAudio();
  }

  hearPerson(name: string, on: boolean) {
    this.voice.hearName(name, on);
  }

  // ------------------------------------------------------------ state

  private send(conn: DataConnection, msg: ToClient) {
    try {
      if (conn.open) conn.send(msg);
    } catch (e) {
      console.warn('send failed', e);
    }
  }

  private voiceState(): VoiceState {
    return this.voice.state();
  }

  private refresh() {
    const r = this.runner;
    if (r) this.seats = [...r.players];
    const players = [...this.seats];
    const views: Record<number, unknown> = {};
    if (r) views[0] = r.view(0);
    this.voice.sync([...this.voiceRoster.entries()].map(([peerId, name]) => ({ peerId, name })));
    this.snapshot = {
      phase: this.phase,
      error: this.error,
      notice: this.notice,
      online: true,
      isHost: true,
      roomCode: this.roomCode || undefined,
      gameId: this.gameId,
      players,
      localSeats: [0],
      views,
      active: r ? r.active : [],
      result: r ? r.result : null,
      version: ++this.version,
      options: this.options,
      clockOffset: 0,
      chat: this.chatLog,
      vote: this.voteInfo(),
      spectators: this.spectators.map((s) => s.name),
      reactions: this.reactions,
      voice: this.voiceState(),
      attachments: this.files.snapshot(),
      fileError: this.fileError,
      publicLounge: this.lounge,
      deadlines: r ? Object.fromEntries(r.deadlines) : {},
      rematch: this.rematchInfo(),
      night: this.night,
      pictures: this.pictures,
      polls: this.pollViews(this.seats[0]?.name ?? this.hostName, true),
    };
    this.broadcast();
    this.save();
    this.emitter.emit();
  }

  /** Keep enough on this device to reopen the room after a refresh */
  private save() {
    if (this.lounge || this.closed || !this.roomCode || (this.phase !== 'lobby' && this.phase !== 'playing')) return;
    saveHostedRoom({
      code: this.roomCode,
      hostName: this.hostName,
      gameId: this.gameId,
      options: this.options,
      seats: this.seats,
      seatIds: this.seatIds,
      phase: this.phase,
      state: this.runner?.state ?? null,
      at: Date.now(),
    });
  }

  private broadcast() {
    if (this.phase !== 'lobby' && this.phase !== 'playing') return;
    const r = this.runner;
    const base = {
      phase: this.phase as 'lobby' | 'playing',
      gameId: this.gameId,
      players: this.seats,
      active: r ? r.active : [],
      result: r ? r.result : null,
      notice: this.notice,
      options: this.options,
      hostTime: Date.now(),
      vote: this.snapshot.vote ?? null,
      spectators: this.spectators.map((s) => s.name),
      voice: [...this.voiceRoster.entries()].map(([peerId, name]) => ({ peerId, name })),
      deadlines: this.snapshot.deadlines,
      rematch: this.snapshot.rematch,
      night: this.night,
    };
    this.conns.forEach((conn, seat) => {
      if (conn) this.send(conn, { t: 'state', state: { ...base, seat, spectate: null, view: r ? r.view(seat) : null, polls: this.pollViews(this.seats[seat]?.name ?? '', false) } });
    });
    for (const s of this.spectators) {
      const follow = Math.min(s.follow, this.seats.length - 1);
      this.send(s.conn, { t: 'state', state: { ...base, seat: follow, spectate: follow, view: r ? r.view(follow) : null, polls: this.pollViews(s.name, false) } });
    }
  }

  getSnapshot = () => this.snapshot;

  submit(seat: Seat, move: unknown) {
    if (seat !== 0 || !this.runner) return;
    const err = this.runner.submit(0, move);
    if (err) console.warn(err);
  }

  setGame(gameId: string) {
    if (this.phase !== 'lobby' || !getGame(gameId)) return;
    this.gameId = gameId;
    this.options = defaultOptions(this.game);
    // Drop extra bots if the new game takes fewer players
    const max = this.game.maxPlayers;
    for (let i = this.seats.length - 1; i > 0 && this.seats.length > max; i--) {
      if (this.seats[i].kind === 'bot') this.removeAt(i);
    }
    this.notice = undefined;
    this.refresh();
  }

  /** In the lobby this sets up the game; mid-game it applies from the next round */
  setOption(id: string, value: string) {
    if (this.phase !== 'lobby' && this.phase !== 'playing') return;
    this.options = { ...this.options, [id]: value };
    this.notice = undefined;
    this.refresh();
  }

  addBot() {
    if (this.phase !== 'lobby' || this.seats.length >= this.game.maxPlayers || !this.game.bot) return;
    const n = this.seats.filter((p) => p.kind === 'bot').length + 1;
    this.seats.push({ name: `Bot ${n}`, kind: 'bot', level: 'normal' });
    this.conns.push(null);
    this.seatIds.push(null);
    this.seatNames.push(`Bot ${n}`);
    this.refresh();
  }

  removeSeat(seat: Seat) {
    if (this.phase !== 'lobby' || seat === 0) return;
    const conn = this.conns[seat];
    this.removeAt(seat);
    if (conn) this.reject(conn, 'The host removed you from the room.');
    this.refresh();
  }

  start() {
    const g = this.game;
    if (this.phase !== 'lobby') return;
    if (this.seats.length < g.minPlayers || this.seats.length > g.maxPlayers || g.localOnly) return;
    const error = g.validateOptions?.(this.seats.length, this.options);
    if (error) {
      this.notice = error;
      this.refresh();
      return;
    }
    this.runner = new GameRunner(g, [...this.seats], this.options);
    this.runner.onChange(() => this.runnerChanged());
    this.phase = 'playing';
    this.notice = undefined;
    this.refresh();
    this.runner.scheduleBots();
  }

  private runnerChanged() {
    if (this.night && this.runner) this.night = scoreNight(this.night, this.runner.players, this.runner.result);
    if (!this.runner?.result) this.rematchVotes.clear();
    this.refresh();
  }

  private rematchInfo(): { votes: Seat[]; needed: number } | null {
    if (this.phase !== 'playing' || !this.runner?.result) return null;
    const people = this.seats.flatMap((p, i) => (p.kind !== 'bot' && p.connected !== false ? [i] : []));
    return { votes: [...this.rematchVotes].filter((s) => people.includes(s)), needed: Math.floor(people.length / 2) + 1 };
  }

  private rematchFrom(seat: Seat) {
    if (!this.runner?.result) return;
    this.rematchVotes.add(seat);
    const info = this.rematchInfo();
    if (info && info.votes.length >= info.needed) {
      this.system('Rematch!');
      this.restart();
    } else this.refresh();
  }

  voteRematch() {
    this.rematchFrom(0);
  }

  // ---- Polls

  private pollFrom(seat: Seat | null, name: string, input: { question?: unknown; options?: unknown; multi?: unknown; anonymous?: unknown }, conn: DataConnection | null) {
    const p = makePoll(`p${++this.pollSeq}`, name, input);
    if (typeof p === 'string') {
      if (conn) this.send(conn, { t: 'error', message: p });
      else this.notice = p;
      this.refresh();
      return;
    }
    this.polls = [...this.polls, p].slice(-MAX_POLLS);
    this.addChat({ seat, name, text: `📊 ${p.question}`, poll: p.id });
    this.refresh();
  }

  private pollVote(name: string, id: string, choices: unknown, conn: DataConnection | null) {
    const p = this.polls.find((x) => x.id === id);
    if (!p) return;
    const next = vote(p, name, choices);
    if (typeof next === 'string') {
      if (conn) this.send(conn, { t: 'error', message: next });
      return;
    }
    this.polls = this.polls.map((x) => (x.id === id ? next : x));
    this.refresh();
  }

  private pollClose(name: string, id: string, isHost: boolean) {
    const p = this.polls.find((x) => x.id === id);
    if (!p || p.closed || (p.by !== name && !isHost)) return;
    this.polls = this.polls.map((x) => (x.id === id ? { ...x, closed: true } : x));
    this.refresh();
  }

  private pollViews(name: string, isHost: boolean): PollView[] {
    return this.polls.map((p) => viewPoll(p, name, isHost));
  }

  createPoll(question: string, options: string[], multi: boolean, anonymous: boolean) {
    if (!this.allow('host')) return;
    this.pollFrom(0, this.seats[0].name, { question, options, multi, anonymous }, null);
  }

  votePoll(id: string, choices: number[]) {
    this.pollVote(this.seats[0].name, id, choices, null);
  }

  closePoll(id: string) {
    this.pollClose(this.seats[0].name, id, true);
  }

  startNight(queue: string[]) {
    const games = queue.filter((id) => {
      const g = getGame(id);
      return g && nightFits(g, this.seats, true);
    });
    if (!games.length || this.lounge) return;
    this.night = newNight(games, this.seats);
    this.system('Game night started!');
    this.launchNight(games[0]);
  }

  nextNight() {
    if (!this.night) return;
    this.night = nextNight(this.night);
    if (this.night.finished) this.refresh();
    else this.launchNight(this.night.queue[this.night.index]);
  }

  endNight() {
    this.night = null;
    this.refresh();
  }

  private launchNight(gameId: string) {
    const turn = this.options._turn;
    if (this.phase === 'playing') {
      this.runner?.dispose();
      this.runner = null;
      this.phase = 'lobby';
    }
    this.setGame(gameId);
    if (turn) this.options = { ...this.options, _turn: turn };
    this.start();
  }

  restart() {
    this.notice = undefined;
    this.rematchVotes.clear();
    if (this.night) this.night = { ...this.night, scored: false };
    const error = this.runner?.restart(this.options);
    if (error) {
      this.notice = error;
      this.refresh();
    }
  }

  backToLobby() {
    if (this.phase !== 'playing') return;
    this.rematchVotes.clear();
    this.runner?.dispose();
    this.runner = null;
    this.phase = 'lobby';
    this.notice = undefined;
    // Players who left mid-game (and are still gone) leave the table; bots stay
    for (let i = this.seats.length - 1; i > 0; i--) {
      const p = this.seats[i];
      if ((p.kind === 'remote' && p.connected === false) || (p.kind === 'bot' && this.seatIds[i])) this.removeAt(i);
    }
    this.refresh();
  }

  /** Releases the "room is open in this tab" lock */
  private unlock = () => {};

  leave() {
    this.closed = true;
    this.unlock();
    saveHostedRoom(null);
    if (this.vote) clearTimeout(this.vote.timer);
    this.voice.leave();
    this.files.clear();
    this.everyone().forEach((c) => this.send(c, { t: 'closed', reason: 'The host closed the room.' }));
    this.runner?.dispose();
    if (this.lounge) saveHostedRoom(null);
    setTimeout(() => this.peer?.destroy(), 300);
  }
}

/** Is there a room this device hosted (and can reopen)? */
export const savedHostedRoom = loadHostedRoom;

// ---------------------------------------------------------------- Client

export class ClientSession implements Session {
  private emitter = new Emitter();
  subscribe = this.emitter.subscribe;
  private snapshot: SessionSnapshot;
  private version = 0;
  private peer: Peer;
  private conn: DataConnection | null = null;
  private timeout: ReturnType<typeof setTimeout>;
  private left = false;
  private everConnected = false;
  private tries = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private voice: RoomMedia;
  private voicePeers: { peerId: string; name: string }[] = [];
  private receiver = new FileReceiver();
  private files = new AttachmentCache();

  /** Public room: hand over quickly if the host leaves, nothing saved for rejoining */
  private lounge: boolean;

  constructor(
    private code: string,
    private name: string,
    opts: { lounge?: boolean } = {},
  ) {
    this.lounge = !!opts.lounge;
    this.snapshot = {
      phase: 'connecting',
      online: true,
      isHost: false,
      roomCode: code,
      gameId: '',
      players: [],
      localSeats: [],
      views: {},
      active: [],
      result: null,
      version: 0,
      options: {},
      clockOffset: 0,
      chat: [],
      vote: null,
      reactions: [],
      spectators: [],
    };
    this.timeout = setTimeout(() => {
      if (this.snapshot.phase === 'connecting') {
        this.fail('Could not connect to the room. Some networks block direct connections; try another network or a phone hotspot.');
      }
    }, CONNECT_TIMEOUT_MS);
    this.voice = new RoomMedia(
      () => this.peer,
      () => this.update({ voice: this.voiceState() }),
    );
    this.peer = this.makePeer();
    this.unlock = holdRoom('guest', code);
  }

  /** Releases the "room is open in this tab" lock (see holdRoom) */
  private unlock: () => void = () => {};

  private makePeer() {
    const peer = new Peer();
    this.voice?.attach(peer);
    peer.on('open', () => this.connect());
    peer.on('disconnected', () => {
      if (!this.left && !peer.destroyed) peer.reconnect();
    });
    peer.on('error', (err) => {
      // While getting back in (e.g. the host is reloading), keep trying instead of giving up
      if (this.everConnected && !this.left) this.retry();
      else this.fail(peerErrorMessage(err));
    });
    return peer;
  }

  private connect() {
    const conn = this.peer.connect(PREFIX + this.code, { reliable: true });
    this.conn = conn;
    const look = myLook(!this.lounge);
    conn.on('open', () => conn.send({ t: 'hello', name: cleanName(this.name), id: clientId(), avatar: look.avatar, pic: look.picture } satisfies ToHost));
    conn.on('data', (raw) => this.onMessage(raw as ToClient));
    conn.on('close', () => {
      if (this.conn === conn && !this.left && this.snapshot.phase !== 'closed') this.retry();
    });
  }

  /** Lost the host: try to get back in for a while before giving up */
  private retry() {
    if (this.left || this.snapshot.phase === 'closed' || this.retryTimer) return;
    if (!this.everConnected || this.tries >= (this.lounge ? 1 : RECONNECT_TRIES)) {
      this.fail('Lost connection to the host.');
      return;
    }
    this.tries++;
    this.update({ reconnecting: true, notice: 'Connection lost. Reconnecting…' });
    this.retryTimer = setTimeout(
      () => {
        this.retryTimer = null;
        if (this.left) return;
        if (this.peer.destroyed) this.peer = this.makePeer();
        else if (this.peer.disconnected) this.peer.reconnect();
        else this.connect();
      },
      Math.min(6000, 1000 + this.tries * 500),
    );
  }

  private update(patch: Partial<SessionSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch, version: ++this.version };
    this.emitter.emit();
  }

  private fail(message: string) {
    clearTimeout(this.timeout);
    if (this.snapshot.phase === 'closed') return;
    saveLastRoom(null);
    this.voice.leave();
    this.update({ phase: 'closed', error: message, reconnecting: false });
  }

  private voiceState(): VoiceState {
    return this.voice.state();
  }

  private onMessage(msg: ToClient) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'state') {
      clearTimeout(this.timeout);
      const s = msg.state;
      if (!this.lounge && (!this.everConnected || this.snapshot.reconnecting)) saveLastRoom({ code: this.code, name: this.name, at: Date.now() });
      this.everConnected = true;
      this.tries = 0;
      this.voicePeers = s.voice ?? [];
      this.voice.sync(this.voicePeers);
      const watching = s.spectate !== null && s.spectate !== undefined;
      this.update({
        phase: s.phase,
        gameId: s.gameId,
        players: s.players,
        localSeats: watching ? [] : [s.seat],
        spectating: watching ? s.spectate : null,
        views: s.view === null ? {} : { [s.seat]: s.view },
        active: s.active,
        result: s.result,
        notice: s.notice,
        options: s.options ?? {},
        clockOffset: Date.now() - s.hostTime,
        vote: s.vote ?? null,
        spectators: s.spectators ?? [],
        voice: this.voiceState(),
        reconnecting: false,
        error: undefined,
        publicLounge: this.lounge,
        deadlines: s.deadlines ?? {},
        rematch: s.rematch ?? null,
        night: s.night ?? null,
        polls: Array.isArray(s.polls) ? s.polls : [],
      });
    } else if (msg.t === 'chat') {
      this.update({ chat: [...(this.snapshot.chat ?? []), msg.msg].slice(-CHAT_HISTORY) });
    } else if (msg.t === 'chatlog') {
      this.update({ chat: Array.isArray(msg.msgs) ? msg.msgs.slice(-CHAT_HISTORY) : [] });
    } else if (msg.t === 'react') {
      this.update({ reactions: [...(this.snapshot.reactions ?? []), msg.r].slice(-12) });
    } else if (msg.t === 'error') {
      this.update({ notice: msg.message });
    } else if (msg.t === 'closed') {
      this.fail(msg.reason);
    } else if (msg.t === 'pics') {
      if (this.lounge || !msg.pics || typeof msg.pics !== 'object') return;
      const pics: Record<string, string> = {};
      for (const [k, v] of Object.entries(msg.pics).slice(0, 40)) if (isSafePicture(v)) pics[k] = v;
      this.update({ pictures: pics });
    } else if (msg.t === 'file-begin') {
      this.receiver.begin('host', msg.file);
    } else if (msg.t === 'file-chunk') {
      this.receiver.chunk('host', msg.id, msg.index, msg.bytes);
    } else if (msg.t === 'file-end') {
      const done = this.receiver.finish('host', msg.id);
      if (done) void this.files.add(done.file, done.blob).then(() => this.update({ attachments: this.files.snapshot() }));
    }
  }

  getSnapshot = () => this.snapshot;

  private sendToHost(msg: ToHost) {
    if (this.conn?.open) this.conn.send(msg);
  }

  submit(_seat: Seat, move: unknown) {
    this.sendToHost({ t: 'move', move });
  }

  voteRematch() {
    this.sendToHost({ t: 'rematch' });
  }

  createPoll(question: string, options: string[], multi: boolean, anonymous: boolean) {
    this.sendToHost({ t: 'poll', question, options, multi, anonymous });
  }

  votePoll(id: string, choices: number[]) {
    this.sendToHost({ t: 'pollvote', id, choices });
  }

  closePoll(id: string) {
    this.sendToHost({ t: 'pollclose', id });
  }

  sendChat(text: string) {
    const clean = cleanChat(text);
    if (clean) this.sendToHost({ t: 'chat', text: clean });
  }

  react(emoji: string) {
    this.sendToHost({ t: 'react', emoji });
  }

  startVote(target: Seat) {
    this.sendToHost({ t: 'votekick', target });
  }

  castVote(yes: boolean) {
    this.sendToHost({ t: 'vote', yes });
  }

  follow(seat: Seat) {
    this.sendToHost({ t: 'follow', seat });
  }

  sit() {
    this.sendToHost({ t: 'sit' });
  }

  async voiceJoin() {
    if (await this.voice.join()) this.sendToHost({ t: 'voice', on: true });
  }

  voiceListen() {
    this.voice.listen();
    this.sendToHost({ t: 'voice', on: true });
  }

  voiceLeave() {
    this.voice.leave();
    this.sendToHost({ t: 'voice', on: false });
  }

  voiceMute(m: boolean) {
    this.voice.setMuted(m);
  }

  async cameraStart() {
    if (!this.voice.on) this.voiceListen();
    await this.voice.startVisual('camera');
  }

  cameraStop() {
    this.voice.stop('camera');
  }

  async screenStart() {
    if (!this.voice.on) this.voiceListen();
    await this.voice.startVisual('screen');
  }

  screenStop() {
    this.voice.stop('screen');
  }

  resumeAudio() {
    void this.voice.resumeAudio();
  }

  hearPerson(name: string, on: boolean) {
    this.voice.hearName(name, on);
  }

  /** Send a picture or file to everyone in the room (through the host) */
  async sendFile(f: File) {
    const file = cleanFileMeta({ id: newFileId(), name: f.name, size: f.size, mime: f.type || 'application/octet-stream' });
    const conn = this.conn;
    if (!file || !conn?.open) {
      this.update({ fileError: file ? 'Not connected to the room.' : 'Choose a file between 1 byte and 8 MB.' });
      return;
    }
    // Our own copy shows right away
    await this.files.add(file, f);
    this.update({ attachments: this.files.snapshot(), fileError: undefined, fileProgress: { name: file.name, sent: 0, total: file.size } });
    try {
      await sendFilePackets(conn, file, f, () => !this.left && conn.open, (sent) => this.update({ fileProgress: { name: file.name, sent, total: file.size } }));
      this.update({ fileProgress: null });
    } catch (e) {
      this.update({ fileProgress: null, fileError: e instanceof Error ? e.message : 'File transfer interrupted. Please try again.' });
    }
  }

  leave() {
    this.left = true;
    this.unlock();
    saveLastRoom(null);
    clearTimeout(this.timeout);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.voice.leave();
    this.files.clear();
    this.conn?.close();
    setTimeout(() => this.peer.destroy(), 300);
  }
}
