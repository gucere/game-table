import { useState } from 'react';
import type { Session, SessionSnapshot } from '../engine/session';
import { GAMES, getGame } from '../games';
import { gameName, useLang, useT } from '../i18n';
import { CustomizeButton } from './CustomizeDrawer';
import { OptionsForm } from './Setup';

function joinLink(code: string) {
  const base = window.location.href.split('#')[0];
  return `${base}#/join/${code}`;
}

export function Lobby({ session, snap, onLeave }: { session: Session; snap: SessionSnapshot; onLeave: () => void }) {
  const game = getGame(snap.gameId);
  const t = useT();
  const lang = useLang();
  const [copied, setCopied] = useState(false);
  const code = snap.roomCode ?? '';
  const n = snap.players.length;
  const canStart = !!game && n >= game.minPlayers && n <= game.maxPlayers;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(joinLink(code));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the link is still visible to copy by hand */
    }
  };

  return (
    <div className="panel stack">
      <div className="lobby-head">
        <div>
          <p className="muted small">{t('Room code')}</p>
          <p className="room-code">{code}</p>
        </div>
        {game && <CustomizeButton game={game} snap={snap} session={session} />}
        {snap.isHost && (
          <div className="stack-sm lobby-share">
            <button className="btn" onClick={copy}>
              {copied ? t('Link copied ✓') : t('Copy invite link')}
            </button>
            <span className="muted small break">{joinLink(code)}</span>
          </div>
        )}
      </div>

      <label className="field">
        <span>{t('Game')}</span>
        {snap.isHost ? (
          <select className="input" value={snap.gameId} onChange={(e) => session.setGame?.(e.target.value)}>
            {GAMES.filter((g) => g.maxPlayers >= 2).map((g) => (
              <option key={g.id} value={g.id}>
                {g.icon} {gameName(g, lang)} ({t('{n} players', { n: g.minPlayers === g.maxPlayers ? g.minPlayers : `${g.minPlayers}–${g.maxPlayers}` })})
              </option>
            ))}
          </select>
        ) : (
          <strong>
            {game?.icon} {game && gameName(game, lang)}
          </strong>
        )}
      </label>

      {game && <OptionsForm game={game} options={snap.options} readOnly={!snap.isHost} onChange={(id, v) => session.setOption?.(id, v)} />}

      <div>
        <p className="muted small">
          {t('Players')} ({n}/{game?.maxPlayers})
        </p>
        <div className="seat-list">
          {snap.players.map((p, i) => (
            <div className="seat-row" key={i}>
              <span className="seat-dot" style={{ background: `var(--p${i})` }} />
              <span className="grow">
                {p.name}
                {i === 0 && <span className="muted small"> · {t('host')}</span>}
                {p.kind === 'bot' && <span className="muted small"> · {t('bot')}</span>}
                {!snap.isHost && snap.localSeats[0] === i && <span className="muted small"> · {t('you')}</span>}
              </span>
              {!snap.isHost && i > 0 && i !== snap.localSeats[0] && p.kind === 'remote' && !snap.vote && (
                <button className="btn ghost small" onClick={() => session.startVote?.(i)}>
                  {t('Vote to remove')}
                </button>
              )}
              {snap.isHost && i > 0 && (
                <button className="icon-btn" aria-label={t('Remove {name}', { name: p.name })} onClick={() => session.removeSeat?.(i)}>
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {snap.notice && <p className="notice">{t(snap.notice)}</p>}

      {snap.isHost ? (
        <div className="row">
          {game?.bot && n < game.maxPlayers && (
            <button className="btn ghost" onClick={() => session.addBot?.()}>
              + {t('Add bot')}
            </button>
          )}
          <button className="btn primary grow" disabled={!canStart} onClick={() => session.start?.()}>
            {canStart ? t('Start game') : n < (game?.minPlayers ?? 2) ? t('Waiting for players…') : t('Too many players for this game')}
          </button>
        </div>
      ) : (
        <p className="center muted">{t('Waiting for the host to start…')}</p>
      )}
      <button className="btn ghost" onClick={onLeave}>
        {snap.isHost ? t('Close room') : t('Leave room')}
      </button>
    </div>
  );
}
