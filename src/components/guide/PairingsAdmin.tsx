import { useEffect, useState } from 'react';
import type { LoadStatus } from '../../data/hooks';
import { planPairings } from '../../pairings';
import type { DraftGroup, GuideDraft, GuideRound, GuideTeam, MatchType, Member, PlayerGuide } from '../../types';
import { fmt } from './dates';
import { Chevron, inputClass } from './parts';

const selectClass =
  'w-full min-w-0 px-2 py-1.5 border rounded-lg bg-white text-sm text-gray-800 ' +
  'focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500';

const buttonClass =
  'px-4 py-2 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer';

// Which team (index into guide.teams) each of a tee time's four slots belongs to
const SLOT_TEAMS: Record<MatchType, (number | null)[]> = {
  fourball: [0, 0, 1, 1],
  singles: [0, 1, 0, 1],
  casual: [null, null, null, null],
};

const words = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, ' ').trim().split(/\s+/);

// Matches a pasted name ("Jane Doe") to a member ("Jane D" or "Jane Doe")
function findMember(name: string, members: Member[]) {
  const [first, ...rest] = words(name);
  const last = rest.at(-1) ?? '';
  return members.find((m) => {
    const [mFirst, ...mRest] = words(m.name);
    const mLast = mRest.at(-1) ?? '';
    return mFirst === first && !!last && !!mLast && (last.startsWith(mLast) || mLast.startsWith(last));
  });
}

// Reads "Name<tab>Handicap" lines, as copied from the planning spreadsheet
function parseHandicaps(text: string, members: Member[]) {
  const found: Record<string, number> = {};
  const unmatched: string[] = [];
  for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
    // The first standalone number is the handicap; the name is everything before it
    const number = line.match(/(^|[\s,])(\+?-?\d+(\.\d+)?)(?=[\s,]|$)/);
    const name = number ? line.slice(0, number.index).replace(/[,\t]/g, ' ').trim() : '';
    const member = name ? findMember(name, members) : undefined;
    if (number && member) found[member.id] = Number(number[2].replace('+', '-'));
    else if (!/^player\b/i.test(line)) unmatched.push(line);
  }
  return { found, unmatched };
}

function HandicapInput({ value, onSave }: { value: number | undefined; onSave: (v: number | null) => void }) {
  const [text, setText] = useState(value?.toString() ?? '');
  const commit = () => {
    const v = text.trim() === '' ? null : Number(text);
    if (v !== null && Number.isNaN(v)) return setText(value?.toString() ?? '');
    if (v !== (value ?? null)) onSave(v);
  };
  return (
    <input
      type="number"
      step="0.1"
      inputMode="decimal"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className="w-16 shrink-0 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-right tabular-nums
                 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
    />
  );
}

interface RoundEditorProps {
  round: GuideRound;
  groups: DraftGroup[] | undefined;
  teams: GuideTeam[];
  draft: GuideDraft;
  attendeeIds: string[];
  nameOf: (id: string) => string;
  onChange: (groups: DraftGroup[]) => void;
}

