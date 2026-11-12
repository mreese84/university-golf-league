import { useState } from 'react';
import { normalizeUrl } from '../../../components/guide/links';
import { holesText, lockedNote, newRoundId, parseHoles, type EditedRound } from '../../../data/guideEdit';
import type { GuideContent } from '../../../data/types';
import type { MatchType } from '../../../types';
import { AddButton, ClockInput, EditorCard, FormField, ItemBox } from './editorParts';
import { inputClass, isDate, useSaving } from './editorUtils';

interface Row extends Omit<EditedRound, 'par' | 'strokeIndex' | 'fee' | 'website' | 'address'> {
  fee: string;
  website: string;
  address: string;
  par: string;
  strokeIndex: string;
}

const MATCH_TYPES: [MatchType, string][] = [
  ['fourball', 'Fourball: two against two in each group'],
  ['singles', 'Singles: two matches in each group'],
  ['casual', 'Casual: no matches'],
];

// The day after the last round (YYYY-MM-DD), for a new one
function nextDay(rows: Row[], fallback: string | undefined) {
  const last = rows.map((r) => r.date).filter(isDate).sort().at(-1);
  if (!last) return fallback ?? '';
  const d = new Date(`${last}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Ten minutes after the last tee time, for a new one
function nextTeeTime(times: string[]) {
  const m = times.at(-1)?.match(/^(\d{1,2}):(\d{2})\s*([AP])M$/i);
  if (!m) return '10:00 AM';
  const minutes = ((Number(m[1]) % 12) + (m[3].toUpperCase() === 'P' ? 12 : 0)) * 60 + Number(m[2]) + 10;
  const h = Math.floor(minutes / 60) % 24;
  return `${h % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// The rounds of golf: course, day, match type, tee times, and the course's par and stroke index.
// usedIds: every round ID this trip has had (Fireball counts included), so a new round never takes
// an old one's.
export default function RoundsEditor({
  content,
  locked,
  usedIds,
  firstDay,
  onSave,
  onCancel,
}: {
  content: GuideContent;
  locked: boolean;
  usedIds: string[];
  firstDay?: string;
  onSave: (rounds: EditedRound[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(
    content.rounds.map(({ groups, par, strokeIndex, fee, website, address, ...r }) => ({
      ...r,
      fee: fee ?? '',
      website: website ?? '',
      address: address ?? '',
      par: holesText(par),
      strokeIndex: holesText(strokeIndex),
      teeTimes: groups.map((g, i) => ({ time: g.teeTime, from: i })),
    })),
  );
  const { saving, error, run } = useSaving();

  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const sessionsOn = (id: string) => content.format.sessions.filter((s) => s.round === id);
  const holes = rows.map((r) => ({ par: parseHoles(r.par, 'par'), strokeIndex: parseHoles(r.strokeIndex, 'strokeIndex') }));
  const canSave = rows.every(
    (r, i) => isDate(r.date) && r.course.trim() && r.teeTimes.every((t) => t.time) && !holes[i].par.error && !holes[i].strokeIndex.error,
  );

  const add = () =>
    setRows((rs) => [
      ...rs,
      {
        id: newRoundId([...usedIds, ...content.rounds.map((r) => r.id), ...rs.map((r) => r.id)]),
        date: nextDay(rs, firstDay),
        course: '',
        label: '',
        matchType: 'casual',
        fee: '',
        website: '',
        address: '',
        par: '',
        strokeIndex: '',
        teeTimes: [],
      },
    ]);

  const save = () =>
    run(() =>
      onSave(
        rows.map((r, i) => ({
          id: r.id,
          date: r.date,
          matchType: r.matchType,
          teeTimes: r.teeTimes,
          course: r.course.trim(),
          label: r.label.trim(),
          fee: r.fee.trim() || null,
          website: normalizeUrl(r.website),
          address: r.address.trim() || null,
          ...(holes[i].par.holes ? { par: holes[i].par.holes! } : {}),
          ...(holes[i].strokeIndex.holes ? { strokeIndex: holes[i].strokeIndex.holes! } : {}),
        })),
      ),
    );

  return (
    <EditorCard title="Rounds and tee times" note={locked ? lockedNote : undefined} error={error} canSave={canSave} saving={saving} onSave={save} onCancel={onCancel}>
      {rows.map((r, i) => {
        const sessions = sessionsOn(r.id);
        return (
          <ItemBox
            key={r.id}
            title={r.course || 'New round'}
            onRemove={
              locked
                ? undefined
                : () => {
                    const what = sessions.length ? ` Its ${sessions.length === 1 ? 'session' : `${sessions.length} sessions`} (${sessions.map((s) => s.name).join(', ')}) go too.` : '';
                    if (confirm(`Remove ${r.course || 'this round'}?${what}`)) setRows((rs) => rs.filter((_, j) => j !== i));
                  }
            }
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Day">
                <input type="date" value={r.date} onChange={(e) => set(i, { date: e.target.value })} disabled={locked} className={inputClass} />
              </FormField>
              <FormField label="Fee per player" hint="With cart, estimated">
                <input value={r.fee} onChange={(e) => set(i, { fee: e.target.value })} placeholder="$60" className={inputClass} />
              </FormField>
            </div>
            <FormField label="Course">
              <input value={r.course} onChange={(e) => set(i, { course: e.target.value })} placeholder="Columbia Country Club" className={inputClass} />
            </FormField>
            <FormField label="Label" hint="The tag on the round's card">
              <input value={r.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="Day 1 · 2-Man Net Best Ball" className={inputClass} />
            </FormField>
            <FormField label="Matches" hint={sessions.length > 0 ? `Played for: ${sessions.map((s) => s.name).join(', ')}` : undefined}>
              <select value={r.matchType} onChange={(e) => set(i, { matchType: e.target.value as MatchType })} disabled={locked} className={inputClass}>
                {MATCH_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Tee times</p>
              <div className="space-y-2">
                {r.teeTimes.map((t, k) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="w-6 text-xs text-gray-400 tabular-nums">{k + 1}</span>
                    <ClockInput
                      value={t.time}
                      label={`Tee time ${k + 1}`}
                      onChange={(time) => set(i, { teeTimes: r.teeTimes.map((x, j) => (j === k ? { ...x, time } : x)) })}
                    />
                    {!locked && (
                      <button
                        onClick={() => set(i, { teeTimes: r.teeTimes.filter((_, j) => j !== k) })}
                        aria-label={`Remove tee time ${k + 1}`}
                        className="px-2 text-gray-400 hover:text-red-500 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {!locked && (
                  <button
                    onClick={() => set(i, { teeTimes: [...r.teeTimes, { time: nextTeeTime(r.teeTimes.map((x) => x.time)), from: null }] })}
                    className="text-xs font-medium text-(--guide) hover:underline cursor-pointer"
                  >
                    + Add a tee time
                  </button>
                )}
              </div>
            </div>
            <details className="group">
              <summary className="text-xs font-medium text-gray-500 cursor-pointer select-none">
                Website, address, par and stroke index
              </summary>
              <div className="space-y-3 pt-3">
                <FormField label="Website">
                  <input value={r.website} onChange={(e) => set(i, { website: e.target.value })} inputMode="url" autoCapitalize="none" className={inputClass} />
                </FormField>
                <FormField label="Address" hint="For directions; without one, they search the course name">
                  <input value={r.address} onChange={(e) => set(i, { address: e.target.value })} className={inputClass} />
                </FormField>
                {/* Par stays open on a trip with results, to fix a scorecard that had it wrong: matches
                    compare players' net scores with each other, never with par, so no result changes.
                    Stroke index decides who got strokes where, so it's locked with the rest. */}
                <FormField
                  label="Par"
                  hint={
                    locked
                      ? 'Fix a wrong par here: it changes birdies, badges and scores against par, never who won a hole.'
                      : '18 holes, separated by spaces: 4 4 3 5 …'
                  }
                  error={holes[i].par.error}
                >
                  <input value={r.par} onChange={(e) => set(i, { par: e.target.value })} inputMode="numeric" className={inputClass} />
                </FormField>
                <FormField label="Stroke index" hint="18 holes: which gets the first stroke (1) to the last (18)" error={holes[i].strokeIndex.error}>
                  <input value={r.strokeIndex} onChange={(e) => set(i, { strokeIndex: e.target.value })} disabled={locked} inputMode="numeric" className={inputClass} />
                </FormField>
              </div>
            </details>
          </ItemBox>
        );
      })}
      {!locked && <AddButton onClick={add}>+ Add a round</AddButton>}
    </EditorCard>
  );
}
