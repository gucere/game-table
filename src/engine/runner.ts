import { defaultOptions, type GameCtx, type GameDef, type GameOptions, type GameResult, type PlayerInfo, type Seat } from './types';

const BOT_DELAY_MS = 650;

/**
 * Holds the authoritative game state, runs the bots and game timers.
 * Used directly for same-device play and by the online host.
 */
export class GameRunner {
  state: unknown;
  private botTimers = new Map<Seat, ReturnType<typeof setTimeout>>();
  private gameTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();
  private random = () => Math.random();
  options: GameOptions;

  constructor(
    public game: GameDef,
    public players: PlayerInfo[],
    options?: GameOptions,
  ) {
    this.options = { ...defaultOptions(game), ...options };
    this.state = game.setup(this.ctx());
    this.scheduleTimer();
  }

  private ctx(): GameCtx {
    return { numPlayers: this.players.length, random: this.random, options: this.options, now: () => Date.now() };
  }

  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  get active(): Seat[] {
    return this.game.activePlayers(this.state);
  }

  get result(): GameResult | null {
    return this.game.result(this.state);
  }

  view(seat: Seat) {
    return this.game.view(this.state, seat);
  }

  private setState(next: unknown) {
    this.state = next;
    this.emit();
    this.scheduleTimer();
    this.scheduleBots();
  }

  /** Returns an error string, or null on success */
  submit(seat: Seat, move: unknown): string | null {
    if (this.result) return 'The game is over';
    if (!this.active.includes(seat)) return 'Not your turn';
    let next: unknown;
    try {
      next = this.game.move(this.state, seat, move, this.ctx());
    } catch (e) {
      console.error(e);
      return 'Invalid move';
    }
    if (typeof next === 'string') return next;
    this.setState(next);
    return null;
  }

  restart(options?: GameOptions) {
    if (options) this.options = { ...defaultOptions(this.game), ...options };
    this.clearBots();
    this.setState(this.game.setup(this.ctx()));
  }

  /** Pick up a saved game (the host reloaded the page) */
  restoreState(state: unknown) {
    this.clearBots();
    this.setState(state);
  }

  setPlayer(seat: Seat, info: PlayerInfo) {
    this.players = this.players.map((p, i) => (i === seat ? info : p));
    this.emit();
    this.scheduleBots();
  }

  private scheduleTimer() {
    if (this.gameTimer) clearTimeout(this.gameTimer);
    this.gameTimer = null;
    const at = this.game.timer?.(this.state);
    if (at == null || this.result) return;
    this.gameTimer = setTimeout(() => {
      this.gameTimer = null;
      if (this.game.onTimer) this.setState(this.game.onTimer(this.state, this.ctx()));
    }, Math.max(0, at - Date.now()));
  }

  scheduleBots() {
    if (!this.game.bot || this.result) return;
    const delay = this.game.botDelay?.(this.state) ?? BOT_DELAY_MS;
    for (const seat of this.active) {
      const p = this.players[seat];
      if (p?.kind !== 'bot' || this.botTimers.has(seat)) continue;
      const timer = setTimeout(() => {
        this.botTimers.delete(seat);
        if (this.result || !this.active.includes(seat)) return;
        let move: unknown;
        try {
          move = this.game.bot!(this.view(seat), seat, { random: this.random, level: p.level ?? 'normal' });
        } catch (e) {
          console.error('Bot crashed', e);
          return;
        }
        const err = this.submit(seat, move);
        if (err) console.warn(`Bot in seat ${seat} made an illegal move:`, err, move);
      }, delay);
      this.botTimers.set(seat, timer);
    }
  }

  clearBots() {
    this.botTimers.forEach((t) => clearTimeout(t));
    this.botTimers.clear();
  }

  dispose() {
    this.clearBots();
    if (this.gameTimer) clearTimeout(this.gameTimer);
    this.listeners.clear();
  }
}