function RoundEditor({ round, groups, teams, draft, attendeeIds, nameOf, onChange }: RoundEditorProps) {
  const current = round.groups.map((_, i) => {
    const ids = groups?.[i]?.playerIds ?? [];
    return [0, 1, 2, 3].map((s) => ids[s] ?? null);
  });
  const placed = current.flat().filter((id): id is string => !!id);
  const duplicates = new Set(placed.filter((id, i) => placed.indexOf(id) !== i));
  const unplaced = attendeeIds.filter((id) => !placed.includes(id));

  const setSlot = (group: number, slot: number, id: string) => {
    const next = current.map((ids) => [...ids]);
    next[group][slot] = id || null;
    onChange(next.map((playerIds) => ({ playerIds })));
  };

  const options = (slot: number, selected: string | null) => {
    const team = SLOT_TEAMS[round.matchType][slot];
    const roster = team === null ? [] : draft.teams[teams[team]?.id] ?? [];
    const ids = roster.length ? roster : attendeeIds;
    return [...new Set([...(selected ? [selected] : []), ...ids])].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  };

  const slotSelect = (group: number, slot: number) => {
    const id = current[group][slot];
    const team = SLOT_TEAMS[round.matchType][slot];
    return (
      <select
        value={id ?? ''}
        onChange={(e) => setSlot(group, slot, e.target.value)}
        aria-label={`${round.course} group ${group + 1} slot ${slot + 1}`}
        className={`${selectClass} ${id && duplicates.has(id) ? 'border-red-400' : 'border-gray-200'}`}
      >
        <option value="">{team === null ? 'TBD' : `${teams[team]?.name ?? 'Team'} – TBD`}</option>
        {options(slot, id).map((o) => (
          <option key={o} value={o}>
            {nameOf(o)}
          </option>
        ))}
      </select>
    );
  };

  const vs = <span className="text-xs text-gray-400 text-center">vs</span>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="font-semibold text-gray-800">
          {fmt(round.date, { weekday: 'short', month: 'short', day: 'numeric' })} · {round.course}
        </p>
        <button
          onClick={() => onChange(round.groups.map(() => ({ playerIds: [] })))}
          className="text-xs text-gray-400 hover:text-red-500 cursor-pointer"
        >
          Clear
        </button>
      </div>
      {current.map((_, g) => (
        <div key={g} className="flex gap-3">
          <p className="w-16 shrink-0 pt-1.5 text-xs font-semibold text-gray-600">{round.groups[g].teeTime}</p>
          <div className="flex-1 min-w-0 space-y-1.5">
            {round.matchType === 'fourball' && (
              <>
                <div className="grid grid-cols-2 gap-1.5">{slotSelect(g, 0)}{slotSelect(g, 1)}</div>
                {vs}
                <div className="grid grid-cols-2 gap-1.5">{slotSelect(g, 2)}{slotSelect(g, 3)}</div>
              </>
            )}
            {round.matchType === 'singles' &&
              [0, 2].map((s) => (
                <div key={s} className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                  {slotSelect(g, s)}
                  {vs}
                  {slotSelect(g, s + 1)}
                </div>
              ))}
            {round.matchType === 'casual' && (
              <div className="grid grid-cols-2 gap-1.5">{[0, 1, 2, 3].map((s) => <div key={s}>{slotSelect(g, s)}</div>)}</div>
            )}
          </div>
        </div>
      ))}
      {duplicates.size > 0 && (
        <p className="text-xs text-red-600">In more than one group: {[...duplicates].map(nameOf).join(', ')}</p>
      )}
      {unplaced.length > 0 && placed.length > 0 && (
        <p className="text-xs text-gray-400">Not in a group: {unplaced.map(nameOf).join(', ')}</p>
      )}
    </div>
  );
}

interface PairingsAdminProps {
  guide: PlayerGuide;
  draft: GuideDraft | null;
  status: LoadStatus; // of the draft
  attendeeIds: string[];
  members: Member[];
  onSave: (draft: GuideDraft) => Promise<void>;
  onRetry: () => void;
}

interface Notice {
  text: string;
  place: 'paste' | 'generate';
  id: number;
}

const NOTICE_MS = 4000; // matches the notice animation in index.css

