// An invitee's first sign-in (src/next/join.ts) under the real rules, in Firebase's local emulator.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertSucceeds as ok,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pathsFor } from '../../src/data/paths';
import { completeInvitations } from '../../src/next/join';

let testEnv: RulesTestEnvironment;
const firestoreOf = (ctx: RulesTestContext) => ctx.firestore() as unknown as Firestore;
const signedIn = (email: string) => firestoreOf(testEnv.authenticatedContext(`${email}-uid`, { email, email_verified: true }));
const D = pathsFor('dev');
const person = (chapterIds: string[], invitedTo: string[]) => ({ name: 'Ivy Invitee', college: null, bio: null, ghin: null, photo: null, chapterIds, invitedTo, organizerOf: [] });

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

// Ivy is invited to The Founder's Chapter as a guest, and to a chapter with no roster entry for her
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = firestoreOf(ctx);
    await setDoc(doc(db, D.chapter('founders')), { name: "The Founder's Chapter" });
    await setDoc(doc(db, D.person('ivy-invitee')), person([], ['founders', 'ghost']));
    await setDoc(doc(db, D.rosterEntry('founders', 'ivy-invitee')), { role: 'member', status: 'invitee', joinsAs: 'guest', since: null });
    await setDoc(doc(db, D.login('ivy@example.com')), { personId: 'ivy-invitee' });
  });
});

describe('an invitee’s first sign-in', () => {
  it('joins each chapter that invited them, as what they were invited as', async () => {
    const joined = await completeInvitations(signedIn('ivy@example.com'), 'dev', 'ivy-invitee', ['founders', 'ghost']);
    expect(joined).toEqual(['founders']);
    expect(await read(D.rosterEntry('founders', 'ivy-invitee'))).toMatchObject({ status: 'guest' });
    expect(await read(D.person('ivy-invitee'))).toMatchObject({ chapterIds: ['founders'], invitedTo: ['ghost'] });
    await ok(getDoc(doc(signedIn('ivy@example.com'), D.chapter('founders'))));
  });

  it('does nothing the second time', async () => {
    await completeInvitations(signedIn('ivy@example.com'), 'dev', 'ivy-invitee', ['founders']);
    expect(await completeInvitations(signedIn('ivy@example.com'), 'dev', 'ivy-invitee', ['founders'])).toEqual([]);
  });

  it('can’t join on someone else’s behalf', async () => {
    await expect(completeInvitations(signedIn('stranger@example.com'), 'dev', 'ivy-invitee', ['founders'])).rejects.toThrow();
    expect(await read(D.rosterEntry('founders', 'ivy-invitee'))).toMatchObject({ status: 'invitee' });
  });
});
