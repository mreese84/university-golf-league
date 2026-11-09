import { history, nameOf, stats } from '../../history/data';
import { eventLabel, formatPoints, formatRecord } from '../../history/format';
import { playerPath } from '../../routes';
import { Card } from '../guide/parts';
import { Link, PlayerAvatar } from './parts';

export default function PlayersPage() {
  const players = history.players
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
            const latest = s.events[0];
            return (
              <Link
                key={s.id}
                to={playerPath(s.id)}
                className="flex items-center gap-3 py-3 -mx-5 px-5 hover:bg-gray-50 transition-colors"
              >
                <PlayerAvatar id={s.id} team={latest?.team} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-gray-800 truncate">{nameOf(s.id)}</span>
                  <span className="block text-xs text-gray-500 truncate">
                    {s.events.map((e) => eventLabel(e.event)).join(', ')}
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
