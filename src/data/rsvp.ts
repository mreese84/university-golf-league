// Who's coming on a trip (Phase 1, step 11): RSVPs from people who've joined the chapter, organizers'
// notes on invitees' answers, and pre-trip handicap indexes. Plain functions, tested without the
// database.

import { JOINED_STATUSES, type InviteNote, type Response, type RosterEntry, type Rsvp, type Trip } from './types';

// The order the lists show in
export const RESPONSES: Response[] = ['yes', 'maybe', 'invited', 'no'];

export const RESPONSE_LABELS: Record<Response, string> = { yes: 'Yes', maybe: 'Maybe', invited: 'No answer yet', no: 'No' };

// A trip that hasn't happened: its last day hasn't passed, or without dates, its month hasn't.
// today is YYYY-MM-DD.
export function isUpcoming(trip: Pick<Trip, 'dates' | 'year' | 'month'>, today: string) {
  if (trip.dates) return trip.dates[1] >= today;
  const [year, month] = today.split('-').map(Number);
  return trip.year > year || (trip.year === year && (trip.month || 12) >= month);
}

export interface RsvpRow {
  personId: string;
  response: Response;
  note: string | null;
  invitee: boolean; // hasn't joined the chapter: organizers only
  source: 'rsvp' | 'invite'; // where the answer is kept
}

// The trip's list: RSVPs, then organizers' invite notes for anyone without one (invitees, and
// people who joined after being invited). Only people on the roster count.
export function rsvpRows(
  rsvps: (Rsvp & { id: string })[],
  invites: (InviteNote & { id: string })[],
  roster: Record<string, RosterEntry>,
): RsvpRow[] {
  const joined = (id: string) => (JOINED_STATUSES as readonly string[]).includes(roster[id]?.status ?? '');
  const rows: RsvpRow[] = rsvps
    .filter((r) => joined(r.id))
    .map((r) => ({ personId: r.id, response: r.response, note: r.note ?? null, invitee: false, source: 'rsvp' }));
  const answered = new Set(rows.map((r) => r.personId));
  for (const n of invites) {
    if (answered.has(n.id) || !roster[n.id]) continue;
    rows.push({ personId: n.id, response: n.response, note: n.note ?? null, invitee: !joined(n.id), source: 'invite' });
  }
  return rows;
}

export function countsOf(rows: RsvpRow[]): Record<Response, number> {
  const counts: Record<Response, number> = { yes: 0, maybe: 0, invited: 0, no: 0 };
  for (const r of rows) counts[r.response] += 1;
  return counts;
}

// Who said yes and has joined: the trip's attendees, once the organizer makes them so
export const yesAttendees = (rows: RsvpRow[]) => rows.filter((r) => r.response === 'yes' && !r.invitee).map((r) => r.personId);

export const sameMembers = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));

// A handicap index as typed: "12.4", or "+2.1" for a plus handicap (stored as -2.1). Blank is none.
export function parseHandicap(text: string): { index: number | null; error: string | null } {
  const t = text.trim();
  if (!t) return { index: null, error: null };
  const m = t.match(/^(\+)?(\d{1,2}(?:\.\d)?)$/);
  if (!m) return { index: null, error: 'A number like 12.4, or +2.1 for a plus handicap.' };
  const value = Number(m[2]);
  if (m[1] ? value > 10 : value > 54) return { index: null, error: 'Handicap indexes go from +10.0 to 54.0.' };
  return { index: m[1] && value > 0 ? -value : value, error: null };
}

// The other way, for an input ("+2.1" for -2.1)
export const handicapText = (index: number | null | undefined) =>
  index === null || index === undefined ? '' : index < 0 ? `+${(-index).toFixed(1)}` : index.toFixed(1);
