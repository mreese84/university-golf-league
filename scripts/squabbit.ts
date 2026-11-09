// Turns Squabbit scorecard exports (CSV, one per group) into history match files.
//
//   node scripts/squabbit.ts <event> <session> <export.csv>... [--pair <player>:<player>]...
//
//   node scripts/squabbit.ts 2026-columbia fourball ~/Downloads/November_6_2026*.csv
//   node scripts/squabbit.ts 2026-columbia singles ~/Downloads/November_7_2026*.csv \
//     --pair jason-sudan:adam-cowdin --pair justin-thompson:ross-gilbert ...
//
// Export every group of a session together: matches are numbered in tee-time order (match 1 =
// first tee time), and rerunning a session rewrites its files. Players are matched to
// history/players.json by full name and to a side by the event's teams. A group is one match when
// it has one side per team (best ball); singles need --pair for who played whom.
//
// An aggregate session (gross basis) takes the same exports and adds up each team's 18-hole gross
// scores: node scripts/squabbit.ts 2026-columbia aggregate ~/Downloads/November_7_2026*.csv
//
// From each export: gross scores, each player's handicap strokes for the round (the playing
// handicap on the game row), and the course's par and stroke index. The round gets the par and
// stroke index the first time; after that they're checked. Missing event handicaps are filled
// from the export's handicap index. Before writing anything, the script checks its own net scores
// against Squabbit's hole by hole, then runs the same checks as the build.

import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { netScores, playMatch } from '../src/history/scoring.ts';
import type { EventFile, HistoryMatch, ScoreRow } from '../src/history/types.ts';
import { loadHistory } from './loadHistory.ts';

const HISTORY = resolve(import.meta.dirname, '..', 'history');

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
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

interface ExportPlayer {
  name: string;
  index: number | null; // handicap index
  strokes: number; // playing handicap for the round
  gross: (number | null)[];
  netToPar: (number | null)[]; // Squabbit's net score against par, per hole
}

interface Export {
  file: string;
  course: string;
  teeTime: Date;
  par: number[];
  strokeIndex: number[];
  players: ExportPlayer[];
}

const toPar = (s: string) => (s === 'E' ? 0 : s === '' || s === '-' ? null : Number(s));

