import { describe, expect, it } from 'vitest';
import { applyGame, cleanStats, emptyStats, mergeStats } from './stats';

const game = (gameId: string, won: boolean) => ({ gameId, won, draw: false, solo: false, online: false, beatHardBot: false, players: 2 });

describe('account stats merge', () => {
  it('combines two devices without losing anything, and merging again changes nothing', () => {
    let a = emptyStats();
    for (const w of [true, true, false]) a = applyGame(a, game('xox', w), false, 100, '2026-11-14').stats;
    let b = emptyStats();
    for (const w of [true, true, true, true]) b = applyGame(b, game('go', w), false, 200, '2026-11-15').stats;
    const m = mergeStats(a, b);
    expect(m.games.xox.played).toBe(3);
    expect(m.games.go.won).toBe(4);
    expect(m.bestStreak).toBe(4);
    expect(m.streak).toBe(b.streak);
    expect(m.days).toEqual(['2026-11-14', '2026-11-15']);
    expect(Object.keys(m.achievements)).toEqual(expect.arrayContaining(['first-game', 'first-win', 'streak-3']));
    expect(mergeStats(m, b)).toEqual(m);
    expect(mergeStats(m, m)).toEqual(m);
  });

  it('keeps the earliest time an achievement was earned', () => {
    const a = { ...emptyStats(), achievements: { 'first-win': 50 } };
    const b = { ...emptyStats(), achievements: { 'first-win': 10, night: 20 } };
    expect(mergeStats(a, b).achievements).toEqual({ 'first-win': 10, night: 20 });
  });

  it('cleans data that comes back from the database', () => {
    const s = cleanStats({ games: { xox: { played: 3, won: '9', drawn: -1 } }, streak: 2, days: ['2026-11-15', 'nope'], achievements: { 'first-win': 5, hacked: 1 }, extra: 'x' });
    expect(s.games.xox).toEqual({ played: 3, won: 0, drawn: 0, streak: 0, best: 0, last: 0 });
    expect(s.days).toEqual(['2026-11-15']);
    expect(s.achievements).toEqual({ 'first-win': 5 });
    expect(cleanStats(null)).toEqual(emptyStats());
  });

  it('preferences like the home layout: the newest choice wins across devices', () => {
    const a = { ...emptyStats(), prefs: { homeLayout: { v: 'list', at: 200 } } };
    const b = { ...emptyStats(), prefs: { homeLayout: { v: 'tiles', at: 100 }, other: { v: 'x', at: 5 } } };
    expect(mergeStats(a, b).prefs).toEqual({ homeLayout: { v: 'list', at: 200 }, other: { v: 'x', at: 5 } });
    expect(mergeStats(b, a).prefs.homeLayout.v).toBe('list');
    expect(cleanStats({ prefs: { homeLayout: { v: 'grid', at: 9 }, bad: { v: 42 } } }).prefs).toEqual({ homeLayout: { v: 'grid', at: 9 } });
  });
});
