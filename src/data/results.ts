// A trip's results (Phase 1, step 12): matches typed in by hand, or read from Squabbit's scorecard
// exports. Each match is stored as the history pages read it (src/history/types.ts), and every save
// is checked as the history would be first (checkResults). Plain functions, tested without the
// database.

import { historyFromChapter, type ChapterTripRecord } from './history';
import { netScores, playMatch } from '../history/scoring';
import type { HistoryMatch, ScoreRow } from '../history/types';
import { validateHistory } from '../history/validate';
import type { GuideContent, Match, Person, Trip, TripRound, TripSession } from './types';

export type SavedMatch = Match & { id: string };

export const matchIdFor = (session: string, n: number) => `${session}-${n}`;

// The winner gets the session's points for the match; a halved match splits them
export const pointsFor = (teamIds: string[], winner: string | null, points: number) =>
  Object.fromEntries(teamIds.map((t) => [t, winner === null ? points / 2 : winner === t ? points : 0]));

// Players a side has in one match of the session: two in fourball, one in singles, the whole team
// in a team total
export function sideSize(session: TripSession, round: TripRound | undefined) {
  if (session.scoring === 'aggregate') return null;
  return round?.matchType === 'singles' ? 1 : 2;
}

// ── Typed in by hand ─────────────────────────────────────────────

// A match play result: who won (null for halved) and by how much ("3&2", "1 UP"; "AS" when halved)
export function manualMatch(session: TripSession, n: number, sides: Record<string, string[]>, winner: string | null, margin: string): SavedMatch {
  return {
    id: matchIdFor(session.id, n),
    session: session.id,
    match: n,
    sides,
    result: { winner, margin: winner === null ? 'AS' : margin.trim().toUpperCase().replace(/\s*&\s*/, '&'), points: pointsFor(Object.keys(sides), winner, session.points) },
  };
}

// A team total: each team's combined score; lowest wins
export function aggregateMatch(session: TripSession, sides: Record<string, string[]>, totals: Record<string, number>): SavedMatch {
  const [a, b] = Object.keys(sides);
  const diff = Math.abs(totals[a] - totals[b]);
  const winner = totals[a] < totals[b] ? a : totals[b] < totals[a] ? b : null;
  return {
    id: matchIdFor(session.id, 1),
    session: session.id,
    match: 1,
    sides,
    totals,
    result: { winner, margin: winner ? `${diff} stroke${diff === 1 ? '' : 's'}` : 'Tied', points: pointsFor([a, b], winner, session.points) },
  };
}

// The result a scorecard gives, for a match play match that has one
export function resultFromCard(session: TripSession, match: Omit<SavedMatch, 'result'>, round: TripRound | undefined) {
  const play = playMatch({ ...match, result: { winner: null, margin: '', points: {} } } as HistoryMatch, round);
  return play && { winner: play.winner, margin: play.margin, points: pointsFor(Object.keys(match.sides), play.winner, session.points) };
}

// ── Checks ───────────────────────────────────────────────────────

// The trip's history with these matches, put through the history's own checks. Nothing is saved
// unless this comes back empty.
export function checkResults(
  trip: Trip & { id: string },
  guide: GuideContent,
  handicaps: Record<string, number>,
  matches: SavedMatch[],
  people: { id: string; person: Person }[],
): string[] {
  if (!trip.dates) return ["The trip needs its first and last day first: set them in the guide's trip details."];
  const record: ChapterTripRecord = { id: trip.id, trip: { ...trip, competition: true }, guide, handicaps, matches };
  // Messages start with the trip's ID ("2027-austin: needs a handicap for …"); the page is already the trip's
  return validateHistory(historyFromChapter(people, [record])).map((e) => e.replace(new RegExp(`^${trip.id}:? `), ''));
}

// ── Squabbit ─────────────────────────────────────────────────────

export interface SquabbitPlayer {
  name: string;
  index: number | null; // handicap index
  strokes: number; // playing handicap for the round
  gross: (number | null)[];
  netToPar: (number | null)[]; // Squabbit's net score against par, per hole
}

// One group's scorecard export (CSV)
export interface SquabbitExport {
  file: string;
  course: string;
  teeTime: Date;
  par: number[];
  strokeIndex: number[];
  players: SquabbitPlayer[];
}

// One CSV line into cells ("Aiken Golf Club, The" stays one cell)
function cells(line: string) {
  const out: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      out.push(cell);
      cell = '';
    } else cell += c;
  }
  out.push(cell);
  return out.map((s) => s.trim());
}

const toPar = (s: string) => (s === 'E' ? 0 : s === '' || s === '-' ? null : Number(s));

