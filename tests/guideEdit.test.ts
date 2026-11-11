// Editing a Player's Guide (src/data/guideEdit.ts), on UGL2 as the move-over left it

import { describe, expect, it } from 'vitest';
import {
  applyFormat,
  applyRounds,
  applyTeams,
  emptyGuide,
  fromClock,
  isEmptyGuide,
  matchesFor,
  newRoundId,
  parseHoles,
  roundsForEditor,
  teamIdFor,
  toClock,
  uniqueId,
} from '../src/data/guideEdit.ts';
import type { Draft, GuideContent } from '../src/data/types.ts';
import { doc } from './fixtures/founders.ts';

const ugl2 = doc<GuideContent>('chapters/founders/trips/2026-columbia/content/guide');

const omit = <T extends object, K extends keyof T>(o: T, keys: K[]) =>
  Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k as K))) as Omit<T, K>;

// UGL2 with three tee times on Day 1, players published in each, and a draft that matches
const withGroups = (): { content: GuideContent; draft: Draft } => {
  const groups = [
    { teeTime: '10:00 AM', playerIds: ['a', 'b', 'c', 'd'] },
    { teeTime: '10:10 AM', playerIds: ['e', 'f', 'g', 'h'] },
    { teeTime: '10:20 AM', playerIds: ['i', 'j', 'k', 'l'] },
  ];
  return {
    content: { ...ugl2, rounds: ugl2.rounds.map((r) => (r.id === 'r1' ? { ...r, groups } : r)) },
    draft: {
      published: true,
      captains: { palmetto: 'a', crescent: 'c' },
      teams: { palmetto: ['a', 'b'], crescent: ['c', 'd'] },
      rounds: { r1: groups.map((g) => ({ playerIds: g.playerIds })) },
    },
  };
};

describe('a new guide', () => {
  it('starts empty, and members are told it isn’t ready', () => {
    expect(isEmptyGuide(emptyGuide())).toBe(true);
    expect(isEmptyGuide(ugl2)).toBe(false);
    expect(isEmptyGuide({ ...emptyGuide(), format: { ...emptyGuide().format, name: 'Ryder Cup' } })).toBe(false);
  });

  it('gives teams and rounds IDs that never clash', () => {
    expect(teamIdFor('Team Palmetto', [])).toBe('palmetto');
    expect(teamIdFor('Team Palmetto', ['palmetto'])).toBe('palmetto-2');
    expect(teamIdFor('', [])).toBe('team');
    expect(uniqueId('2-Man Net Best Ball', ['fourball'], 'session')).toBe('2-man-net-best-ball');
    expect(newRoundId(['r1', 'r2'])).toBe('r3');
    expect(newRoundId(['r2'])).toBe('r1');
  });
});

describe('rounds and tee times', () => {
  it('a removed tee time takes its players with it, published and in the draft; the others keep theirs', () => {
    const { content, draft } = withGroups();
    const rounds = roundsForEditor(content);
    const r1 = rounds.find((r) => r.id === 'r1')!;
    r1.teeTimes = [r1.teeTimes[0], r1.teeTimes[2], { time: '10:30 AM', from: null }];
    const after = applyRounds(content, draft, rounds, false);
    const groups = after.content.rounds.find((r) => r.id === 'r1')!.groups;
    expect(groups.map((g) => [g.teeTime, g.playerIds[0] ?? null])).toEqual([
      ['10:00 AM', 'a'],
      ['10:20 AM', 'i'],
      ['10:30 AM', null],
    ]);
    expect(after.draft!.rounds.r1.map((g) => g.playerIds[0] ?? null)).toEqual(['a', 'i', null]);
    expect(after.draft!.teams).toEqual(draft.teams);
  });

  it('match play sessions recount their matches from the tee times', () => {
    const { content, draft } = withGroups();
    const after = applyRounds(content, draft, roundsForEditor(content), false);
    const counts = Object.fromEntries(after.content.format.sessions.map((s) => [s.id, s.matches]));
    // Fourball: one match per tee time; singles: two per tee time (Day 2 has one); aggregate: one
    expect(counts).toEqual({ fourball: 3, singles: 2, aggregate: 1 });
  });

  it('a removed round takes its sessions and draft groups with it; rounds stay in date order', () => {
    const { content, draft } = withGroups();
    const rounds = roundsForEditor(content).filter((r) => r.id !== 'r2');
    // A new round's ID skips the removed one's, so nothing of r2 (sessions, Fireball counts) attaches to it
    const id = newRoundId([...content.rounds.map((r) => r.id), ...rounds.map((r) => r.id)]);
    rounds.unshift({ id, date: '2026-11-05', course: 'Arrival nine', label: 'Casual', matchType: 'casual', teeTimes: [] });
    const after = applyRounds(content, draft, rounds, false);
    expect(after.content.rounds.map((r) => r.id)).toEqual(['r4', 'r1', 'r3']); // in date order
    expect(after.content.format.sessions.map((s) => s.id)).toEqual(['fourball']);
    expect(Object.keys(after.draft!.rounds)).toEqual(['r1']);
  });

  it('with results, sessions keep their match counts', () => {
    const after = applyRounds(ugl2, null, roundsForEditor(ugl2), true);
    expect(after.content.format.sessions.map((s) => s.matches)).toEqual(ugl2.format.sessions.map((s) => s.matches));
    expect(after.draft).toBeNull();
    expect(after.content.rounds).toEqual(ugl2.rounds);
  });
});

