// Checks firebase/firestore.rules against the local Firestore emulator:
//   npm run test:rules
// (needs Java; the Firebase tools download the emulator the first time)
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-game-table',
  firestore: { rules: readFileSync('firebase/firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});

let passed = 0;
let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed++;
  } catch (e) {
    failed++;
    console.error('✗', name, '\n ', e.message);
  }
}

const A = 'alice';
const B = 'bob';
const C = 'carol';
const db = (uid) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const pair = `${A}_${B}`;
const fr = (uid, p = pair) => doc(db(uid), 'friendships', p);
const newRequest = (from = A) => ({ users: [A, B], status: 'pending', from, at: serverTimestamp(), last: null, read: {} });

// ---- players
await check('own profile can be saved and read', async () => {
  await assertSucceeds(setDoc(doc(db(A), 'players', A), { name: 'Alice', avatar: 'otter', picture: null, stats: {}, updatedAt: serverTimestamp() }));
  await assertSucceeds(getDoc(doc(db(A), 'players', A)));
});
await check('others cannot read or write a profile', async () => {
  await assertFails(getDoc(doc(db(B), 'players', A)));
  await assertFails(setDoc(doc(db(B), 'players', A), { name: 'x', avatar: 'fox', stats: {} }));
  await assertFails(getDoc(doc(db(null), 'players', A)));
});
await check('profile fields are checked', async () => {
  await assertFails(setDoc(doc(db(A), 'players', A), { name: '', avatar: 'fox', stats: {} }));
  await assertFails(setDoc(doc(db(A), 'players', A), { name: 'A', avatar: 'fox', stats: {}, admin: true }));
  await assertFails(setDoc(doc(db(A), 'players', A), { name: 'A', avatar: 'fox', stats: {}, picture: 'x'.repeat(20001) }));
});

// ---- codes and cards
await check('codes: claim your own, look one up, never steal or list', async () => {
  await assertSucceeds(setDoc(doc(db(A), 'codes', 'ABC234'), { uid: A }));
  await assertSucceeds(getDoc(doc(db(B), 'codes', 'ABC234')));
  await assertFails(setDoc(doc(db(B), 'codes', 'ABC234'), { uid: B }));
  await assertFails(setDoc(doc(db(B), 'codes', 'XYZ234'), { uid: A }));
  await assertFails(setDoc(doc(db(B), 'codes', 'bad'), { uid: B }));
  await assertFails(getDocs(collection(db(B), 'codes')));
  await assertFails(deleteDoc(doc(db(B), 'codes', 'ABC234')));
});
await check('cards: anyone signed in reads one, only the owner writes', async () => {
  await assertSucceeds(setDoc(doc(db(A), 'cards', A), { name: 'Alice', avatar: 'otter', code: 'ABC234' }));
  await assertSucceeds(getDoc(doc(db(B), 'cards', A)));
  await assertFails(getDoc(doc(db(null), 'cards', A)));
  await assertFails(getDocs(collection(db(B), 'cards')));
  await assertFails(setDoc(doc(db(B), 'cards', A), { name: 'Evil', avatar: 'fox', code: 'ABC234' }));
  await assertFails(setDoc(doc(db(A), 'cards', A), { name: 'Alice', avatar: 'fox', code: 'ABC234', email: 'a@b.c' }));
});

