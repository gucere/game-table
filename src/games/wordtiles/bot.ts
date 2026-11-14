/**
 * Move finder for Kelime Ustası bots: the classic anchor-square search over a trie
 * (Appel & Jacobson, 1988). For each line it grows words left of an anchor square,
 * then right through it, checking every crossing word as it goes.
 */
import type { BotCtx, Seat } from '../../engine/types';
import { ALPHABET, childOf, dictionaryReady, getTrie, hasWord, type Lang } from './dict';
import { BLANK, CENTER, RACK, SIZE, evaluate, type Cell, type Placement, type WordMove, type WordView } from './logic';

export interface Found {
  tiles: Placement[];
  score: number;
}

const TIME_LIMIT_MS = 700;

export function findMoves(board: (Cell | null)[], rack: string[], lang: Lang, timeLimit = TIME_LIMIT_MS): Found[] {
  const trie = getTrie(lang);
  if (!trie) return [];
  const alpha = ALPHABET[lang];
  const ALL = (1 << alpha.length) - 1;
  const counts = new Map<string, number>();
  for (const ch of rack) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  const found = new Map<string, Found>();
  const isWord = (w: string) => hasWord(lang, w);
  const started = Date.now();
  const empty = board.every((c) => !c);

  const record = (tiles: Placement[]) => {
    const key = tiles
      .map((t) => `${t.i}${t.ch}${t.blank ? '*' : ''}`)
      .sort()
      .join(',');
    if (found.has(key)) return;
    const ev = evaluate(board, lang, tiles, isWord);
    if (typeof ev !== 'string') found.set(key, { tiles, score: ev.score });
  };

  for (const horizontal of [true, false]) {
    // idx(line, pos): line = row (or column), pos = position along it
    const idx = (line: number, pos: number) => (horizontal ? line * SIZE + pos : pos * SIZE + line);
    const letter = (line: number, pos: number) => (line < 0 || line >= SIZE || pos < 0 || pos >= SIZE ? null : (board[idx(line, pos)]?.ch ?? null));

    for (let line = 0; line < SIZE; line++) {
      // Letters allowed on each empty square of this line by the crossing word
      const cross: number[] = [];
      const anchor: boolean[] = [];
      for (let pos = 0; pos < SIZE; pos++) {
        if (letter(line, pos) !== null) {
          cross.push(0);
          anchor.push(false);
          continue;
        }
        let up = '';
        for (let l = line - 1; letter(l, pos) !== null; l--) up = letter(l, pos)! + up;
        let down = '';
        for (let l = line + 1; letter(l, pos) !== null; l++) down += letter(l, pos)!;
        if (!up && !down) cross.push(ALL);
        else {
          let mask = 0;
          for (let k = 0; k < alpha.length; k++) if (hasWord(lang, up + alpha[k] + down)) mask |= 1 << k;
          cross.push(mask);
        }
        anchor.push(empty ? idx(line, pos) === CENTER : !!(up || down || letter(line, pos - 1) !== null || letter(line, pos + 1) !== null));
      }

      for (let a = 0; a < SIZE; a++) {
        if (!anchor[a]) continue;
        if (Date.now() - started > timeLimit) return [...found.values()];
        const placed: Placement[] = [];

        const extendRight = (node: number, pos: number) => {
          if (pos >= SIZE || letter(line, pos) === null) {
            if (pos > a && trie.end[node] && placed.length) record([...placed]);
            if (pos >= SIZE) return;
            const mask = cross[pos];
            for (let c = trie.child[node]; c >= 0; c = trie.next[c]) {
              const k = trie.letter[c];
              if (!(mask & (1 << k))) continue;
              const ch = alpha[k];
              for (const blank of [false, true]) {
                const key = blank ? BLANK : ch;
                if (!counts.get(key)) continue;
                counts.set(key, counts.get(key)! - 1);
                placed.push({ i: idx(line, pos), ch, blank });
                extendRight(c, pos + 1);
                placed.pop();
                counts.set(key, counts.get(key)! + 1);
              }
            }
          } else {
            const k = alpha.indexOf(letter(line, pos)!);
            const c = childOf(trie, node, k);
            if (c >= 0) extendRight(c, pos + 1);
          }
        };

        if (a > 0 && letter(line, a - 1) !== null) {
          // Tiles already to the left: the word must start with them
          let s = a - 1;
          while (letter(line, s - 1) !== null) s--;
          let node = 0;
          for (let p = s; p < a && node >= 0; p++) node = childOf(trie, node, alpha.indexOf(letter(line, p)!));
          if (node >= 0) extendRight(node, a);
        } else {
          // Room to the left: empty squares that aren't anchors themselves
          let limit = 0;
          while (limit < RACK - 1 && a - limit - 1 >= 0 && letter(line, a - limit - 1) === null && !anchor[a - limit - 1]) limit++;
          const left: { ch: string; blank: boolean }[] = [];
          const leftPart = (node: number, room: number) => {
            // Place the left part just before the anchor
            const base = placed.length;
            left.forEach((l, j) => placed.push({ i: idx(line, a - left.length + j), ch: l.ch, blank: l.blank }));
            extendRight(node, a);
            placed.length = base;
            if (!room) return;
            for (let c = trie.child[node]; c >= 0; c = trie.next[c]) {
              const ch = alpha[trie.letter[c]];
              for (const blank of [false, true]) {
                const key = blank ? BLANK : ch;
                if (!counts.get(key)) continue;
                counts.set(key, counts.get(key)! - 1);
                left.push({ ch, blank });
                leftPart(c, room - 1);
                left.pop();
                counts.set(key, counts.get(key)! + 1);
              }
            }
          };
          leftPart(0, limit);
        }
      }
    }
  }
  return [...found.values()];
}

export function bot(v: WordView, _seat: Seat, ctx: BotCtx): WordMove | null {
  if (!dictionaryReady(v.lang)) return null;
  const moves = findMoves(v.board, v.rack, v.lang, ctx.level === 'hard' ? 1500 : TIME_LIMIT_MS).sort((x, y) => y.score - x.score);
  if (moves.length) {
    let pick: Found;
    if (ctx.level === 'hard') pick = moves[0];
    else if (ctx.level === 'normal') pick = moves[Math.floor(ctx.random() * Math.min(6, moves.length))];
    else {
      // Easy: short, modest words
      const modest = moves.filter((m) => m.tiles.length <= 4);
      const base = modest.length ? modest : moves;
      const pool = base.slice(Math.floor(base.length / 2));
      pick = pool[Math.floor(ctx.random() * pool.length)];
    }
    return { type: 'play', tiles: pick.tiles };
  }
  if (v.bagCount >= RACK) return { type: 'swap', tiles: [...v.rack] };
  return { type: 'pass' };
}

