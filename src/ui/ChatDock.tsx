import { useEffect, useRef, useState } from 'react';
import type { ChatMsg, Session, SessionSnapshot } from '../engine/session';
import type { Seat } from '../engine/types';
import { useT } from '../i18n';

const QUICK = ['👍', '😂', '😮', '😡', '👏', 'GG', 'İyi oyunlar!'];

function canVoteOn(snap: SessionSnapshot, seat: Seat) {
  const me = snap.localSeats[0];
  const p = snap.players[seat];
  return seat > 0 && seat !== me && p?.kind === 'remote' && p.connected !== false && !snap.vote;
}

/** Floating chat for online rooms, with a People tab to start a vote to remove someone */
export function ChatDock({ session, snap }: { session: Session; snap: SessionSnapshot }) {
  const t = useT();
  const chat = snap.chat ?? [];
  const me = snap.localSeats[0];
  const lastId = chat.length ? chat[chat.length - 1].id : 0;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'chat' | 'people'>('chat');
  const [text, setText] = useState('');
  const [seen, setSeen] = useState(lastId);
  const [peek, setPeek] = useState<ChatMsg | null>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setSeen(lastId);
  }, [open, lastId]);

  // Keep the newest message in view
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId, open, tab]);

  // Briefly show new messages from others while the chat is closed
  useEffect(() => {
    const last = chat[chat.length - 1];
    if (open || !last || last.system || last.seat === me || last.id <= seen) return;
    setPeek(last);
    const t = setTimeout(() => setPeek(null), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId]);

  const unread = chat.filter((m) => m.id > seen && !m.system && m.seat !== me).length;

  const send = (t: string) => {
    if (!t.trim()) return;
    session.sendChat?.(t);
    setText('');
  };

  if (!open) {
    return (
      <div className="chat-dock">
        {peek && (
          <button className="chat-peek" onClick={() => setOpen(true)}>
            <strong style={{ color: peek.seat !== null ? `var(--p${peek.seat})` : undefined }}>{peek.name}:</strong> {peek.text}
          </button>
        )}
        <button className="chat-fab" onClick={() => setOpen(true)} aria-label={t('Open chat') + (unread ? ` (${unread})` : '')}>
          💬{unread > 0 && <span className="chat-badge">{unread > 9 ? '9+' : unread}</span>}
        </button>
      </div>
    );
  }

  return (
    <div className="chat-dock">
      <section className="chat-panel" aria-label={t('Room chat')}>
        <div className="chat-head">
          <div className="tabs grow" role="tablist">
            <button role="tab" aria-selected={tab === 'chat'} className={tab === 'chat' ? 'tab on' : 'tab'} onClick={() => setTab('chat')}>
              {t('Chat')}
            </button>
            <button role="tab" aria-selected={tab === 'people'} className={tab === 'people' ? 'tab on' : 'tab'} onClick={() => setTab('people')}>
              {t('People')} ({snap.players.length})
            </button>
          </div>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label={t('Close')}>
            ✕
          </button>
        </div>

        {tab === 'chat' ? (
          <>
            <div className="chat-list" ref={list} aria-live="polite">
              {chat.length === 0 && <p className="muted small center">{t('No messages yet. Say hi!')}</p>}
              {chat.map((m) =>
                m.system ? (
                  <p key={m.id} className="chat-sys">
                    {t(m.text)}
                  </p>
                ) : (
                  <p key={m.id} className={'chat-msg' + (m.seat === me ? ' mine' : '')}>
                    <strong style={{ color: m.seat !== null ? `var(--p${m.seat})` : undefined }}>{m.seat === me ? t('You') : m.name}</strong> {m.text}
                  </p>
                ),
              )}
            </div>
            <div className="chat-quick">
              {QUICK.map((q) => (
                <button key={q} onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>
            <form
              className="chat-form"
              onSubmit={(e) => {
                e.preventDefault();
                send(text);
              }}
            >
              <input
                className="input"
                value={text}
                maxLength={200}
                placeholder={t('Message…')}
                aria-label={t('Message…')}
                onChange={(e) => setText(e.target.value)}
                // Don't let game keyboard shortcuts (Space to flap, digits in Sudoku) fire while typing
                onKeyDown={(e) => e.stopPropagation()}
                autoFocus
              />
              <button className="btn primary small" disabled={!text.trim()}>
                {t('Send')}
              </button>
            </form>
          </>
        ) : (
          <div className="chat-list">
            {snap.players.map((p, i) => (
              <div key={i} className="seat-row">
                <span className="seat-dot" style={{ background: `var(--p${i})` }} />
                <span className="grow">
                  {p.name}
                  {i === 0 && <span className="muted small"> · {t('host')}</span>}
                  {p.kind === 'bot' && <span className="muted small"> · {t('bot')}</span>}
                  {i === me && <span className="muted small"> · {t('you')}</span>}
                </span>
                {canVoteOn(snap, i) && (
                  <button className="btn ghost small" onClick={() => session.startVote?.(i)}>
                    {t('Vote to remove')}
                  </button>
                )}
              </div>
            ))}
            {(snap.spectators?.length ?? 0) > 0 && <p className="small muted">👀 {t('Watching: {names}', { names: snap.spectators!.join(', ') })}</p>}
            <p className="muted small">
              {t("A vote passes when more than half of the other people in the room agree. Removed players can't rejoin this room. The host can't be voted out, since the room runs in their browser.")}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

/** Shows a running vote to everyone, with Yes / No for those who may vote */
export function VoteBanner({ session, snap }: { session: Session; snap: SessionSnapshot }) {
  const t = useT();
  const v = snap.vote;
  const [, tick] = useState(0);
  useEffect(() => {
    if (!v) return;
    const t = setInterval(() => tick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, [v]);
  if (!v) return null;
  const me = snap.localSeats[0];
  const secs = Math.max(0, Math.ceil((v.endsAt + snap.clockOffset - Date.now()) / 1000));
  const mine = v.yes.includes(me) ? 'yes' : v.no.includes(me) ? 'no' : null;
  return (
    <div className="vote-banner" role="status">
      {me === v.target ? (
        <span>
          {t('{name} started a vote to remove you', { name: v.starter })} ({v.yes.length}/{v.needed}, {secs}s).
        </span>
      ) : (
        <>
          <span>
            {t('Remove {name}?', { name: v.targetName })} {v.yes.length}/{v.needed} · {secs}s
          </span>
          {v.voters.includes(me) && (
            <span className="row">
              <button className={'btn small' + (mine === 'yes' ? ' primary' : '')} onClick={() => session.castVote?.(true)}>
                {t('Yes')}
              </button>
              <button className={'btn small' + (mine === 'no' ? ' primary' : '')} onClick={() => session.castVote?.(false)}>
                {t('No')}
              </button>
            </span>
          )}
        </>
      )}
    </div>
  );
}
