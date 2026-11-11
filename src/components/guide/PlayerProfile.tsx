import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { formatHandicap, formatPoints, formatRecord } from '../../history/format';
import type { WinLoss } from '../../history/stats';
import type { EarnedBadge } from '../../history/badges';
import { followLink } from '../../routes';
import type { GuideTeam } from '../../types';
import BadgeShelf from '../badges/BadgeShelf';
import { TeamEmblem } from './Emblem';
import { inputClass } from './parts';

export interface ProfileView {
  name: string;
  photo: string | null; // URL
  college: string | null; // set on the Members page
  team: GuideTeam | null;
  captain: boolean;
  handicap: number | null;
  record: WinLoss | null; // all-time match play; null before any results
  points: number;
  historyUrl: string | null; // the public record page
  fireball: number | null; // shots this trip; null when unavailable
  superlatives: { title: string; value: string; where: string }[];
  badges: { list: EarnedBadge[]; href: string }; // linking to the chapter's Badges page
  bio: string | null;
  bioLoading: boolean;
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-gray-900 tabular-nums leading-tight">{value}</p>
      <p className="text-[11px] uppercase tracking-wider text-gray-400 mt-0.5">{label}</p>
      {note && <p className="text-[11px] text-gray-400">{note}</p>}
    </div>
  );
}

function NoPhoto() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gray-100 text-gray-300">
      <svg viewBox="0 0 24 24" className="w-20 h-20" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" />
      </svg>
      <p className="text-xs font-medium text-gray-400">No photo yet</p>
    </div>
  );
}

function BioEditor({ initial, onSave, onCancel }: { initial: string; onSave: (bio: string) => Promise<void>; onCancel: () => void }) {
  const [bio, setBio] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(bio);
    } catch {
      setError('Save failed. Check your connection, and that the database rules are published.');
      setSaving(false);
    }
  };
  return (
    <div className="space-y-2">
      <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={5} className={inputClass} placeholder="A few lines about this player" />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 disabled:opacity-40 transition-colors cursor-pointer"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} disabled={saving} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium cursor-pointer">
          Cancel
        </button>
      </div>
    </div>
  );
}

interface ProfileSheetProps {
  profile: ProfileView;
  theme: { primary: string; onPrimary: string };
  onClose: () => void;
  onSaveBio?: (bio: string) => Promise<void>; // admin only
}

// The profile as a sheet that rises from the bottom on phones and sits centered on wider screens
export function ProfileSheet({ profile: p, theme, onClose, onSaveBio }: ProfileSheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState(false);
  const [fullPhoto, setFullPhoto] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const recordText = p.record ? formatRecord(p.record) : '–';
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current.close()} // a tap on the backdrop
      aria-label={`${p.name}'s profile`}
      className="p-0 m-0 mt-auto w-full max-w-none max-h-[92dvh] rounded-t-2xl bg-white shadow-xl backdrop:bg-black/45
                 sm:m-auto sm:max-w-md sm:rounded-2xl"
      style={{ '--guide': theme.primary, '--guide-on': theme.onPrimary } as CSSProperties}
    >
      <div className="max-h-[92dvh] overflow-y-auto">
        {/* Photo: cropped to the face so the profile fits on screen; a tap grows it to the whole
            portrait (the sheet is the screen's width on phones, 28rem wider up; photos are 3:4) */}
        <div
          className="relative h-72 sm:h-80 bg-gray-100 overflow-hidden transition-[height] duration-300 ease-in-out
                     motion-reduce:transition-none"
          style={p.photo && fullPhoto ? { height: 'calc(min(100vw, 28rem) * 4 / 3)' } : undefined}
        >
          {p.photo ? (
            <button
              type="button"
              onClick={() => setFullPhoto(!fullPhoto)}
              aria-expanded={fullPhoto}
              aria-label={fullPhoto ? 'Show less of the photo' : 'Show the whole photo'}
              className="block w-full h-full cursor-zoom-in aria-expanded:cursor-zoom-out"
            >
              <img src={p.photo} alt={p.name} className="w-full h-full object-cover object-[50%_25%]" />
              <span
                className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white/90 shadow flex items-center justify-center text-gray-700"
                aria-hidden="true"
              >
                <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  {fullPhoto ? (
                    <path d="M8 3v5H3M12 17v-5h5M8 8L3 3M12 12l5 5" />
                  ) : (
                    <path d="M3 8V3h5M17 12v5h-5M3 3l5 5M17 17l-5-5" />
                  )}
                </svg>
              </span>
            </button>
          ) : (
            <NoPhoto />
          )}
          <button
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center text-gray-700 hover:bg-white cursor-pointer"
          >
            <svg viewBox="0 0 20 20" className="w-4 h-4" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Who */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{p.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-sm text-gray-600">
              {p.team && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                  style={{ background: p.team.color }}
                >
                  <TeamEmblem team={p.team} className="w-3.5 h-3.5" />
                  {p.team.name}
                  {p.captain && ' · Captain'}
                </span>
              )}
              {p.college && <span>{p.college}</span>}
            </div>
            {p.badges.list.length > 0 && (
              <div className="mt-3">
                <BadgeShelf badges={p.badges.list} href={p.badges.href} />
              </div>
            )}
          </div>

          {/* Numbers */}
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-gray-50 py-3">
            <Stat label="Handicap" value={p.handicap !== null ? formatHandicap(p.handicap) : '–'} />
            <Stat
              label="UGL record"
              value={recordText}
              note={p.record ? `${formatPoints(p.points)} ${p.points === 1 ? 'pt' : 'pts'}` : 'No results yet'}
            />
            <Stat label="Fireball" value={p.fireball !== null ? String(p.fireball) : '–'} note="this trip" />
          </div>

          {/* Superlatives */}
          {p.superlatives.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Superlatives</h3>
              <ul className="mt-2 space-y-1.5">
                {p.superlatives.map((s, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-gray-800">
                      {s.title}
                      {s.where && <span className="text-gray-400"> · {s.where}</span>}
                    </span>
                    <span className="font-semibold text-gray-900 shrink-0">{s.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Bio */}
          <div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Bio</h3>
              {onSaveBio && !editing && (
                <button onClick={() => setEditing(true)} className="text-xs font-medium text-(--guide) hover:underline cursor-pointer">
                  {p.bio ? 'Edit' : 'Add a bio'}
                </button>
              )}
            </div>
            <div className="mt-2">
              {editing && onSaveBio ? (
                <BioEditor
                  initial={p.bio ?? ''}
                  onCancel={() => setEditing(false)}
                  onSave={async (bio) => {
                    await onSaveBio(bio);
                    setEditing(false);
                  }}
                />
              ) : p.bioLoading ? (
                <p className="text-sm text-gray-400">Loading…</p>
              ) : p.bio ? (
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{p.bio}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">No bio yet.</p>
              )}
            </div>
          </div>

          {p.historyUrl && (
            <a
              href={p.historyUrl}
              onClick={(e) => followLink(e, p.historyUrl!)}
              className="block text-sm font-medium text-(--guide) hover:underline"
            >
              Full UGL record →
            </a>
          )}
        </div>
      </div>
    </dialog>
  );
}
