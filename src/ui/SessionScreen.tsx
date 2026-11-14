import { useSyncExternalStore } from 'react';
import type { Session } from '../engine/session';
import { ChatDock, VoteBanner } from './ChatDock';
import { ReactionBar, ReactionsOverlay, SpectatorBar, VoiceBar } from './RoomExtras';
import { Lobby } from './Lobby';
import { useT } from '../i18n';
import { PlayView } from './PlayView';

export function SessionScreen({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const t = useT();

  if (snap.phase === 'connecting') {
    return (
      <div className="panel stack narrow center">
        <div className="spinner" aria-hidden />
        <p>{snap.isHost ? t('Opening a room…') : t('Connecting to room {code}…', { code: snap.roomCode ?? '' })}</p>
        <button className="btn ghost" onClick={onLeave}>
          {t('Cancel')}
        </button>
      </div>
    );
  }

  if (snap.phase === 'closed') {
    return (
      <div className="panel stack narrow center">
        <h2>{t('Disconnected')}</h2>
        <p className="muted">{t(snap.error ?? 'The session ended.')}</p>
        <button className="btn primary" onClick={onLeave}>
          {t('Back to games')}
        </button>
      </div>
    );
  }

  const main = snap.phase === 'lobby' ? <Lobby session={session} snap={snap} onLeave={onLeave} /> : <PlayView session={session} snap={snap} onLeave={onLeave} />;
  if (!snap.online) return main;
  return (
    <div className="online-room">
      <VoteBanner session={session} snap={snap} />
      {snap.reconnecting && <p className="notice center">{t('Connection lost. Reconnecting…')}</p>}
      <div className="room-tools">
        <VoiceBar session={session} snap={snap} />
        {snap.phase === 'playing' && <ReactionBar session={session} />}
      </div>
      <SpectatorBar session={session} snap={snap} />
      {main}
      <ReactionsOverlay snap={snap} />
      <ChatDock session={session} snap={snap} />
    </div>
  );
}
