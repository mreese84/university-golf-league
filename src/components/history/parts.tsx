import { Fragment, type ReactNode } from 'react';
import { followLink } from '../../routes';
import { useHistory } from '../../history/historyContext';
import { formatPoints } from '../../history/format';
import type { MatchInfo, Outcome, Standings } from '../../history/stats';
import type { EventTeam, HistoryEvent } from '../../history/types';
import Emblem from '../guide/Emblem';
import { Card } from '../guide/parts';

// In-app link (Cmd/Ctrl-click still opens a new tab)
export function Link({ to, className = '', children }: { to: string; className?: string; children: ReactNode }) {
  return (
    <a href={to} onClick={(e) => followLink(e, to)} className={className}>
      {children}
    </a>
  );
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-block text-sm font-medium text-green-700 hover:text-green-800">
      ← {children}
    </Link>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wider text-green-700">{children}</h3>;
}

// Team emblem on a circle of the team color
export function TeamMark({ team, className = 'w-6 h-6' }: { team: EventTeam; className?: string }) {
  return (
    <span
      className={`${className} shrink-0 inline-flex items-center justify-center rounded-full text-white text-xs font-bold`}
      style={{ background: team.color }}
      title={team.name}
    >
      {team.emblem ? <Emblem name={team.emblem} className="w-[70%] h-[70%]" /> : team.name.replace(/^Team /, '')[0]}
    </span>
  );
}

// A player's profile photo in a circle, or their initials. History follows individuals, so there's
// no team badge here (event and match pages keep each year's teams).
export function PlayerAvatar({ id, className = 'w-11 h-11' }: { id: string; className?: string }) {
  const { photoOf, nameOf } = useHistory();
  const photo = photoOf(id);
  if (!photo) {
    const initials = nameOf(id).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    return (
      <span className={`${className} shrink-0 rounded-full bg-gray-100 text-gray-500 text-sm font-semibold inline-flex items-center justify-center`}>
        {initials}
      </span>
    );
  }
  return (
    <span className={`${className} relative shrink-0`}>
      <img src={photo} alt="" loading="lazy" className="w-full h-full rounded-full object-cover object-[50%_20%] bg-gray-100" />
    </span>
  );
}

// "Jeff Siarto & Adam Cowdin"; links to profiles unless it sits inside another link.
// Short names ("Jeff S.") on phones when space is tight.
export function Names({ ids, link = false, short = false }: { ids: string[]; link?: boolean; short?: boolean }) {
  const { nameOf, shortName, links } = useHistory();
  return (
    <>
      {ids.map((id, i) => {
        const name = short ? (
          <>
            <span className="sm:hidden">{shortName(id)}</span>
            <span className="hidden sm:inline">{nameOf(id)}</span>
          </>
        ) : (
          nameOf(id)
        );
        return (
          <Fragment key={id}>
            {i > 0 && ' & '}
            {link ? (
              <Link to={links.player(id)} className="hover:underline">
                {name}
              </Link>
            ) : (
              name
            )}
          </Fragment>
        );
      })}
    </>
  );
}

const outcomeStyles: Record<Outcome, string> = {
  W: 'bg-green-100 text-green-700',
  L: 'bg-red-50 text-red-600',
  H: 'bg-gray-100 text-gray-600',
};

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const label = { W: 'Won', L: 'Lost', H: 'Halved' }[outcome];
  return (
    <span
      className={`w-7 h-7 shrink-0 inline-flex items-center justify-center rounded-full text-xs font-bold ${outcomeStyles[outcome]}`}
      title={label}
      aria-label={label}
    >
      {outcome}
    </span>
  );
}

// The match result as a pill: winner's emblem and color with the margin, or gray for halved
export function MarginPill({ info }: { info: MatchInfo }) {
  const { winner, margin } = info.match.result;
  const team = info.teams.find((t) => t.id === winner);
  if (!team) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 whitespace-nowrap">
        {margin === 'AS' ? 'Halved' : margin}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-white whitespace-nowrap"
      style={{ background: team.color }}
      title={`${team.name} won`}
    >
      {team.emblem && <Emblem name={team.emblem} className="w-3.5 h-3.5 -ml-0.5" />}
      {margin}
    </span>
  );
}

// One match in a list, the sides facing each other with the result between them
export function MatchRow({ info }: { info: MatchInfo }) {
  const { links } = useHistory();
  const { event, match, teams, session } = info;
  const [a, b] = teams;
  const winner = match.result.winner;
  const sideClass = (team: EventTeam) =>
    winner === null ? 'text-gray-800' : winner === team.id ? 'font-semibold' : 'text-gray-500';
  const side = (team: EventTeam) =>
    session.scoring === 'aggregate' ? (
      <>
        <span className="block">{team.name.replace(/^Team /, '')}</span>
        {match.totals && (
          <span className="block text-xs text-gray-500 font-normal">
            {match.totals[team.id]} {session.basis ?? 'net'}
          </span>
        )}
      </>
    ) : (
      match.sides[team.id].map((id) => (
        <span key={id} className="block">
          <Names ids={[id]} short />
        </span>
      ))
    );
  return (
    <Link
      to={links.match(event.id, match.id)}
      className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 py-3 -mx-5 px-5 hover:bg-gray-50 transition-colors"
    >
      <div className={`text-right text-sm leading-snug ${sideClass(a)}`} style={winner === a.id ? { color: a.color } : undefined}>
        {side(a)}
      </div>
      <MarginPill info={info} />
      <div className={`text-left text-sm leading-snug ${sideClass(b)}`} style={winner === b.id ? { color: b.color } : undefined}>
        {side(b)}
      </div>
    </Link>
  );
}

// Each team's points, side by side in team colors
export function Scoreboard({ event, standings }: { event: HistoryEvent; standings: Standings }) {
  const { points, winner, tied, complete, played, expected, toWin } = standings;
  const [a, b] = event.teams.map((t) => points[t.id]).sort((x, y) => y - x);
  const status = winner
    ? `${event.teams.find((t) => t.id === winner)!.name} ${complete ? 'won' : 'clinched'} ${formatPoints(a)}–${formatPoints(b)}`
    : tied
      ? 'Tied'
      : played === 0
        ? `${formatPoints(toWin)} points wins`
        : `In progress · ${played} of ${expected} matches played`;
  return (
    <div>
      <div className="grid grid-cols-2 gap-px rounded-2xl overflow-hidden">
        {event.teams.slice(0, 2).map((team) => (
          <div key={team.id} className="relative px-4 py-4 text-white overflow-hidden" style={{ background: team.color }}>
            {team.emblem && (
              <Emblem name={team.emblem} className="absolute -right-3 -bottom-3 w-20 h-20 opacity-15 pointer-events-none" />
            )}
            <p className="text-sm font-semibold leading-tight">{team.name}</p>
            <p className="text-4xl font-bold tabular-nums tracking-tight mt-1">{formatPoints(points[team.id])}</p>
            {winner === team.id && complete && (
              <p className="text-[11px] font-semibold uppercase tracking-wider mt-1 opacity-80">Champions</p>
            )}
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-gray-500 mt-2">{status}</p>
    </div>
  );
}

export function NotFound({ children }: { children: ReactNode }) {
  return (
    <Card className="text-center space-y-2 py-8">
      <p className="font-semibold text-gray-800">That page isn't here</p>
      <div className="text-sm text-gray-500">{children}</div>
    </Card>
  );
}
