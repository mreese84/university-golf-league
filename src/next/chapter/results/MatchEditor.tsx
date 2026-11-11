import { useState } from 'react';
import { aggregateMatch, manualMatch, resultFromCard, sideSize, type SavedMatch } from '../../../data/results';
import type { TripRound, TripSession } from '../../../data/types';
import { parseMargin } from '../../../history/scoring';
import type { GuideTeam } from '../../../types';
import { buttonClass, inputClass } from '../../parts';

const MARGINS = ['1 UP', '2 UP', '2&1', '3&1', '3&2', '4&2', '4&3', '5&3', '5&4', '6&4', '6&5', '7&5', '7&6', '8&6', '8&7', '9&8', '10&8'];

// The guide's groups suggest a match's players: fourball match 2 is the second tee time; singles
// matches 3 and 4 are the second tee time's slots 1 v 2 and 3 v 4
function suggestedSides(session: TripSession, round: TripRound | undefined, n: number, teams: GuideTeam[]) {
  const size = sideSize(session, round);
  if (size === null) return Object.fromEntries(teams.map((t) => [t.id, t.memberIds]));
  const group = round?.groups[size === 2 ? n - 1 : Math.floor((n - 1) / 2)];
  const slots = size === 2 ? group?.playerIds ?? [] : (group?.playerIds ?? []).slice(((n - 1) % 2) * 2, ((n - 1) % 2) * 2 + 2);
  return Object.fromEntries(teams.map((t) => [t.id, Array.from({ length: size }, (_, i) => slots.filter((id) => id && t.memberIds.includes(id))[i] ?? '')]));
}

// One match's players and result, typed in. A match with a Squabbit scorecard shows its result
// from the card; removing the card lets the result be typed instead.
export default function MatchEditor({
  session,
  round,
  teams,
  nameOf,
  n,
  existing,
  onSave,
  onDelete,
  onCancel,
}: {
  session: TripSession;
  round: TripRound | undefined;
  teams: GuideTeam[];
  nameOf: (id: string) => string;
  n: number;
  existing: SavedMatch | undefined;
  onSave: (match: SavedMatch) => Promise<string[]>;
  onDelete?: () => Promise<string[]>;
  onCancel: () => void;
}) {
  const aggregate = session.scoring === 'aggregate';
  const size = sideSize(session, round);
  const [sides, setSides] = useState<Record<string, string[]>>(existing?.sides ?? suggestedSides(session, round, n, teams));
  const [winner, setWinner] = useState<string>(existing ? (existing.result.winner ?? 'halved') : '');
  const [margin, setMargin] = useState(existing && existing.result.margin !== 'AS' ? existing.result.margin : '');
  const [totals, setTotals] = useState<Record<string, string>>(Object.fromEntries(teams.map((t) => [t.id, existing?.totals?.[t.id]?.toString() ?? ''])));
  const [keepCard, setKeepCard] = useState(!!existing?.scores);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const card = keepCard && existing?.scores ? resultFromCard(session, existing, round) : null;
  const sidesFull = teams.every((t) => sides[t.id]?.length && sides[t.id].every(Boolean));
  const allPicked = Object.values(sides).flat().filter(Boolean);
  const twice = allPicked.length !== new Set(allPicked).size;
  const marginOk = winner === 'halved' || !!parseMargin(margin.trim().toUpperCase().replace(/\s*&\s*/, '&'));
  const totalsOk = teams.every((t) => Number.isInteger(Number(totals[t.id])) && totals[t.id] !== '');

  const problem = aggregate
    ? !totalsOk && 'Enter each team’s total.'
    : card
      ? null
      : !sidesFull
        ? 'Pick every player.'
        : twice
          ? 'Someone’s on both sides.'
          : !winner
            ? 'Who won?'
            : !marginOk && 'The margin looks like 3&2, 1 UP or 2 UP.';

  const build = (): SavedMatch => {
    if (aggregate) return aggregateMatch(session, sides, Object.fromEntries(teams.map((t) => [t.id, Number(totals[t.id])])));
    if (card && existing) return { ...existing, result: card };
    return manualMatch(session, n, sides, winner === 'halved' ? null : winner, margin);
  };

  const run = async (work: () => Promise<string[]>) => {
    setBusy(true);
    setErrors([]);
    try {
      const found = await work();
      setErrors(found);
    } catch (err) {
      console.error(err);
      setErrors(["That didn't save. Check your connection and try again."]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 p-4 space-y-3 bg-white">
      <p className="text-sm font-semibold text-gray-800">
        {session.name}
        {!aggregate && ` · match ${n}`}
      </p>

      {aggregate ? (
        <div className="grid grid-cols-2 gap-3">
          {teams.map((t) => (
            <label key={t.id} className="block text-xs font-medium text-gray-500">
              {t.name} total ({session.basis === 'gross' ? 'gross' : 'net'})
              <input value={totals[t.id]} onChange={(e) => setTotals({ ...totals, [t.id]: e.target.value })} inputMode="numeric" className={`${inputClass} mt-1`} />
            </label>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {teams.map((t) => (
            <div key={t.id} className="space-y-2">
              <p className="text-xs font-medium" style={{ color: t.color }}>
                {t.name}
              </p>
              {Array.from({ length: size ?? 0 }, (_, i) => (
                <select
                  key={i}
                  aria-label={`${t.name} player ${i + 1}`}
                  value={sides[t.id]?.[i] ?? ''}
                  disabled={!!card}
                  onChange={(e) => setSides({ ...sides, [t.id]: Array.from({ length: size ?? 0 }, (_, j) => (j === i ? e.target.value : (sides[t.id]?.[j] ?? ''))) })}
                  className={inputClass}
                >
                  <option value="">Pick a player</option>
                  {t.memberIds.map((id) => (
                    <option key={id} value={id}>
                      {nameOf(id)}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          ))}
        </div>
      )}

      {!aggregate &&
        (card ? (
          <div className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2">
            From its scorecard: <span className="font-semibold">{card.winner ? `${teams.find((t) => t.id === card.winner)?.name} ${card.margin}` : 'halved'}</span>.{' '}
            <button onClick={() => setKeepCard(false)} className="text-xs font-medium text-red-600 hover:underline cursor-pointer">
              Remove the scorecard and type the result
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-gray-500">
              Winner
              <select value={winner} onChange={(e) => setWinner(e.target.value)} className={`${inputClass} mt-1`}>
                <option value="">Pick</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
                <option value="halved">Halved</option>
              </select>
            </label>
            {winner !== 'halved' && (
              <label className="block text-xs font-medium text-gray-500">
                Margin
                <input value={margin} onChange={(e) => setMargin(e.target.value)} list="ugl-margins" placeholder="3&2" className={`${inputClass} mt-1`} />
                <datalist id="ugl-margins">
                  {MARGINS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </label>
            )}
          </div>
        ))}

      {problem && (sidesFull || winner || aggregate) && <p className="text-xs text-gray-500">{problem}</p>}
      {errors.length > 0 && (
        <ul className="text-xs text-red-600 list-disc pl-4 space-y-0.5">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-3">
        <button onClick={() => void run(() => onSave(build()))} disabled={busy || !!problem} className={buttonClass}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} disabled={busy} className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer">
          Cancel
        </button>
        {onDelete && (
          <button
            onClick={() => confirm(`Delete ${session.name}${aggregate ? '' : ` match ${n}`}?`) && void run(onDelete)}
            disabled={busy}
            className="ml-auto text-sm text-gray-400 hover:text-red-500 cursor-pointer"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
