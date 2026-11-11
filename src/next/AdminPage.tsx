import { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { organizerFor, type RequestOrganizer } from '../data/chapters';
import { COMMISSIONER_EMAIL } from '../data/commissioner';
import { useLiveCollection, useLiveCollections, useLiveDoc, usePeople } from '../data/hooks';
import { chapterIdFor, isValidChapterId } from '../data/ids';
import { imageUrl, isUploaded } from '../data/images';
import { normalizeEmail, pathsFor } from '../data/paths';
import { JOINED_STATUSES, type AdminsConfig, type Chapter, type ChapterRequest, type Login, type Person, type RosterEntry } from '../data/types';
import { uploadImage } from '../data/uploads';
import { approveChapterRequest, declineChapterRequest, setCoAdmins, updateProfile } from '../data/writes';
import { dataEnv } from '../dataEnv';
import { db, storage } from '../firebase';
import { adminPath, chapterPath, followLink } from '../routes';
import { SessionError, SessionWaiting } from './HomePage';
import Landing from './Landing';
import { Notice, buttonClass, inputClass } from './parts';
import { useSession } from './sessionContext';

const P = pathsFor(dataEnv);

function useWork() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      return true;
    } catch (err) {
      console.error(err);
      setError("That didn't save. Check your connection and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</h3>
    {children}
  </section>
);

// A pending request: approve it (as a chapter with an address and an organizer) or decline it
function RequestCard({ request, takenIds, decidedBy }: { request: ChapterRequest & { id: string }; takenIds: string[]; decidedBy: string }) {
  const [organizer, setOrganizer] = useState<RequestOrganizer | null>(null);
  const [name, setName] = useState(request.name);
  const [chapterId, setChapterId] = useState(chapterIdFor(request.name, takenIds));
  const [organizerName, setOrganizerName] = useState('');
  const { busy, error, setError, run } = useWork();
  const idError = !isValidChapterId(chapterId)
    ? 'Lowercase letters, numbers and dashes, starting with a letter (and not one of the app’s own words).'
    : takenIds.includes(chapterId)
      ? 'Another chapter has that address.'
      : null;

  const start = () =>
    void organizerFor(db, dataEnv, request).then(
      (o) => {
        setOrganizer(o);
        setOrganizerName(o.name);
      },
      (err: unknown) => {
        console.error(err);
        setError("Couldn't look up the requester. Check your connection and try again.");
      },
    );
  const approve = () =>
    void run(() =>
      approveChapterRequest(db, dataEnv, { requestId: request.id, chapterId, chapterName: name.trim(), organizer: { ...organizer!, name: organizerName.trim() }, decidedBy }),
    );
  const decline = () => confirm(`Decline “${request.name}”?`) && void run(() => declineChapterRequest(db, dataEnv, request.id, decidedBy));

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
      <div>
        <p className="font-semibold text-gray-800">{request.name}</p>
        <p className="text-sm text-gray-500">
          {request.requestedBy.name ?? 'Someone'} · {request.requestedBy.email}
        </p>
        {request.note && <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">{request.note}</p>}
      </div>
      {organizer ? (
        <div className="space-y-3 border-t border-gray-100 pt-3">
          <label className="block text-xs font-medium text-gray-500">
            Chapter name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={`${inputClass} mt-1`} />
          </label>
          <label className="block text-xs font-medium text-gray-500">
            Address
            <span className="flex items-center gap-1 mt-1">
              <span className="text-sm text-gray-400">/</span>
              <input value={chapterId} onChange={(e) => setChapterId(e.target.value.trim().toLowerCase())} className={inputClass} />
            </span>
            <span className={`block mt-1 ${idError ? 'text-red-600' : 'text-gray-400'}`}>{idError ?? 'Permanent: it can’t change once the chapter exists.'}</span>
          </label>
          {organizer.isNew ? (
            <label className="block text-xs font-medium text-gray-500">
              Organizer, new to the league
              <input value={organizerName} onChange={(e) => setOrganizerName(e.target.value)} placeholder="First Last" className={`${inputClass} mt-1`} />
              <span className="block mt-1 text-gray-400">Signs in with {organizer.email}.</span>
            </label>
          ) : (
            <p className="text-sm text-gray-600">
              Organizer: <span className="font-medium">{organizer.name}</span>, already in the league.
            </p>
          )}
          <div className="flex items-center gap-3">
            <button onClick={approve} disabled={busy || !!idError || !name.trim() || !organizerName.trim()} className={buttonClass}>
              {busy ? 'Approving…' : 'Approve'}
            </button>
            <button onClick={() => setOrganizer(null)} disabled={busy} className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <button onClick={start} disabled={busy} className="text-sm font-medium text-green-700 hover:underline cursor-pointer">
            Approve…
          </button>
          <button onClick={decline} disabled={busy} className="text-sm text-gray-400 hover:text-red-500 cursor-pointer">
            Decline
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// Co-admins see and manage every chapter. Only the commissioner adds or removes them.
function CoAdmins({ ids, names, canChange }: { ids: string[]; names: Record<string, string>; canChange: boolean }) {
  const [email, setEmail] = useState('');
  const { busy, error, setError, run } = useWork();
  const add = () =>
    void run(async () => {
      const login = await getDoc(doc(db, P.login(normalizeEmail(email))));
      if (!login.exists()) {
        setError('Nobody in the league signs in with that email.');
        return;
      }
      await setCoAdmins(db, dataEnv, [...ids, (login.data() as Login).personId]);
      setEmail('');
    });
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
      <p className="text-sm text-gray-600">The commissioner, plus:</p>
      {ids.length === 0 ? (
        <p className="text-sm text-gray-400">No co-admins.</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {ids.map((id) => (
            <li key={id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-gray-800">{names[id] ?? id}</span>
              {canChange && (
                <button
                  onClick={() => confirm(`Remove ${names[id] ?? id} as a co-admin?`) && void run(() => setCoAdmins(db, dataEnv, ids.filter((x) => x !== id)))}
                  disabled={busy}
                  className="text-xs text-gray-400 hover:text-red-500 cursor-pointer"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canChange ? (
        <div className="flex items-center gap-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Their sign-in email" aria-label="Co-admin's sign-in email" className={inputClass} />
          <button onClick={add} disabled={busy || !email.includes('@')} className={`${buttonClass} shrink-0`}>
            Add
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-400">Only the commissioner adds or removes co-admins.</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// The profile photos from before Phase 2 are files the app carries (public/profiles/). This moves
// each into Storage, as if uploaded, so it can be changed from the app like any other; once the
// live and dev data have both been moved, the files can leave the repo.
function BuiltInPhotos({ uid }: { uid: string }) {
  const { items: people, status } = useLiveCollection<Person>(P.people, `admin-people:${uid}`);
  const [moving, setMoving] = useState<{ at: number; of: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const builtIn = people.filter((p) => p.photo && !isUploaded(p.photo)).sort((a, b) => a.name.localeCompare(b.name));
  const uploaded = people.filter((p) => p.photo && isUploaded(p.photo)).length;

  const move = async () => {
    setError(null);
    const all = [...builtIn]; // the list shrinks as each moves
    for (const [i, person] of all.entries()) {
      setMoving({ at: i + 1, of: all.length });
      try {
        const file = await fetch(imageUrl(person.photo, import.meta.env.BASE_URL)!);
        if (!file.ok) throw new Error(`${file.status}`);
        const url = await uploadImage(storage, dataEnv, uid, 'photo', person.id, await file.blob());
        await updateProfile(db, dataEnv, person.id, { photo: url });
      } catch (err) {
        console.error(err);
        setError(`${person.name}'s photo didn't move. Check your connection and try again; the ones already moved stay moved.`);
        break;
      }
    }
    setMoving(null);
  };

  if (status === 'loading') return <p className="text-sm text-gray-400">Loading…</p>;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
      {builtIn.length === 0 ? (
        <p className="text-sm text-gray-600">Every profile photo is an upload{uploaded ? ` (${uploaded})` : ''}, so each can be changed from its profile.</p>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            {builtIn.length === 1 ? '1 photo is' : `${builtIn.length} photos are`} still built into the app: {builtIn.map((p) => p.name).join(', ')}. Move them to
            Storage so they can be changed from profiles like the rest.
          </p>
          <button onClick={() => void move()} disabled={moving !== null} className={buttonClass}>
            {moving ? `Moving ${moving.at} of ${moving.of}…` : `Move ${builtIn.length === 1 ? 'it' : `all ${builtIn.length}`}`}
          </button>
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function AdminHome() {
  const { user, personId } = useSession();
  const uid = user!.uid;
  const key = `admin:${uid}`;
  const { items: requests } = useLiveCollection<ChapterRequest>(P.chapterRequests, key);
  const { items: chapters, status: chaptersStatus } = useLiveCollection<Chapter>(P.chapters, key);
  const rosters = useLiveCollections<RosterEntry>(chapters.map((c) => P.roster(c.id)), key);
  const { data: admins } = useLiveDoc<AdminsConfig>(`${P.root}/config`, 'admins', key);
  const coAdminIds = admins?.personIds ?? [];
  const organizerIds = Object.values(rosters).flatMap((r) => r.filter((e) => e.role === 'organizer').map((e) => e.id));
  const people = usePeople([...organizerIds, ...coAdminIds], uid);
  const names = Object.fromEntries(Object.entries(people).map(([id, p]) => [id, p.name]));
  const isCommissioner = !!user?.emailVerified && user.email?.toLowerCase() === COMMISSIONER_EMAIL;
  const pending = requests.filter((r) => r.status === 'pending');
  const decided = requests.filter((r) => r.status !== 'pending');

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Admin</h2>
        <p className="text-sm text-gray-500 mt-1">Chapters, the requests for new ones, who helps run the league, and profile photos.</p>
      </div>

      <Section title={`Chapter requests${pending.length ? ` (${pending.length})` : ''}`}>
        {pending.length === 0 && <p className="text-sm text-gray-400">None waiting.</p>}
        {pending.map((r) => (
          <RequestCard key={r.id} request={r} takenIds={chapters.map((c) => c.id)} decidedBy={personId ?? uid} />
        ))}
        {decided.length > 0 && (
          <details className="text-sm">
            <summary className="text-gray-500 cursor-pointer">Decided ({decided.length})</summary>
            <ul className="mt-2 space-y-1">
              {decided.map((r) => (
                <li key={r.id} className="text-gray-600">
                  {r.name} · {r.requestedBy.email} · <span className={r.status === 'approved' ? 'text-green-700' : 'text-gray-400'}>{r.status}</span>
                  {r.chapterId && ` as /${r.chapterId}`}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Section>

      <Section title={`Chapters${chapters.length ? ` (${chapters.length})` : ''}`}>
        {chaptersStatus === 'loading' && <p className="text-sm text-gray-400">Loading…</p>}
        {chapters.map((c) => {
          const roster = rosters[P.roster(c.id)] ?? [];
          const organizers = roster.filter((e) => e.role === 'organizer').map((e) => names[e.id] ?? e.id);
          const joined = roster.filter((e) => (JOINED_STATUSES as readonly string[]).includes(e.status)).length;
          const invited = roster.length - joined;
          return (
            <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <a href={chapterPath(c.id)} onClick={(e) => followLink(e, chapterPath(c.id))} className="font-semibold text-gray-800 hover:text-green-700">
                  {c.name}
                </a>
                <p className="text-xs text-gray-400">/{c.id}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {joined} {joined === 1 ? 'member' : 'members'}
                  {invited > 0 && `, ${invited} invited`} · Organized by {organizers.length ? organizers.join(', ') : 'nobody yet'}
                </p>
              </div>
              <a
                href={chapterPath(c.id, 'members')}
                onClick={(e) => followLink(e, chapterPath(c.id, 'members'))}
                className="text-xs font-medium text-green-700 hover:underline shrink-0"
                title="Make organizers on the chapter's Members tab"
              >
                Members →
              </a>
            </div>
          );
        })}
        <p className="text-xs text-gray-400">To make someone an organizer, open the chapter's Members tab and change their role.</p>
      </Section>

      <Section title="Co-admins">
        <CoAdmins ids={coAdminIds} names={names} canChange={isCommissioner} />
      </Section>

      <Section title="Profile photos">
        <BuiltInPhotos uid={uid} />
      </Section>
    </div>
  );
}

// For admins (the commissioner and co-admins): every chapter, requests for new ones, and co-admins
export default function AdminPage() {
  const { status, isAdmin } = useSession();
  if (status === 'signedOut') return <Landing continuePath={adminPath()} />;
  if (status === 'loading' || status === 'joining') return <SessionWaiting />;
  if (status === 'error') return <SessionError />;
  if (!isAdmin) return <Notice title="Admins only"><p>This page is for the league's admins.</p></Notice>;
  return <AdminHome />;
}
