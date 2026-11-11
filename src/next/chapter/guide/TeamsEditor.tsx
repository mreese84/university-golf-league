import { useId, useState } from 'react';
import type { GuideContent } from '../../../data/types';
import { lockedNote, teamIdFor } from '../../../data/guideEdit';
import { drawLogo, loadImage, uploadImage } from '../../../data/uploads';
import { dataEnv } from '../../../dataEnv';
import { storage } from '../../../firebase';
import type { Emblem, GuideTeam } from '../../../types';
import { useSession } from '../../sessionContext';
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
  logo: string | null; // an uploaded logo's address
}

const COLORS = ['#73000a', '#1e3a8a', '#15803d', '#b45309', '#6b21a8', '#0f766e'];

// A team's logo: uploaded as soon as it's picked (fitted into a 512-pixel square, background kept
// clear), and kept on the team when the teams are saved. Shown in place of the emblem.
function LogoField({ row, onChange, onBusy }: { row: Row; onChange: (logo: string | null) => void; onBusy: (busy: boolean) => void }) {
  const { user } = useSession();
  const id = useId();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (file: File | undefined) => {
    if (!file || !user) return;
    setUploading(true);
    onBusy(true);
    setError(null);
    try {
      const img = await loadImage(file);
      const url = await uploadImage(storage, dataEnv, user.uid, 'logo', row.id ?? row.name, await drawLogo(img));
      URL.revokeObjectURL(img.src);
      onChange(url);
    } catch (err) {
      console.error(err);
      setError("The logo didn't upload. Check your connection, and that it's an image, and try again.");
    } finally {
      setUploading(false);
      onBusy(false);
    }
  };
  return (
    <div role="group" aria-labelledby={`${id}-label`} className="min-w-0">
      <p id={`${id}-label`} className="block text-xs font-medium text-gray-500 mb-1">
        Logo
      </p>
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center" style={{ background: row.color }}>
          {row.logo ? (
            <span className="w-9 h-9 flex items-center justify-center rounded-full bg-white p-1">
              <img src={row.logo} alt={`${row.name || 'Team'} logo`} className="w-full h-full object-contain" />
            </span>
          ) : (
            <span className="text-white/70 text-xs">None</span>
          )}
        </span>
        <label className="text-sm font-medium text-green-700 hover:underline cursor-pointer focus-within:underline">
          {uploading ? 'Uploading…' : row.logo ? 'Change logo' : 'Upload a logo'}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        {row.logo && !uploading && (
          <button type="button" onClick={() => onChange(null)} className="text-sm font-medium text-gray-500 hover:text-red-600 cursor-pointer">
            Remove
          </button>
        )}
      </div>
      <p className={`text-xs mt-1 ${error ? 'text-red-600' : 'text-gray-400'}`}>
        {error ?? 'Optional. Shown in place of the emblem: a square image with a clear background looks best.'}
      </p>
    </div>
  );
}

// Teams and their houses: name, color, emblem or logo, house name and address. Players go on teams in
// the pairings panel.
export default function TeamsEditor({ content, locked, onSave, onCancel }: { content: GuideContent; locked: boolean; onSave: (teams: EditedTeam[]) => Promise<void>; onCancel: () => void }) {
  const [rows, setRows] = useState<Row[]>(content.teams.map((t) => ({ id: t.id, name: t.name, house: t.house, address: t.address, color: t.color, emblem: t.emblem ?? '', logo: t.logo ?? null })));
  const { saving, error, run } = useSaving();
  const [uploads, setUploads] = useState(0); // logos still uploading

  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const names = rows.map((r) => r.name.trim().toLowerCase());
  const nameError = (i: number) => (!names[i] ? 'Give the team a name.' : names.indexOf(names[i]) !== i ? 'Another team has that name.' : null);
  const canSave = rows.every((_, i) => !nameError(i)) && uploads === 0;

  const save = () =>
    run(() => {
      const taken = content.teams.map((t) => t.id);
      return onSave(
        rows.map((r) => {
          const id = r.id ?? teamIdFor(r.name, taken);
          taken.push(id);
          return { id, name: r.name.trim(), house: r.house.trim(), address: r.address.trim(), color: r.color, ...(r.emblem ? { emblem: r.emblem } : {}), ...(r.logo ? { logo: r.logo } : {}) };
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
          <LogoField row={r} onChange={(logo) => set(i, { logo })} onBusy={(busy) => setUploads((n) => n + (busy ? 1 : -1))} />
          <FormField label="House name">
            <input value={r.house} onChange={(e) => set(i, { house: e.target.value })} placeholder="The Palmetto House" className={inputClass} />
          </FormField>
          <FormField label="House address">
            <textarea value={r.address} onChange={(e) => set(i, { address: e.target.value })} rows={2} className={inputClass} />
          </FormField>
        </ItemBox>
      ))}
      {!locked && (
        <AddButton onClick={() => setRows((rs) => [...rs, { id: null, name: '', house: '', address: '', color: COLORS[rs.length % COLORS.length], emblem: '', logo: null }])}>
          + Add a team
        </AddButton>
      )}
    </EditorCard>
  );
}