describe('teams', () => {
  it('keep their published players and captain; a removed team leaves the draft', () => {
    const { content, draft } = withGroups();
    const edited = content.teams
      .filter((t) => t.id === 'palmetto')
      .map((t) => ({ ...omit(t, ['memberIds', 'captainId']), house: 'The New House', color: '#123456' }));
    edited.push({ id: teamIdFor('Team Blue', edited.map((t) => t.id)), name: 'Team Blue', house: '', address: '', color: '#0000ff' });
    const after = applyTeams(content, draft, edited);
    expect(after.content.teams.map((t) => [t.id, t.house, t.memberIds.length, t.captainId])).toEqual([
      ['palmetto', 'The New House', 6, 'mark-reese'],
      ['blue', '', 0, null],
    ]);
    expect(after.draft!.teams).toEqual({ palmetto: ['a', 'b'] });
    expect(after.draft!.captains).toEqual({ palmetto: 'a' });
  });
});

describe('format and sessions', () => {
  it('counts each session’s matches from its round, or keeps them when there are results', () => {
    const format = { ...ugl2.format, sessions: ugl2.format.sessions.map((s) => omit(s, ['matches'])) };
    expect(applyFormat(ugl2, format, false).format.sessions.map((s) => s.matches)).toEqual(
      ugl2.format.sessions.map((s) => matchesFor(s, ugl2.rounds)),
    );
    expect(applyFormat(ugl2, format, true).format.sessions).toEqual(ugl2.format.sessions);
  });
});

describe('par and stroke index', () => {
  it('read 18 holes typed or pasted', () => {
    const par = '4 4 3 5 4 4 3 5 4, 4 4 3 5 4 4 3 5 4';
    expect(parseHoles(par, 'par').holes).toHaveLength(18);
    expect(parseHoles('', 'par')).toEqual({ holes: null, error: null });
    expect(parseHoles('4 4 3', 'par').error).toBe('3 of 18 holes.');
    expect(parseHoles(par.replace('5', '7'), 'par').error).toBe('Each hole is a par 3 to 6.');
    const si = Array.from({ length: 18 }, (_, i) => 18 - i).join(' ');
    expect(parseHoles(si, 'strokeIndex').holes?.[0]).toBe(18);
    expect(parseHoles(si.replace('18', '17'), 'strokeIndex').error).toBe('Stroke index uses 1 to 18, each once.');
    expect(parseHoles(ugl2.rounds[0].par!.join(' '), 'par').holes).toEqual(ugl2.rounds[0].par);
  });
});

describe('times', () => {
  it('go between the guide’s “10:00 AM” and a time input’s “10:00”', () => {
    expect(toClock('10:00')).toBe('10:00 AM');
    expect(toClock('13:05')).toBe('1:05 PM');
    expect(toClock('00:30')).toBe('12:30 AM');
    expect(toClock('12:00')).toBe('12:00 PM');
    expect(toClock('')).toBe('');
    for (const t of ['10:00 AM', '1:05 PM', '12:30 AM', '12:00 PM']) expect(toClock(fromClock(t))).toBe(t);
    expect(fromClock('noonish')).toBe('');
  });
});
