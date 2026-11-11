// Uploaded images (storage.rules): each signed-in person uploads only into their own folder, only
// small JPEG or PNG images, under envs/live or envs/dev. Checked against Firebase's local storage
// emulator, which never touches the live project. Run with `npm run test:rules` (needs Java 21+).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestContext, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteObject, getMetadata, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

const storageOf = (ctx: RulesTestContext) => ctx.storage() as unknown as FirebaseStorage;
const mark = () => storageOf(env.authenticatedContext('mark-uid', { email: 'reese296@gmail.com', email_verified: true }));
const justin = () => storageOf(env.authenticatedContext('justin-uid', { email: 'justin@example.com', email_verified: true }));
const unverified = () => storageOf(env.authenticatedContext('new-uid', { email: 'new@example.com', email_verified: false }));
const signedOut = () => storageOf(env.unauthenticatedContext());

const JPEG = { contentType: 'image/jpeg' };
const PNG = { contentType: 'image/png' };
const small = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const upload = (s: FirebaseStorage, path: string, data = small, meta: { contentType: string } = JPEG) => uploadBytes(ref(s, path), data, meta);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ugl',
    storage: { rules: readFileSync(resolve(import.meta.dirname, '..', '..', 'storage.rules'), 'utf8'), host: '127.0.0.1', port: 9199 },
  });
});

afterAll(() => env?.cleanup());

// Each test uploads under names of its own, so no test sees another's files
beforeEach(() => env.clearStorage());

describe('uploaded images', () => {
  it('lets a signed-in person upload a photo or a logo into their own folder, live or dev', async () => {
    await assertSucceeds(upload(mark(), 'envs/live/uploads/mark-uid/photo-mark-reese-1.jpg'));
    await assertSucceeds(upload(mark(), 'envs/dev/uploads/mark-uid/logo-founders-2026-columbia-palmetto-2.png', small, PNG));
  });

  it('keeps everyone out of other people’s folders', async () => {
    await assertFails(upload(justin(), 'envs/live/uploads/mark-uid/photo-mark-reese-2.jpg'));
    await assertFails(upload(signedOut(), 'envs/live/uploads/mark-uid/photo-mark-reese-2.jpg'));
    await assertFails(upload(unverified(), 'envs/live/uploads/new-uid/photo-new-1.jpg'));
  });

  it('takes only small JPEG and PNG images, named as the app names them', async () => {
    await assertFails(upload(mark(), 'envs/live/uploads/mark-uid/photo-mark-reese-3.jpg', small, { contentType: 'image/svg+xml' }));
    await assertFails(upload(mark(), 'envs/live/uploads/mark-uid/photo-mark-reese-3.jpg', small, { contentType: 'text/html' }));
    await assertFails(upload(mark(), 'envs/live/uploads/mark-uid/photo-mark-reese-3.jpg', new Uint8Array(2 * 1024 * 1024 + 1)));
    await assertFails(upload(mark(), 'envs/live/uploads/mark-uid/page.html'));
    await assertFails(upload(mark(), 'envs/live/uploads/mark-uid/photo-mark-reese-3.jpg.html'));
    await assertFails(upload(mark(), 'envs/live/uploads/mark-uid/Photo-Mark-1.jpg'));
    // The same name with a JPEG goes through, so the type and size made the difference above
    await assertSucceeds(upload(mark(), 'envs/live/uploads/mark-uid/photo-mark-reese-3.jpg'));
  });

  it('takes nothing outside envs/live and envs/dev uploads', async () => {
    await assertFails(upload(mark(), 'envs/prod/uploads/mark-uid/photo-mark-reese-4.jpg'));
    await assertFails(upload(mark(), 'envs/live/photo-mark-reese-4.jpg'));
    await assertFails(upload(mark(), 'photo-mark-reese-4.jpg'));
  });

  it('never replaces an upload: each new one gets its own name', async () => {
    await assertSucceeds(upload(mark(), 'envs/live/uploads/mark-uid/photo-mark-reese-5.jpg'));
    await assertFails(upload(mark(), 'envs/live/uploads/mark-uid/photo-mark-reese-5.jpg'));
  });

  it('lets signed-in people read uploads, and owners delete theirs', async () => {
    await assertSucceeds(upload(mark(), 'envs/live/uploads/mark-uid/photo-mark-reese-6.jpg'));
    await assertSucceeds(getMetadata(ref(justin(), 'envs/live/uploads/mark-uid/photo-mark-reese-6.jpg')));
    await assertFails(getMetadata(ref(signedOut(), 'envs/live/uploads/mark-uid/photo-mark-reese-6.jpg')));
    await assertFails(deleteObject(ref(justin(), 'envs/live/uploads/mark-uid/photo-mark-reese-6.jpg')));
    await assertSucceeds(deleteObject(ref(mark(), 'envs/live/uploads/mark-uid/photo-mark-reese-6.jpg')));
  });
});
