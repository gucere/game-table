/**
 * Shared like counts, for sorting games by how many people like them.
 * Firestore: likes/{game}/by/{uid} marks a signed-in player's like; likeCounts/{game}.n is the
 * total. Both change together in one batch; the rules allow the count to move by one only.
 * Guests' likes stay on their device and aren't counted.
 */
import type { Fb } from './account';

async function hasLike(f: Fb, uid: string, game: string) {
  return (await f.store.getDoc(f.store.doc(f.db, 'likes', game, 'by', uid))).exists();
}

/** Makes the shared count match this player's like (or unlike) of a game */
export async function setSharedLike(f: Fb, uid: string, game: string, liked: boolean) {
  if ((await hasLike(f, uid, game)) === liked) return;
  const { writeBatch, doc, serverTimestamp, increment } = f.store;
  const b = writeBatch(f.db);
  const mine = doc(f.db, 'likes', game, 'by', uid);
  if (liked) b.set(mine, { at: serverTimestamp() });
  else b.delete(mine);
  b.set(doc(f.db, 'likeCounts', game), { n: increment(liked ? 1 : -1) }, { merge: true });
  await b.commit();
  counts = null;
}

/** After signing in or syncing: bring the shared counts in line with this account's likes */
export async function reconcileLikes(f: Fb, uid: string, likes: Record<string, number>) {
  for (const [game, v] of Object.entries(likes).slice(0, 120)) {
    if (!/^[a-z0-9-]{1,40}$/.test(game)) continue;
    try {
      await setSharedLike(f, uid, game, v > 0);
    } catch (e) {
      console.warn('Like sync failed', game, e);
    }
  }
}

/** Deleting the account: take back all of its likes */
export async function purgeLikes(f: Fb, uid: string, likes: Record<string, number>) {
  await reconcileLikes(f, uid, Object.fromEntries(Object.keys(likes).map((k) => [k, -1])));
}

// Totals, cached for a minute
let counts: { at: number; data: Record<string, number> } | null = null;

export async function likeCounts(f: Fb): Promise<Record<string, number>> {
  if (counts && Date.now() - counts.at < 60000) return counts.data;
  const snap = await f.store.getDocs(f.store.collection(f.db, 'likeCounts'));
  const data: Record<string, number> = {};
  snap.docs.forEach((d) => {
    const n = Number(d.data().n);
    if (Number.isFinite(n) && n > 0) data[d.id] = n;
  });
  counts = { at: Date.now(), data };
  return data;
}
