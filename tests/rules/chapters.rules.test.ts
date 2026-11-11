// The Phase 1 layout's rules (firestore.rules, `match /envs/{env}`), one block per row of the "Who can
// do what" table in docs/phase-1-plan.md, plus the ways someone might try to get more access than
// they have. Runs in Firebase's local emulator, a throwaway database (npm run test:rules).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails as no,
  assertSucceeds as ok,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { exportChapter } from '../../src/data/backup';
import { organizerFor } from '../../src/data/chapters';
import { pathsFor } from '../../src/data/paths';
import type { DataEnv, Person, RosterEntry } from '../../src/data/types';
import {
  addEmail,
  addPersonToChapter,
  deleteTrip,
  removeEmail,
  addShots,
  approveChapterRequest,
  completeJoin,
  createPersonInChapter,
  removeFromChapter,
  requestChapter,
  setCoAdmins,
  setHandicap,
  setInviteNote,
  moveInviteToRsvp,
  removeFromTripList,
  clearHandicap,
  saveResults,
  setRole,
  setRsvp,
  setStatus,
  updateProfile,
} from '../../src/data/writes';

let testEnv: RulesTestEnvironment;
const firestoreOf = (ctx: RulesTestContext) => ctx.firestore() as unknown as Firestore;

// ── Who's who ───────────────────────────────────────────────────
// founders: Mark (commissioner, organizer), Jeff (co-admin), Oscar (organizer), Fred (member),
// Alice (alumni), Gus (guest), Ivy (invitee), Nora (member who has never signed in)
// second: Olive (organizer), Sam (member). Stranger: signed in, in no chapter.

interface Seat {
  id: string;
  name: string;
  email?: string;
  chapters: Record<string, RosterEntry>;
}

const SEATS = {
  mark: { id: 'mark-reese', name: 'Mark Reese', email: 'reese296@gmail.com', chapters: { founders: { role: 'organizer', status: 'active' } } },
  jeff: { id: 'jeff-siarto', name: 'Jeff Siarto', email: 'jeff@example.com', chapters: { founders: { role: 'member', status: 'active' } } },
  oscar: { id: 'oscar-org', name: 'Oscar Org', email: 'oscar@example.com', chapters: { founders: { role: 'organizer', status: 'active' } } },
  fred: { id: 'fred-member', name: 'Fred Member', email: 'fred@example.com', chapters: { founders: { role: 'member', status: 'active' } } },
  alice: { id: 'alice-alum', name: 'Alice Alum', email: 'alice@example.com', chapters: { founders: { role: 'member', status: 'alumni' } } },
  gus: { id: 'gus-guest', name: 'Gus Guest', email: 'gus@example.com', chapters: { founders: { role: 'member', status: 'guest' } } },
  ivy: { id: 'ivy-invitee', name: 'Ivy Invitee', email: 'ivy@example.com', chapters: { founders: { role: 'member', status: 'invitee', joinsAs: 'active' } } },
  nora: { id: 'nora-never', name: 'Nora Never', chapters: { founders: { role: 'member', status: 'active' } } },
  olive: { id: 'olive-org', name: 'Olive Org', email: 'olive@example.com', chapters: { second: { role: 'organizer', status: 'active' } } },
  sam: { id: 'sam-second', name: 'Sam Second', email: 'sam@example.com', chapters: { second: { role: 'member', status: 'active' } } },
} satisfies Record<string, Seat>;

type Who = keyof typeof SEATS | 'stranger' | 'signedOut';

const EMAILS: Record<Who, string | null> = {
  ...(Object.fromEntries(Object.entries(SEATS).map(([k, s]) => [k, 'email' in s ? s.email : null])) as Record<keyof typeof SEATS, string | null>),
  stranger: 'stranger@example.com',
  signedOut: null,
};

function as(who: Who): Firestore {
  const email = EMAILS[who];
  if (who === 'signedOut' || !email) return firestoreOf(testEnv.unauthenticatedContext());
  return firestoreOf(testEnv.authenticatedContext(`${who}-uid`, { email, email_verified: true }));
}

const id = (who: keyof typeof SEATS) => SEATS[who].id;

