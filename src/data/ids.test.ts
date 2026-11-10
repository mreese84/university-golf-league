import { describe, expect, it } from 'vitest';
import { isValidChapterId, personIdFor, slugify } from './ids';
import { normalizeEmail, pathsFor } from './paths';

describe('person IDs', () => {
  it('come from the name, like the history files', () => {
    expect(personIdFor('Mark Reese', [])).toBe('mark-reese');
    expect(slugify('José Núñez Jr.')).toBe('jose-nunez-jr');
  });

  it('get a number when taken', () => {
    expect(personIdFor('Mark Reese', ['mark-reese'])).toBe('mark-reese-2');
    expect(personIdFor('Mark Reese', ['mark-reese', 'mark-reese-2'])).toBe('mark-reese-3');
  });
});

describe('chapter IDs', () => {
  it('are short lowercase addresses', () => {
    expect(isValidChapterId('founders')).toBe(true);
    expect(isValidChapterId('austin-crew')).toBe(true);
  });

  it('never clash with the app’s own addresses or old trip links', () => {
    for (const id of ['admin', 'history', 'players', 'profiles', 'me', '2026-columbia', 'Founders', 'a', 'x-']) {
      expect(isValidChapterId(id)).toBe(false);
    }
  });
});

describe('paths', () => {
  it('keep live and dev data apart', () => {
    expect(pathsFor('live').trip('founders', '2026-columbia')).toBe('envs/live/chapters/founders/trips/2026-columbia');
    expect(pathsFor('dev').person('mark-reese')).toBe('envs/dev/people/mark-reese');
  });

  it('look emails up in lowercase', () => {
    expect(normalizeEmail('  Mark@Example.COM ')).toBe('mark@example.com');
    expect(pathsFor('live').login('Mark@Example.com')).toBe('envs/live/logins/mark@example.com');
  });
});