// ---- friendships
await check('a request can be sent only as yourself, with the right id', async () => {
  await assertFails(setDoc(fr(C), newRequest(A)));
  await assertFails(setDoc(fr(A, `${B}_${A}`), { ...newRequest(A), users: [B, A] }));
  await assertFails(setDoc(fr(A), { ...newRequest(A), status: 'accepted' }));
  await assertFails(setDoc(fr(A), newRequest(B)));
  await assertSucceeds(getDoc(fr(A)));
  await assertSucceeds(setDoc(fr(A), newRequest(A)));
});
await check('outsiders cannot see or touch it', async () => {
  await assertFails(getDoc(fr(C)));
  await assertFails(getDocs(query(collection(db(C), 'friendships'), where('users', 'array-contains', A))));
  await assertFails(deleteDoc(fr(C)));
  await assertSucceeds(getDocs(query(collection(db(A), 'friendships'), where('users', 'array-contains', A))));
});
await check('only the receiver accepts; no messages before that', async () => {
  await assertFails(addDoc(collection(db(A), 'friendships', pair, 'messages'), { from: A, text: 'hi', at: serverTimestamp() }));
  await assertFails(updateDoc(fr(A), { status: 'accepted' }));
  await assertSucceeds(updateDoc(fr(B), { status: 'accepted' }));
});
await check('friends can message; checks on sender, length and fields', async () => {
  const msgs = (uid) => collection(db(uid), 'friendships', pair, 'messages');
  await assertSucceeds(addDoc(msgs(A), { from: A, text: 'hi Bob', at: serverTimestamp() }));
  await assertSucceeds(addDoc(msgs(B), { from: B, text: 'hey', at: serverTimestamp() }));
  await assertFails(addDoc(msgs(A), { from: B, text: 'fake', at: serverTimestamp() }));
  await assertFails(addDoc(msgs(A), { from: A, text: 'x'.repeat(501), at: serverTimestamp() }));
  await assertFails(addDoc(msgs(A), { from: A, text: '', at: serverTimestamp() }));
  await assertFails(addDoc(msgs(A), { from: A, text: 'hi', at: serverTimestamp(), extra: 1 }));
  await assertFails(addDoc(msgs(C), { from: C, text: 'hi', at: serverTimestamp() }));
  await assertSucceeds(getDocs(msgs(B)));
  await assertFails(getDocs(msgs(C)));
});
await check('preview and read marks: only your own', async () => {
  await assertSucceeds(updateDoc(fr(A), { last: { from: A, text: 'hi Bob', at: serverTimestamp() }, [`read.${A}`]: serverTimestamp() }));
  await assertFails(updateDoc(fr(A), { last: { from: B, text: 'fake', at: serverTimestamp() } }));
  await assertFails(updateDoc(fr(A), { [`read.${B}`]: serverTimestamp() }));
  await assertFails(updateDoc(fr(A), { users: [A, C] }));
  await assertFails(updateDoc(fr(A), { status: 'pending' }));
});
await check('a block stops messages and can only be lifted by the blocker', async () => {
  await assertSucceeds(updateDoc(fr(B), { status: 'blocked', blockedBy: B }));
  await assertFails(addDoc(collection(db(A), 'friendships', pair, 'messages'), { from: A, text: 'hello?', at: serverTimestamp() }));
  await assertFails(deleteDoc(fr(A)));
  await assertFails(setDoc(fr(A), newRequest(A)));
  await assertFails(updateDoc(fr(A), { status: 'accepted' }));
  await assertSucceeds(deleteDoc(fr(B)));
});
await check('either friend can clear messages and remove the friendship', async () => {
  await assertSucceeds(setDoc(fr(A), newRequest(A)));
  await assertSucceeds(updateDoc(fr(B), { status: 'accepted' }));
  const m = await addDoc(collection(db(A), 'friendships', pair, 'messages'), { from: A, text: 'bye', at: serverTimestamp() });
  await assertFails(deleteDoc(doc(db(C), 'friendships', pair, 'messages', m.id)));
  await assertSucceeds(deleteDoc(doc(db(B), 'friendships', pair, 'messages', m.id)));
  await assertSucceeds(deleteDoc(fr(A)));
});
// ---- leaderboards
const lb = (uid, board = 'marti', who = uid) => doc(db(uid), 'leaderboards', board, 'scores', who);
const entry = (score, extra = {}) => ({ name: 'Alice', avatar: 'otter', score, at: serverTimestamp(), ...extra });
await check('leaderboards: anyone reads; you post your own best, only upwards', async () => {
  await assertSucceeds(setDoc(lb(A), entry(12)));
  await assertSucceeds(getDocs(collection(db(null), 'leaderboards', 'marti', 'scores')));
  await assertSucceeds(setDoc(lb(A), entry(20)));
  await assertFails(setDoc(lb(A), entry(5)));
  await assertFails(setDoc(lb(B, 'marti', A), entry(999, { name: 'Bob' })));
  await assertFails(setDoc(lb(null, 'marti', C), entry(3)));
  await assertSucceeds(deleteDoc(lb(A)));
});
await check('leaderboards: scores and fields are checked', async () => {
  await assertFails(setDoc(lb(A), entry(0)));
  await assertFails(setDoc(lb(A), entry(1.5)));
  await assertFails(setDoc(lb(A), entry(20000000)));
  await assertFails(setDoc(lb(A), entry(5, { email: 'a@b.c' })));
  await assertFails(setDoc(lb(A, 'Bad Board!'), entry(5)));
  await assertSucceeds(setDoc(lb(A, 'yilan~walls~90'), entry(5)));
});

