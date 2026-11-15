import { GameRunner } from './runner';
import { Emitter, type Session, type SessionSnapshot } from './session';
import type { GameDef, GameOptions, PlayerInfo, Seat } from './types';

/** Everyone plays on this device (hot-seat), plus optional bots. */
export class LocalSession implements Session {
  private runner: GameRunner;
  private emitter = new Emitter();
  private snapshot!: SessionSnapshot;
  private version = 0;
  private notice: string | undefined;
  /** Rules for the next game (changed from the in-game panel) */
  private options: GameOptions;
  subscribe = this.emitter.subscribe;

  constructor(game: GameDef, players: PlayerInfo[], options?: GameOptions) {
    this.runner = new GameRunner(game, players, options);
    this.options = this.runner.options;
    this.runner.onChange(() => this.refresh());
    this.refresh();
    this.runner.scheduleBots();
  }

  private refresh() {
    const r = this.runner;
    const humans = r.players.flatMap((p, i) => (p.kind === 'human' ? [i] : []));
    // An all-bot table still needs a perspective to show
    const localSeats = humans.length ? humans : [0];
    const views: Record<number, unknown> = {};
    for (const s of localSeats) views[s] = r.view(s);
    this.snapshot = {
      phase: 'playing',
      online: false,
      isHost: true,
      gameId: r.game.id,
      players: r.players,
      localSeats,
      views,
      active: r.active,
      result: r.result,
      version: ++this.version,
      options: this.options,
      notice: this.notice,
      clockOffset: 0,
    };
    this.emitter.emit();
  }

  getSnapshot = () => this.snapshot;

  submit(seat: Seat, move: unknown) {
    const err = this.runner.submit(seat, move);
    if (err) console.warn(err);
  }

  setOption(id: string, value: string) {
    this.options = { ...this.options, [id]: value };
    this.notice = undefined;
    this.refresh();
  }

  restart() {
    this.notice = undefined;
    const error = this.runner.restart(this.options);
    if (error) {
      this.notice = error;
      this.refresh();
    }
  }

  leave() {
    this.runner.dispose();
  }
}
