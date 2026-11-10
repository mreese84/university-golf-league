import { useChapter } from '../data/hooks';
import { pathsFor } from '../data/paths';
import type { RosterEntry } from '../data/types';
import { dataEnv } from '../dataEnv';
import { useLiveDoc } from '../guides';
import { chapterPath, followLink, nextHomePath } from '../routes';
import { NotInLeague, SessionError, SessionWaiting } from './HomePage';
import { describeEntry } from './labels';
import Landing from './Landing';
import { Notice, Waiting } from './parts';
import { useSession } from './sessionContext';

const P = pathsFor(dataEnv);

// A chapter's page. For now it shows the chapter and your place in it; its trips, selection draw,
// members, guides and history move here in steps 6 to 8 of Phase 1.
function ChapterContent({ chapterId }: { chapterId: string }) {
  const { user, personId } = useSession();
  const uid = user?.uid ?? null;
  const { status, chapter } = useChapter(chapterId, uid);
  const { data: entry } = useLiveDoc<RosterEntry>(P.roster(chapterId), personId, personId && uid ? `${chapterId}:${personId}:${uid}` : null);

  if (status === 'loading') return <Waiting>Loading…</Waiting>;
  if (status !== 'ready' || !chapter) {
    return (
      <Notice title="Not one of your chapters">
        <p>You can only see the chapters you belong to.</p>
        <a href={nextHomePath()} onClick={(e) => followLink(e, nextHomePath())} className="text-green-700 font-medium">
          Your chapters
        </a>
      </Notice>
    );
  }
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{chapter.name}</h2>
        <p className="text-sm text-gray-500 mt-1">{describeEntry(entry) ?? 'You’re seeing this chapter as an admin.'}</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-sm text-gray-500">
        Trips, the selection draw, members, Player's Guides and history move here in the next steps of Phase 1.
      </div>
    </div>
  );
}

export default function ChapterPage({ chapterId }: { chapterId: string }) {
  const { status } = useSession();
  if (status === 'signedOut') return <Landing continuePath={chapterPath(chapterId)} />;
  if (status === 'loading' || status === 'joining') return <SessionWaiting />;
  if (status === 'error') return <SessionError />;
  if (status === 'notInLeague') return <NotInLeague />;
  return <ChapterContent chapterId={chapterId} />;
}
