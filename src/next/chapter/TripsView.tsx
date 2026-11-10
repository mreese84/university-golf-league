import { useState } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import TripForm from '../../components/TripForm';
import { pathsFor } from '../../data/paths';
import { deleteTrip } from '../../data/writes';
import { dataEnv } from '../../dataEnv';
import { db } from '../../firebase';
import type { Trip as OldTrip } from '../../types';
import { byDate, newTrip, newTripId, type ChapterTrip, type TripFields } from '../chapterTrips';
import { buttonClass } from '../parts';
import { joinedPeople, nameOf, tripDate, type ChapterData } from './data';

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

function TripCard({ data, trip, onEdit, onDelete }: { data: ChapterData; trip: ChapterTrip; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{trip.location}</h3>
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
            {trip.nextSelectorId ? (
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

  const add = async (fields: TripFields) => {
    const id = newTripId(fields, data.trips.map((t) => t.id));
    if (await run(setDoc(doc(db, P.trip(data.chapterId, id)), newTrip(fields, data.trips)))) setAdding(false);
  };
  const update = async (trip: ChapterTrip, fields: TripFields) => {
    if (await run(updateDoc(doc(db, P.trip(data.chapterId, trip.id)), { ...fields }))) setEditingId(null);
  };
  const remove = (trip: ChapterTrip) => {
    if (!confirm(`Delete the ${trip.location} (${trip.year}) trip, with its guide, results and everything else in it?`)) return;
    void run(deleteTrip(db, dataEnv, data.chapterId, trip.id));
  };

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
        <TripForm members={people} trips={oldestFirst.map(forForm)} onSave={(t) => void add(fieldsOf(t))} onCancel={() => setAdding(false)} />
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
              <TripCard key={trip.id} data={data} trip={trip} onEdit={() => setEditingId(trip.id)} onDelete={() => remove(trip)} />
            ),
          )}
        </div>
      )}
    </div>
  );
}
