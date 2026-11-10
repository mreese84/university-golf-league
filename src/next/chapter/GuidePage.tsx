import { useState, type ReactNode } from 'react';
import { deleteField, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { FireballBoard } from '../../components/guide/Fireball';
import { bucketsFor, currentBucket } from '../../components/guide/fireballBuckets';
import GuideView, { type GuideSection } from '../../components/guide/GuideView';
import PairingsAdmin from '../../components/guide/PairingsAdmin';
import { ProfileSheet } from '../../components/guide/PlayerProfile';
import { tripTimeZone } from '../../components/guide/timeZones';
import { applyDraftToContent, contentFromView, draftForView, guideForView } from '../../data/guide';
import { applyFormat, applyRounds, applyTeams, emptyGuide, isEmptyGuide, withoutUndefined } from '../../data/guideEdit';
import { useLiveCollection, useLiveDoc } from '../../data/hooks';
import { pathsFor } from '../../data/paths';
import type { Draft, FireballEntry, GuideContent, Handicap, Match } from '../../data/types';
import { addShots, saveDraft, updateProfile } from '../../data/writes';
import { dataEnv } from '../../dataEnv';
import { db } from '../../firebase';
import { eventLabel } from '../../history/format';
import type { HistoryModel } from '../../history/model';
import { chapterPath, followLink } from '../../routes';
import type { PlayerGuide } from '../../types';
import type { ChapterTrip } from '../chapterTrips';
import { Notice, Waiting, buttonClass } from '../parts';
import { useChapterHistory } from './chapterHistory';
import { joinedPeople, nameOf, photoUrl, type ChapterData } from './data';
import DetailsEditor, { type TripDetails } from './guide/DetailsEditor';
import FlightsEditor from './guide/FlightsEditor';
import FootballEditor from './guide/FootballEditor';
import FormatEditor from './guide/FormatEditor';
import RoundsEditor from './guide/RoundsEditor';
import TeamsEditor from './guide/TeamsEditor';

const P = pathsFor(dataEnv);

type Counts = Record<string, Record<string, number>>;

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
      error={error}
      onPickMe={setPicked}
      onAdd={add}
    />
  );
}

// A player's profile: their record, this trip's team and handicap, Fireball shots and bio
function PlayerSheet({ data, history, personId, view, counts, onClose }: {
  data: ChapterData;
  history: HistoryModel;
  personId: string;
  view: PlayerGuide;
  counts: Counts;
  onClose: () => void;
}) {
  const { stats, awards, links } = history;
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
        historyUrl: record && record.matches.length > 0 ? links.player(personId) : null,
        fireball: shots,
        superlatives,
        bio: person?.bio ?? null,
        bioLoading: false,
      }}
    />
  );
}

