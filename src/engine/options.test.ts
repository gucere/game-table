import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkCounts, countsFor, suggestedCounts, validateRoster } from '../games/vampir/config';
import { ROLE_IDS } from '../games/vampir/roles';
import { LocalSession } from './localSession';
import { GameRunner } from './runner';
import type { GameDef, PlayerInfo } from './types';

const players: PlayerInfo[] = Array.from({ length: 4 }, (_, i) => ({ name: `Player ${i + 1}`, kind: 'human' }));
const invalidRoster = JSON.stringify({ vampir: 1, koylu: 2 });
const validRoster = JSON.stringify({ vampir: 1, koylu: 3 });

interface State {
  deal: number;
  moves: number;
  ticks: number;
  deadline: number | null;
}

/** A small timed game isolates the runner contract from any role-specific rules. */
function gameFixture() {
  let deal = 0;
  const setup = vi.fn((): State => ({ deal: ++deal, moves: 0, ticks: 0, deadline: Date.now() + 1000 }));
  const game: GameDef<State, { type: 'play' }, State> = {
    id: 'options-test',
    name: 'Options test',
    tagline: '',
    icon: '',
    minPlayers: 4,
    maxPlayers: 12,
    hiddenInfo: false,
    options: [{ id: 'roster', label: 'Roles', default: 'auto', choices: [{ value: 'auto', label: 'Automatic' }] }],
    validateOptions: (n, options) => validateRoster(n, options),
    setup,
    activePlayers: () => [0],
    view: (state) => state,
    move: (state) => ({ ...state, moves: state.moves + 1 }),
    result: () => null,
    timer: (state) => state.deadline,
    onTimer: (state) => ({ ...state, deadline: null, ticks: state.ticks + 1 }),
    Board: () => null,
  };
  return { game, setup };
}

const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose());
  vi.useRealTimers();
});

describe('role lineup configuration', () => {
  it('suggests a complete playable lineup for every table size', () => {
    for (let n = 4; n <= 12; n++) {
      const counts = suggestedCounts(n);
      expect(Object.keys(counts).sort()).toEqual([...ROLE_IDS].sort());
      expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(n);
      expect(counts.vampir).toBeGreaterThan(0);
      expect(checkCounts(n, counts)).toBeNull();
      expect(validateRoster(n, { roster: 'auto' })).toBeNull();
      expect(validateRoster(n, { roster: JSON.stringify(counts) })).toBeNull();
    }
    // Bigger tables get more special roles, not just more villagers
    const kinds = (n: number) => Object.values(suggestedCounts(n)).filter((x) => x > 0).length;
    expect(kinds(12)).toBeGreaterThan(kinds(4));
  });

  it('follows the table size when automatic, keeps custom counts exactly', () => {
    const custom = { vampir: 2, koylu: 2, doktor: 2, gozcu: 1, cadi: 1 };
    const options = { roster: JSON.stringify(custom) };
    expect(validateRoster(8, options)).toBeNull();
    expect(countsFor(8, options)).toMatchObject(custom);
    expect(countsFor(8, options).avci).toBe(0);
    expect(validateRoster(7, options)).toMatch(/add up/);
    expect(validateRoster(9, options)).toMatch(/add up/);
  });

  it('rejects lineups that can’t be played', () => {
    for (const roster of [
      { vampir: 0, koylu: 4 },
      { vampir: 2, koylu: 2 },
      { vampir: 1, soytari: 3 },
      { vampir: 1, koylu: 2 },
      { vampir: 1, koylu: 4 },
      { vampir: 1, hain: 1, koylu: 2 },
    ]) {
      expect(validateRoster(4, { roster: JSON.stringify(roster) })).not.toBeNull();
    }
    for (const n of [0, 3, 13, 5.5, Number.NaN]) expect(validateRoster(n, { roster: 'auto' })).not.toBeNull();
  });

  it('rejects malformed counts instead of guessing', () => {
    for (const roster of ['{', '[]', 'null', 'true', JSON.stringify({ vampir: 1, koylu: 3, unknown: 0 })]) {
      expect(validateRoster(4, { roster })).not.toBeNull();
    }
    for (const count of ['0', -1, 0.5, 13, null, true]) {
      expect(validateRoster(4, { roster: JSON.stringify({ vampir: 1, koylu: 3, cadi: count }) }), `count: ${String(count)}`).not.toBeNull();
    }
  });
});