// ---- likes and like counts
const like = (uid, game = 'go') => {
  const d = db(uid);
  const b = writeBatch(d);
  b.set(doc(d, 'likes', game, 'by', uid), { at: serverTimestamp() });
  b.set(doc(d, 'likeCounts', game), { n: increment(1) }, { merge: true });
  return b.commit();
};
const unlike = (uid, game = 'go') => {
  const d = db(uid);
  const b = writeBatch(d);
  b.delete(doc(d, 'likes', game, 'by', uid));
  b.set(doc(d, 'likeCounts', game), { n: increment(-1) }, { merge: true });
  return b.commit();
};
const count = async (game = 'go') => (await getDoc(doc(db(null), 'likeCounts', game))).data()?.n;
await check('likes: each player counts once; anyone can read the totals', async () => {
  await assertSucceeds(like(A));
  await assertSucceeds(like(B));
  if ((await count()) !== 2) throw new Error('count should be 2');
  await assertFails(like(A));
  await assertSucceeds(unlike(A));
  if ((await count()) !== 1) throw new Error('count should be 1');
  await assertFails(unlike(A));
  await assertSucceeds(getDocs(collection(db(null), 'likeCounts')));
});
await check('likes: the count can’t be changed on its own or by more than one', async () => {
  await assertFails(setDoc(doc(db(C), 'likeCounts', 'go'), { n: 100 }));
  await assertFails(updateDoc(doc(db(C), 'likeCounts', 'go'), { n: increment(1) }));
  await assertFails(setDoc(doc(db(C), 'likes', 'go', 'by', C), { at: serverTimestamp() }));
  const d = db(C);
  const b = writeBatch(d);
  b.set(doc(d, 'likes', 'go', 'by', C), { at: serverTimestamp() });
  b.set(doc(d, 'likeCounts', 'go'), { n: increment(5) }, { merge: true });
  await assertFails(b.commit());
  // Signed out
  const anon = db(null);
  const b3 = writeBatch(anon);
  b3.set(doc(anon, 'likes', 'go', 'by', 'nobody'), { at: serverTimestamp() });
  b3.set(doc(anon, 'likeCounts', 'go'), { n: increment(1) }, { merge: true });
  await assertFails(b3.commit());
  // Someone else's like can't be removed
  const e = db(C);
  const b2 = writeBatch(e);
  b2.delete(doc(e, 'likes', 'go', 'by', B));
  b2.set(doc(e, 'likeCounts', 'go'), { n: increment(-1) }, { merge: true });
  await assertFails(b2.commit());
});
await check('likes: a brand-new game starts at one', async () => {
  await assertSucceeds(like(C, 'xox'));
  if ((await count('xox')) !== 1) throw new Error('count should be 1');
  await assertFails(getDoc(doc(db(A), 'likes', 'xox', 'by', C)));
});

await check('everything else is closed', async () => {
  await assertFails(setDoc(doc(db(A), 'anything', 'x'), { a: 1 }));
  await assertFails(getDocs(collection(db(A), 'players')));
});

await env.cleanup();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
