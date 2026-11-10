import { useState } from 'react';
import { useAuth } from '../../auth';
import { OFF_COURSE, addShots, useFireball, type ShotCounts } from '../../fireball';
import type { GuideTeam, Member, PlayerGuide } from '../../types';
import Emblem from './Emblem';
import { bucketsFor, currentBucket, type Bucket } from './fireballBuckets';
import { Card, Tbd } from './parts';

interface Player {
  id: string;
  name: string;
  team?: GuideTeam;
}

const total = (counts: Record<string, number> | undefined) =>
  Object.values(counts ?? {}).reduce((sum, n) => sum + Math.max(0, n), 0);

function CountButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="w-14 h-14 shrink-0 rounded-full border-2 border-(--guide) text-(--guide) text-2xl font-semibold leading-none
                 active:bg-(--guide) active:text-(--guide-on) hover:bg-(--guide)/5 disabled:opacity-30
                 disabled:cursor-not-allowed transition-colors cursor-pointer select-none touch-manipulation"
    >
      {children}
    </button>
  );
}

interface FireballBoardProps {
  buckets: Bucket[];
  initialBucket: string;
  players: Player[]; // the trip's attendees
  teams: GuideTeam[]; // teams with players set
  counts: ShotCounts;
  me: string | null; // who this phone logs for
  canLogForAnyone: boolean; // admin
  // Whether this phone can change who it logs for. The Phase 1 pages know who's signed in, so for
  // players it's always them (false); today's guide asks (true).
  canSwitch?: boolean;
  error: string | null;
  onPickMe: (id: string | null) => void;
  onAdd: (bucket: string, delta: 1 | -1) => void;
}

