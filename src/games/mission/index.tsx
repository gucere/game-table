import { useState } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import { t as tx } from '../../i18n';
import * as L from './logic';

function ClueForm({ onMove }: { onMove: (m: L.MissionMove) => void }) {
  const [word, setWord] = useState('');
  const [count, setCount] = useState(1);
  const ok = word.trim() && !/\s/.test(word.trim());
  return (
    <form
      className="row center gm-clue-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onMove({ type: 'clue', word: word.trim(), count });
      }}
    >
      <input className="input" value={word} maxLength={30} placeholder={tx('One-word clue')} onChange={(e) => setWord(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
      <select className="input" value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label={tx('How many words')}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <button className="btn primary" disabled={!ok}>
        {tx('Give clue')}
      </button>
    </form>
  );
}

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.MissionView, L.MissionMove>) {
  // Turkish needs its own capitals (i → İ, ı → I), which CSS can't be trusted with
  const up = (w: string) => w.toLocaleUpperCase(v.lang === 'tr' ? 'tr' : 'en');
  const teamName = (t: 0 | 1) => (t ? tx('Team B') : tx('Team A'));
  const leaderName = (t: 0 | 1) => (L.leaderOf(t) === seat ? tx('You') : players[L.leaderOf(t)].name);
  const guessing = v.phase === 'guess' && canMove && !v.leader;

  let status = '';
  if (v.phase === 'done') status = v.bomb ? tx('💣 {team} hit the bomb!', { team: teamName((1 - v.winner!) as 0 | 1) }) : tx('{team} found all their words!', { team: teamName(v.winner!) });
  else if (v.phase === 'clue') status = canMove ? tx('You lead {team}: give a one-word clue and a number.', { team: teamName(v.team) }) : tx('{name} ({team}) is thinking of a clue…', { name: leaderName(v.team), team: teamName(v.team) });
  else if (guessing) status = tx('Pick the words that match the clue. Up to {n} guesses.', { n: (v.clue?.count ?? 0) + 1 - v.guesses });
  else status = tx('{team} is guessing…', { team: teamName(v.team) });

  return (
    <div className="stack center gm">
      <div className="info-row">
        {([0, 1] as const).map((t) => (
          <span key={t} className={'chip ' + (t ? 'gm-b' : 'gm-a') + (v.team === t && v.phase !== 'done' ? ' trump-chip' : '')}>
            {tx('{team}: {n} left', { team: teamName(t), n: v.remaining[t] })}
            <span className="small">
              {' '}
              ({players.flatMap((p, i) => (L.teamOf(i) === t ? [(i === seat ? tx('you') : p.name) + (i === L.leaderOf(t) ? ' 🕵️' : '')] : [])).join(', ')})
            </span>
          </span>
        ))}
        {v.leader && <span className="chip">🕵️ {tx('You see the secret key')}</span>}
      </div>
      {v.clue && v.phase === 'guess' && (
        <div className={'gm-current ' + (v.team ? 'gm-b' : 'gm-a')}>
          <strong>{up(v.clue.word)}</strong> <span>{v.clue.count}</span>
        </div>
      )}
      <p className="small">{status}</p>

      <div className="gm-grid">
        {v.words.map((w, i) => {
          const k = v.key[i];
          const shown = v.revealed[i];
          return (
            <button
              key={i}
              className={'gm-card' + (shown ? ` open k-${k}` : k ? ` hint k-${k}` : '')}
              disabled={!guessing || shown}
              onClick={() => onMove({ type: 'guess', i })}
            >
              {k === 'x' && (shown || v.leader || v.phase === 'done') ? '💣 ' : ''}
              {up(w)}
            </button>
          );
        })}
      </div>

      {v.phase === 'clue' && canMove && v.leader && <ClueForm key={v.log.length} onMove={onMove} />}
      {guessing && v.guesses > 0 && (
        <button className="btn" onClick={() => onMove({ type: 'stop' })}>
          {tx('End our turn')}
        </button>
      )}

      {v.log.length > 0 && (
        <div className="gm-log small">
          {v.log.map((l, i) => (
            <span key={i} className={'chip ' + (l.team ? 'gm-b' : 'gm-a')}>
              {up(l.word)} {l.count}
              {l.picks.length > 0 && ` → ${l.picks.map((p) => up(v.words[p])).join(', ')}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export const mission: GameDef<L.MissionState, L.MissionMove, L.MissionView> = {
  id: 'gizli-gorev',
  name: 'Gizli Görev',
  tagline: 'Two teams, 25 words, one secret key. Give clever one-word clues; avoid the bomb.',
  icon: '🕵️',
  minPlayers: 4,
  maxPlayers: 12,
  defaultPlayers: 4,
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
    'Two teams: players 1, 3, 5… against players 2, 4, 6…. The first player of each team is its leader and sees the secret key: which of the 25 words belong to which team, which are neutral, and which one is the 💣 bomb. The team that starts has 9 words, the other 8. On your team’s turn, the leader gives one clue word (not on the board) and a number: how many words it fits. Teammates then pick words one at a time. A word of yours lets you keep going, up to the number plus one; a neutral word or one of the other team’s ends your turn; the bomb loses the game at once. The first team to uncover all its words wins. Leaders mustn’t hint with faces or extra words! Best online, each on their own phone, with voice chat or in the same room.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m) => L.move(s, seat, m),
  result: L.result,
  isPrivate: (v) => v.leader && v.phase !== 'done',
  Board,
};
