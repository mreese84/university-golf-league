// Checks a chapter's history agrees with itself: teams, handicaps, sessions, and each match's sides,
// result and scorecard. Results are checked with these before they're saved (src/data/results.ts),
// so a slip can't put wrong records in the history.

import { isUploaded } from '../data/images';
import { grossTotal, isComplete, netTotal, parseMargin, playMatch } from './scoring.ts';
import type { HistoryData, HistoryEvent, HistoryMatch } from './types.ts';

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const isHalfStep = (n: number) => Number.isInteger(n * 2);

export function validateHistory(data: HistoryData): string[] {
  const errors: string[] = [];
  const players = Array.isArray(data.players) ? data.players : [];
  if (!Array.isArray(data.players)) errors.push('people: should be a list');

  const known = new Set<string>();
  for (const p of players) {
    if (!p || typeof p.id !== 'string' || !ID.test(p.id)) {
      errors.push(`people: "${p?.id}" isn't a valid ID (use first-last, lowercase)`);
      continue;
    }
    if (known.has(p.id)) errors.push(`people: "${p.id}" is listed twice`);
    if (typeof p.name !== 'string' || !p.name.trim()) errors.push(`people: "${p.id}" needs a name`);
    if (p.photo !== undefined && !isUploaded(String(p.photo)) && !/^profiles\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/.test(String(p.photo))) {
      errors.push(`people: "${p.id}" photo should be an uploaded image or look like "profiles/${p.id}.jpg"`);
    }
    known.add(p.id);
  }

  for (const event of data.events) checkEvent(event, known, errors);
  return errors;
}