export function FireballBoard({
  buckets,
  initialBucket,
  players,
  teams,
  counts,
  me,
  canLogForAnyone,
  canSwitch = true,
  error,
  onPickMe,
  onAdd,
}: FireballBoardProps) {
  const [bucket, setBucket] = useState(initialBucket);
  const [choosing, setChoosing] = useState(false);
  const mine = me ? (counts[me]?.[bucket] ?? 0) : 0;
  const place = buckets.find((b) => b.id === bucket)?.place;
  const meName = players.find((p) => p.id === me)?.name;

  // Leaderboard: most shots first; ties share a rank
  const rows = players
    .map((p) => ({ ...p, total: total(counts[p.id]) }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const rankOf = (n: number) => rows.findIndex((r) => r.total === n) + 1;
  const leaderIn = Object.fromEntries(
    buckets.map((b) => [b.id, Math.max(0, ...players.map((p) => counts[p.id]?.[b.id] ?? 0))]),
  );
  const teamTotals = teams.map((t) => ({ team: t, total: t.memberIds.reduce((sum, id) => sum + total(counts[id]), 0) }));
  const anyShots = rows.some((r) => r.total > 0);

  const picker = (
    <select
      value={me ?? ''}
      onChange={(e) => {
        onPickMe(e.target.value || null);
        setChoosing(false);
      }}
      className="text-sm font-medium text-gray-800 bg-white border border-gray-200 rounded-lg px-2 py-1"
      aria-label={canLogForAnyone ? 'Logging for' : 'Which player are you?'}
    >
      <option value="">{canLogForAnyone ? 'Pick a player' : 'Pick yourself'}</option>
      {players.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );

  return (
    <Card className="space-y-5">
      {/* Logging */}
      <div>
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label="Where">
          {buckets.map((b) => (
            <button
              key={b.id}
              role="tab"
              aria-selected={bucket === b.id}
              title={b.title}
              onClick={() => setBucket(b.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer
                ${bucket === b.id
                  ? 'bg-(--guide) border-(--guide) text-(--guide-on)'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-(--guide) hover:text-(--guide)'}`}
            >
              {b.id === OFF_COURSE ? 'Off the course' : b.label}
            </button>
          ))}
        </div>

        {me && !choosing ? (
          <>
            <p className="text-center text-xs text-gray-500 mt-4">{place}</p>
            <div className="flex items-center justify-center gap-8 mt-2">
              <CountButton label="Take back a shot" onClick={() => onAdd(bucket, -1)} disabled={mine <= 0}>
                −
              </CountButton>
              <div className="text-center w-20">
                <p className="text-5xl font-bold text-gray-900 tabular-nums tracking-tight" aria-live="polite">
                  {mine}
                </p>
                <p className="text-xs text-gray-500 mt-1">{mine === 1 ? 'shot' : 'shots'}</p>
              </div>
              <CountButton label="Add a shot" onClick={() => onAdd(bucket, 1)}>
                +
              </CountButton>
            </div>
            <p className="text-center text-xs text-gray-500 mt-4">
              {canLogForAnyone ? 'Logging for ' : 'Logging as '}
              <span className="font-medium text-gray-700">{meName}</span>
              {' · '}trip total {total(counts[me])}
              {(canSwitch || canLogForAnyone) && (
                <>
                  {' · '}
                  <button onClick={() => setChoosing(true)} className="font-medium text-(--guide) hover:underline cursor-pointer">
                    {canLogForAnyone ? 'Switch player' : 'Not you?'}
                  </button>
                </>
              )}
            </p>
          </>
        ) : !canSwitch && !canLogForAnyone ? (
          <p className="text-center text-sm text-gray-500 mt-5">You're not on this trip's list of players, so there's nothing to log.</p>
        ) : (
          <div className="text-center mt-5 space-y-2">
            <p className="text-sm text-gray-600">
              {canLogForAnyone ? 'Who are you logging for?' : 'Which player are you? You can only log your own shots.'}
            </p>
            {picker}
            {choosing && me && (
              <p>
                <button onClick={() => setChoosing(false)} className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer">
                  Cancel
                </button>
              </p>
            )}
          </div>
        )}
        {error && <p className="text-center text-xs text-red-600 mt-3">{error}</p>}
      </div>

      {/* Team totals */}
      {teamTotals.length >= 2 && (
        <div className="grid grid-cols-2 gap-px rounded-xl overflow-hidden">
          {teamTotals.map(({ team, total: n }) => (
            <div key={team.id} className="flex items-center gap-2 px-3 py-2.5 text-white" style={{ background: team.color }}>
              {team.emblem && <Emblem name={team.emblem} className="w-5 h-5 shrink-0" />}
              <span className="flex-1 min-w-0 text-sm font-semibold truncate">{team.name.replace(/^Team /, '')}</span>
              <span className="text-xl font-bold tabular-nums">{n}</span>
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard */}
      <div>
        <h4 className="text-sm font-semibold text-gray-800">Leaderboard</h4>
        {anyShots ? (
          <table className="w-full text-sm mt-2 tabular-nums">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-gray-400">
                <th className="py-1 w-6 font-normal text-left" aria-label="Rank" />
                <th className="py-1 font-normal text-left">Player</th>
                {buckets.map((b) => (
                  <th key={b.id} className={`py-1 w-8 font-normal text-right ${b.id === bucket ? 'text-gray-600' : ''}`} title={b.title}>
                    {b.label}
                  </th>
                ))}
                <th className="py-1 pl-2 w-14 font-semibold text-right text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`border-t border-gray-100 ${r.id === me ? 'bg-(--guide)/5' : ''}`}>
                  <td className="py-1.5 text-xs text-gray-400">{r.total > 0 ? rankOf(r.total) : ''}</td>
                  <td className="py-1.5 pr-2">
                    <span className="flex items-center gap-1.5 min-w-0">
                      {r.team?.emblem && (
                        <span title={r.team.name} className="shrink-0" style={{ color: r.team.color }}>
                          <Emblem name={r.team.emblem} className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <span className="truncate text-gray-800">{r.name}</span>
                    </span>
                  </td>
                  {buckets.map((b) => {
                    const n = counts[r.id]?.[b.id] ?? 0;
                    const leads = n > 0 && n === leaderIn[b.id];
                    return (
                      <td
                        key={b.id}
                        className={`py-1.5 text-right ${leads ? 'font-bold text-gray-900' : n > 0 ? 'text-gray-600' : 'text-gray-300'}`}
                        title={leads ? `Most on ${b.title}` : undefined}
                      >
                        {n > 0 ? n : '–'}
                      </td>
                    );
                  })}
                  <td className={`py-1.5 text-right font-semibold ${r.total > 0 ? 'text-gray-900' : 'text-gray-300'}`}>{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm mt-1">
            <Tbd>No shots logged yet.</Tbd>
          </p>
        )}
        {anyShots && <p className="text-[11px] text-gray-400 mt-2">Bold marks the leader for each round.</p>}
      </div>
    </Card>
  );
}

// ── Connected to sign-in and the database ─────────────────────────

// A Google name ("Mark Reese") matched to one member ("Mark R"), or null if it's unclear
function guessMember(displayName: string | null | undefined, players: Player[]) {
  const words = displayName?.trim().toLowerCase().split(/\s+/) ?? [];
  if (!words[0]) return null;
  const [first, last] = [words[0], words.length > 1 ? words[words.length - 1][0] : ''];
  const matches = players.filter((p) => {
    const parts = p.name.toLowerCase().split(/\s+/);
    const initial = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return parts[0] === first && (!initial || !last || initial === last);
  });
  return matches.length === 1 ? matches[0].id : null;
}

// Remembers who this phone logs for (best effort: storage can be unavailable)
function readChoice(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function saveChoice(key: string, id: string | null) {
  try {
    if (id) localStorage.setItem(key, id);
    else localStorage.removeItem(key);
  } catch {
    // fine: it just won't be remembered
  }
}

interface FireballTrackerProps {
  tripId: string;
  guide: PlayerGuide;
  members: Member[];
  attendeeIds: string[];
  timeZone: string | null;
}

export default function FireballTracker({ tripId, guide, members, attendeeIds, timeZone }: FireballTrackerProps) {
  const { user, isAdmin } = useAuth();
  const { status, counts } = useFireball(tripId, user?.uid ?? null);
  const storageKey = `ugl-fireball:${tripId}:${user?.uid ?? ''}`;
  const [picked, setPicked] = useState<string | null>(() => readChoice(storageKey));
  const [error, setError] = useState<string | null>(null);

  const teams = guide.teams.filter((t) => t.memberIds.length > 0);
  const players: Player[] = attendeeIds.map((id) => ({
    id,
    name: members.find((m) => m.id === id)?.name ?? 'Unknown',
    team: teams.find((t) => t.memberIds.includes(id)),
  }));
  const me = (picked && attendeeIds.includes(picked) ? picked : null) ?? guessMember(user?.displayName, players);

  const pickMe = (id: string | null) => {
    setPicked(id);
    saveChoice(storageKey, id);
    setError(null);
  };

  const add = (bucket: string, delta: 1 | -1) => {
    if (!me) return;
    setError(null);
    addShots(tripId, me, bucket, delta).catch((err: { code?: string }) => {
      if (err.code === 'permission-denied') {
        const name = players.find((p) => p.id === me)?.name ?? 'that player';
        setError(
          isAdmin
            ? "Couldn't save: the database rules need publishing (see firestore.rules)."
            : `That didn't save: your sign-in isn't ${name}'s. Pick yourself.`,
        );
        if (!isAdmin) pickMe(null);
      } else {
        setError("Couldn't save that shot. Check your connection and try again.");
      }
    });
  };

  if (status === 'denied' || status === 'error') {
    return (
      <Card className="text-sm text-gray-500 text-center">
        {status === 'denied' && isAdmin
          ? 'To turn this on, publish the updated database rules from firestore.rules in the Firebase console.'
          : "The Fireball tracker isn't available right now. It will keep trying."}
      </Card>
    );
  }
  if (status === 'loading') return <Card className="text-sm text-gray-400 text-center">Loading…</Card>;

  return (
    <FireballBoard
      buckets={bucketsFor(guide)}
      initialBucket={currentBucket(guide, timeZone)}
      players={players}
      teams={teams}
      counts={counts}
      me={me}
      canLogForAnyone={isAdmin}
      error={error}
      onPickMe={pickMe}
      onAdd={add}
    />
  );
}
