import { useState } from 'react';
import { fmt } from '../../../components/guide/dates';
import { lockedNote, matchesFor, uniqueId } from '../../../data/guideEdit';
import type { GuideContent, TripFormat, TripSession } from '../../../data/types';
import type { Scoring } from '../../../history/types';
import { AddButton, EditorCard, FormField, ItemBox } from './editorParts';
import { inputClass, linesOf, useSaving } from './editorUtils';

export type EditedFormat = Omit<TripFormat, 'sessions'> & { sessions: Omit<TripSession, 'matches'>[] };

interface Row {
  id: string | null; // null until saved
  format: string | null; // groups records across years; a new session's is its ID
  name: string;
  round: string;
  scoring: Scoring;
  strokes: 'full' | 'difference';
  basis: 'net' | 'gross';
  points: string; // per match
  rules: string; // one per line
}

const toRow = (s: TripSession): Row => ({
  id: s.id,
  format: s.format,
  name: s.name,
  round: s.round,
  scoring: s.scoring,
  strokes: s.strokes ?? 'full',
  basis: s.basis ?? 'net',
  points: String(s.points),
  rules: s.rules.join('\n'),
});

const pts = (n: number) => `${n} ${n === 1 ? 'point' : 'points'}`;

// The format (name, summary, notes) and what's played for points: each session's round, how it's
// scored, its points and its rules
export default function FormatEditor({ content, locked, onSave, onCancel }: { content: GuideContent; locked: boolean; onSave: (format: EditedFormat) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(content.format.name);
  const [summary, setSummary] = useState(content.format.summary);
  const [notes, setNotes] = useState(content.format.notes.join('\n'));
  const [rows, setRows] = useState<Row[]>(content.format.sessions.map(toRow));
  const { saving, error, run } = useSaving();

  const rounds = content.rounds.filter((r) => r.matchType !== 'casual');
  const roundName = (id: string) => {
    const r = content.rounds.find((x) => x.id === id);
    return r ? `${fmt(r.date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${r.course}` : 'No round';
  };
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const before = new Map(content.format.sessions.map((s) => [s.id, s]));
  const matchesOf = (r: Row) => (locked && r.id ? (before.get(r.id)?.matches ?? 0) : matchesFor(r, content.rounds));
  const pointsOf = (r: Row) => Number(r.points);
  const rowError = (r: Row) =>
    !r.name.trim() ? 'Give the session a name.' : !content.rounds.some((x) => x.id === r.round) ? 'Pick its round.' : !(pointsOf(r) > 0) ? 'Points per match must be more than 0.' : null;
  const total = rows.reduce((sum, r) => sum + (pointsOf(r) > 0 ? pointsOf(r) * matchesOf(r) : 0), 0);
  const canSave = !!name.trim() && rows.every((r) => !rowError(r));

  const save = () =>
    run(() => {
      const taken = content.format.sessions.map((s) => s.id);
      return onSave({
        name: name.trim(),
        summary: summary.trim(),
        notes: linesOf(notes),
        sessions: rows.map((r) => {
          const id = r.id ?? uniqueId(r.name, taken, 'session');
          taken.push(id);
          return {
            id,
            round: r.round,
            name: r.name.trim(),
            format: r.format ?? id,
            scoring: r.scoring,
            points: pointsOf(r),
            ...(r.scoring === 'match' && r.strokes === 'difference' ? { strokes: 'difference' as const } : {}),
            ...(r.scoring === 'aggregate' && r.basis === 'gross' ? { basis: 'gross' as const } : {}),
            rules: linesOf(r.rules),
          };
        }),
      });
    });

  return (
    <EditorCard title="Format and points" note={locked ? lockedNote : undefined} error={error} canSave={canSave} saving={saving} onSave={save} onCancel={onCancel}>
      <FormField label="Format">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Modified Ryder Cup" className={inputClass} />
      </FormField>
      <FormField label="Summary">
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} className={inputClass} />
      </FormField>
      <FormField label="Notes" hint="One per line">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
      </FormField>

      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 pt-2">Sessions</p>
      {rounds.length === 0 && rows.length === 0 && <p className="text-sm text-gray-500">Add a round with matches first (fourball or singles), then its sessions here.</p>}
      {rows.map((r, i) => {
        const matches = matchesOf(r);
        const err = rowError(r);
        return (
          <ItemBox key={r.id ?? `new-${i}`} title={r.name || 'New session'} onRemove={locked ? undefined : () => setRows((rs) => rs.filter((_, j) => j !== i))}>
            <FormField label="Name">
              <input value={r.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="2-Man Net Best Ball" className={inputClass} />
            </FormField>
            <FormField label="Round">
              <select value={r.round} onChange={(e) => set(i, { round: e.target.value })} disabled={locked} className={inputClass}>
                {!content.rounds.some((x) => x.id === r.round) && <option value="">Pick a round</option>}
                {content.rounds.map((x) => (
                  <option key={x.id} value={x.id}>
                    {roundName(x.id)}
                  </option>
                ))}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Scored as">
                <select value={r.scoring} onChange={(e) => set(i, { scoring: e.target.value as Scoring })} disabled={locked} className={inputClass}>
                  <option value="match">Match play</option>
                  <option value="aggregate">Team total</option>
                </select>
              </FormField>
              {r.scoring === 'match' ? (
                <FormField label="Strokes">
                  <select value={r.strokes} onChange={(e) => set(i, { strokes: e.target.value as Row['strokes'] })} disabled={locked} className={inputClass}>
                    <option value="full">Full handicaps</option>
                    <option value="difference">Off the low player</option>
                  </select>
                </FormField>
              ) : (
                <FormField label="Scores">
                  <select value={r.basis} onChange={(e) => set(i, { basis: e.target.value as Row['basis'] })} disabled={locked} className={inputClass}>
                    <option value="net">Net</option>
                    <option value="gross">Gross</option>
                  </select>
                </FormField>
              )}
            </div>
            <FormField
              label="Points per match"
              hint={
                r.scoring === 'aggregate'
                  ? `One team total: ${pts(pointsOf(r) || 0)}`
                  : `${matches} ${matches === 1 ? 'match' : 'matches'} from the round's tee times: ${pts((pointsOf(r) || 0) * matches)}`
              }
            >
              <input type="number" min="0" step="0.5" value={r.points} onChange={(e) => set(i, { points: e.target.value })} disabled={locked} className={inputClass} />
            </FormField>
            <FormField label="Rules" hint="One per line">
              <textarea value={r.rules} onChange={(e) => set(i, { rules: e.target.value })} rows={3} className={inputClass} />
            </FormField>
            {err && r.name && <p className="text-xs text-red-600">{err}</p>}
          </ItemBox>
        );
      })}
      {!locked && (rounds.length > 0 || content.rounds.length > 0) && (
        <AddButton
          onClick={() =>
            setRows((rs) => [
              ...rs,
              { id: null, format: null, name: '', round: (rounds[0] ?? content.rounds[0]).id, scoring: 'match', strokes: 'full', basis: 'net', points: '1', rules: '' },
            ])
          }
        >
          + Add a session
        </AddButton>
      )}
      {rows.length > 0 && (
        <p className="text-sm text-gray-600">
          {pts(total)} in all; {total / 2 + 0.5} wins.
        </p>
      )}
    </EditorCard>
  );
}
