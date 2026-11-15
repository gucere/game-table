/**
 * Friends and messages for signed-in players.
 *
 * Firestore layout (rules in firebase/firestore.rules):
 * - codes/{CODE}            { uid }                      friend code → player (anyone signed in can look one up)
 * - cards/{uid}             { name, avatar, code }       what others see of you (no picture, no email)
 * - friendships/{a_b}       { users:[a,b], status, from, at, last, read, blockedBy? }
 * - friendships/{a_b}/messages/{id}  { from, text, at }  only the two friends can read; only while friends
 */
import { useSyncExternalStore } from 'react';
import type { Fb } from './account';
import { avatarById, getProfile, onProfilesChange } from '../profile/profile';
import { playSound } from '../ui/sound';
import { showToast } from '../ui/Avatar';

export interface Friend {
  pair: string;
  uid: string;
  name: string;
  avatar: string;
  status: 'pending' | 'accepted' | 'blocked';
  /** Who sent the request */
  from: string;
  blockedBy?: string;
  last: { from: string; text: string; at: number } | null;
  unread: boolean;
}

export interface Message {
  id: string;
  from: string;
  text: string;
  at: number;
}

interface SocialState {
  ready: boolean;
  uid: string | null;
  code: string | null;
  friends: Friend[];
  unread: number;
}

let state: SocialState = { ready: false, uid: null, code: null, friends: [], unread: 0 };
const listeners = new Set<() => void>();
function set(patch: Partial<SocialState>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

export function useSocial(): SocialState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
  );
}

export const pairId = (a: string, b: string) => (a < b ? `${a}_${b}` : `${b}_${a}`);
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
export const MAX_MESSAGE = 500;

let fb: Fb | null = null;
let unsubs: (() => void)[] = [];
const cards = new Map<string, { name: string; avatar: string }>();
/** The chat open on screen right now (its messages count as read) */
let viewing: string | null = null;
/** Last message time we already announced, per friendship */
const announced = new Map<string, number>();

const ms = (t: unknown) => (t && typeof (t as { toMillis?: () => number }).toMillis === 'function' ? (t as { toMillis: () => number }).toMillis() : 0);

function myCard() {
  const p = state.uid ? getProfile('acct_' + state.uid) : null;
  return p ? { name: p.name.trim().slice(0, 20) || 'Player', avatar: avatarById(p.avatar) ? p.avatar : 'fox' } : null;
}

async function ensureCard(f: Fb, uid: string) {
  const { doc, getDoc, setDoc } = f.store;
  const snap = await getDoc(doc(f.db, 'cards', uid));
  let code = snap.exists() ? String(snap.data().code ?? '') : '';
  if (!code) {
    // Pick a free code: writing over someone else's is refused by the rules, so try another
    for (let k = 0; k < 8 && !code; k++) {
      const c = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
      try {
        await setDoc(doc(f.db, 'codes', c), { uid });
        code = c;
      } catch {
        /* taken: try again */
      }
    }
    if (!code) throw new Error('no code');
  }
  const mine = myCard();
  const old = snap.exists() ? snap.data() : null;
  if (mine && (!old || old.name !== mine.name || old.avatar !== mine.avatar || old.code !== code)) await setDoc(doc(f.db, 'cards', uid), { ...mine, code });
  set({ code });
}

async function loadCard(uid: string) {
  if (!fb || cards.has(uid)) return;
  try {
    const snap = await fb.store.getDoc(fb.store.doc(fb.db, 'cards', uid));
    const d = snap.exists() ? snap.data() : null;
    cards.set(uid, { name: typeof d?.name === 'string' ? d.name.slice(0, 20) : '?', avatar: typeof d?.avatar === 'string' ? d.avatar : '' });
  } catch {
    cards.set(uid, { name: '?', avatar: '' });
  }
}

