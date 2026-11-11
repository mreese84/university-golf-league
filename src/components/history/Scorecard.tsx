import { Fragment } from 'react';
import { useHistory } from '../../history/historyContext';
import { netScores, statusText, strokesOnHole } from '../../history/scoring';
import type { MatchInfo } from '../../history/stats';
import type { EventTeam } from '../../history/types';
import { TeamEmblem } from '../guide/Emblem';

interface Column {
  id: string;
  team: EventTeam;
  strokes: number;
  gross: (number | null)[];
  net: (number | null)[];
}

// Sum of a stretch of holes, or null if any of them has no score
function total(scores: (number | null)[], from: number, to: number) {
  const part = scores.slice(from, to);
  return part.every((s) => s != null) ? part.reduce<number>((a, b) => a + b!, 0) : null;
}

function StrokeDots({ count }: { count: number }) {
  if (count === 0) return null;
  // Plus handicaps give a stroke back: shown as a ring
  return (
    <span className="absolute top-1 right-1 flex gap-px" aria-label={`${count} stroke${Math.abs(count) === 1 ? '' : 's'}`}>
      {Array.from({ length: Math.abs(count) }, (_, i) => (
        <span key={i} className={`w-1 h-1 rounded-full ${count > 0 ? 'bg-gray-700' : 'border border-gray-700'}`} />
      ))}
    </span>
  );
}

function TotalRow({ label, columns, from, to, status }: { label: string; columns: Column[]; from: number; to: number; status?: string }) {
  return (
    <tr className="bg-gray-50 border-t border-gray-200 font-semibold text-gray-800">
      <td className="py-2 text-[11px] uppercase tracking-wider text-gray-500" colSpan={2}>
        {label}
      </td>
      {columns.map((c) => {
        const gross = total(c.gross, from, to);
        const net = total(c.net, from, to);
        return (
          <td key={c.id} className="py-2">
            {gross ?? '—'}
            {net != null && <span className="block text-[10px] font-medium text-gray-500">{net}</span>}
          </td>
        );
      })}
      <td className="py-2 text-xs">{status}</td>
    </tr>
  );
}

// Holes run down the page and players across, so 18 holes fit a phone without scrolling sideways
export default function Scorecard({ info }: { info: MatchInfo }) {
  const { firstName } = useHistory();
  const { match, round, teams, play } = info;
  if (!play || !match.scores || !round.par || !round.strokeIndex) return null;
  const par = round.par;
  const strokeIndex = round.strokeIndex;

  const columns: Column[] = teams.flatMap((team) =>
    match.sides[team.id].map((id) => {
      const row = match.scores!.find((r) => r.player === id)!;
      return { id, team, strokes: row.strokes, gross: row.gross, net: netScores(row, round) };
    }),
  );
  const teamById = (id: string | null) => teams.find((t) => t.id === id);
  const winner = teamById(play.winner);

  return (
    <div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full table-fixed text-center text-sm tabular-nums">
          <colgroup>
            <col className="w-9" />
            <col className="w-8" />
            {columns.map((c) => (
              <col key={c.id} />
            ))}
            <col className="w-[4.5rem]" />
          </colgroup>
          <thead>
            <tr className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <th className="py-2 font-medium">Hole</th>
              <th className="py-2 font-medium">Par</th>
              {columns.map((c) => (
                <th key={c.id} className="py-2 font-semibold normal-case tracking-normal" style={{ color: c.team.color }}>
                  <TeamEmblem team={c.team} className="w-3.5 h-3.5 mx-auto mb-0.5" />
                  <span className="block truncate px-0.5">{firstName(c.id)}</span>
                </th>
              ))}
              <th className="py-2 font-medium">Match</th>
            </tr>
          </thead>
          <tbody>
            {play.holes.map((hole, i) => {
              const leader = teamById(hole.leader);
              const holeWinner = hole.winner;
              return (
                <Fragment key={hole.hole}>
                  {i === 9 && <TotalRow label="Out" columns={columns} from={0} to={9} />}
                  <tr className={`border-t border-gray-100 ${hole.live ? '' : 'opacity-45'}`}>
                    <td className="py-1">
                      <span className="block font-semibold text-gray-800">{hole.hole}</span>
                      <span className="block text-[9px] text-gray-400" title="Stroke index">
                        hcp {strokeIndex[i]}
                      </span>
                    </td>
                    <td className="py-1 text-gray-500">{par[i]}</td>
                    {columns.map((c) => {
                      const gross = c.gross[i];
                      const net = c.net[i];
                      // Shade the score that won the hole for its side
                      const won = hole.live && holeWinner === c.team.id && net === hole.sideScores[c.team.id];
                      return (
                        <td key={c.id} className="py-1 px-0.5">
                          <div
                            className="relative mx-auto max-w-12 rounded-lg py-0.5"
                            style={won ? { background: `${c.team.color}29` } : undefined}
                          >
                            <StrokeDots count={strokesOnHole(c.strokes, strokeIndex[i])} />
                            <span className="block font-semibold text-gray-900">{gross ?? '–'}</span>
                            <span
                              className={`block text-[10px] ${won ? 'font-bold' : 'text-gray-400'}`}
                              style={won ? { color: c.team.color } : undefined}
                            >
                              {net ?? ' '}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                    <td className="py-1">
                      {!hole.live ? null : leader ? (
                        <span
                          className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold text-white whitespace-nowrap"
                          style={{ background: leader.color }}
                          title={`${leader.name} ${statusText(hole.up)}`}
                        >
                          <TeamEmblem team={leader} className="w-3 h-3" />
                          {statusText(hole.up)}
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-gray-500">AS</span>
                      )}
                    </td>
                  </tr>
                  {hole.hole === play.decidedHole && play.decidedHole < 18 && (
                    <tr className="border-t border-gray-200">
                      <td colSpan={columns.length + 3} className="py-1.5 text-xs font-semibold" style={{ color: winner?.color }}>
                        Match over · {winner ? `${winner.name} wins ${play.margin}` : 'Halved'}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            <TotalRow label="In" columns={columns} from={9} to={18} />
            <TotalRow label="Total" columns={columns} from={0} to={18} status={play.margin} />
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500 mt-2 px-1 leading-relaxed">
        {info.session.strokes === 'difference'
          ? 'Big number gross, small number net for the match. Dots mark the strokes given in the match (the difference from the lower handicap); '
          : 'Big number gross, small number net. Dots mark handicap strokes; '}
        shading marks the score that won the hole. Hcp is the hole's stroke index.
      </p>
    </div>
  );
}
