import { useChapter, usePeople, useRoster, useTrips } from '../data/hooks';
import { pathsFor } from '../data/paths';
import type { RosterEntry } from '../data/types';
import { dataEnv } from '../dataEnv';
import { useLiveDoc } from '../guides';
import { chapterPath, followLink, nextHomePath, type ChapterTab } from '../routes';
import { hasJoined, type ChapterData } from './chapter/data';
import MembersView from './chapter/MembersView';
import SelectionView from './chapter/SelectionView';
import TripsView from './chapter/TripsView';
import { NotInLeague, SessionError, SessionWaiting } from './HomePage';
import { describeEntry } from './labels';
import Landing from './Landing';
import { Notice, Waiting } from './parts';
import { useSession } from './sessionContext';

const P = pathsFor(dataEnv);

const TABS: { key: ChapterTab; label: string }[] = [
  { key: 'trips', label: 'Trips' },
  { key: 'selection', label: 'Selection' },
  { key: 'members', label: 'Members' },
];

// A chapter's home: its trips, selection draw and members. Guides and history join in steps 7–8.
function ChapterHome({ chapterId, tab }: { chapterId: string; tab: ChapterTab }) {
  const { user, personId, isAdmin } = useSession();
  const uid = user!.uid;
  const { status, chapter } = useChapter(chapterId, uid);
  const { data: myEntry } = useLiveDoc<RosterEntry>(P.roster(chapterId), personId, personId ? `${chapterId}:${personId}:${uid}` : null);
  const canManage = isAdmin || (hasJoined(myEntry ?? undefined) && myEntry?.role === 'organizer');
  const { roster } = useRoster(status === 'ready' ? chapterId : null, uid, canManage);
  const people = usePeople(roster.map((e) => e.id), uid);
  const { status: tripsStatus, trips } = useTrips(status === 'ready' ? chapterId : null, uid);

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

  const data: ChapterData = {
    chapterId,
    canManage,
    isAdmin,
    personId,
    uid,
    roster,
    rosterById: Object.fromEntries(roster.map((e) => [e.id, e])),
    people,
    trips,
    tripsStatus,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{chapter.name}</h2>
        <p className="text-sm text-gray-500 mt-1">{describeEntry(myEntry) ?? (isAdmin ? 'Admin' : '')}</p>
      </div>
      <nav className="flex gap-1 border-b border-gray-200 -mx-4 px-4">
        {TABS.map((t) => (
          <a
            key={t.key}
            href={chapterPath(chapterId, t.key)}
            onClick={(e) => followLink(e, chapterPath(chapterId, t.key))}
            className={`px-3 sm:px-5 py-3 text-sm font-medium relative transition-colors ${tab === t.key ? 'text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
            {tab === t.key && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-green-600 rounded-full" />}
          </a>
        ))}
      </nav>
      {tab === 'trips' && <TripsView data={data} />}
      {tab === 'selection' && <SelectionView data={data} />}
      {tab === 'members' && <MembersView data={data} />}
    </div>
  );
}

export default function ChapterPage({ chapterId, tab }: { chapterId: string; tab: ChapterTab }) {
  const { status } = useSession();
  if (status === 'signedOut') return <Landing continuePath={chapterPath(chapterId, tab)} />;
  if (status === 'loading' || status === 'joining') return <SessionWaiting />;
  if (status === 'error') return <SessionError />;
  if (status === 'notInLeague') return <NotInLeague />;
  return <ChapterHome chapterId={chapterId} tab={tab} />;
}
