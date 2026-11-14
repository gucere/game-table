import { useEffect, useRef, useState } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import { t as tx } from '../../i18n';
import * as L from './logic';

const KEYS: Record<L.Lang, string[]> = {
  tr: ['ertyuıopğü', 'asdfghjklşi', '⏎zcvbnmöç⌫'],
  en: ['qwertyuiop', 'asdfghjkl', '⏎zxcvbnm⌫'],
};

// The full word lists are big, so they load only when the game opens
const dictionaries: Partial<Record<L.Lang, Promise<Set<string>>>> = {};
function dictionary(lang: L.Lang) {
  dictionaries[lang] ??= (lang === 'tr' ? import('./words-tr') : import('./words-en')).then((m) => new Set(m.default.split(' ')));
  return dictionaries[lang]!;
}

const upper = (lang: L.Lang, s: string) => s.toLocaleUpperCase(lang === 'tr' ? 'tr' : 'en');
const RANK: Record<L.Mark, number> = { x: 0, y: 1, g: 2 };

function shareText(v: L.FiveView) {
  const marks = v.marks[v.me];
  const head = `${tx('Five Letters')}${v.day !== null ? ` #${v.day + 1}` : ''} ${v.solved[v.me] ? marks.length : 'X'}/${L.TRIES}`;
  return [head, ...marks.map((row) => row.map((m) => (m === 'g' ? '🟩' : m === 'y' ? '🟨' : '⬛')).join(''))].join('\n');
}

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.FiveView, L.FiveMove>) {
  const [typed, setTyped] = useState('');
  const [msg, setMsg] = useState('');
  const [shake, setShake] = useState(false);
  const [copied, setCopied] = useState(false);
  const busy = useRef(false);
  const myMarks = v.marks[seat] ?? [];

  useEffect(() => {
    dictionary(v.lang);
  }, [v.lang]);
  // A new guess came back: clear the row
  useEffect(() => setTyped(''), [v.mine.length]);

  const flash = (text: string) => {
    setMsg(text);
    setShake(true);
    setTimeout(() => setShake(false), 450);
  };

  const press = async (key: string) => {
    if (!canMove || busy.current) return;
    if (key === '⌫' || key === 'Backspace') {
      setTyped((t) => [...t].slice(0, -1).join(''));
      setMsg('');
      return;
    }
    if (key === '⏎' || key === 'Enter') {
      if ([...typed].length < L.LETTERS) return flash(tx('Not enough letters'));
      busy.current = true;
      try {
        const words = await dictionary(v.lang).catch(() => null);
        if (words && !words.has(typed)) return flash(tx('Not in the word list'));
        if (v.mine.includes(typed)) return flash(tx('You already tried that word'));
        setMsg('');
        onMove({ type: 'guess', word: typed });
      } finally {
        busy.current = false;
      }
      return;
    }
    const ch = L.lower(v.lang, key);
    if ([...ch].length === 1 && L.ALPHABET[v.lang].includes(ch)) {
      setTyped((t) => ([...t].length < L.LETTERS ? t + ch : t));
      setMsg('');
    }
  };
  const pressRef = useRef(press);
  pressRef.current = press;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).matches?.('input, textarea, select')) return;
      if (e.key === 'Enter' || e.key === 'Backspace' || [...e.key].length === 1) {
        e.preventDefault();
        pressRef.current(e.key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Best mark seen for each letter, to color the keyboard
  const keyMark = new Map<string, L.Mark>();
  v.mine.forEach((g, k) =>
    [...g].forEach((ch, i) => {
      const m = myMarks[k]?.[i];
      if (m && (!keyMark.has(ch) || RANK[m] > RANK[keyMark.get(ch)!])) keyMark.set(ch, m);
    }),
  );

  const rows = Array.from({ length: L.TRIES }, (_, r) => {
    if (r < v.mine.length) return { letters: [...v.mine[r]], marks: myMarks[r] };
    if (r === v.mine.length && !v.done[seat]) return { letters: [...typed], marks: null, current: true };
    return { letters: [], marks: null };
  });

  const others = players.map((p, i) => ({ p, i })).filter(({ i }) => i !== seat);

  return (
    <div className="stack-sm center fl">
      {v.day !== null && <span className="chip">{tx('Daily word #{n}', { n: v.day + 1 })}</span>}
      <div className="fl-grid" aria-label={tx('Your guesses')}>
        {rows.map((row, r) => (
          <div key={r} className={'fl-row' + (row.current && shake ? ' shake' : '')}>
            {Array.from({ length: L.LETTERS }, (_, i) => {
              const ch = row.letters[i];
              const m = row.marks?.[i];
              return (
                <span key={i} className={'fl-cell' + (m ? ' ' + m : '') + (ch && !m ? ' typed' : '')} style={m ? { animationDelay: `${i * 90}ms` } : undefined}>
                  {ch ? upper(v.lang, ch) : ''}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <p className="small fl-msg" aria-live="polite">
        {msg ||
          (v.done[seat]
            ? v.solved[seat]
              ? tx('Solved in {n}! 🎉', { n: v.mine.length })
              : tx('Out of tries. The word was {w}.', { w: upper(v.lang, v.answer ?? '') })
            : '')}
      </p>
      {v.done[seat] && v.solved[seat] && v.answer && <p className="small muted">{tx('The word was {w}.', { w: upper(v.lang, v.answer) })}</p>}
      {v.done[seat] && (
        <button
          className="btn small"
          onClick={() =>
            navigator.clipboard?.writeText(shareText(v)).then(
              () => setCopied(true),
              () => {},
            )
          }
        >
          {copied ? tx('Copied ✓') : `📋 ${tx('Copy my result')}`}
        </button>
      )}

      {!v.done[seat] && (
        <div className="fl-keys">
          {KEYS[v.lang].map((row, r) => (
            <div key={r} className="fl-keyrow">
              {[...row].map((k) => {
                const m = keyMark.get(k);
                const wide = k === '⏎' || k === '⌫';
                return (
                  <button
                    key={k}
                    className={'fl-key' + (m ? ' ' + m : '') + (wide ? ' wide' : '')}
                    disabled={!canMove}
                    onClick={() => press(k)}
                    aria-label={k === '⏎' ? tx('Enter') : k === '⌫' ? tx('Delete') : upper(v.lang, k)}
                  >
                    {k === '⏎' ? tx('Enter') : k === '⌫' ? '⌫' : upper(v.lang, k)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div className="fl-others">
          {others.map(({ p, i }) => (
            <div key={i} className="fl-other">
              <span className="small">
                {p.name} {v.solved[i] ? '✅' : v.done[i] ? '❌' : ''}
              </span>
              <div className="fl-mini">
                {Array.from({ length: L.TRIES }, (_, r) => (
                  <div key={r} className="fl-mini-row">
                    {Array.from({ length: L.LETTERS }, (_, c) => (
                      <span key={c} className={'fl-dot ' + (v.marks[i]?.[r]?.[c] ?? '')} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const fiveLetters: GameDef<L.FiveState, L.FiveMove, L.FiveView> = {
  id: 'bes-harf',
  name: 'Beş Harf',
  tagline: 'Find the five-letter word in six guesses. Race your friends on the same word.',
  icon: '🔤',
  minPlayers: 1,
  maxPlayers: 8,
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
    {
      id: 'mode',
      label: 'Word',
      default: 'random',
      choices: [
        { value: 'random', label: 'Random word' },
        { value: 'daily', label: 'Word of the day' },
      ],
    },
  ],
  rules:
    'Guess the hidden five-letter word in six tries. Each guess must be a real word. After you guess, every letter is colored: green means right letter, right place; yellow means the letter is in the word but somewhere else; gray means it isn’t in the word. With friends, everyone gets the same word and sees each other’s colors (never the letters). Fewest guesses wins; on a tie, whoever finished first. "Word of the day" gives everyone the same word on the same day.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  bot: L.bot,
  botDelay: () => 2200,
  isPrivate: (v) => !v.over,
  Board,
};
