import { afterEach, describe, expect, it, vi } from 'vitest';
import { getGame } from '../games';
import { newNight, nextNight, nightFits, nightRanking, scoreNight } from './night';
import { GameRunner, TURN_OPTION } from './runner';
import type { PlayerInfo } from './types';
import { applyGame, emptyStats } from '../profile/stats';

const people = (n: number, bots = 0): PlayerInfo[] =>
  Array.from({ length: n }, (_, i) => (i >= n - bots ? { name: `Bot ${i}`, kind: 'bot', level: 'easy' } : { name: `P${i}`, kind: 'human' }));

describe('game night', () => {
  it('only offers games that fit the table', () => {
    const xox = getGame('xox')!;
    expect(nightFits(xox, people(2), false)).toBe(true);
    expect(nightFits(xox, people(3), false)).toBe(false);
    expect(nightFits(getGame('sohbet-odasi')!, people(2), true)).toBe(false);
    expect(nightFits(getGame('sudoku')!, people(2), false)).toBe(false);
  });

  it('scores each game once and runs to the end', () => {
    const players = people(3);
    let night = newNight(['a', 'b'], players);
    night = scoreNight(night, players, { winners: [1] });
    night = scoreNight(night, players, { winners: [1] }); // same game again: no double points
    expect(night.scores).toEqual({ P0: 0, P1: 3, P2: 0 });
    night = nextNight(night);
    expect(night.index).toBe(1);
    night = scoreNight(night, players, { winners: [], draw: true });
    expect(night.scores).toEqual({ P0: 1, P1: 4, P2: 1 });
    night = nextNight(night);
    expect(night.finished).toBe(true);
    expect(nightRanking(night)[0]).toEqual(['P1', 4]);
  });
});

describe('stats and achievements', () => {
  it('counts games, streaks and unlocks achievements once', () => {
    const g = { gameId: 'xox', won: true, draw: false, solo: false, online: false, beatHardBot: false, players: 2 };
    let { stats, unlocked } = applyGame(emptyStats(), g, false, 1, '2026-11-15');
    expect(unlocked.map((a) => a.id)).toEqual(['first-game', 'first-win']);
    ({ stats } = applyGame(stats, g, false, 2, '2026-11-15'));
    ({ stats, unlocked } = applyGame(stats, { ...g, beatHardBot: true }, true, 3, '2026-11-16'));
    expect(unlocked.map((a) => a.id)).toEqual(expect.arrayContaining(['streak-3', 'hard-bot', 'learner']));
    expect(stats.games.xox).toMatchObject({ played: 3, won: 3, best: 3 });
    expect(stats.days).toEqual(['2026-11-15', '2026-11-16']);
    ({ stats, unlocked } = applyGame(stats, { ...g, won: false }, false, 4));
    expect(stats.streak).toBe(0);
    expect(stats.bestStreak).toBe(3);
    expect(unlocked).toEqual([]);
  });
});

describe('turn timer', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('moves for a person who runs out of time, and resets for the next one', () => {
    vi.useFakeTimers();
    const r = new GameRunner(getGame('xox')!, people(2), { [TURN_OPTION]: '15' });
    const first = r.active[0];
    expect(r.deadlines.has(first)).toBe(true);
    const before = JSON.stringify(r.state);
    vi.advanceTimersByTime(10000);
    expect(JSON.stringify(r.state)).toBe(before);
    vi.advanceTimersByTime(5200);
    expect(JSON.stringify(r.state)).not.toBe(before);
    const next = r.active[0];
    expect(next).not.toBe(first);
    expect(r.deadlines.get(next)! - Date.now()).toBeGreaterThan(14000);
    r.dispose();
  });

  it('is off unless chosen, and never runs for bots', () => {
    vi.useFakeTimers();
    const off = new GameRunner(getGame('xox')!, people(2));
    expect(off.deadlines.size).toBe(0);
    off.dispose();
    const vsBot = new GameRunner(getGame('xox')!, people(2, 1), { [TURN_OPTION]: '30' });
    expect([...vsBot.deadlines.keys()].every((s) => vsBot.players[s].kind !== 'bot')).toBe(true);
    vsBot.dispose();
  });
});
