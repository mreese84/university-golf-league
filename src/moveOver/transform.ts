// Moves today's data into The Founder's Chapter (Phase 1, step 4). A plain function: what's in the
// database and the history files today, plus Mark's choices about people, in; the new layout's
// documents out. The Move-over page runs it and writes the result; tests/moveOver.test.ts checks
// that UGL2's records come out exactly as the history files have them.

import { COMMISSIONER_EMAIL } from '../data/commissioner';
import { historyFromChapter, type ChapterTripRecord } from '../data/history';
import { personIdFor, slugify } from '../data/ids';
import { normalizeEmail, pathsFor } from '../data/paths';
import type {
  DataEnv,
  Draft,
  GuideContent,
  JoinedStatus,
  Match,
  Person,
  Role,
  RosterEntry,
  Trip,
  TripRound,
  TripSession,
} from '../data/types';
import type { HistoryData, HistoryEvent, HistoryPlayer } from '../history/types';
import { tripSlugs } from '../tripSlugs';
import type { GuideDraft, GuideFootball, GuideTeam, GuideTheme, MatchType, Member, PlayerGuide, Trip as OldTrip } from '../types';

export const FOUNDERS = 'founders';
export const FOUNDERS_NAME = "The Founder's Chapter";

// From the decisions doc: UGL2's pre-trip index changes for four players when it's moved over.
// Everyone else keeps event.json's number. Scorecard strokes and results don't change.
export const PRE_TRIP_HANDICAPS: Record<string, Record<string, number>> = {
  '2026-columbia': { 'mark-reese': 16.6, 'justin-thompson': 4.0, 'jason-sudan': 18.0, 'patrick-bohac': 15.6 },
};

const DEFAULT_THEME: GuideTheme = { primary: '#15803d', onPrimary: '#ffffff' };
const NO_FOOTBALL: GuideFootball = { away: '', home: '', date: null, kickoff: null, line: null, venue: null };

// ── Today's data ────────────────────────────────────────────────

export interface OldData {
  members: Member[]; // app/data
  trips: OldTrip[]; // app/data
  emails: Record<string, string>; // member ID -> email (access/members)
  guides: Record<string, PlayerGuide>; // old trip ID -> guide (guides)
  drafts: Record<string, GuideDraft>; // old trip ID -> draft (guideDrafts)
  fireball: Record<string, Record<string, Record<string, number>>>; // old trip ID -> member ID -> counts
  bios: Record<string, string>; // profile key (history ID, or "member-<member ID>") -> bio (profiles)
}

// ── People ──────────────────────────────────────────────────────

// Who a member (or someone who's only in the history) becomes
export interface PersonChoice {
  memberId: string | null; // null: in the history but not on today's member list
  memberName: string | null; // "Mark R"
  historyId: string | null; // the matching history player, whose ID becomes the person ID
  personId: string;
  name: string; // full name
  needsName: boolean; // no history match: today's short name stands in until Mark gives a full one
  email: string | null;
  status: JoinedStatus;
  role: Role;
}

// The history player for a member: "Mark R" -> Mark Reese (first name and last initial), or
// undefined when there isn't exactly one (the same matching the guide uses today)
export function findHistoryPlayer(memberName: string, players: HistoryPlayer[]) {
  const [first, ...rest] = memberName.trim().toLowerCase().split(/\s+/);
  const initial = rest.at(-1)?.[0];
  const matches = players.filter((p) => {
    const parts = p.name.toLowerCase().split(/\s+/);
    return parts[0] === first && (!initial || parts.at(-1)?.[0] === initial);
  });
  return matches.length === 1 ? matches[0] : undefined;
}

// A first suggestion for everyone: members matched to history players keep the history ID and full
// name; members without a match need a full name; people only in the history come in as guests.
// The commissioner organizes the chapter; everyone else on the member list is an active member.
export function suggestPeople(old: OldData, history: HistoryData): PersonChoice[] {
  const taken = new Set(history.players.map((p) => p.id));
  const matched = new Set<string>();
  const rows: PersonChoice[] = old.members.map((m) => {
    const player = findHistoryPlayer(m.name, history.players);
    const email = old.emails[m.id] ? normalizeEmail(old.emails[m.id]) : null;
    const role: Role = email === COMMISSIONER_EMAIL ? 'organizer' : 'member';
    const base = { memberId: m.id, memberName: m.name, email, status: 'active' as const, role };
    if (player && !matched.has(player.id)) {
      matched.add(player.id);
      return { ...base, historyId: player.id, personId: player.id, name: player.name, needsName: false };
    }
    const personId = personIdFor(m.name, taken);
    taken.add(personId);
    return { ...base, historyId: null, personId, name: m.name, needsName: true };
  });
  for (const p of history.players) {
    if (matched.has(p.id)) continue;
    rows.push({ memberId: null, memberName: null, historyId: p.id, personId: p.id, name: p.name, needsName: false, email: null, status: 'guest', role: 'member' });
  }
  return rows;
}

