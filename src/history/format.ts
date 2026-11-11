// How history numbers read on the page

import type { HistoryEvent, HistoryMatch } from './types.ts';
import type { WinLoss } from './stats.ts';

export const formatPoints = (n: number) => (n === 0.5 ? '½' : Number.isInteger(n) ? String(n) : `${Math.floor(n)}½`);
export const formatPts = (n: number) => `${formatPoints(n)} ${n === 1 ? 'pt' : 'pts'}`;
export const formatRecord = (r: WinLoss) => `${r.w}-${r.l}-${r.h}`;
export const formatToPar = (n: number) => (n === 0 ? 'E' : n > 0 ? `+${n}` : `−${-n}`);
// Plus handicaps are stored as negatives (+2.0 = -2)
export const formatHandicap = (h: number) => (h < 0 ? `+${(-h).toFixed(1)}` : h.toFixed(1));
export const eventLabel = (event: HistoryEvent) => `UGL${event.edition}`;

// Which of the trip's rounds a match was played in, counted from 1 in date order ("Rd 2")
export function roundLabel(event: HistoryEvent, match: Pick<HistoryMatch, 'session'>) {
  const round = event.sessions.find((s) => s.id === match.session)?.round;
  const index = [...event.rounds].sort((a, b) => a.date.localeCompare(b.date)).findIndex((r) => r.id === round);
  return index < 0 ? null : `Rd ${index + 1}`;
}
