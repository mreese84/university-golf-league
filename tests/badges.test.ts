// Achievement badges (src/history/badges.ts), on The Founder's Chapter as the move-over left it, and
// on changed copies of it for what hasn't happened yet

import { describe, expect, it } from 'vitest';
import { historyFromChapter } from '../src/data/history.ts';
import { decidedOn, earnedBadges, holdersOf, momentText, type BadgeId } from '../src/history/badges.ts';
import { playerStats } from '../src/history/stats.ts';
import type { HistoryData, HistoryEvent, HistoryMatch } from '../src/history/types.ts';
import { foundersChapter } from './fixtures/founders.ts';

const { people, trips } = foundersChapter();
const data = historyFromChapter(people, trips.filter((t) => t.trip.competition));
const stats = playerStats(data);
const members = people.map((p) => p.id);
const chapterTrips = trips.map((t) => ({ ...t.trip, id: t.id }));
const nameOf = (id: string) => people.find((p) => p.id === id)?.person.name ?? id;

const badgesOf = (d: HistoryData, more: Partial<Parameters<typeof earnedBadges>[0]> = {}) =>
  earnedBadges({ chapterId: 'founders', stats: playerStats(d), events: d.events, trips: chapterTrips, members, commissionerId: 'mark-reese', ...more });
const badges = badgesOf(data);
const holders = (b: ReturnType<typeof badgesOf>, id: BadgeId) => holdersOf(b, id, nameOf).map((h) => h.personId);
const ids = (personId: string, b = badges) => (b.get(personId) ?? []).map((x) => `${x.id}${x.moments.length > 1 ? `×${x.moments.length}` : ''}`);

// UGL2 with some of its matches changed
const ugl2 = data.events[0];
const withMatches = (change: (m: HistoryMatch) => HistoryMatch, event: Partial<HistoryEvent> = {}): HistoryData => ({
  ...data,
  events: [{ ...ugl2, ...event, matches: ugl2.matches.map(change) }],
});
const par = ugl2.rounds.find((r) => r.id === 'r1')!.par!;

