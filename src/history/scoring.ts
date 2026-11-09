// Hole-by-hole net match play, worked out from a match's scorecard

import type { EventRound, HistoryMatch, ScoreRow } from './types.ts';

// Strokes a player gets on a hole: one on each hole whose stroke index is within their
// handicap, two once it passes 18. Plus handicaps give strokes back, easiest holes first.
export function strokesOnHole(strokes: number, strokeIndex: number) {
  if (strokes < 0) {
    const back = -strokes;
    return -(Math.floor(back / 18) + (strokeIndex > 18 - (back % 18) ? 1 : 0));
  }
  return Math.floor(strokes / 18) + (strokeIndex <= strokes % 18 ? 1 : 0);
}

export function netScores(row: ScoreRow, round: EventRound) {
  return row.gross.map((g, i) => (g == null ? null : g - strokesOnHole(row.strokes, round.strokeIndex![i])));
}

export const isComplete = (row: ScoreRow) => row.gross.length === 18 && row.gross.every((g) => g != null);

const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);

// Full 18-hole net score, or null when any hole is missing
export function netTotal(row: ScoreRow) {
  return isComplete(row) ? sum(row.gross) - row.strokes : null;
}

// Full 18-hole gross score, or null when any hole is missing
export function grossTotal(row: ScoreRow) {
  return isComplete(row) ? sum(row.gross) : null;
}

export interface HoleResult {
  hole: number; // 1–18
  sideScores: Record<string, number | null>; // team id -> best net on the hole
  winner: string | null; // team id; null = halved
  leader: string | null; // after this hole; null = all square
  up: number;
  live: boolean; // false once the match was already decided
}

export interface MatchPlay {
  holes: HoleResult[];
  decidedHole: number; // the hole the match ended on
  winner: string | null;
  margin: string; // "3&2", "1 UP", "AS"
  holesWon: Record<string, number>; // while the match was live
  maxDeficit: Record<string, number>; // most holes each side was down
}

export const statusText = (up: number) => (up === 0 ? 'AS' : `${up} UP`);

// Two-sided net match play from the scorecard; null when the match has no full scorecard
export function playMatch(match: HistoryMatch, round: EventRound | undefined): MatchPlay | null {
  const teams = Object.keys(match.sides);
  if (!match.scores || !round?.par || !round.strokeIndex || teams.length !== 2) return null;
  const nets = new Map(match.scores.map((row) => [row.player, netScores(row, round)]));
  if (teams.some((t) => match.sides[t].some((p) => !nets.has(p)))) return null;

  const [a, b] = teams;
  const holes: HoleResult[] = [];
  const holesWon: Record<string, number> = { [a]: 0, [b]: 0 };
  const maxDeficit: Record<string, number> = { [a]: 0, [b]: 0 };
  let diff = 0; // holes up for side a
  let decidedHole = 0;

  for (let i = 0; i < 18; i++) {
    const sideScores: Record<string, number | null> = {};
    for (const t of teams) {
      const scores = match.sides[t].map((p) => nets.get(p)![i]).filter((n): n is number => n != null);
      sideScores[t] = scores.length ? Math.min(...scores) : null;
    }
    const live = decidedHole === 0;
    // A side with no score on a hole loses it (both picked up: halved)
    const sa = sideScores[a] ?? Infinity;
    const sb = sideScores[b] ?? Infinity;
    const winner = sa < sb ? a : sb < sa ? b : null;
    if (live) {
      if (winner === a) diff++;
      if (winner === b) diff--;
      if (winner) holesWon[winner]++;
      maxDeficit[a] = Math.max(maxDeficit[a], -diff);
      maxDeficit[b] = Math.max(maxDeficit[b], diff);
      if (Math.abs(diff) > 17 - i || i === 17) decidedHole = i + 1;
    }
    holes.push({
      hole: i + 1,
      sideScores,
      winner,
      leader: diff > 0 ? a : diff < 0 ? b : null,
      up: Math.abs(diff),
      live, // once decided, the status stays where the match ended
    });
  }

  const up = Math.abs(diff);
  const left = 18 - decidedHole;
  return {
    holes,
    decidedHole,
    winner: diff > 0 ? a : diff < 0 ? b : null,
    margin: up === 0 ? 'AS' : left > 0 ? `${up}&${left}` : `${up} UP`,
    holesWon,
    maxDeficit,
  };
}

// "3&2" -> 3 up with 2 left; "2 UP" -> 2 up after 18; "AS" -> 0
export function parseMargin(margin: string): { up: number; left: number } | null {
  if (margin === 'AS') return { up: 0, left: 0 };
  const early = margin.match(/^(\d+)&(\d+)$/);
  if (early) return { up: Number(early[1]), left: Number(early[2]) };
  const full = margin.match(/^(\d+) UP$/);
  if (full) return { up: Number(full[1]), left: 0 };
  return null;
}
