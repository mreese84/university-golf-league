// A chapter's competition record, ready for the history pages: the data with its records,
// superlatives, names and photos worked out, and the addresses the pages link to. Today's public
// pages build one from the repo's history files (data.ts); a chapter's pages build one from the
// database (src/data/history.ts). Records belong to one chapter and are never combined.

import type { EarnedBadge } from './badges';
import { playerStats, superlatives, type PlayerStats, type Superlatives } from './stats';
import type { HistoryData, HistoryEvent } from './types';

export interface HistoryLinks {
  events: string;
  event: (eventId: string) => string;
  match: (eventId: string, matchId: string) => string;
  players: string;
  player: (playerId: string) => string;
  superlatives: string;
  badges: string;
}

export interface HistoryModel {
  data: HistoryData;
  stats: Map<string, PlayerStats>;
  awards: Superlatives;
  badges: Map<string, EarnedBadge[]>; // by person; the chapter adds them (src/history/badges.ts)
  links: HistoryLinks;
  nameOf: (id: string) => string;
  firstName: (id: string) => string;
  shortName: (id: string) => string; // "Justin T." for tight spots on phones
  photoOf: (id: string) => string | null; // the profile photo's URL
  findEvent: (id: string) => HistoryEvent | undefined;
}

// `photoBase` goes in front of a photo's path under public/ ("profiles/mark-reese.jpg")
export function makeHistoryModel(data: HistoryData, links: HistoryLinks, photoBase = '/'): HistoryModel {
  const names = new Map(data.players.map((p) => [p.id, p.name]));
  const photos = new Map(data.players.flatMap((p) => (p.photo ? [[p.id, `${photoBase}${p.photo}`] as const] : [])));
  const stats = playerStats(data);
  const nameOf = (id: string) => names.get(id) ?? id;
  return {
    data,
    stats,
    awards: superlatives(data, stats),
    badges: new Map(),
    links,
    nameOf,
    firstName: (id) => nameOf(id).split(' ')[0],
    shortName: (id) => {
      const [first, ...rest] = nameOf(id).split(' ');
      return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
    },
    photoOf: (id) => photos.get(id) ?? null,
    findEvent: (id) => data.events.find((e) => e.id === id),
  };
}
