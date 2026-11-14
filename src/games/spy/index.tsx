import type { BoardProps, GameDef } from '../../engine/types';
import { t as tx } from '../../i18n';
import { Countdown } from '../shared/Countdown';
import * as L from './logic';

function Board({ view: v, seat, players, canMove, onMove, clockOffset }: BoardProps<L.SpyView, L.SpyMove>) {
  const place = (i: number) => L.PLACES[i][v.lang === 'en' ? 1 : 0];
  const name = (s: number) => (s === seat ? tx('You') : players[s].name);
  const others = players.map((_, i) => i).filter((i) => i !== seat);

  return (
    <div className="stack center spy">
      <div className={'spy-role' + (v.amSpy ? ' is-spy' : '')}>
        {v.amSpy ? (
          <>
            <span className="spy-big">🕵️ {tx('You are the spy!')}</span>
            <span className="small">{tx('Nobody told you the place. Blend in, and work out where everyone is.')}</span>
          </>
        ) : (
          <>
            <span className="small muted">{tx('The place is')}</span>
            <span className="spy-big">📍 {v.myPlace !== null ? place(v.myPlace) : ''}</span>
            <span className="small">{tx('One of you is a spy who doesn’t know it. Ask careful questions!')}</span>
          </>
        )}
      </div>

      {v.phase === 'play' && (
        <div className="info-row">
          <Countdown deadline={v.deadline} offset={clockOffset} />
          <span className="chip">{tx('{name} asks the first question.', { name: name(v.firstAsker) })}</span>
        </div>
      )}

      {v.phase === 'play' && canMove && !v.accused[seat] && (
        <div className="stack-sm center">
          <span className="small">{tx('Think you know who the spy is? Accuse them (once per game); everyone else must agree.')}</span>
          <div className="row center">
            {others.map((i) => (
              <button key={i} className="btn small" onClick={() => onMove({ type: 'accuse', suspect: i })}>
                👉 {players[i].name}
              </button>
            ))}
          </div>
        </div>
      )}

      {v.phase === 'accuse' && v.accusation && (
        <div className="stack-sm center spy-accuse">
          <strong>{tx('{by} accuses {suspect} of being the spy!', { by: name(v.accusation.by), suspect: name(v.accusation.suspect) })}</strong>
          <span className="small muted">{tx('Everyone except the accused must agree. One “no” and the game goes on.')}</span>
          {canMove ? (
            <div className="row center">
              <button className="btn primary" onClick={() => onMove({ type: 'vote', yes: true })}>
                👍 {tx('Agree')}
              </button>
              <button className="btn" onClick={() => onMove({ type: 'vote', yes: false })}>
                👎 {tx('Disagree')}
              </button>
            </div>
          ) : (
            <span className="small">{tx('Waiting for the votes…')}</span>
          )}
        </div>
      )}

      {v.phase === 'final' && (
        <div className="stack-sm center">
          <strong>⏰ {tx('Time’s up! Everyone votes for the spy.')}</strong>
          {canMove ? (
            <div className="row center">
              {others.map((i) => (
                <button key={i} className="btn" onClick={() => onMove({ type: 'final', suspect: i })}>
                  {players[i].name}
                </button>
              ))}
            </div>
          ) : (
            <span className="small">{tx('Voted: {n} / {m}', { n: v.finalVoted.filter(Boolean).length, m: v.n })}</span>
          )}
        </div>
      )}

      {v.phase === 'spyguess' && <strong>{v.amSpy ? tx('They caught you! Guess the place to still win:') : tx('The spy was caught… but gets one guess at the place!')}</strong>}

      {v.amSpy && (v.phase === 'play' || v.phase === 'spyguess') && canMove && (
        <div className="stack-sm center">
          {v.phase === 'play' && <span className="small">{tx('Sure of the place? Reveal yourself and guess it: right and you win, wrong and you lose.')}</span>}
          <div className="spy-places">
            {L.PLACES.map((_, i) => (
              <button
                key={i}
                className="btn small"
                onClick={() => {
                  if (confirm(tx('Guess “{place}”?', { place: place(i) }))) onMove({ type: 'guess', place: i });
                }}
              >
                {place(i)}
              </button>
            ))}
          </div>
        </div>
      )}

      {v.phase === 'done' && (
        <div className="stack-sm center">
          <strong>
            {v.reason === 'caught' && tx('Caught! {spy} was the spy.', { spy: name(v.spySeat!) })}
            {v.reason === 'wrong' && tx('Wrong person! The spy was {spy}.', { spy: name(v.spySeat!) })}
            {v.reason === 'escaped' && tx('The spy got away! It was {spy}.', { spy: name(v.spySeat!) })}
            {v.reason === 'spy-guessed' && tx('{spy}, the spy, guessed the place!', { spy: name(v.spySeat!) })}
            {v.reason === 'spy-missed' && tx('{spy}, the spy, guessed wrong ({guess}).', { spy: name(v.spySeat!), guess: v.guess !== null ? place(v.guess) : '' })}
          </strong>
          {v.place !== null && <span>{tx('The place was {place}.', { place: place(v.place) })}</span>}
        </div>
      )}

      {!v.amSpy && v.phase !== 'done' && (
        <details className="small">
          <summary>{tx('All possible places')}</summary>
          <p className="muted">{L.PLACES.map((_, i) => place(i)).join(' · ')}</p>
        </details>
      )}
    </div>
  );
}

export const spy: GameDef<L.SpyState, L.SpyMove, L.SpyView> = {
  id: 'casus-kim',
  name: 'Casus Kim?',
  tagline: 'Everyone knows the place except the spy. Ask, bluff, and find them.',
  icon: '🕵️‍♀️',
  minPlayers: 3,
  maxPlayers: 12,
  defaultPlayers: 5,
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
      id: 'minutes',
      label: 'Time',
      default: '8',
      choices: [
        { value: '5', label: '5 min' },
        { value: '8', label: '8 min' },
        { value: '10', label: '10 min' },
      ],
    },
  ],
  rules:
    'Everyone sees the same secret place, except one player, the spy, who sees nothing. Take turns asking each other questions out loud about the place (“What do you wear here?”), answering vaguely enough not to help the spy, but clearly enough to show you know. Anyone may accuse someone once per game: if everyone else agrees, the accused is revealed. Catch the spy and everyone else wins; accuse an innocent and the spy wins. The spy can reveal themselves at any time and guess the place: right wins, wrong loses. When time runs out, everyone votes; if the spy gets the most votes they still get one guess at the place. Play in the same room or with voice chat on, each on your own phone.',
  setup: (ctx) => L.setup(ctx),
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  timer: (s) => s.deadline,
  onTimer: (s) => L.onTimer(s),
  Board,
};
