import { describe, expect, it } from 'vitest';
import { safeContinuePath } from './next/continuePath';
import { parseRoute } from './routes';

describe('addresses', () => {
  const redirect = (to: string) => ({ page: 'redirect', to });

  it('find the pages', () => {
    expect(parseRoute('/')).toEqual({ page: 'home' });
    expect(parseRoute('/finish-sign-in')).toEqual({ page: 'finishSignIn' });
    expect(parseRoute('/me')).toEqual({ page: 'me' });
    expect(parseRoute('/request')).toEqual({ page: 'requestChapter' });
    expect(parseRoute('/admin')).toEqual({ page: 'admin' });
    expect(parseRoute('/founders')).toEqual({ page: 'chapter', chapterId: 'founders', tab: 'trips' });
    expect(parseRoute('/founders/selection')).toEqual({ page: 'chapter', chapterId: 'founders', tab: 'selection' });
    expect(parseRoute('/founders/members')).toEqual({ page: 'chapter', chapterId: 'founders', tab: 'members' });
    expect(parseRoute('/founders/2026-columbia/guide')).toEqual({ page: 'tripGuide', chapterId: 'founders', tripId: '2026-columbia' });
    expect(parseRoute('/founders/2026-columbia/results')).toEqual({ page: 'tripResults', chapterId: 'founders', tripId: '2026-columbia' });
    expect(parseRoute('/founders/history')).toEqual({ page: 'chapter', chapterId: 'founders', tab: 'history', history: { page: 'history' } });
    expect(parseRoute('/founders/history/2026-columbia')).toEqual({ page: 'chapter', chapterId: 'founders', tab: 'history', history: { page: 'event', eventId: '2026-columbia' } });
    expect(parseRoute('/founders/history/2026-columbia/singles-1')).toEqual({
      page: 'chapter', chapterId: 'founders', tab: 'history', history: { page: 'match', eventId: '2026-columbia', matchId: 'singles-1' },
    });
    expect(parseRoute('/founders/players')).toEqual({ page: 'chapter', chapterId: 'founders', tab: 'history', history: { page: 'players' } });
    expect(parseRoute('/founders/players/mark-reese')).toEqual({ page: 'chapter', chapterId: 'founders', tab: 'history', history: { page: 'player', playerId: 'mark-reese' } });
    expect(parseRoute('/founders/superlatives')).toEqual({ page: 'chapter', chapterId: 'founders', tab: 'history', history: { page: 'superlatives' } });
  });

  it('send the addresses from before the switch into The Founder’s Chapter', () => {
    expect(parseRoute('/2026-columbia/guide')).toEqual(redirect('/founders/2026-columbia/guide'));
    expect(parseRoute('/history')).toEqual(redirect('/founders/history'));
    expect(parseRoute('/history/2026-columbia')).toEqual(redirect('/founders/history/2026-columbia'));
    expect(parseRoute('/history/2026-columbia/singles-1')).toEqual(redirect('/founders/history/2026-columbia/singles-1'));
    expect(parseRoute('/players')).toEqual(redirect('/founders/players'));
    expect(parseRoute('/players/mark-reese')).toEqual(redirect('/founders/players/mark-reese'));
    expect(parseRoute('/superlatives')).toEqual(redirect('/founders/superlatives'));
    expect(parseRoute('/', '#/guide/abc123')).toEqual(redirect('/founders')); // the old trip IDs aren't kept
    expect(parseRoute('/next')).toEqual(redirect('/'));
    expect(parseRoute('/move-over')).toEqual(redirect('/')); // gone after the move (step 9c)
  });

  it('tidy a trailing slash, then follow the address', () => {
    expect(parseRoute('/founders/')).toEqual(redirect('/founders'));
    expect(parseRoute('/2026-columbia/guide/')).toEqual(redirect('/2026-columbia/guide'));
  });

  it('send anything else home', () => {
    for (const path of ['/Founders', '/2026-columbia', '/a/b/c/d', '/founders/trips', '/founders/guide', '/founders/x/y', '/%E0%A4%A']) {
      expect(parseRoute(path)).toEqual(redirect('/'));
    }
  });
});

describe('after signing in', () => {
  it('goes to an address on this site', () => {
    expect(safeContinuePath('/founders', '/')).toBe('/founders');
    expect(safeContinuePath('/founders/2026-columbia/guide', '/')).toBe('/founders/2026-columbia/guide');
  });

  it('never to another site', () => {
    for (const bad of ['//evil.example', 'https://evil.example', '/\\evil.example', 'founders', '', null, undefined]) {
      expect(safeContinuePath(bad, '/')).toBe('/');
    }
  });
});
