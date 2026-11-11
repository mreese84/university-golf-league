import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { useLiveCollection } from '../../data/hooks';
import { pathsFor } from '../../data/paths';
import {
  RESPONSES,
  RESPONSE_LABELS,
  countsOf,
  handicapText,
  parseHandicap,
  rsvpRows,
  sameMembers,
  yesAttendees,
  type RsvpRow,
} from '../../data/rsvp';
import type { Handicap, InviteNote, Response, Rsvp, Status } from '../../data/types';
import { clearHandicap, moveInviteToRsvp, removeFromTripList, setHandicap, setInviteNote, setRsvp } from '../../data/writes';
import { dataEnv } from '../../dataEnv';
import { db } from '../../firebase';
import { formatHandicap } from '../../history/format';
import { followLink, mePath } from '../../routes';
import type { ChapterTrip } from '../chapterTrips';
import { buttonClass, inputClass } from '../parts';
import { hasJoined, nameOf, type ChapterData } from './data';
import { GHIN_LOOKUP } from './ProfileForm';

const P = pathsFor(dataEnv);

const STATUS_LABELS: Record<Status, string> = { active: 'Active member', alumni: 'Alumni', guest: 'Guest', invitee: 'Invitee' };

const CHIP: Record<Response, string> = {
  yes: 'bg-green-100 text-green-700',
  maybe: 'bg-amber-100 text-amber-700',
  invited: 'bg-gray-100 text-gray-500',
  no: 'bg-red-50 text-red-600',
};

