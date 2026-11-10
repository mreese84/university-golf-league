import { describe, expect, it } from 'vitest';
import { safeContinuePath } from './next/continuePath';
import { parseRoute } from './routes';

describe('addresses', () => {
  it('keep today’s pages where they are', () => {
    expect(parseRoute('/')).toEqual({ page: 'home' });
    expect(parseRoute('/2026-columbia/guide')).toEqual({ page: 'guide', slug: '2026-columbia' });
    expect(parseRoute('/history/2026-columbia/singles-1')).toEqual({ page: 'match', eventId: '2026-columbia', matchId: 'singles-1' });
    expect(parseRoute('/players/mark-reese')).toEqual({ page: 'player', playerId: 'mark-reese' });
    expect(parseRoute('/move-over')).toEqual({ page: 'moveOver' });
    expect(parseRoute('/', '#/guide/abc')).toEqual({ page: 'legacyGuide', tripId: 'abc' });
  });

  it('add the Phase 1 pages', () => {
    expect(parseRoute('/next')).toEqual({ page: 'nextHome' });
    expect(parseRoute('/finish-sign-in')).toEqual({ page: 'finishSignIn' });
    expect(parseRoute('/founders')).toEqual({ page: 'chapter', chapterId: 'founders', tab: 'trips' });
    expect(parseRoute('/founders/')).toEqual({ page: 'chapter', chapterId: 'founders', tab: 'trips' });
    expect(parseRoute('/founders/selection')).toEqual({ page: 'chapter', chapterId: 'founders', tab: 'selection' });
    expect(parseRoute('/founders/members')).toEqual({ page: 'chapter', chapterId: 'founders', tab: 'members' });
    expect(parseRoute('/founders/trips')).toEqual({ page: 'home' }); // the trips tab is the chapter's own address
    expect(parseRoute('/me')).toEqual({ page: 'me' });
  });

  it('never read a reserved word or an unknown address as a chapter', () => {
    for (const path of ['/superlatives', '/history', '/players']) expect(parseRoute(path).page).not.toBe('chapter');
    expect(parseRoute('/Founders')).toEqual({ page: 'home' });
    expect(parseRoute('/2026-columbia')).toEqual({ page: 'home' });
    expect(parseRoute('/a/b/c/d')).toEqual({ page: 'home' });
  });
});

describe('after signing in', () => {
  it('goes to an address on this site', () => {
    expect(safeContinuePath('/founders', '/next')).toBe('/founders');
    expect(safeContinuePath('/founders/2026-columbia/guide', '/next')).toBe('/founders/2026-columbia/guide');
  });

  it('never to another site', () => {
    for (const bad of ['//evil.example', 'https://evil.example', '/\\evil.example', 'founders', '', null, undefined]) {
      expect(safeContinuePath(bad, '/next')).toBe('/next');
    }
  });
});
