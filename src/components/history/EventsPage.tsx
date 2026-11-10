import { useHistory } from '../../history/historyContext';
import { eventLabel, formatPts } from '../../history/format';
import { standings } from '../../history/stats';
import type { HistoryEvent } from '../../history/types';
import { dateRange } from '../guide/dates';
import { Card } from '../guide/parts';
import { Link, Names, Scoreboard, TeamMark } from './parts';

function EventCard({ event }: { event: HistoryEvent }) {
  const { links } = useHistory();
  const competitionRounds = new Set(event.sessions.map((s) => s.round));
  return (
    <Card className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          {eventLabel(event)} · {event.year}
        </p>
        <h2 className="text-xl font-bold text-gray-900 tracking-tight mt-0.5">{event.title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {event.location} · {dateRange(event.dates)}
        </p>
      </div>

      <Scoreboard event={event} standings={standings(event)} />

      <dl className="grid gap-4 text-sm">
        <div>
          <dt className="text-xs text-gray-400 uppercase tracking-wider">Courses</dt>
          <dd className="mt-1 space-y-0.5">
            {event.rounds.map((r) => (
              <p key={r.id} className={competitionRounds.has(r.id) ? 'text-gray-800' : 'text-gray-500'}>
                <span className="text-gray-500">{r.label}:</span> {r.course}
              </p>
            ))}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-400 uppercase tracking-wider">Format · {event.format}</dt>
          <dd className="mt-1 space-y-0.5">
            {event.sessions.map((s) => (
              <p key={s.id} className="text-gray-800">
                <span className="text-gray-500">{event.rounds.find((r) => r.id === s.round)?.label}:</span> {s.name}{' '}
                <span className="text-gray-500">({formatPts(s.points * s.matches)})</span>
              </p>
            ))}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-400 uppercase tracking-wider">Teams</dt>
          <dd className="mt-2 grid grid-cols-2 gap-3">
            {event.teams.map((team) => (
              <div key={team.id}>
                <p className="flex items-center gap-1.5 font-semibold" style={{ color: team.color }}>
                  <TeamMark team={team} className="w-5 h-5" />
                  {team.name.replace(/^Team /, '')}
                </p>
                <ul className="mt-1 space-y-0.5 text-gray-700">
                  {team.players.map((id) => (
                    <li key={id} className="truncate">
                      <Names ids={[id]} link />
                      {team.captain === id && <span className="text-gray-400"> (C)</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </dd>
        </div>
      </dl>

      <Link
        to={links.event(event.id)}
        className="block text-center rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2.5 transition-colors"
      >
        See all {event.matches.length > 0 ? `${event.matches.length} ` : ''}matches
      </Link>
    </Card>
  );
}

export default function EventsPage() {
  const { data } = useHistory();
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">History</h2>
        <p className="text-sm text-gray-500 mt-1">Every competition, newest first.</p>
      </div>
      {data.events.length === 0 ? (
        <Card className="text-center text-sm text-gray-500 py-8">Results appear here after the first competition.</Card>
      ) : (
        data.events.map((event) => <EventCard key={event.id} event={event} />)
      )}
    </div>
  );
}
