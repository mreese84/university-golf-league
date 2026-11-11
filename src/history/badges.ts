// Achievement badges (after Phase 1): earned by what happened, worked out from a chapter's record
// each time it's shown, so they're always right, nothing has to be awarded by hand, and old trips
// count. Each chapter's badges are its own, like its records. The art is in
// src/components/badges/BadgeArt.tsx.
//
// A person holds each badge once. Most say how many times it was earned beside it ("×2"); Cup
// Winner and Fireball King carry the number on the badge itself; Snowman is earned once only.

import { grossTotal, parseMargin } from './scoring';
import { eventLabel, formatHandicap, roundLabel } from './format';
import { standings, type PlayerMatch, type PlayerStats } from './stats';
import type { EventRound, HistoryEvent, HistoryMatch, ScoreRow } from './types';

export type BadgeId =
  | 'commissioner'
  | 'founder'
  | 'walk-off'
  | 'clutch'
  | 'captain-comeback'
  | 'blowout'
  | 'hat-trick'
  | 'sandbagger'
  | 'cup-winner'
  | 'ace'
  | 'tour-pro'
  | 'eagle'
  | 'par-train'
  | 'birdie-machine'
  | 'snowman'
  | 'fireball-king'
  | 'lucky-draw';

export type BadgeTier = 'legendary' | 'rare' | 'common';

// Where it comes from, for the Badges page's sections
export type BadgeGroup = 'league' | 'matches' | 'scorecards' | 'trips';

// once: earned a single time. count: the times show beside it. onBadge: the times show on the art.
export type BadgeRepeat = 'once' | 'count' | 'onBadge';

export interface BadgeDef {
  id: BadgeId;
  name: string;
  how: string; // how it's earned, as the badges page says it
  tier: BadgeTier;
  group: BadgeGroup;
  repeat: BadgeRepeat;
}

// In the order they're shown
export const BADGES: BadgeDef[] = [
  { id: 'commissioner', name: 'Commissioner', how: 'Invented the UGL. There is only one.', tier: 'legendary', group: 'league', repeat: 'once' },
  { id: 'founder', name: 'Founder', how: "Went to UGL1, The Founder's Chapter's first trip.", tier: 'legendary', group: 'league', repeat: 'once' },
  { id: 'walk-off', name: 'Walk-Off', how: 'Won the final match on the 18th hole, and with it the cup.', tier: 'legendary', group: 'matches', repeat: 'count' },
  { id: 'clutch', name: 'Clutch', how: 'Won a match on the 17th or 18th hole.', tier: 'rare', group: 'matches', repeat: 'count' },
  { id: 'captain-comeback', name: 'Captain Comeback', how: 'Won a match after being 3 or more down.', tier: 'rare', group: 'matches', repeat: 'count' },
  { id: 'blowout', name: 'Blowout', how: 'Won a match 6&5 or bigger.', tier: 'rare', group: 'matches', repeat: 'count' },
  { id: 'hat-trick', name: 'Hat Trick', how: 'Won three matches at one trip.', tier: 'rare', group: 'matches', repeat: 'count' },
  { id: 'sandbagger', name: 'Sandbagger', how: 'Won a singles match against someone with a handicap 8 or more strokes lower.', tier: 'rare', group: 'matches', repeat: 'count' },
  { id: 'cup-winner', name: 'Cup Winner', how: "On the team that won a trip's cup. The number on the cup counts them.", tier: 'common', group: 'matches', repeat: 'onBadge' },
  { id: 'ace', name: 'Ace', how: 'A hole in one.', tier: 'legendary', group: 'scorecards', repeat: 'count' },
  { id: 'tour-pro', name: 'Tour Pro', how: 'Shot a round under par, gross.', tier: 'legendary', group: 'scorecards', repeat: 'count' },
  { id: 'eagle', name: 'Eagle', how: 'A gross eagle or better on a hole.', tier: 'rare', group: 'scorecards', repeat: 'count' },
  { id: 'par-train', name: 'Par Train', how: 'Five holes in a row at par or better, gross.', tier: 'rare', group: 'scorecards', repeat: 'count' },
  { id: 'birdie-machine', name: 'Birdie Machine', how: 'Five or more gross birdies at one trip.', tier: 'rare', group: 'scorecards', repeat: 'count' },
  { id: 'snowman', name: 'Snowman', how: 'Carded an 8 or worse on a hole. All in fun, and only once.', tier: 'common', group: 'scorecards', repeat: 'once' },
  { id: 'fireball-king', name: 'Fireball King', how: 'Logged the most Fireball shots at a trip. The number on the flame counts them.', tier: 'rare', group: 'trips', repeat: 'onBadge' },
  { id: 'lucky-draw', name: 'Lucky Draw', how: 'Drawn to pick the next trip’s location.', tier: 'common', group: 'trips', repeat: 'count' },
];

export const badgeDef = (id: BadgeId) => BADGES.find((b) => b.id === id)!;