describe('validated game options', () => {
  it('refuses an invalid initial lineup before dealing or starting timers', () => {
    vi.useFakeTimers();
    const { game, setup } = gameFixture();
    expect(() => new GameRunner(game, players, { roster: invalidRoster })).toThrow(/add up/);
    expect(() => new LocalSession(game, players, { roster: invalidRoster })).toThrow(/add up/);
    expect(setup).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves the current game, options, listeners and timer when a restart is invalid', () => {
    vi.useFakeTimers();
    const { game, setup } = gameFixture();
    const runner = new GameRunner(game, players, { roster: validRoster });
    cleanup.push(() => runner.dispose());
    const changed = vi.fn();
    runner.onChange(changed);
    expect(runner.submit(0, { type: 'play' })).toBeNull();
    const beforeState = runner.state;
    const beforeOptions = runner.options;
    changed.mockClear();

    expect(runner.restart({ roster: invalidRoster })).toMatch(/add up/);
    expect(runner.state).toBe(beforeState);
    expect(runner.options).toBe(beforeOptions);
    expect(changed).not.toHaveBeenCalled();
    expect(setup).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(runner.state).toMatchObject({ deal: 1, moves: 1, ticks: 1 });
    expect(changed).toHaveBeenCalledTimes(1);

    expect(runner.restart({ roster: 'auto' })).toBeNull();
    expect(runner.options.roster).toBe('auto');
    expect(runner.state).toMatchObject({ deal: 2, moves: 0, ticks: 0 });
  });

  it('resumes a saved game even when its pending next-game lineup is unfinished', () => {
    vi.useFakeTimers();
    const { game, setup } = gameFixture();
    const saved: State = { deal: 9, moves: 7, ticks: 2, deadline: Date.now() + 500 };
    const runner = new GameRunner(game, players, { roster: invalidRoster }, saved);
    cleanup.push(() => runner.dispose());
    expect(setup).not.toHaveBeenCalled();
    expect(runner.state).toBe(saved);
    expect(runner.restart()).toMatch(/add up/);
    expect(runner.state).toBe(saved);
    expect(runner.submit(0, { type: 'play' })).toBeNull();
    vi.advanceTimersByTime(500);
    expect(runner.state).toEqual({ deal: 9, moves: 8, ticks: 3, deadline: null });
    expect(runner.options.roster).toBe(invalidRoster);
  });

  it('shows local restart errors while keeping the current game playable, then accepts a corrected lineup', () => {
    vi.useFakeTimers();
    const { game, setup } = gameFixture();
    const session = new LocalSession(game, players);
    cleanup.push(() => session.leave());
    session.submit(0, { type: 'play' });
    const before = session.getSnapshot().views[0];
    session.setOption('roster', invalidRoster);
    session.restart();
    expect(session.getSnapshot().notice).toMatch(/add up/);
    expect(session.getSnapshot().views[0]).toBe(before);
    expect(setup).toHaveBeenCalledTimes(1);
    session.submit(0, { type: 'play' });
    expect(session.getSnapshot().views[0]).toMatchObject({ deal: 1, moves: 2 });

    session.setOption('roster', validRoster);
    expect(session.getSnapshot().notice).toBeUndefined();
    session.restart();
    expect(session.getSnapshot().notice).toBeUndefined();
    expect(session.getSnapshot().views[0]).toMatchObject({ deal: 2, moves: 0 });
    expect(session.getSnapshot().options.roster).toBe(validRoster);
  });
});
