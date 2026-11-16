import { describe, expect, it } from 'vitest';
import { makePoll, viewPoll, vote, type Poll } from './polls';

const poll = (extra = {}) => makePoll('p1', 'Ayla', { question: '  What should we play?  ', options: ['Okey', ' Batak ', '', 'okey', 'Durak'], ...extra }) as Poll;

describe('room polls', () => {
  it('cleans the question and answers, drops blanks and repeats', () => {
    const p = poll();
    expect(p.question).toBe('What should we play?');
    expect(p.options).toEqual(['Okey', 'Batak', 'Durak']);
    expect(makePoll('p', 'A', { question: '', options: ['a', 'b'] })).toMatch(/question/);
    expect(makePoll('p', 'A', { question: 'Q', options: ['a', 'A'] })).toMatch(/two different/);
    expect((makePoll('p', 'A', { question: 'Q', options: Array.from({ length: 12 }, (_, i) => `o${i}`) }) as Poll).options).toHaveLength(8);
    expect((makePoll('p', 'A', { question: '<b>hi</b>', options: ['a', 'b'] }) as Poll).question).toBe('bhi/b');
  });

  it('one answer each, which can be changed or taken back', () => {
    let p = poll();
    p = vote(p, 'Deniz', [0]) as Poll;
    p = vote(p, 'Mert', [2]) as Poll;
    expect(vote(p, 'Deniz', [0, 1])).toMatch(/one answer/);
    p = vote(p, 'Deniz', [1]) as Poll;
    let v = viewPoll(p, 'Deniz', false);
    expect(v.counts).toEqual([0, 1, 1]);
    expect(v.total).toBe(2);
    expect(v.mine).toEqual([1]);
    expect(v.voters).toEqual([[], ['Deniz'], ['Mert']]);
    p = vote(p, 'Deniz', []) as Poll;
    v = viewPoll(p, 'Deniz', false);
    expect(v.total).toBe(1);
    expect(v.mine).toEqual([]);
    expect(vote(p, 'X', [9, -1, 'a'])).not.toBeTypeOf('string');
  });

  it('several answers, anonymous results, and closing', () => {
    let p = poll({ multi: true, anonymous: true });
    p = vote(p, 'Deniz', [0, 2, 2]) as Poll;
    const v = viewPoll(p, 'Mert', false);
    expect(v.counts).toEqual([1, 0, 1]);
    expect(v.voters).toBeNull();
    expect(v.canClose).toBe(false);
    expect(viewPoll(p, 'Ayla', false).canClose).toBe(true);
    expect(viewPoll(p, 'Mert', true).canClose).toBe(true);
    p = { ...p, closed: true };
    expect(vote(p, 'Mert', [1])).toMatch(/closed/);
  });
});
