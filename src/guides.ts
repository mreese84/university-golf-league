import { useEffect, useState } from 'react';
import { deleteField, doc, onSnapshot, setDoc, writeBatch } from 'firebase/firestore';
import { collectionName } from './dataEnv';
import { db } from './firebase';
import type { GuideDraft, PlayerGuide } from './types';

// Guides are members-only, so they live outside the public app/data doc (see firestore.rules)
const GUIDES = collectionName('guides');
// Draft teams and pairings are admin-only until published into the guide
const DRAFTS = collectionName('guideDrafts');
const ACCESS = ['access', 'members'] as const;

export type LoadStatus = 'loading' | 'ready' | 'missing' | 'denied' | 'error';

interface Loaded<T> {
  key: string | null;
  status: LoadStatus;
  data: T | null;
}

export const statusFor = (err: { code: string }): LoadStatus =>
  err.code === 'permission-denied' ? 'denied' : 'error';

// Firestore stops a listener for good after an error (e.g. rules not published yet, or a
// member added to the list while their page is open), so retry with backoff up to 5 minutes.
export const retryDelay = (attempt: number) => Math.min(10_000 * 2 ** attempt, 300_000);

// Live copy of one document. `key` identifies the subscription (e.g. trip + user);
// pass null to stay idle. `retry` resubscribes right away.
export function useLiveDoc<T>(collection: string, id: string | null, key: string | null) {
  const [state, setState] = useState<Loaded<T>>({ key: null, status: 'loading', data: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id || !key) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = onSnapshot(
      doc(db, collection, id),
      (snap) =>
        setState({ key, status: snap.exists() ? 'ready' : 'missing', data: snap.exists() ? (snap.data() as T) : null }),
      (err) => {
        setState({ key, status: statusFor(err), data: null });
        timer = setTimeout(() => setAttempt((a) => a + 1), retryDelay(attempt));
      }
    );
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [collection, id, key, attempt]);

  const retry = () => setAttempt((a) => a + 1);
  if (!key || state.key !== key) return { status: 'loading' as LoadStatus, data: null, retry };
  return { status: state.status, data: state.data, retry };
}

// Subscribes to a trip's guide. Pass uid so the listener restarts after sign-in.
export function useGuide(tripId: string | null, uid: string | null) {
  const { status, data } = useLiveDoc<PlayerGuide>(GUIDES, tripId, tripId && uid ? `${tripId}:${uid}` : null);
  return { status, guide: data };
}

export function saveGuide(tripId: string, guide: PlayerGuide) {
  return setDoc(doc(db, GUIDES, tripId), guide);
}

export function deleteGuide(tripId: string) {
  const batch = writeBatch(db);
  batch.delete(doc(db, GUIDES, tripId));
  batch.delete(doc(db, DRAFTS, tripId));
  return batch.commit();
}

// ── Teams & pairings draft ──────────────────────────────────────

export const emptyDraft = (): GuideDraft => ({ published: false, handicaps: {}, captains: {}, teams: {}, rounds: {} });

// The admin's draft for a trip's guide (null until first saved)
export function useGuideDraft(tripId: string | null, isAdmin: boolean) {
  const { status, data, retry } = useLiveDoc<GuideDraft>(DRAFTS, tripId, tripId && isAdmin ? tripId : null);
  return { status, draft: data, retry };
}

// The guide with the draft's teams, captains, groups, and handicaps filled in
export function applyDraft(guide: PlayerGuide, draft: GuideDraft): PlayerGuide {
  return {
    ...guide,
    teams: guide.teams.map((t) => ({ ...t, memberIds: draft.teams[t.id] ?? [], captainId: draft.captains[t.id] ?? null })),
    rounds: guide.rounds.map((r) => ({
      ...r,
      groups: r.groups.map((g, i) => ({ ...g, playerIds: draft.rounds[r.id]?.[i]?.playerIds ?? [] })),
    })),
    handicaps: draft.handicaps,
  };
}

// The guide with teams, groups, and handicaps back to TBD
export function clearPairings(guide: PlayerGuide): PlayerGuide {
  return {
    ...guide,
    teams: guide.teams.map((t) => ({ ...t, memberIds: [], captainId: null })),
    rounds: guide.rounds.map((r) => ({ ...r, groups: r.groups.map((g) => ({ ...g, playerIds: [] })) })),
    handicaps: {},
  };
}

// Saves the draft and, in the same write, what members see: the draft if published, TBD if not
export function saveDraft(tripId: string, draft: GuideDraft, guide: PlayerGuide) {
  const batch = writeBatch(db);
  batch.set(doc(db, DRAFTS, tripId), draft);
  batch.set(doc(db, GUIDES, tripId), draft.published ? applyDraft(guide, draft) : clearPairings(guide));
  return batch.commit();
}

// Member emails that unlock guides ({ memberId: email }). Admin only.
export function useMemberEmails(isAdmin: boolean) {
  const { status, data } = useLiveDoc<{ byMember?: Record<string, string> }>(ACCESS[0], ACCESS[1], isAdmin ? 'admin' : null);
  // A missing doc just means no emails yet
  return { status: status === 'missing' ? ('ready' as LoadStatus) : status, emails: data?.byMember ?? {} };
}

export function setMemberEmail(memberId: string, email: string) {
  const value = email.trim().toLowerCase();
  return setDoc(doc(db, ...ACCESS), { byMember: { [memberId]: value || deleteField() } }, { merge: true });
}
