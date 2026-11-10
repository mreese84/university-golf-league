import { doc, getDoc, type Firestore } from 'firebase/firestore';
import { pathsFor } from '../data/paths';
import type { DataEnv, RosterEntry } from '../data/types';
import { completeJoin } from '../data/writes';

// An invitee's first sign-in: in each chapter that invited them, they join as what the organizer
// invited them as (active member or guest). Returns the chapters joined. Safe to run again: a chapter
// they've already joined is skipped.
export async function completeInvitations(db: Firestore, env: DataEnv, personId: string, invitedTo: string[]) {
  const joined: string[] = [];
  for (const chapterId of invitedTo) {
    const snap = await getDoc(doc(db, pathsFor(env).rosterEntry(chapterId, personId)));
    const entry = snap.data() as RosterEntry | undefined;
    if (entry?.status === 'invitee' && entry.joinsAs) {
      await completeJoin(db, env, chapterId, personId, entry.joinsAs);
      joined.push(chapterId);
    }
  }
  return joined;
}
