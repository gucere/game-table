import { useEffect, useRef, useState } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import { Countdown } from '../shared/Countdown';
import * as L from './logic';
import { t as tx } from '../../i18n';

function WritePhase({ v, onMove, canMove }: { v: L.IshView; onMove: (m: L.IshMove) => void; canMove: boolean }) {
  const [answers, setAnswers] = useState<string[]>(() => v.answers[v.me]);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef(answers);
  latest.current = answers;

  // Send answers a moment after typing stops (and right away on unmount)
  useEffect(() => () => clearTimeout(timer.current), []);
  const update = (c: number, text: string) => {
    const next = answers.map((a, i) => (i === c ? text : a));
    setAnswers(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onMove({ type: 'answers', answers: latest.current }), 350);
  };
  const allOk = answers.every((a) => L.startsWith(a, v.letter, v.lang));

  return (
    <div className="stack-sm">
      <div className="ish-inputs">
        {v.cats.map((cat, c) => {
          const bad = answers[c].trim() !== '' && !L.startsWith(answers[c], v.letter, v.lang);
          return (
            <label key={cat} className="field">
              <span>{cat}</span>
              <input
                className={'input' + (bad ? ' bad' : '')}
                value={answers[c]}
                maxLength={30}
                disabled={!canMove}
                placeholder={`${v.letter}…`}
                autoComplete="off"
                onChange={(e) => update(c, e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </label>
          );
        })}
      </div>
      {v.stoppedBy === null ? (
        <button
          className="btn primary"
          disabled={!allOk || !canMove}
          onClick={() => {
            clearTimeout(timer.current);
            onMove({ type: 'answers', answers });
            onMove({ type: 'stop' });
          }}
        >{tx('✋ STOP! (everyone has 5 seconds left)')}</button>
      ) : null}
    </div>
  );
}

function Board({ view: v, seat, players, canMove, onMove, clockOffset }: BoardProps<L.IshView, L.IshMove>) {
  return (
    <div className="stack ish">
      <div className="info-row">
        <span className="chip">{tx('Round {v} / {rounds}', { v: Math.min(v.round + 1, v.rounds), rounds: v.rounds })}
        </span>
        {v.phase !== 'done' && <Countdown deadline={v.deadline} offset={clockOffset} />}
        {v.stoppedBy !== null && v.phase === 'write' && <span className="chip urgent">✋ {v.stoppedBy === seat ? tx('You') : players[v.stoppedBy].name}{' '}{tx('called STOP!')}</span>}
      </div>

      <div className="ish-letter" aria-label={tx('Letter {letter}', { letter: v.letter })}>
        {v.letter}
      </div>

      {v.phase === 'write' && <WritePhase key={v.round} v={v} onMove={onMove} canMove={canMove} />}

      {(v.phase === 'review' || v.phase === 'scores' || v.phase === 'done') && v.valid && (
        <div className="stack-sm">
          {v.phase === 'review' && <p className="small center">{tx('Tap someone else\'s answer to vote it down (tap again to undo). More than half of the other players must agree.')}</p>}
          <div className="ish-table-wrap">
            <table className="score-table ish-table">
              <thead>
                <tr>
                  <th />
                  {v.cats.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                  {v.roundPoints.length > v.round && <th>+</th>}
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => (
                  <tr key={i}>
                    <td>{i === seat ? tx('You') : p.name}</td>
                    {v.cats.map((_, c) => {
                      const text = v.answers[i][c];
                      const ok = v.valid![i][c];
                      const vetoed = v.rejects[i][c];
                      const mine = vetoed.includes(seat);
                      const can = v.phase === 'review' && canMove && i !== seat && text.trim() !== '';
                      return (
                        <td key={c}>
                          <button className={'ish-ans' + (ok ? ' ok' : ' bad') + (mine ? ' mine' : '')} disabled={!can} onClick={() => onMove({ type: 'veto', seat: i, cat: c })}>
                            {text || '—'}
                            {vetoed.length > 0 && <span className="small"> 👎{vetoed.length}</span>}
                          </button>
                        </td>
                      );
                    })}
                    {v.roundPoints.length > v.round && <td>+{v.roundPoints[v.round][i]}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {v.phase === 'review' &&
            (canMove ? (
              <button className="btn primary" onClick={() => onMove({ type: 'ready' })}>{tx('Done reviewing')}</button>
            ) : (
              <p className="small muted center">{tx('Waiting for the others to finish reviewing…')}</p>
            ))}
        </div>
      )}

      <div className="info-row">
        {players.map((p, i) => (
          <span key={i} className="chip">
            {i === seat ? tx('You') : p.name}: {v.scores[i]}
          </span>
        ))}
      </div>
    </div>
  );
}

export const ish: GameDef<L.IshState, L.IshMove, L.IshView> = {
  id: 'isim-sehir-hayvan',
  name: 'İsim Şehir Hayvan',
  tagline: 'One letter, five categories, a race against the clock.',
  icon: '✍️',
  minPlayers: 2,
  maxPlayers: 10,
  hiddenInfo: true,
  onlineOnly: true,
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
      id: 'cats',
      label: 'Categories',
      default: 'classic',
      choices: [
        { value: 'classic', label: 'Classic 5 (name, city, animal, plant, thing)' },
        { value: 'more', label: '8 (adds country, job, food)' },
      ],
    },
    {
      id: 'time',
      label: 'Time to write',
      default: '90',
      choices: [
        { value: '60', label: '60 seconds' },
        { value: '90', label: '90 seconds' },
        { value: '120', label: '2 minutes' },
      ],
    },
    {
      id: 'rounds',
      label: 'Rounds',
      default: '5',
      choices: [
        { value: '3', label: '3' },
        { value: '5', label: '5' },
        { value: '8', label: '8' },
      ],
    },
  ],
  rules:
    'A letter is drawn. Write a word starting with it for every category before time runs out. Fill them all and you can call STOP: everyone else then has 5 seconds. Then everyone sees all the answers and can vote down bad ones (more than half of the other players must agree). Scoring per category: 10 for a unique answer, 5 if someone else wrote the same thing, 20 if you are the only one with a valid answer.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  isPrivate: () => false,
  timer: (s) => s.deadline,
  onTimer: L.onTimer,
  Board,
};
