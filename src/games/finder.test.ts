import { describe, expect, it } from 'vitest';
import { GAMES, getGame } from '.';
import { NO_FILTERS, findGames, fold, score } from './finder';
import { emptyStats, isLiked, likedIds, mergeStats } from '../profile/stats';
import { ADDED, LENGTH, NEW_DAYS, isNew } from './meta';
import { SECTIONS } from './sections';

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

describe('new badges and game lengths', () => {
  it('every game on the home page has a length, and every dated game exists', () => {
    const shown = SECTIONS.flatMap((x) => x.ids);
    expect(shown.filter((id) => !LENGTH[id])).toEqual([]);
    expect(Object.keys(ADDED).filter((id) => !getGame(id))).toEqual([]);
    expect(Object.keys(LENGTH).filter((id) => !getGame(id))).toEqual([]);
  });

  it('a game is new for two weeks after it was added', () => {
    const day = new Date(ADDED.go + 'T12:00:00').getTime();
    expect(isNew('go', day)).toBe(true);
    expect(isNew('go', day + (NEW_DAYS - 1) * 86400000)).toBe(true);
    expect(isNew('go', day + (NEW_DAYS + 1) * 86400000)).toBe(false);
    expect(isNew('satranc', day)).toBe(false);
  });

  it('filters by length and by new', () => {
    const quick = findGames(GAMES, { ...NO_FILTERS, length: 'quick' }, none);
    expect(quick.length).toBeGreaterThan(10);
    expect(quick.every((g) => LENGTH[g.id] === 'quick')).toBe(true);
    expect(findGames(GAMES, { ...NO_FILTERS, fresh: true }, none).every((g) => isNew(g.id))).toBe(true);
  });
});
