// A trip's results (src/data/results.ts), on UGL2 as the move-over left it. The Squabbit exports
// here are made from UGL2's own scorecards, so reading them back must give UGL2's results exactly.

import { describe, expect, it } from 'vitest';
import {
  aggregateMatch,
  checkResults,
  importSquabbit,
  manualMatch,
  parseSquabbit,
  suggestedPairs,
  type SavedMatch,
} from '../src/data/results.ts';
import type { GuideContent, Person, Trip, TripRound } from '../src/data/types.ts';
import { netScores } from '../src/history/scoring.ts';
import { doc, foundersChapter } from './fixtures/founders.ts';

const T = 'chapters/founders/trips/2026-columbia';
const trip = { ...doc<Trip>(T), id: '2026-columbia' };
const guide = doc<GuideContent>(`${T}/content/guide`);
const { people, trips } = foundersChapter();
const ugl2 = trips.find((t) => t.id === '2026-columbia')!;
const matches = ugl2.matches as SavedMatch[];
const session = (id: string) => guide.format.sessions.find((s) => s.id === id)!;
const round = (id: string) => guide.rounds.find((r) => r.id === id)!;
const nameOf = (id: string) => people.find((p) => p.id === id)!.person.name;
const roster = people.map((p) => ({ id: p.id, name: p.person.name }));

// A Squabbit export for a group, made from scorecard rows
function exportCsv(course: string, teeTime: string, r: TripRound, rows: { player: string; strokes: number; gross: (number | null)[] }[], tweak?: (net: string[]) => void) {
  const holes = Array.from({ length: 18 }, (_, i) => `Hole ${i + 1}`);
  const lines = [`"${course}","${teeTime}"`, ['Player', 'Handicap', ...holes, 'Total'].join(','), ['S.I.', '', ...r.strokeIndex!].join(','), ['Par', '', ...r.par!].join(',')];
  for (const row of rows) {
    const net = netScores(row, r).map((n, h) => (n === null ? '-' : n - r.par![h] === 0 ? 'E' : String(n - r.par![h])));
    tweak?.(net);
    lines.push([nameOf(row.player), ugl2.handicaps[row.player], ...row.gross.map((g) => g ?? '-')].join(','));
    lines.push(['', row.strokes, ...net].join(','));
  }
  return lines.join('\n');
}

const fourballExports = () =>
  matches
    .filter((m) => m.session === 'fourball')
    .map((m, i) => parseSquabbit(`group-${i + 1}.csv`, exportCsv('Columbia CC', `Nov 6, 2026 10:${i}0 AM`, round('r1'), m.scores!)));

// Singles: two matches to a group
const singles = matches.filter((m) => m.session === 'singles');
const singlesExports = () =>
  [0, 2, 4].map((i, g) => parseSquabbit(`singles-${g + 1}.csv`, exportCsv('Fort Jackson', `Nov 7, 2026 9:${g}0 AM`, round('r2'), [...singles[i].scores!, ...singles[i + 1].scores!])));
const singlesPairs = singles.map((m) => [m.sides.palmetto[0], m.sides.crescent[0]] as [string, string]);

const base = { teams: guide.teams, people: roster, handicaps: ugl2.handicaps };