function recordFor(seat: Seat): Person {
  const entries = Object.entries(seat.chapters);
  return {
    name: seat.name,
    college: null,
    bio: null,
    ghin: null,
    photo: null,
    chapterIds: entries.filter(([, e]) => e.status !== 'invitee').map(([c]) => c),
    invitedTo: entries.filter(([, e]) => e.status === 'invitee').map(([c]) => c),
    organizerOf: entries.filter(([, e]) => e.role === 'organizer').map(([c]) => c),
  };
}

const TRIP = '2026-columbia';
const OTHER_TRIP = '2026-austin';

async function seed(env: DataEnv) {
  const P = pathsFor(env);
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = firestoreOf(ctx);
    const put = (path: string, data: object) => setDoc(doc(db, path), data);
    await put(P.admins, { personIds: [id('jeff')] });
    await put(P.chapter('founders'), { name: "The Founder's Chapter" });
    await put(P.chapter('second'), { name: 'Second Chapter' });
    for (const seat of Object.values(SEATS) as Seat[]) {
      await put(P.person(seat.id), recordFor(seat));
      for (const [c, entry] of Object.entries(seat.chapters)) await put(P.rosterEntry(c, seat.id), entry);
      if (seat.email) {
        await put(P.login(seat.email), { personId: seat.id });
        await put(P.contact(seat.id), { emails: [seat.email] });
      }
    }
    await put(P.trip('founders', TRIP), { title: '2026 UGL Invitational', number: 2 });
    await put(P.guide('founders', TRIP), { flights: [] });
    await put(P.draft('founders', TRIP), { published: false });
    await put(P.match('founders', TRIP, 'fourball-1'), { session: 'fourball', match: 1 });
    await put(P.handicap('founders', TRIP, id('fred')), { index: 10 });
    await put(P.rsvp('founders', TRIP, id('fred')), { response: 'yes', note: null });
    await put(P.fireballEntry('founders', TRIP, id('fred')), { counts: { off: 1 } });
    await put(P.invite('founders', TRIP, id('ivy')), { response: 'maybe', note: 'Said maybe by text' });
    await put(P.trip('second', OTHER_TRIP), { title: 'Austin', number: 1 });
    await put(P.guide('second', OTHER_TRIP), { flights: [] });
    await put(P.chapterRequest('req-sam'), {
      name: 'Austin Crew',
      note: null,
      requestedBy: { uid: 'sam-uid', email: 'sam@example.com', name: 'Sam Second' },
      status: 'pending',
    });
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-ugl',
    firestore: { rules: readFileSync(resolve(import.meta.dirname, '..', '..', 'firestore.rules'), 'utf8') },
  });
});

afterAll(() => testEnv?.cleanup());

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed('live');
});

const L = pathsFor('live');
const get = (who: Who, path: string) => getDoc(doc(as(who), path));
const list = (who: Who, path: string) => getDocs(collection(as(who), path));
const joinedRoster = (who: Who, c: string) =>
  getDocs(query(collection(as(who), L.roster(c)), where('status', 'in', ['active', 'alumni', 'guest'])));

const CAN_SEE_FOUNDERS: Who[] = ['mark', 'jeff', 'oscar', 'fred', 'alice', 'gus'];
const CANT_SEE_FOUNDERS: Who[] = ['ivy', 'olive', 'sam', 'stranger', 'signedOut'];
const ORGANIZERS_AND_ADMINS: Who[] = ['mark', 'jeff', 'oscar'];
const MEMBERS: Who[] = ['fred', 'alice', 'gus'];

