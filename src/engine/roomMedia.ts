import type { Peer, MediaConnection } from 'peerjs';
import type { VoiceState } from './session';

type Kind = 'audio' | 'camera' | 'screen';
const PROTOCOL = 'game-table-media-v1';
const validKind = (kind: unknown): kind is Kind => kind === 'audio' || kind === 'camera' || kind === 'screen';

/** Separate one-way publications keep microphone audio running while either video source changes. */
export class RoomMedia {
  private streams = new Map<Kind, MediaStream>();
  private calls = new Map<string, MediaConnection>();
  private remote = new Map<string, { peerId: string; kind: Kind; stream: MediaStream }>();
  private audio = new Map<string, HTMLAudioElement>();
  private members = new Map<string, string>();
  private attached = new WeakSet<Peer>();
  private pending = new Map<MediaConnection, ReturnType<typeof setTimeout>>();
  private retry: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private allowed = true;
  private busy = new Set<Kind>();
  on = false;
  muted = false;
  error?: string;
  audioBlocked = false;
  constructor(private peer: () => Peer | null, private changed: () => void) {}

  attach(peer: Peer) {
    if (this.attached.has(peer)) return;
    this.attached.add(peer);
    peer.on('call', (call) => {
      if (!this.on || call.metadata?.protocol !== PROTOCOL || !validKind(call.metadata?.kind)) { call.close(); return; }
      if (this.members.has(call.peer)) this.answer(call);
      else if (this.pending.size < 24) {
        // The media offer can race the host's roster update.
        this.pending.set(call, setTimeout(() => { this.pending.delete(call); call.close(); }, 3000));
      } else call.close();
    });
  }
  private answer(call: MediaConnection) {
    const timer = this.pending.get(call); if (timer) clearTimeout(timer); this.pending.delete(call);
    const kind: Kind = call.metadata.kind;
    const key = `in:${call.peer}:${kind}`;
    this.drop(key);
    this.track(key, call, kind, true);
    call.answer();
  }
  private track(key: string, call: MediaConnection, kind: Kind, incoming: boolean) {
    this.calls.set(key, call);
    if (incoming) call.on('stream', (stream) => {
      if (this.calls.get(key) !== call || !this.on) return;
      this.remote.set(key, { peerId: call.peer, kind, stream });
      if (kind === 'audio') {
        const audio = this.audio.get(key) ?? new Audio();
        audio.autoplay = true; audio.setAttribute('playsinline', ''); audio.srcObject = stream;
        this.audio.set(key, audio);
        audio.play().catch(() => { this.audioBlocked = true; this.changed(); });
      }
      this.changed();
    });
    const ended = () => {
      if (this.calls.get(key) !== call) return;
      this.drop(key); this.changed();
      if (!incoming && this.on && !this.retry) this.retry = setTimeout(() => { this.retry = null; this.publish(); }, 1500);
    };
    call.on('close', ended); call.on('error', ended);
  }
  private drop(key: string) {
    const call = this.calls.get(key); this.calls.delete(key); call?.close();
    const audio = this.audio.get(key); if (audio) { audio.pause(); audio.srcObject = null; this.audio.delete(key); }
    this.remote.delete(key);
  }
  private publish() {
    const peer = this.peer();
    if (!this.on || !peer?.open || !this.members.has(peer.id)) return;
    for (const id of this.members.keys()) if (id !== peer.id) for (const [kind, stream] of this.streams) {
      const key = `out:${id}:${kind}`;
      if (this.calls.has(key)) continue;
      const call = peer.call(id, stream, { metadata: { protocol: PROTOCOL, kind } });
      if (call) this.track(key, call, kind, false);
    }
  }
  sync(members: { peerId: string; name: string }[]) {
    this.members = new Map(members.map((p) => [p.peerId, p.name]));
    let dropped = false;
    for (const [key, call] of this.calls) if (!this.members.has(call.peer)) { this.drop(key); dropped = true; }
    for (const call of this.pending.keys()) if (this.members.has(call.peer) && this.on) this.answer(call);
    this.publish();
    if (dropped) queueMicrotask(() => this.changed());
  }
  listen() { this.on = true; this.error = undefined; this.changed(); }
  async join(): Promise<boolean> { return this.capture('audio'); }
  async startVisual(kind: 'camera' | 'screen'): Promise<boolean> { return this.capture(kind); }
  private async capture(kind: Kind): Promise<boolean> {
    if (this.streams.has(kind)) return true;
    if (!this.allowed || this.busy.has(kind)) return false;
    const generation = this.generation;
    this.busy.add(kind); this.error = undefined; this.changed();
    try {
      const stream = kind === 'screen'
        ? await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 10, max: 15 } }, audio: false })
        : await navigator.mediaDevices.getUserMedia(kind === 'audio'
          ? { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }
          : { audio: false, video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 15, max: 24 } } });
      if (generation !== this.generation || !this.allowed) { stream.getTracks().forEach((track) => track.stop()); return false; }
      if (!stream.getTracks().length) return false;
      this.streams.set(kind, stream); this.on = true;
      for (const track of stream.getTracks()) {
        track.enabled = kind !== 'audio' || !this.muted;
        track.onended = () => { if (this.streams.get(kind) === stream) this.stop(kind); };
      }
      this.publish();
      return true;
    } catch {
      this.error = kind === 'screen' ? 'Screen sharing was cancelled or is unavailable in this browser.' : kind === 'camera' ? 'Camera access was blocked or no camera is available.' : 'Microphone access was blocked. Allow it in your browser to join voice chat.';
      return false;
    } finally { this.busy.delete(kind); this.changed(); }
  }
  stop(kind: Kind) {
    const stream = this.streams.get(kind); this.streams.delete(kind);
    stream?.getTracks().forEach((track) => { track.onended = null; track.stop(); });
    for (const key of [...this.calls.keys()]) if (key.startsWith('out:') && key.endsWith(`:${kind}`)) this.drop(key);
    this.changed();
  }
  setMuted(muted: boolean) { this.muted = muted; this.applyAllowed(); this.changed(); }
  setAllowed(allowed: boolean) { if (this.allowed !== allowed) { this.allowed = allowed; this.applyAllowed(); } }
  private applyAllowed() { for (const [kind, stream] of this.streams) for (const track of stream.getTracks()) track.enabled = this.allowed && (kind !== 'audio' || !this.muted); }
  async resumeAudio() { const results = await Promise.allSettled([...this.audio.values()].map((audio) => audio.play())); this.audioBlocked = results.some((r) => r.status === 'rejected'); this.changed(); }
  state(): VoiceState {
    return {
      members: [...this.members.values()], on: this.on, muted: this.muted, error: this.error,
      microphone: this.streams.has('audio'), camera: this.streams.has('camera'), screen: this.streams.has('screen'),
      pending: this.busy.size > 0, suppressed: !this.allowed, audioBlocked: this.audioBlocked,
      localCamera: this.streams.get('camera') ?? null, localScreen: this.streams.get('screen') ?? null,
      videos: [...this.remote.entries()].filter(([, remote]) => remote.kind !== 'audio').map(([id, remote]) => ({ id, peerId: remote.peerId, name: this.members.get(remote.peerId) ?? 'Player', kind: remote.kind as 'camera' | 'screen', stream: remote.stream })),
    };
  }
  leave() {
    this.generation++; this.on = false;
    if (this.retry) clearTimeout(this.retry); this.retry = null;
    for (const [call, timer] of this.pending) { clearTimeout(timer); call.close(); } this.pending.clear();
    for (const key of [...this.calls.keys()]) this.drop(key);
    for (const stream of this.streams.values()) for (const track of stream.getTracks()) { track.onended = null; track.stop(); }
    this.streams.clear(); this.muted = false; this.audioBlocked = false; this.error = undefined; this.changed();
  }
}
