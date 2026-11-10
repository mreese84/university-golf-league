// Today's database rules (firestore.rules), checked against Firebase's local emulator: a throwaway
// database that starts empty for every test and never touches the live project.
// Run with `npm run test:rules` (needs Java 21+; GitHub runs it on every pull request).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, increment, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const ADMIN_EMAIL = 'reese296@gmail.com';

let env: RulesTestEnvironment;

// The test library hands back Firebase's older-style database object; the modern functions used
// here accept it (they unwrap it), but its type doesn't say so
const firestoreOf = (ctx: RulesTestContext) => ctx.firestore() as unknown as Firestore;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ugl',
    firestore: { rules: readFileSync(resolve(import.meta.dirname, '..', '..', 'firestore.rules'), 'utf8') },
  });
});

afterAll(() => env?.cleanup());

// Two members on the guide-access list, plus one document of each kind
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = firestoreOf(ctx);
    await setDoc(doc(db, 'access/members'), { byMember: { jeff: 'jeff@example.com', ricky: 'ricky@example.com' } });
    await setDoc(doc(db, 'app/data'), { members: [], trips: [] });
    for (const suffix of ['', '-dev']) {
      await setDoc(doc(db, `guides${suffix}/trip1`), { title: '2026 UGL Invitational' });
      await setDoc(doc(db, `guideDrafts${suffix}/trip1`), { published: false });
      await setDoc(doc(db, `fireball${suffix}/trip1/players/ricky`), { counts: { off: 2 } });
      await setDoc(doc(db, `profiles${suffix}/jeff-siarto`), { bio: 'Hits it straight.' });
    }
  });
});

const signedOut = () => firestoreOf(env.unauthenticatedContext());
const signedIn = (uid: string, email: string, verified = true) =>
  firestoreOf(env.authenticatedContext(uid, { email, email_verified: verified }));
const admin = () => signedIn('mark', ADMIN_EMAIL);
const jeff = () => signedIn('jeff-uid', 'jeff@example.com');
const stranger = () => signedIn('stranger-uid', 'stranger@example.com');

const read = (db: Firestore, path: string) => getDoc(doc(db, path));

describe('trips and members (app/data)', () => {
  it('anyone can read, even signed out', async () => {
    await assertSucceeds(read(signedOut(), 'app/data'));
    await assertSucceeds(read(signedOut(), 'app/data-dev'));
  });

  it('the live copy is frozen for the switch, even for the admin; the dev copy isn’t', async () => {
    await assertFails(setDoc(doc(jeff(), 'app/data'), { members: [], trips: [] }));
    await assertFails(setDoc(doc(signedOut(), 'app/data'), { members: [], trips: [] }));
    await assertFails(setDoc(doc(admin(), 'app/data'), { members: [], trips: [] }));
    await assertSucceeds(setDoc(doc(admin(), 'app/data-dev'), { members: [], trips: [] }));
    await assertFails(setDoc(doc(jeff(), 'app/data-dev'), { members: [], trips: [] }));
  });
});

describe('guide-access emails (access/members)', () => {
  it('only the admin can read; frozen for the switch', async () => {
    await assertFails(read(jeff(), 'access/members'));
    await assertFails(setDoc(doc(jeff(), 'access/members'), { byMember: {} }));
    await assertSucceeds(read(admin(), 'access/members'));
    await assertFails(setDoc(doc(admin(), 'access/members'), { byMember: {} }));
  });
});

// The live collections ('') are frozen for the switch (Phase 1, step 9); the -dev ones aren't
const writable = (suffix: string) => (suffix === '' ? assertFails : assertSucceeds);

describe.each(['', '-dev'])('guides%s', (suffix) => {
  const path = `guides${suffix}/trip1`;

  it('members on the list can read', async () => {
    await assertSucceeds(read(jeff(), path));
  });

  it('matches emails without regard to capitals', async () => {
    await assertSucceeds(read(signedIn('jeff-uid', 'Jeff@Example.com'), path));
  });

  it('turns away the signed-out, strangers and unverified emails', async () => {
    await assertFails(read(signedOut(), path));
    await assertFails(read(stranger(), path));
    await assertFails(read(signedIn('jeff-uid', 'jeff@example.com', false), path));
  });

  it('only the admin can change, and only the dev copy now', async () => {
    await assertFails(setDoc(doc(jeff(), path), { title: 'changed' }));
    await writable(suffix)(setDoc(doc(admin(), path), { title: 'changed' }));
  });
});

describe.each(['', '-dev'])('pairings drafts (guideDrafts%s)', (suffix) => {
  const path = `guideDrafts${suffix}/trip1`;

  it('only the admin can read or change, and only the dev copy now', async () => {
    await assertFails(read(jeff(), path));
    await assertFails(setDoc(doc(jeff(), path), { published: true }));
    await assertSucceeds(read(admin(), path));
    await writable(suffix)(setDoc(doc(admin(), path), { published: true }));
  });
});

describe.each(['', '-dev'])('Fireball counts (fireball%s)', (suffix) => {
  const own = `fireball${suffix}/trip1/players/jeff`;
  const other = `fireball${suffix}/trip1/players/ricky`;
  const shot = () => ({ counts: { off: increment(1) }, updatedAt: serverTimestamp() });

  it('members see everyone’s', async () => {
    await assertSucceeds(read(jeff(), other));
    await assertFails(read(stranger(), other));
  });

  it('a member logs only their own shots (in the dev copy now)', async () => {
    await writable(suffix)(setDoc(doc(jeff(), own), shot(), { merge: true }));
    await assertFails(setDoc(doc(jeff(), other), shot(), { merge: true }));
  });

  it('only counts and a timestamp can be saved', async () => {
    await assertFails(setDoc(doc(jeff(), own), { ...shot(), note: 'extra' }, { merge: true }));
  });

  it('the admin can fix anyone’s (in the dev copy now), but nobody can delete', async () => {
    await writable(suffix)(setDoc(doc(admin(), other), shot(), { merge: true }));
    await assertFails(deleteDoc(doc(admin(), other)));
  });
});

describe.each(['', '-dev'])('bios (profiles%s)', (suffix) => {
  const path = `profiles${suffix}/jeff-siarto`;

  it('members read; strangers don’t', async () => {
    await assertSucceeds(read(jeff(), path));
    await assertFails(read(stranger(), path));
  });

  it('only the admin writes, only the bio, and only the dev copy now', async () => {
    await assertFails(setDoc(doc(jeff(), path), { bio: 'Mine now', updatedAt: serverTimestamp() }));
    await writable(suffix)(setDoc(doc(admin(), path), { bio: 'Still straight.', updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(admin(), path), { bio: 'x', photo: 'y' }));
  });
});
