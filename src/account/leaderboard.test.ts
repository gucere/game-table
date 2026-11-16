import { describe, expect, it } from 'vitest';
import { GAMES, getGame } from '../games';
import { allBoards, boardId, boardLabels } from './leaderboard';

// Must match the pattern in firebase/firestore.rules
const RULE = /^[a-z0-9-]{1,40}(~[a-z0-9]{1,12}){0,3}$/;

describe('leaderboards', () => {
  const games = GAMES.filter((g) => g.leaderboard);

  it('the score games have leaderboards', () => {
    expect(games.map((g) => g.id).sort()).toEqual(['birlestir', 'marti', 'tas-yagmuru', 'tugla-kirma', 'uzay-savunmasi', 'yilan'].sort());
  });

  it('every board id is one the database rules accept, and they are all different', () => {
    const ids = games.flatMap(allBoards);
    expect(ids.filter((b) => !RULE.test(b))).toEqual([]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(allBoards(getGame('yilan')!)).toHaveLength(6);
  });

  it('difficulty options pick the board; other options don’t', () => {
    const snake = getGame('yilan')!;
    expect(boardId(snake)).toBe('yilan~wrap~130');
    expect(boardId(snake, { walls: 'walls', speed: '90' })).toBe('yilan~walls~90');
    expect(boardLabels(snake, { walls: 'walls', speed: '90' })).toEqual(['Walls (harder)', 'Fast']);
    expect(boardId(getGame('marti')!, { anything: 'x' })).toBe('marti');
  });

  it('scores are read from the finished game', () => {
    const marti = getGame('marti')!;
    expect(marti.leaderboard!.score({ scores: [7, null] } as never, 0)).toBe(7);
    expect(getGame('birlestir')!.leaderboard!.score({ over: false, score: 50 } as never, 0)).toBeNull();
  });
});
