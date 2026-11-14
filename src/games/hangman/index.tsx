import { useEffect, useState } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import * as L from './logic';
import { t as tx } from '../../i18n';

function Gallows({ wrong }: { wrong: number }) {
  const parts = [
    <line key="base" x1="10" y1="140" x2="90" y2="140" />,
    <line key="pole" x1="30" y1="140" x2="30" y2="10" />,
    <line key="beam" x1="30" y1="10" x2="85" y2="10" />,
    <line key="rope" x1="85" y1="10" x2="85" y2="30" />,
    <circle key="head" cx="85" cy="42" r="12" />,
    <line key="body" x1="85" y1="54" x2="85" y2="95" />,
    <path key="arms" d="M65 70 L85 62 L105 70" />,
    <path key="legs" d="M70 125 L85 95 L100 125" />,
  ];
  return (
    <svg className="hm-gallows" viewBox="0 0 120 150" role="img" aria-label={tx('{wrong} of {MAX_WRONG} wrong guesses', { wrong: wrong, MAX_WRONG: L.MAX_WRONG })}>
      {parts.slice(0, wrong)}
    </svg>
  );
}

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.HangView, L.HangMove>) {
  const [solve, setSolve] = useState('');
  const [secret, setSecret] = useState('');
  const guessing = canMove && v.phase === 'guess';
  const name = (i: number) => (i === seat ? 'You' : players[i].name);

  // Type letters on a keyboard
  useEffect(() => {
    if (!guessing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      const l = L.upper(e.key, v.lang);
      if (L.ALPHABET[v.lang].includes(l) && !v.guessed.includes(l)) onMove({ type: 'letter', letter: l });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [guessing, v.guessed, v.lang, onMove]);

  return (
    <div className="stack center hangman">
      <div className="info-row">
        <span className="chip">{tx('Word {v} / {rounds}', { v: Math.min(v.round + 1, v.rounds), rounds: v.rounds })}
        </span>
        {v.setter !== null && <span className="chip">{tx('Word by {v}', { v: name(v.setter) })}</span>}
        <span className="chip">{tx('Misses: {wrong} / {MAX_WRONG}', { wrong: v.wrong, MAX_WRONG: L.MAX_WRONG })}
        </span>
        {v.n > 1 &&
          players.map((_, i) => (
            <span key={i} className={'chip' + (v.turn === i && v.phase === 'guess' ? ' trump-chip' : '')}>
              {name(i)}: {v.scores[i]}
            </span>
          ))}
      </div>

      <Gallows wrong={v.wrong} />

      {v.phase === 'set' ? (
        canMove ? (
          <form
            className="stack-sm center"
            onSubmit={(e) => {
              e.preventDefault();
              onMove({ type: 'set', word: secret });
              setSecret('');
            }}
          >
            <span className="small">{tx('Choose a secret word for the others (letters only).')}</span>
            <input className="input" type="password" value={secret} maxLength={16} autoComplete="off" onChange={(e) => setSecret(e.target.value)} onKeyDown={(e) => e.stopPropagation()} autoFocus />
            <button className="btn primary" disabled={secret.trim().length < 3}>{tx('Set word')}</button>
          </form>
        ) : (
          <p className="muted">{tx('{name} is choosing a word…', { name: players[v.setter!].name })}</p>
        )
      ) : (
        <div className="hm-word" aria-label={tx('Word')}>
          {v.mask.map((ch, i) => (
            <span key={i} className={'hm-letter' + (ch && !v.guessed.includes(ch) ? ' revealed' : '')}>
              {ch ?? ''}
            </span>
          ))}
        </div>
      )}

      {v.phase === 'reveal' && <p className="pisti-flash">{v.outcome === 'solved' ? tx('Solved! 🎉') : tx('Hanged! The word was {word}.', { word: v.word })}</p>}
      {v.phase === 'guess' && !canMove && v.setter !== seat && <p className="small muted">{tx('{name} is guessing…', { name: players[v.turn].name })}</p>}
      {v.phase === 'guess' && v.setter === seat && <p className="small muted">{tx('Your word: {word}. Watch them squirm.', { word: v.word })}</p>}

      {v.phase === 'guess' && (
        <div className="hm-keys">
          {L.ALPHABET[v.lang].map((l) => {
            const used = v.guessed.includes(l);
            const hit = used && v.mask.includes(l);
            return (
              <button key={l} className={'hm-key' + (used ? (hit ? ' hit' : ' miss') : '')} disabled={!guessing || used} onClick={() => onMove({ type: 'letter', letter: l })}>
                {l}
              </button>
            );
          })}
        </div>
      )}

      {guessing && (
        <form
          className="row center-row"
          onSubmit={(e) => {
            e.preventDefault();
            onMove({ type: 'solve', word: solve });
            setSolve('');
          }}
        >
          <input className="input" value={solve} placeholder={tx('Know it? Type the word')} maxLength={16} onChange={(e) => setSolve(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
          <button className="btn" disabled={!solve.trim()}>{tx('Solve (a miss costs a life)')}</button>
        </form>
      )}
    </div>
  );
}

export const hangman: GameDef<L.HangState, L.HangMove, L.HangView> = {
  id: 'adam-asmaca',
  name: 'Adam Asmaca',
  tagline: 'Guess the word, one letter at a time, before the drawing is done.',
  icon: '🪢',
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
      label: 'Who picks the word',
      default: 'computer',
      choices: [
        { value: 'computer', label: 'The computer' },
        { value: 'players', label: 'Players take turns (2+ players)' },
      ],
    },
    {
      id: 'rounds',
      label: 'Words',
      default: '5',
      choices: [
        { value: '3', label: '3' },
        { value: '5', label: '5' },
        { value: '10', label: '10' },
      ],
    },
  ],
  rules:
    'Guess letters (tap them or type on your keyboard). Each right letter is worth 10 points per time it appears and you go again; a wrong letter adds to the drawing and passes the turn. Revealing the last letter is +20. Think you know it? Solve it for 5 points per hidden letter plus 20, but a wrong answer costs a life. After 8 misses the man is hanged; if a player chose the word, they get 50 points.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  bot: L.bot,
  botDelay: () => 900,
  isPrivate: (v) => v.phase === 'set',
  timer: (s) => s.deadline,
  onTimer: L.onTimer,
  Board,
};
