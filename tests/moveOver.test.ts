// The move into The Founder's Chapter (src/moveOver/transform.ts), run on the repo's real history
// files and made-up stand-ins for today's database (members, trips, a guide, a draft, Fireball counts
// and bios). The key check: UGL2's standings, records and superlatives come out exactly as the
// history files have them, apart from the four pre-trip handicaps the decisions doc changes.

import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { playerStats, standings, superlatives } from '../src/history/stats.ts';
import type { HistoryData } from '../src/history/types.ts';
import { validateHistory } from '../src/history/validate.ts';
import {
  buildFoundersChapter,
  historyOfMove,
  PRE_TRIP_HANDICAPS,
  problemsWith,
  suggestPeople,
  type MovedDoc,
} from '../src/moveOver/transform.ts';
import { loadHistory, publicHistory } from '../scripts/loadHistory.ts';
import { lubbock, oldData as fixtureData, readyPeople as fixturePeople } from './fixtures/moveOver.ts';

let history: HistoryData;
const oldData = (withGuide: boolean) => fixtureData(history, withGuide);
const readyPeople = (old: ReturnType<typeof oldData>) => fixturePeople(history, old);

beforeAll(async () => {
  const { data, errors } = await loadHistory(resolve(import.meta.dirname, '..', 'history'));
  expect(errors).toEqual([]);
  history = publicHistory(data, false);
});

const docAt = (docs: MovedDoc[], path: string) => docs.find((d) => d.path === path)?.data;
const T = 'envs/dev/chapters/founders/trips';

describe('who everyone becomes', () => {
  it('matches members to history players by first name and last initial', () => {
    const rows = suggestPeople(oldData(true), history);
    const mark = rows.find((r) => r.memberName === 'Mark R')!;
    expect(mark).toMatchObject({ personId: 'mark-reese', name: 'Mark Reese', needsName: false, email: 'reese296@gmail.com', role: 'organizer', status: 'active' });
    expect(rows.find((r) => r.memberName === 'Adam C')).toMatchObject({ personId: 'adam-cowdin', status: 'active', role: 'member' });
  });

  it('asks for a full name for members not in the history, since it becomes their ID', () => {
    const rows = suggestPeople(oldData(true), history);
    expect(rows.find((r) => r.memberId === 'm-zed')).toMatchObject({ needsName: true, personId: 'zed-q' });
    expect(problemsWith(rows)).toEqual([expect.stringContaining('Zed Q needs a full name')]);
    const fixed = readyPeople(oldData(true));
    expect(fixed.find((r) => r.memberId === 'm-zed')).toMatchObject({ name: 'Zed Quincy', personId: 'zed-quincy' });
    expect(problemsWith(fixed)).toEqual([]);
  });

  it('brings in people who are only in the history as guests', () => {
    expect(suggestPeople(oldData(true), history).find((r) => r.historyId === 'nick-smith')).toMatchObject({ memberId: null, status: 'guest', name: 'Nick Smith' });
  });

  it('won’t move without an organizer or with clashing IDs', () => {
    const rows = readyPeople(oldData(true));
    expect(problemsWith(rows.map((r) => ({ ...r, role: 'member' as const })))).toContain('The chapter needs at least one organizer.');
    expect(problemsWith([...rows, { ...rows[0] }])).toContain(`Two people would have the ID "${rows[0].personId}".`);
  });
});

