// A chapter's trips and its selection draw, on the Phase 1 data. The draw's weighting is today's
// (src/eligibility.ts); what's new is that only active members are in it.

import type { RosterEntry, Trip } from '../data/types';
import { buildWeightedPool } from '../eligibility';
import { baseSlug } from '../tripSlugs';
import type { Trip as OldTrip } from '../types';

export type ChapterTrip = Trip & { id: string };

// Oldest first
export const byDate = (a: ChapterTrip, b: ChapterTrip) => a.year - b.year || (a.month ?? 0) - (b.month ?? 0) || a.id.localeCompare(b.id);

// A new trip's ID, which is its address and permanent: "2027-austin", or "2027-austin-2" if taken
export function newTripId(trip: { year: number; month: number; location: string }, existing: Iterable<string>) {
  const taken = new Set(existing);
  const base = baseSlug({ id: '', ...trip });
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

// What the trip form edits
export interface TripFields {
  year: number;
  month: number;
  location: string;
  attendeeIds: string[];
  selectedById: string;
  nextSelectorId: string | null;
}

const DEFAULT_THEME = { primary: '#15803d', onPrimary: '#ffffff' };

// A new trip, numbered after the chapter's others (a new chapter starts at 1). Guides, dates and
// competitions are added in later steps.
export function newTrip(fields: TripFields, trips: ChapterTrip[]): Trip {
  return {
    number: Math.max(0, ...trips.map((t) => t.number ?? 0)) + 1,
    title: `${fields.year} UGL Invitational`,
    dates: null,
    theme: DEFAULT_THEME,
    competition: false,
    ...fields,
  };
}

// The draw happens at the end of a trip: the newest trip without a result
export function pendingDraw(trips: ChapterTrip[]) {
  return [...trips].sort(byDate).reverse().find((t) => t.nextSelectorId === null) ?? null;
}

const asOld = (t: ChapterTrip): OldTrip => ({
  id: t.id,
  year: t.year,
  month: t.month,
  location: t.location,
  attendeeIds: t.attendeeIds,
  selectedById: t.selectedById ?? '',
  nextSelectorId: t.nextSelectorId,
});

export interface DrawEntry {
  personId: string;
  entries: number; // consecutive trips attended without choosing the location
}

// A trip's draw: attendees who didn't choose its location, with their entries. Only active members
// are in the draw; anyone else who attended (guests, alumni) is listed apart.
export function drawPool(trips: ChapterTrip[], tripId: string, roster: Record<string, RosterEntry | undefined>) {
  const ordered = [...trips].sort(byDate).map(asOld);
  const index = ordered.findIndex((t) => t.id === tripId);
  if (index < 0) return { pool: [] as DrawEntry[], left: [] as string[] };
  const all = buildWeightedPool(ordered, index).map(({ memberId, entries }) => ({ personId: memberId, entries }));
  return {
    pool: all.filter((e) => roster[e.personId]?.status === 'active'),
    left: all.filter((e) => roster[e.personId]?.status !== 'active').map((e) => e.personId),
  };
}

// Picks a name, each entry one ticket
export function drawFrom(pool: DrawEntry[], random: () => number = Math.random) {
  const tickets = pool.flatMap(({ personId, entries }) => Array<string>(entries).fill(personId));
  if (tickets.length === 0) throw new Error('No one is eligible for the draw.');
  return tickets[Math.floor(random() * tickets.length)];
}