describe('badges', () => {
  it('Commissioner: Mark, and only Mark', () => {
    expect(holders(badges, 'commissioner')).toEqual(['mark-reese']);
    const elsewhere = earnedBadges({ chapterId: 'austin-crew', stats: new Map(), trips: [], members: ['justin-thompson'], commissionerId: 'mark-reese' });
    expect(holders(elsewhere, 'commissioner')).toEqual([]);
  });

  it('Founder: everyone at UGL1 in Lubbock, in The Founder’s Chapter only', () => {
    expect(holders(badges, 'founder').sort()).toEqual(['adam-cowdin', 'jeff-siarto', 'justin-thompson', 'mark-reese', 'patrick-bohac', 'ricky-menchaca', 'travis-vance']);
    expect(badges.get('mark-reese')![1].moments[0].note).toBe('UGL1 · Lubbock 2025');
    expect(holders(badgesOf(data, { chapterId: 'austin-crew' }), 'founder')).toEqual([]);
  });

  it('Clutch: winners of matches that ended on 17 or 18, in the order played', () => {
    const clutch = holdersOf(badges, 'clutch', nameOf).map((h) => [h.personId, h.moments.map((m) => m.match!.id)]);
    expect(clutch).toEqual([
      ['jason-sudan', ['fourball-2', 'singles-1']],
      ['jeff-siarto', ['fourball-2']],
      ['justin-thompson', ['fourball-3']],
      ['mark-reese', ['fourball-3']],
      ['ricky-menchaca', ['singles-6']],
    ]);
    // Fourball was the first round at UGL2, singles the second
    expect(badges.get('jason-sudan')!.find((b) => b.id === 'clutch')!.moments.map(momentText)).toEqual(['UGL2 · Rd 1 · 2&1 on 17', 'UGL2 · Rd 2 · 1 UP on 18']);
  });

  it('reads the hole a match ended on from its scorecard, or from its margin without one', () => {
    const mark = stats.get('mark-reese')!.matches.find((m) => m.match.id === 'fourball-3')!;
    expect(decidedOn(mark)).toBe(17);
    expect(decidedOn({ play: null, match: { ...mark.match, result: { ...mark.match.result, margin: '1 UP' } } })).toBe(18);
    expect(decidedOn({ play: null, match: { ...mark.match, result: { ...mark.match.result, margin: '5&4' } } })).toBe(14);
  });

  it('Captain Comeback: won after being 3 or more down (nobody at UGL2)', () => {
    expect(holders(badges, 'captain-comeback')).toEqual([]);
    const mark = stats.get('mark-reese')!;
    const fourball = mark.matches.find((m) => m.match.id === 'fourball-3')!;
    const down = (n: number) => {
      const m = { ...fourball, play: { ...fourball.play!, maxDeficit: { ...fourball.play!.maxDeficit, [fourball.team.id]: n } } };
      return earnedBadges({ chapterId: 'founders', stats: new Map([['mark-reese', { ...mark, matches: [m] }]]), trips: [], members: [], commissionerId: 'x' });
    };
    expect(down(3).get('mark-reese')!.find((b) => b.id === 'captain-comeback')!.moments[0].note).toBe('3 down, won 2&1');
    expect(ids('mark-reese', down(2))).not.toContain('captain-comeback');
  });

  it('Blowout, Sandbagger and Hat Trick', () => {
    // John Collins won 8&7, at 19.3 against Nick Smith's 11.0
    expect(holders(badges, 'blowout')).toEqual(['john-collins']);
    expect(holders(badges, 'sandbagger')).toEqual(['john-collins']);
    expect(momentText(badges.get('john-collins')!.find((b) => b.id === 'sandbagger')!.moments[0])).toBe('UGL2 · Rd 2 · 19.3 over 11.0, 8&7');
    // Nobody won three at UGL2; three wins at one trip earns it once
    expect(holders(badges, 'hat-trick')).toEqual([]);
    const mark = stats.get('mark-reese')!;
    const three = { ...mark, matches: [...mark.matches, mark.matches[0]] };
    const after = earnedBadges({ chapterId: 'x', stats: new Map([['mark-reese', three]]), trips: [], members: [], commissionerId: 'x' });
    expect(ids('mark-reese', after)).toContain('hat-trick');
    expect(momentText(after.get('mark-reese')!.find((b) => b.id === 'hat-trick')!.moments[0])).toBe('UGL2 · 3 wins');
  });

  it('Cup Winner: everyone on the winning team, counted on the badge', () => {
    expect(holders(badges, 'cup-winner').sort()).toEqual(['greg-dundas', 'jason-sudan', 'jeff-siarto', 'john-collins', 'justin-thompson', 'mark-reese']);
    const twice: HistoryData = { ...data, events: [{ ...ugl2, id: 'again', edition: 3 }, ugl2] };
    expect(ids('mark-reese', badgesOf(twice))).toContain('cup-winner×2');
  });

  it('Walk-Off: won the final match on the 18th, and with it the cup', () => {
    expect(holders(badges, 'walk-off')).toEqual([]);
    // Every match halved but the last singles, which Ricky won 2 UP: that wins Crescent the cup
    const halved = (m: HistoryMatch): HistoryMatch =>
      m.id === 'singles-6' ? m : { ...m, result: { winner: null, margin: 'AS', points: Object.fromEntries(Object.keys(m.result.points).map((t) => [t, (m.result.points[t] + Object.values(m.result.points).reduce((a, b) => a + b, 0) - m.result.points[t]) / 2])) } };
    const walkOff = badgesOf(withMatches(halved));
    expect(holders(walkOff, 'walk-off')).toEqual(['ricky-menchaca']);
    expect(holders(walkOff, 'cup-winner').sort()).toContain('ricky-menchaca');
    // Not when it ended before the 18th
    const early = (m: HistoryMatch) => (m.id === 'singles-6' ? { ...m, scores: undefined, result: { ...m.result, margin: '3&2' } } : halved(m));
    expect(holders(badgesOf(withMatches(early)), 'walk-off')).toEqual([]);
    // Nor when the cup was already won
    expect(holders(badgesOf(data), 'walk-off')).toEqual([]);
  });

  it('Scorecards: Eagle, Birdie Machine, and Snowman only once', () => {
    expect(holders(badges, 'eagle')).toEqual(['ricky-menchaca']);
    expect(holders(badges, 'birdie-machine')).toEqual(['justin-thompson']); // 6 birdies; the next most was 3
    expect(momentText(badges.get('justin-thompson')!.find((b) => b.id === 'birdie-machine')!.moments[0])).toBe('UGL2 · 6 birdies');
    expect(momentText(badges.get('ricky-menchaca')!.find((b) => b.id === 'eagle')!.moments[0])).toMatch(/^UGL2 · Rd 2 · \d on hole 15$/);
    expect(momentText(badges.get('adam-cowdin')!.find((b) => b.id === 'snowman')!.moments[0])).toMatch(/^UGL2 · Rd \d · \d+ on hole \d+$/);
    expect(momentText(badges.get('mark-reese')!.find((b) => b.id === 'cup-winner')!.moments[0])).toBe('UGL2 · Team Palmetto');
    expect(momentText(badges.get('mark-reese')!.find((b) => b.id === 'founder')!.moments[0])).toBe('UGL1 · Lubbock 2025');
    expect(holders(badges, 'snowman').sort()).toEqual(['adam-cowdin', 'john-collins']);
    expect(ids('adam-cowdin')).toContain('snowman'); // six 8s, one badge
  });

  it('Scorecards: Ace, Tour Pro and Par Train', () => {
    for (const id of ['ace', 'tour-pro', 'par-train'] as const) expect(holders(badges, id)).toEqual([]);
    // Mark's fourball card made into pars, with a 1 on the first par 3 and a birdie on the 5th
    const ace = par.indexOf(3);
    const gross = par.map((p, h) => (h === ace ? 1 : h === 4 ? p - 1 : p));
    const card = (m: HistoryMatch): HistoryMatch =>
      m.id === 'fourball-3' ? { ...m, scores: m.scores!.map((r) => (r.player === 'mark-reese' ? { ...r, gross } : r)) } : m;
    const after = badgesOf(withMatches(card));
    expect(ids('mark-reese', after)).toEqual(expect.arrayContaining(['ace', 'tour-pro', 'eagle', 'par-train']));
    // Four in a row isn't a Par Train
    const four = par.map((p, h) => (h % 5 === 4 ? p + 1 : p));
    const broken = badgesOf(withMatches((m) => (m.id === 'fourball-3' ? { ...m, scores: m.scores!.map((r) => (r.player === 'mark-reese' ? { ...r, gross: four } : r)) } : m)));
    expect(ids('mark-reese', broken)).not.toContain('par-train');
  });

  it('Fireball King and Lucky Draw', () => {
    const fireball = { '2025-lubbock': { 'jeff-siarto': 4, 'mark-reese': 4 }, '2026-columbia': { 'mark-reese': 5, 'jeff-siarto': 3, 'ricky-menchaca': 0 } };
    const after = badgesOf(data, { fireball });
    expect(holders(after, 'fireball-king')).toEqual(['mark-reese', 'jeff-siarto']); // ties share it
    expect(ids('mark-reese', after)).toContain('fireball-king×2');
    expect(holders(badgesOf(data, { fireball: { '2026-columbia': { 'mark-reese': 0 } } }), 'fireball-king')).toEqual([]);
    // Ricky was drawn at UGL1; once UGL2's draw is in (Jeff), he has it too
    expect(holders(badges, 'lucky-draw')).toEqual(['ricky-menchaca']);
    const drawn = chapterTrips.map((t) => (t.number === 2 ? { ...t, nextSelectorId: 'jeff-siarto' } : t));
    expect(holders(badgesOf(data, { trips: drawn }), 'lucky-draw')).toEqual(['jeff-siarto', 'ricky-menchaca']);
  });

  it('lists each person’s badges in order, with how many times', () => {
    expect(ids('mark-reese')).toEqual(['commissioner', 'founder', 'clutch', 'cup-winner']);
    expect(ids('jason-sudan')).toEqual(['clutch×2', 'cup-winner']);
    expect(ids('john-collins')).toEqual(['blowout', 'sandbagger', 'cup-winner', 'snowman']);
    expect(ids('nick-smith')).toEqual([]);
  });
});
