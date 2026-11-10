// The Player's Guide between the Phase 1 layout and today's guide components (src/data/guide.ts),
// on UGL2 as the move-over leaves it, and on a guide imported from a file.

import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { applyDraftToContent, clearPairingsInContent, contentFromView, draftForView, guideForView, sessionTotal } from '../src/data/guide.ts';
import type { GuideContent, Trip } from '../src/data/types.ts';
import type { HistoryData } from '../src/history/types.ts';
import { buildFoundersChapter, contentFromGuideFile } from '../src/moveOver/transform.ts';
import { loadHistory, publicHistory } from '../scripts/loadHistory.ts';
import { oldData, readyPeople } from './fixtures/moveOver.ts';

let history: HistoryData;
let trip: Trip;
let content: GuideContent;

beforeAll(async () => {
  const { data } = await loadHistory(resolve(import.meta.dirname, '..', 'history'));
  history = publicHistory(data, false);
  const old = oldData(history, true);
  const { docs } = buildFoundersChapter(old, history, readyPeople(history, old), 'dev');
  const at = (path: string) => docs.find((d) => d.path === path)!.data;
  trip = at('envs/dev/chapters/founders/trips/2026-columbia') as unknown as Trip;
  content = at('envs/dev/chapters/founders/trips/2026-columbia/content/guide') as unknown as GuideContent;
});

describe('the guide as the guide components read it', () => {
  it('shows each session’s total points on its day, and what wins', () => {
    const view = guideForView(trip, content, { 'mark-reese': 16.6 });
    expect(view.format.sessions.map((s) => [s.day, s.name, s.points])).toEqual([
      ['Day 1', '2-Man Net Best Ball', 3],
      ['Day 2', 'Singles Net Match Play', 6],
      ['Day 2', 'Team Aggregate', 2],
    ]);
    expect(view.format.pointsToWin).toBe(6);
    expect(view).toMatchObject({ title: '2026 UGL Invitational', location: 'Columbia, SC', timeZone: 'America/New_York', handicaps: { 'mark-reese': 16.6 } });
  });

  it('keeps an imported guide’s session points as the file had them', () => {
    const file = oldData(history, true).guides['t-columbia'];
    const imported = contentFromGuideFile(file);
    expect(imported.teams.every((t) => t.memberIds.length === 0)).toBe(true);
    const view = guideForView(trip, imported, {});
    expect(view.format.sessions.map((s) => [s.day, s.name, s.points])).toEqual(file.format.sessions.map((s) => [s.day, s.name, s.points]));
    expect(imported.format.sessions.map(sessionTotal)).toEqual(file.format.sessions.map((s) => s.points));
  });
});

describe('editing and pairings', () => {
  it('guide edits change houses, flights, the game and nightlife, never who’s on a team', () => {
    const view = guideForView(trip, applyDraftToContent(content, { captains: {}, teams: { palmetto: ['zed-quincy'] }, rounds: {} }), {});
    view.teams[0] = { ...view.teams[0], house: 'The New House', address: '9 Elm St' };
    view.nightlife = [{ date: '2026-11-06', plan: 'Dinner' }];
    const saved = contentFromView(view, content);
    expect(saved.teams[0]).toMatchObject({ house: 'The New House', address: '9 Elm St', memberIds: content.teams[0].memberIds });
    expect(saved.nightlife).toEqual([{ date: '2026-11-06', plan: 'Dinner' }]);
    expect(saved.rounds).toEqual(content.rounds);
  });

  it('a published draft fills in teams and groups; clearing puts them back to TBD', () => {
    const draft = { captains: { palmetto: 'mark-reese' }, teams: { palmetto: ['mark-reese', 'jeff-siarto'] }, rounds: { r1: [{ playerIds: ['mark-reese', null, null, null] }] } };
    const shown = applyDraftToContent(content, draft);
    expect(shown.teams[0]).toMatchObject({ memberIds: ['mark-reese', 'jeff-siarto'], captainId: 'mark-reese' });
    expect(shown.teams[1]).toMatchObject({ memberIds: [], captainId: null });
    expect(shown.rounds[0].groups[0].playerIds).toEqual(['mark-reese', null, null, null]);
    const cleared = clearPairingsInContent(shown);
    expect(cleared.teams.every((t) => t.memberIds.length === 0 && t.captainId === null)).toBe(true);
    expect(cleared.rounds.every((r) => r.groups.every((g) => g.playerIds.length === 0))).toBe(true);
  });

  it('the pairings panel gets the draft with the handicaps beside it', () => {
    expect(draftForView(null, { 'mark-reese': 16.6 })).toEqual({ published: false, captains: {}, teams: {}, rounds: {}, handicaps: { 'mark-reese': 16.6 } });
  });
});
