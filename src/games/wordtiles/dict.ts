/** Word lists for Kelime Ustası: loaded on demand, kept as a Set and (for bots) a compact trie. */

export type Lang = 'tr' | 'en';
export const ALPHABET: Record<Lang, string> = { tr: 'abcçdefgğhıijklmnoöprsştuüvyz', en: 'abcdefghijklmnopqrstuvwxyz' };

const MARK = '0123456789ABCDE';

/** Undo the front coding (see make_dict.py): marker = letters shared with the previous word */
export function decode(data: string): string[] {
  const words: string[] = [];
  let prev = '';
  let i = 0;
  while (i < data.length) {
    const p = MARK.indexOf(data[i++]);
    let j = i;
    while (j < data.length && MARK.indexOf(data[j]) < 0) j++;
    const w = prev.slice(0, p) + data.slice(i, j);
    words.push(w);
    prev = w;
    i = j;
  }
  return words;
}

const lists: Partial<Record<Lang, string[]>> = {};
const sets: Partial<Record<Lang, Set<string>>> = {};
const loading: Partial<Record<Lang, Promise<void>>> = {};

export function setDictionary(lang: Lang, words: string[]) {
  lists[lang] = words;
  sets[lang] = new Set(words);
  delete tries[lang];
}

export function loadDictionary(lang: Lang): Promise<void> {
  if (sets[lang]) return Promise.resolve();
  loading[lang] ??= (lang === 'tr' ? import('./dict-tr') : import('./dict-en')).then((m) => setDictionary(lang, decode(m.default)));
  return loading[lang]!;
}

export const dictionaryReady = (lang: Lang) => !!sets[lang];
export const hasWord = (lang: Lang, w: string) => !!sets[lang]?.has(w);

/**
 * A trie in flat arrays (first child / next sibling), built from the sorted list.
 * Node 0 is the root. Letters are indexes into ALPHABET[lang].
 */
export interface Trie {
  letter: Uint8Array;
  child: Int32Array;
  next: Int32Array;
  end: Uint8Array;
}
const tries: Partial<Record<Lang, Trie>> = {};

export function getTrie(lang: Lang): Trie | null {
  if (tries[lang]) return tries[lang]!;
  const words = lists[lang];
  if (!words) return null;
  const sorted = [...words].sort();
  const code = new Map([...ALPHABET[lang]].map((ch, i) => [ch, i]));
  // Count nodes: every word adds the letters it doesn't share with the previous one
  let count = 1;
  let prev = '';
  for (const w of sorted) {
    let p = 0;
    while (p < w.length && p < prev.length && w[p] === prev[p]) p++;
    count += w.length - p;
    prev = w;
  }
  const t: Trie = { letter: new Uint8Array(count), child: new Int32Array(count).fill(-1), next: new Int32Array(count).fill(-1), end: new Uint8Array(count) };
  const last = new Int32Array(count).fill(-1);
  const path = [0];
  let used = 1;
  prev = '';
  for (const w of sorted) {
    let p = 0;
    while (p < w.length && p < prev.length && w[p] === prev[p]) p++;
    path.length = p + 1;
    for (let k = p; k < w.length; k++) {
      const parent = path[path.length - 1];
      const node = used++;
      t.letter[node] = code.get(w[k])!;
      if (last[parent] < 0) t.child[parent] = node;
      else t.next[last[parent]] = node;
      last[parent] = node;
      path.push(node);
    }
    t.end[path[path.length - 1]] = 1;
    prev = w;
  }
  tries[lang] = t;
  return t;
}

export function childOf(t: Trie, node: number, letter: number) {
  for (let c = t.child[node]; c >= 0; c = t.next[c]) if (t.letter[c] === letter) return c;
  return -1;
}
