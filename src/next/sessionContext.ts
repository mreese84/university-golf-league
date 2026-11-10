import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';
import type { Person } from '../data/types';

// Who's signed in, in Phase 1 terms: their email's login leads to their person record, and their
// first sign-in after an invitation completes the join.
//   signedOut    no one is signed in
//   loading      finding their record
//   notInLeague  signed in, but no chapter has added this email (or they're in no chapter)
//   joining      completing an invitation
//   ready        signed in, with at least one chapter
//   error        couldn't read their record
export type SessionStatus = 'signedOut' | 'loading' | 'notInLeague' | 'joining' | 'ready' | 'error';

export interface Session {
  status: SessionStatus;
  user: User | null;
  personId: string | null;
  person: Person | null;
  isAdmin: boolean; // the commissioner or a co-admin: every chapter, everything in it
  joinError: string | null; // an invitation that couldn't be completed
  logOut: () => Promise<void>;
}

export const SessionContext = createContext<Session | null>(null);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be inside SessionProvider');
  return ctx;
}
