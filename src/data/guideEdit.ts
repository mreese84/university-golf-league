// Editing a trip's Player's Guide in the app (Phase 1, step 10): what each section's editor saves.
// Plain functions, so they're tested without the database.
//
// Teams, rounds and tee times are what the pairings draft and the published guide hang their
// players on: a team's ID keys its members and captain, and a round's tee times line up, one for
// one, with the draft's groups. So an edit keeps IDs, and takes the draft along when tee times or
// teams change. For a trip with results, the parts the record depends on are locked (see `locked`).

import type { GuideTeam } from '../types';
import { slugify } from './ids';
import type { Draft, GuideContent, TripFormat, TripRound, TripSession } from './types';

export const NO_FOOTBALL = { away: '', home: '', date: null, kickoff: null, line: null, venue: null };

// A new guide, with nothing in it yet
export function emptyGuide(): GuideContent {
  return {
    flights: [],
    teams: [],
    rounds: [],
    format: { name: '', summary: '', notes: [], sessions: [] },
    football: { ...NO_FOOTBALL },
    nightlife: [],
  };
}

// Nothing filled in yet, so members are told it isn't ready rather than shown an empty guide
export function isEmptyGuide(content: GuideContent) {
  return (
    content.flights.length === 0 &&
    content.teams.length === 0 &&
    content.rounds.length === 0 &&
    content.nightlife.length === 0 &&
    !content.format.name.trim() &&
    content.format.sessions.length === 0 &&
    !content.football.away.trim() &&
    !content.football.home.trim()
  );
}