// Saving state shared by the forms here
function useWork() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      return true;
    } catch (err) {
      console.error(err);
      setError("That didn't save. Check your connection and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

// Their handicap for the trip, beside their GHIN number and the lookup to check it
function HandicapField({ value, onChange, ghin, error, isMe }: { value: string; onChange: (v: string) => void; ghin: string | null; error: string | null; isMe: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        Handicap index for this trip
        <input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" placeholder="12.4" className={`${inputClass} mt-1`} />
      </label>
      <p className={`text-xs mt-1 ${error ? 'text-red-600' : 'text-gray-400'}`}>
        {error ?? (
          <>
            {ghin ? `GHIN ${ghin} · ` : ''}
            <a href={GHIN_LOOKUP} target="_blank" rel="noreferrer" className="text-green-700 underline">
              Look it up on GHIN
            </a>
            {!ghin && isMe && (
              <>
                {' · '}
                <a href={mePath()} onClick={(e) => followLink(e, mePath())} className="text-green-700 underline">
                  add your GHIN number
                </a>
              </>
            )}
          </>
        )}
      </p>
    </div>
  );
}

// The signed-in player's own answer, note and handicap
function YourAnswer({ data, trip, row, handicap, onAnswer }: { data: ChapterData; trip: ChapterTrip; row: RsvpRow | undefined; handicap: number | undefined; onAnswer: () => void }) {
  const me = data.personId!;
  const [note, setNote] = useState(row?.note ?? '');
  const [hcp, setHcp] = useState(handicapText(handicap));
  const { busy, error, run } = useWork();
  const parsed = parseHandicap(hcp);
  const coming = row?.response === 'yes' || row?.response === 'maybe';
  const changed = note.trim() !== (row?.note ?? '') || hcp.trim() !== handicapText(handicap);

  const answer = (response: Response) => {
    onAnswer();
    return run(() => setRsvp(db, dataEnv, data.chapterId, trip.id, me, response, note.trim() || null));
  };
  const save = () =>
    run(async () => {
      if (row && note.trim() !== (row.note ?? '')) await setRsvp(db, dataEnv, data.chapterId, trip.id, me, row.response, note.trim() || null);
      if ((parsed.index ?? undefined) !== handicap) {
        await (parsed.index === null
          ? clearHandicap(db, dataEnv, data.chapterId, trip.id, me)
          : setHandicap(db, dataEnv, data.chapterId, trip.id, me, parsed.index, me));
      }
    });

  return (
    <div className="rounded-xl bg-gray-50 p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-gray-700 mr-1">{row?.response === 'invited' ? "You're invited. Are you in?" : 'Your answer'}</p>
        {(['yes', 'maybe', 'no'] as const).map((r) => (
          <button
            key={r}
            onClick={() => void answer(r)}
            disabled={busy}
            aria-pressed={row?.response === r}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer
              ${row?.response === r ? `${CHIP[r]} border-transparent` : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
          >
            {RESPONSE_LABELS[r]}
          </button>
        ))}
      </div>
      {row && (
        <>
          <label className="block text-xs font-medium text-gray-500">
            Note
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Flying in Friday" className={`${inputClass} mt-1`} />
          </label>
          {coming && <HandicapField value={hcp} onChange={setHcp} ghin={data.people[me]?.ghin ?? null} error={parsed.error} isMe />}
          {changed && (
            <button onClick={() => void save()} disabled={busy || !!parsed.error} className={buttonClass}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          )}
        </>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// Organizers: change someone's answer, note or handicap, or take them off the list
function RowEditor({ data, trip, row, handicap, onDone }: { data: ChapterData; trip: ChapterTrip; row: RsvpRow; handicap: number | undefined; onDone: () => void }) {
  const [response, setResponse] = useState<Response>(row.response);
  const [note, setNote] = useState(row.note ?? '');
  const [hcp, setHcp] = useState(handicapText(handicap));
  const { busy, error, run } = useWork();
  const parsed = parseHandicap(hcp);
  const c = data.chapterId;
  const p = row.personId;

  const save = async () => {
    const ok = await run(async () => {
      const n = note.trim() || null;
      if (row.invitee) await setInviteNote(db, dataEnv, c, trip.id, p, response, n);
      else if (row.source === 'invite') await moveInviteToRsvp(db, dataEnv, c, trip.id, p, response, n);
      else if (response !== row.response || n !== row.note) await setRsvp(db, dataEnv, c, trip.id, p, response, n);
      if (!row.invitee && (parsed.index ?? undefined) !== handicap) {
        await (parsed.index === null ? clearHandicap(db, dataEnv, c, trip.id, p) : setHandicap(db, dataEnv, c, trip.id, p, parsed.index, data.personId ?? 'organizer'));
      }
    });
    if (ok) onDone();
  };
  const remove = async () => {
    if (!confirm(`Take ${nameOf(data, p)} off this trip's list?`)) return;
    if (await run(() => removeFromTripList(db, dataEnv, c, trip.id, p))) onDone();
  };

  return (
    <div className="rounded-xl border border-gray-200 p-3 space-y-3 my-1">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-gray-500">
          Answer
          <select value={response} onChange={(e) => setResponse(e.target.value as Response)} className={`${inputClass} mt-1`}>
            {RESPONSES.map((r) => (
              <option key={r} value={r}>
                {RESPONSE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-500">
          Note
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Said yes by text" className={`${inputClass} mt-1`} />
        </label>
      </div>
      {!row.invitee && <HandicapField value={hcp} onChange={setHcp} ghin={data.people[p]?.ghin ?? null} error={parsed.error} isMe={false} />}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button onClick={() => void save()} disabled={busy || !!parsed.error} className={buttonClass}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onDone} disabled={busy} className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer">
          Cancel
        </button>
        <button onClick={() => void remove()} disabled={busy} className="ml-auto text-sm text-gray-400 hover:text-red-500 cursor-pointer">
          Take off the list
        </button>
      </div>
    </div>
  );
}

// Organizers: add people from the roster to the trip's list. Invitees' answers stay in organizers'
// notes, hidden from members, until they join.
function InvitePicker({ data, trip, listed, onDone }: { data: ChapterData; trip: ChapterTrip; listed: Set<string>; onDone: () => void }) {
  const candidates = data.roster
    .filter((e) => !listed.has(e.id))
    .sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || nameOf(data, a.id).localeCompare(nameOf(data, b.id)));
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const { busy, error, run } = useWork();
  const toggle = (id: string) => setPicked((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));

  const invite = async () => {
    const ok = await run(() =>
      Promise.all(
        [...picked].map((id) =>
          data.rosterById[id]?.status === 'invitee'
            ? setInviteNote(db, dataEnv, data.chapterId, trip.id, id, 'invited')
            : setRsvp(db, dataEnv, data.chapterId, trip.id, id, 'invited'),
        ),
      ),
    );
    if (ok) onDone();
  };

  if (candidates.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-2">
        Everyone on the roster is on the list.{' '}
        <button onClick={onDone} className="text-green-700 font-medium cursor-pointer">
          OK
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-gray-200 p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-gray-700">Invite to this trip</p>
        <button
          onClick={() => setPicked(new Set(candidates.filter((e) => e.status === 'active').map((e) => e.id)))}
          className="text-xs font-medium text-green-700 hover:underline cursor-pointer"
        >
          All active members
        </button>
      </div>
      <ul className="max-h-64 overflow-y-auto divide-y divide-gray-50">
        {candidates.map((e) => (
          <li key={e.id}>
            <label className="flex items-center gap-2 py-1.5 text-sm cursor-pointer">
              <input type="checkbox" checked={picked.has(e.id)} onChange={() => toggle(e.id)} className="accent-green-600" />
              <span className="flex-1 text-gray-800">{nameOf(data, e.id)}</span>
              <span className="text-xs text-gray-400">{STATUS_LABELS[e.status]}</span>
            </label>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button onClick={() => void invite()} disabled={busy || picked.size === 0} className={buttonClass}>
          {busy ? 'Inviting…' : `Invite ${picked.size || ''}`.trim()}
        </button>
        <button onClick={onDone} disabled={busy} className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer">
          Cancel
        </button>
      </div>
    </div>
  );
}

// An upcoming trip's invites and RSVPs, in place of the planning spreadsheet's Invites tab. Members
// see everyone who's joined the chapter and their answers, and answer for themselves; organizers
// also see invitees, and change anyone's answer.
export default function WhosComing({ data, trip }: { data: ChapterData; trip: ChapterTrip }) {
  const c = data.chapterId;
  const key = `${c}:${trip.id}:${data.uid}`;
  const { items: rsvps } = useLiveCollection<Rsvp>(P.rsvps(c, trip.id), key);
  const { items: invites } = useLiveCollection<InviteNote>(P.invites(c, trip.id), data.canManage ? key : null);
  const { items: handicapDocs } = useLiveCollection<Handicap>(P.handicaps(c, trip.id), key);
  const [open, setOpen] = useState<boolean | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const attendees = useWork();

  const rows = rsvpRows(rsvps, invites, data.rosterById);
  const handicaps: Record<string, number> = Object.fromEntries(handicapDocs.map((h) => [h.id, h.index]));
  const counts = countsOf(rows);
  const me = data.personId && hasJoined(data.rosterById[data.personId]) ? data.personId : null;
  const mine = rows.find((r) => r.personId === me);
  // Open by itself when the signed-in player has an invite to answer, and stays open once they do
  const isOpen = open ?? mine?.response === 'invited';
  const yes = yesAttendees(rows);
  const summary = RESPONSES.filter((r) => counts[r] > 0).map((r) => `${counts[r]} ${r === 'invited' ? 'no answer yet' : RESPONSE_LABELS[r].toLowerCase()}`);

  const makeAttendees = () => {
    const added = yes.filter((id) => !trip.attendeeIds.includes(id)).map((id) => nameOf(data, id));
    const removed = trip.attendeeIds.filter((id) => !yes.includes(id)).map((id) => nameOf(data, id));
    const change = [added.length ? `Adds ${added.join(', ')}.` : '', removed.length ? `Takes off ${removed.join(', ')}.` : ''].join(' ');
    if (!confirm(`Make the ${yes.length} who said yes this trip's attendees? ${change}`)) return;
    void attendees.run(() => updateDoc(doc(db, P.trip(c, trip.id)), { attendeeIds: yes }));
  };

  return (
    <div className="border-t border-gray-100 pt-3">
      <button onClick={() => setOpen(!isOpen)} aria-expanded={isOpen} className="w-full flex items-center justify-between gap-3 text-left cursor-pointer">
        <span>
          <span className="text-xs text-gray-400 uppercase tracking-wider">Who's coming</span>
          <span className="block text-sm text-gray-600 mt-0.5">
            {summary.length ? summary.join(' · ') : data.canManage ? 'Nobody invited yet' : 'No answers yet'}
          </span>
        </span>
        <span aria-hidden="true" className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {isOpen && (
        <div className="mt-3 space-y-3">
          {me && <YourAnswer key={`${mine?.response}|${mine?.note}|${handicaps[me]}`} data={data} trip={trip} row={mine} handicap={handicaps[me]} onAnswer={() => setOpen(true)} />}

          {RESPONSES.filter((r) => counts[r] > 0).map((r) => (
            <div key={r}>
              <p className="text-xs font-semibold text-gray-500 mb-1">
                {RESPONSE_LABELS[r]} ({counts[r]})
              </p>
              <ul className="divide-y divide-gray-50">
                {rows
                  .filter((row) => row.response === r)
                  .sort((a, b) => nameOf(data, a.personId).localeCompare(nameOf(data, b.personId)))
                  .map((row) =>
                    editing === row.personId ? (
                      <li key={row.personId}>
                        <RowEditor data={data} trip={trip} row={row} handicap={handicaps[row.personId]} onDone={() => setEditing(null)} />
                      </li>
                    ) : (
                      <li key={row.personId} className="flex items-start justify-between gap-3 py-1.5">
                        <div className="min-w-0">
                          <p className="text-sm text-gray-800">
                            {nameOf(data, row.personId)}
                            {row.invitee && (
                              <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-50 text-amber-700" title="Hidden from members until they join">
                                Invitee
                              </span>
                            )}
                          </p>
                          {row.note && <p className="text-xs text-gray-500">{row.note}</p>}
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-xs text-gray-500">
                          {(r === 'yes' || r === 'maybe') && handicaps[row.personId] !== undefined && (
                            <span className="tabular-nums" title="Handicap index for this trip">
                              HCP {formatHandicap(handicaps[row.personId])}
                            </span>
                          )}
                          {data.canManage && editing === null && (
                            <button onClick={() => setEditing(row.personId)} className="font-medium text-green-700 hover:underline cursor-pointer">
                              Edit
                            </button>
                          )}
                        </div>
                      </li>
                    ),
                  )}
              </ul>
            </div>
          ))}

          {data.canManage &&
            (inviting ? (
              <InvitePicker data={data} trip={trip} listed={new Set(rows.map((r) => r.personId))} onDone={() => setInviting(false)} />
            ) : (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <button onClick={() => setInviting(true)} className="text-sm font-medium text-green-700 hover:underline cursor-pointer">
                  + Invite people
                </button>
                {yes.length > 0 && !sameMembers(yes, trip.attendeeIds) && (
                  <button onClick={makeAttendees} disabled={attendees.busy} className="text-sm font-medium text-green-700 hover:underline cursor-pointer">
                    Make the {yes.length} who said yes the attendees
                  </button>
                )}
              </div>
            ))}
          {data.canManage && counts.invited + counts.yes + counts.maybe + counts.no > 0 && rows.some((r) => r.invitee) && (
            <p className="text-xs text-gray-400">Invitees are hidden from members until they join the chapter.</p>
          )}
          {attendees.error && <p className="text-xs text-red-600">{attendees.error}</p>}
        </div>
      )}
    </div>
  );
}
