import { useSyncExternalStore } from 'react';
import { applyTheme } from './themes';

export interface Settings {
  theme: string;
  pieces: string;
  name: string;
  /** Card back pattern: see CARD_BACKS */
  cardBack: string;
  /** 'two' = classic red/black, 'four' = four-color deck */
  cardFace: 'two' | 'four';
  /** Okey tile style */
  tiles: string;
  /** Interface language */
  lang: 'en' | 'tr';
  /** Colorblind-friendly colors (players, word-game marks) */
  colorblind: boolean;
  /** Sound effects on/off and loudness (0–1) */
  sound: boolean;
  volume: number;
  /** Buzz the phone on your turn and at the end of a game */
  vibrate: boolean;
  /** Teach-me mode: tips and suggested moves while you play */
  teach: boolean;
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

const DEFAULTS: Settings = { theme: 'felt', pieces: 'classic', name: '', cardBack: 'red', cardFace: 'two', tiles: 'ivory', lang: browserLang(), colorblind: false, sound: true, volume: 0.6, vibrate: true, teach: false };

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
  applyTheme(current.theme, current.pieces, current.colorblind);
  document.documentElement.lang = current.lang;
  document.title = current.lang === 'tr' ? 'Oyun Masası' : 'Game Table';
  listeners.forEach((fn) => fn());
}

export function initSettings() {
  applyTheme(current.theme, current.pieces, current.colorblind);
  document.documentElement.lang = current.lang;
  document.title = current.lang === 'tr' ? 'Oyun Masası' : 'Game Table';
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
