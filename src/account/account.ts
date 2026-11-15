/**
 * Player accounts: sign in with Google or an email and password, and your profile, picture,
 * stats and achievements follow you to every device. Firebase is loaded only when needed
 * (opening the profile page, or on start-up for someone who is signed in).
 *
 * The account becomes a profile on the device ("acct_<uid>"); everything else (stats,
 * achievements, avatars in games) keeps working through the normal profile code.
 */
import { useSyncExternalStore } from 'react';
import { FIREBASE_CONFIG } from './config';
import { AVATARS, MAX_PICTURE, currentProfile, deleteProfile, getProfile, isSafePicture, onProfilesChange, upsertProfile, avatarById, type Profile } from '../profile/profile';
import { cleanStats, getStats, mergeStats, onStatsChange, restoreStats } from '../profile/stats';
import { getSettings } from '../theme/settings';

export type SyncState = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

export interface AccountState {
  /** off: accounts not set up on this site */
  status: 'off' | 'loading' | 'signed-out' | 'signed-in';
  uid?: string;
  email?: string;
  sync: SyncState;
  /** English message for the last thing that went wrong */
  error?: string;
}

const FLAG = 'oyun-masasi:account';
const profileId = (uid: string) => 'acct_' + uid;

let state: AccountState = { status: FIREBASE_CONFIG ? 'signed-out' : 'off', sync: 'idle' };
const listeners = new Set<() => void>();
function set(patch: Partial<AccountState>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

export function useAccount(): AccountState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
  );
}

export const accountsEnabled = () => !!FIREBASE_CONFIG;

// ---------------------------------------------------------------- Firebase, loaded on demand

type Fb = Awaited<ReturnType<typeof loadFirebase>>;
let fb: Promise<Fb> | null = null;

async function loadFirebase() {
  const [{ initializeApp }, auth, store] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore/lite')]);
  const app = initializeApp(FIREBASE_CONFIG!);
  return { auth, store, a: auth.getAuth(app), db: store.getFirestore(app) };
}

function firebase(): Promise<Fb> {
  if (!FIREBASE_CONFIG) return Promise.reject(new Error('Accounts are not set up.'));
  if (!fb) {
    set({ status: state.status === 'signed-in' ? 'signed-in' : 'loading' });
    fb = loadFirebase().then((f) => {
      f.auth.onAuthStateChanged(f.a, (user) => void onUser(f, user));
      return f;
    });
    fb.catch(() => {
      fb = null;
      set({ status: 'signed-out', error: 'Could not reach the account service. Check your connection.' });
    });
  }
  return fb;
}

/** Start-up: only load Firebase for people who were signed in */
export function initAccount() {
  if (!FIREBASE_CONFIG) return;
  try {
    if (localStorage.getItem(FLAG)) void firebase();
  } catch {
    /* storage unavailable */
  }
  // Pick up changes made on other devices when coming back to the tab
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.status === 'signed-in') void pull();
  });
}

/** Opening the profile page: make sure the sign-in state is known */
export function wakeAccount() {
  if (FIREBASE_CONFIG) void firebase();
}

// ---------------------------------------------------------------- Sync

let unsubs: (() => void)[] = [];
let saveTimer: ReturnType<typeof setTimeout> | null = null;
/** True while we're writing data we just pulled, so it isn't pushed straight back */
let applying = false;

interface Row {
  name: string;
  avatar: string;
  picture: string | null;
  stats: unknown;
}

async function readRow(f: Fb, uid: string): Promise<Row | null> {
  const snap = await f.store.getDoc(f.store.doc(f.db, 'players', uid));
  return snap.exists() ? (snap.data() as Row) : null;
}

function apply(uid: string, email: string, row: Row | null, seed: Profile | null) {
  applying = true;
  try {
    const id = profileId(uid);
    const local = getProfile(id);
    const name = typeof row?.name === 'string' && row.name.trim() ? row.name.slice(0, 20) : (local?.name ?? seed?.name ?? (getSettings().name || email.split('@')[0].slice(0, 20)));
    const avatar = row && avatarById(row.avatar) ? row.avatar : (local?.avatar ?? seed?.avatar ?? AVATARS[0].id);
    const picture = row ? (isSafePicture(row.picture) ? row.picture : undefined) : (local?.picture ?? seed?.picture);
    upsertProfile({ id, name, avatar, picture, createdAt: local?.createdAt ?? Date.now(), account: email }, true);
    const remote = row ? cleanStats(row.stats) : null;
    // First sign-in on this device: the profile you were using comes along
    const base = local ? getStats(id) : getStats(seed?.id ?? 'guest');
    restoreStats(id, remote ? mergeStats(base, remote) : base);
  } finally {
    applying = false;
  }
}

