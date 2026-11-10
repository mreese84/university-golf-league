// Writing the move into one copy of the data (envs/dev or envs/live), as the commissioner.
//
// Saves go in small groups: Firestore lets one save make at most 20 of the lookups the rules use to
// check it, and some documents need one or two each (a roster entry checks the person's record; a
// handicap or Fireball count checks the roster). Six per group stays well inside that.

import { collection, doc, getDocs, query, where, writeBatch, type Firestore } from 'firebase/firestore';
import { pathsFor } from '../data/paths';
import type { DataEnv, Person } from '../data/types';
import { FOUNDERS, type MovedDoc } from './transform';

const GROUP = 6;

type Op = { kind: 'set'; path: string; data: Record<string, unknown> } | { kind: 'delete'; path: string } | { kind: 'update'; path: string; data: Record<string, unknown> };

// Runs operations in order. Each group (e.g. a roster entry and the person's record) stays in one save.
async function run(db: Firestore, groups: Op[][], onProgress?: (done: number, total: number) => void) {
  const total = groups.reduce((n, g) => n + g.length, 0);
  let done = 0;
  // Pack whole groups into saves of up to GROUP operations
  const saves: Op[][] = [];
  for (const g of groups) {
    const last = saves.at(-1);
    if (last && last.length + g.length <= GROUP) last.push(...g);
    else saves.push([...g]);
  }
  for (const ops of saves) {
    const batch = writeBatch(db);
    for (const op of ops) {
      const ref = doc(db, op.path);
      if (op.kind === 'set') batch.set(ref, op.data);
      else if (op.kind === 'update') batch.update(ref, op.data);
      else batch.delete(ref);
    }
    await batch.commit();
    done += ops.length;
    onProgress?.(done, total);
  }
}

// Writes the moved documents in the order given (see buildFoundersChapter)
export function writeMove(db: Firestore, docs: MovedDoc[], onProgress?: (done: number, total: number) => void) {
  return run(db, docs.map((d) => [{ kind: 'set', path: d.path, data: d.data }]), onProgress);
}

// Empties The Founder's Chapter in one copy of the data, so a rerun starts fresh: its trips and
// everything in them, its roster, and its people with their logins and emails. Someone who is also
// in another chapter only loses this one.
export async function clearFounders(db: Firestore, env: DataEnv, onProgress?: (done: number, total: number) => void) {
  const P = pathsFor(env);
  const groups: Op[][] = [];

  // Trips, with what's inside them
  const trips = await getDocs(collection(db, P.trips(FOUNDERS)));
  for (const t of trips.docs) {
    for (const sub of ['content', 'private', 'handicaps', 'rsvps', 'invites', 'fireball', 'matches']) {
      const inside = await getDocs(collection(db, `${P.trip(FOUNDERS, t.id)}/${sub}`));
      for (const d of inside.docs) groups.push([{ kind: 'delete', path: d.ref.path }]);
    }
    groups.push([{ kind: 'delete', path: t.ref.path }]);
  }

  // Everyone on the roster or whose record names the chapter
  const people = new Map<string, Person>();
  for (const field of ['chapterIds', 'invitedTo', 'organizerOf']) {
    const found = await getDocs(query(collection(db, P.people), where(field, 'array-contains', FOUNDERS)));
    for (const d of found.docs) people.set(d.id, d.data() as Person);
  }
  const roster = await getDocs(collection(db, P.roster(FOUNDERS)));
  const onRoster = new Set(roster.docs.map((d) => d.id));
  for (const id of new Set([...people.keys(), ...onRoster])) {
    const person = people.get(id);
    const elsewhere = person && [...person.chapterIds, ...person.invitedTo, ...person.organizerOf].some((c) => c !== FOUNDERS);
    // The roster entry and the person's record change in the same save (the rules check they agree)
    const together: Op[] = [];
    if (onRoster.has(id)) together.push({ kind: 'delete', path: P.rosterEntry(FOUNDERS, id) });
    if (elsewhere) {
      const drop = (list: string[]) => list.filter((c) => c !== FOUNDERS);
      together.push({ kind: 'update', path: P.person(id), data: { chapterIds: drop(person.chapterIds), invitedTo: drop(person.invitedTo), organizerOf: drop(person.organizerOf) } });
    } else if (person) {
      together.push({ kind: 'delete', path: P.person(id) });
    }
    groups.push(together);
    if (!elsewhere) {
      groups.push([{ kind: 'delete', path: P.contact(id) }]);
      const logins = await getDocs(query(collection(db, P.logins), where('personId', '==', id)));
      for (const d of logins.docs) groups.push([{ kind: 'delete', path: d.ref.path }]);
    }
  }

  groups.push([{ kind: 'delete', path: P.chapter(FOUNDERS) }]);
  await run(db, groups.filter((g) => g.length > 0), onProgress);
}
