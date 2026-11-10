import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../authContext';
import { pathsFor } from '../data/paths';
import type { JoinedStatus } from '../data/types';
import { dataEnv } from '../dataEnv';
import { db } from '../firebase';
import { history } from '../history/data';
import { formatPoints } from '../history/format';
import { standings } from '../history/stats';
import { loadOldData, type LoadedOldData } from '../moveOver/load';
import {
  buildFoundersChapter,
  FOUNDERS,
  FOUNDERS_NAME,
  historyOfMove,
  needsFullName,
  problemsWith,
  renamePerson,
  suggestPeople,
  type PersonChoice,
} from '../moveOver/transform';
import { clearFounders, writeMove } from '../moveOver/write';
import GoogleSignInButton from './GoogleSignInButton';

// Phase 1, step 4: copies today's data into The Founder's Chapter in the new layout. It only reads
// today's data. On the dev server and preview links it writes the dev copy; on the live site, the
// live copy, which is for the switch (step 9).

type Phase =
  | { kind: 'idle' }
  | { kind: 'clearing'; done: number; total: number }
  | { kind: 'writing'; done: number; total: number }
  | { kind: 'done'; count: number }
  | { kind: 'failed'; message: string };

const inputClass =
  'w-full min-w-0 px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm text-gray-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500';

const buttonClass =
  'px-4 py-2 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer';

function Section({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-800">
        <span className="text-green-700">{step}.</span> {title}
      </h3>
      {children}
    </section>
  );
}

