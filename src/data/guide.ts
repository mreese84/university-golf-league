// A trip's Player's Guide between the Phase 1 layout (Trip + GuideContent + Draft + handicaps) and
// the shape today's guide components read (PlayerGuide, GuideDraft), so those components carry over.

import type { GuideDraft, GuideSession, PlayerGuide } from '../types';
import { slugify } from './ids';
import type { Draft, GuideContent, Trip, TripRound, TripSession } from './types';

// The guide shows each session's total points; they're stored per match
export const sessionTotal = (s: TripSession) => (s.matches > 0 ? s.points * s.matches : s.points);

// The trip and its guide as the guide components read them. Sessions take their day from their
// round: the first competition round is Day 1, and so on, which is how the guide pairs them.
export function guideForView(trip: Trip, content: GuideContent, handicaps: Record<string, number>): PlayerGuide {
  const competition = content.rounds.filter((r) => r.matchType !== 'casual');
  const dayIndex = (roundId: string) => competition.findIndex((r) => r.id === roundId);
  const ordered = [...content.format.sessions].sort((a, b) => dayIndex(a.round) - dayIndex(b.round));
  const sessions: GuideSession[] = ordered.map((s) => ({
    day: dayIndex(s.round) >= 0 ? `Day ${dayIndex(s.round) + 1}` : 'Extra',
    name: s.name,
    points: sessionTotal(s),
    rules: s.rules,
  }));
  const total = sessions.reduce((sum, s) => sum + s.points, 0);
  return {
    title: trip.title,
    location: trip.location,
    ...(trip.timeZone ? { timeZone: trip.timeZone } : {}),
    theme: trip.theme,
    flights: content.flights,
    teams: content.teams,
    rounds: content.rounds,
    format: { name: content.format.name, summary: content.format.summary, notes: content.format.notes, sessions, pointsToWin: total / 2 + 0.5 },
    football: content.football,
    nightlife: content.nightlife,
    handicaps,
  };
}

// What the guide's own editing changes (houses and addresses, flights, the game, nightlife) put back
// into the stored guide. Teams' players come only from the stored guide, so an unpublished draft that
// an organizer is looking at can never leak into it.
export function contentFromView(view: PlayerGuide, content: GuideContent): GuideContent {
  return {
    ...content,
    flights: view.flights,
    teams: content.teams.map((t) => {
      const edited = view.teams.find((v) => v.id === t.id);
      return edited ? { ...t, house: edited.house, address: edited.address } : t;
    }),
    football: view.football,
    nightlife: view.nightlife,
  };
}

// The pairings draft as the pairings panel reads it, with the handicaps beside it
export const draftForView = (draft: Draft | null, handicaps: Record<string, number>): GuideDraft => ({
  published: draft?.published ?? false,
  captains: draft?.captains ?? {},
  teams: draft?.teams ?? {},
  rounds: draft?.rounds ?? {},
  handicaps,
});

// The guide with the draft's teams, captains and groups filled in
export function applyDraftToContent(content: GuideContent, draft: Pick<Draft, 'captains' | 'teams' | 'rounds'>): GuideContent {
  return {
    ...content,
    teams: content.teams.map((t) => ({ ...t, memberIds: draft.teams[t.id] ?? [], captainId: draft.captains[t.id] ?? null })),
    rounds: content.rounds.map((r) => ({
      ...r,
      groups: r.groups.map((g, i) => ({ ...g, playerIds: draft.rounds[r.id]?.[i]?.playerIds ?? [] })),
    })),
  };
}

// The guide with teams and groups back to TBD
export function clearPairingsInContent(content: GuideContent): GuideContent {
  return {
    ...content,
    teams: content.teams.map((t) => ({ ...t, memberIds: [], captainId: null })),
    rounds: content.rounds.map((r) => ({ ...r, groups: r.groups.map((g) => ({ ...g, playerIds: [] })) })),
  };
}

// A guide file (the Player's Guide JSON that Export JSON downloads) as a trip's guide, with no one on
// a team or in a group yet: for organizers importing a guide until the guide editors arrive (step 10).
// Sessions go on the rounds the guide shows them on: the first day's sessions on the first
// competition round, and so on. The file gives each session's total points; they're stored per match.
export function contentFromGuideFile(guide: PlayerGuide): GuideContent {
  const rounds: TripRound[] = guide.rounds
    .map((r) => ({ ...r, groups: r.groups.map((g) => ({ ...g, playerIds: g.playerIds.map(() => null) })) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const sessionDays = [...new Set(guide.format.sessions.map((s) => s.day))];
  const competitionRounds = rounds.filter((r) => r.matchType !== 'casual');
  const sessions: TripSession[] = guide.format.sessions.map((s) => {
    const round = competitionRounds[sessionDays.indexOf(s.day)] ?? rounds.find((r) => r.label.startsWith(s.day)) ?? rounds[0];
    const id = slugify(s.name) || 'session';
    const perGroup = round?.matchType === 'singles' ? 2 : round?.matchType === 'fourball' ? 1 : 0;
    const matches = (round?.groups.length ?? 0) * perGroup;
    return { id, round: round?.id ?? '', name: s.name, format: id, scoring: 'match', points: matches > 0 ? s.points / matches : s.points, matches, rules: s.rules };
  });
  return {
    flights: guide.flights,
    teams: guide.teams.map((t) => ({ ...t, memberIds: [], captainId: null })),
    rounds,
    format: { name: guide.format.name, summary: guide.format.summary, notes: guide.format.notes, sessions },
    football: guide.football,
    nightlife: guide.nightlife,
  };
}
