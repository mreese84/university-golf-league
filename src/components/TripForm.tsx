import { useState } from 'react';
import type { Trip } from '../types';

interface TripFormProps {
  members: { id: string; name: string }[];
  trips: Trip[];
  editTrip?: Trip;
  // A new trip can start as a draft, seen only by organizers and its selector until it's published
  draftChoice?: boolean;
  onSave: (trip: Omit<Trip, 'id'>, draft: boolean) => void;
  onCancel: () => void;
}

export default function TripForm({ members, trips, editTrip, draftChoice = false, onSave, onCancel }: TripFormProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(editTrip?.year ?? currentYear);
  const [month, setMonth] = useState(editTrip?.month ?? new Date().getMonth() + 1);
  const [location, setLocation] = useState(editTrip?.location ?? '');
  const [selectedById, setSelectedById] = useState(editTrip?.selectedById ?? '');
  const [attendeeIds, setAttendeeIds] = useState<string[]>(editTrip?.attendeeIds ?? []);
  const [nextSelectorId, setNextSelectorId] = useState(editTrip?.nextSelectorId ?? '');
  const [draft, setDraft] = useState(true);

  const toggleAttendee = (id: string) => {
    setAttendeeIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const selectAll = () => setAttendeeIds(members.map((m) => m.id));
  const selectNone = () => setAttendeeIds([]);

  const canSave = location.trim() && selectedById && attendeeIds.length > 0 && attendeeIds.includes(selectedById);

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      year,
      month,
      location: location.trim(),
      selectedById,
      attendeeIds,
      nextSelectorId: nextSelectorId || null,
    }, draftChoice && draft);
  };

  // Determine who's likely the selector (previous trip's nextSelectorId)
  const lastTrip = trips[trips.length - 1];
  const suggestedSelector = lastTrip?.nextSelectorId || '';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
      <h3 className="text-lg font-semibold text-gray-800">{editTrip ? 'Edit Trip' : 'New Trip'}</h3>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white
                       focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all"
          >
            {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white
                       focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Lubbock, TX"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white
                       placeholder:text-gray-400 focus:outline-none focus:ring-2
                       focus:ring-green-500/30 focus:border-green-500 transition-all"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">
          Who selected this location?
        </label>
        <select
          value={selectedById}
          onChange={(e) => setSelectedById(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white
                     focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all"
        >
          <option value="">Choose a member...</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} {m.id === suggestedSelector ? '(drawn last trip)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-600">Attendees</label>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-xs text-green-600 hover:text-green-700 cursor-pointer">
              Select all
            </button>
            <span className="text-gray-300">|</span>
            <button onClick={selectNone} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">
              Clear
            </button>
          </div>
        </div>
        {members.length === 0 ? (
          <p className="text-sm text-gray-400">Add members first on the Members tab.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {members.map((m) => {
              const checked = attendeeIds.includes(m.id);
              return (
                <label
                  key={m.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all
                    ${checked
                      ? 'bg-green-50 border-green-300 text-green-800'
                      : 'bg-white border-gray-150 text-gray-600 hover:border-gray-300'
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAttendee(m.id)}
                    className="accent-green-600"
                  />
                  <span className="text-sm font-medium">{m.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {selectedById && !attendeeIds.includes(selectedById) && (
        <p className="text-sm text-amber-600">
          The person who selected the location must also be listed as an attendee.
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">
          Draw result <span className="text-gray-400 font-normal">(optional — leave blank if not yet drawn)</span>
        </label>
        <select
          value={nextSelectorId}
          onChange={(e) => setNextSelectorId(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white
                     focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all"
        >
          <option value="">Not yet drawn</option>
          {attendeeIds
            .filter((id) => id !== selectedById)
            .map((id) => {
              const m = members.find((mem) => mem.id === id);
              return (
                <option key={id} value={id}>
                  {m?.name ?? id}
                </option>
              );
            })}
        </select>
      </div>

      {draftChoice && (
        <label className="flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 cursor-pointer">
          <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} className="mt-0.5 accent-amber-600" />
          <span>
            <span className="font-medium">Start it as a draft.</span> Only organizers and whoever it's selected by see it, guide and all,
            until you publish it to the chapter.
          </span>
        </label>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="px-5 py-2.5 bg-green-600 text-white rounded-xl font-medium
                     hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors cursor-pointer"
        >
          {editTrip ? 'Update Trip' : 'Save Trip'}
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2.5 text-gray-500 hover:text-gray-700 font-medium transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
