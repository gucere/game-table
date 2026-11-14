import { useSyncExternalStore } from 'react';
import { applyTheme } from './themes';

export interface Settings {
  theme: string;
  pieces: string;
  name: string;
  /** Card back pattern: see CARD_BACKS */
  cardBack: string;
  /** 'two' = classic red/black, 'four' = four-colour deck */
  cardFace: 'two' | 'four';
  /** Okey tile style */
  tiles: string;
  /** Interface language */
  lang: 'en' | 'tr';
}

const KEY = 'oyun-masasi:settings';
/** Turkish browsers start in Turkish, everyone else in English */
function browserLang(): 'en' | 'tr' {
  try {
    return navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'en';
  } catch {
    return 'en';
  }
}

const DEFAULTS: Settings = { theme: 'felt', pieces: 'classic', name: '', cardBack: 'red', cardFace: 'two', tiles: 'ivory', lang: browserLang() };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable (private mode etc.) */
  }
  return DEFAULTS;
}

let current = load();
const listeners = new Set<() => void>();

export function getSettings() {
  return current;
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
  applyTheme(current.theme, current.pieces);
  document.documentElement.lang = current.lang;
  listeners.forEach((fn) => fn());
}

export function initSettings() {
  applyTheme(current.theme, current.pieces);
  document.documentElement.lang = current.lang;
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
  );
}
