import { useState } from 'react';
import TripForm from '../../components/TripForm';
import { useLiveDocs } from '../../data/hooks';
import { pathsFor } from '../../data/paths';
import type { Trip } from '../../data/types';
import { createTrip, deleteTrip, publishTrip, updateTrip } from '../../data/writes';
import { dataEnv } from '../../dataEnv';
import { db } from '../../firebase';
import type { Trip as OldTrip } from '../../types';
import { byDate, newTrip, newTripId, type ChapterTrip, type TripFields } from '../chapterTrips';
import { followLink, tripGuidePath, tripResultsPath } from '../../routes';
import { buttonClass } from '../parts';
import { isUpcoming } from '../../data/rsvp';
import { joinedPeople, nameOf, tripDate, type ChapterData } from './data';
import WhosComing from './WhosComing';

const P = pathsFor(dataEnv);

// Today's trip form edits the same fields, so it's reused as is
const forForm = (t: ChapterTrip): OldTrip => ({
  id: t.id,
  year: t.year,
  month: t.month,
  location: t.location,
  attendeeIds: t.attendeeIds,
  selectedById: t.selectedById ?? '',
  nextSelectorId: t.nextSelectorId,
});

const fieldsOf = (t: Omit<OldTrip, 'id'>): TripFields => ({
  year: t.year,
  month: t.month,
  location: t.location,
  attendeeIds: t.attendeeIds,
  selectedById: t.selectedById,
  nextSelectorId: t.nextSelectorId,
});

// A trip's record as saved, without what the app adds when it loads one
const recordOf = (trip: ChapterTrip) => Object.fromEntries(Object.entries(trip).filter(([key]) => key !== 'id' && key !== 'draft')) as unknown as Trip;

// A draft: who can see it, and for organizers, publishing it to the chapter
function DraftNote({ data, trip, onPublish }: { data: ChapterData; trip: ChapterTrip; onPublish: () => Promise<boolean> }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const selector = trip.selectedById && trip.selectedById !== data.personId ? nameOf(data, trip.selectedById) : null;
  const who = data.canManage ? `organizers${selector ? ` and ${selector}` : ''}` : 'organizers and you';
  return (
    <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-2">
      <p>
        <span className="font-semibold">Draft.</span> Only {who} can see this trip and its guide until it's published.
      </p>
      {data.canManage &&
        (asking ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Everyone in the chapter will see it. Publish it?</span>
            <button
              onClick={async () => {
                setBusy(true);
                if (!(await onPublish())) setBusy(false);
              }}
              disabled={busy}
              className="font-semibold text-green-700 hover:underline cursor-pointer disabled:opacity-50"
            >
              {busy ? 'Publishing…' : 'Publish'}
            </button>
            <button onClick={() => setAsking(false)} disabled={busy} className="font-medium text-amber-800 hover:underline cursor-pointer">
              Not yet
            </button>
          </div>
        ) : (
          <button onClick={() => setAsking(true)} className="font-semibold text-green-700 hover:underline cursor-pointer">
            Publish to the chapter…
          </button>
        ))}
    </div>
  );
}

