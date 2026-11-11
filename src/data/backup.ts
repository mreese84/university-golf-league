// A chapter's backup, for its organizers to keep: every document in it, by path.

import { collection, doc, getDoc, getDocs, type Firestore } from 'firebase/firestore';
import { pathsFor } from './paths';
import type { DataEnv } from './types';
import { TRIP_PARTS } from './writes';

export interface ChapterBackup {
  kind: 'ugl-chapter-backup';
  version: 1;
  env: DataEnv;
  chapterId: string;
  exportedAt: string; // ISO time
  // Path under envs/<env> → the document, so a copy can be written back as it was. Times come out
  // as { seconds, nanoseconds }.
  docs: Record<string, unknown>;
}

// The chapter, its roster (invitees too), each person's record and sign-in emails, and every trip,
// draft trips too, with everything in it (guide, pairings draft, handicaps, RSVPs, invites, Fireball
// counts, results). Organizers and admins only: members can't read drafts, invitees or emails.
export async function exportChapter(db: Firestore, env: DataEnv, chapterId: string): Promise<ChapterBackup> {
  const p = pathsFor(env);
  const docs: Record<string, unknown> = {};
  const relative = (path: string) => path.slice(p.root.length + 1);
  const one = async (path: string) => {
    const snap = await getDoc(doc(db, path));
    if (snap.exists()) docs[relative(path)] = snap.data();
  };
  const all = async (path: string) => {
    const snap = await getDocs(collection(db, path));
    for (const d of snap.docs) docs[relative(d.ref.path)] = d.data();
    return snap.docs.map((d) => d.id);
  };

  await one(p.chapter(chapterId));
  const personIds = await all(p.roster(chapterId));
  await Promise.all(personIds.flatMap((id) => [one(p.person(id)), one(p.contact(id))]));
  const tripIds = [...(await all(p.trips(chapterId))), ...(await all(p.draftTrips(chapterId)))];
  await Promise.all(tripIds.flatMap((t) => TRIP_PARTS.map((part) => all(`${p.trip(chapterId, t)}/${part}`))));

  const sorted = Object.fromEntries(Object.keys(docs).sort().map((k) => [k, docs[k]]));
  return { kind: 'ugl-chapter-backup', version: 1, env, chapterId, exportedAt: new Date().toISOString(), docs: sorted };
}
