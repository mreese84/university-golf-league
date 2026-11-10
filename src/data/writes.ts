// Saves that touch more than one document. The rules (firestore.rules, `match /envs/{env}`) accept a
// roster change only when the person's record changes with it in the same save, so these helpers
// are the way to make them. The rules tests use them too, so the app's own saves are what's tested.

import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { normalizeEmail, pathsFor } from './paths';
import type { ChapterRequest, DataEnv, JoinedStatus, Person, Response, Role, RosterEntry } from './types';

// Today as YYYY-MM-DD, for `since`
const today = () => new Date().toISOString().slice(0, 10);

// How someone comes onto a chapter's roster: confirmed straight away (members see them), or invited
// (hidden from members until their first sign-in, when they join as `invite`)
export type Joining = { status: JoinedStatus } | { invite: 'active' | 'guest' };

function rosterEntry(joining: Joining, role: Role): RosterEntry {
  return 'status' in joining
    ? { role, status: joining.status, since: today() }
    : { role, status: 'invitee', joinsAs: joining.invite, since: null };
}

export interface NewPerson {
  personId: string; // see ids.ts personIdFor
  name: string;
  emails?: string[];
  college?: string | null;
  bio?: string | null;
  ghin?: string | null;
  photo?: string | null;
}

// A new person, put on a chapter's roster. Organizers can do this for their chapters; only admins can
// make them an organizer.
export function createPersonInChapter(
  db: Firestore,
  env: DataEnv,
  chapterId: string,
  person: NewPerson,
  joining: Joining,
  role: Role = 'member',
) {
  const p = pathsFor(env);
  const emails = [...new Set((person.emails ?? []).map(normalizeEmail).filter(Boolean))];
  const record: Person = {
    name: person.name.trim(),
    college: person.college ?? null,
    bio: person.bio ?? null,
    ghin: person.ghin ?? null,
    photo: person.photo ?? null,
    chapterIds: 'status' in joining ? [chapterId] : [],
    invitedTo: 'invite' in joining ? [chapterId] : [],
    organizerOf: role === 'organizer' ? [chapterId] : [],
    updatedAt: serverTimestamp(),
  };
  const batch = writeBatch(db);
  batch.set(doc(db, p.person(person.personId)), record);
  batch.set(doc(db, p.rosterEntry(chapterId, person.personId)), rosterEntry(joining, role));
  if (emails.length) {
    batch.set(doc(db, p.contact(person.personId)), { emails });
    for (const email of emails) batch.set(doc(db, p.login(email)), { personId: person.personId });
  }
  return batch.commit();
}

// Someone already in the database (from another chapter) added to this one
export function addPersonToChapter(
  db: Firestore,
  env: DataEnv,
  chapterId: string,
  personId: string,
  joining: Joining,
  role: Role = 'member',
) {
  const p = pathsFor(env);
  const batch = writeBatch(db);
  batch.update(doc(db, p.person(personId)), {
    ['status' in joining ? 'chapterIds' : 'invitedTo']: arrayUnion(chapterId),
    ...(role === 'organizer' ? { organizerOf: arrayUnion(chapterId) } : {}),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, p.rosterEntry(chapterId, personId)), rosterEntry(joining, role));
  return batch.commit();
}

// An invitee becomes a member or guest. On their own first sign-in, `status` must be what they were
// invited as (`joinsAs`); an organizer can confirm them as any status, e.g. a guest who never signs in.
export function completeJoin(db: Firestore, env: DataEnv, chapterId: string, personId: string, status: JoinedStatus) {
  const p = pathsFor(env);
  const batch = writeBatch(db);
  batch.update(doc(db, p.person(personId)), {
    chapterIds: arrayUnion(chapterId),
    invitedTo: arrayRemove(chapterId),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, p.rosterEntry(chapterId, personId)), { status, since: today() });
  return batch.commit();
}

// Active member, alumni or guest, for someone who has joined
export function setStatus(db: Firestore, env: DataEnv, chapterId: string, personId: string, status: JoinedStatus) {
  return updateDoc(doc(db, pathsFor(env).rosterEntry(chapterId, personId)), { status });
}

// Off a chapter's roster (organizers can't remove organizers; admins can)
export function removeFromChapter(db: Firestore, env: DataEnv, chapterId: string, personId: string) {
  const p = pathsFor(env);
  const batch = writeBatch(db);
  batch.update(doc(db, p.person(personId)), {
    chapterIds: arrayRemove(chapterId),
    invitedTo: arrayRemove(chapterId),
    organizerOf: arrayRemove(chapterId),
    updatedAt: serverTimestamp(),
  });
  batch.delete(doc(db, p.rosterEntry(chapterId, personId)));
  return batch.commit();
}

// Admins only: make someone a chapter's organizer, or back to a member
export function setRole(db: Firestore, env: DataEnv, chapterId: string, personId: string, role: Role) {
  const p = pathsFor(env);
  const batch = writeBatch(db);
  batch.update(doc(db, p.person(personId)), {
    organizerOf: role === 'organizer' ? arrayUnion(chapterId) : arrayRemove(chapterId),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, p.rosterEntry(chapterId, personId)), { role });
  return batch.commit();
}

// ── Profiles and emails ─────────────────────────────────────────

// A person changes bio, college, GHIN number and photo; organizers and admins can also fix the name
export function updateProfile(
  db: Firestore,
  env: DataEnv,
  personId: string,
  changes: Partial<Pick<Person, 'name' | 'bio' | 'college' | 'ghin' | 'photo'>>,
) {
  return updateDoc(doc(db, pathsFor(env).person(personId)), { ...changes, updatedAt: serverTimestamp() });
}