// A new full name for someone without a history match, with their ID worked out again from it
export function renamePerson(rows: PersonChoice[], index: number, name: string): PersonChoice[] {
  const row = rows[index];
  if (row.historyId) return rows.map((r, i) => (i === index ? { ...r, name } : r)); // history IDs stay
  const taken = rows.filter((_, i) => i !== index).map((r) => r.personId);
  return rows.map((r, i) => (i === index ? { ...r, name, personId: personIdFor(name, taken) } : r));
}

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Someone without a history match still has only today's short name ("Zed Q")
export const needsFullName = (r: PersonChoice) => r.needsName && (r.name.trim().split(/\s+/).at(-1)?.length ?? 0) < 2;

// What has to be fixed before writing
export function problemsWith(rows: PersonChoice[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const label = r.memberName ?? r.name;
    if (!r.name.trim()) problems.push(`${label} needs a name.`);
    else if (needsFullName(r)) {
      problems.push(`${label} needs a full name (first and last), since it becomes their permanent ID.`);
    }
    if (!ID.test(r.personId)) problems.push(`${label}'s ID "${r.personId}" isn't valid.`);
    if (seen.has(r.personId)) problems.push(`Two people would have the ID "${r.personId}".`);
    seen.add(r.personId);
  }
  if (!rows.some((r) => r.role === 'organizer')) problems.push('The chapter needs at least one organizer.');
  return problems;
}

// ── The move ────────────────────────────────────────────────────

export interface MovedDoc {
  path: string;
  data: Record<string, unknown>;
}

export interface MoveOverResult {
  // In the order they must be written: people before their roster entries, roster entries before
  // the per-player records the rules check them against
  docs: MovedDoc[];
  warnings: string[];
  counts: Record<string, number>;
}

// Firestore rejects undefined values; the data is plain JSON otherwise
const clean = <T>(data: T) => JSON.parse(JSON.stringify(data)) as Record<string, unknown>;