export default function PairingsAdmin({
  guide,
  draft: saved,
  status,
  attendeeIds,
  members,
  onSave,
  onRetry,
}: PairingsAdminProps) {
  const draft = saved ?? { published: false, handicaps: {}, captains: {}, teams: {}, rounds: {} };
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const ready = status === 'ready' || status === 'missing';

  // Confirmations fade out on their own
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const flash = (text: string, place: Notice['place']) => setNotice({ text, place, id: Date.now() });

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? 'Unknown';
  const teams = guide.teams;
  const teamOf = (id: string) => teams.find((t) => draft.teams[t.id]?.includes(id));
  const total = (ids: string[]) => ids.reduce((sum, id) => sum + (draft.handicaps[id] ?? 0), 0);

  const save = async (next: GuideDraft) => {
    setSaving(true);
    setError(null);
    try {
      await onSave(next);
      return true;
    } catch {
      setError('Save failed. Check your connection and try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const setHandicap = (id: string, value: number | null) => {
    const handicaps = { ...draft.handicaps };
    if (value === null) delete handicaps[id];
    else handicaps[id] = value;
    save({ ...draft, handicaps });
  };

  // Moving a player off a team also drops them as that team's captain
  const setTeam = (id: string, teamId: string) => {
    const nextTeams = Object.fromEntries(teams.map((t) => [t.id, (draft.teams[t.id] ?? []).filter((x) => x !== id)]));
    if (teamId) nextTeams[teamId] = [...nextTeams[teamId], id];
    const captains = Object.fromEntries(
      Object.entries(draft.captains).filter(([t, c]) => c !== id || t === teamId)
    );
    save({ ...draft, teams: nextTeams, captains });
  };

  // A captain is always on the team they captain
  const setCaptain = (teamId: string, id: string) => {
    const captains = Object.fromEntries(
      Object.entries({ ...draft.captains, [teamId]: id }).filter(([t, c]) => c && (t === teamId || c !== id))
    );
    const nextTeams = Object.fromEntries(
      teams.map((t) => {
        const ids = (draft.teams[t.id] ?? []).filter((x) => x !== id);
        return [t.id, t.id === teamId && id ? [id, ...ids] : ids];
      })
    );
    save({ ...draft, captains, teams: nextTeams });
  };

  const applyPaste = () => {
    const { found, unmatched } = parseHandicaps(pasteText, members.filter((m) => attendeeIds.includes(m.id)));
    const count = Object.keys(found).length;
    if (count) save({ ...draft, handicaps: { ...draft.handicaps, ...found } });
    if (count) flash(`Updated ${count} handicap${count === 1 ? '' : 's'}`, 'paste');
    if (unmatched.length) setError(`Couldn't match these lines to a player on this trip: ${unmatched.join('; ')}`);
    setPasting(false);
    setPasteText('');
  };

  const fourball = guide.rounds.find((r) => r.matchType === 'fourball');
  const singles = guide.rounds.find((r) => r.matchType === 'singles');

  const generate = async () => {
    setError(null);
    setNotice(null);
    if (teams.length !== 2 || !fourball || !singles) {
      setError('Generating needs two teams, a best ball round, and a singles round in the guide.');
      return;
    }
    if (fourball.groups.length !== singles.groups.length) {
      setError('The best ball and singles days need the same number of tee times.');
      return;
    }
    let plan: ReturnType<typeof planPairings>;
    try {
      plan = planPairings({
        playerIds: attendeeIds,
        handicaps: draft.handicaps,
        teamIds: [teams[0].id, teams[1].id],
        captains: draft.captains,
        groupsPerRound: fourball.groups.length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate pairings.');
      return;
    }
    const hasGroups = [fourball, singles].some((r) => draft.rounds[r.id]?.some((g) => g.playerIds.some(Boolean)));
    const hasTeams = teams.some((t) => (draft.teams[t.id] ?? []).length > 0);
    if (
      (hasGroups || hasTeams) &&
      !confirm(
        `Replace the current teams and the ${fmt(fourball.date, { weekday: 'long' })} and ` +
          `${fmt(singles.date, { weekday: 'long' })} groups?` +
          (draft.published ? ' Members will see the change right away.' : '')
      )
    ) {
      return;
    }
    const ok = await save({
      ...draft,
      teams: plan.teams,
      rounds: {
        ...draft.rounds,
        [fourball.id]: plan.fourball.map((playerIds) => ({ playerIds })),
        [singles.id]: plan.singles.map((playerIds) => ({ playerIds })),
      },
    });
    if (ok) flash(`Generated · team totals within ${plan.teamGap.toFixed(1)}`, 'generate');
  };

  const sorted = [...attendeeIds].sort(
    (a, b) => (draft.handicaps[a] ?? 99) - (draft.handicaps[b] ?? 99) || nameOf(a).localeCompare(nameOf(b))
  );

  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden mb-6">
      {/* Status + visibility toggle */}
      <div className="px-5 py-4 bg-amber-50/60">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold text-gray-800 whitespace-nowrap">Teams & pairings</p>
          <label className="flex items-center gap-2 shrink-0 cursor-pointer">
            <span className="text-xs font-medium text-gray-600">Show to members</span>
            <button
              role="switch"
              aria-checked={draft.published}
              aria-label="Show teams and pairings to members"
              disabled={!ready}
              onClick={() => save({ ...draft, published: !draft.published })}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-40
                disabled:cursor-not-allowed ${draft.published ? 'bg-green-600' : 'bg-gray-300'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
                  ${draft.published ? 'translate-x-5' : ''}`}
              />
            </button>
          </label>
        </div>
        {status === 'denied' || status === 'error' ? (
          <p className="text-xs text-red-600 mt-1">
            Couldn't load your draft
            {status === 'denied' && '. Make sure the latest firestore.rules are published'}.{' '}
            <button onClick={onRetry} className="font-medium underline cursor-pointer">
              Try again
            </button>
          </p>
        ) : (
          <p className="text-xs text-gray-500 mt-1">
            {!ready
              ? 'Loading your draft…'
              : draft.published
                ? 'Members can see the teams and pairings.'
                : 'Draft: only you can see the teams and pairings.'}
            {saving && ' Saving…'}
          </p>
        )}
      </div>

      <button
        onClick={() => setOpen(!open)}
        disabled={!ready}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-3 text-sm font-medium text-gray-600 text-left
                   border-t border-amber-100 hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span>
          {open ? 'Hide' : 'Manage'} handicaps, teams & groups
          {!open && teams.every((t) => (draft.teams[t.id] ?? []).length) && (
            <span className="text-gray-400 font-normal">
              {' · '}
              {teams.map((t) => `${t.name} ${total(draft.teams[t.id] ?? []).toFixed(1)}`).join(' · ')}
            </span>
          )}
        </span>
        <Chevron open={open} />
      </button>

      {error && (
        <div className="flex items-start gap-3 mx-5 mb-3 text-sm text-red-700 bg-red-50 rounded-xl px-4 py-2">
          <p className="flex-1">{error}</p>
          <button onClick={() => setError(null)} aria-label="Dismiss" className="text-red-400 hover:text-red-600 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Slides open/closed: grid rows animate from 0fr to 1fr */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none
          ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden" inert={!open}>
          <div
            className={`px-5 pb-5 pt-1 space-y-8 transition-opacity duration-300 motion-reduce:transition-none
              ${open ? 'opacity-100' : 'opacity-0'}`}
          >
            {/* Players: handicaps, teams, captains */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Players</h4>
                <button
                  onClick={() => setPasting(!pasting)}
                  className="text-xs font-medium text-green-700 hover:text-green-800 cursor-pointer"
                >
                  {pasting ? 'Cancel paste' : 'Paste handicaps from spreadsheet'}
                </button>
              </div>
              {notice?.place === 'paste' && (
                <p key={notice.id} className="text-xs font-medium text-green-700 animate-notice">✓ {notice.text}</p>
              )}
              {pasting && (
                <div className="space-y-2">
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={5}
                    placeholder={'Copy the Player and Handicap columns and paste here, e.g.\nJane Doe\t12.4'}
                    className={inputClass}
                  />
                  <button onClick={applyPaste} disabled={!pasteText.trim()} className={buttonClass}>
                    Update handicaps
                  </button>
                </div>
              )}
              <div className="divide-y divide-gray-100">
                {sorted.map((id) => (
                  <div key={id} className="flex items-center gap-3 py-1.5">
                    <span className="flex-1 min-w-0 text-sm text-gray-800 truncate">
                      {nameOf(id)}
                      {Object.values(draft.captains).includes(id) && (
                        <span className="ml-1.5 text-[10px] font-bold text-amber-700 bg-amber-100 rounded px-1 py-0.5">C</span>
                      )}
                    </span>
                    <HandicapInput
                      key={`${id}:${draft.handicaps[id] ?? ''}`}
                      value={draft.handicaps[id]}
                      onSave={(v) => setHandicap(id, v)}
                    />
                    <select
                      value={teamOf(id)?.id ?? ''}
                      onChange={(e) => setTeam(id, e.target.value)}
                      aria-label={`${nameOf(id)}'s team`}
                      className={`${selectClass} border-gray-200 !w-28 shrink-0`}
                    >
                      <option value="">No team</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name.replace(/^Team\s+/i, '')}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {teams.map((t) => (
                  <label key={t.id} className="block">
                    <span className="block text-xs font-medium text-gray-500 mb-1">
                      {t.name} captain
                      {(draft.teams[t.id] ?? []).length > 0 && (
                        <span className="text-gray-400 font-normal">
                          {' · '}
                          {(draft.teams[t.id] ?? []).length} players, {total(draft.teams[t.id] ?? []).toFixed(1)} total
                        </span>
                      )}
                    </span>
                    <select
                      value={draft.captains[t.id] ?? ''}
                      onChange={(e) => setCaptain(t.id, e.target.value)}
                      className={`${selectClass} border-gray-200`}
                    >
                      <option value="">No captain</option>
                      {[...attendeeIds]
                        .sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
                        .map((id) => (
                          <option key={id} value={id}>
                            {nameOf(id)}
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
              </div>
              {fourball && singles && (
                <div className="pt-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <button onClick={generate} disabled={saving} className={buttonClass}>
                      Generate teams & pairings
                    </button>
                    {notice?.place === 'generate' && (
                      <span key={notice.id} className="text-xs font-medium text-green-700 animate-notice">
                        ✓ {notice.text}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    Balances team totals with captains on opposite teams, matches {fmt(fourball.date, { weekday: 'long' })}'s
                    pairs by combined handicap, and gives everyone at least 2 new groupmates on{' '}
                    {fmt(singles.date, { weekday: 'long' })}. Other days are set by hand.
                  </p>
                </div>
              )}
            </section>

            {/* Groups for each round */}
            {guide.rounds.map((round) => (
              <section key={round.id} className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{round.label}</h4>
                <RoundEditor
                  round={round}
                  groups={draft.rounds[round.id]}
                  teams={teams}
                  draft={draft}
                  attendeeIds={attendeeIds}
                  nameOf={nameOf}
                  onChange={(groups) => save({ ...draft, rounds: { ...draft.rounds, [round.id]: groups } })}
                />
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