// Another email someone can sign in with. Organizers can do this only for people who are in none but
// their own chapters and aren't organizers or admins themselves.
export function addEmail(db: Firestore, env: DataEnv, personId: string, email: string) {
  const p = pathsFor(env);
  const batch = writeBatch(db);
  batch.set(doc(db, p.login(email)), { personId });
  batch.set(doc(db, p.contact(personId)), { emails: arrayUnion(normalizeEmail(email)) }, { merge: true });
  return batch.commit();
}

export function removeEmail(db: Firestore, env: DataEnv, personId: string, email: string) {
  const p = pathsFor(env);
  const batch = writeBatch(db);
  batch.delete(doc(db, p.login(email)));
  batch.set(doc(db, p.contact(personId)), { emails: arrayRemove(normalizeEmail(email)) }, { merge: true });
  return batch.commit();
}

// ── Chapters and admins ─────────────────────────────────────────

// Anyone signed in can ask for a new chapter
export function requestChapter(
  db: Firestore,
  env: DataEnv,
  requestedBy: ChapterRequest['requestedBy'],
  name: string,
  note: string | null,
) {
  const request: ChapterRequest = {
    name: name.trim(),
    note: note?.trim() || null,
    requestedBy: { ...requestedBy, email: normalizeEmail(requestedBy.email) },
    status: 'pending',
    createdAt: serverTimestamp(),
  };
  return addDoc(collection(db, pathsFor(env).chapterRequests), request);
}

// Admins: approve a request. Creates the chapter with the requester as its organizer, giving them a
// person record first if they don't have one.
export function approveChapterRequest(
  db: Firestore,
  env: DataEnv,
  args: {
    requestId: string;
    chapterId: string; // see ids.ts isValidChapterId
    chapterName: string;
    organizer: { personId: string; isNew: boolean; name: string; email: string };
    decidedBy: string; // the admin's person ID
  },
) {
  const p = pathsFor(env);
  const { requestId, chapterId, chapterName, organizer, decidedBy } = args;
  const batch = writeBatch(db);
  batch.set(doc(db, p.chapter(chapterId)), { name: chapterName.trim(), createdAt: serverTimestamp() });
  if (organizer.isNew) {
    const email = normalizeEmail(organizer.email);
    const record: Person = {
      name: organizer.name.trim(),
      college: null,
      bio: null,
      ghin: null,
      photo: null,
      chapterIds: [chapterId],
      invitedTo: [],
      organizerOf: [chapterId],
      updatedAt: serverTimestamp(),
    };
    batch.set(doc(db, p.person(organizer.personId)), record);
    batch.set(doc(db, p.contact(organizer.personId)), { emails: [email] });
    batch.set(doc(db, p.login(email)), { personId: organizer.personId });
  } else {
    batch.update(doc(db, p.person(organizer.personId)), {
      chapterIds: arrayUnion(chapterId),
      organizerOf: arrayUnion(chapterId),
      updatedAt: serverTimestamp(),
    });
  }
  batch.set(doc(db, p.rosterEntry(chapterId, organizer.personId)), { role: 'organizer', status: 'active', since: today() });
  batch.update(doc(db, p.chapterRequest(requestId)), { status: 'approved', decidedBy, chapterId });
  return batch.commit();
}

export function declineChapterRequest(db: Firestore, env: DataEnv, requestId: string, decidedBy: string) {
  return updateDoc(doc(db, pathsFor(env).chapterRequest(requestId)), { status: 'declined', decidedBy });
}

// The commissioner only: the full list of co-admins
export function setCoAdmins(db: Firestore, env: DataEnv, personIds: string[]) {
  return setDoc(doc(db, pathsFor(env).admins), { personIds: [...new Set(personIds)] });
}

// ── Trips ───────────────────────────────────────────────────────

// Everything a trip holds, beside the trip itself
export const TRIP_PARTS = ['content', 'private', 'handicaps', 'rsvps', 'invites', 'fireball', 'matches'] as const;

// Deletes a trip and everything in it (guide, draft, handicaps, RSVPs, Fireball counts, results).
// Organizers only. Saves go ten at a time, inside Firestore's limit on rule lookups per save.
export async function deleteTrip(db: Firestore, env: DataEnv, chapterId: string, tripId: string) {
  const p = pathsFor(env);
  const paths: string[] = [];
  for (const part of TRIP_PARTS) {
    const inside = await getDocs(collection(db, `${p.trip(chapterId, tripId)}/${part}`));
    paths.push(...inside.docs.map((d) => d.ref.path));
  }
  paths.push(p.trip(chapterId, tripId));
  for (let i = 0; i < paths.length; i += 10) {
    const batch = writeBatch(db);
    for (const path of paths.slice(i, i + 10)) batch.delete(doc(db, path));
    await batch.commit();
  }
}

// ── A trip's per-player records ─────────────────────────────────

export function setHandicap(db: Firestore, env: DataEnv, c: string, t: string, personId: string, index: number, by: string) {
  return setDoc(doc(db, pathsFor(env).handicap(c, t, personId)), { index, updatedBy: by, updatedAt: serverTimestamp() });
}

export function setRsvp(db: Firestore, env: DataEnv, c: string, t: string, personId: string, response: Response, note: string | null = null) {
  return setDoc(doc(db, pathsFor(env).rsvp(c, t, personId)), { response, note, updatedAt: serverTimestamp() });
}

// Adds (or with -1, takes back) a Fireball shot
export function addShots(db: Firestore, env: DataEnv, c: string, t: string, personId: string, bucket: string, delta: number) {
  return setDoc(
    doc(db, pathsFor(env).fireballEntry(c, t, personId)),
    { counts: { [bucket]: increment(delta) }, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