export function buildFoundersChapter(old: OldData, history: HistoryData, rows: PersonChoice[], env: DataEnv): MoveOverResult {
  const P = pathsFor(env);
  const warnings: string[] = [];
  const counts: Record<string, number> = {};
  const phases = { chapter: [], people: [], logins: [], roster: [], trips: [], content: [], players: [] } as Record<string, MovedDoc[]>;
  const put = (phase: string, kind: string, path: string, data: object) => {
    phases[phase].push({ path, data: clean(data) });
    counts[kind] = (counts[kind] ?? 0) + 1;
  };

  // Member IDs and history IDs to person IDs
  const byMember = new Map(rows.flatMap((r) => (r.memberId ? [[r.memberId, r.personId] as const] : [])));
  const onRoster = new Set(rows.map((r) => r.personId));
  const missing = new Set<string>();
  const fromMember = (memberId: string | null | undefined): string | null => {
    if (!memberId) return null;
    const id = byMember.get(memberId);
    if (!id && !missing.has(memberId)) {
      missing.add(memberId);
      warnings.push(`Member ID ${memberId} is referred to but isn't on the member list, so it's left out.`);
    }
    return id ?? null;
  };
  const present = <T>(x: T | null): x is T => x !== null;

  // The chapter and its people
  put('chapter', 'chapter', P.chapter(FOUNDERS), { name: FOUNDERS_NAME });
  const emailsSeen = new Map<string, string>();
  for (const r of rows) {
    const member = old.members.find((m) => m.id === r.memberId);
    const player = history.players.find((p) => p.id === r.historyId);
    const bio = (r.historyId && old.bios[r.historyId]) || (r.memberId && old.bios[`member-${r.memberId}`]) || null;
    const person: Person = {
      name: r.name.trim(),
      college: member?.college?.trim() || null,
      bio: bio?.trim() || null,
      ghin: null,
      photo: player?.photo ?? null,
      chapterIds: [FOUNDERS],
      invitedTo: [],
      organizerOf: r.role === 'organizer' ? [FOUNDERS] : [],
    };
    put('people', 'people', P.person(r.personId), person);
    if (r.email) {
      if (emailsSeen.has(r.email)) {
        warnings.push(`${r.email} is on the member list for both ${emailsSeen.get(r.email)} and ${r.name}; only the first keeps it.`);
      } else {
        emailsSeen.set(r.email, r.name);
        put('logins', 'contact records', P.contact(r.personId), { emails: [r.email] });
        put('logins', 'logins', P.login(r.email), { personId: r.personId });
      }
    }
    const entry: RosterEntry = { role: r.role, status: r.status, since: null };
    put('roster', 'roster entries', P.rosterEntry(FOUNDERS, r.personId), entry);
  }

  // Trips, numbered in date order unless the history says otherwise
  const slugs = tripSlugs(old.trips);
  const ordered = [...old.trips].sort((a, b) => a.year - b.year || (a.month ?? 0) - (b.month ?? 0));
  const movedEvents = new Set<string>();
  ordered.forEach((t, i) => {
    const tripId = slugs.get(t.id)!;
    const event = history.events.find((e) => e.id === tripId);
    const guide = old.guides[t.id];
    const draft = old.drafts[t.id];
    if (event) movedEvents.add(event.id);
    if (event && event.edition !== i + 1) {
      warnings.push(`${tripId}: the history calls it UGL${event.edition}, but it's trip ${i + 1} by date; keeping UGL${event.edition}.`);
    }

    const content = guide || event ? contentFor(tripId, guide, event, fromMember, warnings) : null;
    const trip: Trip = {
      number: event?.edition ?? i + 1,
      title: guide?.title ?? event?.title ?? `${t.year} UGL`,
      year: t.year,
      month: t.month ?? 0,
      location: t.location,
      dates: event?.dates ?? datesOf(content?.guide.rounds ?? []),
      ...(guide?.timeZone ? { timeZone: guide.timeZone } : {}),
      theme: guide?.theme ?? DEFAULT_THEME,
      competition: !!event,
      attendeeIds: t.attendeeIds.map(fromMember).filter(present),
      selectedById: fromMember(t.selectedById),
      nextSelectorId: fromMember(t.nextSelectorId),
    };
    put('trips', 'trips', P.trip(FOUNDERS, tripId), trip);
    if (content) {
      put('content', 'guides', P.guide(FOUNDERS, tripId), content.guide);
      if (draft) put('content', 'pairings drafts', P.draft(FOUNDERS, tripId), draftFor(draft, content.teamIds, fromMember, event));
    }

    // Pre-trip handicaps: the history's (with UGL2's four changes), or else the draft's
    const handicaps: Record<string, number> = event
      ? { ...event.handicaps, ...(PRE_TRIP_HANDICAPS[tripId] ?? {}) }
      : Object.fromEntries(
          Object.entries(draft?.handicaps ?? guide?.handicaps ?? {}).flatMap(([m, h]) => {
            const id = fromMember(m);
            return id ? [[id, h]] : [];
          }),
        );
    for (const [personId, index] of Object.entries(handicaps)) {
      if (!onRoster.has(personId)) {
        warnings.push(`${tripId}: a handicap for ${personId}, who isn't on the roster, is left out.`);
        continue;
      }
      put('players', 'handicaps', P.handicap(FOUNDERS, tripId, personId), { index });
    }

    for (const [memberId, shots] of Object.entries(old.fireball[t.id] ?? {})) {
      const personId = fromMember(memberId);
      if (personId) put('players', 'Fireball counts', P.fireballEntry(FOUNDERS, tripId, personId), { counts: shots });
    }

    for (const m of event?.matches ?? []) {
      const { id: matchId, ...match } = m;
      put('content', 'matches', P.match(FOUNDERS, tripId, matchId), match satisfies Match);
    }
  });

  for (const e of history.events) {
    if (!movedEvents.has(e.id)) warnings.push(`The history's ${e.id} has no trip on the trip list, so its results aren't moved.`);
  }

  const docs = ['chapter', 'people', 'logins', 'roster', 'trips', 'content', 'players'].flatMap((phase) => phases[phase]);
  return { docs, warnings, counts };
}

// ── A trip's guide, joined with its history ─────────────────────

function datesOf(rounds: TripRound[]): [string, string] | null {
  const dates = rounds.map((r) => r.date).filter(Boolean).sort();
  return dates.length ? [dates[0], dates[dates.length - 1]] : null;
}

function matchTypeFor(event: HistoryEvent, roundId: string): MatchType {
  const formats = event.sessions.filter((s) => s.round === roundId).map((s) => s.format);
  return formats.includes('fourball') ? 'fourball' : formats.includes('singles') ? 'singles' : 'casual';
}