describe('See a chapter: trips, guides, history, and people who’ve joined, with their RSVPs', () => {
  it.each(CAN_SEE_FOUNDERS)('%s sees The Founder’s Chapter', async (who) => {
    await ok(get(who, L.chapter('founders')));
    await ok(get(who, L.trip('founders', TRIP)));
    await ok(list(who, L.trips('founders')));
    await ok(get(who, L.guide('founders', TRIP)));
    await ok(list(who, L.matches('founders', TRIP)));
    await ok(list(who, L.rsvps('founders', TRIP)));
    await ok(list(who, L.handicaps('founders', TRIP)));
    await ok(list(who, L.fireball('founders', TRIP)));
    await ok(joinedRoster(who, 'founders'));
    await ok(get(who, L.rosterEntry('founders', id('fred'))));
    await ok(get(who, L.person(id('fred'))));
  });

  it.each(CANT_SEE_FOUNDERS)('%s doesn’t', async (who) => {
    await no(get(who, L.chapter('founders')));
    await no(get(who, L.trip('founders', TRIP)));
    await no(get(who, L.guide('founders', TRIP)));
    await no(list(who, L.matches('founders', TRIP)));
    await no(list(who, L.rsvps('founders', TRIP)));
    await no(joinedRoster(who, 'founders'));
    await no(get(who, L.person(id('fred'))));
  });

  it('admins see every chapter; an organizer sees only their own', async () => {
    for (const who of ['mark', 'jeff'] as Who[]) {
      await ok(get(who, L.trip('second', OTHER_TRIP)));
      await ok(get(who, L.person(id('sam'))));
    }
    await no(get('oscar', L.trip('second', OTHER_TRIP)));
    await no(get('oscar', L.person(id('sam'))));
  });

  it('members find their chapters from their own record; only admins list them all', async () => {
    await ok(get('fred', L.person(id('fred'))));
    await no(list('fred', L.chapters));
    await ok(list('jeff', L.chapters));
  });

  it('nobody but admins lists every person or every login', async () => {
    await no(list('oscar', L.people));
    await no(list('fred', L.logins));
    await ok(list('jeff', L.people));
    await ok(list('mark', L.logins));
  });
});

describe('Invite people; see invitees and their RSVPs', () => {
  it.each(ORGANIZERS_AND_ADMINS)('%s sees invitees', async (who) => {
    await ok(list(who, L.roster('founders')));
    await ok(get(who, L.rosterEntry('founders', id('ivy'))));
    await ok(get(who, L.person(id('ivy'))));
    await ok(get(who, L.contact(id('ivy'))));
    await ok(list(who, L.invites('founders', TRIP)));
  });

  it.each(MEMBERS)('%s doesn’t', async (who) => {
    await no(list(who, L.roster('founders'))); // only by asking for joined statuses
    await no(get(who, L.rosterEntry('founders', id('ivy'))));
    await no(get(who, L.person(id('ivy'))));
    await no(get(who, L.contact(id('jeff')))); // someone else's emails
    await no(list(who, L.invites('founders', TRIP)));
  });

  it.each(ORGANIZERS_AND_ADMINS)('%s invites a new person by email', async (who) => {
    await ok(createPersonInChapter(as(who), 'live', 'founders', { personId: 'pat-new', name: 'Pat New', emails: ['Pat@Example.com'] }, { invite: 'guest' }));
    await ok(get('oscar', L.login('pat@example.com')));
  });

  it('an organizer adds someone straight on as a member or guest, without an invitation', async () => {
    await ok(createPersonInChapter(as('oscar'), 'live', 'founders', { personId: 'quinn-guest', name: 'Quinn Guest' }, { status: 'guest' }));
    await ok(get('fred', L.person('quinn-guest'))); // members see them at once
  });

  it('an organizer adds someone from another chapter, after looking up their email', async () => {
    await ok(get('olive', L.login('fred@example.com')));
    await ok(addPersonToChapter(as('olive'), 'live', 'second', id('fred'), { invite: 'active' }));
    await ok(get('olive', L.person(id('fred'))));
  });

  it('members and other chapters’ organizers can’t invite here', async () => {
    const newPerson = { personId: 'pat-new', name: 'Pat New', emails: ['pat@example.com'] };
    await no(createPersonInChapter(as('fred'), 'live', 'founders', newPerson, { invite: 'active' }));
    await no(createPersonInChapter(as('olive'), 'live', 'founders', newPerson, { invite: 'active' }));
    await no(addPersonToChapter(as('olive'), 'live', 'founders', id('sam'), { status: 'active' }));
    await no(get('fred', L.login('alice@example.com')));
  });
});