// A trip's Player's Guide in the chapter: the guide, organizers' pairings and section editors,
// Fireball and profiles
export default function GuidePage({ data, tripId }: { data: ChapterData; tripId: string }) {
  const c = data.chapterId;
  const trip = data.trips.find((t) => t.id === tripId);
  const key = `${c}:${tripId}:${data.uid}`;
  const tripPath = P.trip(c, tripId);
  const { status, data: content } = useLiveDoc<GuideContent>(`${tripPath}/content`, 'guide', key);
  const { status: draftStatus, data: draft, retry } = useLiveDoc<Draft>(`${tripPath}/private`, 'draft', data.canManage ? key : null);
  const { items: handicapDocs } = useLiveCollection<Handicap>(P.handicaps(c, tripId), key);
  const { items: fireballDocs } = useLiveCollection<FireballEntry>(P.fireball(c, tripId), key);
  const { items: matches } = useLiveCollection<Match>(P.matches(c, tripId), data.canManage ? key : null);
  const [profileOf, setProfileOf] = useState<string | null>(null);
  const [editing, setEditing] = useState<GuideSection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { model: history } = useChapterHistory(data);

  const handicaps = Object.fromEntries(handicapDocs.map((h) => [h.id, h.index]));
  const counts: Counts = Object.fromEntries(fireballDocs.map((f) => [f.id, f.counts ?? {}]));
  const members = joinedPeople(data).map((p) => ({ id: p.id, name: p.name, college: data.people[p.id]?.college ?? undefined }));
  // With results, what the record is built on (teams, rounds, sessions, scoring) is locked
  const locked = matches.length > 0;
  // Every round ID the trip has used, so a new round never takes an old one's Fireball counts
  const usedRoundIds = [...new Set(Object.values(counts).flatMap((byRound) => Object.keys(byRound)))];

  const work = async (task: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      console.error(err);
      setError("That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const createGuide = () => void work(() => setDoc(doc(db, P.guide(c, tripId)), emptyGuide()));

  const deleteGuide = () => {
    if (!trip || !confirm(`Delete the Player's Guide for ${trip.location} (${trip.year})? Its pairings draft goes too.`)) return;
    void work(async () => {
      const batch = writeBatch(db);
      batch.delete(doc(db, P.guide(c, tripId)));
      batch.delete(doc(db, P.draft(c, tripId)));
      await batch.commit();
    });
  };

  // An editor's save: the guide, and the draft when teams or tee times moved its players
  const saveContent = async (next: GuideContent, nextDraft?: Draft | null) => {
    const batch = writeBatch(db);
    batch.set(doc(db, P.guide(c, tripId)), withoutUndefined(next));
    if (nextDraft && draft) batch.set(doc(db, P.draft(c, tripId)), withoutUndefined(nextDraft));
    await batch.commit();
    setEditing(null);
  };

  const saveDetails = async (details: TripDetails) => {
    await updateDoc(doc(db, tripPath), {
      title: details.title,
      dates: details.dates,
      theme: details.theme,
      timeZone: details.timeZone ?? deleteField(),
    });
    setEditing(null);
  };

  const back = (
    <a href={chapterPath(c)} onClick={(e) => followLink(e, chapterPath(c))} className="text-sm text-gray-500 hover:text-green-700 transition-colors">
      ← Trips
    </a>
  );

  let body: ReactNode;
  if (data.tripsStatus === 'loading' || status === 'loading') body = <Waiting>Loading…</Waiting>;
  else if (!trip) body = <Notice title="Trip not found"><p>Check the link, or pick the trip from the Trips tab.</p></Notice>;
  else if (status === 'denied' || status === 'error') body = <Notice title="Couldn't load the guide"><p>Check your connection and reload.</p></Notice>;
  else if (!content || (!data.canManage && isEmptyGuide(content))) {
    body = data.canManage ? (
      <Notice title="No Player's Guide yet">
        <p>Start one, then fill in each part: details, flights, teams and houses, rounds and tee times, the format and points, football and nightlife.</p>
        <button onClick={createGuide} disabled={busy} className={buttonClass}>
          {busy ? 'Starting…' : "Start the Player's Guide"}
        </button>
      </Notice>
    ) : (
      <Notice title="The guide isn't ready yet"><p>Check back closer to the trip.</p></Notice>
    );
  } else {
    // Organizers see the draft's teams and groups; members see them once published
    const shown = data.canManage && draft ? applyDraftToContent(content, draft) : content;
    const view = guideForView(trip, shown, handicaps);
    const close = () => setEditing(null);
    const editor = (section: GuideSection): ReactNode => {
      switch (section) {
        case 'details':
          return <DetailsEditor trip={trip} onSave={saveDetails} onCancel={close} />;
        case 'travel':
          return <FlightsEditor flights={content.flights} onSave={(flights) => saveContent({ ...content, flights })} onCancel={close} />;
        case 'lodging':
          return (
            <TeamsEditor
              content={content}
              locked={locked}
              onSave={(teams) => {
                const next = applyTeams(content, draft, teams);
                return saveContent(next.content, next.draft);
              }}
              onCancel={close}
            />
          );
        case 'rounds':
          return (
            <RoundsEditor
              content={content}
              locked={locked}
              usedIds={usedRoundIds}
              firstDay={trip.dates?.[0]}
              onSave={(rounds) => {
                const next = applyRounds(content, draft, rounds, locked);
                return saveContent(next.content, next.draft);
              }}
              onCancel={close}
            />
          );
        case 'format':
          return <FormatEditor content={content} locked={locked} onSave={(format) => saveContent(applyFormat(content, format, locked))} onCancel={close} />;
        case 'football':
          return <FootballEditor football={content.football} onSave={(football) => saveContent({ ...content, football })} onCancel={close} />;
      }
    };
    body = (
      <>
        {data.canManage && isEmptyGuide(content) && (
          <p className="text-sm text-amber-800 bg-amber-50 rounded-xl px-4 py-2">
            Members see “The guide isn't ready yet” until something's filled in. Use each part's Edit button.
          </p>
        )}
        {data.canManage && (
          <div className="flex items-center justify-end gap-4 text-xs text-gray-400">
            <button onClick={deleteGuide} disabled={busy} className="hover:text-red-500 cursor-pointer">
              Delete guide
            </button>
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
          edit={data.canManage ? { open: editing, onOpen: setEditing, render: editor } : undefined}
        />
        {profileOf && (
          <PlayerSheet key={profileOf} data={data} history={history} personId={profileOf} view={view} counts={counts} onClose={() => setProfileOf(null)} />
        )}
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