export function startSocial(f: Fb, uid: string) {
  stopSocial();
  fb = f;
  cards.clear();
  set({ uid, ready: false, friends: [], unread: 0, code: null });
  void ensureCard(f, uid).catch((e) => console.warn('Friend code failed', e));
  // Keep the card in step with the profile's name and avatar
  let cardTimer: ReturnType<typeof setTimeout> | null = null;
  unsubs.push(
    onProfilesChange(() => {
      if (cardTimer) clearTimeout(cardTimer);
      cardTimer = setTimeout(() => {
        if (fb && state.uid === uid) void ensureCard(fb, uid).catch(() => {});
      }, 2000);
    }),
  );
  const { collection, query, where, onSnapshot } = f.store;
  let first = true;
  unsubs.push(
    onSnapshot(
      query(collection(f.db, 'friendships'), where('users', 'array-contains', uid)),
      async (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, data: d.data({ serverTimestamps: 'estimate' }) }));
        await Promise.all(rows.map((r) => loadCard((r.data.users as string[]).find((u) => u !== uid) ?? '')));
        const friends: Friend[] = [];
        for (const { id, data } of rows) {
          const other = (data.users as string[]).find((u) => u !== uid) ?? '';
          // Someone who blocked you just disappears from your list
          if (data.status === 'blocked' && data.blockedBy !== uid) continue;
          const card = cards.get(other) ?? { name: '?', avatar: '' };
          const last = data.last && typeof data.last === 'object' ? { from: String(data.last.from), text: String(data.last.text ?? ''), at: ms(data.last.at) } : null;
          const readAt = ms((data.read ?? {})[uid]);
          const unread = !!last && last.from !== uid && last.at > readAt && viewing !== id && data.status === 'accepted';
          friends.push({ pair: id, uid: other, name: card.name, avatar: card.avatar, status: data.status, from: data.from, blockedBy: data.blockedBy, last, unread });
          // Tell about new messages and requests that came in while we were here
          const stamp = last?.at ?? ms(data.at);
          if (!first && (announced.get(id) ?? 0) < stamp && viewing !== id) {
            if (unread) {
              playSound('chat');
              showToast('💬', card.name, last!.text);
            } else if (data.status === 'pending' && data.from !== uid) {
              playSound('chat');
              showToast('👋', 'Friend request', card.name);
            }
          }
          announced.set(id, stamp);
        }
        first = false;
        friends.sort((a, b) => (b.last?.at ?? 0) - (a.last?.at ?? 0) || a.name.localeCompare(b.name));
        set({ friends, ready: true, unread: friends.filter((x) => x.unread).length + friends.filter((x) => x.status === 'pending' && x.from !== uid).length });
      },
      (e) => console.warn('Friends list failed', e),
    ),
  );
}

export function stopSocial() {
  unsubs.forEach((u) => u());
  unsubs = [];
  fb = null;
  viewing = null;
  announced.clear();
  set({ ready: false, uid: null, code: null, friends: [], unread: 0 });
}

// ---------------------------------------------------------------- Actions (each returns an English error or null)

function need(): [Fb, string] {
  if (!fb || !state.uid) throw new Error('Sign in first.');
  return [fb, state.uid];
}

async function attempt(fn: () => Promise<string | null | void>): Promise<string | null> {
  try {
    return (await fn()) ?? null;
  } catch (e) {
    console.warn(e);
    const msg = (e as Error)?.message;
    return msg === 'Sign in first.' ? msg : 'Something went wrong. Try again.';
  }
}

export const addFriend = (raw: string) =>
  attempt(async () => {
    const [f, me] = need();
    const code = normalizeCode(raw);
    if (code.length !== 6) return 'A friend code has 6 letters and numbers.';
    if (code === state.code) return 'That’s your own code.';
    const { doc, getDoc, setDoc, updateDoc, serverTimestamp } = f.store;
    const found = await getDoc(doc(f.db, 'codes', code));
    const other = found.exists() ? String(found.data().uid) : '';
    if (!other) return 'No one has that code. Check it and try again.';
    const pair = pairId(me, other);
    const existing = await getDoc(doc(f.db, 'friendships', pair));
    if (existing.exists()) {
      const d = existing.data();
      if (d.status === 'accepted') return 'You are already friends.';
      if (d.status === 'blocked') return 'You can’t add this person.';
      if (d.from === me) return 'Request already sent. Waiting for them to accept.';
      await updateDoc(doc(f.db, 'friendships', pair), { status: 'accepted' });
      return null;
    }
    const users = [me, other].sort();
    await setDoc(doc(f.db, 'friendships', pair), { users, status: 'pending', from: me, at: serverTimestamp(), last: null, read: {} });
    return null;
  });

