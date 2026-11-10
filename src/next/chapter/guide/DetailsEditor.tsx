import { useState } from 'react';
import { tripTimeZone } from '../../../components/guide/timeZones';
import type { Trip } from '../../../data/types';
import { EditorCard, FormField } from './editorParts';
import { inputClass, isDate, useSaving } from './editorUtils';

// The trip's title, dates, time zone and colors (stored on the trip, not in the guide)
export interface TripDetails {
  title: string;
  dates: [string, string] | null;
  timeZone: string | null; // null: from the location's state
  theme: Trip['theme'];
}

const ZONES: [string, string][] = [
  ['America/New_York', 'Eastern'],
  ['America/Chicago', 'Central'],
  ['America/Denver', 'Mountain'],
  ['America/Phoenix', 'Arizona'],
  ['America/Los_Angeles', 'Pacific'],
  ['America/Anchorage', 'Alaska'],
  ['Pacific/Honolulu', 'Hawaii'],
];
const zoneName = (zone: string | null) => ZONES.find(([z]) => z === zone)?.[1] ?? zone ?? 'unknown';

export default function DetailsEditor({ trip, onSave, onCancel }: { trip: Trip; onSave: (details: TripDetails) => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState(trip.title);
  const [first, setFirst] = useState(trip.dates?.[0] ?? '');
  const [last, setLast] = useState(trip.dates?.[1] ?? '');
  const [zone, setZone] = useState(trip.timeZone ?? '');
  const [primary, setPrimary] = useState(trip.theme.primary);
  const [onPrimary, setOnPrimary] = useState(trip.theme.onPrimary);
  const { saving, error, run } = useSaving();

  const fromLocation = tripTimeZone({ location: trip.location });
  const zones = zone && !ZONES.some(([z]) => z === zone) ? [...ZONES, [zone, zone] as [string, string]] : ZONES;
  const datesError =
    (first || last) && !(isDate(first) && isDate(last)) ? 'Both days, or neither.' : first && last && first > last ? 'The last day is before the first.' : null;
  const canSave = !!title.trim() && !datesError;

  const save = () =>
    run(() =>
      onSave({
        title: title.trim(),
        dates: first && last ? [first, last] : null,
        timeZone: zone || null,
        theme: { primary, onPrimary },
      }),
    );

  return (
    <EditorCard title="Trip details" error={error} canSave={canSave} saving={saving} onSave={save} onCancel={onCancel}>
      <FormField label="Title" hint={`Shown on the guide over ${trip.location}. The location, month and attendees are on the Trips tab.`}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="2027 UGL Invitational" className={inputClass} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="First day" error={datesError} hint="The guide's header and the trip's history show these">
          <input type="date" value={first} onChange={(e) => setFirst(e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Last day">
          <input type="date" value={last} onChange={(e) => setLast(e.target.value)} className={inputClass} />
        </FormField>
      </div>
      <FormField label="Time zone" hint="Tee times and kickoff read in this zone. Flight times stay local to each airport.">
        <select value={zone} onChange={(e) => setZone(e.target.value)} className={inputClass}>
          <option value="">From the location ({fromLocation ? zoneName(fromLocation) : 'none found'})</option>
          {zones.map(([z, name]) => (
            <option key={z} value={z}>
              {name}
            </option>
          ))}
        </select>
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Color">
          <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-10 w-full rounded-xl border border-gray-200 bg-white p-1 cursor-pointer" />
        </FormField>
        <FormField label="Text on it">
          <select value={onPrimary.toLowerCase() === '#ffffff' ? '#ffffff' : '#111827'} onChange={(e) => setOnPrimary(e.target.value)} className={inputClass}>
            <option value="#ffffff">White</option>
            <option value="#111827">Black</option>
          </select>
        </FormField>
      </div>
      <div className="rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: primary, color: onPrimary }}>
        {title.trim() || 'Title'}
      </div>
    </EditorCard>
  );
}