// The guide's content, with the history's par, stroke index, sessions, teams and players where the trip
// has a history. Guide round IDs are kept (Fireball counts use them); history rounds join them by date.
function contentFor(
  tripId: string,
  guide: PlayerGuide | undefined,
  event: HistoryEvent | undefined,
  fromMember: (id: string | null | undefined) => string | null,
  warnings: string[],
): { guide: GuideContent; teamIds: Map<string, string> } {
  // Rounds
  const rounds: TripRound[] = (guide?.rounds ?? []).map((r) => ({
    ...r,
    groups: r.groups.map((g) => ({ ...g, playerIds: g.playerIds.map((p) => fromMember(p)) })),
  }));
  const roundIds = new Map<string, string>(); // history round ID -> guide round ID
  for (const er of event?.rounds ?? []) {
    const match = rounds.find((r) => r.date === er.date && ![...roundIds.values()].includes(r.id));
    if (match) {
      roundIds.set(er.id, match.id);
      if (er.par) match.par = er.par;
      if (er.strokeIndex) match.strokeIndex = er.strokeIndex;
    } else {
      roundIds.set(er.id, er.id);
      rounds.push({
        id: er.id,
        date: er.date,
        course: er.course,
        label: er.label,
        matchType: matchTypeFor(event!, er.id),
        groups: [],
        ...(er.par ? { par: er.par } : {}),
        ...(er.strokeIndex ? { strokeIndex: er.strokeIndex } : {}),
      });
      if (guide) warnings.push(`${tripId}: the history's round on ${er.date} isn't in the guide, so it's added.`);
    }
  }
  rounds.sort((a, b) => a.date.localeCompare(b.date));

  // Sessions: the history's, with the guide's rules; or the guide's alone
  const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  let sessions: TripSession[];
  if (event) {
    // The guide and the history may word a session differently ("Singles Match Play" in the guide,
    // "Singles Net Match Play" in the history). Exact names match first; then names where one's words
    // all appear in the other's, preferring a guide session on the same day.
    const guideSessions = guide?.format.sessions ?? [];
    const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
    const similar = (a: string, b: string) => {
      const [x, y] = [words(a), words(b)];
      return x.length > 0 && y.length > 0 && (x.every((w) => y.includes(w)) || y.every((w) => x.includes(w)));
    };
    const dateOfDay = (day: string) => rounds.find((r) => r.label.startsWith(day))?.date;
    const guideFor = new Map<string, number>(); // history session ID -> index of its guide session
    const used = new Set<number>();
    for (const matches of [sameName, similar]) {
      for (const s of event.sessions) {
        if (guideFor.has(s.id)) continue;
        const date = event.rounds.find((r) => r.id === s.round)?.date;
        const candidates = guideSessions.flatMap((g, i) => (!used.has(i) && matches(g.name, s.name) ? [i] : []));
        const i = candidates.find((c) => date && dateOfDay(guideSessions[c].day) === date) ?? candidates[0];
        if (i !== undefined) {
          guideFor.set(s.id, i);
          used.add(i);
        }
      }
    }
    sessions = event.sessions.map((s) => ({
      id: s.id,
      round: roundIds.get(s.round) ?? s.round,
      name: s.name,
      format: s.format,
      scoring: s.scoring,
      points: s.points,
      matches: s.matches,
      ...(s.strokes ? { strokes: s.strokes } : {}),
      ...(s.basis ? { basis: s.basis } : {}),
      rules: guideFor.has(s.id) ? guideSessions[guideFor.get(s.id)!].rules : [],
    }));
    guideSessions.forEach((g, i) => {
      if (!used.has(i)) warnings.push(`${tripId}: the guide's "${g.name}" session isn't in the history, so its rules are left out.`);
    });
  } else {
    // The guide's own sessions, on the rounds the guide shows them on: the first day's sessions on
    // the first competition round, and so on. The guide gives each session's total points; they're
    // stored per match, as the history's are.
    const sessionDays = [...new Set((guide?.format.sessions ?? []).map((s) => s.day))];
    const competitionRounds = rounds.filter((r) => r.matchType !== 'casual');
    sessions = (guide?.format.sessions ?? []).map((s) => {
      const round = competitionRounds[sessionDays.indexOf(s.day)] ?? rounds.find((r) => r.label.startsWith(s.day)) ?? rounds[0];
      const id = slugify(s.name) || 'session';
      const perGroup = round?.matchType === 'singles' ? 2 : round?.matchType === 'fourball' ? 1 : 0;
      const matches = (round?.groups.length ?? 0) * perGroup;
      return { id, round: round?.id ?? '', name: s.name, format: id, scoring: 'match', points: matches > 0 ? s.points / matches : s.points, matches, rules: s.rules };
    });
  }

  // Teams: the history's players and captains, with the guide's houses
  const teamIds = new Map<string, string>(); // guide team ID -> team ID
  let teams: GuideTeam[];
  if (event) {
    teams = event.teams.map((et) => {
      const gt = guide?.teams.find((t) => t.id === et.id) ?? guide?.teams.find((t) => sameName(t.name, et.name));
      if (gt) teamIds.set(gt.id, et.id);
      const emblem = et.emblem ?? gt?.emblem;
      return {
        id: et.id,
        name: et.name,
        house: gt?.house ?? '',
        address: gt?.address ?? '',
        color: et.color,
        ...(emblem ? { emblem } : {}),
        memberIds: et.players,
        captainId: et.captain ?? null,
      };
    });
  } else {
    teams = (guide?.teams ?? []).map((t) => {
      teamIds.set(t.id, t.id);
      return { ...t, memberIds: t.memberIds.map(fromMember).filter((id): id is string => id !== null), captainId: fromMember(t.captainId) };
    });
  }

  return {
    teamIds,
    guide: {
      flights: guide?.flights ?? [],
      teams,
      rounds,
      format: { name: guide?.format.name ?? event?.format ?? '', summary: guide?.format.summary ?? '', notes: guide?.format.notes ?? [], sessions },
      football: guide?.football ?? NO_FOOTBALL,
      nightlife: guide?.nightlife ?? [],
    },
  };
}