// Reads one export: the course and tee time on the first line, a heading row with Hole 1 to Hole
// 18 and Handicap, the S.I. and Par rows, then each player's row (gross scores, handicap index)
// followed by their game row (playing handicap, net score against par). Throws with what's wrong.
export function parseSquabbit(file: string, text: string): SquabbitExport {
  const rows = text.split(/\r?\n/).filter((l) => l.trim()).map(cells);
  const fail = (why: string): never => {
    throw new Error(`${file}: ${why}`);
  };
  const [course, when] = rows[0] ?? [];
  const teeTime = new Date(when ?? '');
  if (!course || Number.isNaN(teeTime.getTime())) fail('the first line should be the course and tee time');

  const header = rows.find((r) => r.includes('Hole 1')) ?? fail('no "Hole 1 … Hole 18" heading row');
  const holeCols = Array.from({ length: 18 }, (_, i) => header.indexOf(`Hole ${i + 1}`));
  if (holeCols.includes(-1)) fail('the heading row should have Hole 1 through Hole 18');
  const handicapCol = header.indexOf('Handicap');
  const holes = (row: string[]) => holeCols.map((c) => row[c] ?? '');

  const siRow = rows.find((r) => r[0] === 'S.I.') ?? fail('no S.I. row');
  const parRow = rows.find((r) => r[0] === 'Par') ?? fail('no Par row');
  const strokeIndex = holes(siRow).map(Number);
  const par = holes(parRow).map(Number);

  const players: SquabbitPlayer[] = [];
  for (let i = rows.indexOf(parRow) + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;
    const game = rows[i + 1];
    if (!game || game[0]) fail(`${row[0]} has no game row (playing handicap and net scores) under it`);
    const strokes = Number(game[handicapCol]);
    if (!Number.isFinite(strokes)) fail(`${row[0]} has no playing handicap`);
    players.push({
      name: row[0],
      index: row[handicapCol] ? Number(row[handicapCol]) : null,
      strokes: Math.round(strokes),
      gross: holes(row).map((g) => (g === '' || g === '-' ? null : Number(g))),
      netToPar: holes(game).map(toPar),
    });
  }
  return { file, course, teeTime, par, strokeIndex, players };
}

const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// The guide's groups suggest who played whom in singles: slots 1 and 2 play each other, and 3 and 4
export function suggestedPairs(round: TripRound | undefined, ids: string[]): [string, string][] {
  const group = round?.groups.find((g) => ids.every((id) => g.playerIds.includes(id)));
  if (!group) return [];
  const slot = (i: number) => group.playerIds[i] ?? null;
  return [
    [slot(0), slot(1)],
    [slot(2), slot(3)],
  ].filter((p): p is [string, string] => !!p[0] && !!p[1] && ids.includes(p[0]) && ids.includes(p[1]));
}

export interface SquabbitImport {
  matches: SavedMatch[]; // the session's matches, numbered in tee-time order
  course: { par: number[]; strokeIndex: number[] } | null; // to add to the round, when it has none
  handicaps: Record<string, number>; // indexes from the exports, for players with none for the trip
  problems: string[];
}

