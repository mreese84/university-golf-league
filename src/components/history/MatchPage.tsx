import { findEvent } from '../../history/data';
import { grossTotal, netTotal } from '../../history/scoring';
import { eventLabel, formatHandicap, formatPts } from '../../history/format';
import { matchInfo, type MatchInfo } from '../../history/stats';
import { eventPath, historyPath } from '../../routes';
import { fmt } from '../guide/dates';
import Emblem from '../guide/Emblem';
import { Card } from '../guide/parts';
import { BackLink, Names, NotFound } from './parts';
import Scorecard from './Scorecard';

// Each player's 18-hole score that day (net or gross, as the aggregate counts them), from any
// scorecard in the same round. Net only comes from cards with full handicaps.
function roundTotals(info: MatchInfo, basis: 'net' | 'gross') {
  const totals = new Map<string, number>();
  for (const m of info.event.matches) {
    const session = info.event.sessions.find((s) => s.id === m.session);
    if (session?.round !== info.round.id) continue;
    if (basis === 'net' && session.strokes === 'difference') continue; // not true nets
    for (const row of m.scores ?? []) {
      const total = basis === 'gross' ? grossTotal(row) : netTotal(row);
      if (total != null) totals.set(row.player, total);
    }
  }
  return totals;
}

function ResultBanner({ info }: { info: MatchInfo }) {
  const { match, teams, session } = info;
  const winner = teams.find((t) => t.id === match.result.winner);
  const points = Object.entries(match.result.points)
    .filter(([, p]) => p > 0)
    .map(([team, p]) => `${formatPts(p)} to ${teams.find((t) => t.id === team)?.name.replace(/^Team /, '')}`)
    .join(' · ');
  const headline = winner
    ? `${winner.name} wins ${session.scoring === 'aggregate' ? `by ${match.result.margin}` : match.result.margin}`
    : 'Halved';
  return (
    <div
      className="relative overflow-hidden rounded-2xl px-5 py-4 text-white"
      style={{ background: winner?.color ?? '#4b5563' }}
    >
      {winner?.emblem && (
        <Emblem name={winner.emblem} className="absolute -right-2 -bottom-3 w-20 h-20 opacity-20 pointer-events-none" />
      )}
      <p className="text-xl font-bold tracking-tight">{headline}</p>
      <p className="text-sm opacity-80 mt-0.5">{points}</p>
    </div>
  );
}

function Sides({ info }: { info: MatchInfo }) {
  const { match, teams, event, session } = info;
  const basis = session.basis ?? 'net';
  const totals = session.scoring === 'aggregate' ? roundTotals(info, basis) : null;
  return (
    <div className="grid grid-cols-2 gap-3">
      {teams.map((team) => (
        <Card key={team.id} className="!p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: team.color }}>
            {team.emblem && <Emblem name={team.emblem} className="w-4 h-4 shrink-0" />}
            {team.name}
          </p>
          <ul className="mt-2 space-y-2">
            {match.sides[team.id].map((id) => {
              const row = match.scores?.find((r) => r.player === id);
              const total = totals?.get(id);
              return (
                <li key={id} className="text-sm leading-tight">
                  <span className="font-medium text-gray-800">
                    <Names ids={[id]} link />
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    {formatHandicap(event.handicaps[id])} index
                    {row && ` · ${row.strokes} stroke${row.strokes === 1 ? '' : 's'}`}
                    {total !== undefined && ` · ${total} ${basis}`}
                  </span>
                </li>
              );
            })}
          </ul>
          {match.totals && (
            <p className="mt-3 pt-3 border-t border-gray-100 text-sm font-semibold text-gray-800">
              {match.totals[team.id]} {basis} total
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}

export default function MatchPage({ eventId, matchId }: { eventId: string; matchId: string }) {
  const event = findEvent(eventId);
  const match = event?.matches.find((m) => m.id === matchId);
  if (!event || !match) {
    return (
      <NotFound>
        <BackLink to={event ? eventPath(event.id) : historyPath()}>{event ? event.title : 'All events'}</BackLink>
      </NotFound>
    );
  }
  const info = matchInfo(event, match);
  const { session, round } = info;
  const title = session.matches > 1 ? `${session.name} · Match ${match.match}` : session.name;

  return (
    <div className="space-y-5">
      <BackLink to={eventPath(event.id)}>{event.title}</BackLink>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          {eventLabel(event)} · {round.label} · {fmt(round.date, { weekday: 'short', month: 'short', day: 'numeric' })}
        </p>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{round.course}</p>
      </div>
      <ResultBanner info={info} />
      <Sides info={info} />
      {session.scoring === 'match' &&
        (info.play ? (
          <Scorecard info={info} />
        ) : (
          <Card className="text-center text-sm text-gray-500">No hole-by-hole scores were entered for this match.</Card>
        ))}
    </div>
  );
}
