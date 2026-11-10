import { useEffect } from 'react';
import { useChapter } from '../data/hooks';
import { pathsFor } from '../data/paths';
import type { RosterEntry } from '../data/types';
import { dataEnv } from '../dataEnv';
import { useLiveDoc } from '../guides';
import { chapterPath, followLink, navigate, nextHomePath } from '../routes';
import { describeEntry } from './labels';
import Landing from './Landing';
import { Notice, Waiting, buttonClass } from './parts';
import { useSession } from './sessionContext';

const P = pathsFor(dataEnv);

// One of the signed-in person's chapters, with their place in it
function ChapterCard({ chapterId }: { chapterId: string }) {
  const { user, personId } = useSession();
  const uid = user?.uid ?? null;
  const { status, chapter } = useChapter(chapterId, uid);
  const { data: entry } = useLiveDoc<RosterEntry>(P.roster(chapterId), personId, personId && uid ? `${chapterId}:${personId}:${uid}` : null);
  return (
    <a
      href={chapterPath(chapterId)}
      onClick={(e) => followLink(e, chapterPath(chapterId))}
      className="flex items-center justify-between gap-3 px-5 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
    >
      <span>
        <span className="block font-semibold text-gray-800">{chapter?.name ?? (status === 'loading' ? ' ' : chapterId)}</span>
        <span className="block text-sm text-gray-500">{describeEntry(entry) ?? ' '}</span>
      </span>
      <span aria-hidden="true" className="text-gray-300">→</span>
    </a>
  );
}

// Signed in, but no chapter has added this email
export function NotInLeague() {
  const { user, logOut, joinError } = useSession();
  return (
    <Notice title="You're not in a chapter yet">
      <p>
        You're signed in as <span className="font-medium text-gray-700">{user?.email}</span>, but no chapter has added that email.
      </p>
      <p>Ask your chapter's organizer to add it, or sign out and sign in with the email they have.</p>
      {joinError && <p className="text-red-600">{joinError}</p>}
      <button onClick={logOut} className={buttonClass}>
        Sign out
      </button>
    </Notice>
  );
}

export function SessionWaiting() {
  const { status } = useSession();
  return <Waiting>{status === 'joining' ? 'Joining your chapter…' : 'Signing you in…'}</Waiting>;
}

export const SessionError = () => (
  <Notice title="Couldn't load your account">
    <p>Check your connection and reload.</p>
  </Notice>
);

// The new home page (/next until the switch): the landing page when signed out, your chapter when
// you're in one, a picker when you're in several
export default function HomePage() {
  const { status, person, joinError } = useSession();
  const chapters = status === 'ready' ? (person?.chapterIds ?? []) : [];
  const only = chapters.length === 1 ? chapters[0] : null;

  useEffect(() => {
    if (only) navigate(chapterPath(only), { replace: true });
  }, [only]);

  if (status === 'signedOut') return <Landing continuePath={nextHomePath()} />;
  if (status === 'loading' || status === 'joining') return <SessionWaiting />;
  if (status === 'error') return <SessionError />;
  if (status === 'notInLeague') return <NotInLeague />;
  if (only) return <Waiting>Opening your chapter…</Waiting>;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Your chapters</h2>
      {joinError && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{joinError}</p>}
      <div className="space-y-3">
        {chapters.map((c) => (
          <ChapterCard key={c} chapterId={c} />
        ))}
      </div>
    </div>
  );
}
