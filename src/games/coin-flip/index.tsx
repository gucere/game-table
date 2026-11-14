import type { BoardProps, GameDef } from '../../engine/types';
import * as L from './logic';
import { t as tx } from '../../i18n';

const SIDE_LABEL: Record<L.Side, string> = { heads: 'Heads', tails: 'Tails' };

function Coin({ flip, n }: { flip: L.Flip | undefined; n: number }) {
  const cls = flip ? `coin spin-${flip.outcome}` : 'coin';
  return (
    <div className="coin-stage">
      {/* key restarts the animation on every flip */}
      <div className={cls} key={n}>
        <div className="coin-face heads">★</div>
        <div className="coin-face tails">☾</div>
      </div>
    </div>
  );
}

function Board({ view, seat, players, canMove, onMove }: BoardProps<L.CoinState, L.CoinMove>) {
  const last = view.flips[view.flips.length - 1];
  const solo = view.numPlayers === 1;
  let message = '';
  if (last) {
    const outcome = SIDE_LABEL[last.outcome];
    if (last.call === null) message = `${outcome}!`;
    else {
      const right = last.call === last.outcome;
      const who = last.caller === seat ? 'You' : players[last.caller].name;
      message = `${outcome}! ${who} called ${SIDE_LABEL[last.call].toLowerCase()}: ${right ? 'correct' : 'wrong'}.`;
    }
  }
  return (
    <div className="coinflip">
      <Coin flip={last} n={view.flips.length} />
      <p className="center coin-msg" key={view.flips.length}>
        {message || tx('Call it in the air.')}
      </p>
      {solo ? (
        <p className="center muted small">{tx('Correct calls: {scores} / {length} · Streak:', { scores: view.scores[0], length: view.flips.filter((f) => f.call).length })}{' '}{L.streak(view)}
        </p>
      ) : (
        <div className="rps-score">
          <span style={{ color: 'var(--p0)' }}>{players[0].name}</span>
          <strong>
            {view.scores[0]} – {view.scores[1]}
          </strong>
          <span style={{ color: 'var(--p1)' }}>{players[1].name}</span>
        </div>
      )}
      {!solo && <p className="muted small center">{tx('Take turns calling. First to {TARGET} wins.', { TARGET: L.TARGET })}</p>}
      <div className="row center-row">
        <button className="btn" disabled={!canMove} onClick={() => onMove({ type: 'call', side: 'heads' })}>{tx('★ Heads')}</button>
        <button className="btn" disabled={!canMove} onClick={() => onMove({ type: 'call', side: 'tails' })}>{tx('☾ Tails')}</button>
        {solo && (
          <button className="btn ghost" disabled={!canMove} onClick={() => onMove({ type: 'flip' })}>{tx('Just flip')}</button>
        )}
      </div>
    </div>
  );
}

export const coinFlip: GameDef<L.CoinState, L.CoinMove, L.CoinState> = {
  id: 'coin-flip',
  name: 'Coin Flip',
  tagline: 'Settle it. Or race a friend to 3 correct calls.',
  icon: '🪙',
  minPlayers: 1,
  maxPlayers: 2,
  hiddenInfo: false,
  setup: L.setup,
  activePlayers: (s) => (L.result(s) ? [] : [s.caller]),
  view: (s) => s,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx.random),
  result: L.result,
  bot: L.bot,
  Board,
};
