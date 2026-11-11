import { useHistory } from '../../history/historyContext';
import { eventLabel, formatPoints, formatRecord } from '../../history/format';
import BadgeArt from '../badges/BadgeArt';
import { badgeDef } from '../../history/badges';
import { Card } from '../guide/parts';
import { Link, PlayerAvatar } from './parts';

// Individual records, so no team logos: photo, name and record
export default function PlayersPage() {
  const { data, stats, badges, nameOf, links } = useHistory();
  const players = data.players
    .map((p) => stats.get(p.id))
    .filter((s) => s !== undefined)
    .sort((a, b) => b.points - a.points || b.record.w - a.record.w || nameOf(a.id).localeCompare(nameOf(b.id)));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Players</h2>
        <p className="text-sm text-gray-500 mt-1">Career records in match play, most points first.</p>
      </div>
      <Card className="!py-2">
        <div className="flex items-center gap-3 py-2 text-[11px] uppercase tracking-wider text-gray-400">
          <span className="flex-1">Player</span>
          <span className="w-14 text-right">W-L-H</span>
          <span className="w-10 text-right">Pts</span>
        </div>
        <div className="divide-y divide-gray-100">
          {players.map((s) => {
            return (
              <Link
                key={s.id}
                to={links.player(s.id)}
                className="flex items-center gap-3 py-3 -mx-5 px-5 hover:bg-gray-50 transition-colors"
              >
                <PlayerAvatar id={s.id} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-gray-800 truncate">{nameOf(s.id)}</span>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="truncate mr-0.5">{s.events.map((e) => eventLabel(e.event)).join(', ')}</span>
                    {(badges.get(s.id) ?? []).map((b) => (
                      <BadgeArt key={b.id} id={b.id} className="w-4 h-4" count={b.moments.length} title={badgeDef(b.id).name} />
                    ))}
                  </span>
                </span>
                <span className="w-14 text-right text-sm tabular-nums text-gray-700">{formatRecord(s.record)}</span>
                <span className="w-10 text-right text-sm font-semibold tabular-nums text-gray-900">
                  {formatPoints(s.points)}
                </span>
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
