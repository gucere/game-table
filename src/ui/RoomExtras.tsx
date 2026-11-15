/** Extras for online rooms: invite QR code, voice chat, emoji reactions, spectating, rejoining. */
import { useEffect, useMemo, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import { ClientSession, HostSession, REACTIONS } from '../engine/online';
import { loadHostedRoom, loadLastRoom, roomOpenElsewhere, saveHostedRoom, saveLastRoom } from '../engine/rejoin';
import type { Session, SessionSnapshot } from '../engine/session';
import { getGame } from '../games';
import { gameName, useLang, useT } from '../i18n';

export function QrCode({ text, size = 168 }: { text: string; size?: number }) {
  const cells = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const dark: string[] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) dark.push(`M${c} ${r}h1v1h-1z`);
    return { n, d: dark.join('') };
  }, [text]);
  return (
    <svg className="qr" width={size} height={size} viewBox={`-2 -2 ${cells.n + 4} ${cells.n + 4}`} role="img" aria-label="QR code">
      <rect x={-2} y={-2} width={cells.n + 4} height={cells.n + 4} fill="#fff" />
      <path d={cells.d} fill="#111" shapeRendering="crispEdges" />
    </svg>
  );
}

export function VoiceBar({ session, snap }: { session: Session; snap: SessionSnapshot }) {
  const t = useT();
  const v = snap.voice;
  if (!session.voiceJoin || !v) return null;
  return (
    <div className="stack-sm">
      <div className="voice-bar">
        {v.on ? (
          <>
            {v.microphone ? (
              <button className={'btn small' + (v.muted ? '' : ' primary')} onClick={() => session.voiceMute?.(!v.muted)}>
                {v.muted ? t('🔇 Unmute') : t('🎙 Mute')}
              </button>
            ) : (
              <button className="btn small" onClick={() => session.voiceJoin?.()} disabled={v.pending}>
                🎙 {t('Turn on microphone')}
              </button>
            )}
            {session.cameraStart && (
              <button className={'btn small' + (v.camera ? ' primary' : '')} disabled={v.pending} onClick={() => (v.camera ? session.cameraStop?.() : session.cameraStart?.())}>
                📷 {v.camera ? t('Camera off') : t('Camera on')}
              </button>
            )}
            {session.screenStart && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia && (
              <button className={'btn small' + (v.screen ? ' primary' : '')} disabled={v.pending} onClick={() => (v.screen ? session.screenStop?.() : session.screenStart?.())}>
                🖥️ {v.screen ? t('Stop sharing') : t('Share screen')}
              </button>
            )}
            <button className="btn small ghost" onClick={() => session.voiceLeave?.()}>
              {t('Leave call')}
            </button>
          </>
        ) : (
          <>
            <button className="btn small" onClick={() => session.voiceJoin?.()} disabled={v.pending}>
              {t('🎙 Join voice chat')}
            </button>
            {session.voiceListen && (
              <button className="btn small ghost" onClick={() => session.voiceListen?.()}>
                🎧 {t('Just listen')}
              </button>
            )}
          </>
        )}
        {v.members.length > 0 && <span className="small muted">{t('In the call: {names}', { names: v.members.join(', ') })}</span>}
        {v.audioBlocked && (
          <button className="btn small" onClick={() => session.resumeAudio?.()}>
            🔊 {t('Tap to hear the call')}
          </button>
        )}
        {v.error && <span className="small notice">{t(v.error)}</span>}
      </div>
      <VideoTiles snap={snap} />
    </div>
  );
}

function Video({ stream, label, mirror }: { stream: MediaStream; label: string; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <figure className="video-tile">
      <video ref={ref} autoPlay playsInline muted style={mirror ? { transform: 'scaleX(-1)' } : undefined} />
      <figcaption className="small">{label}</figcaption>
    </figure>
  );
}

