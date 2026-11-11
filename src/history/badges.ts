// Achievement badges (after Phase 1): earned by what happened, worked out from a chapter's record
// each time it's shown, so they're always right, nothing has to be awarded by hand, and old trips
// count. Each chapter's badges are its own, like its records. The art is in
// src/components/badges/BadgeArt.tsx.

import { parseMargin } from './scoring';
import type { PlayerMatch, PlayerStats } from './stats';
import type { HistoryEvent, HistoryMatch } from './types';

export type BadgeId = 'commissioner' | 'founder' | 'clutch' | 'captain-comeback';

export type BadgeTier = 'legendary' | 'rare' | 'common';

export interface BadgeDef {
  id: BadgeId;
  name: string;
  how: string; // how it's earned, as the badges page says it
  tier: BadgeTier;
}

// In the order they're shown
export const BADGES: BadgeDef[] = [
  { id: 'commissioner', name: 'Commissioner', how: 'Invented the UGL. There is only one.', tier: 'legendary' },
  { id: 'founder', name: 'Founder', how: "Went to UGL1, The Founder's Chapter's first trip.", tier: 'legendary' },
  { id: 'clutch', name: 'Clutch', how: 'Won a match on the 17th or 18th hole.', tier: 'rare' },
  { id: 'captain-comeback', name: 'Captain Comeback', how: 'Won a match after being more than 3 down.', tier: 'rare' },
];

export const badgeDef = (id: BadgeId) => BADGES.find((b) => b.id === id)!;

// Where a badge was earned: a match, or a trip
export interface BadgeMoment {
  event?: HistoryEvent;
  match?: HistoryMatch;
  note?: string; // "UGL1 · Lubbock 2025", "2&1 on 17", "4 down, won 1 UP"
}

export interface EarnedBadge {
  id: BadgeId;
  moments: BadgeMoment[]; // one per time it was earned (at least one)
}

// Captain Comeback: down this many holes or more at some point, and still won
export const COMEBACK_DEFICIT = 4;

// The chapter whose first trip makes Founders
export const FOUNDERS_CHAPTER = 'founders';

// The hole a match ended on: from its scorecard, or from its margin ("2&1" ended on 17, "1 UP" on 18)
export function decidedOn(m: PlayerMatch): number | null {
  if (m.play) return m.play.decidedHole;
  const margin = parseMargin(m.match.result.margin);
  return margin ? 18 - margin.left : null;
}

const won = (m: PlayerMatch) => m.outcome === 'W';

// Each person's badges in a chapter, in BADGES order
export function earnedBadges({
  chapterId,
  stats,
  trips,
  members,
  commissionerId,
}: {
  chapterId: string;
  stats: Map<string, PlayerStats>;
  trips: { number: number | null; year: number; location: string; attendeeIds: string[] }[];
  members: string[]; // people who've joined the chapter
  commissionerId: string;
}): Map<string, EarnedBadge[]> {
  const found = new Map<string, Map<BadgeId, BadgeMoment[]>>();
  const earn = (personId: string, id: BadgeId, moment: BadgeMoment) => {
    if (!found.has(personId)) found.set(personId, new Map());
    const mine = found.get(personId)!;
    mine.set(id, [...(mine.get(id) ?? []), moment]);
  };

  if (members.includes(commissionerId)) earn(commissionerId, 'commissioner', {});

  if (chapterId === FOUNDERS_CHAPTER) {
    const first = trips.find((t) => t.number === 1);
    for (const id of first?.attendeeIds ?? []) earn(id, 'founder', { note: `UGL1 · ${first!.location.split(',')[0]} ${first!.year}` });
  }

  for (const [personId, s] of stats) {
    // Oldest trip first, and within a trip in the order they were played, so the list of times
    // reads in order (a player's matches come newest trip first)
    const byEvent = new Map<string, PlayerMatch[]>();
    for (const m of s.matches) byEvent.set(m.event.id, [...(byEvent.get(m.event.id) ?? []), m]);
    for (const m of [...byEvent.values()].reverse().flat()) {
      if (!won(m)) continue;
      const { margin } = m.match.result;
      const hole = decidedOn(m);
      if (hole !== null && hole >= 17) earn(personId, 'clutch', { event: m.event, match: m.match, note: `${margin} on ${hole}` });
      const down = m.play?.maxDeficit[m.team.id] ?? 0;
      if (down >= COMEBACK_DEFICIT) earn(personId, 'captain-comeback', { event: m.event, match: m.match, note: `${down} down, won ${margin}` });
    }
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
