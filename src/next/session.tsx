import { useEffect, useState, type ReactNode } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../auth';
import { COMMISSIONER_EMAIL } from '../data/commissioner';
import { useSignedInPerson } from '../data/hooks';
import { pathsFor } from '../data/paths';
import type { AdminsConfig } from '../data/types';
import { dataEnv } from '../dataEnv';
import { db } from '../firebase';
import { completeInvitations } from './join';
import { SessionContext, type SessionStatus } from './sessionContext';

export function SessionProvider({ children }: { children: ReactNode }) {
  const { user, loading, logOut } = useAuth();
  const found = useSignedInPerson(user?.email ?? null, user?.uid ?? null);
  const { personId, person } = found;

  // Invitations to complete, as a key so the effect runs once per set of them
  const invitedKey = personId && person?.invitedTo.length ? `${personId}|${[...person.invitedTo].sort().join(',')}` : null;
  const [joinResult, setJoinResult] = useState<{ key: string; error: string | null } | null>(null);

  useEffect(() => {
    if (!invitedKey) return;
    const [id, chapters] = invitedKey.split('|');
    let cancelled = false;
    completeInvitations(db, dataEnv, id, chapters.split(',')).then(
      () => {
        if (!cancelled) setJoinResult({ key: invitedKey, error: null });
      },
      (err: unknown) => {
        console.error('Joining failed', err);
        if (!cancelled) setJoinResult({ key: invitedKey, error: "Couldn't finish joining your chapter. Reload to try again." });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [invitedKey]);

  // Admins: the commissioner, or a co-admin in config/admins (which only admins can read, so a
  // refusal means no). Checked once per sign-in.
  const isCommissioner = !!user?.emailVerified && user.email?.toLowerCase() === COMMISSIONER_EMAIL;
  const adminKey = user && personId && !isCommissioner ? `${user.uid}|${personId}` : null;
  const [adminResult, setAdminResult] = useState<{ key: string; isAdmin: boolean } | null>(null);

  useEffect(() => {
    if (!adminKey) return;
    const id = adminKey.split('|')[1];
    let cancelled = false;
    getDoc(doc(db, pathsFor(dataEnv).admins)).then(
      (snap) => {
        if (!cancelled) setAdminResult({ key: adminKey, isAdmin: !!(snap.data() as AdminsConfig | undefined)?.personIds?.includes(id) });
      },
      () => {
        if (!cancelled) setAdminResult({ key: adminKey, isAdmin: false });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [adminKey]);

  const isAdmin = isCommissioner || (!!adminKey && adminResult?.key === adminKey && adminResult.isAdmin);

  const joinError = invitedKey && joinResult?.key === invitedKey ? joinResult.error : null;
  const joining = !!invitedKey && joinResult?.key !== invitedKey;

  let status: SessionStatus;
  if (loading) status = 'loading';
  else if (!user) status = 'signedOut';
  else if (found.status === 'loading') status = 'loading';
  else if (found.status === 'missing') status = 'notInLeague';
  else if (found.status !== 'ready' || !person) status = 'error';
  else if (joining) status = 'joining';
  else if (person.chapterIds.length === 0 && !isAdmin) status = 'notInLeague';
  else status = 'ready';

  return (
    <SessionContext.Provider value={{ status, user, personId: user ? personId : null, person: user ? person : null, isAdmin: !!user && isAdmin, joinError, logOut }}>
      {children}
    </SessionContext.Provider>
  );
}
