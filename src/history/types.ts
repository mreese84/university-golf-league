// The competition record, read from the repo's history/ folder (see history/README.md)

import type { Emblem } from '../types.ts';

export interface HistoryPlayer {
  id: string; // "jeff-siarto"; permanent
  name: string;
  photo?: string; // an uploaded image's address, or a built-in file under public/ ("profiles/jeff-siarto.jpg")
}

export interface EventTeam {
  id: string;
  name: string;
  color: string; // hex
  emblem?: Emblem;
  logo?: string; // an uploaded logo's address, shown in place of the emblem
  captain?: string;
  players: string[];
}

export interface EventRound {
  id: string;
  label: string; // "Day 1"
  date: string; // YYYY-MM-DD
  course: string;
  par?: number[]; // 18 holes; needed for scorecards
  strokeIndex?: number[]; // 18 holes, 1 = hardest
}

// match: net match play, each side's best net score per hole; players get W-L-H credit.
// aggregate: team total net strokes; counts for the team only.
export type Scoring = 'match' | 'aggregate';

export interface EventSession {
  id: string; // "fourball"
  round: string; // round id
  name: string; // "2-Man Net Best Ball"
  format: string; // groups records across years: "fourball", "singles", ...
  scoring: Scoring;
  points: number; // per match
  matches: number; // how many matches the session has
  // How the scorecards' strokes were given. full (the default): each player's whole handicap, so
  // the nets are true net scores. difference: strokes off the low player in each match (one gets
  // 0), as Squabbit's singles match play gives them; they decide the match, but the nets aren't
  // true net scores, so those cards stay out of net-score awards and the aggregate check.
  strokes?: 'full' | 'difference';
  // Aggregate sessions: what each player's 18 holes add up as, net (the default) or gross
  basis?: 'net' | 'gross';
}

export interface EventFile {
  edition: number; // 2 = UGL2
  title: string;
  location: string;
  dates: [string, string]; // first and last day
  format: string; // "Modified Ryder Cup"
  sample?: boolean; // made-up data; shown only on the local dev server
  teams: EventTeam[];
  handicaps: Record<string, number>; // player id -> handicap index for this event
  rounds: EventRound[];
  sessions: EventSession[];
}

export interface ScoreRow {
  player: string;
  strokes: number; // handicap strokes received this round
  gross: (number | null)[]; // 18 holes; null = no score
}

export interface MatchResult {
  winner: string | null; // team id; null = halved
  margin: string; // "3&2", "1 UP", "AS", or free text for aggregate ("6 strokes")
  points: Record<string, number>; // team id -> points earned
}

export interface MatchFile {
  session: string;
  match: number;
  sides: Record<string, string[]>; // team id -> player ids
  result: MatchResult;
  totals?: Record<string, number>; // aggregate: team id -> combined net score
  scores?: ScoreRow[];
}

export interface HistoryMatch extends MatchFile {
  id: string; // "fourball-1", from the file name
}

export interface HistoryEvent extends EventFile {
  id: string; // "2026-columbia", from the folder name
  year: number;
  matches: HistoryMatch[];
}

export interface HistoryData {
  players: HistoryPlayer[];
  events: HistoryEvent[]; // newest first
}
