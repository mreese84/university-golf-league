// Achievement badges (src/history/badges.ts), on The Founder's Chapter as the move-over left it

import { describe, expect, it } from 'vitest';
import { historyFromChapter } from '../src/data/history.ts';
import { decidedOn, earnedBadges, holdersOf } from '../src/history/badges.ts';
import { playerStats } from '../src/history/stats.ts';
import { foundersChapter } from './fixtures/founders.ts';

const { people, trips } = foundersChapter();
const stats = playerStats(historyFromChapter(people, trips.filter((t) => t.trip.competition)));
const members = people.map((p) => p.id);
const chapterTrips = trips.map((t) => t.trip);
const badges = earnedBadges({ chapterId: 'founders', stats, trips: chapterTrips, members, commissionerId: 'mark-reese' });
const ids = (personId: string) => (badges.get(personId) ?? []).map((b) => `${b.id}${b.moments.length > 1 ? `×${b.moments.length}` : ''}`);
const nameOf = (id: string) => people.find((p) => p.id === id)?.person.name ?? id;

describe('badges', () => {
  it('Commissioner: Mark, and only Mark', () => {
    expect(holdersOf(badges, 'commissioner', nameOf).map((h) => h.personId)).toEqual(['mark-reese']);
    const elsewhere = earnedBadges({ chapterId: 'austin-crew', stats: new Map(), trips: [], members: ['justin-thompson'], commissionerId: 'mark-reese' });
    expect(holdersOf(elsewhere, 'commissioner', nameOf)).toEqual([]);
  });

  it('Founder: everyone at UGL1 in Lubbock, in The Founder’s Chapter only', () => {
    expect(holdersOf(badges, 'founder', nameOf).map((h) => h.personId).sort()).toEqual(
      ['adam-cowdin', 'jeff-siarto', 'justin-thompson', 'mark-reese', 'patrick-bohac', 'ricky-menchaca', 'travis-vance'],
    );
    expect(badges.get('mark-reese')![1].moments[0].note).toBe('UGL1 · Lubbock 2025');
    const other = earnedBadges({ chapterId: 'austin-crew', stats, trips: chapterTrips, members, commissionerId: 'nobody' });
    expect(holdersOf(other, 'founder', nameOf)).toEqual([]);
  });

  it('Clutch: winners of matches that ended on 17 or 18', () => {
    // UGL2: fourball 2 and 3 went 2&1 (17th), singles 1 went 1 UP and singles 6 2 UP (18th)
    const clutch = holdersOf(badges, 'clutch', nameOf).map((h) => [h.personId, h.moments.map((m) => m.match!.id)]);
    expect(clutch).toEqual([
      ['jason-sudan', ['fourball-2', 'singles-1']],
      ['jeff-siarto', ['fourball-2']],
      ['justin-thompson', ['fourball-3']],
      ['mark-reese', ['fourball-3']],
      ['ricky-menchaca', ['singles-6']],
    ]);
    expect(badges.get('jason-sudan')![0].moments.map((m) => m.note)).toEqual(['2&1 on 17', '1 UP on 18']);
    // Nobody who lost, and nobody for 4&3 or 8&7
    for (const s of stats.values()) for (const m of s.matches) if (m.outcome !== 'W') expect(clutch.some(([id, ms]) => id === s.id && (ms as string[]).includes(m.match.id))).toBe(false);
  });

  it('reads the hole a match ended on from its scorecard, or from its margin without one', () => {
    const mark = stats.get('mark-reese')!.matches.find((m) => m.match.id === 'fourball-3')!;
    expect(decidedOn(mark)).toBe(17);
    expect(decidedOn({ ...mark, play: null, match: { ...mark.match, result: { ...mark.match.result, margin: '1 UP' } } })).toBe(18);
    expect(decidedOn({ ...mark, play: null, match: { ...mark.match, result: { ...mark.match.result, margin: '5&4' } } })).toBe(14);
  });

  it('Captain Comeback: won after being more than 3 down (nobody at UGL2)', () => {
    expect(holdersOf(badges, 'captain-comeback', nameOf)).toEqual([]);
    // Make Mark's fourball win one where his side was 4 down at one point
    const mark = stats.get('mark-reese')!;
    const fourball = mark.matches.find((m) => m.match.id === 'fourball-3')!;
    const comeback = { ...fourball, play: { ...fourball.play!, maxDeficit: { ...fourball.play!.maxDeficit, [fourball.team.id]: 4 } } };
    const three = { ...fourball, play: { ...fourball.play!, maxDeficit: { ...fourball.play!.maxDeficit, [fourball.team.id]: 3 } } };
    const after = (m: typeof fourball) =>
      earnedBadges({ chapterId: 'founders', stats: new Map([['mark-reese', { ...mark, matches: [m] }]]), trips: [], members: [], commissionerId: 'x' });
    expect(after(comeback).get('mark-reese')!.map((b) => b.id)).toContain('captain-comeback');
    expect(after(comeback).get('mark-reese')!.find((b) => b.id === 'captain-comeback')!.moments[0].note).toBe('4 down, won 2&1');
    expect(after(three).get('mark-reese')!.map((b) => b.id)).not.toContain('captain-comeback');
  });

  it('lists each person’s badges in order, with how many times', () => {
    expect(ids('mark-reese')).toEqual(['commissioner', 'founder', 'clutch']);
    expect(ids('jason-sudan')).toEqual(['clutch×2']);
    expect(ids('greg-dundas')).toEqual([]);
  });
});
