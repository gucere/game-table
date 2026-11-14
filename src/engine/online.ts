/**
 * Peer-to-peer online play over WebRTC (PeerJS).
 *
 * The free public PeerJS broker is only used so browsers can find each other
 * (a few small messages); after that, game traffic flows directly between
 * players. The host's browser runs the rules and sends each player only the
 * view they are allowed to see.
 */
import { Peer, type DataConnection } from 'peerjs';
import { getGame } from '../games';
import { GameRunner } from './runner';
import { Emitter, type ChatMsg, type Session, type SessionSnapshot, type VoteInfo } from './session';
import { defaultOptions, type GameOptions, type GameResult, type PlayerInfo, type Seat } from './types';

const PREFIX = 'oyunmasasi-v1-';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const CONNECT_TIMEOUT_MS = 20000;
const CHAT_MAX_LEN = 200;
const CHAT_HISTORY = 100;
/** At most this many chat messages per player per CHAT_WINDOW_MS */
const CHAT_BURST = 5;
const CHAT_WINDOW_MS = 5000;
const VOTE_MS = 30000;

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
 * A random id remembered on this device, so a player who was voted out
 * can't simply rejoin the same room. (Not bulletproof: a private window gets a new id.)
 */
function clientId() {
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
  | { t: 'hello'; name: string; id?: string }
  | { t: 'move'; move: unknown }
  | { t: 'chat'; text: string }
  | { t: 'votekick'; target: Seat }
  | { t: 'vote'; yes: boolean };

interface ClientState {
  phase: 'lobby' | 'playing';
  gameId: string;
  players: PlayerInfo[];
  seat: Seat;
  view: unknown;
  active: Seat[];
  result: GameResult | null;
  notice?: string;
  options: GameOptions;
  hostTime: number;
  vote: VoteInfo | null;
}

type ToClient =
  | { t: 'state'; state: ClientState }
  | { t: 'error'; message: string }
  | { t: 'chat'; msg: ChatMsg }
  | { t: 'chatlog'; msgs: ChatMsg[] }
  | { t: 'closed'; reason: string };

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
  private runner: GameRunner | null = null;
  private closed = false;

  private chatLog: ChatMsg[] = [];
  private chatId = 0;
  private chatTimes = new Map<DataConnection, number[]>();
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

  constructor(gameId: string, hostName: string) {
    this.gameId = gameId;
    this.options = defaultOptions(getGame(gameId)!);
    this.seats = [{ name: cleanName(hostName, 'Host'), kind: 'human', connected: true }];
    this.conns = [null];
    this.refresh();
    this.openPeer(0);
  }

  private openPeer(attempt: number) {
    const code = makeRoomCode();
    const peer = new Peer(PREFIX + code);
    this.peer = peer;
    peer.on('open', () => {
      this.roomCode = code;
      this.phase = 'lobby';
      this.refresh();
    });
    peer.on('connection', (conn) => this.onConnection(conn));
    peer.on('disconnected', () => {
      // Lost the matchmaking server; existing player connections keep working.
      if (!this.closed && !peer.destroyed) peer.reconnect();
    });
    peer.on('error', (err) => {
      if (err.type === 'unavailable-id' && attempt < 3) {
        peer.destroy();
        this.openPeer(attempt + 1);
        return;
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

  private get game() {
    return getGame(this.gameId)!;
  }

  private onConnection(conn: DataConnection) {
    let greeted = false;
    conn.on('data', (raw) => {
      const msg = raw as ToHost;
      if (!msg || typeof msg !== 'object') return;
      if (!greeted) {
        if (msg.t !== 'hello') return;
        greeted = true;
        if (typeof msg.id === 'string') this.clientIds.set(conn, msg.id.slice(0, 64));
        this.admit(conn, cleanName(msg.name));
        return;
      }
      const from = this.conns.indexOf(conn);
      if (msg.t === 'chat') {
        if (from < 0 || !this.allowChat(conn)) return;
        this.chatFrom(from, msg.text);
      } else if (msg.t === 'votekick') {
        if (from >= 0) this.beginVote(from, Number(msg.target));
      } else if (msg.t === 'vote') {
        if (from >= 0) this.voteFrom(from, !!msg.yes);
      } else if (msg.t === 'move') {
        const seat = this.conns.indexOf(conn);
        if (seat < 0 || !this.runner) return;
        const err = this.runner.submit(seat, msg.move);
        if (err) this.send(conn, { t: 'error', message: err });
      }
    });
    conn.on('close', () => this.onDisconnect(conn));
    conn.on('error', () => this.onDisconnect(conn));
  }

  private admit(conn: DataConnection, name: string) {
    const id = this.clientIds.get(conn);
    if (id && this.banned.has(id)) {
      this.reject(conn, 'You were voted out of this room.');
      return;
    }
    if (this.phase === 'playing') {
      this.reject(conn, 'A game is already in progress in this room.');
      return;
    }
    const info: PlayerInfo = { name, kind: 'remote', connected: true };
    if (this.seats.length < this.game.maxPlayers) {
      this.seats.push(info);
      this.conns.push(conn);
    } else {
      // Room full: take over a bot seat if there is one
      const botSeat = this.seats.findIndex((p) => p.kind === 'bot');
      if (botSeat < 0) {
        this.reject(conn, 'This room is full.');
        return;
      }
      this.seats[botSeat] = info;
      this.conns[botSeat] = conn;
    }
    this.notice = `${name} joined`;
    this.refresh();
    this.send(conn, { t: 'chatlog', msgs: this.chatLog });
    this.system(`${name} joined the room.`);
  }

  private reject(conn: DataConnection, reason: string) {
    this.send(conn, { t: 'closed', reason });
    setTimeout(() => conn.close(), 300);
  }

  private onDisconnect(conn: DataConnection) {
    this.chatTimes.delete(conn);
    const seat = this.conns.indexOf(conn);
    if (seat < 0) return;
    this.dropSeat(seat, 'left');
  }

  /** Remove a remote player: in the lobby the seat goes away, mid-game a bot takes over */
  private dropSeat(seat: Seat, how: 'left' | 'was voted out') {
    const name = this.seats[seat].name;
    if (this.phase === 'lobby') {
      this.seats.splice(seat, 1);
      this.conns.splice(seat, 1);
      this.notice = `${name} ${how}`;
    } else {
      this.conns[seat] = null;
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

  // ------------------------------------------------------------ chat

  private allowChat(conn: DataConnection) {
    const now = Date.now();
    const recent = (this.chatTimes.get(conn) ?? []).filter((t) => now - t < CHAT_WINDOW_MS);
    if (recent.length >= CHAT_BURST) {
      this.send(conn, { t: 'error', message: 'Slow down a little: too many messages.' });
      return false;
    }
    recent.push(now);
    this.chatTimes.set(conn, recent);
    return true;
  }

  private chatFrom(seat: Seat, text: unknown) {
    const clean = cleanChat(text);
    if (!clean || !this.seats[seat]) return;
    this.addChat({ seat, name: this.seats[seat].name, text: clean });
  }

  private system(text: string) {
    this.addChat({ seat: null, name: '', text, system: true });
  }

  private addChat(m: Omit<ChatMsg, 'id' | 'time'>) {
    const msg: ChatMsg = { ...m, id: ++this.chatId, time: Date.now() };
    this.chatLog = [...this.chatLog, msg].slice(-CHAT_HISTORY);
    this.conns.forEach((c) => c && this.send(c, { t: 'chat', msg }));
    if (this.snapshot) {
      this.snapshot = { ...this.snapshot, chat: this.chatLog, version: ++this.version };
      this.emitter.emit();
    }
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
    this.chatFrom(0, text);
  }

  startVote(target: Seat) {
    this.beginVote(0, target);
  }

  castVote(yes: boolean) {
    this.voteFrom(0, yes);
  }

  private send(conn: DataConnection, msg: ToClient) {
    try {
      if (conn.open) conn.send(msg);
    } catch (e) {
      console.warn('send failed', e);
    }
  }

  private refresh() {
    const r = this.runner;
    if (r) this.seats = [...r.players];
    const players = [...this.seats];
    const views: Record<number, unknown> = {};
    if (r) views[0] = r.view(0);
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
    };
    this.broadcast();
    this.emitter.emit();
  }

  private broadcast() {
    if (this.phase !== 'lobby' && this.phase !== 'playing') return;
    const r = this.runner;
    this.conns.forEach((conn, seat) => {
      if (!conn) return;
      this.send(conn, {
        t: 'state',
        state: {
          phase: this.phase as 'lobby' | 'playing',
          gameId: this.gameId,
          players: this.seats,
          seat,
          view: r ? r.view(seat) : null,
          active: r ? r.active : [],
          result: r ? r.result : null,
          notice: this.notice,
          options: this.options,
          hostTime: Date.now(),
          vote: this.snapshot.vote ?? null,
        },
      });
    });
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
      if (this.seats[i].kind === 'bot') {
        this.seats.splice(i, 1);
        this.conns.splice(i, 1);
      }
    }
    this.notice = undefined;
    this.refresh();
  }

  /** In the lobby this sets up the game; mid-game it applies from the next round */
  setOption(id: string, value: string) {
    if (this.phase !== 'lobby' && this.phase !== 'playing') return;
    this.options = { ...this.options, [id]: value };
    this.refresh();
  }

  addBot() {
    if (this.phase !== 'lobby' || this.seats.length >= this.game.maxPlayers || !this.game.bot) return;
    const n = this.seats.filter((p) => p.kind === 'bot').length + 1;
    this.seats.push({ name: `Bot ${n}`, kind: 'bot', level: 'normal' });
    this.conns.push(null);
    this.refresh();
  }

  removeSeat(seat: Seat) {
    if (this.phase !== 'lobby' || seat === 0) return;
    const conn = this.conns[seat];
    this.seats.splice(seat, 1);
    this.conns.splice(seat, 1);
    if (conn) this.reject(conn, 'The host removed you from the room.');
    this.refresh();
  }

  start() {
    const g = this.game;
    if (this.phase !== 'lobby') return;
    if (this.seats.length < g.minPlayers || this.seats.length > g.maxPlayers) return;
    this.runner = new GameRunner(g, [...this.seats], this.options);
    this.runner.onChange(() => this.refresh());
    this.phase = 'playing';
    this.notice = undefined;
    this.refresh();
    this.runner.scheduleBots();
  }

  restart() {
    this.notice = undefined;
    this.runner?.restart(this.options);
  }

  backToLobby() {
    if (this.phase !== 'playing') return;
    this.runner?.dispose();
    this.runner = null;
    this.phase = 'lobby';
    this.notice = undefined;
    // Players who left mid-game were replaced by bots; keep them as bots in the lobby
    this.seats = this.seats.filter((p) => p.kind !== 'remote' || p.connected !== false);
    this.refresh();
  }

  leave() {
    this.closed = true;
    if (this.vote) clearTimeout(this.vote.timer);
    this.conns.forEach((c) => c && this.send(c, { t: 'closed', reason: 'The host closed the room.' }));
    this.runner?.dispose();
    setTimeout(() => this.peer?.destroy(), 300);
  }
}

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

  constructor(code: string, name: string) {
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
    };
    this.timeout = setTimeout(() => {
      if (this.snapshot.phase === 'connecting') {
        this.fail('Could not connect to the room. Some networks block direct connections; try another network or a phone hotspot.');
      }
    }, CONNECT_TIMEOUT_MS);

    this.peer = new Peer();
    this.peer.on('open', () => {
      const conn = this.peer.connect(PREFIX + code, { reliable: true });
      this.conn = conn;
      conn.on('open', () => conn.send({ t: 'hello', name: cleanName(name), id: clientId() } satisfies ToHost));
      conn.on('data', (raw) => this.onMessage(raw as ToClient));
      conn.on('close', () => {
        if (!this.left && this.snapshot.phase !== 'closed') this.fail('Lost connection to the host.');
      });
    });
    this.peer.on('error', (err) => this.fail(peerErrorMessage(err)));
  }

  private update(patch: Partial<SessionSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch, version: ++this.version };
    this.emitter.emit();
  }

  private fail(message: string) {
    clearTimeout(this.timeout);
    if (this.snapshot.phase === 'closed') return;
    this.update({ phase: 'closed', error: message });
  }

  private onMessage(msg: ToClient) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'state') {
      clearTimeout(this.timeout);
      const s = msg.state;
      this.update({
        phase: s.phase,
        gameId: s.gameId,
        players: s.players,
        localSeats: [s.seat],
        views: s.view === null ? {} : { [s.seat]: s.view },
        active: s.active,
        result: s.result,
        notice: s.notice,
        options: s.options ?? {},
        clockOffset: Date.now() - s.hostTime,
        vote: s.vote ?? null,
        error: undefined,
      });
    } else if (msg.t === 'chat') {
      this.update({ chat: [...(this.snapshot.chat ?? []), msg.msg].slice(-CHAT_HISTORY) });
    } else if (msg.t === 'chatlog') {
      this.update({ chat: Array.isArray(msg.msgs) ? msg.msgs.slice(-CHAT_HISTORY) : [] });
    } else if (msg.t === 'error') {
      this.update({ notice: msg.message });
    } else if (msg.t === 'closed') {
      this.fail(msg.reason);
    }
  }

  getSnapshot = () => this.snapshot;

  private sendToHost(msg: ToHost) {
    if (this.conn?.open) this.conn.send(msg);
  }

  submit(_seat: Seat, move: unknown) {
    this.sendToHost({ t: 'move', move });
  }

  sendChat(text: string) {
    const clean = cleanChat(text);
    if (clean) this.sendToHost({ t: 'chat', text: clean });
  }

  startVote(target: Seat) {
    this.sendToHost({ t: 'votekick', target });
  }

  castVote(yes: boolean) {
    this.sendToHost({ t: 'vote', yes });
  }

  leave() {
    this.left = true;
    clearTimeout(this.timeout);
    this.conn?.close();
    setTimeout(() => this.peer.destroy(), 300);
  }
}
