import { updateProfile } from '../data/writes';
import { dataEnv } from '../dataEnv';
import { db } from '../firebase';
import { followLink, mePath, requestChapterPath } from '../routes';
import ProfileForm from './chapter/ProfileForm';
import { NotInLeague, SessionError, SessionWaiting } from './HomePage';
import Landing from './Landing';
import PhotoEditor from './PhotoEditor';
import { useSession } from './sessionContext';

// Your own profile: photo, bio, college and GHIN number. Your name is fixed by your chapter's organizer.
export default function ProfilePage() {
  const { status, person, personId } = useSession();
  if (status === 'signedOut') return <Landing continuePath={mePath()} />;
  if (status === 'loading' || status === 'joining') return <SessionWaiting />;
  if (status === 'error') return <SessionError />;
  if (status === 'notInLeague' || !person || !personId) return <NotInLeague />;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{person.name}</h2>
        <p className="text-sm text-gray-500">Your profile, as your chapters see it.</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
        <PhotoEditor personId={personId} person={person} />
        <ProfileForm key={personId} person={person} allowName={false} onSave={(changes) => updateProfile(db, dataEnv, personId, changes)} />
      </div>
      <p className="text-xs text-gray-400">To change your name, ask your chapter's organizer.</p>
      <a href={requestChapterPath()} onClick={(e) => followLink(e, requestChapterPath())} className="block text-sm font-medium text-green-700">
        Start a new chapter →
      </a>
    </div>
  );
}