function downloadJson(data: unknown, name: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUSES: { value: JoinedStatus; label: string }[] = [
  { value: 'active', label: 'Active member' },
  { value: 'alumni', label: 'Alumni' },
  { value: 'guest', label: 'Guest' },
];

function PersonRow({ row, onName, onStatus, onOrganizer }: {
  row: PersonChoice;
  onName: (name: string) => void;
  onStatus: (status: JoinedStatus) => void;
  onOrganizer: (organizer: boolean) => void;
}) {
  return (
    <li className="py-3 space-y-2">
      <div className="flex items-baseline justify-between gap-3 text-xs text-gray-400">
        <span>{row.memberName ? `Members list: ${row.memberName}` : 'In the history only'}</span>
        <span className="font-mono truncate">{row.personId}</span>
      </div>
      <input value={row.name} onChange={(e) => onName(e.target.value)} aria-label="Full name" className={inputClass} />
      {needsFullName(row) && (
        <p className="text-xs text-amber-700">Not in the history yet: enter their full name. It becomes their permanent ID.</p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <select value={row.status} onChange={(e) => onStatus(e.target.value as JoinedStatus)} aria-label="Status" className={`${inputClass} w-auto`}>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={row.role === 'organizer'} onChange={(e) => onOrganizer(e.target.checked)} className="accent-green-600" />
          Organizer
        </label>
        {row.email && <span className="text-xs text-gray-500 truncate">{row.email}</span>}
      </div>
    </li>
  );
}

export default function MoveOverPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [loaded, setLoaded] = useState<LoadedOldData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rows, setRows] = useState<PersonChoice[] | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [liveConfirmed, setLiveConfirmed] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    loadOldData(db).then(
      (data) => {
        if (cancelled) return;
        setLoaded(data);
        setRows(suggestPeople(data.old, history));
      },
      (err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const result = useMemo(() => (loaded && rows ? buildFoundersChapter(loaded.old, history, rows, dataEnv) : null), [loaded, rows]);
  const check = useMemo(
    () => (result ? historyOfMove(result.docs, dataEnv).events.map((event) => ({ event, s: standings(event) })) : []),
    [result],
  );
  const problems = rows ? problemsWith(rows) : [];
  const busy = phase.kind === 'clearing' || phase.kind === 'writing';
  const copyName = dataEnv === 'dev' ? 'dev data' : 'live data';

  if (authLoading) return <p className="text-gray-400 text-center py-8">Loading…</p>;
  if (!user || !isAdmin) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-3">
        <p className="text-lg font-semibold text-gray-800">Commissioner only</p>
        <p className="text-sm text-gray-500">The move-over reads all of today's data, so only the commissioner can run it.</p>
        {!user && <GoogleSignInButton size="large" text="signin_with" shape="pill" theme="outline" />}
      </div>
    );
  }

  const update = (i: number, change: Partial<PersonChoice>) => setRows((r) => r && r.map((row, j) => (j === i ? { ...row, ...change } : row)));

  const write = async () => {
    if (!result) return;
    try {
      const existing = await getDoc(doc(db, pathsFor(dataEnv).chapter(FOUNDERS)));
      if (existing.exists() && !confirm(`Replace ${FOUNDERS_NAME} in the ${copyName} with a fresh copy?`)) return;
      // Clearing first also tidies up after a run that stopped partway
      setPhase({ kind: 'clearing', done: 0, total: 0 });
      await clearFounders(db, dataEnv, (done, total) => setPhase({ kind: 'clearing', done, total }));
      setPhase({ kind: 'writing', done: 0, total: result.docs.length });
      await writeMove(db, result.docs, (done, total) => setPhase({ kind: 'writing', done, total }));
      setPhase({ kind: 'done', count: result.docs.length });
    } catch (err) {
      setPhase({ kind: 'failed', message: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Move into {FOUNDERS_NAME}</h2>
        <p className="text-sm text-gray-500 mt-1">
          Copies today's members, trips, guides, pairings, Fireball counts, bios and history into the new layout,
          in the <span className="font-medium text-gray-700">{copyName}</span>. It only reads today's data, and you can run it
          again: each run replaces the chapter with a fresh copy.
        </p>
      </div>

      {loadError && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">Couldn't read today's data: {loadError}</p>}
      {!loaded && !loadError && <p className="text-gray-400 text-center py-8">Reading today's data…</p>}

      {loaded && rows && result && (
        <>
          <Section step={1} title="Download a backup">
            <p className="text-sm text-gray-500">Everything the move reads, as it is now ({Object.keys(loaded.backup).length} documents).</p>
            <button onClick={() => downloadJson(loaded.backup, `ugl-backup-${new Date().toISOString().slice(0, 10)}.json`)} className={buttonClass}>
              Download backup
            </button>
          </Section>

          <Section step={2} title="Check everyone">
            <p className="text-sm text-gray-500">
              Each person on today's members list, matched to the history where there's a match, plus anyone in the history who
              isn't on the list. Fix names, statuses and organizers here; the IDs on the right are permanent.
            </p>
            <ul className="divide-y divide-gray-100">
              {rows.map((row, i) => (
                <PersonRow
                  key={row.memberId ?? row.historyId ?? i}
                  row={row}
                  onName={(name) => setRows((r) => r && renamePerson(r, i, name))}
                  onStatus={(status) => update(i, { status })}
                  onOrganizer={(organizer) => update(i, { role: organizer ? 'organizer' : 'member' })}
                />
              ))}
            </ul>
          </Section>

          <Section step={3} title="Check the result">
            <ul className="text-sm text-gray-700 grid grid-cols-2 gap-x-4 gap-y-1">
              {Object.entries(result.counts).map(([kind, n]) => (
                <li key={kind} className="flex justify-between gap-2">
                  <span className="text-gray-500">{kind}</span>
                  <span className="tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
            {check.map(({ event, s }) => (
              <p key={event.id} className="text-sm text-gray-700">
                <span className="font-medium">UGL{event.edition}</span>:{' '}
                {event.teams.map((t) => `${t.name} ${formatPoints(s.points[t.id] ?? 0)}`).join(', ')} ({event.matches.length} matches)
              </p>
            ))}
            {result.warnings.length > 0 && (
              <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 space-y-1">
                <p className="font-semibold">Worth a look</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          <Section step={4} title={`Copy into the ${copyName}`}>
            {problems.length > 0 && (
              <ul className="text-sm text-red-700 list-disc pl-5 space-y-0.5">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            {dataEnv === 'live' && (
              <label className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <input type="checkbox" checked={liveConfirmed} onChange={(e) => setLiveConfirmed(e.target.checked)} className="mt-0.5 accent-amber-600" />
                This is the live site. Each run replaces {FOUNDERS_NAME}, so anything changed on the new pages since the last run is lost. Run it once, at the switch.
              </label>
            )}
            <button onClick={write} disabled={busy || problems.length > 0 || (dataEnv === 'live' && !liveConfirmed)} className={buttonClass}>
              {busy ? 'Working…' : `Copy into the ${copyName}`}
            </button>
            {phase.kind === 'clearing' && <p className="text-sm text-gray-500">Clearing the old copy… {phase.total > 0 && `${phase.done} of ${phase.total}`}</p>}
            {phase.kind === 'writing' && <p className="text-sm text-gray-500">Writing… {phase.done} of {phase.total}</p>}
            {phase.kind === 'done' && (
              <p className="text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2">
                Done: {FOUNDERS_NAME} is in the {copyName} ({phase.count} documents). Today's data is unchanged.
              </p>
            )}
            {phase.kind === 'failed' && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
                Stopped: {phase.message}. Nothing in today's data changed; running it again starts the copy over.
              </p>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
