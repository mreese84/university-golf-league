import type { RosterEntry } from '../data/types';

const STATUS_LABELS: Record<RosterEntry['status'], string> = {
  active: 'Active member',
  alumni: 'Alumni',
  guest: 'Guest',
  invitee: 'Invited',
};

// Someone's place in a chapter: "Active member · Organizer"
export const describeEntry = (entry: RosterEntry | null) =>
  entry ? [STATUS_LABELS[entry.status], entry.role === 'organizer' ? 'Organizer' : null].filter(Boolean).join(' · ') : null;
