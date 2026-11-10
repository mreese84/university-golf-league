// Live reads of the Phase 1 layout, for the pages built in later steps. Each takes the signed-in
// user's uid so its listener restarts after signing in, and retries after an error, like the guide's
// (see useLiveDoc in src/guides.ts).

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, type WhereFilterOp } from 'firebase/firestore';
import { dataEnv } from '../dataEnv';
import { db } from '../firebase';
import { retryDelay, statusFor, useLiveDoc, type LoadStatus } from '../guides';
import { normalizeEmail, pathsFor } from './paths';
import { JOINED_STATUSES, type Chapter, type Login, type Person, type RosterEntry, type Trip } from './types';

const P = pathsFor(dataEnv);

type Filter = [field: string, op: WhereFilterOp, value: unknown];

interface LoadedList<T> {
  key: string | null;
  status: LoadStatus;
  items: (T & { id: string })[];
}

// Live copy of a collection, optionally filtered. `key` identifies the subscription; null stays idle.
export function useLiveCollection<T>(path: string | null, key: string | null, filters: Filter[] = []) {
  const [state, setState] = useState<LoadedList<T>>({ key: null, status: 'loading', items: [] });
  const [attempt, setAttempt] = useState(0);
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    if (!path || !key) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const parsed = JSON.parse(filterKey) as Filter[];
    const q = query(collection(db, path), ...parsed.map(([field, op, value]) => where(field, op, value)));
    const unsubscribe = onSnapshot(
      q,
      (snap) => setState({ key, status: 'ready', items: snap.docs.map((d) => ({ ...(d.data() as T), id: d.id })) }),
      (err) => {
        // Keep showing the last copy if the connection drops after loading
        setState((prev) => (prev.key === key && prev.status === 'ready' ? prev : { key, status: statusFor(err), items: [] }));
        timer = setTimeout(() => setAttempt((a) => a + 1), retryDelay(attempt));
      },
    );
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [path, key, filterKey, attempt]);

  if (!key || state.key !== key) return { status: 'loading' as LoadStatus, items: [] as (T & { id: string })[] };
  return { status: state.status, items: state.items };
}

// The signed-in person: their email's login, then their record. `missing` means they're signed in
// but not in the league yet (no chapter has added them).
export function useSignedInPerson(email: string | null, uid: string | null) {
  const login = useLiveDoc<Login>(P.logins, email ? normalizeEmail(email) : null, email && uid ? `${email}:${uid}` : null);
  const personId = login.data?.personId ?? null;
  const person = useLiveDoc<Person>(P.people, personId, personId && uid ? `${personId}:${uid}` : null);
  if (login.status !== 'ready') return { status: login.status, personId: null, person: null };
  return { status: person.status, personId, person: person.data };
}

export function usePerson(personId: string | null, uid: string | null) {
  const { status, data } = useLiveDoc<Person>(P.people, personId, personId && uid ? `${personId}:${uid}` : null);
  return { status, person: data };
}

export function useChapter(chapterId: string | null, uid: string | null) {
  const { status, data } = useLiveDoc<Chapter>(P.chapters, chapterId, chapterId && uid ? `${chapterId}:${uid}` : null);
  return { status, chapter: data };
}

// A chapter's roster. Members may only ask for people who've joined; organizers and admins can
// include invitees.
export function useRoster(chapterId: string | null, uid: string | null, includeInvitees: boolean) {
  const filters: Filter[] = includeInvitees ? [] : [['status', 'in', [...JOINED_STATUSES]]];
  const key = chapterId && uid ? `${chapterId}:${uid}:${includeInvitees}` : null;
  const { status, items } = useLiveCollection<RosterEntry>(chapterId ? P.roster(chapterId) : null, key, filters);
  return { status, roster: items };
}

export function useTrips(chapterId: string | null, uid: string | null) {
  const key = chapterId && uid ? `${chapterId}:${uid}` : null;
  const { status, items } = useLiveCollection<Trip>(chapterId ? P.trips(chapterId) : null, key);
  return { status, trips: items };
}
