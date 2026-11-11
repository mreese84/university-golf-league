import { useState } from 'react';
import { fmt } from '../../components/guide/dates';
import { useLiveCollection, useLiveDoc } from '../../data/hooks';
import { pathsFor } from '../../data/paths';
import { checkResults, type SavedMatch, type SquabbitImport as Imported } from '../../data/results';
import type { GuideContent, Handicap, Match, Person } from '../../data/types';
import { saveResults } from '../../data/writes';
import { dataEnv } from '../../dataEnv';
import { db } from '../../firebase';
import { formatPoints } from '../../history/format';
import { chapterHistoryLinks, chapterPath, followLink, tripGuidePath } from '../../routes';
import { Notice, Waiting } from '../parts';
import { nameOf as chapterNameOf, type ChapterData } from './data';
import MatchEditor from './results/MatchEditor';
import SquabbitImport from './results/SquabbitImport';

const P = pathsFor(dataEnv);

type Editing = { kind: 'match'; session: string; n: number } | { kind: 'import'; session: string } | null;

// A trip's results, for organizers: each session's matches, typed in or imported from Squabbit.
// Every save is checked as the history would be first, and the History tab shows the trip from
// its first result.
export default function ResultsPage({ data, tripId }: { data: ChapterData; tripId: string }) {
  const c = data.chapterId;
  const trip = data.trips.find((t) => t.id === tripId);
  const key = `${c}:${tripId}:${data.uid}`;
  const { status, data: guide } = useLiveDoc<GuideContent>(`${P.trip(c, tripId)}/content`, 'guide', key);
  const { status: matchesStatus, items } = useLiveCollection<Match>(P.matches(c, tripId), key);
  const { items: handicapDocs } = useLiveCollection<Handicap>(P.handicaps(c, tripId), key);
  const [editing, setEditing] = useState<Editing>(null);

  const matches = items as SavedMatch[];
  const handicaps = Object.fromEntries(handicapDocs.map((h) => [h.id, h.index]));
  const nameOf = (id: string) => chapterNameOf(data, id);
  const people = Object.entries(data.people).map(([id, person]) => ({ id, person: person as Person }));
  const back = (
    <div className="flex items-center justify-between gap-3 text-sm">
      <a href={chapterPath(c)} onClick={(e) => followLink(e, chapterPath(c))} className="text-gray-500 hover:text-green-700">
        ← Trips
      </a>
      <a href={tripGuidePath(c, tripId)} onClick={(e) => followLink(e, tripGuidePath(c, tripId))} className="text-gray-500 hover:text-green-700">
        Player's Guide →
      </a>
    </div>
  );

  if (!data.canManage) {
    const history = chapterHistoryLinks(c).event(tripId);
    return (
      <Notice title="Results are entered by organizers">
        <a href={history} onClick={(e) => followLink(e, history)} className="text-green-700 font-medium">
          See the trip's results
        </a>
      </Notice>
    );
  }
  if (data.tripsStatus === 'loading' || status === 'loading' || matchesStatus === 'loading') return <Waiting>Loading…</Waiting>;
  if (!trip) return <Notice title="Trip not found"><p>Check the link, or pick the trip from the Trips tab.</p></Notice>;
  if (trip.draft) {
    return (
      <Notice title="This trip is still a draft">
        <p>Publish it from the Trips tab first: results go into the chapter's history, which everyone sees.</p>
      </Notice>
    );
  }
  if (!guide || guide.format.sessions.length === 0) {
    return (
      <div className="space-y-4">
        {back}
        <Notice title="No sessions to play for yet">
          <p>Results follow the guide: its teams, rounds and sessions. Fill those in first, in the Player's Guide.</p>
        </Notice>
      </div>
    );
  }

  const teams = guide.teams;
  const teamsSet = teams.length >= 2 && teams.every((t) => t.memberIds.length > 0);
  const totals = Object.fromEntries(teams.map((t) => [t.id, matches.reduce((sum, m) => sum + (m.result.points[t.id] ?? 0), 0)]));
  const expected = guide.format.sessions.reduce((sum, s) => sum + s.matches, 0);

  // Checks the trip's history with the change, then saves it; returns what's wrong instead when
  // the checks find something
  const commit = async (put: SavedMatch[], remove: string[], filled?: { course: { par: number[]; strokeIndex: number[] } | null; round: string; handicaps: Record<string, number> }) => {
    const next = [...matches.filter((m) => !remove.includes(m.id) && !put.some((p) => p.id === m.id)), ...put];
    const nextGuide = filled?.course ? { ...guide, rounds: guide.rounds.map((r) => (r.id === filled.round ? { ...r, ...filled.course } : r)) } : guide;
    const errors = checkResults(trip, nextGuide, { ...handicaps, ...filled?.handicaps }, next, people);
    if (errors.length) return errors;
    await saveResults(db, dataEnv, c, tripId, {
      put,
      remove,
      ...(filled?.course ? { guide: nextGuide } : {}),
      ...(filled && Object.keys(filled.handicaps).length ? { handicaps: filled.handicaps } : {}),
      by: data.personId ?? 'organizer',
    });
    setEditing(null);
    return [];
  };

  return (
    <div className="space-y-4">
      {back}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Results</h2>
        <p className="text-sm text-gray-500 mt-1">
          {trip.title} · {trip.location}
        </p>
      </div>

      {!trip.dates && (
        <p className="text-sm text-amber-800 bg-amber-50 rounded-xl px-4 py-2">Set the trip's first and last day in the guide's trip details: the history needs them.</p>
      )}
      {!teamsSet && (
        <p className="text-sm text-amber-800 bg-amber-50 rounded-xl px-4 py-2">Publish the teams first, from the pairings panel in the guide: results follow who's on each team.</p>
      )}

      {matches.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {teams.map((t) => (
              <div key={t.id} className="text-center">
                <p className="text-2xl font-bold tabular-nums" style={{ color: t.color }}>
                  {formatPoints(totals[t.id])}
                </p>
                <p className="text-xs text-gray-500">{t.name}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 text-right">
            {matches.length} of {expected} results in
          </p>
        </div>
      )}

      {guide.format.sessions.map((s) => {
        const round = guide.rounds.find((r) => r.id === s.round);
        const done = matches.filter((m) => m.session === s.id).sort((a, b) => a.match - b.match);
        const canImport = !!round && teamsSet && (s.scoring === 'match' || s.basis === 'gross');
        const slots = Array.from({ length: s.matches }, (_, i) => i + 1);
        return (
          <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-gray-800">{s.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {round ? `${fmt(round.date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${round.course} · ` : ''}
                  {s.scoring === 'aggregate' ? `team total, ${s.basis === 'gross' ? 'gross' : 'net'}` : `${s.matches} matches`} · {formatPoints(s.points)} pt each
                </p>
              </div>
              {canImport && editing === null && (
                <button onClick={() => setEditing({ kind: 'import', session: s.id })} className="text-xs font-medium text-green-700 hover:underline cursor-pointer shrink-0">
                  Import from Squabbit
                </button>
              )}
            </div>

            {editing?.kind === 'import' && editing.session === s.id && round ? (
              <SquabbitImport
                session={s}
                round={round}
                teams={teams}
                people={people.map((p) => ({ id: p.id, name: p.person.name }))}
                handicaps={handicaps}
                replacing={done.length}
                onSave={(imported: Imported) =>
                  commit(
                    imported.matches,
                    done.map((m) => m.id).filter((id) => !imported.matches.some((m) => m.id === id)),
                    { course: imported.course, round: round.id, handicaps: imported.handicaps },
                  )
                }
                onCancel={() => setEditing(null)}
              />
            ) : (
              <ul className="divide-y divide-gray-50">
                {slots.map((n) => {
                  const m = done.find((x) => x.match === n);
                  if (editing?.kind === 'match' && editing.session === s.id && editing.n === n) {
                    return (
                      <li key={n} className="py-2">
                        <MatchEditor
                          session={s}
                          round={round}
                          teams={teams}
                          nameOf={nameOf}
                          n={n}
                          existing={m}
                          onSave={(match) => commit([match], [])}
                          onDelete={m ? () => commit([], [m.id]) : undefined}
                          onCancel={() => setEditing(null)}
                        />
                      </li>
                    );
                  }
                  const winner = teams.find((t) => t.id === m?.result.winner);
                  return (
                    <li key={n} className="flex items-center justify-between gap-3 py-2 text-sm">
                      {m ? (
                        <span className="min-w-0">
                          {s.scoring !== 'aggregate' && <span className="text-gray-400 tabular-nums mr-1.5">{n}.</span>}
                          <span className="text-gray-700">
                            {m.totals
                              ? teams.map((t) => `${t.name} ${m.totals![t.id]}`).join(' v ')
                              : teams.map((t) => (m.sides[t.id] ?? []).map(nameOf).join(' & ')).join(' v ')}
                          </span>
                          <span className="block text-xs font-semibold mt-0.5" style={{ color: winner?.color }}>
                            {winner ? `${winner.name} ${m.result.margin}` : m.totals ? 'Tied' : 'Halved'}
                            {m.scores && <span className="font-normal text-gray-400"> · scorecard</span>}
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-400">{s.scoring === 'aggregate' ? 'No result yet' : `${n}. No result yet`}</span>
                      )}
                      {editing === null && teamsSet && (
                        <button onClick={() => setEditing({ kind: 'match', session: s.id, n })} className="text-xs font-medium text-green-700 hover:underline cursor-pointer shrink-0">
                          {m ? 'Edit' : 'Add'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}

      {matches.length > 0 && trip.dates && (
        <a
          href={chapterHistoryLinks(c).event(tripId)}
          onClick={(e) => followLink(e, chapterHistoryLinks(c).event(tripId))}
          className="block text-center text-sm font-medium text-green-700 hover:underline"
        >
          See it in the History tab →
        </a>
      )}
    </div>
  );
}
