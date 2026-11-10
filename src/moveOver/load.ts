// Reads today's live data for the move-over: always the live collections (app/data, guides, …),
// whichever copy of the new layout the page writes to. Only reads; nothing here changes them.
// Needs the commissioner signed in (today's rules let only the admin read all of it).

import { collection, doc, getDoc, getDocs, type Firestore } from 'firebase/firestore';
import type { GuideDraft, Member, PlayerGuide, Trip } from '../types';
import type { OldData } from './transform';

export interface LoadedOldData {
  old: OldData;
  backup: Record<string, unknown>; // everything read, document by document, for the backup download
}

export async function loadOldData(db: Firestore): Promise<LoadedOldData> {
  const backup: Record<string, unknown> = {};
  const one = async (path: string) => {
    const snap = await getDoc(doc(db, path));
    if (snap.exists()) backup[path] = snap.data();
    return snap.exists() ? snap.data() : null;
  };
  const all = async (path: string) => {
    const snap = await getDocs(collection(db, path));
    for (const d of snap.docs) backup[d.ref.path] = d.data();
    return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  };

  const app = (await one('app/data')) as { members?: Member[]; trips?: Trip[] } | null;
  const access = (await one('access/members')) as { byMember?: Record<string, string> } | null;
  const guides = await all('guides');
  const drafts = await all('guideDrafts');
  const profiles = await all('profiles');
  const trips = app?.trips ?? [];
  const fireball: OldData['fireball'] = {};
  for (const t of trips) {
    const players = await all(`fireball/${t.id}/players`);
    if (players.length) fireball[t.id] = Object.fromEntries(players.map((p) => [p.id, (p.data.counts ?? {}) as Record<string, number>]));
  }

  return {
    backup,
    old: {
      members: app?.members ?? [],
      trips,
      emails: access?.byMember ?? {},
      guides: Object.fromEntries(guides.map((g) => [g.id, g.data as PlayerGuide])),
      drafts: Object.fromEntries(drafts.map((d) => [d.id, d.data as GuideDraft])),
      fireball,
      bios: Object.fromEntries(profiles.flatMap((p) => (typeof p.data.bio === 'string' && p.data.bio.trim() ? [[p.id, p.data.bio]] : []))),
    },
  };
}
