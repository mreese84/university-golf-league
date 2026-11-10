// The Founder's Chapter as the move-over left it, saved before the move-over code and the history
// files left the repo (Phase 1, step 9c): people, roster, and both trips with UGL2's guide, draft,
// handicaps, Fireball counts and every match. Paths are as in a chapter backup (src/data/backup.ts),
// relative to envs/<env>. No emails. ugl2-history.json is what the history pages showed for UGL2
// from the files: standings, records, partners, opponents and awards.

import type { ChapterTripRecord } from '../../src/data/history.ts';
import type { GuideContent, Match, Person, Trip } from '../../src/data/types.ts';
import docs from './founders.json';

const all = docs as Record<string, unknown>;

export const doc = <T>(path: string) => all[path] as T;

export function foundersChapter() {
  const people: { id: string; person: Person }[] = [];
  const trips = new Map<string, ChapterTripRecord>();
  const tripOf = (id: string) => {
    if (!trips.has(id)) trips.set(id, { id, trip: null as unknown as Trip, guide: null, handicaps: {}, matches: [] });
    return trips.get(id)!;
  };
  for (const [path, data] of Object.entries(all)) {
    const parts = path.split('/');
    if (parts[0] === 'people' && parts.length === 2) people.push({ id: parts[1], person: data as Person });
    if (parts[0] !== 'chapters' || parts[2] !== 'trips') continue;
    const [tripId, sub, id] = parts.slice(3);
    const record = tripOf(tripId);
    if (!sub) record.trip = data as Trip;
    else if (sub === 'content' && id === 'guide') record.guide = data as GuideContent;
    else if (sub === 'handicaps') record.handicaps[id] = (data as { index: number }).index;
    else if (sub === 'matches') record.matches.push({ ...(data as Match), id });
  }
  return { people, trips: [...trips.values()] };
}