/** Cameras and shared screens of everyone in the call */
export function VideoTiles({ snap }: { snap: SessionSnapshot }) {
  const t = useT();
  const v = snap.voice;
  if (!v) return null;
  const tiles: { id: string; stream: MediaStream; label: string; mirror?: boolean }[] = [];
  if (v.localCamera) tiles.push({ id: 'me-cam', stream: v.localCamera, label: t('You'), mirror: true });
  if (v.localScreen) tiles.push({ id: 'me-screen', stream: v.localScreen, label: t('Your screen') });
  for (const x of v.videos ?? []) tiles.push({ id: x.id, stream: x.stream, label: x.kind === 'screen' ? t('{name}’s screen', { name: x.name }) : x.name });
  if (!tiles.length) return null;
  return (
    <div className="video-grid">
      {tiles.map((x) => (
        <Video key={x.id} stream={x.stream} label={x.label} mirror={x.mirror} />
      ))}
    </div>
  );
}

export function ReactionBar({ session }: { session: Session }) {
  const t = useT();
  if (!session.react) return null;
  return (
    <div className="react-bar" aria-label={t('Send a reaction')}>
      {REACTIONS.map((e) => (
        <button key={e} onClick={() => session.react?.(e)} aria-label={e}>
          {e}
        </button>
      ))}
    </div>
  );
}

/** Emojis floating up over the table for a few seconds */
export function ReactionsOverlay({ snap }: { snap: SessionSnapshot }) {
  const [now, setNow] = useState(Date.now());
  const recent = (snap.reactions ?? []).filter((r) => now - r.time - snap.clockOffset < 3500);
  useEffect(() => {
    if (!recent.length) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [recent.length]);
  // Re-check as soon as a new reaction arrives
  useEffect(() => setNow(Date.now()), [snap.reactions?.length]);
  return (
    <div className="react-overlay" aria-live="polite">
      {recent.map((r) => (
        <span key={r.id} className="react-float" style={{ left: `${10 + ((r.id * 37) % 80)}%` }}>
          <span className="react-emoji">{r.emoji}</span>
          <span className="react-name" style={r.seat !== null ? { color: `var(--p${r.seat})` } : undefined}>
            {r.name}
          </span>
        </span>
      ))}
    </div>
  );
}

/** For people watching a game: whose view to follow */
export function SpectatorBar({ session, snap }: { session: Session; snap: SessionSnapshot }) {
  const t = useT();
  if (snap.spectating === null || snap.spectating === undefined) return null;
  const game = getGame(snap.gameId);
  return (
    <div className="spectate-bar">
      <span>👀 {game?.hiddenInfo ? t('Watching over the shoulder of') : t('Watching as')}</span>
      <select className="input" value={snap.spectating} onChange={(e) => session.follow?.(Number(e.target.value))}>
        {snap.players.map((p, i) => (
          <option key={i} value={i}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/** After a refresh: offer to get back into the room this device was in */
export function RejoinBanner({ onStart }: { onStart: (s: Session) => void }) {
  const t = useT();
  const lang = useLang();
  const [hosted, setHosted] = useState(loadHostedRoom);
  const [guest, setGuest] = useState(loadLastRoom);
  // Don't offer a room that is still open in another tab of this browser
  useEffect(() => {
    let live = true;
    if (hosted) roomOpenElsewhere('host', hosted.code).then((open) => live && open && setHosted(null));
    if (guest) roomOpenElsewhere('guest', guest.code).then((open) => live && open && setGuest(null));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (hosted) {
    const g = getGame(hosted.gameId);
    return (
      <div className="rejoin-banner">
        <span>{t('You were hosting room {code} ({game}).', { code: hosted.code, game: g ? gameName(g, lang) : hosted.gameId })}</span>
        <button className="btn primary small" onClick={() => onStart(new HostSession(hosted.gameId, hosted.hostName, hosted))}>
          {t('Reopen room')}
        </button>
        <button
          className="btn ghost small"
          onClick={() => {
            saveHostedRoom(null);
            setHosted(null);
          }}
        >
          {t('Dismiss')}
        </button>
      </div>
    );
  }
  if (guest) {
    return (
      <div className="rejoin-banner">
        <span>{t('You were in room {code}.', { code: guest.code })}</span>
        <button className="btn primary small" onClick={() => onStart(new ClientSession(guest.code, guest.name))}>
          {t('Rejoin')}
        </button>
        <button
          className="btn ghost small"
          onClick={() => {
            saveLastRoom(null);
            setGuest(null);
          }}
        >
          {t('Dismiss')}
        </button>
      </div>
    );
  }
  return null;
}
