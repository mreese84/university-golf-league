import { useRef, useState, type ReactNode } from 'react';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { FireballBoard } from '../../components/guide/Fireball';
import { bucketsFor, currentBucket } from '../../components/guide/fireballBuckets';
import GuideView from '../../components/guide/GuideView';
import PairingsAdmin from '../../components/guide/PairingsAdmin';
import { ProfileSheet } from '../../components/guide/PlayerProfile';
import { tripTimeZone } from '../../components/guide/timeZones';
import { applyDraftToContent, contentFromView, draftForView, guideForView } from '../../data/guide';
import { useLiveCollection } from '../../data/hooks';
import { pathsFor } from '../../data/paths';
import type { Draft, FireballEntry, GuideContent, Handicap } from '../../data/types';
import { addShots, saveDraft, updateProfile } from '../../data/writes';
import { dataEnv } from '../../dataEnv';
import { db } from '../../firebase';
import { useLiveDoc } from '../../guides';
import { awards, stats } from '../../history/data';
import { eventLabel } from '../../history/format';
import { contentFromGuideFile } from '../../moveOver/transform';
import { chapterPath, followLink, playerPath } from '../../routes';
import type { PlayerGuide } from '../../types';
import type { ChapterTrip } from '../chapterTrips';
import { Notice, Waiting, buttonClass } from '../parts';
import { joinedPeople, nameOf, photoUrl, type ChapterData } from './data';

const P = pathsFor(dataEnv);

type Counts = Record<string, Record<string, number>>;

// Light shape check so a wrong file can't be imported as a guide
function isGuideFile(data: unknown): data is PlayerGuide {
  const g = data as PlayerGuide;
  return (
    !!g && typeof g.title === 'string' && typeof g.location === 'string' && !!g.theme && !!g.format && !!g.football &&
    [g.flights, g.teams, g.rounds, g.nightlife, g.format.sessions].every(Array.isArray)
  );
}

