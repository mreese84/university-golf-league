import { useEffect, useState } from 'react';
import { collection, doc, increment, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { collectionName } from './dataEnv';
import { db } from './firebase';
import { retryDelay, statusFor, type LoadStatus } from './guides';

// Fireball shots per player per trip, members only (see firestore.rules): one document per
// player at fireball/{tripId}/players/{memberId}, so players logging at once never collide.
// The dev data uses fireball-dev.
const FIREBALL = collectionName('fireball');

// Shots logged away from golf (nights out, the game) go in this bucket; the others are round ids
export const OFF_COURSE = 'off';

export type ShotCounts = Record<string, Record<string, number>>; // memberId -> bucket -> shots

interface Loaded {
  key: string | null;
  status: LoadStatus;
  counts: ShotCounts;
}

// Everyone's counts for a trip, live. Pass uid so the listener restarts after sign-in; like the
// guide, it retries with backoff after an error (e.g. before the rules are published).
export function useFireball(tripId: string, uid: string | null) {
  const key = uid ? `${tripId}:${uid}` : null;
  const [state, setState] = useState<Loaded>({ key: null, status: 'loading', counts: {} });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!key) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = onSnapshot(
      collection(db, FIREBALL, tripId, 'players'),
      (snap) =>
        setState({
          key,
          status: 'ready',
          counts: Object.fromEntries(snap.docs.map((d) => [d.id, (d.data().counts ?? {}) as Record<string, number>])),
        }),
      (err) => {
        // Keep showing the last counts if the connection drops after loading
        setState((prev) => (prev.key === key && prev.status === 'ready' ? prev : { key, status: statusFor(err), counts: {} }));
        timer = setTimeout(() => setAttempt((a) => a + 1), retryDelay(attempt));
      },
    );
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [tripId, key, attempt]);

  if (!key || state.key !== key) return { status: 'loading' as LoadStatus, counts: {} as ShotCounts };
  return { status: state.status, counts: state.counts };
}

// Adds (or with -1, takes back) a shot. Shows on screen right away; with no signal it saves
// once the phone reconnects, as long as the page stays open.
export function addShots(tripId: string, memberId: string, bucket: string, delta: number) {
  return setDoc(
    doc(db, FIREBALL, tripId, 'players', memberId),
    { counts: { [bucket]: increment(delta) }, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
