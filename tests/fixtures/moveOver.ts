// Made-up stand-ins for today's database (members, trips, a guide, a draft, Fireball counts and
// bios), shaped like the real thing, for the move-over tests. The history comes from the repo's files.

import type { HistoryData } from '../../src/history/types.ts';
import { renamePerson, suggestPeople, type OldData, type PersonChoice } from '../../src/moveOver/transform.ts';
import type { PlayerGuide } from '../../src/types.ts';

// Today's member names are first name and last initial: "Mark R"
const shortName = (name: string) => {
  const [first, ...rest] = name.split(' ');
  return `${first} ${rest.at(-1)![0]}`;
};
export const memberId = (personId: string) => `m-${personId}`;

export const lubbock = ['mark-reese', 'jeff-siarto', 'justin-thompson', 'ricky-menchaca', 'travis-vance', 'patrick-bohac', 'adam-cowdin'];

export function oldData(history: HistoryData, withGuide: boolean): OldData {
  // Everyone in the history except Nick Smith is on the member list, plus Zed, who hasn't played yet
  const members = [
    ...history.players.filter((p) => p.id !== 'nick-smith').map((p) => ({ id: memberId(p.id), name: shortName(p.name), college: p.id === 'mark-reese' ? 'Texas Tech' : undefined })),
    { id: 'm-zed', name: 'Zed Q' },
  ];
  const columbia = history.events.find((e) => e.id === '2026-columbia')!;
  const players = columbia.teams.flatMap((t) => t.players).filter((p) => p !== 'nick-smith');
  const guide: PlayerGuide = {
    title: '2026 UGL Invitational',
    location: 'Columbia, SC',
    timeZone: 'America/New_York',
    theme: { primary: '#041E42', onPrimary: '#ffffff' },
    flights: [],
    teams: [
      { id: 'palmetto', name: 'Team Palmetto', house: 'The Palmetto House', address: '1 Palmetto Way', color: '#041E42', emblem: 'palmetto', memberIds: [], captainId: null },
      { id: 'crescent', name: 'Team Crescent', house: 'The Crescent House', address: '2 Crescent Rd', color: '#3A5A8C', emblem: 'crescent', memberIds: [], captainId: null },
    ],
    rounds: [
      { id: 'r1', date: '2026-11-06', course: 'Aiken Golf Club', label: 'Day 1 · 2-Man Net Best Ball', matchType: 'fourball', groups: [{ teeTime: '10:00 AM', playerIds: players.slice(0, 4).map(memberId) }] },
      { id: 'r2', date: '2026-11-07', course: 'Columbia Country Club', label: 'Day 2 · Singles', matchType: 'singles', groups: [{ teeTime: '9:00 AM', playerIds: [] }] },
      { id: 'r3', date: '2026-11-08', course: 'Solina Golf Club', label: 'Casual round', matchType: 'casual', groups: [] },
    ],
    format: {
      name: 'Modified Ryder Cup',
      summary: 'Two teams, two days.',
      notes: [],
      sessions: [
        { day: 'Day 1', name: '2-Man Net Best Ball', points: 1, rules: ['Each side counts its best net score.'] },
        // Worded differently from the history's "Singles Net Match Play", as in the real guide
        { day: 'Day 2', name: 'Singles Match Play', points: 1, rules: ['Strokes come off the low player.'] },
        { day: 'Day 2', name: 'Team Aggregate', points: 2, rules: [] },
      ],
      pointsToWin: 6,
    },
    football: { away: 'Texas A&M', home: 'South Carolina', date: '2026-11-07', kickoff: '7:30 PM ET', line: null, venue: 'Williams-Brice Stadium' },
    nightlife: [],
  };
  return {
    members,
    trips: [
      { id: 't-columbia', year: 2026, month: 11, location: 'Columbia, SC', attendeeIds: players.map(memberId), selectedById: memberId('ricky-menchaca'), nextSelectorId: null, hasGuide: withGuide },
      { id: 't-lubbock', year: 2025, month: 9, location: 'Lubbock, TX', attendeeIds: lubbock.map(memberId), selectedById: memberId('mark-reese'), nextSelectorId: memberId('ricky-menchaca') },
    ],
    emails: { [memberId('mark-reese')]: 'Reese296@gmail.com', [memberId('jeff-siarto')]: 'jeff@example.com' },
    guides: withGuide ? { 't-columbia': guide } : {},
    drafts: withGuide
      ? {
          't-columbia': {
            published: true,
            handicaps: { [memberId('mark-reese')]: 16.6 },
            captains: { palmetto: memberId('mark-reese'), crescent: memberId('ricky-menchaca') },
            teams: { palmetto: [memberId('mark-reese'), memberId('justin-thompson')], crescent: [memberId('ricky-menchaca')] },
            rounds: { r1: [{ playerIds: [memberId('mark-reese'), null, memberId('ricky-menchaca'), null] }] },
          },
        }
      : {},
    fireball: { 't-columbia': { [memberId('mark-reese')]: { r1: 3, off: 2 }, 'm-unknown': { off: 1 } } },
    bios: { 'jeff-siarto': 'Hits it straight.', 'member-m-zed': 'New this year.' },
  };
}

// Everyone named, ready to move
export function readyPeople(history: HistoryData, old: OldData): PersonChoice[] {
  const rows = suggestPeople(old, history);
  return renamePerson(rows, rows.findIndex((r) => r.memberId === 'm-zed'), 'Zed Quincy');
}

