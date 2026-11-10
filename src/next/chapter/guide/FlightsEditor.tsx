import { useState } from 'react';
import type { GuideFlight } from '../../../types';
import { AddButton, ClockInput, EditorCard, FormField, ItemBox } from './editorParts';
import { inputClass, isDate, useSaving } from './editorUtils';

const LABEL = { departure: 'Departure', return: 'Return' } as const;
const airport = (code: string) => code.trim().toUpperCase() || null;

// The official flights: a departure and a return, each optional
export default function FlightsEditor({ flights, onSave, onCancel }: { flights: GuideFlight[]; onSave: (flights: GuideFlight[]) => Promise<void>; onCancel: () => void }) {
  const [rows, setRows] = useState<GuideFlight[]>(flights);
  const { saving, error, run } = useSaving();

  const set = (direction: GuideFlight['direction'], patch: Partial<GuideFlight>) =>
    setRows((rs) => rs.map((r) => (r.direction === direction ? { ...r, ...patch } : r)));
  const add = (direction: GuideFlight['direction']) =>
    setRows((rs) => [...rs, { direction, date: '', flight: '', from: null, to: null, departs: null, arrives: null }]);
  const canSave = rows.every((r) => isDate(r.date) && r.flight.trim());

  const save = () =>
    run(() =>
      onSave(
        (['departure', 'return'] as const).flatMap((d) => {
          const r = rows.find((x) => x.direction === d);
          return r ? [{ ...r, flight: r.flight.trim(), from: airport(r.from ?? ''), to: airport(r.to ?? ''), departs: r.departs || null, arrives: r.arrives || null }] : [];
        }),
      ),
    );

  return (
    <EditorCard title="Official UGL flights" error={error} canSave={canSave} saving={saving} onSave={save} onCancel={onCancel}>
      {rows.map((r) => (
        <ItemBox key={r.direction} title={LABEL[r.direction]} onRemove={() => setRows((rs) => rs.filter((x) => x.direction !== r.direction))}>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date">
              <input type="date" value={r.date} onChange={(e) => set(r.direction, { date: e.target.value })} className={inputClass} />
            </FormField>
            <FormField label="Flight">
              <input value={r.flight} onChange={(e) => set(r.direction, { flight: e.target.value })} placeholder="AA 1234" className={inputClass} />
            </FormField>
            <FormField label="From" hint="Airport code">
              <input value={r.from ?? ''} onChange={(e) => set(r.direction, { from: e.target.value })} placeholder="DFW" maxLength={4} autoCapitalize="characters" className={inputClass} />
            </FormField>
            <FormField label="To">
              <input value={r.to ?? ''} onChange={(e) => set(r.direction, { to: e.target.value })} placeholder="CAE" maxLength={4} autoCapitalize="characters" className={inputClass} />
            </FormField>
            <FormField label="Departs" hint="Local time">
              <ClockInput value={r.departs ?? ''} onChange={(t) => set(r.direction, { departs: t })} />
            </FormField>
            <FormField label="Arrives" hint="Local time">
              <ClockInput value={r.arrives ?? ''} onChange={(t) => set(r.direction, { arrives: t })} />
            </FormField>
          </div>
        </ItemBox>
      ))}
      {(['departure', 'return'] as const)
        .filter((d) => !rows.some((r) => r.direction === d))
        .map((d) => (
          <AddButton key={d} onClick={() => add(d)}>
            + Add the {d === 'departure' ? 'departure' : 'return'} flight
          </AddButton>
        ))}
    </EditorCard>
  );
}