async function onUser(f: Fb, user: import('firebase/auth').User | null) {
  unsubs.forEach((u) => u());
  unsubs = [];
  if (!user) {
    set({ status: 'signed-out', uid: undefined, email: undefined, sync: 'idle' });
    return;
  }
  const email = user.email ?? '';
  const seed = currentProfile()?.account ? null : currentProfile();
  set({ status: 'signed-in', uid: user.uid, email, error: undefined });
  try {
    localStorage.setItem(FLAG, user.uid);
  } catch {
    /* ignore */
  }
  try {
    set({ sync: 'saving' });
    apply(user.uid, email, await readRow(f, user.uid), seed);
    await push();
  } catch (e) {
    console.warn('Account sync failed', e);
    set({ sync: navigator.onLine ? 'error' : 'offline' });
  }
  const later = () => {
    if (applying || state.uid !== user.uid) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void push(), 2500);
  };
  unsubs = [onStatsChange(later), onProfilesChange(later)];
}

async function push() {
  const uid = state.uid;
  if (!uid || !fb) return;
  const p = getProfile(profileId(uid));
  if (!p) return;
  set({ sync: 'saving' });
  try {
    const f = await fb;
    await f.store.setDoc(f.store.doc(f.db, 'players', uid), {
      name: p.name.trim().slice(0, 20) || 'Player',
      avatar: avatarById(p.avatar) ? p.avatar : AVATARS[0].id,
      picture: p.picture && p.picture.length <= MAX_PICTURE ? p.picture : null,
      stats: JSON.parse(JSON.stringify(getStats(profileId(uid)))),
      updatedAt: f.store.serverTimestamp(),
    });
    set({ sync: 'saved' });
  } catch (e) {
    console.warn('Account save failed', e);
    set({ sync: navigator.onLine ? 'error' : 'offline' });
    // Try again a bit later
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void push(), 30000);
  }
}

/** Fetch what other devices saved and merge it in */
async function pull() {
  const uid = state.uid;
  if (!uid || !fb) return;
  try {
    const f = await fb;
    const row = await readRow(f, uid);
    if (row) apply(uid, state.email ?? '', row, null);
  } catch {
    /* offline: try next time */
  }
}

// ---------------------------------------------------------------- Actions

const MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'That email address doesn’t look right.',
  'auth/missing-password': 'Type a password.',
  'auth/weak-password': 'Use a password of at least 6 characters.',
  'auth/email-already-in-use': 'There is already an account with this email. Sign in instead.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'Wrong email or password.',
  'auth/too-many-requests': 'Too many tries. Wait a little and try again.',
  'auth/popup-blocked': 'The sign-in window was blocked. Allow pop-ups for this site and try again.',
  'auth/popup-closed-by-user': '',
  'auth/cancelled-popup-request': '',
  'auth/network-request-failed': 'Could not reach the account service. Check your connection.',
  'auth/requires-recent-login': 'For safety, sign out and sign in again, then delete your account.',
  'auth/unauthorized-domain': 'This website address isn’t allowed to sign in yet (see Authorized domains in the README).',
};

function fail(e: unknown) {
  const code = (e as { code?: string })?.code ?? '';
  const msg = code in MESSAGES ? MESSAGES[code] : 'Something went wrong. Try again.';
  if (!(code in MESSAGES)) console.warn(e);
  set({ error: msg || undefined });
}

async function run(fn: (f: Fb) => Promise<unknown>) {
  set({ error: undefined });
  try {
    await fn(await firebase());
    return true;
  } catch (e) {
    fail(e);
    return false;
  }
}

export const signInWithGoogle = () => run((f) => f.auth.signInWithPopup(f.a, new f.auth.GoogleAuthProvider()));
export const signInWithEmail = (email: string, password: string) => run((f) => f.auth.signInWithEmailAndPassword(f.a, email.trim(), password));
export const createAccount = (email: string, password: string) => run((f) => f.auth.createUserWithEmailAndPassword(f.a, email.trim(), password));
export const resetPassword = (email: string) => run((f) => f.auth.sendPasswordResetEmail(f.a, email.trim()));

/** Signing out also removes the account's copy from this device (it stays in the account) */
export async function signOut() {
  const uid = state.uid;
  if (saveTimer) clearTimeout(saveTimer);
  if (uid) await push();
  await run((f) => f.auth.signOut(f.a));
  forget(uid);
}

function forget(uid: string | undefined) {
  if (uid) deleteProfile(profileId(uid));
  try {
    localStorage.removeItem(FLAG);
  } catch {
    /* ignore */
  }
}

export async function deleteAccount() {
  const uid = state.uid;
  if (!uid) return false;
  if (saveTimer) clearTimeout(saveTimer);
  const ok = await run(async (f) => {
    const user = f.a.currentUser;
    if (!user) return;
    await f.store.deleteDoc(f.store.doc(f.db, 'players', uid));
    await f.auth.deleteUser(user);
  });
  if (ok) forget(uid);
  return ok;
}
