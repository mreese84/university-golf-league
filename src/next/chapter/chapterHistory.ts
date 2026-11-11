import { useMemo } from 'react';
import { COMMISSIONER_PERSON_ID } from '../../data/commissioner';
import { historyFromChapter } from '../../data/history';
import { useLiveCollections, useLiveDocs } from '../../data/hooks';
import { pathsFor } from '../../data/paths';
import type { FireballEntry, GuideContent, Handicap, Match } from '../../data/types';
import { dataEnv } from '../../dataEnv';
import { earnedBadges } from '../../history/badges';
import { makeHistoryModel } from '../../history/model';
import { chapterHistoryLinks } from '../../routes';
import { hasJoined, type ChapterData } from './data';

const P = pathsFor(dataEnv);

// The chapter's competition record from the database: each competition trip's guide (teams, rounds,
// sessions), handicaps and matches, in the shape the history pages read, with the badges its people
// have earned. Only this chapter's.
export function useChapterHistory(data: ChapterData) {
  const c = data.chapterId;
  const trips = data.trips.filter((t) => t.competition);
  const key = `history:${c}:${data.uid}`;
  const guides = useLiveDocs<GuideContent>(trips.map((t) => P.guide(c, t.id)), key);
  const handicaps = useLiveCollections<Handicap>(trips.map((t) => P.handicaps(c, t.id)), key);
  const matches = useLiveCollections<Match>(trips.map((t) => P.matches(c, t.id)), key);
  // Every trip's Fireball tally, for Fireball King
  const fireballs = useLiveCollections<FireballEntry>(data.trips.map((t) => P.fireball(c, t.id)), key);

  const ready =
    data.tripsStatus !== 'loading' &&
    trips.every((t) => P.guide(c, t.id) in guides && P.handicaps(c, t.id) in handicaps && P.matches(c, t.id) in matches);

  const model = useMemo(() => {
    const records = trips.map((trip) => ({
      id: trip.id,
      trip,
      guide: guides[P.guide(c, trip.id)] ?? null,
      handicaps: Object.fromEntries((handicaps[P.handicaps(c, trip.id)] ?? []).map((h) => [h.id, h.index])),
      matches: matches[P.matches(c, trip.id)] ?? [],
    }));
    const people = Object.entries(data.people).map(([id, person]) => ({ id, person }));
    const model = makeHistoryModel(historyFromChapter(people, records), chapterHistoryLinks(c), import.meta.env.BASE_URL);
    const members = data.roster.filter(hasJoined).map((e) => e.id);
    const fireball = Object.fromEntries(
      data.trips.map((t) => [
        t.id,
        Object.fromEntries((fireballs[P.fireball(c, t.id)] ?? []).map((f) => [f.id, Object.values(f.counts ?? {}).reduce((sum, n) => sum + Math.max(0, n), 0)])),
      ]),
    );
    const badges = earnedBadges({ chapterId: c, stats: model.stats, events: model.data.events, trips: data.trips, fireball, members, commissionerId: COMMISSIONER_PERSON_ID });
    return { ...model, badges };
    // trips is derived from data.trips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, data.trips, data.people, data.roster, guides, handicaps, matches, fireballs]);

  return { ready, model };
}
