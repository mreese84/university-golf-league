// Draft trips (firestore.rules, src/data/writes.ts createTrip and publishTrip): a trip being planned
// is seen only by the chapter's organizers and admins and the person picking its location, guide
// and all, until it's published. Checked in Firebase's local emulator.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails as no,
  assertSucceeds as ok,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, where, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pathsFor } from '../../src/data/paths';
import type { Trip } from '../../src/data/types';
import { createTrip, publishTrip, updateTrip } from '../../src/data/writes';

let testEnv: RulesTestEnvironment;
const firestoreOf = (ctx: RulesTestContext) => ctx.firestore() as unknown as Firestore;
const signedIn = (email: string) => firestoreOf(testEnv.authenticatedContext(`${email}-uid`, { email, email_verified: true }));
const D = pathsFor('dev');
const C = 'founders';
const DRAFT = '2027-austin';
const PUBLISHED = '2026-columbia';

const oscar = () => signedIn('oscar@example.com'); // organizer
const jeff = () => signedIn('jeff@example.com'); // picks the draft's location
const amy = () => signedIn('amy@example.com'); // member
const mark = () => signedIn('reese296@gmail.com'); // the commissioner, an admin
const outsider = () => signedIn('olly@example.com'); // in another chapter

const trip = (over: Partial<Trip> = {}): Trip => ({
  number: 3,
  title: '2027 UGL Invitational',
  year: 2027,
  month: 10,
  location: 'Austin, TX',
  dates: null,
  theme: { primary: '#15803d', onPrimary: '#ffffff' },
  competition: false,
  attendeeIds: ['oscar', 'jeff'],
  selectedById: 'jeff',
  nextSelectorId: null,
  ...over,
});
const person = (name: string, chapter = C, organizer = false) => ({ name, college: null, bio: null, ghin: null, photo: null, chapterIds: [chapter], invitedTo: [], organizerOf: organizer ? [chapter] : [] });

async function read(path: string) {
  let data: Record<string, unknown> | undefined;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(firestoreOf(ctx), path))).data();
  });
  return data;
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-ugl',
    firestore: { rules: readFileSync(resolve(import.meta.dirname, '..', '..', 'firestore.rules'), 'utf8') },
  });
});

afterAll(() => testEnv?.cleanup());

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = firestoreOf(ctx);
    await setDoc(doc(db, D.chapter(C)), { name: "The Founder's Chapter" });
    await setDoc(doc(db, D.chapter('austin-crew')), { name: 'Austin Crew' });
    for (const [id, name] of Object.entries({ oscar: 'Oscar Org', jeff: 'Jeff Picks', amy: 'Amy Member' })) {
      await setDoc(doc(db, D.person(id)), person(name, C, id === 'oscar'));
      await setDoc(doc(db, D.rosterEntry(C, id)), { role: id === 'oscar' ? 'organizer' : 'member', status: 'active' });
      await setDoc(doc(db, D.login(`${id}@example.com`)), { personId: id });
    }
    await setDoc(doc(db, D.person('olly')), person('Olly Outside', 'austin-crew'));
    await setDoc(doc(db, D.rosterEntry('austin-crew', 'olly')), { role: 'member', status: 'active' });
    await setDoc(doc(db, D.login('olly@example.com')), { personId: 'olly' });
    // A published trip, and a draft with a guide already started
    await setDoc(doc(db, D.trip(C, PUBLISHED)), trip({ number: 2, year: 2026, location: 'Columbia, SC', selectedById: 'amy' }));
    await setDoc(doc(db, D.guide(C, PUBLISHED)), { flights: [] });
    await setDoc(doc(db, D.draftTrip(C, DRAFT)), trip());
    await setDoc(doc(db, D.guide(C, DRAFT)), { flights: [] });
    await setDoc(doc(db, D.handicap(C, DRAFT, 'jeff')), { index: 10.7 });
  });
});