function checkEvent(event: HistoryEvent, known: Set<string>, errors: string[]) {
  const file = event.id;
  const err = (msg: string) => errors.push(`${file}: ${msg}`);

  if (!/^\d{4}-[a-z0-9-]+$/.test(event.id)) err('the trip ID should be <year>-<city>, e.g. 2026-columbia');
  if (!isNum(event.edition)) err('needs an edition number (2 for UGL2)');
  for (const key of ['title', 'location', 'format'] as const) {
    if (typeof event[key] !== 'string' || !event[key].trim()) err(`needs a ${key}`);
  }
  if (!Array.isArray(event.dates) || event.dates.length !== 2 || !event.dates.every((d) => DATE.test(d))) {
    err('dates should be ["YYYY-MM-DD", "YYYY-MM-DD"] (first and last day)');
  } else if (!event.id.startsWith(event.dates[0].slice(0, 4))) {
    err(`the trip ID's year doesn't match its first day (${event.dates[0]})`);
  }

  // Teams
  const teams = Array.isArray(event.teams) ? event.teams : [];
  if (teams.length < 2) err('needs at least two teams');
  const teamOf = new Map<string, string>();
  for (const team of teams) {
    if (typeof team?.id !== 'string' || !ID.test(team.id)) {
      err(`team "${team?.id}" needs a lowercase id`);
      continue;
    }
    if (teams.filter((t) => t.id === team.id).length > 1) err(`team "${team.id}" is listed twice`);
    if (typeof team.name !== 'string' || !/^#[0-9a-f]{6}$/i.test(team.color ?? '')) {
      err(`team "${team.id}" needs a name and a hex color like "#041E42"`);
    }
    if (team.emblem !== undefined && team.emblem !== 'palmetto' && team.emblem !== 'crescent') {
      err(`team "${team.id}" emblem should be "palmetto" or "crescent"`);
    }
    if (team.logo !== undefined && !isUploaded(String(team.logo))) err(`team "${team.id}" logo should be an uploaded image's address`);
    for (const p of Array.isArray(team.players) ? team.players : []) {
      if (!known.has(p)) err(`team "${team.id}" has "${p}", who isn't in the league`);
      if (teamOf.has(p)) err(`"${p}" is on two teams`);
      teamOf.set(p, team.id);
    }
    if (!Array.isArray(team.players) || team.players.length === 0) err(`team "${team.id}" has no players`);
    if (team.captain !== undefined && !team.players?.includes(team.captain)) {
      err(`team "${team.id}" captain "${team.captain}" isn't on the team`);
    }
  }

  // Handicaps
  const handicaps = event.handicaps ?? {};
  for (const p of teamOf.keys()) {
    if (!isNum(handicaps[p])) err(`needs a handicap for "${p}"`);
  }
  for (const p of Object.keys(handicaps)) {
    if (!teamOf.has(p)) err(`has a handicap for "${p}", who isn't on a team`);
  }

  // Rounds
  const rounds = Array.isArray(event.rounds) ? event.rounds : [];
  for (const round of rounds) {
    const where = `round "${round?.id}"`;
    if (typeof round?.id !== 'string' || rounds.filter((r) => r.id === round.id).length > 1) {
      err(`${where} needs a unique id`);
    }
    if (typeof round.label !== 'string' || typeof round.course !== 'string' || !DATE.test(round.date ?? '')) {
      err(`${where} needs a label, a course and a date (YYYY-MM-DD)`);
    }
    if ((round.par === undefined) !== (round.strokeIndex === undefined)) {
      err(`${where} needs both par and strokeIndex, or neither`);
    }
    if (round.par !== undefined && (!Array.isArray(round.par) || round.par.length !== 18 || !round.par.every(isNum))) {
      err(`${where} par should be 18 numbers`);
    }
    if (round.strokeIndex !== undefined) {
      const si = round.strokeIndex;
      const ok = Array.isArray(si) && si.length === 18 && [...si].sort((x, y) => x - y).every((n, i) => n === i + 1);
      if (!ok) err(`${where} strokeIndex should be the numbers 1–18, each once`);
    }
  }

  // Sessions
  const sessions = Array.isArray(event.sessions) ? event.sessions : [];
  if (sessions.length === 0) err('needs at least one session');
  for (const s of sessions) {
    const where = `session "${s?.id}"`;
    if (typeof s?.id !== 'string' || !ID.test(s.id) || sessions.filter((x) => x.id === s.id).length > 1) {
      err(`${where} needs a unique lowercase id`);
    }
    if (!rounds.some((r) => r.id === s.round)) err(`${where} is in round "${s.round}", which doesn't exist`);
    if (typeof s.name !== 'string' || typeof s.format !== 'string' || !s.format) err(`${where} needs a name and a format`);
    if (s.scoring !== 'match' && s.scoring !== 'aggregate') err(`${where} scoring should be "match" or "aggregate"`);
    if (s.strokes !== undefined && s.strokes !== 'full' && s.strokes !== 'difference') {
      err(`${where} strokes should be "full" or "difference"`);
    }
    if (s.basis !== undefined && (s.scoring !== 'aggregate' || (s.basis !== 'net' && s.basis !== 'gross'))) {
      err(`${where} basis is for aggregate sessions, and should be "net" or "gross"`);
    }
    if (!isNum(s.points) || s.points <= 0 || !isHalfStep(s.points)) err(`${where} points should be a positive number`);
    if (!Number.isInteger(s.matches) || s.matches < 1) err(`${where} needs the number of matches it has`);
  }

  const teamIds = teams.map((t) => t.id);
  for (const match of event.matches) checkMatch(event, match, teamIds, teamOf, errors);
}

