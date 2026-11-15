import { useEffect, useRef, useState } from 'react';
import { accountsEnabled, useAccount, wakeAccount } from '../account/account';
import { MAX_MESSAGE, acceptFriend, addFriend, blockFriend, openChat, removeFriend, sendMessage, useSocial, type Friend, type Message } from '../account/social';
import { useLang, useT } from '../i18n';
import { Avatar } from './Avatar';

/** Room invites look like ".../#/join/ABC123": show them as a button */
const JOIN = /(?:https?:\/\/\S+)?#\/join\/([A-Z0-9]{4,8})/;

function MessageText({ text }: { text: string }) {
  const t = useT();
  const m = text.match(JOIN);
  if (!m) return <>{text}</>;
  const before = text.slice(0, m.index).trim();
  return (
    <>
      {before && <>{before} </>}
      <a className="btn small primary" href={`#/join/${m[1]}`}>
        🎲 {t('Join room {code}', { code: m[1] })}
      </a>
    </>
  );
}

function Chat({ friend, me, onBack }: { friend: Friend; me: string; onBack: () => void }) {
  const t = useT();
  const lang = useLang();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => openChat(friend.pair, setMessages), [friend.pair]);
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async () => {
    const msg = text;
    if (!msg.trim()) return;
    setText('');
    const err = await sendMessage(friend.pair, msg);
    if (err) {
      setError(t(err));
      setText(msg);
    } else setError('');
  };

  const time = (at: number) => (at ? new Date(at).toLocaleString(lang, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : '');
  return (
    <div className="stack-sm dm">
      <div className="row dm-head">
        <button className="btn ghost small" onClick={onBack}>
          ← {t('Friends')}
        </button>
        <Avatar name={friend.name} avatar={friend.avatar} size={32} />
        <strong className="grow">{friend.name}</strong>
        <button className="btn ghost small" aria-expanded={menu} onClick={() => setMenu((x) => !x)}>
          ⋯
        </button>
      </div>
      {menu && (
        <div className="row wrap dm-menu">
          <button
            className="btn small"
            onClick={async () => {
              if (confirm(t('Remove {name} from your friends? Your messages with them are deleted too.', { name: friend.name }))) {
                await removeFriend(friend.pair);
                onBack();
              }
            }}
          >
            {t('Remove friend')}
          </button>
          <button
            className="btn small danger"
            onClick={async () => {
              if (confirm(t('Block {name}? They can’t message you or add you again, and your messages are deleted.', { name: friend.name }))) {
                await blockFriend(friend.pair);
                onBack();
              }
            }}
          >
            {t('Block')}
          </button>
        </div>
      )}
      <div className="dm-list" ref={list} aria-live="polite">
        {messages === null && <p className="small muted center">{t('Loading…')}</p>}
        {messages?.length === 0 && <p className="small muted center">{t('No messages yet. Say hi! 👋')}</p>}
        {messages?.map((m) => (
          <div key={m.id} className={'dm-msg' + (m.from === me ? ' mine' : '')}>
            <span className="dm-bubble">
              <MessageText text={m.text} />
            </span>
            <span className="dm-time">{time(m.at)}</span>
          </div>
        ))}
      </div>
      <form
        className="row dm-send"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input className="input grow" value={text} maxLength={MAX_MESSAGE} placeholder={t('Message {name}…', { name: friend.name })} onChange={(e) => setText(e.target.value)} />
        <button className="btn primary" type="submit" disabled={!text.trim()}>
          {t('Send')}
        </button>
      </form>
      {error && <p className="notice">{error}</p>}
      <p className="small muted">{t('Only you and {name} can read these messages. Be kind; if someone bothers you, block them.', { name: friend.name })}</p>
    </div>
  );
}

