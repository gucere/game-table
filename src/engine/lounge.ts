/**
 * Public rooms: chat and call rooms anyone can walk into from the home page.
 *
 * There is no server, so a public room is hosted by whoever is in it: the first visitor
 * becomes the host (the room's fixed code is their address on the matchmaking broker), and
 * everyone else joins them. If the host leaves, the others try to rejoin; one of them takes
 * over the code and the rest connect to the new host. Messages from before the handover are
 * lost, which suits a casual room. Pictures and files can't be shared in public rooms.
 */
import { ClientSession, HostSession, LOUNGE_TAKEN } from './online';
import { Emitter, type Session, type SessionSnapshot } from './session';
import type { Seat } from './types';

/** Fixed codes: each contains a letter or digit that random room codes never use */
export const PUBLIC_ROOMS = [
  { code: 'LOBI01', name: 'General chat', icon: '🌍' },
  { code: 'OYUN01', name: 'Looking for players', icon: '🎲' },
  { code: 'INTL01', name: 'English chat', icon: '🇬🇧' },
] as const;

const RULES_KEY = 'oyun-masasi:public-rules-ok';
export const rulesAccepted = () => {
  try {
    return localStorage.getItem(RULES_KEY) === 'yes';
  } catch {
    return false;
  }
};
export const acceptRules = () => {
  try {
    localStorage.setItem(RULES_KEY, 'yes');
  } catch {
    /* fine: we just ask again next time */
  }
};

/** Messages that mean the room itself is gone (rather than that we were turned away) */
const HOST_GONE = ['Lost connection to the host.', 'The host closed the room.', 'Could not connect to the room.'];

export class PublicLounge implements Session {
  private emitter = new Emitter();
  subscribe = this.emitter.subscribe;
  private snapshot: SessionSnapshot;
  private inner: HostSession | ClientSession | null = null;
  private unsub: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private attempts = 0;

  constructor(
    private code: string,
    private name: string,
  ) {
    this.snapshot = this.waiting();
    this.join();
  }

  private waiting(): SessionSnapshot {
    return {
      phase: 'connecting',
      online: true,
      isHost: false,
      roomCode: this.code,
      gameId: 'sohbet-odasi',
      players: [],
      localSeats: [],
      views: {},
      active: [],
      result: null,
      version: Date.now(),
      options: {},
      clockOffset: 0,
      publicLounge: true,
    };
  }

  private use(s: HostSession | ClientSession) {
    this.unsub?.();
    this.inner = s;
    this.unsub = s.subscribe(() => this.onInner());
    this.onInner();
  }

  private join() {
    if (this.closed) return;
    this.use(new ClientSession(this.code, this.name, { lounge: true }));
  }

  private host() {
    if (this.closed) return;
    this.use(new HostSession('sohbet-odasi', this.name, null, { code: this.code, lounge: true }));
  }

  /** Try again in a moment (random, so two people don't keep colliding) */
  private retry(next: () => void) {
    const old = this.inner;
    this.unsub?.();
    this.unsub = null;
    this.inner = null;
    old?.leave();
    this.attempts++;
    if (this.attempts > 12) {
      this.snapshot = { ...this.waiting(), phase: 'closed', error: 'Could not open the public room. Check your connection and try again.' };
      this.emitter.emit();
      return;
    }
    this.snapshot = { ...this.waiting(), notice: 'Finding the room…' };
    this.emitter.emit();
    this.timer = setTimeout(next, 300 + Math.random() * 1700);
  }

  private onInner() {
    const s = this.inner;
    if (!s || this.closed) return;
    const snap = s.getSnapshot();
    if (snap.phase === 'closed') {
      const err = snap.error ?? '';
      if (s instanceof HostSession) {
        // Someone else got there first: join them
        if (err === LOUNGE_TAKEN) return this.retry(() => this.join());
      } else if (err.startsWith('Room not found')) {
        // Nobody is hosting: take the room
        return this.retry(() => this.host());
      } else if (HOST_GONE.some((m) => err.startsWith(m))) {
        // The host left: rejoin, and if nobody has taken over, host it
        return this.retry(() => this.join());
      }
    }
    if (snap.phase === 'playing' || snap.phase === 'lobby') this.attempts = 0;
    this.snapshot = { ...snap, publicLounge: true, roomCode: this.code };
    this.emitter.emit();
  }

  getSnapshot = () => this.snapshot;

  submit = (seat: Seat, move: unknown) => this.inner?.submit(seat, move);
  sendChat = (text: string) => this.inner?.sendChat?.(text);
  startVote = (target: Seat) => this.inner?.startVote?.(target);
  castVote = (yes: boolean) => this.inner?.castVote?.(yes);
  react = (emoji: string) => this.inner?.react?.(emoji);
  follow = (seat: Seat) => (this.inner as Session | null)?.follow?.(seat);
  sit = () => (this.inner as Session | null)?.sit?.();
  voiceJoin = () => this.inner?.voiceJoin?.();
  voiceListen = () => this.inner?.voiceListen?.();
  voiceLeave = () => this.inner?.voiceLeave?.();
  voiceMute = (m: boolean) => this.inner?.voiceMute?.(m);
  cameraStart = async () => this.inner?.cameraStart?.();
  cameraStop = () => this.inner?.cameraStop?.();
  screenStart = async () => this.inner?.screenStart?.();
  screenStop = () => this.inner?.screenStop?.();
  resumeAudio = () => this.inner?.resumeAudio?.();
  hearPerson = (name: string, on: boolean) => this.inner?.hearPerson?.(name, on);

  leave() {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.unsub?.();
    this.inner?.leave();
    this.inner = null;
  }
}