describe('Squabbit exports', () => {
  it('read the course, tee time, par, stroke index and each player’s card', () => {
    const [ex] = fourballExports();
    expect(ex.course).toBe('Columbia CC');
    expect(ex.par).toEqual(round('r1').par);
    expect(ex.players.map((p) => p.name)).toEqual(matches[0].scores!.map((r) => nameOf(r.player)));
    expect(ex.players[0].strokes).toBe(matches[0].scores![0].strokes);
  });

  it('say what’s wrong with a file that isn’t one', () => {
    expect(() => parseSquabbit('notes.csv', 'hello,world')).toThrow('notes.csv: the first line should be the course and tee time');
    expect(() => parseSquabbit('x.csv', '"Course","Nov 6, 2026 10:00 AM"\nPlayer,Hole 1')).toThrow('Hole 1 through Hole 18');
  });

  it('give UGL2’s fourball matches back exactly', () => {
    const got = importSquabbit({ ...base, session: session('fourball'), round: round('r1'), exports: fourballExports().reverse(), pairs: [] });
    expect(got.problems).toEqual([]);
    expect(got.matches).toEqual(matches.filter((m) => m.session === 'fourball').map(({ id, session, match, sides, result, scores }) => ({ id, session, match, sides, result, scores })));
    expect(got.course).toBeNull(); // the round already has its par and stroke index
    expect(got.handicaps).toEqual({});
  });

  it('give UGL2’s singles back from three groups, with who played whom', () => {
    const got = importSquabbit({ ...base, session: session('singles'), round: round('r2'), exports: singlesExports(), pairs: singlesPairs });
    expect(got.problems).toEqual([]);
    expect(got.matches.map((m) => [m.id, m.sides, m.result])).toEqual(singles.map((m) => [m.id, m.sides, m.result]));
    // Without pairs, it asks
    const asked = importSquabbit({ ...base, session: session('singles'), round: round('r2'), exports: singlesExports(), pairs: [] });
    expect(asked.problems[0]).toBe('singles-1.csv: say who played whom');
  });

  it('add up the gross team total from the same cards', () => {
    const got = importSquabbit({ ...base, session: session('aggregate'), round: round('r2'), exports: singlesExports(), pairs: [] });
    const real = matches.find((m) => m.session === 'aggregate')!;
    expect(got.problems).toEqual([]);
    expect(got.matches).toEqual([{ id: real.id, session: real.session, match: real.match, sides: real.sides, totals: real.totals, result: real.result }]);
  });

  it('refuse a net team total: singles cards only have strokes off the low player', () => {
    const net = { ...session('aggregate'), basis: 'net' as const };
    expect(importSquabbit({ ...base, session: net, round: round('r2'), exports: singlesExports(), pairs: [] }).problems[0]).toMatch(/Type its totals in instead/);
  });

  it('fill in the round’s par and stroke index, and missing handicaps, from the exports', () => {
    const bare = { ...round('r1'), par: undefined, strokeIndex: undefined };
    const got = importSquabbit({ ...base, handicaps: {}, session: session('fourball'), round: bare, exports: fourballExports(), pairs: [] });
    expect(got.course).toEqual({ par: round('r1').par, strokeIndex: round('r1').strokeIndex });
    expect(Object.keys(got.handicaps)).toHaveLength(12);
    expect(got.handicaps['mark-reese']).toBe(ugl2.handicaps['mark-reese']);
  });

  it('stop on a name it doesn’t know, unless told who it is', () => {
    const exports = fourballExports();
    exports[0].players[0].name = 'J. Collins';
    const asked = importSquabbit({ ...base, session: session('fourball'), round: round('r1'), exports, pairs: [] });
    expect(asked.problems).toEqual(['group-1.csv: who is "J. Collins"?']);
    expect(asked.matches).toEqual([]);
    const told = importSquabbit({ ...base, names: { 'J. Collins': 'john-collins' }, session: session('fourball'), round: round('r1'), exports, pairs: [] });
    expect(told.problems).toEqual([]);
  });

  it('stop when the strokes fall on different holes than Squabbit’s, or it’s the wrong day or course', () => {
    const r = round('r1');
    const m = matches[0];
    const off = parseSquabbit('off.csv', exportCsv('Columbia CC', 'Nov 6, 2026 10:00 AM', r, m.scores!, (net) => (net[0] = '+3')));
    expect(importSquabbit({ ...base, session: session('fourball'), round: r, exports: [off], pairs: [] }).problems[0]).toMatch(/net scores differ from Squabbit's on hole 1$/);
    const wrongDay = parseSquabbit('day.csv', exportCsv('Columbia CC', 'Nov 7, 2026 10:00 AM', r, m.scores!));
    expect(importSquabbit({ ...base, session: session('fourball'), round: r, exports: [wrongDay], pairs: [] }).problems[0]).toMatch(/played 2026-11-07/);
    const otherCourse = { ...r, par: [...r.par!].reverse() };
    expect(importSquabbit({ ...base, session: session('fourball'), round: otherCourse, exports: [fourballExports()[0]], pairs: [] }).problems[0]).toMatch(/don't match/);
  });
});

describe('results typed in by hand', () => {
  it('a match play result: the winner takes the points; halved splits them', () => {
    const s = session('fourball');
    expect(manualMatch(s, 2, { palmetto: ['a'], crescent: ['b'] }, 'crescent', '3 & 2').result).toEqual({ winner: 'crescent', margin: '3&2', points: { palmetto: 0, crescent: 1 } });
    expect(manualMatch(s, 2, { palmetto: ['a'], crescent: ['b'] }, null, '1 up').result).toEqual({ winner: null, margin: 'AS', points: { palmetto: 0.5, crescent: 0.5 } });
    expect(manualMatch(s, 1, { palmetto: ['a'], crescent: ['b'] }, 'palmetto', '1 up').result.margin).toBe('1 UP');
  });

  it('a team total: lowest wins', () => {
    expect(aggregateMatch(session('aggregate'), { palmetto: [], crescent: [] }, { palmetto: 534, crescent: 557 }).result).toEqual({ winner: 'palmetto', margin: '23 strokes', points: { palmetto: 2, crescent: 0 } });
    expect(aggregateMatch(session('aggregate'), { palmetto: [], crescent: [] }, { palmetto: 540, crescent: 540 }).result).toEqual({ winner: null, margin: 'Tied', points: { palmetto: 1, crescent: 1 } });
  });

  it('singles pairs come from the guide’s groups: slots 1 v 2 and 3 v 4', () => {
    const r = { ...round('r2'), groups: [{ teeTime: '9:00 AM', playerIds: ['a', 'b', 'c', 'd'] }] };
    expect(suggestedPairs(r, ['a', 'b', 'c', 'd'])).toEqual([['a', 'b'], ['c', 'd']]);
    expect(suggestedPairs(r, ['a', 'x'])).toEqual([]);
  });
});

describe('checks before saving', () => {
  const everyone = people as { id: string; person: Person }[];

  it('UGL2 as it is passes', () => {
    expect(checkResults(trip, guide, ugl2.handicaps, matches, everyone)).toEqual([]);
  });

  it('a slip is caught, said plainly', () => {
    const wrong = matches.map((m) => (m.id === 'fourball-1' ? { ...m, sides: { ...m.sides, palmetto: ['nick-smith', 'greg-dundas'] } } : m));
    const errors = checkResults(trip, guide, ugl2.handicaps, wrong, everyone);
    expect(errors).toContain('fourball-1: "nick-smith" isn\'t on palmetto');
    const noHandicap = { ...ugl2.handicaps };
    delete noHandicap['mark-reese'];
    expect(checkResults(trip, guide, noHandicap, matches, everyone)).toContain('needs a handicap for "mark-reese"');
  });

  it('a trip needs its days before it can have results', () => {
    expect(checkResults({ ...trip, dates: null }, guide, ugl2.handicaps, matches, everyone)[0]).toMatch(/first and last day/);
  });
});