// hasGuide is undefined until it's known, so the card never flashes "+ Add" before a guide loads
function TripCard({ data, trip, hasGuide, onEdit, onDelete, onPublish }: { data: ChapterData; trip: ChapterTrip; hasGuide: boolean | undefined; onEdit: () => void; onDelete: () => void; onPublish: () => Promise<boolean> }) {
  const guide = tripGuidePath(data.chapterId, trip.id);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">
            {trip.location}
            {trip.draft && <span className="ml-2 align-middle rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Draft</span>}
          </h3>
          <p className="text-sm text-gray-500">
            {trip.number ? <span className="font-medium text-gray-700">UGL{trip.number} · </span> : null}
            {tripDate(trip)}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="text-right text-sm">
            <p className="text-gray-500">
              Selected by <span className="font-medium text-gray-700">{nameOf(data, trip.selectedById)}</span>
            </p>
            {trip.draft ? null : trip.nextSelectorId ? (
              <p className="text-green-600 font-medium mt-1">🎯 {nameOf(data, trip.nextSelectorId)} picks next</p>
            ) : (
              <p className="text-amber-500 text-xs mt-1">Draw pending</p>
            )}
          </div>
          {data.canManage && (
            <>
              <button onClick={onEdit} className="text-gray-300 hover:text-green-600 transition-colors cursor-pointer mt-0.5" title="Edit trip">
                ✎
              </button>
              <button onClick={onDelete} className="text-gray-300 hover:text-red-500 transition-colors cursor-pointer mt-0.5" title="Delete trip">
                ✕
              </button>
            </>
          )}
        </div>
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1.5">Attendees ({trip.attendeeIds.length})</p>
        <div className="flex flex-wrap gap-1.5">
          {trip.attendeeIds.map((id) => (
            <span
              key={id}
              className={`text-xs px-2.5 py-1 rounded-full font-medium
                ${id === trip.selectedById ? 'bg-green-100 text-green-700' : id === trip.nextSelectorId ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}
            >
              {nameOf(data, id)}
            </span>
          ))}
        </div>
      </div>
      {trip.draft && <DraftNote data={data} trip={trip} onPublish={onPublish} />}
      {!trip.draft && isUpcoming(trip, new Date().toLocaleDateString('en-CA')) && <WhosComing data={data} trip={trip} />}
      {(hasGuide || (hasGuide === false && data.canManage)) && (
        <a
          href={guide}
          onClick={(e) => followLink(e, guide)}
          className={`flex items-center justify-between px-4 py-2.5 -mx-1 rounded-xl text-sm font-medium transition-colors
            ${hasGuide ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'border border-dashed border-gray-200 text-gray-400 hover:text-green-600 hover:border-green-300'}`}
        >
          <span>{hasGuide ? "Player's Guide" : "+ Add Player's Guide"}</span>
          <span aria-hidden="true">→</span>
        </a>
      )}
      {hasGuide && data.canManage && !trip.draft && (
        <a
          href={tripResultsPath(data.chapterId, trip.id)}
          onClick={(e) => followLink(e, tripResultsPath(data.chapterId, trip.id))}
          className="block text-right text-xs font-medium text-green-700 hover:underline"
        >
          Results →
        </a>
      )}
    </div>
  );
}

export default function TripsView({ data }: { data: ChapterData }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const oldestFirst = [...data.trips].sort(byDate);
  const newestFirst = [...oldestFirst].reverse();
  const people = joinedPeople(data);
  const guides = useLiveDocs<object>(data.trips.map((t) => P.guide(data.chapterId, t.id)), `guides:${data.chapterId}:${data.uid}`);

  const run = async (work: Promise<unknown>) => {
    setError(null);
    try {
      await work;
      return true;
    } catch (err) {
      console.error(err);
      setError("That didn't save. Check your connection and try again.");
      return false;
    }
  };

  const add = async (fields: TripFields, draft: boolean) => {
    const id = newTripId(fields, data.trips.map((t) => t.id));
    if (await run(createTrip(db, dataEnv, data.chapterId, id, newTrip(fields, data.trips), draft))) setAdding(false);
  };
  const update = async (trip: ChapterTrip, fields: TripFields) => {
    if (await run(updateTrip(db, dataEnv, data.chapterId, trip.id, trip.draft, { ...fields }))) setEditingId(null);
  };
  const remove = (trip: ChapterTrip) => {
    if (!confirm(`Delete the ${trip.location} (${trip.year}) trip, with its guide, results and everything else in it?`)) return;
    void run(deleteTrip(db, dataEnv, data.chapterId, trip.id, trip.draft));
  };
  const publish = (trip: ChapterTrip) => run(publishTrip(db, dataEnv, data.chapterId, trip.id, recordOf(trip)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Trips</h2>
        {data.canManage && !adding && (
          <button onClick={() => setAdding(true)} className={buttonClass}>
            + New trip
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{error}</p>}
      {adding && (
        <TripForm members={people} trips={oldestFirst.filter((t) => !t.draft).map(forForm)} draftChoice onSave={(t, draft) => void add(fieldsOf(t), draft)} onCancel={() => setAdding(false)} />
      )}
      {data.tripsStatus === 'loading' ? (
        <p className="text-gray-400 text-center py-8">Loading…</p>
      ) : newestFirst.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No trips yet.{data.canManage ? ' Add the first one above.' : ''}</p>
      ) : (
        <div className="space-y-3">
          {newestFirst.map((trip) =>
            editingId === trip.id ? (
              <TripForm
                key={trip.id}
                members={people}
                trips={oldestFirst.map(forForm)}
                editTrip={forForm(trip)}
                onSave={(t) => void update(trip, fieldsOf(t))}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <TripCard
                key={trip.id}
                data={data}
                trip={trip}
                hasGuide={P.guide(data.chapterId, trip.id) in guides ? !!guides[P.guide(data.chapterId, trip.id)] : undefined}
                onEdit={() => setEditingId(trip.id)}
                onDelete={() => remove(trip)}
                onPublish={() => publish(trip)}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
