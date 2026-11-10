// The move-over's writes under the real rules (firestore.rules), in Firebase's local emulator: the
// commissioner writes the whole move into the dev data, can run it again, and members can see their
// chapter afterwards. Uses the same stand-in data as tests/moveOver.test.ts.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails as no,
  assertSucceeds as ok,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pathsFor } from '../../src/data/paths';
import type { HistoryData } from '../../src/history/types';
import { buildFoundersChapter } from '../../src/moveOver/transform';
import { loadOldData } from '../../src/moveOver/load';
import { clearFounders, writeMove } from '../../src/moveOver/write';
import { loadHistory, publicHistory } from '../../scripts/loadHistory';
import { oldData, readyPeople } from '../fixtures/moveOver';

let testEnv: RulesTestEnvironment;
let history: HistoryData;
const firestoreOf = (ctx: RulesTestContext) => ctx.firestore() as unknown as Firestore;
const signedIn = (email: string) => firestoreOf(testEnv.authenticatedContext(`${email}-uid`, { email, email_verified: true }));
const commissioner = () => signedIn('reese296@gmail.com');
const D = pathsFor('dev');

const move = () => {
  const old = oldData(history, true);
  return buildFoundersChapter(old, history, readyPeople(history, old), 'dev');
};

// What's actually in the database, read with the rules off
async function exists(path: string) {
  let found = false;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    found = (await getDoc(doc(firestoreOf(ctx), path))).exists();
  });
  return found;
}

beforeAll(async () => {
  const { data } = await loadHistory(resolve(import.meta.dirname, '..', '..', 'history'));
  history = publicHistory(data, false);
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-ugl',
    firestore: { rules: readFileSync(resolve(import.meta.dirname, '..', '..', 'firestore.rules'), 'utf8') },
  });
});

afterAll(() => testEnv?.cleanup());

beforeEach(() => testEnv.clearFirestore());

describe('the move-over under the real rules', () => {
  it('the commissioner writes all of it into the dev data', async () => {
    const { docs } = move();
    await ok(writeMove(commissioner(), docs));
    for (const d of docs) expect(await exists(d.path), d.path).toBe(true);
  });

  it('afterwards, members see their chapter and its history', async () => {
    await writeMove(commissioner(), move().docs);
    const jeff = signedIn('jeff@example.com'); // on the member list with this email
    await ok(getDoc(doc(jeff, D.trip('founders', '2026-columbia'))));
    await ok(getDocs(collection(jeff, D.matches('founders', '2026-columbia'))));
    await ok(getDoc(doc(jeff, D.person('mark-reese'))));
    await no(getDoc(doc(signedIn('stranger@example.com'), D.trip('founders', '2026-columbia'))));
  });

  it('can run again: the chapter is cleared, then written fresh', async () => {
    const { docs } = move();
    await writeMove(commissioner(), docs);
    await ok(clearFounders(commissioner(), 'dev'));
    for (const path of [D.chapter('founders'), D.person('mark-reese'), D.login('reese296@gmail.com'), D.trip('founders', '2026-columbia'), D.match('founders', '2026-columbia', 'fourball-1')]) {
      expect(await exists(path), path).toBe(false);
    }
    await ok(writeMove(commissioner(), docs));
    expect(await exists(D.handicap('founders', '2026-columbia', 'mark-reese'))).toBe(true);
  });

  it('clearing keeps someone who is also in another chapter, minus this one', async () => {
    await writeMove(commissioner(), move().docs);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = firestoreOf(ctx);
      await setDoc(doc(db, D.person('jeff-siarto')), { name: 'Jeff Siarto', college: null, bio: null, ghin: null, photo: null, chapterIds: ['founders', 'second'], invitedTo: [], organizerOf: [] });
      await setDoc(doc(db, D.rosterEntry('second', 'jeff-siarto')), { role: 'member', status: 'active' });
    });
    await ok(clearFounders(commissioner(), 'dev'));
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const jeff = await getDoc(doc(firestoreOf(ctx), D.person('jeff-siarto')));
      expect(jeff.data()?.chapterIds).toEqual(['second']);
    });
    expect(await exists(D.login('jeff@example.com'))).toBe(true);
  });

  it('reads today’s live data as the commissioner, and nobody else can', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = firestoreOf(ctx);
      await setDoc(doc(db, 'app/data'), { members: [{ id: 'm1', name: 'Jeff S' }], trips: [{ id: 't1', year: 2026, month: 11, location: 'Columbia, SC', attendeeIds: ['m1'], selectedById: 'm1', nextSelectorId: null }] });
      await setDoc(doc(db, 'access/members'), { byMember: { m1: 'jeff@example.com' } });
      await setDoc(doc(db, 'guides/t1'), { title: '2026 UGL Invitational' });
      await setDoc(doc(db, 'guideDrafts/t1'), { published: false });
      await setDoc(doc(db, 'fireball/t1/players/m1'), { counts: { off: 2 } });
      await setDoc(doc(db, 'profiles/jeff-siarto'), { bio: 'Hits it straight.' });
      await setDoc(doc(db, 'data-dev-should-be-ignored/x'), { nope: true });
    });
    const { old, backup } = await loadOldData(commissioner());
    expect(old.members).toEqual([{ id: 'm1', name: 'Jeff S' }]);
    expect(old.emails).toEqual({ m1: 'jeff@example.com' });
    expect(Object.keys(old.guides)).toEqual(['t1']);
    expect(Object.keys(old.drafts)).toEqual(['t1']);
    expect(old.fireball).toEqual({ t1: { m1: { off: 2 } } });
    expect(old.bios).toEqual({ 'jeff-siarto': 'Hits it straight.' });
    expect(Object.keys(backup).sort()).toEqual(['access/members', 'app/data', 'fireball/t1/players/m1', 'guideDrafts/t1', 'guides/t1', 'profiles/jeff-siarto']);
    await no(loadOldData(signedIn('jeff@example.com')));
  });

  it('nobody else can run it', async () => {
    await no(writeMove(signedIn('jeff@example.com'), move().docs.slice(0, 6)));
  });
});
