// Who's coming on a trip (src/data/rsvp.ts)

import { describe, expect, it } from 'vitest';
import { countsOf, handicapText, isUpcoming, parseHandicap, rsvpRows, sameMembers, yesAttendees } from '../src/data/rsvp.ts';
import type { RosterEntry } from '../src/data/types.ts';

const roster: Record<string, RosterEntry> = {
  mark: { role: 'organizer', status: 'active', since: null },
  jeff: { role: 'member', status: 'active', since: null },
  gus: { role: 'member', status: 'guest', since: null },
  alice: { role: 'member', status: 'alumni', since: null },
  ivy: { role: 'member', status: 'invitee', joinsAs: 'active', since: null },
};

describe('which trips take RSVPs', () => {
  it('ones that haven’t happened yet', () => {
    expect(isUpcoming({ dates: ['2027-10-14', '2027-10-17'], year: 2027, month: 10 }, '2027-10-17')).toBe(true);
    expect(isUpcoming({ dates: ['2026-11-05', '2026-11-08'], year: 2026, month: 11 }, '2026-11-11')).toBe(false);
    // Without dates, the month decides; a trip with no month counts until the year's out
    expect(isUpcoming({ dates: null, year: 2026, month: 11 }, '2026-11-11')).toBe(true);
    expect(isUpcoming({ dates: null, year: 2026, month: 10 }, '2026-11-11')).toBe(false);
    expect(isUpcoming({ dates: null, year: 2026, month: 0 }, '2026-11-11')).toBe(true);
    expect(isUpcoming({ dates: null, year: 2027, month: 1 }, '2026-11-11')).toBe(true);
  });
});

describe('the list', () => {
  const rsvps = [
    { id: 'mark', response: 'yes' as const, note: null },
    { id: 'jeff', response: 'maybe' as const, note: 'Wedding that weekend' },
    { id: 'gone', response: 'yes' as const, note: null }, // no longer on the roster
  ];
  const invites = [
    { id: 'ivy', response: 'yes' as const, note: 'Said yes by text' },
    { id: 'gus', response: 'invited' as const, note: null }, // invited before joining as a guest
    { id: 'jeff', response: 'no' as const, note: 'Old note' }, // his own RSVP wins
  ];
  const rows = rsvpRows(rsvps, invites, roster);

  it('takes RSVPs, then invite notes for anyone without one; invitees are marked', () => {
    expect(rows).toEqual([
      { personId: 'mark', response: 'yes', note: null, invitee: false, source: 'rsvp' },
      { personId: 'jeff', response: 'maybe', note: 'Wedding that weekend', invitee: false, source: 'rsvp' },
      { personId: 'ivy', response: 'yes', note: 'Said yes by text', invitee: true, source: 'invite' },
      { personId: 'gus', response: 'invited', note: null, invitee: false, source: 'invite' },
    ]);
    expect(countsOf(rows)).toEqual({ yes: 2, maybe: 1, invited: 1, no: 0 });
  });

  it('makes attendees of the yeses who’ve joined, never an invitee', () => {
    expect(yesAttendees(rows)).toEqual(['mark']);
    expect(sameMembers(['mark', 'jeff'], ['jeff', 'mark'])).toBe(true);
    expect(sameMembers(['mark'], ['mark', 'jeff'])).toBe(false);
  });
});

describe('handicap indexes', () => {
  it('read as typed, with plus handicaps stored negative', () => {
    expect(parseHandicap('12.4')).toEqual({ index: 12.4, error: null });
    expect(parseHandicap(' 8 ')).toEqual({ index: 8, error: null });
    expect(parseHandicap('+2.1')).toEqual({ index: -2.1, error: null });
    expect(parseHandicap('+0')).toEqual({ index: 0, error: null });
    expect(parseHandicap('')).toEqual({ index: null, error: null });
    expect(parseHandicap('scratch').error).toMatch(/12\.4/);
    expect(parseHandicap('12.45').error).toMatch(/12\.4/);
    expect(parseHandicap('55').error).toMatch(/54\.0/);
    expect(parseHandicap('+11').error).toMatch(/\+10\.0/);
    for (const index of [12.4, -2.1, 0, 54]) expect(parseHandicap(handicapText(index)).index).toBe(index);
    expect([handicapText(4), handicapText(-2.1), handicapText(null)]).toEqual(['4.0', '+2.1', '']);
  });
});
