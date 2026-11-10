// A chapter's history from the database (src/data/history.ts), the way its History tab reads it,
// on The Founder's Chapter as the move-over left it. UGL2 must come out as the history files had it:
// Palmetto 9½, Crescent 1½, with the same records, partners, opponents and superlatives.

import { describe, expect, it } from 'vitest';
import { historyFromChapter } from '../src/data/history.ts';
import { playerStats, standings, superlatives } from '../src/history/stats.ts';
import type { HistoryData } from '../src/history/types.ts';
import { validateHistory } from '../src/history/validate.ts';
import { foundersChapter } from './fixtures/founders.ts';
import expected from './fixtures/ugl2-history.json';

// What the history pages show: points, records, partners, opponents and awards
function summary(data: HistoryData) {
  const stats = playerStats(data);
  const awards = superlatives(data, stats);
  return {
    standings: data.events.map((e) => ({ id: e.id, ...standings(e) })),
    players: [...stats.values()].map((s) => ({
      id: s.id,
      record: s.record,
      points: s.points,
      byFormat: s.byFormat,
      partners: s.partners,
      opponents: s.opponents,
      events: s.events.map((e) => ({ event: e.event.id, team: e.team.id, captain: e.captain, record: e.record, points: e.points })),
    })),
    awards: [...awards.results, ...(awards.scorecards ?? [])].map((a) => ({
      id: a.id,
      entries: a.entries.map((e) => ({ players: e.players, opponents: e.opponents, team: e.team?.id, event: e.event?.id, match: e.match?.id, value: e.value, note: e.note })),
    })),
  };
}

describe('The Founder’s Chapter’s history', () => {
  const { people, trips } = foundersChapter();
  const history = historyFromChapter(people, trips.filter((t) => t.trip.competition));

  it('has UGL2 only: Lubbock had no competition', () => {
    expect(history.events.map((e) => e.id)).toEqual(['2026-columbia']);
  });

  it('passes the history checks', () => {
    expect(validateHistory(history)).toEqual([]);
  });

  it('adds up to Palmetto 9½, Crescent 1½', () => {
    const { points, winner } = standings(history.events[0]);
    expect(Object.values(points).sort()).toEqual([1.5, 9.5]);
    expect(winner).toBe('palmetto');
  });

  it('shows the same standings, records and superlatives as the history files did', () => {
    // Something real to compare: twelve players' records and awards with winners
    expect(expected.players).toHaveLength(12);
    expect(expected.awards.filter((a) => a.entries.length > 0).length).toBeGreaterThan(5);
    expect(JSON.parse(JSON.stringify(summary(history)))).toEqual(expected);
  });
});
