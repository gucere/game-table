import { useEffect, useRef, useState } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import { t as tx } from '../../i18n';
import { dictionaryReady, loadDictionary } from '../wordtiles/dict';
import * as L from './logic';

function useClock(on: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setTick((n) => n + 1), 200);
    return () => clearInterval(id);
  }, [on]);
  return Date.now();
}

function eventText(e: L.ChainEvent, name: string, lang: L.Lang) {
  if (e.kind === 'word') return tx('{name} played {word}.', { name, word: L.upper(lang, e.word ?? '') });
  const base = e.kind === 'timeout' ? tx('{name} ran out of time and lost a life.', { name }) : tx('{name} gave up and lost a life.', { name });
  return e.out ? `${base} ${tx('{name} is out!', { name })}` : base;
}

function Board({ view: v, seat, players, canMove, onMove, clockOffset, result }: BoardProps<L.ChainState, L.ChainMove>) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [ready, setReady] = useState(dictionaryReady(v.lang));
  const input = useRef<HTMLInputElement>(null);
  const now = useClock(!v.over);
  const left = Math.max(0, (v.deadline + clockOffset - now) / 1000);
  const need = L.required(v);

  useEffect(() => {
    let live = true;
    loadDictionary(v.lang)
      .then(() => live && setReady(true))
      .catch(() => live && setMsg(tx('The word list could not be loaded. Check your connection.')));
    return () => {
      live = false;
    };
  }, [v.lang]);
  // New turn: clear the box and focus it
  useEffect(() => {
    setText('');
    setMsg('');
    if (canMove) input.current?.focus();
  }, [v.chain.length, v.turn, canMove]);

  const send = () => {
    const p = L.problem(v, text);
    if (p) {
      setMsg(tx(p.msg, p.params));
      return;
    }
    onMove({ type: 'word', word: text });
  };

  const recent = v.chain.slice(-12);
  return (
    <div className="stack-sm center chain">
      <div className="chain-players">
        {players.map((p, i) => (
          <span key={i} className={'chain-player' + (v.turn === i && !v.over ? ' on' : '') + (v.lives[i] === 0 ? ' out' : '')}>
            <span className="seat-dot" style={{ background: `var(--p${i})` }} /> {p.name}
            <span className="small">{v.lives[i] > 0 ? '❤️'.repeat(v.lives[i]) : '💀'}</span>
            <span className="small muted">{tx('{n} pts', { n: v.scores[i] })}</span>
          </span>
        ))}
      </div>

      <div className="chain-words" aria-label={tx('The chain so far')}>
        {v.chain.length > recent.length && <span className="muted">…</span>}
        {recent.map((c, i) => (
          <span key={v.chain.length - recent.length + i} className={'chain-word' + (i === recent.length - 1 ? ' last' : '')} style={{ borderColor: `var(--p${c.by})` }}>
            {L.upper(v.lang, c.w)}
          </span>
        ))}
        {!v.chain.length && <span className="muted small">{tx('The first word starts with the letter below.')}</span>}
      </div>

      {!v.over && (
        <>
          <div className="chain-letter" aria-live="polite">
            <span className="small muted">{tx('Next word starts with')}</span>
            <strong>{L.upper(v.lang, need)}</strong>
          </div>
          <div className="chain-timer" aria-hidden>
            <span style={{ width: `${Math.min(100, (left / v.secs) * 100)}%`, background: left < 5 ? '#e63946' : 'var(--accent)' }} />
          </div>
          <span className="small muted">{tx('{n} seconds', { n: Math.ceil(left) })}</span>
        </>
      )}

      {v.event && <p className="small">{eventText(v.event, players[v.event.seat]?.name ?? '', v.lang)}</p>}

      {canMove && !result && (
        <form
          className="row center-row"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            ref={input}
            className="input chain-input"
            value={text}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={20}
            placeholder={L.upper(v.lang, need) + '…'}
            onChange={(e) => {
              setText(e.target.value);
              setMsg('');
            }}
          />
          <button className="btn primary" type="submit" disabled={!ready}>
            {tx('Send')}
          </button>
          <button className="btn ghost small" type="button" onClick={() => onMove({ type: 'giveup' })}>
            {tx('Give up (lose a life)')}
          </button>
        </form>
      )}
      {!ready && <p className="small muted">{tx('Loading the word list…')}</p>}
      {msg && <p className="notice">{msg}</p>}
      {!canMove && !v.over && seat !== v.turn && <p className="small muted">{tx('Waiting for {name}…', { name: players[v.turn]?.name ?? '' })}</p>}
      {v.over && <p>{tx('The chain had {n} words.', { n: v.chain.length })}</p>}
    </div>
  );
}

export const wordChain: GameDef<L.ChainState, L.ChainMove, L.ChainState> = {
  id: 'kelime-zinciri',
  name: 'Kelime Zinciri',
  tagline: 'Every word starts with the last letter of the one before.',
  icon: '🔗',
  minPlayers: 1,
  maxPlayers: 8,
  defaultPlayers: 2,
  hiddenInfo: false,
  noTurnTimer: true,
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
      id: 'seconds',
      label: 'Time per word',
      default: '20',
      choices: [
        { value: '10', label: '10 seconds' },
        { value: '15', label: '15 seconds' },
        { value: '20', label: '20 seconds' },
        { value: '30', label: '30 seconds' },
      ],
    },
    {
      id: 'lives',
      label: 'Lives',
      default: '3',
      choices: [
        { value: '1', label: '1' },
        { value: '3', label: '3' },
        { value: '5', label: '5' },
      ],
    },
    {
      id: 'min',
      label: 'Shortest word',
      default: '3',
      choices: [
        { value: '2', label: '2 letters' },
        { value: '3', label: '3 letters' },
        { value: '4', label: '4 letters' },
      ],
    },
  ],
  rules:
    'Take turns saying a word that starts with the last letter of the previous word: kalem → masa → armut… Words can’t be used twice and must be in the word list. In Turkish, no word starts with ğ, so after a word ending in ğ (dağ) the next one starts with the letter before it (a). If time runs out, or you give up, you lose a life. The last player with lives left wins; each letter you play is a point. Alone, see how long a chain you can make: 10 words counts as a win.',
  setup: L.setup,
  activePlayers: (s) => (s.over ? [] : [s.turn]),
  view: (s) => s,
  move: L.move,
  result: L.result,
  timer: (s) => (s.over ? null : s.deadline),
  onTimer: L.onTimer,
  bot: L.bot,
  botDelay: (s) => 1400 + ((s.chain.length * 397) % 1800),
  Board,
};
