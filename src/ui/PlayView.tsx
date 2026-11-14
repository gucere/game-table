import { useLayoutEffect, useRef, useState } from 'react';
import type { Session, SessionSnapshot } from '../engine/session';
import type { GameResult, PlayerInfo, Seat } from '../engine/types';
import { getGame } from '../games';
import { gameName, gameRules, t as tt, useLang, useT } from '../i18n';
import { CustomizeButton } from './CustomizeDrawer';

function resultText(r: GameResult, players: PlayerInfo[], you: Seat | null) {
  if (r.message) return tt(r.message);
  if (r.draw || r.winners.length === 0) return tt("It's a draw!");
  if (you !== null && r.winners.includes(you)) return tt('You win! 🎉');
  const names = r.winners.map((w) => players[w].name).join(' & ');
  return r.winners.length > 1 ? tt('{names} win!', { names }) : tt('{names} wins!', { names });
}

export function PlayView({ session, snap, onLeave }: { session: Session; snap: SessionSnapshot; onLeave: () => void }) {
  const game = getGame(snap.gameId)!;
  const t = useT();
  const lang = useLang();
  const { players, localSeats, active, result } = snap;
  const humansHere = localSeats.filter((s) => players[s]?.kind === 'human' || players[s]?.kind === 'remote');
  const hotSeat = !snap.online && humansHere.length > 1;
  /** "You" only makes sense when exactly one person plays on this device */
  const you = humansHere.length === 1 ? humansHere[0] : null;

  // Whose eyes are we showing? The local seat that has to move; otherwise keep the last one.
  const perspective = useRef<Seat>(localSeats[0]);
  const activeHere = active.filter((s) => localSeats.includes(s) && players[s]?.kind !== 'bot');
  if (activeHere.length && !activeHere.includes(perspective.current)) perspective.current = activeHere[0];
  const seat = perspective.current;

  // On a shared device with secrets, cover the screen until the right person is holding it
  const [revealed, setRevealed] = useState<Seat | null>(null);
  // Cover the screen again as soon as it stops being that person's turn
  // (not after every move: some games give one player several moves in a row)
  const activeKey = active.join(',');
  const wasTheirTurn = useRef(false);
  useLayoutEffect(() => {
    const now = revealed !== null && active.includes(revealed);
    if (revealed !== null && wasTheirTurn.current && !now) setRevealed(null);
    wasTheirTurn.current = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, revealed]);
  const view = snap.views[seat];
  const secret = view !== undefined && (game.isPrivate ? game.isPrivate(view) : true);
  const needsPass = game.hiddenInfo && hotSeat && !result && revealed !== seat && secret;

  const canMove = !result && active.includes(seat) && players[seat]?.kind !== 'bot';

  let status: string;
  if (result) status = resultText(result, players, you);
  else if (canMove && players.length === 1) status = '';
  else if (canMove) status = hotSeat ? t("{name}'s turn", { name: players[seat].name }) : t('Your turn');
  else if (active.length) status = t('Waiting for {names}…', { names: active.map((s) => players[s].name).join(', ') });
  else status = '';

  const confirmLeave = () => {
    if (snap.online && !result && !confirm(t('Leave this game?'))) return;
    onLeave();
  };

  const Board = game.Board;

  return (
    <div className={"play stack" + (game.hiddenInfo || game.maxPlayers > 2 ? " wide" : "")}>
      <div className="play-head">
        <h1 className="play-title">
          <span aria-hidden>{game.icon}</span> {gameName(game, lang)}
        </h1>
        <div className="row">
          <CustomizeButton game={game} snap={snap} session={session} />
          <button className="btn ghost small" onClick={confirmLeave}>
            {t('Leave')}
          </button>
        </div>
      </div>

      <div className="player-bar">
        {players.map((p, i) => (
          <span key={i} className={'player-chip' + (active.includes(i) && !result ? ' active' : '') + (result?.winners.includes(i) ? ' winner' : '')}>
            <span className="seat-dot" style={{ background: `var(--p${i})` }} />
            {p.name}
            {p.kind === 'bot' && <span className="muted small"> 🤖</span>}
            {p.connected === false && <span className="muted small"> ({t('left')})</span>}
          </span>
        ))}
      </div>

      <p className={'status' + (result ? ' done' : canMove ? ' yours' : '')} aria-live="polite">
        {status}
      </p>
      {snap.notice && <p className="notice">{t(snap.notice)}</p>}

      <div className="board-area">
        {needsPass ? (
          <div className="pass-screen">
            <p className="muted">{t('Pass the device to')}</p>
            <p className="pass-name" style={{ color: `var(--p${seat})` }}>
              {players[seat].name}
            </p>
            <button className="btn primary" onClick={() => setRevealed(seat)}>
              {t("I'm {name}, show my screen", { name: players[seat].name })}
            </button>
          </div>
        ) : view !== undefined ? (
          <Board
            view={view}
            seat={seat}
            players={players}
            active={active}
            canMove={canMove}
            result={result}
            clockOffset={snap.clockOffset}
            onMove={(m) => {
              session.submit(seat, m);
            }}
          />
        ) : null}
      </div>

      {game.rules && (
        <details className="rules">
          <summary>{t('How to play')}</summary>
          <p className="small">{gameRules(game, lang)}</p>
        </details>
      )}

      {result && (
        <div className="row center-row">
          {snap.isHost ? (
            <>
              <button className="btn primary" onClick={() => session.restart?.()}>
                {t('Play again')}
              </button>
              {snap.online && (
                <button className="btn" onClick={() => session.backToLobby?.()}>
                  {t('Back to lobby')}
                </button>
              )}
            </>
          ) : (
            <p className="muted">{t('Waiting for the host to start the next game…')}</p>
          )}
        </div>
      )}
    </div>
  );
}