describe('the move', () => {
  const run = (withGuide = true) => {
    const old = oldData(withGuide);
    return buildFoundersChapter(old, history, readyPeople(old), 'dev');
  };

  it('writes people before their roster entries, and those before per-player records', () => {
    const { docs } = run();
    const firstIndex = (part: string) => docs.findIndex((d) => d.path.includes(part));
    const lastIndex = (part: string) => docs.map((d) => d.path.includes(part)).lastIndexOf(true);
    expect(lastIndex('/people/')).toBeLessThan(firstIndex('/members/'));
    expect(lastIndex('/members/')).toBeLessThan(firstIndex('/handicaps/'));
    expect(lastIndex('/members/')).toBeLessThan(firstIndex('/fireball/'));
  });

  it('gives each person one record, with their college, bio, photo, email and status', () => {
    const { docs } = run();
    expect(docAt(docs, 'envs/dev/people/mark-reese')).toMatchObject({ name: 'Mark Reese', college: 'Texas Tech', photo: 'profiles/mark-reese.jpg', chapterIds: ['founders'], organizerOf: ['founders'] });
    expect(docAt(docs, 'envs/dev/people/jeff-siarto')).toMatchObject({ bio: 'Hits it straight.', organizerOf: [] });
    expect(docAt(docs, 'envs/dev/people/zed-quincy')).toMatchObject({ name: 'Zed Quincy', bio: 'New this year.' });
    expect(docAt(docs, 'envs/dev/logins/reese296@gmail.com')).toEqual({ personId: 'mark-reese' });
    expect(docAt(docs, 'envs/dev/chapters/founders/members/nick-smith')).toEqual({ role: 'member', status: 'guest', since: null });
  });

  it('numbers trips per chapter: UGL1 in Lubbock with no competition, UGL2 in Columbia', () => {
    const { docs } = run();
    expect(docAt(docs, `${T}/2025-lubbock`)).toMatchObject({ number: 1, competition: false, selectedById: 'mark-reese', nextSelectorId: 'ricky-menchaca', dates: null });
    expect(docAt(docs, `${T}/2025-lubbock`)!.attendeeIds).toEqual(lubbock);
    expect(docAt(docs, `${T}/2026-columbia`)).toMatchObject({ number: 2, competition: true, title: '2026 UGL Invitational', dates: ['2026-11-05', '2026-11-08'], timeZone: 'America/New_York' });
    expect(docAt(docs, `${T}/2025-lubbock/content/guide`)).toBeUndefined();
  });

  it('joins the guide to the history: guide rounds and houses, history par, sessions and players', () => {
    const { docs } = run();
    const guide = docAt(docs, `${T}/2026-columbia/content/guide`) as unknown as import('../src/data/types.ts').GuideContent;
    expect(guide.rounds.map((r) => r.id)).toEqual(['r1', 'r2', 'r3']);
    expect(guide.rounds[0].par).toHaveLength(18);
    expect(guide.rounds[0].groups[0].playerIds.every((p) => p && !p.startsWith('m-'))).toBe(true);
    expect(guide.format.sessions.map((s) => [s.id, s.round])).toEqual([['fourball', 'r1'], ['singles', 'r2'], ['aggregate', 'r2']]);
    expect(guide.format.sessions[0].rules).toEqual(['Each side counts its best net score.']);
    expect(guide.teams[0]).toMatchObject({ id: 'palmetto', house: 'The Palmetto House', captainId: 'mark-reese', emblem: 'palmetto' });
    expect(guide.teams[0].memberIds).toContain('jason-sudan');
  });

  it('keeps the draft, Fireball counts and handicaps, with UGL2’s four pre-trip changes', () => {
    const { docs, warnings } = run();
    expect(docAt(docs, `${T}/2026-columbia/private/draft`)).toMatchObject({
      captains: { palmetto: 'mark-reese', crescent: 'ricky-menchaca' },
      rounds: { r1: [{ playerIds: ['mark-reese', null, 'ricky-menchaca', null] }] },
    });
    expect(docAt(docs, `${T}/2026-columbia/fireball/mark-reese`)).toEqual({ counts: { r1: 3, off: 2 } });
    expect(warnings).toContain('Member ID m-unknown is referred to but isn’t on the member list, so it’s left out.'.replace(/’/g, "'"));
    for (const [id, index] of Object.entries(PRE_TRIP_HANDICAPS['2026-columbia'])) {
      expect(docAt(docs, `${T}/2026-columbia/handicaps/${id}`)).toEqual({ index });
    }
    expect(docAt(docs, `${T}/2026-columbia/handicaps/jeff-siarto`)).toEqual({ index: 10.7 });
  });

  it('moves every match file', () => {
    const { docs } = run();
    const matches = docs.filter((d) => d.path.startsWith(`${T}/2026-columbia/matches/`));
    expect(matches).toHaveLength(history.events.find((e) => e.id === '2026-columbia')!.matches.length);
  });
});

// The history pages compare on what they show: points, records, partners, opponents and awards
function summary(data: HistoryData) {
  const stats = playerStats(data);
  const awards = superlatives(data, stats);
  return {
    standings: data.events.map((e) => ({ id: e.id, ...standings(e) })),
    players: [...stats.values()].map((s) => ({
      id: s.id,
      record: s.record,
      points: s.points,
      byFormat: s.byFormat,
      partners: s.partners,
      opponents: s.opponents,
      events: s.events.map((e) => ({ event: e.event.id, team: e.team.id, captain: e.captain, record: e.record, points: e.points })),
    })),
    awards: [...awards.results, ...(awards.scorecards ?? [])].map((a) => ({
      id: a.id,
      entries: a.entries.map((e) => ({ players: e.players, opponents: e.opponents, team: e.team?.id, event: e.event?.id, match: e.match?.id, value: e.value, note: e.note })),
    })),
  };
}

describe.each([
  ['with a guide', true],
  ['from the history alone', false],
])('UGL2 after the move, %s', (_label, withGuide) => {
  const moved = () => {
    const old = oldData(withGuide);
    return historyOfMove(buildFoundersChapter(old, history, readyPeople(old), 'dev').docs, 'dev');
  };

  it('passes the same checks as the history files', () => {
    expect(validateHistory(moved())).toEqual([]);
  });

  it('has the same standings, records and superlatives', () => {
    const after = moved();
    expect(after.events.map((e) => e.id)).toEqual(['2026-columbia']);
    const expected = summary(history);
    // Something real to compare: twelve players' records and awards with winners
    expect(expected.players).toHaveLength(12);
    expect(expected.awards.filter((a) => a.entries.length > 0).length).toBeGreaterThan(5);
    expect(summary(after)).toEqual(expected);
  });

  it('changes only the four pre-trip handicaps', () => {
    const before = history.events[0].handicaps;
    const after = moved().events[0].handicaps;
    const changed = Object.keys(before).filter((id) => before[id] !== after[id]).sort();
    expect(changed).toEqual(Object.keys(PRE_TRIP_HANDICAPS['2026-columbia']).sort());
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
  });
});
