import { useState } from 'react';
import { importSquabbit, parseSquabbit, suggestedPairs, type SquabbitExport, type SquabbitImport as Imported } from '../../../data/results';
import type { TripRound, TripSession } from '../../../data/types';
import type { GuideTeam } from '../../../types';
import { buttonClass, inputClass } from '../../parts';

// A session's results from Squabbit: each group's scorecard export (CSV), read here and checked
// against Squabbit's own net scores, then saved in place of the session's results so far
export default function SquabbitImport({
  session,
  round,
  teams,
  people,
  handicaps,
  replacing,
  onSave,
  onCancel,
}: {
  session: TripSession;
  round: TripRound;
  teams: GuideTeam[];
  people: { id: string; name: string }[];
  handicaps: Record<string, number>;
  replacing: number; // the session's results so far
  onSave: (imported: Imported) => Promise<string[]>;
  onCancel: () => void;
}) {
  const [exports, setExports] = useState<SquabbitExport[]>([]);
  const [readErrors, setReadErrors] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [chosenPairs, setChosenPairs] = useState<Record<string, string>>({}); // a player -> who they played
  const [busy, setBusy] = useState(false);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const singles = round.matchType === 'singles' && session.scoring === 'match';
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? id;
  const teamOf = (id: string) => teams.find((t) => t.memberIds.includes(id));
  const byName = new Map(people.map((p) => [p.name.trim().toLowerCase(), p.id]));
  const idOf = (name: string) => names[name] ?? byName.get(name.trim().toLowerCase());

  const read = async (files: FileList | null) => {
    const list = [...(files ?? [])];
    const read: SquabbitExport[] = [];
    const errors: string[] = [];
    for (const f of list) {
      try {
        read.push(parseSquabbit(f.name, await f.text()));
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
    setExports(read);
    setReadErrors(errors);
    setSaveErrors([]);
  };

  // Names Squabbit spells differently from the chapter: pick who each one is
  const unknown = [...new Set(exports.flatMap((ex) => ex.players.map((p) => p.name)))].filter((name) => !byName.has(name.trim().toLowerCase()));

  // Singles: who played whom in each group, suggested from the guide's groups
  const groups = exports.map((ex) => ex.players.map((p) => idOf(p.name)).filter((id): id is string => !!id));
  const pairs: [string, string][] = singles
    ? groups.flatMap((ids) => {
        const suggested = new Map(suggestedPairs(round, ids).flatMap(([a, b]) => [[a, b], [b, a]]));
        const [first] = teams;
        return ids
          .filter((id) => teamOf(id)?.id === first?.id)
          .flatMap((id) => {
            const other = chosenPairs[id] ?? suggested.get(id);
            return other ? [[id, other] as [string, string]] : [];
          });
      })
    : [];

  const result = exports.length ? importSquabbit({ session, round, teams, people, names, handicaps, exports, pairs }) : null;

  const save = async () => {
    if (!result) return;
    setBusy(true);
    setSaveErrors([]);
    try {
      setSaveErrors(await onSave(result));
    } catch (err) {
      console.error(err);
      setSaveErrors(["That didn't save. Check your connection and try again."]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 p-4 space-y-3 bg-white">
      <p className="text-sm font-semibold text-gray-800">{session.name}: import from Squabbit</p>
      <label className="block text-xs text-gray-500">
        Each group's scorecard export (CSV), all from {round.course}
        <input type="file" accept=".csv,text/csv" multiple onChange={(e) => void read(e.target.files)} className="block mt-1 text-sm" />
      </label>
      {readErrors.map((e) => (
        <p key={e} className="text-xs text-red-600">
          {e}
        </p>
      ))}

      {unknown.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600">Who are these?</p>
          {unknown.map((name) => (
            <label key={name} className="flex items-center gap-2 text-sm">
              <span className="w-36 truncate">“{name}”</span>
              <select value={names[name] ?? ''} onChange={(e) => setNames({ ...names, [name]: e.target.value })} className={inputClass}>
                <option value="">Pick</option>
                {teams.flatMap((t) => t.memberIds).map((id) => (
                  <option key={id} value={id}>
                    {nameOf(id)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      {singles &&
        groups.map((ids, g) => {
          const [first, second] = teams;
          const ours = ids.filter((id) => teamOf(id)?.id === first?.id);
          const theirs = ids.filter((id) => teamOf(id)?.id === second?.id);
          if (!ours.length) return null;
          return (
            <div key={g} className="space-y-1">
              <p className="text-xs font-medium text-gray-600">{exports[g].file}: who played whom</p>
              {ours.map((id) => (
                <label key={id} className="flex items-center gap-2 text-sm">
                  <span className="w-36 truncate">{nameOf(id)} v</span>
                  <select
                    value={pairs.find(([a]) => a === id)?.[1] ?? ''}
                    onChange={(e) => setChosenPairs({ ...chosenPairs, [id]: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Pick</option>
                    {theirs.map((o) => (
                      <option key={o} value={o}>
                        {nameOf(o)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          );
        })}

      {result && result.problems.length > 0 && (
        <ul className="text-xs text-red-600 list-disc pl-4 space-y-0.5">
          {result.problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {result && result.problems.length === 0 && (
        <div className="space-y-1 text-sm">
          {result.matches.map((m) => (
            <p key={m.id} className="text-gray-700">
              <span className="text-gray-400 tabular-nums">{session.scoring === 'aggregate' ? '' : `${m.match}. `}</span>
              {teams.map((t) => (m.totals ? `${t.name} ${m.totals[t.id]}` : m.sides[t.id].map(nameOf).join(' & '))).join(' v ')}
              {' → '}
              <span className="font-semibold">{m.result.winner ? `${teams.find((t) => t.id === m.result.winner)?.name} ${m.result.margin}` : m.result.margin === 'AS' ? 'halved' : m.result.margin}</span>
            </p>
          ))}
          {result.course && <p className="text-xs text-gray-500">Adds {round.course}'s par and stroke index to the guide.</p>}
          {Object.keys(result.handicaps).length > 0 && (
            <p className="text-xs text-gray-500">Fills in handicaps from Squabbit for {Object.keys(result.handicaps).map(nameOf).join(', ')}.</p>
          )}
        </div>
      )}
      {saveErrors.length > 0 && (
        <ul className="text-xs text-red-600 list-disc pl-4 space-y-0.5">
          {saveErrors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-3">
        <button onClick={() => void save()} disabled={busy || !result || result.problems.length > 0 || result.matches.length === 0} className={buttonClass}>
          {busy ? 'Saving…' : `Save ${result?.matches.length ?? 0} ${result?.matches.length === 1 ? 'result' : 'results'}`}
        </button>
        <button onClick={onCancel} disabled={busy} className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer">
          Cancel
        </button>
      </div>
      {replacing > 0 && <p className="text-xs text-gray-400">Saving replaces this session's {replacing} result{replacing === 1 ? '' : 's'} so far.</p>}
    </div>
  );
}
