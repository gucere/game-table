import { GameRunner } from './runner';
import { Emitter, type Session, type SessionSnapshot } from './session';
import { defaultOptions, type GameDef, type GameOptions, type PlayerInfo, type Seat } from './types';
import { newNight, nextNight, nightFits, scoreNight, type NightState } from './night';
import { getGame } from '../games';
import { currentProfile } from '../profile/profile';

/** Everyone plays on this device (hot-seat), plus optional bots. */
export class LocalSession implements Session {
  private runner: GameRunner;
  private emitter = new Emitter();
  private snapshot!: SessionSnapshot;
  private version = 0;
  private notice: string | undefined;
  /** Rules for the next game (changed from the in-game panel) */
  private options: GameOptions;
  private night: NightState | null = null;
  private pictures: Record<string, string> = {};
  subscribe = this.emitter.subscribe;

  constructor(game: GameDef, players: PlayerInfo[], options?: GameOptions) {
    // Your profile's avatar goes on your seat (the first one, if it carries your name)
    const me = currentProfile();
    if (me && players[0]?.kind === 'human' && players[0].name === me.name) {
      players = [{ ...players[0], avatar: me.avatar }, ...players.slice(1)];
      if (me.picture) this.pictures[me.name] = me.picture;
    }
    this.runner = this.makeRunner(game, players, options);
    this.options = this.runner.options;
    this.refresh();
    this.runner.scheduleBots();
  }

  private makeRunner(game: GameDef, players: PlayerInfo[], options?: GameOptions) {
    const r = new GameRunner(game, players, options);
    r.onChange(() => {
      if (this.night) this.night = scoreNight(this.night, r.players, r.result);
      this.refresh();
    });
    return r;
  }

  startNight(queue: string[]) {
    const games = queue.filter((id) => {
      const g = getGame(id);
      return g && nightFits(g, this.runner.players, false);
    });
    if (!games.length) return;
    this.night = newNight(games, this.runner.players);
    this.launch(games[0]);
  }

  nextNight() {
    if (!this.night) return;
    this.night = nextNight(this.night);
    if (this.night.finished) this.refresh();
    else this.launch(this.night.queue[this.night.index]);
  }

  endNight() {
    this.night = null;
    this.refresh();
  }

  private launch(gameId: string) {
    const game = getGame(gameId);
    if (!game) return;
    const turn = this.options._turn;
    this.runner.dispose();
    this.options = { ...defaultOptions(game), ...(turn ? { _turn: turn } : {}) };
    this.runner = this.makeRunner(game, this.runner.players, this.options);
    this.notice = undefined;
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
      deadlines: Object.fromEntries(r.deadlines),
      night: this.night,
      pictures: this.pictures,
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
