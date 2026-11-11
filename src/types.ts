export interface Member {
  id: string;
  name: string;
  college?: string; // shown on their Player's Guide profile
}

export interface Trip {
  id: string;
  year: number;
  month: number; // 1–12
  location: string;
  attendeeIds: string[];
  selectedById: string; // member who chose THIS trip's location
  nextSelectorId: string | null; // member drawn at end of this trip (null = not yet drawn)
  hasGuide?: boolean; // a Player's Guide exists (its content is members-only, stored in guides/{tripId})
}

// ── Player's Guide ──────────────────────────────────────────────
// Stored per trip in Firestore `guides/{tripId}`, readable by members only.
// Dates are YYYY-MM-DD; null means TBD.

export type Emblem = 'palmetto' | 'crescent';

export interface GuideTheme {
  primary: string; // main color (hex), e.g. from the host state's flag
  onPrimary: string; // text color on top of primary
}

export interface GuideFlight {
  direction: 'departure' | 'return';
  date: string;
  flight: string; // e.g. "AA 1234"
  from: string | null; // airport code
  to: string | null;
  departs: string | null; // local time, e.g. "7:15 AM"
  arrives: string | null;
}

export interface GuideTeam {
  id: string;
  name: string; // "Team Palmetto"
  house: string; // "The Palmetto House"
  address: string;
  color: string; // hex
  emblem?: Emblem;
  memberIds: string[]; // empty = teams not set yet
  captainId?: string | null;
}

// How a tee time's four slots are read:
// fourball = [0,1] vs [2,3]; singles = 0 vs 1 and 2 vs 3; casual = just a group
export type MatchType = 'fourball' | 'singles' | 'casual';

export interface GuideGroup {
  teeTime: string; // "10:00 AM"
  playerIds: (string | null)[]; // empty or null slots = pairings TBD
}

export interface GuideRound {
  id: string;
  date: string;
  course: string;
  label: string; // "Day 1 · 2-Man Net Best Ball"
  matchType: MatchType;
  groups: GuideGroup[];
  fee?: string | null; // estimated green + cart fee per player, e.g. "$60"
  website?: string | null;
  address?: string | null; // for directions; falls back to the course name and trip location
}

export interface GuideSession {
  day: string; // "Day 1"
  name: string; // "2-Man Net Best Ball"
  points: number;
  rules: string[];
}

export interface GuideFormat {
  name: string; // "Modified Ryder Cup"
  summary: string;
  notes: string[];
  sessions: GuideSession[];
  pointsToWin: number;
}

export interface GuideFootball {
  espnEventId?: string | null; // when set, live game details come from ESPN; the fields below are the fallback
  away: string;
  home: string;
  date: string | null;
  kickoff: string | null; // "7:30 PM ET"
  line: string | null;
  venue: string | null;
}

export interface GuideNight {
  date: string;
  plan: string | null;
  note?: string;
  place?: string | null; // venue name; adds a directions link
  address?: string | null; // for directions; falls back to the place name and trip location
  website?: string | null;
}

export interface PlayerGuide {
  title: string; // "2026 UGL Invitational"
  location: string; // "Columbia, SC"
  timeZone?: string; // IANA zone for the trip's times; defaults from the location's state (see guide/timeZones.ts)
  theme: GuideTheme;
  dates?: [string, string] | null; // the trip's first and last day; the header shows them when set
  flights: GuideFlight[];
  teams: GuideTeam[];
  rounds: GuideRound[];
  format: GuideFormat;
  football: GuideFootball;
  nightlife: GuideNight[];
  handicaps?: Record<string, number>; // memberId -> handicap; copied from the draft only when teams are published
}

// ── Teams & pairings draft ──────────────────────────────────────
// Admin-only, in Firestore `guideDrafts/{tripId}`. When published, its teams and
// groups are copied into the guide; otherwise members see TBD.

export interface DraftGroup {
  playerIds: (string | null)[]; // same slot order as GuideGroup
}

export interface GuideDraft {
  published: boolean;
  handicaps: Record<string, number>; // memberId -> handicap index
  captains: Record<string, string>; // teamId -> memberId
  teams: Record<string, string[]>; // teamId -> memberIds
  rounds: Record<string, DraftGroup[]>; // roundId -> one entry per tee time
}
