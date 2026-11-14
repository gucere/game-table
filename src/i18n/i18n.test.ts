import { describe, expect, it } from 'vitest';
import { translate } from './index';

describe('translations', () => {
  it('translates exact strings, fills placeholders and matches sentence patterns', () => {
    expect(translate('tr', 'Your turn')).toBe('Sıra sende');
    expect(translate('tr', 'Player {n}', { n: 3 })).toBe('Oyuncu 3');
    expect(translate('tr', "Ayşe's turn")).toBe('Sıra Ayşe oyuncusunda');
    expect(translate('tr', 'Something brand new')).toBe('Something brand new');
    expect(translate('en', 'Player {n}', { n: 2 })).toBe('Player 2');
  });
});
