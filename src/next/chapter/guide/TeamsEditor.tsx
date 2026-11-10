import { useState } from 'react';
import type { GuideContent } from '../../../data/types';
import { lockedNote, teamIdFor } from '../../../data/guideEdit';
import type { Emblem, GuideTeam } from '../../../types';
import { AddButton, EditorCard, FormField, ItemBox } from './editorParts';
import { inputClass, useSaving } from './editorUtils';

export type EditedTeam = Omit<GuideTeam, 'memberIds' | 'captainId'>;

interface Row {
  id: string | null; // null until saved
  name: string;
  house: string;
  address: string;
  color: string;
  emblem: Emblem | '';
}

const COLORS = ['#73000a', '#1e3a8a', '#15803d', '#b45309', '#6b21a8', '#0f766e'];

// Teams and their houses: name, color, emblem, house name and address. Players go on teams in the
// pairings panel.
export default function TeamsEditor({ content, locked, onSave, onCancel }: { content: GuideContent; locked: boolean; onSave: (teams: EditedTeam[]) => Promise<void>; onCancel: () => void }) {
  const [rows, setRows] = useState<Row[]>(content.teams.map((t) => ({ id: t.id, name: t.name, house: t.house, address: t.address, color: t.color, emblem: t.emblem ?? '' })));
  const { saving, error, run } = useSaving();

  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const names = rows.map((r) => r.name.trim().toLowerCase());
  const nameError = (i: number) => (!names[i] ? 'Give the team a name.' : names.indexOf(names[i]) !== i ? 'Another team has that name.' : null);
  const canSave = rows.every((_, i) => !nameError(i));

  const save = () =>
    run(() => {
      const taken = content.teams.map((t) => t.id);
      return onSave(
        rows.map((r) => {
          const id = r.id ?? teamIdFor(r.name, taken);
          taken.push(id);
          return { id, name: r.name.trim(), house: r.house.trim(), address: r.address.trim(), color: r.color, ...(r.emblem ? { emblem: r.emblem } : {}) };
        }),
      );
    });

  return (
    <EditorCard title="Teams and houses" note={locked ? lockedNote : undefined} error={error} canSave={canSave} saving={saving} onSave={save} onCancel={onCancel}>
      {rows.map((r, i) => (
        <ItemBox
          key={i}
          title={
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ background: r.color }} />
              {r.name || 'New team'}
            </span>
          }
          onRemove={locked ? undefined : () => setRows((rs) => rs.filter((_, j) => j !== i))}
        >
          <FormField label="Team name" error={rows.length > 0 && r.name !== '' ? nameError(i) : null}>
            <input value={r.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Team Palmetto" className={inputClass} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Color">
              <input type="color" value={r.color} onChange={(e) => set(i, { color: e.target.value })} className="h-10 w-full rounded-xl border border-gray-200 bg-white p-1 cursor-pointer" />
            </FormField>
            <FormField label="Emblem">
              <select value={r.emblem} onChange={(e) => set(i, { emblem: e.target.value as Row['emblem'] })} className={inputClass}>
                <option value="">None</option>
                <option value="palmetto">Palmetto</option>
                <option value="crescent">Crescent</option>
              </select>
            </FormField>
          </div>
          <FormField label="House name">
            <input value={r.house} onChange={(e) => set(i, { house: e.target.value })} placeholder="The Palmetto House" className={inputClass} />
          </FormField>
          <FormField label="House address">
            <textarea value={r.address} onChange={(e) => set(i, { address: e.target.value })} rows={2} className={inputClass} />
          </FormField>
        </ItemBox>
      ))}
      {!locked && (
        <AddButton onClick={() => setRows((rs) => [...rs, { id: null, name: '', house: '', address: '', color: COLORS[rs.length % COLORS.length], emblem: '' }])}>
          + Add a team
        </AddButton>
      )}
    </EditorCard>
  );
}
