/**
 * Tiny translation layer. Text is written in English in the code; each language has a
 * dictionary from the English text to its own. Anything missing simply stays English,
 * so adding a language (or a new string) never breaks anything.
 * Placeholders look like {name} and are filled from `vars`.
 */
import { getSettings, useSettings } from '../theme/settings';
import type { GameDef } from '../engine/types';
import { GAME_NAMES, GAME_TEXT_TR } from './games';
import { TR } from './tr';
import { TR_BOARDS } from './tr-boards';
import { TR_MORE } from './tr-more';
import { TR_SOCIAL } from './tr-social';
import { TR_NEW_CARDS } from './tr-new-cards';

export type Lang = 'en' | 'tr';
export const LANGS: { id: Lang; name: string; flag: string }[] = [
  { id: 'en', name: 'English', flag: '🌍' },
  { id: 'tr', name: 'Türkçe', flag: '🇹🇷' },
];

const DICTS: Record<Lang, Record<string, string>> = { en: {}, tr: { ...TR_BOARDS, ...TR_MORE, ...TR, ...TR_SOCIAL, ...TR_NEW_CARDS } };

export type Vars = Record<string, string | number | null | undefined>;

const fill = (s: string, vars: Vars) => s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k] ?? '') : `{${k}}`));

/** Entries like "{name} joined the room." also match finished sentences built elsewhere */
const patternCache = new Map<Lang, { re: RegExp; keys: string[]; out: string; fixed: number }[]>();
function patterns(lang: Lang) {
  if (!patternCache.has(lang)) {
    const list = Object.entries(DICTS[lang] ?? {})
      .filter(([k]) => /\{\w+\}/.test(k))
      .map(([k, out]) => {
        const keys: string[] = [];
        const src = k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(\w+)\}/g, (_, name) => {
          keys.push(name);
          return '(.+?)';
        });
        return { re: new RegExp(`^${src}$`), keys, out, fixed: k.replace(/\{\w+\}/g, '').length };
      })
      // Most specific first: "{name}'s turn" before "{name}'s {kind}"
      .sort((a, b) => b.fixed - a.fixed);
    patternCache.set(lang, list);
  }
  return patternCache.get(lang)!;
}

/** Is there an entry (exact or pattern) for this text? */
export function hasTranslation(lang: Lang, text: string): boolean {
  const dict = DICTS[lang];
  if (!dict) return false;
  return text in dict || patterns(lang).some((p) => p.re.test(text));
}

export function translate(lang: Lang, text: string, vars?: Vars): string {
  const dict = DICTS[lang];
  if (!dict || lang === 'en') return vars ? fill(text, vars) : text;
  const exact = dict[text];
  if (exact !== undefined) return vars ? fill(exact, vars) : exact;
  if (!vars && typeof text === 'string' && text.length < 300) {
    for (const p of patterns(lang)) {
      const m = p.re.exec(text);
      if (m) return fill(p.out, Object.fromEntries(p.keys.map((k, i) => [k, m[i + 1]])));
    }
  }
  return vars ? fill(text, vars) : text;
}

/** Translate outside React (uses the saved language) */
export const t = (text: string, vars?: Vars) => translate(getSettings().lang, text, vars);

export type T = (text: string, vars?: Vars) => string;

/** Hook: re-renders when the language changes */
export function useT(): T {
  const { lang } = useSettings();
  return (text, vars) => translate(lang, text, vars);
}

export function useLang(): Lang {
  return useSettings().lang;
}

/** A game's name in this language (Turkish games keep their name in English, with the international one beside it) */
export function gameName(game: Pick<GameDef, 'id' | 'name'>, lang: Lang): string {
  return GAME_NAMES[game.id]?.[lang] ?? game.name;
}

/** The game's name in the other language, if it's different (e.g. "Ludo" next to "Kızma Birader") */
export function otherName(game: Pick<GameDef, 'id' | 'name'>, lang: Lang): string | null {
  const names = GAME_NAMES[game.id];
  if (!names) return null;
  const other = lang === 'tr' ? names.en : names.tr;
  return other && other !== gameName(game, lang) ? other : null;
}

export function gameTagline(game: Pick<GameDef, 'id' | 'tagline'>, lang: Lang) {
  return (lang === 'tr' && GAME_TEXT_TR[game.id]?.tagline) || game.tagline;
}

export function gameRules(game: Pick<GameDef, 'id' | 'rules'>, lang: Lang) {
  return (lang === 'tr' && GAME_TEXT_TR[game.id]?.rules) || game.rules;
}
