import { Fragment, type CSSProperties, type ReactNode } from 'react';
import type { GuideFlight, GuideGroup, GuideRound, GuideTeam, Member, PlayerGuide } from '../../types';
import Emblem, { EmblemDefs } from './Emblem';
import FootballCard from './FootballCard';
import { Card, Disclosure, Field, GlobeIcon, IconLink, MapPinIcon, Tbd, ZonedTime } from './parts';
import { airportTimeZone, tripTimeZone, zoneLabel } from './timeZones';
import { dateRange, fmt, parseDate } from './dates';
import { mapsUrl } from './links';
import NightlifeCard from './NightlifeCard';
import RoundWeather from './Weather';

// Handicap index with one decimal; plus handicaps are stored as negatives (+2.0 = -2)
const formatHandicap = (h: number) => (h < 0 ? `+${(-h).toFixed(1)}` : h.toFixed(1));


// FlightAware links need ICAO airline codes ("AA 1234" -> AAL1234)
const ICAO_AIRLINES: Record<string, string> = {
  AA: 'AAL', AS: 'ASA', B6: 'JBU', DL: 'DAL', F9: 'FFT', G4: 'AAY',
  HA: 'HAL', NK: 'NKS', SY: 'SCX', UA: 'UAL', WN: 'SWA',
};

// Pinned to the flight's date, so it never shows the same number on another day or route
function flightAwareUrl(f: GuideFlight) {
  const compact = f.flight.replace(/\s+/g, '').toUpperCase();
  const match = compact.match(/^([A-Z0-9]{2})(\d+)$/);
  const code = match ? `${ICAO_AIRLINES[match[1]] ?? match[1]}${match[2]}` : compact;
  return `https://www.flightaware.com/live/flight/${encodeURIComponent(code)}/history/${f.date.replaceAll('-', '')}`;
}

// FlightAware lists a dated flight roughly 36–47 hours before departure (seen Oct 2026),
// so only show its link once the flight should be there.
const TRACKING_HOURS_AHEAD = 30;

// Departure in the viewer's time zone; close enough to pick which link to show
function departureTime(f: GuideFlight) {
  const when = parseDate(f.date);
  const match = f.departs?.match(/^(\d{1,2}):(\d{2})\s*([AP])M$/i);
  if (match) {
    const hour = (Number(match[1]) % 12) + (match[3].toUpperCase() === 'P' ? 12 : 0);
    when.setHours(hour, Number(match[2]));
  } else {
    when.setHours(12);
  }
  return when;
}

function trackingUrl(f: GuideFlight) {
  const opens = departureTime(f);
  opens.setHours(opens.getHours() - TRACKING_HOURS_AHEAD);
  return new Date() < opens ? null : flightAwareUrl(f);
}