// Where a badge was earned: a match, or a trip. The note says what happened; with an event, the
// trip and round go in front of it (momentText).
export interface BadgeMoment {
  event?: HistoryEvent;
  match?: HistoryMatch;
  note?: string; // "2&1 on 17", "3 down, won 1 UP", "6 birdies"; or, with no event, "UGL1 · Lubbock 2025"
}

// A moment as the Badges page shows it: "UGL2 · Rd 1 · 2&1 on 17", "UGL2 · 6 birdies"
export function momentText({ event, match, note }: BadgeMoment) {
  return [event && eventLabel(event), event && match && roundLabel(event, match), note].filter(Boolean).join(' · ');
}

export interface EarnedBadge {
  id: BadgeId;
  moments: BadgeMoment[]; // one per time it was earned (at least one)
}

// Captain Comeback: down this many holes or more at some point, and still won
export const COMEBACK_DEFICIT = 3;
// Blowout: up this many when it ended
export const BLOWOUT_UP = 6;
// Sandbagger: the opponent's handicap this much lower
export const SANDBAG_STROKES = 8;
export const HAT_TRICK_WINS = 3;
export const PAR_TRAIN_HOLES = 5;
export const BIRDIE_MACHINE_BIRDIES = 5;
export const SNOWMAN_SCORE = 8;

// The chapter whose first trip makes Founders
export const FOUNDERS_CHAPTER = 'founders';

// The hole a match ended on: from its scorecard, or from its margin ("2&1" ended on 17, "1 UP" on 18)
export function decidedOn(m: Pick<PlayerMatch, 'play' | 'match'>): number | null {
  if (m.play) return m.play.decidedHole;
  const margin = parseMargin(m.match.result.margin);
  return margin ? 18 - margin.left : null;
}

const won = (m: PlayerMatch) => m.outcome === 'W';
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export interface BadgeTrip {
  number: number | null;
  year: number;
  location: string;
  attendeeIds: string[];
  nextSelectorId: string | null;
  id?: string;
}

// Each scorecard once: a player's card for a round can sit on more than one match (a singles card is
// also in that day's team total)
function cardsOf(events: HistoryEvent[]) {
  const cards: { event: HistoryEvent; match: HistoryMatch; round: EventRound; row: ScoreRow }[] = [];
  for (const event of [...events].reverse()) {
    const seen = new Set<string>();
    for (const session of event.sessions) {
      const round = event.rounds.find((r) => r.id === session.round);
      if (!round?.par) continue;
      const matches = event.matches.filter((m) => m.session === session.id).sort((a, b) => a.match - b.match);
      for (const match of matches) {
        for (const row of match.scores ?? []) {
          const key = `${round.id}:${row.player}`;
          if (seen.has(key)) continue;
          seen.add(key);
          cards.push({ event, match, round, row });
        }
      }
    }
  }
  return cards;
}

