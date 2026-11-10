import type { Person, RosterEntry } from '../../data/types';
import { JOINED_STATUSES } from '../../data/types';
import type { LoadStatus } from '../../data/hooks';
import type { ChapterTrip } from '../chapterTrips';

// Everything the chapter's tabs share, loaded once by the chapter page
export interface ChapterData {
  chapterId: string;
  canManage: boolean; // an organizer here, or an admin
  isAdmin: boolean;
  personId: string | null;
  uid: string;
  roster: (RosterEntry & { id: string })[]; // invitees too, for organizers and admins
  rosterById: Record<string, RosterEntry>;
  people: Record<string, Person>;
  trips: ChapterTrip[];
  tripsStatus: LoadStatus;
}

export const nameOf = (data: ChapterData, id: string | null | undefined) => (id ? (data.people[id]?.name ?? '…') : '—');

export const photoUrl = (person: Person | undefined) => (person?.photo ? `${import.meta.env.BASE_URL}${person.photo}` : null);

export const hasJoined = (entry: RosterEntry | undefined) => !!entry && (JOINED_STATUSES as readonly string[]).includes(entry.status);

// People who've joined, by name: for picking attendees and the like
export const joinedPeople = (data: ChapterData) =>
  data.roster
    .filter(hasJoined)
    .map((e) => ({ id: e.id, name: data.people[e.id]?.name ?? e.id }))
    .sort((a, b) => a.name.localeCompare(b.name));

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const tripDate = (t: { year: number; month: number }) => `${t.month ? `${MONTHS[t.month - 1]} ` : ''}${t.year}`;
