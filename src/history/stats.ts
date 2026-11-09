// Records, standings and superlatives, all worked out from the match files

import { isComplete, netScores, netTotal, parseMargin, playMatch, type MatchPlay } from './scoring.ts';
import { formatPts, formatRecord, formatToPar } from './format.ts';
import type { EventRound, EventSession, EventTeam, HistoryData, HistoryEvent, HistoryMatch } from './types.ts';

export type Outcome = 'W' | 'L' | 'H';

export interface WinLoss {
  w: number;
  l: number;
  h: number;
}

const emptyRecord = (): WinLoss => ({ w: 0, l: 0, h: 0 });

function add(record: WinLoss, outcome: Outcome) {
  if (outcome === 'W') record.w++;
  else if (outcome === 'L') record.l++;
  else record.h++;
}

// A match with everything around it looked up
export interface MatchInfo {
  event: HistoryEvent;
  match: HistoryMatch;
  session: EventSession;
  round: EventRound;
  teams: EventTeam[]; // the two sides, in the event's team order
  play: MatchPlay | null; // hole by hole, when the match has a scorecard
}

export function matchInfo(event: HistoryEvent, match: HistoryMatch): MatchInfo {
  const session = event.sessions.find((s) => s.id === match.session)!;
  const round = event.rounds.find((r) => r.id === session.round)!;
  const teams = event.teams.filter((t) => t.id in match.sides);
  return { event, match, session, round, teams, play: session.scoring === 'match' ? playMatch(match, round) : null };
}

export const outcomeFor = (match: HistoryMatch, team: string): Outcome =>
  match.result.winner === null ? 'H' : match.result.winner === team ? 'W' : 'L';

// ── Standings ───────────────────────────────────────────────────

export interface Standings {
  points: Record<string, number>; // team id -> points so far
  total: number; // points available
  toWin: number;
  played: number; // matches with results
  expected: number;
  complete: boolean;
  winner: string | null; // once a team has clinched
  tied: boolean; // complete and level
}

export function standings(event: HistoryEvent): Standings {
  const points = Object.fromEntries(event.teams.map((t) => [t.id, 0]));
  for (const m of event.matches) for (const [team, p] of Object.entries(m.result.points)) points[team] += p;
  const total = event.sessions.reduce((sum, s) => sum + s.points * s.matches, 0);
  const toWin = total / 2 + 0.5;
  const expected = event.sessions.reduce((sum, s) => sum + s.matches, 0);
  const complete = event.matches.length >= expected;
  const winner = event.teams.find((t) => points[t.id] >= toWin)?.id ?? null;
  return { points, total, toWin, played: event.matches.length, expected, complete, winner, tied: complete && !winner };
}

// ── Players ─────────────────────────────────────────────────────

export interface PlayerMatch extends MatchInfo {
  team: EventTeam;
  partners: string[];
  opponents: string[];
  outcome: Outcome;
  points: number;
}

export interface PlayerEvent {
  event: HistoryEvent;
  team: EventTeam;
  handicap: number;
  captain: boolean;
  record: WinLoss;
  points: number;
}

export interface PlayerStats {
  id: string;
  events: PlayerEvent[]; // newest first
  matches: PlayerMatch[]; // individual (match play) matches, newest event first
  record: WinLoss;
  points: number;
  byFormat: { format: string; name: string; record: WinLoss; points: number }[];
  partners: { id: string; record: WinLoss; points: number }[];
  opponents: { id: string; record: WinLoss }[];
}