describe('Invitees join on their first sign-in', () => {
  it('until then they see nothing of the chapter, but can read their own invitation', async () => {
    await no(get('ivy', L.trip('founders', TRIP)));
    await ok(get('ivy', L.person(id('ivy'))));
    await ok(get('ivy', L.rosterEntry('founders', id('ivy'))));
    await ok(get('ivy', L.login('ivy@example.com')));
  });

  it('they join as what they were invited as, and members see them from then on', async () => {
    await ok(completeJoin(as('ivy'), 'live', 'founders', id('ivy'), 'active'));
    await ok(get('ivy', L.trip('founders', TRIP)));
    await ok(get('fred', L.person(id('ivy'))));
    await ok(get('fred', L.rosterEntry('founders', id('ivy'))));
  });

  it('they can’t pick a different status, or join a chapter that didn’t invite them', async () => {
    await no(completeJoin(as('ivy'), 'live', 'founders', id('ivy'), 'guest'));
    await no(completeJoin(as('fred'), 'live', 'second', id('fred'), 'active'));
  });

  it('an organizer can confirm an invitee who never signs in, as any status', async () => {
    await ok(completeJoin(as('oscar'), 'live', 'founders', id('ivy'), 'guest'));
  });
});

describe('Edit trips, guides, teams, results, roster', () => {
  it.each(ORGANIZERS_AND_ADMINS)('%s edits The Founder’s Chapter', async (who) => {
    const db = as(who);
    await ok(setDoc(doc(db, L.trip('founders', TRIP)), { title: 'Edited', number: 2 }));
    await ok(setDoc(doc(db, L.guide('founders', TRIP)), { flights: [] }));
    await ok(setDoc(doc(db, L.match('founders', TRIP, 'singles-1')), { session: 'singles', match: 1 }));
    await ok(setDoc(doc(db, L.trip('founders', '2027-austin')), { title: 'Next year', number: 3 }));
    await ok(updateDoc(doc(db, L.chapter('founders')), { name: "The Founder's Chapter" }));
    await ok(setStatus(db, 'live', 'founders', id('fred'), 'alumni'));
  });

  it.each([...MEMBERS, 'olive', 'sam', 'stranger'] as Who[])('%s can’t', async (who) => {
    const db = as(who);
    await no(setDoc(doc(db, L.trip('founders', TRIP)), { title: 'Edited' }));
    await no(setDoc(doc(db, L.guide('founders', TRIP)), { flights: [] }));
    await no(setDoc(doc(db, L.match('founders', TRIP, 'singles-1')), { session: 'singles' }));
    await no(setStatus(db, 'live', 'founders', id('alice'), 'active'));
  });

  it('organizers take members off the roster, but not other organizers', async () => {
    await ok(removeFromChapter(as('oscar'), 'live', 'founders', id('fred')));
    await no(removeFromChapter(as('oscar'), 'live', 'founders', id('mark')));
    await ok(removeFromChapter(as('jeff'), 'live', 'founders', id('oscar')));
  });

  it('only admins create or delete chapters', async () => {
    await no(setDoc(doc(as('oscar'), L.chapter('third')), { name: 'Third' }));
    await ok(setDoc(doc(as('jeff'), L.chapter('third')), { name: 'Third' }));
    await no(deleteDoc(doc(as('oscar'), L.chapter('founders'))));
  });
});

describe('Delete a trip, with everything in it', () => {
  it('an organizer can, a member can’t', async () => {
    await no(deleteTrip(as('fred'), 'live', 'founders', TRIP));
    await ok(deleteTrip(as('oscar'), 'live', 'founders', TRIP));
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = firestoreOf(ctx);
      for (const path of [L.trip('founders', TRIP), L.guide('founders', TRIP), L.draft('founders', TRIP), L.match('founders', TRIP, 'fourball-1'),
        L.handicap('founders', TRIP, id('fred')), L.fireballEntry('founders', TRIP, id('fred')), L.invite('founders', TRIP, id('ivy'))]) {
        if ((await getDoc(doc(db, path))).exists()) throw new Error(`${path} is still there`);
      }
    });
  });
});