// Each person's badges in a chapter, in BADGES order
export function earnedBadges({
  chapterId,
  stats,
  events = [],
  trips,
  fireball = {},
  members,
  commissionerId,
}: {
  chapterId: string;
  stats: Map<string, PlayerStats>;
  events?: HistoryEvent[]; // newest first, as the history has them
  trips: BadgeTrip[];
  fireball?: Record<string, Record<string, number>>; // trip ID -> person -> shots
  members: string[]; // people who've joined the chapter
  commissionerId: string;
}): Map<string, EarnedBadge[]> {
  const found = new Map<string, Map<BadgeId, BadgeMoment[]>>();
  const earn = (personId: string, id: BadgeId, moment: BadgeMoment) => {
    if (!found.has(personId)) found.set(personId, new Map());
    const mine = found.get(personId)!;
    const before = mine.get(id) ?? [];
    if (before.length > 0 && badgeDef(id).repeat === 'once') return;
    mine.set(id, [...before, moment]);
  };
  const byNumber = [...trips].filter((t) => t.number !== null).sort((a, b) => a.number! - b.number!);
  const tripLabel = (t: BadgeTrip) => `UGL${t.number} · ${t.location.split(',')[0]} ${t.year}`;

  // The league
  if (members.includes(commissionerId)) earn(commissionerId, 'commissioner', {});
  if (chapterId === FOUNDERS_CHAPTER) {
    const first = trips.find((t) => t.number === 1);
    for (const id of first?.attendeeIds ?? []) earn(id, 'founder', { note: tripLabel(first!) });
  }

  // Match play, oldest trip first and within a trip in the order played (a player's matches come
  // newest trip first)
  for (const [personId, s] of stats) {
    const byEvent = new Map<string, PlayerMatch[]>();
    for (const m of s.matches) byEvent.set(m.event.id, [...(byEvent.get(m.event.id) ?? []), m]);
    for (const matches of [...byEvent.values()].reverse()) {
      for (const m of matches) {
        if (!won(m)) continue;
        const at = { event: m.event, match: m.match };
        const { margin } = m.match.result;
        const hole = decidedOn(m);
        if (hole !== null && hole >= 17) earn(personId, 'clutch', { ...at, note: `${margin} on ${hole}` });
        const down = m.play?.maxDeficit[m.team.id] ?? 0;
        if (down >= COMEBACK_DEFICIT) earn(personId, 'captain-comeback', { ...at, note: `${down} down, won ${margin}` });
        if ((parseMargin(margin)?.up ?? 0) >= BLOWOUT_UP) earn(personId, 'blowout', { ...at, note: margin });
        if (m.partners.length === 0 && m.opponents.length === 1) {
          const mine = m.event.handicaps[personId];
          const theirs = m.event.handicaps[m.opponents[0]];
          if (mine !== undefined && theirs !== undefined && mine - theirs >= SANDBAG_STROKES) {
            earn(personId, 'sandbagger', { ...at, note: `${formatHandicap(mine)} over ${formatHandicap(theirs)}, ${margin}` });
          }
        }
      }
      const wins = matches.filter(won).length;
      if (wins >= HAT_TRICK_WINS) earn(personId, 'hat-trick', { event: matches[0].event, note: `${wins} wins` });
    }
  }

  for (const event of [...events].reverse()) {
    const table = standings(event);
    const winner = event.teams.find((t) => t.id === table.winner);
    if (winner) for (const id of winner.players) earn(id, 'cup-winner', { event, note: winner.name });

    // Walk-Off: the last match of the last match-play session, won on the 18th, that took the
    // winners from short of the cup to it
    const order = (m: HistoryMatch) => [event.sessions.findIndex((s) => s.id === m.session), m.match];
    const played = event.matches
      .filter((m) => event.sessions.find((s) => s.id === m.session)?.scoring === 'match')
      .sort((a, b) => order(a)[0] - order(b)[0] || order(a)[1] - order(b)[1]);
    const last = played.at(-1);
    const team = last?.result.winner;
    if (last && team && team === table.winner) {
      const session = event.sessions.find((s) => s.id === last.session)!;
      const round = event.rounds.find((r) => r.id === session.round);
      const stat = stats.get(last.sides[team][0])?.matches.find((m) => m.event.id === event.id && m.match.id === last.id);
      const before = table.points[team] - (last.result.points[team] ?? 0);
      if (round && stat && decidedOn(stat) === 18 && before < table.toWin) {
        for (const id of last.sides[team]) earn(id, 'walk-off', { event, match: last, note: `${last.result.margin} on 18` });
      }
    }
  }

  // Scorecards, gross unless they say net
  const birdies = new Map<string, { event: HistoryEvent; count: number }>();
  for (const { event, match, round, row } of cardsOf(events)) {
    const at = { event, match };
    const par = round.par!;
    let streak = 0;
    let trained = false;
    row.gross.forEach((g, h) => {
      if (g == null) {
        streak = 0;
        return;
      }
      if (g === 1) earn(row.player, 'ace', { ...at, note: `hole ${h + 1}` });
      if (g <= par[h] - 2) earn(row.player, 'eagle', { ...at, note: `${g} on hole ${h + 1}` });
      if (g >= SNOWMAN_SCORE) earn(row.player, 'snowman', { ...at, note: `${g} on hole ${h + 1}` });
      streak = g <= par[h] ? streak + 1 : 0;
      if (streak >= PAR_TRAIN_HOLES && !trained) {
        trained = true;
        earn(row.player, 'par-train', { ...at, note: `holes ${h + 2 - PAR_TRAIN_HOLES}–${h + 1}` });
      }
    });
    const key = `${event.id}:${row.player}`;
    const made = row.gross.filter((g, h) => g != null && g < par[h]).length;
    birdies.set(key, { event, count: (birdies.get(key)?.count ?? 0) + made });

    const gross = grossTotal(row);
    if (gross !== null && gross < sum(par)) earn(row.player, 'tour-pro', { ...at, note: `${gross}, ${sum(par) - gross} under par` });
  }
  for (const [key, { event, count }] of birdies) {
    if (count >= BIRDIE_MACHINE_BIRDIES) earn(key.split(':')[1], 'birdie-machine', { event, note: `${count} birdies` });
  }

  // The trips
  for (const trip of byNumber) {
    const tally = (trip.id && fireball[trip.id]) || {};
    const most = Math.max(0, ...Object.values(tally));
    if (most > 0) {
      for (const [id, shots] of Object.entries(tally)) if (shots === most) earn(id, 'fireball-king', { note: `UGL${trip.number} · ${shots} shots` });
    }
    if (trip.nextSelectorId) earn(trip.nextSelectorId, 'lucky-draw', { note: `Drawn at UGL${trip.number}` });
  }

  return new Map(
    [...found].map(([personId, mine]) => [personId, BADGES.filter((b) => mine.has(b.id)).map((b) => ({ id: b.id, moments: mine.get(b.id)! }))]),
  );
}

// Who has a badge, most times first, then by name
export function holdersOf(badges: Map<string, EarnedBadge[]>, id: BadgeId, nameOf: (id: string) => string) {
  return [...badges]
    .flatMap(([personId, list]) => list.filter((b) => b.id === id).map((b) => ({ personId, moments: b.moments })))
    .sort((a, b) => b.moments.length - a.moments.length || nameOf(a.personId).localeCompare(nameOf(b.personId)));
}