// An ID from a name ("Team Palmetto" -> "palmetto"), unique among the taken ones
export function uniqueId(name: string, taken: Iterable<string>, fallback: string) {
  const used = new Set(taken);
  const base = slugify(name) || fallback;
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

export const teamIdFor = (name: string, taken: Iterable<string>) => uniqueId(name.replace(/^\s*team\s+/i, ''), taken, 'team');

// Pass every round the guide had before the edit as well as the ones in it, so a removed round's ID
// (and its sessions and Fireball counts) never passes to a new one
export function newRoundId(taken: Iterable<string>) {
  const used = new Set(taken);
  for (let n = 1; ; n++) if (!used.has(`r${n}`)) return `r${n}`;
}

// How many matches a session has: a team aggregate is one; match play is one per tee time in
// fourball and two in singles (each group of four plays two)
export function matchesFor(session: Pick<TripSession, 'scoring' | 'round'>, rounds: TripRound[]) {
  if (session.scoring === 'aggregate') return 1;
  const round = rounds.find((r) => r.id === session.round);
  const perGroup = round?.matchType === 'singles' ? 2 : round?.matchType === 'fourball' ? 1 : 0;
  return (round?.groups.length ?? 0) * perGroup;
}

// The trip has results, so its teams, rounds, sessions and scoring are what the record is built on.
// Names, houses, colors, rules and tee time text can still change; nothing can be added or removed.
export const lockedNote =
  'This trip has results, so its teams, rounds, sessions and scoring are locked. Names, houses, colors, rules and times can still change.';

// ── Teams ────────────────────────────────────────────────────────

// The teams as the editor leaves them: each keeps its published players and captain by ID, and
// the draft drops any team that's gone
export function applyTeams(content: GuideContent, draft: Draft | null, teams: Omit<GuideTeam, 'memberIds' | 'captainId'>[]) {
  const before = new Map(content.teams.map((t) => [t.id, t]));
  const next: GuideTeam[] = teams.map((t) => ({
    ...t,
    memberIds: before.get(t.id)?.memberIds ?? [],
    captainId: before.get(t.id)?.captainId ?? null,
  }));
  const ids = new Set(next.map((t) => t.id));
  const keep = <T,>(record: Record<string, T>) => Object.fromEntries(Object.entries(record).filter(([id]) => ids.has(id)));
  return {
    content: { ...content, teams: next },
    draft: draft && { ...draft, teams: keep(draft.teams), captains: keep(draft.captains) },
  };
}

// ── Rounds and tee times ─────────────────────────────────────────

// A tee time as the rounds editor leaves it, with the position it had before (null for a new one),
// so the players already in that group, published or in the draft, stay with it
export interface EditedTeeTime {
  time: string; // "10:00 AM"
  from: number | null;
}

export interface EditedRound extends Omit<TripRound, 'groups'> {
  teeTimes: EditedTeeTime[];
}

export function roundsForEditor(content: GuideContent): EditedRound[] {
  return content.rounds.map(({ groups, ...r }) => ({ ...r, teeTimes: groups.map((g, i) => ({ time: g.teeTime, from: i })) }));
}

// The rounds as the editor leaves them, in date order. Sessions on a removed round go with it;
// the rest recount their matches from the tee times (unless the trip has results). The draft's
// groups follow their tee times, and a removed round's groups go.
export function applyRounds(content: GuideContent, draft: Draft | null, edited: EditedRound[], locked: boolean) {
  const before = new Map(content.rounds.map((r) => [r.id, r]));
  const rounds: TripRound[] = edited
    .map(({ teeTimes, ...r }) => ({
      ...r,
      groups: teeTimes.map((t) => ({
        teeTime: t.time,
        playerIds: t.from === null ? [] : (before.get(r.id)?.groups[t.from]?.playerIds ?? []),
      })),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const kept = new Set(rounds.map((r) => r.id));
  const sessions = content.format.sessions
    .filter((s) => kept.has(s.round))
    .map((s) => (locked ? s : { ...s, matches: matchesFor(s, rounds) }));
  const draftRounds = draft
    ? Object.fromEntries(
        edited.flatMap((r) => {
          const groups = draft.rounds[r.id];
          if (!groups) return [];
          return [[r.id, r.teeTimes.map((t) => (t.from === null ? { playerIds: [] } : (groups[t.from] ?? { playerIds: [] })))]];
        }),
      )
    : {};
  return {
    content: { ...content, rounds, format: { ...content.format, sessions } },
    draft: draft && { ...draft, rounds: draftRounds },
  };
}

// ── Format and sessions ──────────────────────────────────────────

// The format as the editor leaves it; each session's matches come from its round's tee times
// (unless the trip has results)
export function applyFormat(content: GuideContent, format: Omit<TripFormat, 'sessions'> & { sessions: Omit<TripSession, 'matches'>[] }, locked: boolean) {
  const before = new Map(content.format.sessions.map((s) => [s.id, s]));
  const sessions: TripSession[] = format.sessions.map((s) => ({
    ...s,
    matches: locked ? (before.get(s.id)?.matches ?? 0) : matchesFor(s, content.rounds),
  }));
  return { ...content, format: { ...format, sessions } };
}

// ── Holes: par and stroke index ──────────────────────────────────

// "4 4 3 5 …" or "4,4,3,5,…" as 18 numbers; blank is none. Par is 3 to 6 a hole; stroke index
// is 1 to 18, each once.
export function parseHoles(text: string, kind: 'par' | 'strokeIndex'): { holes: number[] | null; error: string | null } {
  const parts = text.split(/[\s,]+/).filter(Boolean);
  if (parts.length === 0) return { holes: null, error: null };
  const holes = parts.map(Number);
  if (holes.some((n) => !Number.isInteger(n))) return { holes: null, error: 'Whole numbers only, separated by spaces or commas.' };
  if (holes.length !== 18) return { holes: null, error: `${holes.length} of 18 holes.` };
  if (kind === 'par' && holes.some((n) => n < 3 || n > 6)) return { holes: null, error: 'Each hole is a par 3 to 6.' };
  if (kind === 'strokeIndex' && [...holes].sort((a, b) => a - b).some((n, i) => n !== i + 1)) {
    return { holes: null, error: 'Stroke index uses 1 to 18, each once.' };
  }
  return { holes, error: null };
}

export const holesText = (holes: number[] | undefined) => (holes ? holes.join(' ') : '');

// ── Times ────────────────────────────────────────────────────────

// The guide stores times as on a ticket ("10:00 AM"); time inputs use "10:00"
export function toClock(input: string) {
  const m = input.match(/^(\d{2}):(\d{2})/);
  if (!m) return '';
  const hours = Number(m[1]);
  return `${hours % 12 || 12}:${m[2]} ${hours < 12 ? 'AM' : 'PM'}`;
}

export function fromClock(time: string | null | undefined) {
  const m = time?.trim().match(/^(\d{1,2}):(\d{2})\s*([AP])M$/i);
  if (!m) return '';
  const hours = (Number(m[1]) % 12) + (m[3].toUpperCase() === 'P' ? 12 : 0);
  return `${String(hours).padStart(2, '0')}:${m[2]}`;
}

// Firestore turns away undefined fields; this drops them (and copies the data)
export const withoutUndefined = <T,>(data: T): T => JSON.parse(JSON.stringify(data)) as T;