describe('Export the chapter as a backup', () => {
  it('organizers and admins get everything in it, invitees, drafts and emails too', async () => {
    const strip = (path: string) => path.slice(L.root.length + 1);
    const expected = [
      L.chapter('founders'),
      L.rosterEntry('founders', id('ivy')),
      L.person(id('ivy')),
      L.contact(id('fred')),
      L.trip('founders', TRIP),
      L.guide('founders', TRIP),
      L.draft('founders', TRIP),
      L.match('founders', TRIP, 'fourball-1'),
      L.handicap('founders', TRIP, id('fred')),
      L.rsvp('founders', TRIP, id('fred')),
      L.fireballEntry('founders', TRIP, id('fred')),
      L.invite('founders', TRIP, id('ivy')),
    ].map(strip);
    for (const who of ['oscar', 'mark', 'jeff'] as const) {
      const backup = await exportChapter(as(who), 'live', 'founders');
      for (const path of expected) if (!(path in backup.docs)) throw new Error(`${who}'s export is missing ${path}`);
      // Nothing from another chapter
      if (Object.keys(backup.docs).some((path) => path.includes('second') || path.includes(id('sam')))) throw new Error(`${who}'s export has another chapter's data`);
      if (backup.docs[strip(L.contact(id('fred')))] === undefined) throw new Error('no emails');
    }
  });

  it('members and other chapters’ organizers can’t', async () => {
    await no(exportChapter(as('fred'), 'live', 'founders'));
    await no(exportChapter(as('olive'), 'live', 'founders'));
  });
});

describe('Who’s coming: invite notes, RSVPs and handicaps', () => {
  it('organizers keep notes on invitees’ answers; members can’t', async () => {
    await ok(setInviteNote(as('oscar'), 'live', 'founders', TRIP, id('ivy'), 'yes', 'Booked flights'));
    await no(setInviteNote(as('fred'), 'live', 'founders', TRIP, id('ivy'), 'no'));
    await no(setInviteNote(as('olive'), 'live', 'founders', TRIP, id('ivy'), 'no'));
  });

  it('once an invitee has joined, an organizer turns the note into an RSVP members can see', async () => {
    await no(moveInviteToRsvp(as('oscar'), 'live', 'founders', TRIP, id('ivy'), 'maybe')); // not joined yet
    await ok(completeJoin(as('ivy'), 'live', 'founders', id('ivy'), 'active'));
    await no(moveInviteToRsvp(as('fred'), 'live', 'founders', TRIP, id('ivy'), 'maybe'));
    await ok(moveInviteToRsvp(as('oscar'), 'live', 'founders', TRIP, id('ivy'), 'maybe', 'From the text'));
    await ok(get('fred', L.rsvp('founders', TRIP, id('ivy'))));
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      if ((await getDoc(doc(firestoreOf(ctx), L.invite('founders', TRIP, id('ivy'))))).exists()) throw new Error('the note is still there');
    });
  });

  it('organizers take people off the list; members can’t, even themselves', async () => {
    await no(removeFromTripList(as('fred'), 'live', 'founders', TRIP, id('fred')));
    await ok(removeFromTripList(as('oscar'), 'live', 'founders', TRIP, id('fred')));
    await ok(removeFromTripList(as('oscar'), 'live', 'founders', TRIP, id('ivy')));
  });

  it('a player takes back their own handicap, and an organizer anyone’s; another member can’t', async () => {
    await no(clearHandicap(as('alice'), 'live', 'founders', TRIP, id('fred')));
    await ok(clearHandicap(as('fred'), 'live', 'founders', TRIP, id('fred')));
    await ok(clearHandicap(as('oscar'), 'live', 'founders', TRIP, id('fred')));
  });
});

describe('Save results', () => {
  const match = { id: 'fourball-2', session: 'fourball', match: 2, sides: { palmetto: [id('fred')], crescent: [id('jeff')] }, result: { winner: null, margin: 'AS', points: { palmetto: 0.5, crescent: 0.5 } } };

  it('an organizer saves matches, fills handicaps and the course, and the trip becomes a competition', async () => {
    await ok(saveResults(as('oscar'), 'live', 'founders', TRIP, { put: [match], remove: ['fourball-1'], handicaps: { [id('fred')]: 11.2 }, guide: { flights: [] } as never, by: id('oscar') }));
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = firestoreOf(ctx);
      if (!(await getDoc(doc(db, L.match('founders', TRIP, 'fourball-2')))).exists()) throw new Error('match not saved');
      if ((await getDoc(doc(db, L.match('founders', TRIP, 'fourball-1')))).exists()) throw new Error('match not removed');
      if ((await getDoc(doc(db, L.trip('founders', TRIP)))).data()?.competition !== true) throw new Error('not a competition');
      if ((await getDoc(doc(db, L.handicap('founders', TRIP, id('fred'))))).data()?.index !== 11.2) throw new Error('handicap not filled');
    });
  });

  it('members and other chapters’ organizers can’t', async () => {
    await no(saveResults(as('fred'), 'live', 'founders', TRIP, { put: [match], remove: [], by: id('fred') }));
    await no(saveResults(as('olive'), 'live', 'founders', TRIP, { put: [match], remove: [], by: id('olive') }));
  });
});

