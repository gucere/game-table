import { useEffect, useRef, useState } from 'react';
import { playSound } from './sound';
import type { ChatMsg, Session, SessionSnapshot } from '../engine/session';
import type { Seat } from '../engine/types';
import { useT } from '../i18n';
import { getGame } from '../games';
import { toggleHidden, useHidden } from './hidden';

const QUICK = ['👍', '😂', '😮', '😡', '👏', 'GG', 'İyi oyunlar!'];

/** The emoji picker, grouped */
const EMOJI: [string, string][] = [
  ['Faces', '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 😜 🤪 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😌 😔 😪 😴 😷 🤒 🤕 🤢 🥵 🥶 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 💀 🤡 👻 👽 🤖 💩'],
  ['Hands', '👍 👎 👏 🙌 👐 🤝 🙏 ✌️ 🤞 🤟 🤘 👌 🤌 👈 👉 👆 👇 ☝️ ✋ 🤚 👋 💪 🫶 ✍️'],
  ['Love', '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝'],
  ['Games', '🎉 🎊 🏆 🥇 🥈 🥉 🎯 🎲 🃏 ♠️ ♥️ ♦️ ♣️ 🀄 ♟️ 🎮 🧩 ⚽ 🏀 🎳 🔥 ⭐ ✨ 💯 ✅ ❌ ⏳ 💤 💡 🍀'],
  ['Food', '☕ 🍵 🧋 🍕 🍔 🍟 🌭 🥙 🍿 🍩 🍪 🎂 🍰 🍫 🍬 🍉 🍓 🍒 🍌 🍎 🥨 🧀 🍻 🥂'],
  ['Animals', '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🦆 🦉 🐺 🐴 🦄 🐝 🦋 🐢 🐍 🐙 🐬 🐳'],
];

const formatSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

function canVoteOn(snap: SessionSnapshot, seat: Seat) {
  const me = snap.localSeats[0];
  const p = snap.players[seat];
  return seat > 0 && seat !== me && p?.kind === 'remote' && p.connected !== false && !snap.vote;
}

/** Floating chat for online rooms, with a People tab to start a vote to remove someone */
export function ChatDock({ session, snap }: { session: Session; snap: SessionSnapshot }) {
  const t = useT();
  const hidden = useHidden();
  // Hidden people's messages stay hidden on this device
  const chat = (snap.chat ?? []).filter((m) => m.system || !hidden.has(m.name));
  const me = snap.localSeats[0];
  const game = getGame(snap.gameId);
  const chatAllowed = snap.phase !== 'playing' || !game?.canChat || !snap.views[me] || game.canChat(snap.views[me]);
  const lastId = chat.length ? chat[chat.length - 1].id : 0;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'chat' | 'people'>('chat');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const attachments = snap.attachments ?? {};
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

  // A soft sound for new messages from others
  const heard = useRef(lastId);
  useEffect(() => {
    const last = chat[chat.length - 1];
    if (last && last.id > heard.current && !last.system && last.seat !== me && last.name !== snap.players[me]?.name) playSound('chat');
    heard.current = lastId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId]);

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
    if (!t.trim() || !chatAllowed) return;
    session.sendChat?.(t);
    setText('');
    setEmojiOpen(false);
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
                  <div key={m.id} className={'chat-msg' + (m.seat === me ? ' mine' : '')}>
                    <strong style={{ color: m.seat !== null ? `var(--p${m.seat})` : undefined }}>{m.seat === me ? t('You') : m.name}</strong>{' '}
                    {m.attachment ? (
                      attachments[m.attachment.id] ? (
                        attachments[m.attachment.id].preview ? (
                          <a href={attachments[m.attachment.id].url} target="_blank" rel="noreferrer" className="chat-image">
                            <img src={attachments[m.attachment.id].url} alt={m.attachment.name} />
                          </a>
                        ) : (
                          <a href={attachments[m.attachment.id].url} download={m.attachment.name} className="chat-file">
                            📎 {m.attachment.name} <span className="muted small">({formatSize(m.attachment.size)})</span>
                          </a>
                        )
                      ) : Date.now() - (m.time + snap.clockOffset) > 30000 ? (
                        // Sent before this person joined (files aren't kept for latecomers)
                        <span className="muted small">📎 {m.attachment.name} · {t('not available')}</span>
                      ) : (
                        <span className="muted small">📎 {m.attachment.name} · {t('receiving…')}</span>
                      )
                    ) : (
                      m.text
                    )}
                  </div>
                ),
              )}
            </div>
            {snap.fileProgress && (
              <p className="small muted chat-progress">
                {t('Sending {name}… {p}%', { name: snap.fileProgress.name, p: Math.round((snap.fileProgress.sent / snap.fileProgress.total) * 100) })}
              </p>
            )}
            {snap.fileError && <p className="small notice">{t(snap.fileError)}</p>}
            {emojiOpen && (
              <div className="emoji-picker" role="dialog" aria-label={t('Emoji')}>
                {EMOJI.map(([group, list]) => (
                  <div key={group}>
                    <p className="small muted">{t(group)}</p>
                    <div className="emoji-grid">
                      {list.split(' ').map((e) => (
                        <button key={e} type="button" onClick={() => setText((x) => (x + e).slice(0, 200))} aria-label={e}>
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="chat-quick">
              {QUICK.map((q) => (
                <button key={q} disabled={!chatAllowed} onClick={() => send(q)}>
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
              <button type="button" className="icon-btn" aria-label={t('Emoji')} aria-expanded={emojiOpen} onClick={() => setEmojiOpen((o) => !o)} disabled={!chatAllowed}>
                😀
              </button>
              {session.sendFile && (
                <>
                  <button type="button" className="icon-btn" aria-label={t('Send a picture or file')} title={t('Send a picture or file (up to 8 MB)')} onClick={() => fileInput.current?.click()} disabled={!chatAllowed || !!snap.fileProgress}>
                    📎
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void session.sendFile?.(f);
                    }}
                  />
                </>
              )}
              <input
                className="input"
                value={text}
                disabled={!chatAllowed}
                maxLength={200}
                placeholder={t('Message…')}
                aria-label={t('Message…')}
                onChange={(e) => setText(e.target.value)}
                // Don't let game keyboard shortcuts (Space to flap, digits in Sudoku) fire while typing
                onKeyDown={(e) => e.stopPropagation()}
                autoFocus
              />
              <button className="btn primary small" disabled={!text.trim() || !chatAllowed}>
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
                {i !== me && p.kind !== 'bot' && (
                  <button className="btn ghost small" onClick={() => toggleHidden(p.name, session)} title={t('Hide their messages, video and voice on this device')}>
                    {hidden.has(p.name) ? t('Show') : t('Hide')}
                  </button>
                )}
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
