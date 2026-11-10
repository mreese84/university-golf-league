import type { Trip } from './types';

/**
 * Get entry count for a member at a given trip index.
 * Walks backwards through trips: +1 for each consecutive trip where the
 * member attended AND was not the location selector. Stops when they
 * didn't attend or were the selector.
 */
export function getEntryCount(
  memberId: string,
  trips: Trip[],
  currentTripIndex: number
): number {
  let count = 0;
  for (let i = currentTripIndex; i >= 0; i--) {
    const trip = trips[i];
    if (!trip.attendeeIds.includes(memberId)) break;
    if (trip.selectedById === memberId) break;
    count += 1;
  }
  return count;
}

/**
 * Get eligible member IDs for the draw at the end of a given trip.
 * Eligible = attended the trip AND did not select the trip's location.
 */
export function getEligibleMemberIds(trip: Trip): string[] {
  return trip.attendeeIds.filter((id) => id !== trip.selectedById);
}

/**
 * Build a weighted pool: each eligible member's ID repeated by their entry count.
 */
export function buildWeightedPool(
  trips: Trip[],
  currentTripIndex: number
): { memberId: string; entries: number }[] {
  const trip = trips[currentTripIndex];
  const eligible = getEligibleMemberIds(trip);

  return eligible.map((memberId) => ({
    memberId,
    entries: getEntryCount(memberId, trips, currentTripIndex),
  }));
}
