// A chapter's competition record, assembled from the Phase 1 layout in the same shape the history
// pages read today (src/history/types.ts), so the records and superlatives code works unchanged.
// Records belong to one chapter and are never combined across chapters.

import type { EventSession, HistoryData, HistoryEvent, HistoryMatch } from '../history/types';
import type { GuideContent, Match, Person, Trip, TripRound } from './types';

export interface ChapterTripRecord {
  id: string;
  trip: Trip;
  guide: GuideContent | null;
  handicaps: Record<string, number>; // person ID -> pre-trip index
  matches: (Match & { id: string })[];
}

// "Day 1 · 2-Man Net Best Ball" in the guide is "Day 1" in the history
const historyLabel = (round: TripRound) => round.label.split(' · ')[0];

function eventFor({ id, trip, guide, handicaps, matches }: ChapterTripRecord): HistoryEvent | null {
  if (!trip.competition || !guide || !trip.dates) return null;
  const sessions: EventSession[] = guide.format.sessions.map((s) => ({
    id: s.id,
    round: s.round,
    name: s.name,
    format: s.format,
    scoring: s.scoring,
    points: s.points,
    matches: s.matches,
    ...(s.strokes ? { strokes: s.strokes } : {}),
    ...(s.basis ? { basis: s.basis } : {}),
  }));
  const order = (m: HistoryMatch) => sessions.findIndex((s) => s.id === m.session);
  return {
    id,
    year: trip.year,
    edition: trip.number ?? 0,
    title: trip.title,
    location: trip.location,
    dates: trip.dates,
    format: guide.format.name,
    teams: guide.teams.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      ...(t.emblem ? { emblem: t.emblem } : {}),
      ...(t.logo ? { logo: t.logo } : {}),
      ...(t.captainId ? { captain: t.captainId } : {}),
      players: t.memberIds,
    })),
    handicaps,
    rounds: guide.rounds.map((r) => ({
      id: r.id,
      label: historyLabel(r),
      date: r.date,
      course: r.course,
      ...(r.par ? { par: r.par } : {}),
      ...(r.strokeIndex ? { strokeIndex: r.strokeIndex } : {}),
    })),
    sessions,
    matches: [...matches].sort((a, b) => order(a) - order(b) || a.match - b.match),
  };
}

export function historyFromChapter(people: { id: string; person: Person }[], trips: ChapterTripRecord[]): HistoryData {
  return {
    players: people
      .map(({ id, person }) => ({ id, name: person.name, ...(person.photo ? { photo: person.photo } : {}) }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    events: trips
      .map(eventFor)
      .filter((e): e is HistoryEvent => e !== null)
      .sort((a, b) => b.id.localeCompare(a.id)),
  };
}