describe('draft trips', () => {
  it('organizers create them; members can’t, and a draft can’t take a published trip’s address', async () => {
    await ok(createTrip(oscar(), 'dev', C, '2028-denver', trip({ location: 'Denver, CO', year: 2028 }), true));
    await no(createTrip(amy(), 'dev', C, '2028-boise', trip({ location: 'Boise, ID', year: 2028 }), true));
    await no(createTrip(jeff(), 'dev', C, '2028-boise', trip({ location: 'Boise, ID', year: 2028 }), true));
    await no(createTrip(oscar(), 'dev', C, PUBLISHED, trip(), true));
  });

  it('only organizers, admins and the person picking its location see the draft', async () => {
    await ok(getDoc(doc(oscar(), D.draftTrip(C, DRAFT))));
    await ok(getDoc(doc(mark(), D.draftTrip(C, DRAFT))));
    await ok(getDoc(doc(jeff(), D.draftTrip(C, DRAFT))));
    await no(getDoc(doc(amy(), D.draftTrip(C, DRAFT))));
    await no(getDoc(doc(outsider(), D.draftTrip(C, DRAFT))));
  });

  it('members list only the drafts they pick for; organizers list them all', async () => {
    expect((await ok(getDocs(collection(oscar(), D.draftTrips(C))))).size).toBe(1);
    expect((await ok(getDocs(query(collection(jeff(), D.draftTrips(C)), where('selectedById', '==', 'jeff'))))).size).toBe(1);
    expect((await ok(getDocs(query(collection(amy(), D.draftTrips(C)), where('selectedById', '==', 'amy'))))).size).toBe(0);
    await no(getDocs(collection(jeff(), D.draftTrips(C))));
    await no(getDocs(query(collection(amy(), D.draftTrips(C)), where('selectedById', '==', 'jeff'))));
  });

  it('keeps the draft’s guide and the rest hidden from everyone else', async () => {
    await ok(getDoc(doc(oscar(), D.guide(C, DRAFT))));
    await ok(getDoc(doc(jeff(), D.guide(C, DRAFT))));
    await ok(getDocs(collection(jeff(), D.handicaps(C, DRAFT))));
    await no(getDoc(doc(amy(), D.guide(C, DRAFT))));
    await no(getDocs(collection(amy(), D.handicaps(C, DRAFT))));
    await no(getDocs(collection(amy(), D.fireball(C, DRAFT))));
    await no(setDoc(doc(amy(), D.rsvp(C, DRAFT, 'amy')), { response: 'yes', note: null }));
    await no(setDoc(doc(amy(), D.handicap(C, DRAFT, 'amy')), { index: 20 }));
    // The published trip's guide is everyone's, as before
    await ok(getDoc(doc(amy(), D.guide(C, PUBLISHED))));
    await ok(getDocs(collection(amy(), D.trips(C))));
  });

  it('organizers change a draft; the person picking for it only looks', async () => {
    await ok(updateTrip(oscar(), 'dev', C, DRAFT, true, { location: 'Austin, Texas' }));
    await no(updateTrip(jeff(), 'dev', C, DRAFT, true, { location: 'Waco, TX' }));
    expect((await read(D.draftTrip(C, DRAFT)))?.location).toBe('Austin, Texas');
  });

  it('publishing moves the record into trips, and then everyone sees it and its guide', async () => {
    await no(publishTrip(jeff(), 'dev', C, DRAFT, trip()));
    await no(getDoc(doc(amy(), D.guide(C, DRAFT))));
    await ok(publishTrip(oscar(), 'dev', C, DRAFT, trip()));
    expect(await read(D.draftTrip(C, DRAFT))).toBeUndefined();
    expect((await read(D.trip(C, DRAFT)))?.location).toBe('Austin, TX');
    await ok(getDoc(doc(amy(), D.trip(C, DRAFT))));
    await ok(getDoc(doc(amy(), D.guide(C, DRAFT))));
    await ok(setDoc(doc(amy(), D.rsvp(C, DRAFT, 'amy')), { response: 'yes', note: null }));
    await no(getDoc(doc(outsider(), D.guide(C, DRAFT))));
  });
});