export function playerStats(data: HistoryData): Map<string, PlayerStats> {
  const stats = new Map<string, PlayerStats>();
  for (const event of data.events) {
    for (const team of event.teams) {
      for (const id of team.players) {
        if (!stats.has(id)) {
          stats.set(id, { id, events: [], matches: [], record: emptyRecord(), points: 0, byFormat: [], partners: [], opponents: [] });
        }
        stats.get(id)!.events.push({
          event,
          team,
          handicap: event.handicaps[id],
          captain: team.captain === id,
          record: emptyRecord(),
          points: 0,
        });
      }
    }
    for (const match of event.matches) {
      const info = matchInfo(event, match);
      if (info.session.scoring !== 'match') continue; // team-only sessions don't count toward players' records
      for (const team of info.teams) {
        const players = match.sides[team.id];
        const opponents = info.teams.filter((t) => t.id !== team.id).flatMap((t) => match.sides[t.id]);
        for (const id of players) {
          stats.get(id)!.matches.push({
            ...info,
            team,
            partners: players.filter((p) => p !== id),
            opponents,
            outcome: outcomeFor(match, team.id),
            points: match.result.points[team.id] ?? 0,
          });
        }
      }
    }
  }

  for (const s of stats.values()) {
    const byFormat = new Map<string, PlayerStats['byFormat'][number]>();
    const partners = new Map<string, PlayerStats['partners'][number]>();
    const opponents = new Map<string, PlayerStats['opponents'][number]>();
    for (const m of s.matches) {
      add(s.record, m.outcome);
      s.points += m.points;
      const ev = s.events.find((e) => e.event === m.event)!;
      add(ev.record, m.outcome);
      ev.points += m.points;

      // Newest event comes first, so its session name labels the format
      const f = byFormat.get(m.session.format) ?? { format: m.session.format, name: m.session.name, record: emptyRecord(), points: 0 };
      add(f.record, m.outcome);
      f.points += m.points;
      byFormat.set(m.session.format, f);

      for (const p of m.partners) {
        const entry = partners.get(p) ?? { id: p, record: emptyRecord(), points: 0 };
        add(entry.record, m.outcome);
        entry.points += m.points;
        partners.set(p, entry);
      }
      for (const p of m.opponents) {
        const entry = opponents.get(p) ?? { id: p, record: emptyRecord() };
        add(entry.record, m.outcome);
        opponents.set(p, entry);
      }
    }
    const games = (r: WinLoss) => r.w + r.l + r.h;
    s.byFormat = [...byFormat.values()];
    s.partners = [...partners.values()].sort((a, b) => b.points - a.points || games(b.record) - games(a.record));
    s.opponents = [...opponents.values()].sort((a, b) => games(b.record) - games(a.record));
  }
  return stats;
}

// ── Superlatives ────────────────────────────────────────────────

export interface AwardEntry {
  players: string[];
  opponents?: string[];
  team?: EventTeam;
  event?: HistoryEvent;
  match?: HistoryMatch;
  value: string; // the headline number, e.g. "5&4"
  note?: string;
}

export interface Award {
  id: string;
  title: string;
  description: string;
  entries: AwardEntry[];
}

export interface Superlatives {
  results: Award[];
  scorecards: Award[] | null; // null until some match has hole-by-hole scores
}

// Every entry tied for the top score (higher is better)
function best<T>(items: T[], score: (item: T) => number): T[] {
  if (items.length === 0) return [];
  const top = Math.max(...items.map(score));
  return items.filter((i) => score(i) === top);
}