async function readExport(file: string): Promise<Export> {
  const rows = (await readFile(file, 'utf8')).split(/\r?\n/).filter((l) => l.trim()).map(cells);
  const where = `${file}:`;
  const [course, when] = rows[0] ?? [];
  const teeTime = new Date(when ?? '');
  if (!course || Number.isNaN(teeTime.getTime())) fail(`${where} the first line should be the course and tee time`);

  const header = rows.find((r) => r.includes('Hole 1'));
  if (!header) fail(`${where} no "Hole 1 … Hole 18" heading row`);
  const holeCols = Array.from({ length: 18 }, (_, i) => header.indexOf(`Hole ${i + 1}`));
  if (holeCols.includes(-1)) fail(`${where} the heading row should have Hole 1 through Hole 18`);
  const handicapCol = header.indexOf('Handicap');
  const holes = (row: string[]) => holeCols.map((c) => row[c] ?? '');

  const siRow = rows.find((r) => r[0] === 'S.I.');
  const parRow = rows.find((r) => r[0] === 'Par');
  if (!siRow || !parRow) fail(`${where} missing the S.I. or Par row`);
  const strokeIndex = holes(siRow).map(Number);
  const par = holes(parRow).map(Number);

  // Each player's row (name in the first cell) is followed by their game row (first cell blank),
  // which has the playing handicap and the net score against par for each hole
  const players: ExportPlayer[] = [];
  const start = rows.indexOf(parRow) + 1;
  for (let i = start; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;
    const game = rows[i + 1];
    if (!game || game[0]) fail(`${where} ${row[0]} has no game row (playing handicap and net scores) under it`);
    const strokes = Number(game[handicapCol]);
    if (!Number.isFinite(strokes)) fail(`${where} ${row[0]} has no playing handicap`);
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

// Compact arrays on one line, like the hand-written files
const pretty = (value: unknown) =>
  JSON.stringify(value, null, 2).replace(/\[\n\s+([^[\]{}]*?)\n\s*\]/g, (_, body: string) => `[${body.split(/,\n\s*/).join(', ')}]`);

function matchFile(m: Omit<HistoryMatch, 'id'>) {
  const sides = Object.entries(m.sides)
    .map(([team, ids]) => `    ${JSON.stringify(team)}: [${ids.map((id) => JSON.stringify(id)).join(', ')}]`)
    .join(',\n');
  const points = Object.entries(m.result.points).map(([t, p]) => `${JSON.stringify(t)}: ${p}`).join(', ');
  const pad = Math.max(...(m.scores ?? []).map((r) => r.player.length));
  const rows = (m.scores ?? []).map(
    (r) =>
      `    { "player": ${JSON.stringify(r.player)},${' '.repeat(pad - r.player.length + 1)}"strokes": ${r.strokes},${r.strokes < 10 ? ' ' : ''} "gross": [${r.gross.map((g) => (g === null ? 'null' : g)).join(', ')}] }`,
  );
  return `{
  "session": ${JSON.stringify(m.session)},
  "match": ${m.match},
  "sides": {
${sides}
  },
  "result": { "winner": ${JSON.stringify(m.result.winner)}, "margin": ${JSON.stringify(m.result.margin)}, "points": { ${points} } },
  "scores": [
${rows.join(',\n')}
  ]
}
`;
}

// One match for the whole session: each team's 18-hole gross scores added up, lowest wins
async function writeAggregate(
  eventId: string,
  sessionId: string,
  points: number,
  exports: Export[],
  byName: Map<string, string>,
  teams: { id: string; name: string; players: string[] }[],
) {
  const gross = new Map<string, number>();
  const problems: string[] = [];
  for (const ex of exports) {
    for (const p of ex.players) {
      const id = byName.get(p.name.toLowerCase());
      if (!id) problems.push(`${ex.file}: "${p.name}" isn't in history/players.json`);
      else if (p.gross.some((g) => g === null)) problems.push(`${ex.file}: ${p.name} doesn't have all 18 holes`);
      else gross.set(id, p.gross.reduce<number>((a, b) => a + b!, 0));
    }
  }
  for (const t of teams) for (const id of t.players) if (!gross.has(id)) problems.push(`No scorecard for ${id} (${t.name})`);
  if (problems.length) fail(`Nothing written:\n  ${problems.join('\n  ')}`);

  const totals = Object.fromEntries(teams.map((t) => [t.id, t.players.reduce((a, id) => a + gross.get(id)!, 0)]));
  const [a, b] = teams.map((t) => t.id);
  const diff = Math.abs(totals[a] - totals[b]);
  const winner = totals[a] < totals[b] ? a : totals[b] < totals[a] ? b : null;
  const result = {
    winner,
    margin: winner ? `${diff} stroke${diff === 1 ? '' : 's'}` : 'Tied',
    points: Object.fromEntries(teams.map((t) => [t.id, winner === null ? points / 2 : winner === t.id ? points : 0])),
  };
  const list = (ids: string[]) => `[${ids.map((id) => JSON.stringify(id)).join(', ')}]`;
  const text = `{
  "session": ${JSON.stringify(sessionId)},
  "match": 1,
  "sides": {
${teams.map((t) => `    ${JSON.stringify(t.id)}: ${list(t.players)}`).join(',\n')}
  },
  "totals": { ${teams.map((t) => `${JSON.stringify(t.id)}: ${totals[t.id]}`).join(', ')} },
  "result": { "winner": ${JSON.stringify(winner)}, "margin": ${JSON.stringify(result.margin)}, "points": { ${teams.map((t) => `${JSON.stringify(t.id)}: ${result.points[t.id]}`).join(', ')} } }
}
`;
  await writeFile(join(HISTORY, eventId, 'matches', `${sessionId}-1.json`), text);
  console.log(`${sessionId}-1  ${teams.map((t) => `${t.id} ${totals[t.id]}`).join('  vs  ')}  →  ${winner ?? 'tied'} ${result.margin}`);
}

async function main() {
  const args = process.argv.slice(2);
  const pairs: [string, string][] = [];
  const files: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--pair') {
      const [a, b] = (args[++i] ?? '').split(':');
      if (!a || !b) fail('--pair takes two player ids, e.g. --pair jeff-siarto:travis-vance');
      pairs.push([a, b]);
    } else files.push(args[i]);
  }
  const [eventId, sessionId, ...csvs] = files;
  if (!eventId || !sessionId || csvs.length === 0) {
    fail('Usage: node scripts/squabbit.ts <event> <session> <export.csv>... [--pair <player>:<player>]...');
  }

  const { data } = await loadHistory(HISTORY);
  const event = data.events.find((e) => e.id === eventId) ?? fail(`No history/${eventId}/event.json`);
  const session = event.sessions.find((s) => s.id === sessionId) ?? fail(`${eventId} has no session "${sessionId}"`);
  if (session.scoring === 'aggregate' && session.basis !== 'gross') {
    fail(`${sessionId} adds up net scores, which need each player's full handicap; Squabbit's singles exports only have strokes off the low player. Only gross aggregates can be made from them.`);
  }
  const roundIndex = event.rounds.findIndex((r) => r.id === session.round);
  const round = event.rounds[roundIndex];
  const byName = new Map(data.players.map((p) => [p.name.toLowerCase(), p.id]));
  const teamOf = (id: string) => event.teams.find((t) => t.players.includes(id));

  const exports = (await Promise.all(csvs.map(readExport))).sort((a, b) => a.teeTime.getTime() - b.teeTime.getTime());
  const problems: string[] = [];

  // The course: same par and stroke index in every export, and on the round
  const [first] = exports;
  for (const ex of exports) {
    if (ex.par.join() !== first.par.join() || ex.strokeIndex.join() !== first.strokeIndex.join()) {
      problems.push(`${ex.file}: par or stroke index differs from ${first.file}`);
    }
    const date = `${ex.teeTime.getFullYear()}-${String(ex.teeTime.getMonth() + 1).padStart(2, '0')}-${String(ex.teeTime.getDate()).padStart(2, '0')}`;
    if (date !== round.date) problems.push(`${ex.file}: played ${date}, but ${round.id} is ${round.date}`);
  }
  const fillCourse = !round.par || !round.strokeIndex;
  if (!fillCourse && (round.par!.join() !== first.par.join() || round.strokeIndex!.join() !== first.strokeIndex.join())) {
    problems.push(`The exports' par or stroke index don't match round "${round.id}" in event.json`);
  }
  const course = { ...round, par: first.par, strokeIndex: first.strokeIndex };

  if (session.scoring === 'aggregate') {
    if (problems.length) fail(`Nothing written:\n  ${problems.join('\n  ')}`);
    await writeAggregate(event.id, sessionId, session.points, exports, byName, event.teams);
    const { errors } = await loadHistory(HISTORY);
    if (errors.length) fail(`Written, but the history checks found problems:\n  ${errors.join('\n  ')}`);
    console.log('All history checks pass.');
    return;
  }

  // Matches
  const matches: Omit<HistoryMatch, 'id'>[] = [];
  const indexes: Record<string, number> = {};
  for (const ex of exports) {
    const ids = ex.players.map((p) => {
      const id = byName.get(p.name.toLowerCase());
      if (!id) problems.push(`${ex.file}: "${p.name}" isn't in history/players.json`);
      else if (!teamOf(id)) problems.push(`${ex.file}: ${p.name} isn't on a team in event.json`);
      return id ?? '';
    });
    const rows: ScoreRow[] = ex.players.map((p, i) => ({ player: ids[i], strokes: p.strokes, gross: p.gross }));
    ex.players.forEach((p, i) => {
      if (p.index !== null) indexes[ids[i]] = p.index;
      // Our net scores must agree with Squabbit's, or the strokes went on different holes
      const nets = netScores(rows[i], course);
      const off = nets.flatMap((n, h) =>
        n !== null && p.netToPar[h] !== null && n - course.par[h] !== p.netToPar[h] ? [h + 1] : [],
      );
      if (off.length) problems.push(`${ex.file}: ${p.name}'s net scores differ from Squabbit's on hole(s) ${off.join(', ')}`);
    });
    if (problems.length) continue;

    // One match per group with one side per team, or one per --pair in the group
    const groupPairs = pairs.filter(([a, b]) => ids.includes(a) && ids.includes(b));
    const sideSets = groupPairs.length ? groupPairs.map((pair) => [...pair]) : [ids];
    if (session.format === 'singles' && !groupPairs.length) {
      problems.push(`${ex.file}: singles need --pair <player>:<player> for who played whom`);
      continue;
    }
    for (const players of sideSets) {
      const sides: Record<string, string[]> = {};
      for (const team of event.teams) {
        const side = players.filter((id) => teamOf(id)?.id === team.id);
        if (side.length) sides[team.id] = side;
      }
      if (Object.keys(sides).length !== 2) {
        problems.push(`${ex.file}: ${players.join(', ')} aren't two sides from two teams`);
        continue;
      }
      const scores = rows.filter((r) => players.includes(r.player));
      const match: HistoryMatch = {
        id: '',
        session: sessionId,
        match: matches.length + 1,
        sides,
        result: { winner: null, margin: '', points: {} },
        scores,
      };
      const play = playMatch(match, course)!;
      const points = Object.fromEntries(
        Object.keys(sides).map((t) => [t, play.winner === null ? session.points / 2 : play.winner === t ? session.points : 0]),
      );
      matches.push({ ...match, result: { winner: play.winner, margin: play.margin, points } });
    }
  }
  if (problems.length) fail(`Nothing written:\n  ${problems.join('\n  ')}`);
  if (matches.length > session.matches) fail(`That's ${matches.length} matches, but ${sessionId} has ${session.matches}`);

  // Write: the course and any missing handicaps into event.json, then the matches
  const eventPath = join(HISTORY, eventId, 'event.json');
  const file = JSON.parse(await readFile(eventPath, 'utf8')) as EventFile;
  let changedEvent = false;
  if (fillCourse) {
    file.rounds[roundIndex] = { ...file.rounds[roundIndex], par: first.par, strokeIndex: first.strokeIndex };
    changedEvent = true;
  }
  for (const [id, index] of Object.entries(indexes)) {
    if (file.handicaps[id] === undefined) {
      file.handicaps[id] = index;
      changedEvent = true;
    }
  }
  if (changedEvent) await writeFile(eventPath, `${pretty(file)}\n`);
  for (const m of matches) {
    await writeFile(join(HISTORY, eventId, 'matches', `${sessionId}-${m.match}.json`), matchFile(m));
  }

  const name = (id: string) => data.players.find((p) => p.id === id)?.name ?? id;
  for (const m of matches) {
    const [a, b] = Object.entries(m.sides);
    const line = `${a[0]}: ${a[1].map(name).join(' & ')}  vs  ${b[0]}: ${b[1].map(name).join(' & ')}`;
    console.log(`${sessionId}-${m.match}  ${line}  →  ${m.result.winner ?? 'halved'} ${m.result.margin}`);
  }
  if (fillCourse) console.log(`Added par and stroke index for round "${round.id}" (${first.course})`);

  const { errors } = await loadHistory(HISTORY);
  if (errors.length) fail(`Written, but the history checks found problems:\n  ${errors.join('\n  ')}`);
  console.log('All history checks pass.');
}

main();