describe('Remove a sign-in email', () => {
  it('organizers for their members; not for anyone with more rights', async () => {
    await ok(removeEmail(as('oscar'), 'live', id('fred'), 'fred@example.com'));
    await no(removeEmail(as('oscar'), 'live', id('jeff'), 'jeff@example.com'));
    await no(removeEmail(as('fred'), 'live', id('alice'), 'alice@example.com'));
  });
});

describe('See and edit the pairings draft', () => {
  it.each(ORGANIZERS_AND_ADMINS)('%s can', async (who) => {
    await ok(get(who, L.draft('founders', TRIP)));
    await ok(setDoc(doc(as(who), L.draft('founders', TRIP)), { published: false, captains: {}, teams: {}, rounds: {} }));
  });

  it.each([...MEMBERS, 'olive'] as Who[])('%s can’t', async (who) => {
    await no(get(who, L.draft('founders', TRIP)));
    await no(setDoc(doc(as(who), L.draft('founders', TRIP)), { published: true }));
  });
});

describe('Own profile (bio, college, GHIN), handicap, RSVP, Fireball', () => {
  it.each(MEMBERS)('%s changes their own', async (who) => {
    const me = id(who as keyof typeof SEATS);
    const db = as(who);
    await ok(updateProfile(db, 'live', me, { bio: 'Long off the tee', college: 'Texas Tech', ghin: '1234567' }));
    await ok(setHandicap(db, 'live', 'founders', TRIP, me, 12.4, me));
    await ok(setRsvp(db, 'live', 'founders', TRIP, me, 'yes'));
    await ok(addShots(db, 'live', 'founders', TRIP, me, 'off', 1));
  });

  it('but not their name, or anyone else’s records', async () => {
    const db = as('fred');
    await no(updateProfile(db, 'live', id('fred'), { name: 'Frederick' }));
    await no(updateProfile(db, 'live', id('alice'), { bio: 'Hi' }));
    await no(setHandicap(db, 'live', 'founders', TRIP, id('alice'), 5, id('fred')));
    await no(setRsvp(db, 'live', 'founders', TRIP, id('alice'), 'no'));
    await no(addShots(db, 'live', 'founders', TRIP, id('alice'), 'off', 1));
  });

  it('only the expected fields can be saved', async () => {
    const db = as('fred');
    await no(setDoc(doc(db, L.handicap('founders', TRIP, id('fred'))), { index: 'scratch' }));
    await no(setDoc(doc(db, L.rsvp('founders', TRIP, id('fred'))), { response: 'definitely' }));
    await no(setDoc(doc(db, L.fireballEntry('founders', TRIP, id('fred'))), { counts: { off: 1 }, cheat: true }));
  });

  it('an invitee can’t until they’ve joined', async () => {
    await no(setRsvp(as('ivy'), 'live', 'founders', TRIP, id('ivy'), 'yes'));
    await no(addShots(as('ivy'), 'live', 'founders', TRIP, id('ivy'), 'off', 1));
  });
});

describe('Fix anyone’s profile, handicap, RSVP, Fireball', () => {
  it.each(ORGANIZERS_AND_ADMINS)('%s fixes a member’s', async (who) => {
    const db = as(who);
    await ok(updateProfile(db, 'live', id('fred'), { name: 'Fred Member Jr.', bio: 'Fixed' }));
    await ok(setHandicap(db, 'live', 'founders', TRIP, id('fred'), 9.8, 'organizer'));
    await ok(setRsvp(db, 'live', 'founders', TRIP, id('fred'), 'maybe'));
    await ok(addShots(db, 'live', 'founders', TRIP, id('fred'), 'off', 1));
  });

  it('another chapter’s organizer can’t', async () => {
    const db = as('olive');
    await no(updateProfile(db, 'live', id('fred'), { bio: 'Not yours' }));
    await no(setHandicap(db, 'live', 'founders', TRIP, id('fred'), 1, 'olive'));
    await no(addShots(db, 'live', 'founders', TRIP, id('fred'), 'off', 1));
  });

  it('invitees’ answers go in organizers’ notes, never where members can see them', async () => {
    await no(setRsvp(as('oscar'), 'live', 'founders', TRIP, id('ivy'), 'maybe'));
    await no(setHandicap(as('oscar'), 'live', 'founders', TRIP, id('ivy'), 14, 'oscar'));
    await ok(setDoc(doc(as('oscar'), L.invite('founders', TRIP, id('ivy'))), { response: 'yes', note: 'Booked flights' }));
  });
});