export function FriendsPage() {
  const t = useT();
  const acct = useAccount();
  const social = useSocial();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => wakeAccount(), []);

  const head = (
    <a href="#/" className="back">
      ← {t('All games')}
    </a>
  );
  if (!accountsEnabled()) return null;
  if (acct.status !== 'signed-in') {
    return (
      <div className="panel stack narrow">
        {head}
        <h1>{t('Friends')}</h1>
        <p>{acct.status === 'loading' ? t('Loading…') : t('Sign in on the profile page to add friends and send them messages.')}</p>
        {acct.status !== 'loading' && (
          <a className="btn primary" href="#/profile">
            {t('Go to profile')}
          </a>
        )}
      </div>
    );
  }

  const me = social.uid ?? '';
  const chat = social.friends.find((f) => f.pair === open && f.status === 'accepted');
  if (chat)
    return (
      <div className="panel stack">
        <Chat friend={chat} me={me} onBack={() => setOpen(null)} />
      </div>
    );

  const incoming = social.friends.filter((f) => f.status === 'pending' && f.from !== me);
  const outgoing = social.friends.filter((f) => f.status === 'pending' && f.from === me);
  const friends = social.friends.filter((f) => f.status === 'accepted');
  const blocked = social.friends.filter((f) => f.status === 'blocked');

  const act = async (fn: () => Promise<string | null>, ok = '') => {
    setBusy(true);
    const err = await fn();
    setBusy(false);
    setMsg(err ? t(err) : ok);
  };

  return (
    <div className="panel stack">
      {head}
      <h1>{t('Friends')}</h1>

      <section className="stack-sm friends-code">
        <span className="small muted">{t('Your friend code')}</span>
        <div className="row">
          <strong className="room-code">{social.code ?? '······'}</strong>
          {social.code && (
            <button
              className="btn small"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(social.code!);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  /* copy by hand */
                }
              }}
            >
              {copied ? t('Copied ✓') : t('Copy')}
            </button>
          )}
        </div>
        <span className="small muted">{t('Give it to friends so they can add you. Only people with your code can find you.')}</span>
      </section>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          void act(() => addFriend(code), t('Friend request sent ✓')).then(() => setCode(''));
        }}
      >
        <input className="input" value={code} placeholder={t('Friend’s code')} maxLength={8} autoCapitalize="characters" onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <button className="btn primary" type="submit" disabled={busy || code.trim().length < 6}>
          {t('Add friend')}
        </button>
      </form>
      {msg && <p className="small">{msg}</p>}

      {incoming.length > 0 && (
        <section className="stack-sm">
          <h2 className="section-title">{t('Friend requests')}</h2>
          {incoming.map((f) => (
            <div key={f.pair} className="friend-row">
              <Avatar name={f.name} avatar={f.avatar} size={36} />
              <strong className="grow">{f.name}</strong>
              <button className="btn small primary" disabled={busy} onClick={() => void act(() => acceptFriend(f.pair))}>
                {t('Accept')}
              </button>
              <button className="btn small ghost" disabled={busy} onClick={() => void act(() => removeFriend(f.pair))}>
                {t('Decline')}
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="stack-sm">
        <h2 className="section-title">
          {t('Friends')} ({friends.length})
        </h2>
        {!social.ready && <p className="small muted">{t('Loading…')}</p>}
        {social.ready && friends.length === 0 && <p className="small muted">{t('No friends yet. Share your code, or add a friend with theirs.')}</p>}
        {friends.map((f) => (
          <button key={f.pair} className={'friend-row clickable' + (f.unread ? ' unread' : '')} onClick={() => setOpen(f.pair)}>
            <Avatar name={f.name} avatar={f.avatar} size={36} />
            <span className="grow friend-text">
              <strong>{f.name}</strong>
              <span className="small muted">{f.last ? (f.last.from === me ? t('You: {text}', { text: f.last.text }) : f.last.text) : t('Say hi! 👋')}</span>
            </span>
            {f.unread && <span className="chat-badge static">●</span>}
          </button>
        ))}
      </section>

      {outgoing.length > 0 && (
        <section className="stack-sm">
          <h2 className="section-title">{t('Waiting for an answer')}</h2>
          {outgoing.map((f) => (
            <div key={f.pair} className="friend-row">
              <Avatar name={f.name} avatar={f.avatar} size={30} />
              <span className="grow">{f.name}</span>
              <button className="btn small ghost" disabled={busy} onClick={() => void act(() => removeFriend(f.pair))}>
                {t('Cancel')}
              </button>
            </div>
          ))}
        </section>
      )}

      {blocked.length > 0 && (
        <section className="stack-sm">
          <h2 className="section-title">{t('Blocked')}</h2>
          {blocked.map((f) => (
            <div key={f.pair} className="friend-row">
              <Avatar name={f.name} avatar={f.avatar} size={30} />
              <span className="grow">{f.name}</span>
              <button className="btn small ghost" disabled={busy} onClick={() => void act(() => removeFriend(f.pair))}>
                {t('Unblock')}
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

/** In a room: send the invite link to a friend */
export function InviteFriend({ link }: { link: string }) {
  const t = useT();
  const acct = useAccount();
  const social = useSocial();
  const [sent, setSent] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const friends = social.friends.filter((f) => f.status === 'accepted');
  if (acct.status !== 'signed-in' || !friends.length) return null;
  return (
    <div className="stack-sm">
      <button className="btn small" onClick={() => setOpen((x) => !x)}>
        📨 {t('Invite a friend')}
      </button>
      {open && (
        <div className="row wrap">
          {friends.map((f) => (
            <button
              key={f.pair}
              className="chip-btn"
              disabled={sent.includes(f.pair)}
              onClick={async () => {
                const err = await sendMessage(f.pair, `${t('Join my room!')} ${link}`);
                if (!err) setSent((s) => [...s, f.pair]);
              }}
            >
              <Avatar name={f.name} avatar={f.avatar} size={22} /> {f.name} {sent.includes(f.pair) ? '✓' : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