// A guide file (today's Player's Guide JSON) as a trip's guide, with no one on a team or in a group
// yet: for organizers importing a guide until the guide editors arrive (step 10)
export function contentFromGuideFile(guide: PlayerGuide): GuideContent {
  return contentFor('import', guide, undefined, () => null, []).guide;
}

// For a trip with results, the draft's teams and captains are the history's: the guide's published
// teams are the record of who played, so publishing the draft again must never change them.
function draftFor(
  draft: GuideDraft,
  teamIds: Map<string, string>,
  fromMember: (id: string | null | undefined) => string | null,
  event?: HistoryEvent,
): Draft {
  const team = (id: string) => teamIds.get(id) ?? id;
  if (event) {
    return {
      published: draft.published,
      captains: Object.fromEntries(event.teams.flatMap((t) => (t.captain ? [[t.id, t.captain]] : []))),
      teams: Object.fromEntries(event.teams.map((t) => [t.id, t.players])),
      rounds: draftFor(draft, teamIds, fromMember).rounds,
    };
  }
  return {
    published: draft.published,
    captains: Object.fromEntries(
      Object.entries(draft.captains).flatMap(([t, m]) => {
        const id = fromMember(m);
        return id ? [[team(t), id]] : [];
      }),
    ),
    teams: Object.fromEntries(
      Object.entries(draft.teams).map(([t, ms]) => [team(t), ms.map(fromMember).filter((id): id is string => id !== null)]),
    ),
    rounds: Object.fromEntries(
      Object.entries(draft.rounds).map(([r, groups]) => [r, groups.map((g) => ({ playerIds: g.playerIds.map((p) => fromMember(p)) }))]),
    ),
  };
}

// ── Reading the result back ─────────────────────────────────────

// The moved chapter's history, from the documents the move would write: what the history pages
// will show once they read the database (step 8), and what the Move-over page shows as a check
export function historyOfMove(docs: MovedDoc[], env: DataEnv): HistoryData {
  const root = `${pathsFor(env).chapter(FOUNDERS)}/trips/`;
  const peopleRoot = `${pathsFor(env).people}/`;
  const people: { id: string; person: Person }[] = [];
  const trips = new Map<string, ChapterTripRecord>();
  const tripOf = (id: string) => {
    if (!trips.has(id)) trips.set(id, { id, trip: null as unknown as Trip, guide: null, handicaps: {}, matches: [] });
    return trips.get(id)!;
  };
  for (const { path, data } of docs) {
    if (path.startsWith(peopleRoot) && !path.slice(peopleRoot.length).includes('/')) {
      people.push({ id: path.slice(peopleRoot.length), person: data as unknown as Person });
      continue;
    }
    if (!path.startsWith(root)) continue;
    const [tripId, sub, id] = path.slice(root.length).split('/');
    const record = tripOf(tripId);
    if (!sub) record.trip = data as unknown as Trip;
    else if (sub === 'content' && id === 'guide') record.guide = data as unknown as GuideContent;
    else if (sub === 'handicaps') record.handicaps[id] = (data as { index: number }).index;
    else if (sub === 'matches') record.matches.push({ ...(data as unknown as Match), id });
  }
  return historyFromChapter(people, [...trips.values()].filter((t) => t.trip));
}