// The session's matches from its groups' exports. Players are found by name (or the names
// map, for one Squabbit spells differently) and sides by the guide's teams; a group is one match
// in fourball, and its pairs (who played whom) in singles. A gross team total adds up everyone's
// 18 holes. Our net scores must agree with Squabbit's hole by hole, or the strokes went on
// different holes.
export function importSquabbit({
  session,
  round,
  teams,
  people,
  names = {},
  handicaps,
  exports: unsorted,
  pairs,
}: {
  session: TripSession;
  round: TripRound;
  teams: { id: string; name: string; memberIds: string[] }[];
  people: { id: string; name: string }[];
  names?: Record<string, string>; // a Squabbit name -> person ID
  handicaps: Record<string, number>;
  exports: SquabbitExport[];
  pairs: [string, string][]; // singles: who played whom
}): SquabbitImport {
  const exports = [...unsorted].sort((a, b) => a.teeTime.getTime() - b.teeTime.getTime());
  const problems: string[] = [];
  const byName = new Map(people.map((p) => [p.name.trim().toLowerCase(), p.id]));
  const idOf = (name: string) => names[name] ?? byName.get(name.trim().toLowerCase());
  const teamOf = (id: string) => teams.find((t) => t.memberIds.includes(id));
  const none: SquabbitImport = { matches: [], course: null, handicaps: {}, problems };

  // The course: the same par and stroke index in every export, and the round's if it has them
  const [first] = exports;
  if (!first) return { ...none, problems: ['Pick the group exports to read.'] };
  for (const ex of exports) {
    if (ex.par.join() !== first.par.join() || ex.strokeIndex.join() !== first.strokeIndex.join()) {
      problems.push(`${ex.file}: par or stroke index differs from ${first.file}`);
    }
    if (localDate(ex.teeTime) !== round.date) problems.push(`${ex.file}: played ${localDate(ex.teeTime)}, but ${round.course} is ${round.date}`);
  }
  const fillCourse = !round.par || !round.strokeIndex;
  if (!fillCourse && (round.par!.join() !== first.par.join() || round.strokeIndex!.join() !== first.strokeIndex.join())) {
    problems.push(`The exports' par or stroke index don't match ${round.course}'s in the guide`);
  }
  const course = { ...round, par: first.par, strokeIndex: first.strokeIndex };

  const ids = new Map<SquabbitPlayer, string>();
  const indexes: Record<string, number> = {};
  for (const ex of exports) {
    for (const p of ex.players) {
      const id = idOf(p.name);
      if (!id) problems.push(`${ex.file}: who is "${p.name}"?`);
      else if (!teamOf(id)) problems.push(`${ex.file}: ${p.name} isn't on a team`);
      else {
        ids.set(p, id);
        if (p.index !== null && handicaps[id] === undefined) indexes[id] = p.index;
      }
    }
  }
  if (problems.length) return none;
  const filled = { course: fillCourse ? { par: first.par, strokeIndex: first.strokeIndex } : null, handicaps: indexes };

  // A team total from gross scores: one match for the session
  if (session.scoring === 'aggregate') {
    if (session.basis !== 'gross') {
      return { ...none, problems: ["This team total adds up net scores, which need each player's full handicap; Squabbit's singles cards only give strokes off the low player. Type its totals in instead."] };
    }
    const gross = new Map<string, number>();
    for (const ex of exports) {
      for (const p of ex.players) {
        if (p.gross.some((g) => g === null)) problems.push(`${ex.file}: ${p.name} doesn't have all 18 holes`);
        else gross.set(ids.get(p)!, p.gross.reduce<number>((a, b) => a + b!, 0));
      }
    }
    for (const t of teams) for (const id of t.memberIds) if (!gross.has(id)) problems.push(`No scorecard for ${people.find((p) => p.id === id)?.name ?? id} (${t.name})`);
    if (problems.length) return none;
    const sides = Object.fromEntries(teams.map((t) => [t.id, t.memberIds]));
    const totals = Object.fromEntries(teams.map((t) => [t.id, t.memberIds.reduce((a, id) => a + gross.get(id)!, 0)]));
    return { matches: [aggregateMatch(session, sides, totals)], ...filled, problems };
  }

  // Match play: one match per group, or per pair in singles
  const matches: SavedMatch[] = [];
  for (const ex of exports) {
    const rows: ScoreRow[] = ex.players.map((p) => ({ player: ids.get(p)!, strokes: p.strokes, gross: p.gross }));
    ex.players.forEach((p, i) => {
      const nets = netScores(rows[i], course);
      const off = nets.flatMap((n, h) => (n !== null && p.netToPar[h] !== null && n - course.par[h] !== p.netToPar[h] ? [h + 1] : []));
      if (off.length) problems.push(`${ex.file}: ${p.name}'s net scores differ from Squabbit's on hole${off.length > 1 ? 's' : ''} ${off.join(', ')}`);
    });
    const groupIds = rows.map((r) => r.player);
    const groupPairs = pairs.filter(([a, b]) => groupIds.includes(a) && groupIds.includes(b));
    if (round.matchType === 'singles' && groupPairs.length === 0) {
      problems.push(`${ex.file}: say who played whom`);
      continue;
    }
    for (const players of groupPairs.length ? groupPairs.map((pair) => [...pair]) : [groupIds]) {
      const sides: Record<string, string[]> = {};
      for (const team of teams) {
        const side = players.filter((id) => teamOf(id)?.id === team.id);
        if (side.length) sides[team.id] = side;
      }
      if (Object.keys(sides).length !== 2) {
        problems.push(`${ex.file}: ${players.map((id) => people.find((p) => p.id === id)?.name ?? id).join(', ')} aren't two sides from two teams`);
        continue;
      }
      const n = matches.length + 1;
      const base = { id: matchIdFor(session.id, n), session: session.id, match: n, sides, scores: rows.filter((r) => players.includes(r.player)) };
      matches.push({ ...base, result: resultFromCard(session, base, course)! });
    }
  }
  if (matches.length > session.matches) problems.push(`That's ${matches.length} matches, but ${session.name} has ${session.matches}`);
  return problems.length ? none : { matches, ...filled, problems };
}
