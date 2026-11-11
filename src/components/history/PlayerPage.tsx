import type { ReactNode } from 'react';
import { useHistory } from '../../history/historyContext';
import { eventLabel, formatHandicap, formatPoints, formatRecord } from '../../history/format';
import type { PlayerMatch, WinLoss } from '../../history/stats';
import BadgeShelf from '../badges/BadgeShelf';
import { Card } from '../guide/parts';
import { BackLink, Link, Names, NotFound, OutcomeBadge, SectionTitle } from './parts';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="!p-4 text-center">
      <p className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums tracking-tight whitespace-nowrap">{value}</p>
      <p className="text-[11px] uppercase tracking-wider text-gray-400 mt-0.5">{label}</p>
    </Card>
  );
}

// A small table of records: one row per format, partner or opponent
function RecordTable({ title, rows }: { title: string; rows: { key: string; label: ReactNode; record: WinLoss; points?: number }[] }) {
  if (rows.length === 0) return null;
  const showPoints = rows.some((r) => r.points !== undefined);
  return (
    <Card>
      <h4 className="font-semibold text-gray-800">{title}</h4>
      <table className="w-full text-sm mt-2">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-gray-400">
            <th className="py-1 text-left font-normal" />
            <th className="py-1 w-16 text-right font-normal">W-L-H</th>
            {showPoints && <th className="py-1 w-12 text-right font-normal">Pts</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-gray-50">
              <td className="py-1.5 text-gray-700">{r.label}</td>
              <td className="py-1.5 text-right tabular-nums text-gray-700">{formatRecord(r.record)}</td>
              {showPoints && (
                <td className="py-1.5 text-right tabular-nums font-medium text-gray-800">
                  {r.points !== undefined ? formatPoints(r.points) : ''}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function MatchLine({ m }: { m: PlayerMatch }) {
  const { links } = useHistory();
  return (
    <Link
      to={links.match(m.event.id, m.match.id)}
      className="flex items-center gap-3 py-3 -mx-5 px-5 hover:bg-gray-50 transition-colors"
    >
      <OutcomeBadge outcome={m.outcome} />
      <span className="flex-1 min-w-0 text-sm">
        <span className="block font-medium text-gray-800">
          {m.round.label} · {m.session.name}
        </span>
        <span className="block text-gray-500">
          {m.partners.length > 0 && (
            <>
              with <Names ids={m.partners} />{' '}
            </>
          )}
          vs <Names ids={m.opponents} />
        </span>
      </span>
      <span className="text-sm font-semibold text-gray-700 shrink-0">
        {m.match.result.margin}
      </span>
    </Link>
  );
}

// One player's record. History follows individuals, so each year's team is named but there are no
// team logos here.
export default function PlayerPage({ playerId }: { playerId: string }) {
  const { stats, badges, nameOf, photoOf, links } = useHistory();
  const s = stats.get(playerId);
  if (!s) {
    return (
      <NotFound>
        <BackLink to={links.players}>All players</BackLink>
      </NotFound>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink to={links.players}>All players</BackLink>
      <div>
        <div className="flex items-center gap-4">
          {/* The whole portrait: the frame matches the photos' 3:4 shape */}
          {photoOf(s.id) && (
            <img
              src={photoOf(s.id)!}
              alt={nameOf(s.id)}
              className="w-24 aspect-[3/4] shrink-0 rounded-2xl object-cover bg-gray-100 shadow-sm"
            />
          )}
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{nameOf(s.id)}</h2>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {s.events.map((e) => (
            <span
              key={e.event.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-white border border-gray-200 px-3 py-1 text-xs text-gray-700"
            >
              <span className="font-semibold">
                {eventLabel(e.event)} · {e.event.year}
              </span>
              {e.team.name.replace(/^Team /, '')}
              {e.captain && ' (captain)'} · hcp {formatHandicap(e.handicap)}
            </span>
          ))}
        </div>
        {badges.has(s.id) && (
          <div className="mt-3">
            <BadgeShelf badges={badges.get(s.id)!} href={links.badges} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="W-L-H" value={formatRecord(s.record)} />
        <Stat label="Points" value={formatPoints(s.points)} />
        <Stat label={s.events.length === 1 ? 'Event' : 'Events'} value={String(s.events.length)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <RecordTable
          title="By format"
          rows={s.byFormat.map((f) => ({ key: f.format, label: f.name, record: f.record, points: f.points }))}
        />
        <RecordTable
          title="With partners"
          rows={s.partners.map((p) => ({ key: p.id, label: <Names ids={[p.id]} link />, record: p.record, points: p.points }))}
        />
        <RecordTable
          title="Head to head"
          rows={s.opponents.map((o) => ({ key: o.id, label: <Names ids={[o.id]} link />, record: o.record }))}
        />
      </div>

      <section className="space-y-3">
        <SectionTitle>Matches</SectionTitle>
        {s.events.map((e) => {
          const matches = s.matches.filter((m) => m.event === e.event);
          return (
            <Card key={e.event.id}>
              <h4 className="font-semibold text-gray-800">
                {eventLabel(e.event)} · {e.event.location}
              </h4>
              <p className="text-xs text-gray-500">
                {formatRecord(e.record)} · {formatPoints(e.points)} {e.points === 1 ? 'point' : 'points'}
              </p>
              <div className="mt-1 divide-y divide-gray-100">
                {matches.length > 0 ? (
                  matches.map((m) => <MatchLine key={m.match.id} m={m} />)
                ) : (
                  <p className="py-3 text-sm text-gray-400 italic">No matches yet</p>
                )}
              </div>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
