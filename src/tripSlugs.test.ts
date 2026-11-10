import { describe, expect, it } from 'vitest';
import { baseSlug } from './tripSlugs';

const trip = (year: number, month: number, location: string) => ({ id: '', year, month, location });

describe('a trip’s address', () => {
  it('is its year and city', () => {
    expect(baseSlug(trip(2026, 11, 'Columbia, SC'))).toBe('2026-columbia');
  });

  it('drops accents and punctuation', () => {
    expect(baseSlug(trip(2027, 9, 'San José del Cabo, BCS'))).toBe('2027-san-jose-del-cabo');
  });
});