function download(data: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// Fireball shots for the trip. Players log their own (the page knows who's signed in); organizers can
// log for anyone.
function ChapterFireball({ data, trip, view, counts }: { data: ChapterData; trip: ChapterTrip; view: PlayerGuide; counts: Counts }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const self = data.personId && trip.attendeeIds.includes(data.personId) ? data.personId : null;
  const me = data.canManage ? (picked ?? self) : self;
  const teams = view.teams.filter((t) => t.memberIds.length > 0);
  const players = trip.attendeeIds.map((id) => ({ id, name: nameOf(data, id), team: teams.find((t) => t.memberIds.includes(id)) }));
  const add = (bucket: string, delta: 1 | -1) => {
    if (!me) return;
    setError(null);
    addShots(db, dataEnv, data.chapterId, trip.id, me, bucket, delta).catch((err: unknown) => {
      console.error(err);
      setError("Couldn't save that shot. Check your connection and try again.");
    });
  };
  return (
    <FireballBoard
      buckets={bucketsFor(view)}
      initialBucket={currentBucket(view, tripTimeZone(view))}
      players={players}
      teams={teams}
      counts={counts}
      me={me}
      canLogForAnyone={data.canManage}
      canSwitch={false}
      error={error}
      onPickMe={setPicked}
      onAdd={add}
    />
  );
}

// A player's profile: their record, this trip's team and handicap, Fireball shots and bio
function PlayerSheet({ data, personId, view, counts, onClose }: { data: ChapterData; personId: string; view: PlayerGuide; counts: Counts; onClose: () => void }) {
  const person = data.people[personId];
  const record = stats.get(personId);
  const team = view.teams.find((t) => t.memberIds.includes(personId)) ?? null;
  const shots = Object.values(counts[personId] ?? {}).reduce((sum, n) => sum + Math.max(0, n), 0);
  const superlatives = [...awards.results, ...(awards.scorecards ?? [])].flatMap((a) =>
    a.entries
      .filter((e) => e.players.includes(personId))
      .map((e) => ({ title: a.title, value: e.value, where: e.event ? `${eventLabel(e.event)} ${e.event.year}` : '' })),
  );
  const canEditBio = data.canManage || personId === data.personId;
  return (
    <ProfileSheet
      theme={view.theme}
      onClose={onClose}
      onSaveBio={canEditBio ? (bio) => updateProfile(db, dataEnv, personId, { bio: bio.trim() || null }) : undefined}
      profile={{
        name: person?.name ?? '…',
        photo: photoUrl(person),
        college: person?.college ?? null,
        team,
        captain: !!team && team.captainId === personId,
        handicap: view.handicaps?.[personId] ?? record?.events[0]?.handicap ?? null,
        record: record && record.matches.length > 0 ? record.record : null,
        points: record?.points ?? 0,
        historyUrl: record && record.matches.length > 0 ? playerPath(personId) : null,
        fireball: shots,
        superlatives,
        bio: person?.bio ?? null,
        bioLoading: false,
      }}
    />
  );
}

// A trip's Player's Guide in the chapter: the guide, organizers' pairings and tools, Fireball and profiles
export default function GuidePage({ data, tripId }: { data: ChapterData; tripId: string }) {
  const c = data.chapterId;
  const trip = data.trips.find((t) => t.id === tripId);
  const key = `${c}:${tripId}:${data.uid}`;
  const tripPath = P.trip(c, tripId);
  const { status, data: content } = useLiveDoc<GuideContent>(`${tripPath}/content`, 'guide', key);
  const { status: draftStatus, data: draft, retry } = useLiveDoc<Draft>(`${tripPath}/private`, 'draft', data.canManage ? key : null);
  const { items: handicapDocs } = useLiveCollection<Handicap>(P.handicaps(c, tripId), key);
  const { items: fireballDocs } = useLiveCollection<FireballEntry>(P.fireball(c, tripId), key);
  const [profileOf, setProfileOf] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const handicaps = Object.fromEntries(handicapDocs.map((h) => [h.id, h.index]));
  const counts: Counts = Object.fromEntries(fireballDocs.map((f) => [f.id, f.counts ?? {}]));
  const members = joinedPeople(data).map((p) => ({ id: p.id, name: p.name, college: data.people[p.id]?.college ?? undefined }));

  const work = async (task: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error && err.message.startsWith('That file') ? err.message : "That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  // Organizers import a guide file until the guide editors arrive (step 10). Published teams and
  // groups are kept, from the draft.
  const importFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !trip) return;
    void work(async () => {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isGuideFile(parsed)) throw new Error("That file isn't a Player's Guide.");
      const imported = contentFromGuideFile(parsed);
      const batch = writeBatch(db);
      batch.set(doc(db, P.guide(c, tripId)), draft?.published ? applyDraftToContent(imported, draft) : imported);
      batch.update(doc(db, tripPath), { title: parsed.title, theme: parsed.theme, ...(parsed.timeZone ? { timeZone: parsed.timeZone } : {}) });
      await batch.commit();
    });
  };

  const deleteGuide = () => {
    if (!trip || !confirm(`Delete the Player's Guide for ${trip.location} (${trip.year})? Its pairings draft goes too.`)) return;
    void work(async () => {
      const batch = writeBatch(db);
      batch.delete(doc(db, P.guide(c, tripId)));
      batch.delete(doc(db, P.draft(c, tripId)));
      await batch.commit();
    });
  };

  const importInput = <input ref={fileInput} type="file" accept=".json" onChange={importFile} className="hidden" />;
  const back = (
    <a href={chapterPath(c)} onClick={(e) => followLink(e, chapterPath(c))} className="text-sm text-gray-500 hover:text-green-700 transition-colors">
      ← Trips
    </a>
  );

  let body: ReactNode;
  if (data.tripsStatus === 'loading' || status === 'loading') body = <Waiting>Loading…</Waiting>;
  else if (!trip) body = <Notice title="Trip not found"><p>Check the link, or pick the trip from the Trips tab.</p></Notice>;
  else if (status === 'denied' || status === 'error') body = <Notice title="Couldn't load the guide"><p>Check your connection and reload.</p></Notice>;
  else if (!content) {
    body = data.canManage ? (
      <Notice title="No Player's Guide yet">
        <p>Import a guide file (JSON) to create one for this trip. Editing guides in the app comes in a later step.</p>
        <button onClick={() => fileInput.current?.click()} disabled={busy} className={buttonClass}>
          {busy ? 'Importing…' : 'Import guide'}
        </button>
        {importInput}
      </Notice>
    ) : (
      <Notice title="The guide isn't ready yet"><p>Check back closer to the trip.</p></Notice>
    );
  } else {
    // Organizers see the draft's teams and groups; members see them once published
    const shown = data.canManage && draft ? applyDraftToContent(content, draft) : content;
    const view = guideForView(trip, shown, handicaps);
    body = (
      <>
        {data.canManage && (
          <div className="flex items-center justify-end gap-4 text-xs text-gray-400">
            <button onClick={() => download(guideForView(trip, content, handicaps), `ugl-guide-${tripId}.json`)} className="hover:text-green-600 cursor-pointer">
              Export JSON
            </button>
            <button onClick={() => fileInput.current?.click()} disabled={busy} className="hover:text-green-600 cursor-pointer">
              Replace from file
            </button>
            <button onClick={deleteGuide} disabled={busy} className="hover:text-red-500 cursor-pointer">
              Delete guide
            </button>
            {importInput}
          </div>
        )}
        {data.canManage && (
          <PairingsAdmin
            guide={guideForView(trip, content, handicaps)}
            draft={draftStatus === 'ready' || draftStatus === 'missing' ? draftForView(draft, handicaps) : null}
            status={draftStatus}
            attendeeIds={trip.attendeeIds}
            members={members}
            onSave={(d) => saveDraft(db, dataEnv, c, tripId, d, content, handicaps, data.personId)}
            onRetry={retry}
          />
        )}
        <GuideView
          guide={view}
          members={members}
          attendeeCount={trip.attendeeIds.length}
          onOpenPlayer={setProfileOf}
          fireball={<ChapterFireball data={data} trip={trip} view={view} counts={counts} />}
          onSave={data.canManage ? (edited) => setDoc(doc(db, P.guide(c, tripId)), contentFromView(edited, content)) : undefined}
        />
        {profileOf && <PlayerSheet key={profileOf} data={data} personId={profileOf} view={view} counts={counts} onClose={() => setProfileOf(null)} />}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {back}
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{error}</p>}
      {body}
    </div>
  );
}