function Section({ id, title, action, children }: { id: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-16 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-(--guide)">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function EditButton({ onClick, label = 'Edit', className = 'text-(--guide)' }: { onClick: () => void; label?: string; className?: string }) {
  return (
    <button onClick={onClick} className={`text-xs font-medium hover:underline cursor-pointer shrink-0 ${className}`}>
      {label}
    </button>
  );
}

const Empty = ({ children }: { children: ReactNode }) => <Card className="text-sm text-gray-400">{children}</Card>;

// A player's name tag: a button that opens their profile when profiles are on, else plain text
function NameTag({
  onOpen,
  className,
  style,
  title,
  children,
}: {
  onOpen?: () => void;
  className: string;
  style?: CSSProperties;
  title?: string;
  children: ReactNode;
}) {
  if (!onOpen) {
    return (
      <span className={className} style={style} title={title}>
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${className} cursor-pointer transition hover:brightness-95 active:scale-95
                  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--guide)`}
      style={style}
      title={title}
    >
      {children}
    </button>
  );
}

// ── Main view ───────────────────────────────────────────────────

// The parts of the guide organizers edit, each with its own editor (src/next/chapter/guide)
export type GuideSection = 'details' | 'travel' | 'lodging' | 'format' | 'rounds' | 'football';

export interface GuideEditing {
  open: GuideSection | null; // the section being edited, shown in place of the section
  onOpen: (section: GuideSection | null) => void;
  render: (section: GuideSection) => ReactNode;
}

interface GuideViewProps {
  guide: PlayerGuide;
  members: Member[];
  attendeeCount: number;
  onSave?: (guide: PlayerGuide) => Promise<void>; // organizers: nightlife
  edit?: GuideEditing; // organizers: an Edit button on each section
  fireball?: ReactNode; // the live Fireball tracker, placed after Golf
  onOpenPlayer?: (memberId: string) => void; // makes player names open their profile
}

export default function GuideView({ guide, members, attendeeCount, onSave, edit, fireball, onOpenPlayer }: GuideViewProps) {
  // One section at a time: the Edit buttons hide while one is open
  const editing = (section: GuideSection) => edit?.open === section;
  const editButton = (section: GuideSection, label?: string, className?: string) =>
    edit && edit.open === null ? <EditButton onClick={() => edit.onOpen(section)} label={label} className={className} /> : null;
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? 'Unknown';
  const timeZone = tripTimeZone(guide);
  const teamOf = (id: string) => guide.teams.find((t) => t.memberIds.includes(id));
  const rosterSize = guide.teams.length ? Math.ceil(attendeeCount / guide.teams.length) : 0;

  const hasGame = !!(guide.football.away.trim() || guide.football.home.trim() || guide.football.espnEventId);
  const sections = [
    { id: 'travel', label: 'Travel', show: guide.flights.length > 0 || !!edit },
    { id: 'lodging', label: 'Lodging', show: guide.teams.length > 0 || !!edit },
    { id: 'golf', label: 'Golf', show: true },
    { id: 'fireball', label: 'Fireball', show: !!fireball },
    { id: 'football', label: 'Football', show: hasGame || !!edit },
    { id: 'nightlife', label: 'Nightlife', show: guide.nightlife.length > 0 || !!onSave },
  ].filter((s) => s.show);

  const allDates = guide.dates ?? [...guide.flights.map((f) => f.date), ...guide.rounds.map((r) => r.date)];
  const emblems = guide.teams.flatMap((t) => (t.emblem ? [t.emblem] : []));

  // Player pill in their team's color, with the team emblem so teams differ by shape too,
  // and their handicap. Casual rounds aren't part of the team competition, so their pills
  // stay neutral and leave the handicap off.
  const player = (id: string | null, key?: number, neutral = false) => {
    const pill = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap';
    if (!id) {
      return (
        <span key={key} className={`${pill} font-medium border border-dashed border-gray-300 text-gray-400`}>
          TBD
        </span>
      );
    }
    const team = neutral ? undefined : teamOf(id);
    const handicap = neutral ? undefined : guide.handicaps?.[id];
    return (
      <NameTag
        key={key}
        onOpen={onOpenPlayer && (() => onOpenPlayer(id))}
        className={`${pill} ${team ? 'text-white' : 'bg-gray-100 text-gray-700'}`}
        style={team ? { background: team.color } : undefined}
        title={team?.name}
      >
        {team?.emblem && <Emblem name={team.emblem} className="w-3.5 h-3.5 -ml-0.5 shrink-0" />}
        {nameOf(id)}
        {handicap !== undefined && (
          <span className="font-medium opacity-75 tabular-nums" title="Handicap">
            {formatHandicap(handicap)}
          </span>
        )}
      </NameTag>
    );
  };

  // Sides face each other: team A on the left (right-aligned), team B on the right
  const matchup = (group: GuideGroup, round: GuideRound) => {
    const slot = (i: number) => group.playerIds[i] ?? null;
    const vs = <span className="text-gray-400 text-xs">vs</span>;
    const left = (i: number) => <div className="justify-self-end">{player(slot(i))}</div>;
    const right = (i: number) => <div className="justify-self-start">{player(slot(i))}</div>;
    const grid = 'grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-1.5';
    if (round.matchType === 'fourball') {
      return (
        <div className={grid}>
          {left(0)}
          <div className="row-span-2">{vs}</div>
          {right(2)}
          {left(1)}
          {right(3)}
        </div>
      );
    }
    if (round.matchType === 'singles') {
      return (
        <div className={grid}>
          {left(0)}
          {vs}
          {right(1)}
          {left(2)}
          {vs}
          {right(3)}
        </div>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {group.playerIds.map((id, i) => player(id, i, true))}
      </div>
    );
  };

  const { format } = guide;
  const totalPoints = format.sessions.reduce((sum, s) => sum + s.points, 0);
  const pts = (n: number) => `${n} ${n === 1 ? 'point' : 'points'}`;

  // Competition rounds take the format's days in order: the first non-casual round gets
  // the "Day 1" sessions, the next gets "Day 2", and so on
  const sessionDays = [...new Set(format.sessions.map((s) => s.day))];
  const competitionRounds = guide.rounds.filter((r) => r.matchType !== 'casual');
  const sessionsFor = (round: GuideRound) => {
    const i = competitionRounds.indexOf(round);
    return i < 0 ? [] : format.sessions.filter((s) => s.day === sessionDays[i]);
  };
  const pointsAfterId = competitionRounds.at(-1)?.id ?? guide.rounds.at(-1)?.id;

  const pointsCard = format.sessions.length > 0 && (
    <Card>
      <h4 className="text-lg font-semibold text-gray-800">Points</h4>
      <table className="w-full text-sm mt-3">
        <tbody>
          {format.sessions.map((s, i) => (
            <tr key={i} className="border-b border-gray-50">
              <td className="py-1.5 text-gray-600">{s.day} · {s.name}</td>
              <td className="py-1.5 text-right font-medium text-gray-800">{s.points}</td>
            </tr>
          ))}
          <tr>
            <td className="pt-2 font-semibold text-gray-800">Total</td>
            <td className="pt-2 text-right font-semibold text-gray-800">{totalPoints}</td>
          </tr>
        </tbody>
      </table>
      <div className="rounded-xl bg-(--guide) text-(--guide-on) text-center py-3 mt-4 font-semibold">
        {format.pointsToWin} points wins
      </div>
    </Card>
  );

  return (
    <div
      className="space-y-8"
      style={{ '--guide': guide.theme.primary, '--guide-on': guide.theme.onPrimary } as CSSProperties}
    >
      <EmblemDefs />

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-(--guide) text-(--guide-on) px-6 py-7">
        <div className="absolute -right-3 -bottom-4 flex items-start gap-1 opacity-20 pointer-events-none">
          {emblems.includes('crescent') && <Emblem name="crescent" className="w-12 h-12 mt-2" />}
          {emblems.includes('palmetto') && <Emblem name="palmetto" className="w-32 h-32" />}
        </div>
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">Player's Guide</p>
          {editButton('details', 'Edit details', 'text-(--guide-on) opacity-80 hover:opacity-100 relative')}
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">{guide.title}</h2>
        <p className="text-sm mt-1 opacity-85">
          {guide.location}
          {allDates.length > 0 && ` · ${dateRange(allDates)}`}
        </p>
      </div>
      {editing('details') && edit!.render('details')}

      {/* Section menu */}
      <nav className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-gray-50/90 backdrop-blur">
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-gray-200
                         text-gray-600 hover:border-(--guide) hover:text-(--guide) transition-colors cursor-pointer"
            >
              {s.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Travel */}
      {(guide.flights.length > 0 || edit) && (
        <Section id="travel" title="Official UGL Flights" action={editButton('travel')}>
          {editing('travel') ? (
            edit!.render('travel')
          ) : guide.flights.length === 0 ? (
            <Empty>No flights yet.</Empty>
          ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {guide.flights.map((f) => {
              const trackUrl = trackingUrl(f);
              return (
                <Card key={f.direction}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        {f.direction === 'departure' ? 'Departure' : 'Return'}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {fmt(f.date, { weekday: 'long', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                    {trackUrl && (
                      <a
                        href={trackUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-(--guide) hover:underline shrink-0"
                      >
                        Track on FlightAware ↗
                      </a>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-gray-900 tracking-tight mt-3">{f.flight}</p>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {/* Flight times are local to each airport, like the ticket */}
                    <Field label="From">
                      {f.from ?? <Tbd />}
                      {f.departs && (
                        <span className="text-gray-500 font-normal">
                          {' · '}
                          <ZonedTime time={f.departs} zone={zoneLabel(airportTimeZone(f.from), f.date)} />
                        </span>
                      )}
                    </Field>
                    <Field label="To">
                      {f.to ?? <Tbd />}
                      {f.arrives && (
                        <span className="text-gray-500 font-normal">
                          {' · '}
                          <ZonedTime time={f.arrives} zone={zoneLabel(airportTimeZone(f.to), f.date)} />
                        </span>
                      )}
                    </Field>
                  </div>
                </Card>
              );
            })}
          </div>
          )}
        </Section>
      )}

      {/* Lodging */}
      {(guide.teams.length > 0 || edit) && (
        <Section id="lodging" title="Team Houses" action={editButton('lodging')}>
          {editing('lodging') ? (
            edit!.render('lodging')
          ) : guide.teams.length === 0 ? (
            <Empty>No teams yet.</Empty>
          ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {guide.teams.map((team: GuideTeam) => (
              <Card key={team.id} className="overflow-hidden !p-0">
                <div className="flex items-center gap-3 px-5 py-4 text-white" style={{ background: team.color }}>
                  {team.emblem && <Emblem name={team.emblem} className="w-9 h-9 shrink-0" />}
                  <p className="flex-1 min-w-0 font-semibold leading-tight">{team.house || team.name}</p>
                </div>
                <div className="p-5 space-y-4">
                  {team.address && (
                    <a
                      href={mapsUrl(team.address)}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-sm text-gray-700 hover:text-(--guide) group"
                    >
                      {team.address}
                      <span className="block text-xs font-medium text-(--guide) mt-0.5 group-hover:underline">
                        Open in Maps ↗
                      </span>
                    </a>
                  )}
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1.5">
                      Staying here{team.memberIds.length > 0 && ` (${team.memberIds.length})`}
                    </p>
                    {team.memberIds.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {[...team.memberIds]
                          .sort((a, b) => Number(b === team.captainId) - Number(a === team.captainId))
                          .map((id) => (
                            <NameTag
                              key={id}
                              onOpen={onOpenPlayer && (() => onOpenPlayer(id))}
                              className="text-xs px-2.5 py-1 rounded-full font-medium bg-gray-100 text-gray-700"
                            >
                              {nameOf(id)}
                              {id === team.captainId && (
                                <span
                                  className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full
                                             text-[9px] font-bold text-white align-[1px]"
                                  style={{ background: team.color }}
                                  title="Captain"
                                >
                                  C
                                </span>
                              )}
                            </NameTag>
                          ))}
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-1.5">
                          {Array.from({ length: rosterSize }, (_, i) => (
                            <span key={i} className="text-xs px-2.5 py-1 rounded-full border border-dashed border-gray-300 text-gray-400">
                              TBD
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Set once teams are drawn.</p>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
          )}
        </Section>
      )}

      {/* Golf: format overview, each day's card with its rules, then points */}
      <Section id="golf" title="Golf">
        {editing('format') ? (
          edit!.render('format')
        ) : (
          <Card>
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-lg font-semibold text-gray-800">{format.name || <Tbd>No format yet</Tbd>}</h4>
              {editButton('format', 'Edit format and points')}
            </div>
            {format.summary && <p className="text-sm text-gray-600 mt-1">{format.summary}</p>}
            {format.notes.map((note, i) => (
              <p key={i} className="text-sm text-gray-500 mt-2">{note}</p>
            ))}
          </Card>
        )}

        {edit && !editing('rounds') && (guide.rounds.length === 0 || edit.open === null) && (
          <div className="flex items-center justify-between gap-3 px-1">
            <p className="text-sm text-gray-400">{guide.rounds.length === 0 ? 'No rounds yet.' : ''}</p>
            {editButton('rounds', guide.rounds.length === 0 ? 'Add rounds' : 'Edit rounds and tee times')}
          </div>
        )}
        {editing('rounds') && edit!.render('rounds')}

        {!editing('rounds') && guide.rounds.map((round) => {
          const sessions = sessionsFor(round);
          return (
            <Fragment key={round.id}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-lg font-semibold text-gray-800">{round.course}</h4>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {fmt(round.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                      {round.fee && (
                        <span title="Estimated green and cart fee per player">
                          {' · '}
                          <span className="font-semibold text-gray-800">{round.fee}</span> with cart (est.)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {round.website && (
                      <IconLink href={round.website} label={`${round.course} website`}>
                        <GlobeIcon />
                      </IconLink>
                    )}
                    <IconLink
                      href={mapsUrl(`${round.course}, ${round.address ?? guide.location}`)}
                      label={`Directions to ${round.course}`}
                    >
                      <MapPinIcon />
                    </IconLink>
                  </div>
                </div>
                <span className="inline-block mt-2 text-xs font-medium px-2.5 py-1 rounded-full bg-(--guide)/8 text-(--guide)">
                  {round.label}
                </span>
                <ul className="mt-3 divide-y divide-gray-100">
                  {round.groups.map((group, i) => (
                    <li key={i} className="py-2.5 text-sm">
                      {group.playerIds.some(Boolean) ? (
                        <>
                          <p className="font-semibold text-gray-800">
                            <ZonedTime time={group.teeTime} zone={zoneLabel(timeZone, round.date)} />
                          </p>
                          <div className="mt-1.5">{matchup(group, round)}</div>
                        </>
                      ) : (
                        <div className="flex gap-4">
                          <p className="w-28 shrink-0 font-semibold text-gray-800">
                            <ZonedTime time={group.teeTime} zone={zoneLabel(timeZone, round.date)} />
                          </p>
                          <Tbd>Pairings TBD</Tbd>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                <RoundWeather
                  place={round.address ?? `${round.course}, ${guide.location}`}
                  date={round.date}
                  timeZone={timeZone}
                  teeTimes={round.groups.map((g) => g.teeTime)}
                />
                {sessions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <Disclosure
                      summary={
                        <span className="text-sm">
                          <span className="font-semibold text-gray-800 group-hover:text-(--guide)">Rules</span>
                          <span className="text-gray-400">
                            {' · '}
                            {pts(sessions.reduce((sum, x) => sum + x.points, 0))} available
                          </span>
                        </span>
                      }
                    >
                      <div className="pt-2 space-y-4">
                        {sessions.map((x, i) => (
                          <div key={i}>
                            <div className="flex items-baseline justify-between gap-3">
                              <p className="text-sm font-semibold text-gray-800">{x.name}</p>
                              <span className="text-xs font-medium text-gray-500 shrink-0">{pts(x.points)}</span>
                            </div>
                            <ul className="mt-1.5 space-y-1.5 text-sm text-gray-600 list-disc pl-5 marker:text-gray-300">
                              {x.rules.map((rule, j) => <li key={j}>{rule}</li>)}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </Disclosure>
                  </div>
                )}
              </Card>
              {round.id === pointsAfterId && pointsCard}
            </Fragment>
          );
        })}
        {guide.rounds.length === 0 && pointsCard}
      </Section>

      {fireball && (
        <Section id="fireball" title="Fireball">
          {fireball}
        </Section>
      )}

      {/* Football */}
      {(hasGame || edit) && (
        <Section id="football" title="Football" action={editButton('football')}>
          {editing('football') ? (
            edit!.render('football')
          ) : hasGame ? (
            <FootballCard football={guide.football} timeZone={timeZone} />
          ) : (
            <Empty>No game yet.</Empty>
          )}
        </Section>
      )}

      {/* Nightlife (admins can add and edit nights here) */}
      {(guide.nightlife.length > 0 || onSave) && (
        <Section id="nightlife" title="Nightlife">
          <NightlifeCard
            nights={guide.nightlife}
            location={guide.location}
            onSave={onSave && ((nightlife) => onSave({ ...guide, nightlife }))}
          />
        </Section>
      )}
    </div>
  );
}
