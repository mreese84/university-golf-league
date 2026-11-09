// The history the site shows. On the live site that's every real event; the local dev server
// also includes sample events (see vite.config.ts).

import history from 'virtual:ugl-history';
import { playerStats, superlatives } from './stats.ts';

export { history };

const names = new Map(history.players.map((p) => [p.id, p.name]));
export const nameOf = (id: string) => names.get(id) ?? id;
export const firstName = (id: string) => nameOf(id).split(' ')[0];

// A player's profile photo URL, or null if they don't have one yet
const photos = new Map(history.players.flatMap((p) => (p.photo ? [[p.id, `${import.meta.env.BASE_URL}${p.photo}`]] : [])));
export const photoOf = (id: string) => photos.get(id) ?? null;

export const findEvent = (id: string) => history.events.find((e) => e.id === id);

export const stats = playerStats(history);
export const awards = superlatives(history, stats);

// "Justin T." for tight spots on phones
export function shortName(id: string) {
  const [first, ...rest] = nameOf(id).split(' ');
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
}
