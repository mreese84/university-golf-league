import type { Trip } from './types';

// Each trip's guide address (routes.ts)

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

// One address per trip. Trips that share a year and city get -2, -3… in date order.
export function tripSlugs(trips: SlugTrip[]): Map<string, string> {
  const ordered = [...trips].sort((a, b) => a.year - b.year || (a.month ?? 0) - (b.month ?? 0) || a.id.localeCompare(b.id));
  const seen = new Map<string, number>();
  const slugs = new Map<string, string>();
  for (const trip of ordered) {
    const slug = baseSlug(trip);
    const count = (seen.get(slug) ?? 0) + 1;
    seen.set(slug, count);
    slugs.set(trip.id, count === 1 ? slug : `${slug}-${count}`);
  }
  return slugs;
}
