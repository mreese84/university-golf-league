// The history today's public pages show, from the repo's history/ folder. On the live site that's
// every real event; the local dev server also includes sample events (see vite.config.ts).
// A chapter's pages use their own history, from the database (src/data/history.ts).

import history from 'virtual:ugl-history';
import { eventPath, historyPath, matchPath, playerPath, playersPath, superlativesPath } from '../routes';
import { makeHistoryModel } from './model';

export { history };

export const publicModel = makeHistoryModel(
  history,
  { events: historyPath(), event: eventPath, match: matchPath, players: playersPath(), player: playerPath, superlatives: superlativesPath() },
  import.meta.env.BASE_URL,
);

export const { stats, awards, nameOf, firstName, photoOf, findEvent, shortName } = publicModel;
