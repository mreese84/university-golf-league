import { describe, expect, it } from 'vitest';
import { buildWeightedPool, getEligibleMemberIds, getEntryCount } from './eligibility';
import type { Trip } from './types';

const trip = (id: string, attendeeIds: string[], selectedById: string): Trip => ({
  id,
  year: 2020,
  month: 1,
  location: id,
  attendeeIds,
  selectedById,
  nextSelectorId: null,
});

// a picked trip 1; b picked trip 2; c has been to all three without picking
const trips = [trip('t1', ['a', 'b', 'c'], 'a'), trip('t2', ['a', 'b', 'c'], 'b'), trip('t3', ['a', 'b', 'c', 'd'], 'a')];

describe('selection draw', () => {
  it('leaves the trip’s selector out of its draw', () => {
    expect(getEligibleMemberIds(trips[2])).toEqual(['b', 'c', 'd']);
  });

  it('counts consecutive trips attended since last picking', () => {
    expect(getEntryCount('c', trips, 2)).toBe(3);
    expect(getEntryCount('b', trips, 2)).toBe(1); // picked trip 2
    expect(getEntryCount('d', trips, 2)).toBe(1); // first trip
    expect(getEntryCount('a', trips, 2)).toBe(0); // picked this trip
  });

  it('weights each eligible member by their entries', () => {
    expect(buildWeightedPool(trips, 2)).toEqual([
      { memberId: 'b', entries: 1 },
      { memberId: 'c', entries: 3 },
      { memberId: 'd', entries: 1 },
    ]);
  });
});
