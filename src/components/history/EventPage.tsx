import { useHistory } from '../../history/historyContext';
import { eventLabel, formatPts } from '../../history/format';
import { matchInfo, standings } from '../../history/stats';
import type { EventRound, EventSession, HistoryEvent } from '../../history/types';
import { dateRange, fmt } from '../guide/dates';
import { Card } from '../guide/parts';
import { BackLink, MatchRow, NotFound, Scoreboard, SectionTitle } from './parts';

const roundDate = (round: EventRound) => fmt(round.date, { weekday: 'short', month: 'short', day: 'numeric' });

function SessionCard({ event, session }: { event: HistoryEvent; session: EventSession }) {
  const matches = event.matches.filter((m) => m.session === session.id);
  const pending = Array.from({ length: Math.max(0, session.matches - matches.length) }, (_, i) => i);
  const worth = session.matches > 1 ? `${formatPts(session.points)} per match` : formatPts(session.points);
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="font-semibold text-gray-800">{session.name}</h4>
        <p className="text-xs text-gray-500 shrink-0">{worth}</p>
      </div>
      <div className="mt-1 divide-y divide-gray-100">
        {matches.map((m) => (
          <MatchRow key={m.id} info={matchInfo(event, m)} />
        ))}
        {pending.map((i) => (
          <p key={i} className="py-3 text-center text-sm text-gray-400 italic">
            Not played yet
          </p>
        ))}
      </div>
    </Card>
  );
}

export default function EventPage({ eventId }: { eventId: string }) {
  const { findEvent, links } = useHistory();
  const event = findEvent(eventId);
  if (!event) {
    return (
      <NotFound>
        <BackLink to={links.events}>All events</BackLink>
      </NotFound>
    );
  }
  const casual = event.rounds.filter((r) => !event.sessions.some((s) => s.round === r.id));
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <BackLink to={links.events}>All events</BackLink>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            {eventLabel(event)} · {event.format}
          </p>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">{event.title}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {event.location} · {dateRange(event.dates)}
          </p>
        </div>
        <Scoreboard event={event} standings={standings(event)} />
      </div>

      {event.rounds
        .filter((r) => !casual.includes(r))
        .map((round) => (
          <section key={round.id} className="space-y-3">
            <SectionTitle>
              {round.label} · {roundDate(round)} · {round.course}
            </SectionTitle>
            {event.sessions
              .filter((s) => s.round === round.id)
              .map((s) => (
                <SessionCard key={s.id} event={event} session={s} />
              ))}
          </section>
        ))}

      {casual.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>Not for points</SectionTitle>
          {casual.map((round) => (
            <Card key={round.id} className="text-sm">
              <p className="font-semibold text-gray-800">{round.course}</p>
              <p className="text-gray-500 mt-0.5">
                {round.label} · {roundDate(round)}
              </p>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
