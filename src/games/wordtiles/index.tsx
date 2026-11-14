import { useEffect, useMemo, useState } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import { t as tx } from '../../i18n';
import { bot } from './bot';
import { ALPHABET, dictionaryReady, hasWord, loadDictionary } from './dict';
import * as L from './logic';

interface Pending extends L.Placement {
  rackIdx: number;
}

const up = (lang: L.Lang, s: string) => s.toLocaleUpperCase(lang === 'tr' ? 'tr' : 'en');
const PREMIUM_LABEL: Record<L.Premium, string> = { '': '', dl: '2L', tl: '3L', dw: '2W', tw: '3W' };

function Tile({ ch, blank, lang, small }: { ch: string; blank: boolean; lang: L.Lang; small?: boolean }) {
  return (
    <span className={'wt-tile' + (blank ? ' blank' : '') + (small ? ' small' : '')}>
      <span className="wt-letter">{ch === L.BLANK ? '' : up(lang, ch)}</span>
      {!blank && ch !== L.BLANK && <span className="wt-val">{L.letterValue(lang, ch)}</span>}
    </span>
  );
}

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.WordView, L.WordMove>) {
  const [ready, setReady] = useState(() => dictionaryReady(v.lang));
  const [pending, setPending] = useState<Pending[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [order, setOrder] = useState<number[]>(() => v.rack.map((_, i) => i));
  const [swapping, setSwapping] = useState<Set<number> | null>(null);
  const [blankAt, setBlankAt] = useState<{ i: number; rackIdx: number } | null>(null);
  const rackKey = v.rack.join('');

  useEffect(() => {
    let live = true;
    loadDictionary(v.lang).then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [v.lang]);
  // A new turn or a new rack: start fresh
  useEffect(() => {
    setPending([]);
    setSelected(null);
    setSwapping(null);
    setOrder(v.rack.map((_, i) => i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rackKey, v.turn, v.last?.tiles?.join(',')]);

  const used = new Set(pending.map((p) => p.rackIdx));
  const preview = useMemo(() => (pending.length && ready ? L.evaluate(v.board, v.lang, pending, (w) => hasWord(v.lang, w)) : null), [pending, ready, v.board, v.lang]);
  const lastTiles = new Set(v.last?.tiles ?? []);
  const name = (s: number) => (s === seat ? tx('You') : players[s].name);

  const placeAt = (i: number) => {
    if (!canMove || swapping) return;
    const p = pending.find((x) => x.i === i);
    if (p) {
      setPending((ps) => ps.filter((x) => x.i !== i));
      return;
    }
    if (v.board[i] || selected === null) return;
    const ch = v.rack[selected];
    if (ch === L.BLANK) {
      setBlankAt({ i, rackIdx: selected });
      return;
    }
    setPending((ps) => [...ps, { i, ch, blank: false, rackIdx: selected }]);
    const nextFree = order.find((k) => k !== selected && !used.has(k));
    setSelected(nextFree ?? null);
  };

  const lastText = (() => {
    const l = v.last;
    if (!l) return '';
    const mine = l.seat === seat;
    if (l.kind === 'pass') return mine ? tx('You passed.') : tx('{name} passed.', { name: players[l.seat].name });
    if (l.kind === 'swap') return mine ? tx('You swapped {n} tiles.', { n: l.count ?? 0 }) : tx('{name} swapped {n} tiles.', { name: players[l.seat].name, n: l.count ?? 0 });
    const words = (l.words ?? []).map((w) => up(v.lang, w)).join(', ');
    return mine ? tx('You played {words} for {n} points.', { words, n: l.score ?? 0 }) : tx('{name} played {words} for {n} points.', { name: players[l.seat].name, words, n: l.score ?? 0 });
  })();

  return (
    <div className="stack-sm center wt">
      <div className="info-row">
        {players.map((_, i) => (
          <span key={i} className={'chip' + (i === v.turn && !v.over ? ' trump-chip' : '')}>
            {name(i)}: {v.scores[i]}
            {v.endAdjust && ` (${v.endAdjust[i] >= 0 ? '+' : ''}${v.endAdjust[i]})`}
          </span>
        ))}
        <span className="chip">🎒 {tx('{n} in the bag', { n: v.bagCount })}</span>
      </div>
      {lastText && <p className="small muted wt-last">{lastText}</p>}

      <div className="wt-board">
        {v.board.map((cell, i) => {
          const p = pending.find((x) => x.i === i);
          const prem = L.PREMIUM[i];
          return (
            <button
              key={i}
              className={'wt-sq ' + (prem || 'plain') + (i === L.CENTER ? ' center' : '') + (lastTiles.has(i) ? ' fresh' : '') + (p ? ' pending' : '')}
              onClick={() => placeAt(i)}
              disabled={!canMove || (!!cell && !p)}
              aria-label={cell ? up(v.lang, cell.ch) : p ? up(v.lang, p.ch) : PREMIUM_LABEL[prem] || tx('Empty square')}
            >
              {cell ? (
                <Tile ch={cell.ch} blank={cell.blank} lang={v.lang} />
              ) : p ? (
                <Tile ch={p.ch} blank={p.blank} lang={v.lang} />
              ) : i === L.CENTER ? (
                '★'
              ) : prem ? (
                <span className="wt-prem">{tx(PREMIUM_LABEL[prem])}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {!v.over && (
        <>
          <div className="wt-rack">
            {order.map((k) =>
              k >= v.rack.length || used.has(k) ? null : (
                <button
                  key={k}
                  className={'wt-rack-tile' + (selected === k && !swapping ? ' sel' : '') + (swapping?.has(k) ? ' swap' : '')}
                  disabled={!canMove}
                  onClick={() => {
                    if (swapping) {
                      const s = new Set(swapping);
                      if (s.has(k)) s.delete(k);
                      else s.add(k);
                      setSwapping(s);
                    } else setSelected(selected === k ? null : k);
                  }}
                >
                  <Tile ch={v.rack[k]} blank={v.rack[k] === L.BLANK} lang={v.lang} />
                </button>
              ),
            )}
          </div>

          <p className="small wt-preview" aria-live="polite">
            {!ready
              ? tx('Loading the word list…')
              : !canMove
                ? tx('Waiting for {name}…', { name: players[v.turn].name })
                : swapping
                  ? tx('Pick the tiles to swap, then press Swap.')
                  : preview === null
                    ? tx('Tap a tile on your rack, then a square on the board.')
                    : typeof preview === 'string'
                      ? tx(preview)
                      : tx('{words}: {n} points', { words: preview.words.map((w) => up(v.lang, w.word)).join(', '), n: preview.score }) + (pending.length === L.RACK ? ` ${tx('(+{n} for all seven!)', { n: L.ALL_SEVEN })}` : '')}
          </p>

          {canMove && (
            <div className="row center">
              {swapping ? (
                <>
                  <button className="btn primary" disabled={!swapping.size} onClick={() => onMove({ type: 'swap', tiles: [...swapping].map((k) => v.rack[k]) })}>
                    🔁 {tx('Swap {n}', { n: swapping.size })}
                  </button>
                  <button className="btn ghost" onClick={() => setSwapping(null)}>
                    {tx('Cancel')}
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="btn primary"
                    disabled={!preview || typeof preview === 'string'}
                    onClick={() => onMove({ type: 'play', tiles: pending.map(({ i, ch, blank }) => ({ i, ch, blank })) })}
                  >
                    ✔ {tx('Play')}
                  </button>
                  <button className="btn" disabled={!pending.length} onClick={() => setPending([])}>
                    ↩ {tx('Recall')}
                  </button>
                  <button
                    className="btn"
                    onClick={() =>
                      setOrder((o) => {
                        const a = [...o];
                        for (let i = a.length - 1; i > 0; i--) {
                          const j = Math.floor(Math.random() * (i + 1));
                          [a[i], a[j]] = [a[j], a[i]];
                        }
                        return a;
                      })
                    }
                  >
                    🔀 {tx('Shuffle')}
                  </button>
                  <button
                    className="btn"
                    disabled={v.bagCount < L.RACK}
                    title={v.bagCount < L.RACK ? tx('Too few tiles left in the bag to swap') : undefined}
                    onClick={() => {
                      setPending([]);
                      setSwapping(new Set());
                    }}
                  >
                    🔁 {tx('Swap')}
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => {
                      if (confirm(tx('Pass your turn?'))) onMove({ type: 'pass' });
                    }}
                  >
                    {tx('Pass')}
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}

      {blankAt && (
        <div className="wt-blank-pick" role="dialog" aria-label={tx('Which letter is the blank?')}>
          <p className="small">{tx('Which letter is the blank?')}</p>
          <div className="wt-blank-letters">
            {[...ALPHABET[v.lang]].map((ch) => (
              <button
                key={ch}
                className="btn small"
                onClick={() => {
                  setPending((ps) => [...ps, { i: blankAt.i, ch, blank: true, rackIdx: blankAt.rackIdx }]);
                  setBlankAt(null);
                  setSelected(null);
                }}
              >
                {up(v.lang, ch)}
              </button>
            ))}
          </div>
          <button className="btn ghost small" onClick={() => setBlankAt(null)}>
            {tx('Cancel')}
          </button>
        </div>
      )}
    </div>
  );
}

export const wordTiles: GameDef<L.WordState, L.WordMove, L.WordView> = {
  id: 'kelime-ustasi',
  name: 'Kelime Ustası',
  tagline: 'Build words crossword-style from your seven tiles. Bonus squares, blanks, big plays.',
  icon: '🔠',
  minPlayers: 2,
  maxPlayers: 4,
  defaultPlayers: 2,
  hiddenInfo: true,
  options: [
    {
      id: 'lang',
      label: 'Language',
      default: 'tr',
      choices: [
        { value: 'tr', label: 'Türkçe' },
        { value: 'en', label: 'English' },
      ],
    },
  ],
  rules:
    'Everyone has seven letter tiles. On your turn, place tiles in one row or one column so they make words with the tiles already on the board, like a crossword; every new word you form must be in the word list. The first word covers the ★ in the middle. Score the letter values in each word you make: colored squares double or triple a letter (2L, 3L) or the whole word (2W, 3W), but only when you first cover them. Using all seven tiles at once adds 50. The two blank tiles can be any letter and score 0. Then refill your rack from the bag. Instead of playing you can swap tiles (while at least seven are left in the bag) or pass. The game ends when someone uses their last tile with the bag empty (they gain everyone else’s leftover tile values, the others lose their own), or after three rounds without points. Turkish uses dictionary forms only, with no suffixes.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  bot,
  botDelay: () => 1200,
  isPrivate: () => true,
  Board,
};
