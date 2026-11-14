import { expect, it } from 'vitest';
import { GAMES } from '../games';
import { hasTranslation } from './index';
import { GAME_NAMES, GAME_TEXT_TR } from './games';

/** Source of every game file, so we can find the tx('…') strings */
const SOURCES = import.meta.glob('../games/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Every visible English string that has no Turkish translation */
function missingTurkish() {
  const keys = new Set<string>();
  for (const g of GAMES) {
    for (const o of g.options ?? []) {
      keys.add(o.label);
      for (const c of o.choices) keys.add(c.label);
    }
  }
  for (const src of Object.values(SOURCES)) {
    for (const m of src.matchAll(/tx\(\s*'((?:[^'\\]|\\.)*)'/g)) keys.add(m[1].replace(/\\'/g, "'"));
  }
  return [...keys].filter((k) => /[A-Za-z]/.test(k) && !hasTranslation('tr', k) && !/^[\d\s×–-]+[a-z ]*$/.test(k) && !/^[XOK]$/.test(k));
}

it('every game has a Turkish and an international name, tagline and rules', () => {
  expect(GAMES.filter((g) => !GAME_NAMES[g.id]).map((g) => g.id)).toEqual([]);
  expect(GAMES.filter((g) => !GAME_TEXT_TR[g.id]?.tagline || (g.rules && !GAME_TEXT_TR[g.id]?.rules)).map((g) => g.id)).toEqual([]);
});

it('every interface string has Turkish', () => {
  expect(missingTurkish()).toEqual([]);
});
