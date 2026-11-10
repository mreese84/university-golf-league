// Where each document lives. Everything sits under envs/live (the live site) or envs/dev (the dev
// server and preview links), so the two never mix; firestore.rules treats both the same.

import type { DataEnv } from './types';

// Emails are stored and looked up in lowercase
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function pathsFor(env: DataEnv) {
  const root = `envs/${env}`;
  const chapter = (c: string) => `${root}/chapters/${c}`;
  const trip = (c: string, t: string) => `${chapter(c)}/trips/${t}`;
  return {
    root,
    admins: `${root}/config/admins`,
    logins: `${root}/logins`,
    login: (email: string) => `${root}/logins/${normalizeEmail(email)}`,
    people: `${root}/people`,
    person: (p: string) => `${root}/people/${p}`,
    contact: (p: string) => `${root}/people/${p}/private/contact`,
    chapterRequests: `${root}/chapterRequests`,
    chapterRequest: (id: string) => `${root}/chapterRequests/${id}`,
    chapters: `${root}/chapters`,
    chapter,
    roster: (c: string) => `${chapter(c)}/members`,
    rosterEntry: (c: string, p: string) => `${chapter(c)}/members/${p}`,
    trips: (c: string) => `${chapter(c)}/trips`,
    trip,
    guide: (c: string, t: string) => `${trip(c, t)}/content/guide`,
    draft: (c: string, t: string) => `${trip(c, t)}/private/draft`,
    handicaps: (c: string, t: string) => `${trip(c, t)}/handicaps`,
    handicap: (c: string, t: string, p: string) => `${trip(c, t)}/handicaps/${p}`,
    rsvps: (c: string, t: string) => `${trip(c, t)}/rsvps`,
    rsvp: (c: string, t: string, p: string) => `${trip(c, t)}/rsvps/${p}`,
    invites: (c: string, t: string) => `${trip(c, t)}/invites`,
    invite: (c: string, t: string, p: string) => `${trip(c, t)}/invites/${p}`,
    fireball: (c: string, t: string) => `${trip(c, t)}/fireball`,
    fireballEntry: (c: string, t: string, p: string) => `${trip(c, t)}/fireball/${p}`,
    matches: (c: string, t: string) => `${trip(c, t)}/matches`,
    match: (c: string, t: string, m: string) => `${trip(c, t)}/matches/${m}`,
  };
}

export type Paths = ReturnType<typeof pathsFor>;
