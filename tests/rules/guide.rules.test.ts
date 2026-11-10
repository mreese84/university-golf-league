// Saving a pairings draft (src/data/writes.ts saveDraft) under the real rules, in Firebase's local
// emulator: the draft, what members see in the guide, and the handicaps beside it.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails as no,
  assertSucceeds as ok,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pathsFor } from '../../src/data/paths';
import type { GuideContent } from '../../src/data/types';
import { saveDraft } from '../../src/data/writes';

let testEnv: RulesTestEnvironment;
const firestoreOf = (ctx: RulesTestContext) => ctx.firestore() as unknown as Firestore;
const signedIn = (email: string) => firestoreOf(testEnv.authenticatedContext(`${email}-uid`, { email, email_verified: true }));
const D = pathsFor('dev');
const T = '2027-austin';

const content: GuideContent = {
  flights: [],
  teams: [
    { id: 'red', name: 'Team Red', house: '', address: '', color: '#aa0000', memberIds: [], captainId: null },
    { id: 'blue', name: 'Team Blue', house: '', address: '', color: '#0000aa', memberIds: [], captainId: null },
  ],
  rounds: [{ id: 'r1', date: '2027-10-01', course: 'Austin CC', label: 'Day 1', matchType: 'fourball', groups: [{ teeTime: '9:00 AM', playerIds: [] }] }],
  format: { name: 'Ryder Cup', summary: '', notes: [], sessions: [] },
  football: { away: '', home: '', date: null, kickoff: null, line: null, venue: null },
  nightlife: [],
};

const person = (name: string, organizer = false) => ({ name, college: null, bio: null, ghin: null, photo: null, chapterIds: ['founders'], invitedTo: [], organizerOf: organizer ? ['founders'] : [] });
const people = { oscar: 'Oscar Org', fred: 'Fred Member', amy: 'Amy Active', bo: 'Bo Active' };

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
    await setDoc(doc(db, D.chapter('founders')), { name: "The Founder's Chapter" });
    for (const [id, name] of Object.entries(people)) {
      await setDoc(doc(db, D.person(id)), person(name, id === 'oscar'));
      await setDoc(doc(db, D.rosterEntry('founders', id)), { role: id === 'oscar' ? 'organizer' : 'member', status: 'active' });
      await setDoc(doc(db, D.login(`${id}@example.com`)), { personId: id });
    }
    await setDoc(doc(db, D.trip('founders', T)), { title: 'Austin', number: 3 });
    await setDoc(doc(db, D.guide('founders', T)), content);
    await setDoc(doc(db, D.handicap('founders', T, 'bo')), { index: 30 });
  });
});

const draft = (published: boolean) => ({
  published,
  captains: { red: 'oscar', blue: 'fred' },
  teams: { red: ['oscar', 'amy'], blue: ['fred', 'bo'] },
  rounds: { r1: [{ playerIds: ['oscar', 'amy', 'fred', 'bo'] }] },
  handicaps: { oscar: 12.4, fred: 8, amy: 20.1 }, // Bo's is removed
});

describe('saving the pairings draft', () => {
  it('an organizer publishes: the guide shows the teams and groups, and the handicaps are saved', async () => {
    await ok(saveDraft(signedIn('oscar@example.com'), 'dev', 'founders', T, draft(true), content, { bo: 30 }, 'oscar'));
    expect(await read(D.draft('founders', T))).toEqual({ published: true, captains: draft(true).captains, teams: draft(true).teams, rounds: draft(true).rounds });
    const guide = (await read(D.guide('founders', T))) as unknown as GuideContent;
    expect(guide.teams.map((t) => [t.id, t.memberIds, t.captainId])).toEqual([['red', ['oscar', 'amy'], 'oscar'], ['blue', ['fred', 'bo'], 'fred']]);
    expect(guide.rounds[0].groups[0].playerIds).toEqual(['oscar', 'amy', 'fred', 'bo']);
    expect(await read(D.handicap('founders', T, 'amy'))).toMatchObject({ index: 20.1, updatedBy: 'oscar' });
    expect(await read(D.handicap('founders', T, 'bo'))).toBeUndefined();
  });

  it('unpublished, members still see TBD', async () => {
    await ok(saveDraft(signedIn('oscar@example.com'), 'dev', 'founders', T, draft(false), content, {}, 'oscar'));
    const guide = (await read(D.guide('founders', T))) as unknown as GuideContent;
    expect(guide.teams.every((t) => t.memberIds.length === 0)).toBe(true);
  });

  it('a member can’t', async () => {
    await no(saveDraft(signedIn('fred@example.com'), 'dev', 'founders', T, draft(true), content, {}, 'fred'));
  });
});
