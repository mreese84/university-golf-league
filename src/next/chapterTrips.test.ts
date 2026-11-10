import { describe, expect, it } from 'vitest';
import type { RosterEntry } from '../data/types';
import { drawFrom, drawPool, newTrip, newTripId, pendingDraw, type ChapterTrip } from './chapterTrips';

const trip = (id: string, year: number, month: number, attendeeIds: string[], selectedById: string, nextSelectorId: string | null = null): ChapterTrip => ({
  id,
  number: null,
  title: '',
  year,
  month,
  location: id,
  dates: null,
  theme: { primary: '#000000', onPrimary: '#ffffff' },
  competition: false,
  attendeeIds,
  selectedById,
  nextSelectorId,
});

// Mark picked Lubbock; Ricky picked Columbia; Gus is a guest; Alice is alumni
const trips = [
  trip('2025-lubbock', 2025, 9, ['mark', 'ricky', 'jeff', 'alice'], 'mark', 'ricky'),
  trip('2026-columbia', 2026, 11, ['mark', 'ricky', 'jeff', 'gus', 'alice'], 'ricky'),
];
const entry = (status: RosterEntry['status']): RosterEntry => ({ role: 'member', status });
const roster = { mark: entry('active'), ricky: entry('active'), jeff: entry('active'), gus: entry('guest'), alice: entry('alumni') };

describe('trips', () => {
  it('get a permanent address from year and city', () => {
    expect(newTripId({ year: 2027, month: 10, location: 'Austin, TX' }, ['2026-columbia'])).toBe('2027-austin');
    expect(newTripId({ year: 2027, month: 10, location: 'Austin, TX' }, ['2027-austin'])).toBe('2027-austin-2');
  });

  it('are numbered after the chapter’s others', () => {
    const fields = { year: 2027, month: 10, location: 'Austin, TX', attendeeIds: ['mark'], selectedById: 'mark', nextSelectorId: null };
    expect(newTrip(fields, [{ ...trips[0], number: 1 }, { ...trips[1], number: 2 }])).toMatchObject({ number: 3, competition: false, location: 'Austin, TX' });
    expect(newTrip(fields, []).number).toBe(1);
  });
});

describe('the selection draw', () => {
  it('is for the newest trip without a result', () => {
    expect(pendingDraw(trips)?.id).toBe('2026-columbia');
    expect(pendingDraw([trips[0]])).toBeNull();
  });

  it('includes only active members who didn’t choose the location, weighted by consecutive trips', () => {
    const { pool, left } = drawPool(trips, '2026-columbia', roster);
    expect(pool).toEqual([
      { personId: 'mark', entries: 1 }, // chose Lubbock, so his count restarts
      { personId: 'jeff', entries: 2 },
    ]);
    expect(left.sort()).toEqual(['alice', 'gus']);
  });

  it('draws by tickets', () => {
    const pool = [{ personId: 'mark', entries: 1 }, { personId: 'jeff', entries: 2 }];
    expect(drawFrom(pool, () => 0)).toBe('mark');
    expect(drawFrom(pool, () => 0.5)).toBe('jeff');
    expect(drawFrom(pool, () => 0.99)).toBe('jeff');
    expect(() => drawFrom([])).toThrow('No one is eligible');
  });
});