describe('Request a chapter', () => {
  it('anyone signed in can ask, in their own name', async () => {
    await ok(requestChapter(as('stranger'), 'live', { uid: 'stranger-uid', email: 'stranger@example.com', name: 'Stan' }, 'Denver Divots', null));
  });

  it('but not signed out, for someone else, or pre-approved', async () => {
    const stan = { uid: 'stranger-uid', email: 'stranger@example.com', name: 'Stan' };
    await no(requestChapter(as('signedOut'), 'live', stan, 'Denver Divots', null));
    await no(requestChapter(as('stranger'), 'live', { ...stan, uid: 'fred-uid' }, 'Denver Divots', null));
    await no(requestChapter(as('stranger'), 'live', { ...stan, email: 'fred@example.com' }, 'Denver Divots', null));
    await no(setDoc(doc(as('stranger'), L.chapterRequest('sneaky')), { name: 'X', note: null, requestedBy: stan, status: 'approved' }));
  });

  it('a requester lists their own requests, asking for just theirs', async () => {
    const mine = (who: Who, uid: string) => getDocs(query(collection(as(who), L.chapterRequests), where('requestedBy.uid', '==', uid)));
    await ok(mine('sam', 'sam-uid'));
    await no(mine('fred', 'sam-uid'));
    await no(list('sam', L.chapterRequests));
  });

  it('an admin finds who’ll organize: someone already in the league, or someone new', async () => {
    const request = (email: string, name: string | null) => ({ name: 'X', note: null, status: 'pending' as const, requestedBy: { uid: 'u', email, name } });
    expect(await organizerFor(as('jeff'), 'live', request('Sam@Example.com', 'Sammy'))).toEqual({ personId: id('sam'), isNew: false, name: 'Sam Second', email: 'sam@example.com' });
    expect(await organizerFor(as('jeff'), 'live', request('new@example.com', 'Fred Member'))).toEqual({ personId: 'fred-member-2', isNew: true, name: 'Fred Member', email: 'new@example.com' });
    expect((await organizerFor(as('jeff'), 'live', request('pat@example.com', null))).name).toBe('pat');
    await no(organizerFor(as('fred'), 'live', request('sam@example.com', null)));
  });

  it('requesters see their own requests; admins see them all', async () => {
    await ok(get('sam', L.chapterRequest('req-sam')));
    await no(get('fred', L.chapterRequest('req-sam')));
    await ok(list('jeff', L.chapterRequests));
    await no(list('oscar', L.chapterRequests));
  });
});

describe('Approve chapter requests; make organizers', () => {
  it('an admin approves: the chapter exists and its requester organizes it', async () => {
    await ok(approveChapterRequest(as('jeff'), 'live', {
      requestId: 'req-sam',
      chapterId: 'austin-crew',
      chapterName: 'Austin Crew',
      organizer: { personId: id('sam'), isNew: false, name: 'Sam Second', email: 'sam@example.com' },
      decidedBy: id('jeff'),
    }));
    await ok(setDoc(doc(as('sam'), L.trip('austin-crew', '2027-austin')), { title: 'First trip', number: 1 }));
  });

  it('approving someone new gives them a person record and a login', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(firestoreOf(ctx), L.chapterRequest('req-stan')), {
        name: 'Denver Divots', note: null, status: 'pending',
        requestedBy: { uid: 'stranger-uid', email: 'stranger@example.com', name: 'Stan' },
      });
    });
    await ok(approveChapterRequest(as('mark'), 'live', {
      requestId: 'req-stan',
      chapterId: 'denver-divots',
      chapterName: 'Denver Divots',
      organizer: { personId: 'stan-new', isNew: true, name: 'Stan New', email: 'stranger@example.com' },
      decidedBy: id('mark'),
    }));
    await ok(get('stranger', L.chapter('denver-divots')));
  });

  it('organizers can’t approve requests or make organizers', async () => {
    await no(approveChapterRequest(as('oscar'), 'live', {
      requestId: 'req-sam', chapterId: 'austin-crew', chapterName: 'Austin Crew',
      organizer: { personId: id('sam'), isNew: false, name: 'Sam', email: 'sam@example.com' }, decidedBy: id('oscar'),
    }));
    await no(setRole(as('oscar'), 'live', 'founders', id('fred'), 'organizer'));
    await no(createPersonInChapter(as('oscar'), 'live', 'founders', { personId: 'pat-new', name: 'Pat' }, { status: 'active' }, 'organizer'));
    await ok(setRole(as('jeff'), 'live', 'founders', id('fred'), 'organizer'));
  });
});

