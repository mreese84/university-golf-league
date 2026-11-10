// Where Fireball shots are counted: each round of golf, then everything else

import type { PlayerGuide } from '../../types';
import { clockHours, fmt } from './dates';
import { zonedParts } from './timeZones';

// Shots logged away from golf (nights out, the game) go in this bucket; the others are round IDs
export const OFF_COURSE = 'off';

export interface Bucket {
  id: string; // a round id, or OFF_COURSE
  label: string; // button and column heading: "Fri", "Off"
  title: string; // "Fri · Aiken Golf Club"
  place: string; // "Aiken Golf Club"
}

// Golf rounds in order, then everything else (nights out, the game)
export function bucketsFor(guide: PlayerGuide): Bucket[] {
  return [
    ...guide.rounds.map((r) => {
      const day = fmt(r.date, { weekday: 'short' });
      return { id: r.id, label: day, title: `${day} · ${r.course}`, place: r.course };
    }),
    { id: OFF_COURSE, label: 'Off', title: 'Off the course', place: 'Nights out, the game, anywhere but golf' },
  ];
}

// Today's round until about 5½ hours after the last tee time, then off the course
export function currentBucket(guide: PlayerGuide, timeZone: string | null, now = new Date()) {
  const { date, hours } = zonedParts(now, timeZone);
  const round = guide.rounds.find((r) => r.date === date);
  if (!round) return OFF_COURSE;
  const tees = round.groups.map((g) => clockHours(g.teeTime)).filter((h): h is number => h !== null);
  const done = tees.length ? Math.max(...tees) + 5.5 : 18;
  return hours < done ? round.id : OFF_COURSE;
}
