import { defaultOptions, type GameCtx, type GameDef, type GameOptions, type GameResult, type PlayerInfo, type Seat } from './types';

const BOT_DELAY_MS = 650;
const BOT_RETRY_MS = 600;
/** Room option holding the seconds per turn ('0' = off). Starts with _ so it never clashes with a game's own options. */
export const TURN_OPTION = '_turn';

/**
 * Holds the authoritative game state, runs the bots and game timers.
 * Used directly for same-device play and by the online host.
 */
export class GameRunner {
  state: unknown;
  private botTimers = new Map<Seat, ReturnType<typeof setTimeout>>();
  private gameTimer: ReturnType<typeof setTimeout> | null = null;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  /** Turn timers: by when each person has to move (host clock) */
  deadlines = new Map<Seat, number>();
  private listeners = new Set<() => void>();
  private random = () => Math.random();
  options: GameOptions;

  constructor(
    public game: GameDef,
    public players: PlayerInfo[],
    options?: GameOptions,
    restoredState?: unknown,
  ) {
    this.options = { ...defaultOptions(game), ...options };
    // Saved options may describe an unfinished edit for the next game. Restoring
    // the current game must not try to deal a new game from that draft.
    const error = restoredState === undefined ? game.validateOptions?.(players.length, this.options) : null;
    if (error) throw new Error(error);
    this.state = restoredState === undefined ? game.setup(this.ctx()) : restoredState;
    this.scheduleTimer();
    this.updateDeadlines(null);
  }

  /** Seconds per turn from the room options (0 = no timer) */
  get turnSeconds(): number {
    if (!this.game.bot || this.game.noTurnTimer) return 0;
    const n = Number(this.options[TURN_OPTION]);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  /**
   * Turn timers: a person who just started their turn (or just moved and still has to move)
   * gets a fresh deadline. When it passes, the computer makes a simple move for them.
   */
  private updateDeadlines(moved: Seat | null) {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
    const secs = this.turnSeconds;
    if (!secs || this.result) {
      this.deadlines.clear();
      return;
    }
    const people = new Set(this.active.filter((s) => this.players[s]?.kind !== 'bot'));
    for (const s of [...this.deadlines.keys()]) if (!people.has(s)) this.deadlines.delete(s);
    const now = Date.now();
    for (const s of people) if (!this.deadlines.has(s) || s === moved) this.deadlines.set(s, now + secs * 1000);
    if (!this.deadlines.size) return;
    const next = Math.min(...this.deadlines.values());
    this.turnTimer = setTimeout(() => this.timeUp(), Math.max(0, next - now) + 50);
  }

  private timeUp() {
    this.turnTimer = null;
    const now = Date.now();
    const late = [...this.deadlines.entries()].filter(([, at]) => at <= now).map(([s]) => s);
    for (const seat of late) {
      if (this.result || !this.active.includes(seat)) continue;
      let move: unknown = null;
      try {
        move = this.game.bot!(this.view(seat), seat, { random: this.random, level: 'easy' });
      } catch (e) {
        console.error('Turn timer move failed', e);
      }
      if (move !== null && !this.submit(seat, move)) continue;
      // No move possible right now: try again shortly
      this.deadlines.set(seat, now + 3000);
    }
    if (!this.turnTimer) this.updateDeadlines(null);
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

  private setState(next: unknown, moved: Seat | null = null) {
    this.state = next;
    this.updateDeadlines(moved);
    this.emit();
    this.scheduleTimer();
    this.scheduleBots();
  }

  /** Returns an error string, or null on success */
  submit(seat: Seat, move: unknown): string | null {
    if (this.result) return 'The game is over';
    if (!this.active.includes(seat) && !this.game.canSubmitOutsideTurn?.(this.state, seat, move)) return 'Not your turn';
    let next: unknown;
    try {
      next = this.game.move(this.state, seat, move, this.ctx());
    } catch (e) {
      console.error(e);
      return 'Invalid move';
    }
    if (typeof next === 'string') return next;
    this.setState(next, seat);
    return null;
  }

  restart(options?: GameOptions): string | null {
    const nextOptions = options ? { ...defaultOptions(this.game), ...options } : this.options;
    const error = this.game.validateOptions?.(this.players.length, nextOptions);
    if (error) return error;
    const nextState = this.game.setup({ ...this.ctx(), options: nextOptions });
    this.options = nextOptions;
    this.clearBots();
    this.deadlines.clear();
    this.setState(nextState);
    return null;
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
        // null = the bot isn't ready yet (e.g. a word list still loading): ask again shortly
        if (move === null) {
          setTimeout(() => this.scheduleBots(), BOT_RETRY_MS);
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
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.listeners.clear();
  }
}
