import { describe, expect, it } from 'vitest';
import { GAMES, getGame } from '.';
import { NO_FILTERS, findGames, fold, score } from './finder';
import { emptyStats, isLiked, likedIds, mergeStats } from '../profile/stats';

const none = () => false;
const ids = (q: string, extra = {}) => findGames(GAMES, { ...NO_FILTERS, q, ...extra }, none).map((g) => g.id);

describe('game finder', () => {
  it('folds Turkish letters and accents', () => {
    expect(fold('Kızma Birader')).toBe('kizma birader');
    expect(fold('SATRANÇ')).toBe('satranc');
    expect(fold('Şaşırt-Beni!')).toBe('sasirt beni');
  });

  it('finds games by either name, with or without Turkish letters', () => {
    expect(ids('satranc')[0]).toBe('satranc');
    expect(ids('chess')[0]).toBe('satranc');
    expect(ids('kizma')[0]).toBe('kizma-birader');
    expect(ids('word chain')[0]).toBe('kelime-zinciri');
    expect(ids('zzzz')).toEqual([]);
  });

  it('a name match ranks above a description match', () => {
    expect(score(getGame('go')!, 'go')).toBeGreaterThan(score(getGame('gomoku')!, 'board'));
    expect(ids('card').length).toBeGreaterThan(10);
  });

  it('filters by players, way of playing and likes', () => {
    const solo = findGames(GAMES, { ...NO_FILTERS, players: 1 }, none);
    expect(solo.every((g) => g.minPlayers <= 1)).toBe(true);
    const big = findGames(GAMES, { ...NO_FILTERS, players: 6 }, none);
    expect(big.every((g) => g.maxPlayers >= 6)).toBe(true);
    expect(findGames(GAMES, { ...NO_FILTERS, mode: 'bots' }, none).every((g) => !!g.bot)).toBe(true);
    expect(findGames(GAMES, { ...NO_FILTERS, mode: 'online' }, none).every((g) => g.maxPlayers > 1 && !g.localOnly)).toBe(true);
    expect(findGames(GAMES, { ...NO_FILTERS, liked: true }, (id) => id === 'go').map((g) => g.id)).toEqual(['go']);
  });
});

describe('liked games across devices', () => {
  it('the newest like or unlike wins', () => {
    const a = { ...emptyStats(), likes: { go: 100, xox: 50 } };
    const b = { ...emptyStats(), likes: { go: -200, satranc: 70 } };
    const m = mergeStats(a, b);
    expect(isLiked(m, 'go')).toBe(false);
    expect(likedIds(m)).toEqual(['satranc', 'xox']);
    expect(mergeStats(m, a)).toEqual(m);
  });
});
