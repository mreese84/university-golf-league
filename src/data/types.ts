// The Phase 1 database layout (docs/phase-1-plan.md, "Database layout"). Everything sits under
// envs/live (the live site) or envs/dev (dev server and previews); see paths.ts. Who may read and
// change each document is enforced by firestore.rules, in the `match /envs/{env}` block.

import type { FieldValue, Timestamp } from 'firebase/firestore';
import type { MatchFile, Scoring } from '../history/types';
import type { DraftGroup, GuideFlight, GuideFootball, GuideNight, GuideRound, GuideTeam, GuideTheme } from '../types';

// Which copy of the data: the live site's, or the dev server's and previews' (see src/dataEnv.ts)
export type DataEnv = 'live' | 'dev';

// Written as serverTimestamp(), read back as a Timestamp
export type Stamp = FieldValue | Timestamp;

// ── People and sign-in ──────────────────────────────────────────

// config/admins: the co-admins. The commissioner is fixed in the rules by email.
export interface AdminsConfig {
  personIds: string[];
}

// logins/{email}: one per email address (lowercase), so a sign-in can find its person
export interface Login {
  personId: string;
}

// people/{personId}: one per person, whatever chapters they're in. The IDs are permanent and readable
// ("mark-reese"), as in the history files.
export interface Person {
  name: string; // "Mark Reese"
  college: string | null;
  bio: string | null;
  ghin: string | null; // GHIN number, linked to the official lookup
  photo: string | null; // a file under public/ for now ("profiles/mark-reese.jpg"); uploads come in Phase 2
  // These three mirror the rosters so the rules can check "shares a chapter" in one lookup. The rules
  // reject roster changes that would leave them out of step.
  chapterIds: string[]; // chapters they've joined
  invitedTo: string[]; // chapters that invited them, until their first sign-in
  organizerOf: string[]; // chapters they organize (only admins change this)
  updatedAt?: Stamp;
}

// The fields a person can change on their own profile
export const SELF_EDITABLE = ['bio', 'college', 'ghin', 'photo'] as const;

// people/{personId}/private/contact: their email addresses, seen only by them, admins and their
// chapters' organizers. Each one also has a logins/{email} record.
export interface Contact {
  emails: string[];
}

// ── Chapters ────────────────────────────────────────────────────

export interface Chapter {
  name: string; // "The Founder's Chapter"
  createdAt?: Stamp;
}

export type Role = 'organizer' | 'member';
export type Status = 'active' | 'alumni' | 'guest' | 'invitee';
export type JoinedStatus = Exclude<Status, 'invitee'>;
export const JOINED_STATUSES: readonly JoinedStatus[] = ['active', 'alumni', 'guest'];

// chapters/{chapterId}/members/{personId}. Invitees are hidden from members; on their first sign-in
// they join as `joinsAs`.
export interface RosterEntry {
  role: Role;
  status: Status;
  joinsAs?: 'active' | 'guest'; // invitees only
  since?: string | null; // YYYY-MM-DD
}

// chapterRequests/{requestId}: anyone signed in can ask for a chapter; an admin decides
export interface ChapterRequest {
  name: string; // the chapter's proposed name
  note: string | null;
  requestedBy: { uid: string; email: string; name: string | null };
  status: 'pending' | 'approved' | 'declined';
  decidedBy?: string; // admin's person ID
  chapterId?: string; // once approved
  createdAt?: Stamp;
}

// ── Trips ───────────────────────────────────────────────────────

// chapters/{chapterId}/trips/{tripId}. The trip ID is its address ("2026-columbia") and permanent.
export interface Trip {
  number: number | null; // per chapter: 2 = UGL2
  title: string; // "2026 UGL Invitational"
  year: number;
  month: number; // 1–12
  location: string; // "Columbia, SC"
  dates: [string, string] | null; // first and last day, YYYY-MM-DD
  timeZone?: string;
  theme: GuideTheme;
  competition: boolean; // false for trips with no matches (UGL1)
  attendeeIds: string[];
  selectedById: string | null; // who chose this trip's location
  nextSelectorId: string | null; // drawn at the end of this trip
}

// A round in the guide, and in the history once it has par and stroke index
export interface TripRound extends GuideRound {
  par?: number[];
  strokeIndex?: number[];
}

// What's played for points: the guide's format sessions and the history's sessions, as one
export interface TripSession {
  id: string; // "fourball"
  round: string; // round ID
  name: string; // "2-Man Net Best Ball"
  format: string; // groups records across years
  scoring: Scoring;
  points: number; // per match
  matches: number;
  strokes?: 'full' | 'difference';
  basis?: 'net' | 'gross';
  rules: string[];
}

export interface TripFormat {
  name: string; // "Modified Ryder Cup"
  summary: string;
  notes: string[];
  sessions: TripSession[];
}

// chapters/{chapterId}/trips/{tripId}/content/guide: the Player's Guide
export interface GuideContent {
  flights: GuideFlight[];
  teams: GuideTeam[]; // published teams; empty member lists until then
  rounds: TripRound[];
  format: TripFormat;
  football: GuideFootball;
  nightlife: GuideNight[];
}

// …/private/draft: teams and pairings, organizers only until published
export interface Draft {
  published: boolean;
  captains: Record<string, string>; // team ID -> person ID
  teams: Record<string, string[]>; // team ID -> person IDs
  rounds: Record<string, DraftGroup[]>; // round ID -> one entry per tee time
}

// …/handicaps/{personId}: the pre-trip index, entered by the player or an organizer
export interface Handicap {
  index: number; // plus handicaps are negative (+2.0 = -2)
  updatedBy?: string; // person ID
  updatedAt?: Stamp;
}

export type Response = 'invited' | 'yes' | 'maybe' | 'no';

// …/rsvps/{personId}: for people who've joined; members see these
export interface Rsvp {
  response: Response;
  note?: string | null;
  updatedAt?: Stamp;
}

// …/invites/{personId}: an organizer's notes on invitees' answers; organizers only
export type InviteNote = Rsvp;

// …/fireball/{personId}
export interface FireballEntry {
  counts: Record<string, number>; // round ID or "off" -> shots
  updatedAt?: Stamp;
}

// …/matches/{matchId}: one match, as in today's history match files ("fourball-1")
export type Match = MatchFile;
