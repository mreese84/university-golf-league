import { describe, expect, it } from 'vitest';
import { tripSlugs } from './tripSlugs';

const trip = (id: string, year: number, month: number, location: string) => ({ id, year, month, location });

describe('tripSlugs', () => {
  it('names a trip by year and city', () => {
    expect(tripSlugs([trip('a', 2026, 11, 'Columbia, SC')]).get('a')).toBe('2026-columbia');
  });

  it('drops accents and punctuation', () => {
    expect(tripSlugs([trip('a', 2027, 9, 'San José del Cabo, BCS')]).get('a')).toBe('2027-san-jose-del-cabo');
  });

  it('numbers trips that share a year and city, in date order', () => {
    const slugs = tripSlugs([trip('late', 2028, 10, 'Austin, TX'), trip('early', 2028, 3, 'Austin, TX')]);
    expect(slugs.get('early')).toBe('2028-austin');
    expect(slugs.get('late')).toBe('2028-austin-2');
  });
});