describe('Add or remove co-admins', () => {
  it('only the commissioner', async () => {
    await ok(setCoAdmins(as('mark'), 'live', [id('jeff'), id('oscar')]));
    await no(setCoAdmins(as('jeff'), 'live', [id('jeff'), id('fred')]));
    await no(setCoAdmins(as('oscar'), 'live', [id('oscar')]));
  });

  it('admins can read the list; others can’t', async () => {
    await ok(get('jeff', L.admins));
    await no(get('fred', L.admins));
  });
});

describe('Signed out: the landing page only', () => {
  it('reads nothing', async () => {
    for (const path of [L.chapter('founders'), L.person(id('fred')), L.login('fred@example.com'), L.admins, L.trip('founders', TRIP)]) {
      await no(get('signedOut', path));
    }
  });
});

describe('Nobody gets more access than they have', () => {
  it('members can’t add chapters or organizer rights to their own record', async () => {
    const db = as('fred');
    await no(updateDoc(doc(db, L.person(id('fred'))), { chapterIds: ['founders', 'second'] }));
    await no(updateDoc(doc(db, L.person(id('fred'))), { organizerOf: ['founders'] }));
    await no(setDoc(doc(db, L.rosterEntry('second', id('fred'))), { role: 'member', status: 'active' }));
  });

  it('organizers can’t give organizer rights on the person record either', async () => {
    await no(updateDoc(doc(as('oscar'), L.person(id('fred'))), { organizerOf: ['founders'] }));
  });

  it('nobody can point their own email, or a new one, at someone else', async () => {
    await no(setDoc(doc(as('fred'), L.login('fred2@example.com')), { personId: id('mark') }));
    await no(setDoc(doc(as('stranger'), L.login('stranger@example.com')), { personId: id('fred') }));
  });

  it('organizers add emails for their members, but never for organizers, admins or other chapters', async () => {
    await ok(addEmail(as('oscar'), 'live', id('nora'), 'nora@example.com'));
    await no(addEmail(as('oscar'), 'live', id('jeff'), 'jeff2@example.com')); // a co-admin
    await no(addEmail(as('oscar'), 'live', id('mark'), 'mark2@example.com')); // an organizer
    await no(addEmail(as('oscar'), 'live', id('sam'), 'sam2@example.com')); // another chapter
    await no(setDoc(doc(as('oscar'), L.login('jeff@example.com')), { personId: id('nora') })); // taking over Jeff's email
    await ok(addEmail(as('mark'), 'live', id('jeff'), 'jeff2@example.com'));
  });

  it('a roster entry can’t be saved without the person’s record agreeing', async () => {
    await no(setDoc(doc(as('olive'), L.rosterEntry('second', id('fred'))), { role: 'member', status: 'active' }));
    await no(setDoc(doc(as('jeff'), L.rosterEntry('second', id('fred'))), { role: 'member', status: 'active' }));
  });
});

describe('Live and dev data', () => {
  it('follow the same rules', async () => {
    await seed('dev');
    const D = pathsFor('dev');
    await ok(get('fred', D.trip('founders', TRIP)));
    await no(get('sam', D.trip('founders', TRIP)));
    await ok(completeJoin(as('ivy'), 'dev', 'founders', id('ivy'), 'active'));
  });

  it('are the only two copies', async () => {
    await no(setDoc(doc(as('mark'), 'envs/staging/chapters/founders'), { name: 'Nope' }));
  });
});
