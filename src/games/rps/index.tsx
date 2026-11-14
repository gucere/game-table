import type { BoardProps, GameDef } from '../../engine/types';
import * as L from './logic';
import { t as tx } from '../../i18n';

const EMOJI: Record<L.Choice, string> = { rock: '✊', paper: '✋', scissors: '✌️' };
const LABEL: Record<L.Choice, string> = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' };

function Board({ view, seat, players, canMove, onMove }: BoardProps<L.RpsView, L.Choice>) {
  const other = 1 - seat;
  const last = view.history[view.history.length - 1];
  return (
    <div className="rps">
      <div className="rps-score">
        <span style={{ color: 'var(--p0)' }}>{players[0].name}</span>
        <strong>
          {view.scores[0]} – {view.scores[1]}
        </strong>
        <span style={{ color: 'var(--p1)' }}>{players[1].name}</span>
      </div>
      <p className="muted small center">{tx('First to {TARGET} wins', { TARGET: L.TARGET })}</p>

      {last && (
        <div className="rps-last" key={view.history.length}>
          <span className="rps-big">{EMOJI[last.choices[seat]]}</span>
          <span className="rps-vs">
            {last.winner === null ? tx('Tie') : last.winner === seat ? tx('You win the round') : tx('{name} wins the round', { name: players[other].name })}
          </span>
          <span className="rps-big">{EMOJI[last.choices[other]]}</span>
        </div>
      )}

      {view.mine ? (
        <p className="center">{tx('You picked {EMOJI}.', { EMOJI: EMOJI[view.mine] })}{' '}
          {view.picked[other] ? '' : tx('Waiting for {name}…', { name: players[other].name })}
        </p>
      ) : (
        <div className="rps-choices">
          {L.CHOICES.map((c) => (
            <button key={c} className="rps-choice" disabled={!canMove} onClick={() => onMove(c)}>
              <span className="rps-big">{EMOJI[c]}</span>
              <span>{LABEL[c]}</span>
            </button>
          ))}
        </div>
      )}
      {!view.mine && view.picked[other] && canMove && (
        <p className="center muted small">{tx('{name} has picked.', { name: players[other].name })}</p>
      )}

      {view.history.length > 0 && (
        <div className="rps-history" aria-label={tx('Previous rounds')}>
          {view.history.map((r, i) => (
            <span key={i} className={'chip' + (r.winner === null ? '' : r.winner === seat ? ' good' : ' bad')}>
              {EMOJI[r.choices[seat]]} {EMOJI[r.choices[other]]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export const rps: GameDef<L.RpsState, L.Choice, L.RpsView> = {
  id: 'rps',
  name: 'Rock Paper Scissors',
  tagline: 'Pick in secret. First to 3 wins.',
  icon: '✊',
  minPlayers: 2,
  maxPlayers: 2,
  hiddenInfo: true,
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m) => L.move(s, seat, m),
  result: L.result,
  bot: L.bot,
  Board,
};