function checkMatch(
  event: HistoryEvent,
  match: HistoryMatch,
  teamIds: string[],
  teamOf: Map<string, string>,
  errors: string[],
) {
  const file = `${event.id} ${match.id}`;
  const err = (msg: string) => errors.push(`${file}: ${msg}`);
  const session = event.sessions?.find((s) => s.id === match.session);
  if (!session) {
    err(`session "${match.session}" isn't one of the trip's sessions`);
    return;
  }
  if (!Number.isInteger(match.match) || match.match < 1 || match.match > session.matches) {
    err(`match should be a number from 1 to ${session.matches}`);
  }
  if (match.id !== `${match.session}-${match.match}`) err(`should be saved as ${match.session}-${match.match}`);

  // Sides
  const sides = match.sides ?? {};
  const sideTeams = Object.keys(sides);
  if (sideTeams.length !== teamIds.length || !teamIds.every((t) => sideTeams.includes(t))) {
    err(`sides should list each team once: ${teamIds.join(', ')}`);
  }
  const seen = new Set<string>();
  for (const [team, ids] of Object.entries(sides)) {
    if (!Array.isArray(ids) || ids.length === 0) err(`side "${team}" has no players`);
    for (const p of Array.isArray(ids) ? ids : []) {
      if (teamOf.get(p) !== team) err(`"${p}" isn't on ${team}`);
      if (seen.has(p)) err(`"${p}" is in the match twice`);
      seen.add(p);
    }
  }

  // Result and points
  const result = match.result;
  if (!result) {
    err('needs a result');
    return;
  }
  if (result.winner !== null && !teamIds.includes(result.winner)) {
    err(`winner should be a team id (${teamIds.join(', ')}) or null for a halved match`);
  }
  const points = result.points ?? {};
  for (const t of teamIds) {
    const expected = result.winner === null ? session.points / teamIds.length : result.winner === t ? session.points : 0;
    if (points[t] !== expected) {
      err(`${t} should get ${expected} point${expected === 1 ? '' : 's'} (got ${points[t] ?? 'none'})`);
    }
  }
  if (typeof result.margin !== 'string' || !result.margin) err('needs a margin');

  const round = event.rounds?.find((r) => r.id === session.round);
  if (session.scoring === 'match') {
    const margin = parseMargin(result.margin ?? '');
    if (!margin) err(`margin "${result.margin}" should look like "3&2", "1 UP" or "AS"`);
    else if ((margin.up === 0) !== (result.winner === null)) err('a halved match has margin "AS" and winner null');
    if (match.totals) err('totals are only for aggregate sessions');
  } else {
    checkAggregate(event, match, session.round, session.basis ?? 'net', teamIds, err);
  }

  // Scorecard
  if (match.scores === undefined) return;
  if (!Array.isArray(match.scores)) {
    err('scores should be a list of player rows');
    return;
  }
  const before = errors.length;
  if (!round?.par || !round.strokeIndex) err(`scores need par and strokeIndex on round "${session.round}"`);
  const rowPlayers = match.scores.map((r) => r?.player);
  for (const p of seen) if (!rowPlayers.includes(p)) err(`scores are missing "${p}"`);
  for (const row of match.scores) {
    if (!seen.has(row?.player)) err(`scores have "${row?.player}", who isn't in this match`);
    if (rowPlayers.filter((p) => p === row?.player).length > 1) err(`scores list "${row.player}" twice`);
    if (!Number.isInteger(row?.strokes)) err(`"${row?.player}" strokes should be a whole number`);
    const grossOk =
      Array.isArray(row?.gross) &&
      row.gross.length === 18 &&
      row.gross.every((g) => g === null || (Number.isInteger(g) && g > 0));
    if (!grossOk) err(`"${row?.player}" gross should be 18 scores (null for a hole with no score)`);
  }
  if (errors.length > before) return; // the scorecard itself needs fixing first

  if (session.scoring === 'match') {
    const play = playMatch(match, round);
    if (play && (play.winner !== result.winner || play.margin !== result.margin)) {
      const said = result.winner ? `${result.winner} ${result.margin}` : result.margin;
      const card = play.winner ? `${play.winner} ${play.margin}` : play.margin;
      err(`the scorecard says ${card}, but the result says ${said}`);
    }
  }
}

// Team totals must match the winner, and, when every player has a full card that day, the cards
function checkAggregate(
  event: HistoryEvent,
  match: HistoryMatch,
  roundId: string,
  basis: 'net' | 'gross',
  teamIds: string[],
  err: (msg: string) => void,
) {
  const { totals, result } = match;
  if (!totals) return;
  if (!teamIds.every((t) => isNum(totals[t]))) {
    err(`totals should have a number for each team (${teamIds.join(', ')})`);
    return;
  }
  const low = Math.min(...teamIds.map((t) => totals[t]));
  const leaders = teamIds.filter((t) => totals[t] === low);
  const winner = leaders.length === 1 ? leaders[0] : null;
  if (winner !== result.winner) err(`totals make the winner ${winner ?? 'nobody (halved)'}, not ${result.winner}`);

  // Gross totals come from any card that day; net only from cards with each player's full
  // handicap (true net scores)
  const rows = new Map(
    event.matches
      .filter((m) => {
        const s = event.sessions.find((x) => x.id === m.session);
        return s?.round === roundId && (basis === 'gross' || s.strokes !== 'difference');
      })
      .flatMap((m) => m.scores ?? [])
      .filter(isComplete)
      .map((row) => [row.player, basis === 'gross' ? grossTotal(row)! : netTotal(row)!]),
  );
  for (const t of teamIds) {
    const players = match.sides[t] ?? [];
    if (!players.every((p) => rows.has(p))) continue;
    const fromCards = players.reduce((a, p) => a + rows.get(p)!, 0);
    if (fromCards !== totals[t]) err(`${t}'s scorecards add up to ${fromCards} ${basis}, but totals say ${totals[t]}`);
  }
}