export const acceptFriend = (pair: string) =>
  attempt(async () => {
    const [f] = need();
    await f.store.updateDoc(f.store.doc(f.db, 'friendships', pair), { status: 'accepted' });
  });

async function clearMessages(f: Fb, pair: string) {
  const { collection, getDocs, writeBatch } = f.store;
  for (let round = 0; round < 20; round++) {
    const snap = await getDocs(collection(f.db, 'friendships', pair, 'messages'));
    if (snap.empty) return;
    const batch = writeBatch(f.db);
    snap.docs.slice(0, 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (snap.size <= 400) return;
  }
}

/** Decline a request, cancel your own, remove a friend or unblock: the friendship and its messages go */
export const removeFriend = (pair: string) =>
  attempt(async () => {
    const [f] = need();
    await clearMessages(f, pair);
    await f.store.deleteDoc(f.store.doc(f.db, 'friendships', pair));
  });

export const blockFriend = (pair: string) =>
  attempt(async () => {
    const [f, me] = need();
    await clearMessages(f, pair);
    await f.store.updateDoc(f.store.doc(f.db, 'friendships', pair), { status: 'blocked', blockedBy: me });
  });

export const sendMessage = (pair: string, raw: string) =>
  attempt(async () => {
    const [f, me] = need();
    const text = raw.trim().slice(0, MAX_MESSAGE);
    if (!text) return null;
    const { addDoc, collection, doc, updateDoc, serverTimestamp } = f.store;
    await addDoc(collection(f.db, 'friendships', pair, 'messages'), { from: me, text, at: serverTimestamp() });
    await updateDoc(doc(f.db, 'friendships', pair), { last: { from: me, text: text.slice(0, 80), at: serverTimestamp() }, [`read.${me}`]: serverTimestamp() });
  });

function markRead(pair: string) {
  const f = fb;
  const me = state.uid;
  const row = state.friends.find((x) => x.pair === pair);
  if (!f || !me || !row?.unread) return;
  set({ friends: state.friends.map((x) => (x.pair === pair ? { ...x, unread: false } : x)), unread: Math.max(0, state.unread - 1) });
  void f.store.updateDoc(f.store.doc(f.db, 'friendships', pair), { [`read.${me}`]: f.store.serverTimestamp() }).catch(() => {});
}

/** Live messages of one chat (the latest 100); marks them read while open */
export function openChat(pair: string, onMessages: (m: Message[]) => void): () => void {
  const f = fb;
  if (!f) return () => {};
  viewing = pair;
  markRead(pair);
  const { collection, query, orderBy, limitToLast, onSnapshot } = f.store;
  const stop = onSnapshot(
    query(collection(f.db, 'friendships', pair, 'messages'), orderBy('at'), limitToLast(100)),
    (snap) => {
      onMessages(
        snap.docs.map((d) => {
          const x = d.data({ serverTimestamps: 'estimate' });
          return { id: d.id, from: String(x.from), text: String(x.text ?? ''), at: ms(x.at) };
        }),
      );
      markRead(pair);
    },
    (e) => console.warn('Chat failed', e),
  );
  return () => {
    stop();
    if (viewing === pair) viewing = null;
  };
}

/** Deleting the account: remove friendships, messages, the friend code and the card */
export async function purgeSocial() {
  const f = fb;
  const me = state.uid;
  if (!f || !me) return;
  const { collection, query, where, getDocs, doc, deleteDoc } = f.store;
  const snap = await getDocs(query(collection(f.db, 'friendships'), where('users', 'array-contains', me)));
  for (const d of snap.docs) {
    try {
      await clearMessages(f, d.id);
      await deleteDoc(d.ref);
    } catch {
      /* a block by the other person can't be removed by us; it only holds two ids */
    }
  }
  if (state.code) await deleteDoc(doc(f.db, 'codes', state.code)).catch(() => {});
  await deleteDoc(doc(f.db, 'cards', me)).catch(() => {});
  stopSocial();
}