export function superlatives(data: HistoryData, players: Map<string, PlayerStats>): Superlatives {
  const all = data.events.flatMap((event) => event.matches.map((m) => matchInfo(event, m)));
  const matchPlay = all.filter((i) => i.session.scoring === 'match');
  const sideOf = (i: MatchInfo, team: string) => i.match.sides[team];
  const otherSide = (i: MatchInfo, team: string) => i.teams.filter((t) => t.id !== team).flatMap((t) => i.match.sides[t.id]);
  const teamById = (i: MatchInfo, id: string) => i.teams.find((t) => t.id === id);

  // Biggest margin: holes up, then holes left (4&3 beats 3&2 beats 3&1)
  const wins = matchPlay.filter((i) => i.match.result.winner && parseMargin(i.match.result.margin));
  const marginScore = (i: MatchInfo) => {
    const m = parseMargin(i.match.result.margin)!;
    return m.up * 100 + m.left;
  };
  const winEntry = (i: MatchInfo, value: string, note?: string): AwardEntry => {
    const w = i.match.result.winner!;
    return { players: sideOf(i, w), opponents: otherSide(i, w), team: teamById(i, w), event: i.event, match: i.match, value, note };
  };

  // Points per player per event
  const eventPoints = [...players.values()].flatMap((p) =>
    p.events.filter((e) => e.record.w + e.record.l + e.record.h > 0).map((e) => ({ id: p.id, ...e })),
  );

  // Partnerships: every pair who played on the same side
  const pairs = new Map<string, { players: string[]; record: WinLoss; points: number; margin: number }>();
  for (const i of matchPlay) {
    for (const team of i.teams) {
      const side = sideOf(i, team.id);
      for (let a = 0; a < side.length; a++) {
        for (let b = a + 1; b < side.length; b++) {
          const ids = [side[a], side[b]].sort();
          const key = ids.join('|');
          const pair = pairs.get(key) ?? { players: ids, record: emptyRecord(), points: 0, margin: 0 };
          const outcome = outcomeFor(i.match, team.id);
          add(pair.record, outcome);
          pair.points += i.match.result.points[team.id] ?? 0;
          const up = parseMargin(i.match.result.margin)?.up ?? 0;
          pair.margin += outcome === 'W' ? up : outcome === 'L' ? -up : 0;
          pairs.set(key, pair);
        }
      }
    }
  }
  const pairGames = (p: { record: WinLoss }) => p.record.w + p.record.l + p.record.h;

  const results: Award[] = [
    {
      id: 'margin',
      title: 'Biggest margin of victory',
      description: 'The most lopsided match-play win.',
      entries: best(wins, marginScore).map((i) => winEntry(i, i.match.result.margin)),
    },
    {
      id: 'points',
      title: 'Most points in an event',
      description: 'Points a player earned in one event. A best-ball win counts for both partners.',
      entries: best(eventPoints, (e) => e.points).filter((e) => e.points > 0).map((e) => ({
        players: [e.id],
        team: e.team,
        event: e.event,
        value: formatPts(e.points),
        note: formatRecord(e.record),
      })),
    },
    {
      id: 'undefeated',
      title: 'Undefeated',
      description: 'Went through an event without losing a match.',
      entries: eventPoints
        .filter((e) => e.record.l === 0)
        .sort((a, b) => b.event.id.localeCompare(a.event.id) || b.record.w - a.record.w || b.points - a.points)
        .map((e) => ({ players: [e.id], team: e.team, event: e.event, value: formatRecord(e.record) })),
    },
    {
      id: 'partnership',
      title: 'Best partnership',
      description: 'Most points together, then win rate, then combined margin.',
      entries: best(
        best(best([...pairs.values()], (p) => p.points), (p) => p.record.w / pairGames(p)),
        (p) => p.margin,
      )
        .filter((p) => p.points > 0)
        .map((p) => ({ players: p.players, value: formatRecord(p.record), note: `${formatPts(p.points)} together` })),
    },
  ];

  // Scorecard awards. Net-score awards only use cards with each player's full handicap (not
  // singles strokes given off the low player)
  if (!all.some((i) => i.round.par && i.match.scores)) return { results, scorecards: null };
  const rows = all.flatMap((i) =>
    i.round.par && i.match.scores && i.session.strokes !== 'difference'
      ? i.match.scores.map((row) => ({ info: i, row, nets: netScores(row, i.round) }))
      : [],
  );
  const played = matchPlay.filter((i) => i.play);
  const teamOfPlayer = (i: MatchInfo, id: string) => i.teams.find((t) => i.match.sides[t.id].includes(id));

  const rounds = rows.filter(({ row }) => isComplete(row)).map(({ info, row }) => ({
    info,
    row,
    net: netTotal(row)!,
    toPar: netTotal(row)! - info.round.par!.reduce((a, b) => a + b, 0),
  }));
  const birdies = rows.map(({ info, row, nets }) => ({
    info,
    row,
    count: nets.filter((n, h) => n != null && n < info.round.par![h]).length,
  }));
  const holesWon = played.flatMap((i) =>
    i.teams.map((team) => ({ info: i, team, count: i.play!.holesWon[team.id] })),
  );
  const comebacks = played
    .filter((i) => i.play!.winner && i.play!.maxDeficit[i.play!.winner] >= 3)
    .sort((a, b) => b.play!.maxDeficit[b.play!.winner!] - a.play!.maxDeficit[a.play!.winner!]);
  const clutch = played.filter((i) => {
    const { winner, decidedHole, holes } = i.play!;
    return winner && decidedHole >= 17 && holes[decidedHole - 1].winner === winner;
  });

  const scorecards: Award[] = [
    {
      id: 'net-round',
      title: 'Best net round',
      description: 'Lowest 18-hole net score against par (complete cards only).',
      entries: best(rounds, (r) => -r.toPar).map(({ info, row, net, toPar }) => ({
        players: [row.player],
        team: teamOfPlayer(info, row.player),
        event: info.event,
        match: info.match,
        value: `${net} (${formatToPar(toPar)})`,
        note: info.round.course,
      })),
    },
    {
      id: 'net-birdies',
      title: 'Most net birdies',
      description: 'Holes at net birdie or better in one round.',
      entries: best(birdies, (b) => b.count).filter((b) => b.count > 0).map(({ info, row, count }) => ({
        players: [row.player],
        team: teamOfPlayer(info, row.player),
        event: info.event,
        match: info.match,
        value: String(count),
        note: info.round.course,
      })),
    },
    {
      id: 'holes-won',
      title: 'Most holes won in a match',
      description: 'Holes won before the match was decided.',
      entries: best(holesWon, (h) => h.count).filter((h) => h.count > 0).map(({ info, team, count }) => ({
        players: sideOf(info, team.id),
        opponents: otherSide(info, team.id),
        team,
        event: info.event,
        match: info.match,
        value: String(count),
        note: info.match.result.margin,
      })),
    },
    {
      id: 'comeback',
      title: 'Comeback win',
      description: 'Won after being 3 or more down.',
      entries: comebacks.map((i) => winEntry(i, `from ${i.play!.maxDeficit[i.play!.winner!]} down`, i.match.result.margin)),
    },
    {
      id: 'clutch',
      title: 'Clutch finisher',
      description: 'Won the hole that decided the match, on 17 or 18.',
      entries: clutch.map((i) => winEntry(i, `won ${i.play!.decidedHole}`, i.match.result.margin)),
    },
  ];
  return { results, scorecards };
}
