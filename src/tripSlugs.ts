import type { Trip } from './types';

// The start of each trip's address (/founders/2026-columbia/guide); newTripId in
// src/next/chapterTrips.ts adds -2, -3… when a chapter already has one

type SlugTrip = Pick<Trip, 'id' | 'year' | 'month' | 'location'>;

// "Columbia, SC" in 2026 -> "2026-columbia"
export function baseSlug(trip: SlugTrip) {
  const city = trip.location
    .split(',')[0]
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // drop accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${trip.year}-${city || 'trip'}`;
}
