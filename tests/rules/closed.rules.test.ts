// Everything outside envs/ is closed (firestore.rules), including the collections from before
// chapters, whose data stays in the database after the switch (Phase 1, step 9c). Checked against
// Firebase's local emulator: a throwaway database that never touches the live project.
// Run with `npm run test:rules` (needs Java 21+; GitHub runs it on every pull request).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertFails, initializeTestEnvironment, type RulesTestContext, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, getDocs, collection, setDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

const firestoreOf = (ctx: RulesTestContext) => ctx.firestore() as unknown as Firestore;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ugl',
    firestore: { rules: readFileSync(resolve(import.meta.dirname, '..', '..', 'firestore.rules'), 'utf8') },
  });
});

afterAll(() => env?.cleanup());

const OLD = ['app/data', 'app/data-dev', 'access/members'];
for (const suffix of ['', '-dev']) {
  OLD.push(`guides${suffix}/trip1`, `guideDrafts${suffix}/trip1`, `fireball${suffix}/trip1/players/ricky`, `profiles${suffix}/jeff-siarto`);
}

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = firestoreOf(ctx);
    for (const path of OLD) await setDoc(doc(db, path), { kept: true });
  });
});

const everyone = () => [
  ['signed out', firestoreOf(env.unauthenticatedContext())],
  ['the commissioner', firestoreOf(env.authenticatedContext('mark', { email: 'reese296@gmail.com', email_verified: true }))],
  ['a stranger', firestoreOf(env.authenticatedContext('stranger', { email: 'stranger@example.com', email_verified: true }))],
] as const;

describe('the collections from before chapters', () => {
  it('nobody can read them, the commissioner included', async () => {
    for (const [, db] of everyone()) {
      for (const path of OLD) await assertFails(getDoc(doc(db, path)));
      await assertFails(getDocs(collection(db, 'guides')));
    }
  });

  it('nobody can change or delete them', async () => {
    for (const [, db] of everyone()) {
      for (const path of OLD) {
        await assertFails(setDoc(doc(db, path), { changed: true }));
        await assertFails(deleteDoc(doc(db, path)));
      }
    }
  });

  it('nor anywhere else outside envs/', async () => {
    for (const [, db] of everyone()) {
      await assertFails(setDoc(doc(db, 'anything/new'), { x: 1 }));
      await assertFails(getDoc(doc(db, 'anything/new')));
    }
  });
});
