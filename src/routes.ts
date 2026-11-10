// Page addresses, all under the site's base path (/):
//   /                                 trips, selection, and members tabs
//   /2026-columbia/guide              a trip's Player's Guide
//   /history                          every event
//   /history/2026-columbia            an event's matches
//   /history/2026-columbia/singles-1  one match's scorecard
//   /players, /players/jeff-siarto    player records
//   /superlatives
//   /move-over                        moving today's data into The Founder's Chapter (admin only)
// Phase 1 pages, on dev data only until the switch (src/next/enabled.ts):
//   /next                             the new home: the landing page, or your chapter (becomes / at the switch)
//   /finish-sign-in                   where email sign-in links land
//   /founders                         a chapter's trips; /founders/selection, /founders/members
//   /founders/2026-columbia/guide     a trip's Player's Guide in the chapter
//   /me                               your profile
// Firebase Hosting serves index.html at every address (firebase.json), and the app reads the path itself.

import { isValidChapterId } from './data/ids';

const BASE = import.meta.env.BASE_URL;

export { tripSlugs } from './tripSlugs';

export type Route =
  | { page: 'home' }
  | { page: 'guide'; slug: string }
  | { page: 'legacyGuide'; tripId: string } // old #/guide/<tripId> links
  | { page: 'history' }
  | { page: 'event'; eventId: string }
  | { page: 'match'; eventId: string; matchId: string }
  | { page: 'players' }
  | { page: 'player'; playerId: string }
  | { page: 'superlatives' }
  | { page: 'moveOver' }
  | { page: 'nextHome' }
  | { page: 'finishSignIn' }
  | { page: 'chapter'; chapterId: string; tab: ChapterTab }
  | { page: 'tripGuide'; chapterId: string; tripId: string }
  | { page: 'me' };

export type ChapterTab = 'trips' | 'selection' | 'members';
const CHAPTER_TABS: ChapterTab[] = ['trips', 'selection', 'members'];

export type NextRoute = Extract<Route, { page: 'nextHome' | 'finishSignIn' | 'chapter' | 'tripGuide' | 'me' }>;

export const isNextRoute = (route: Route): route is NextRoute => ['nextHome', 'finishSignIn', 'chapter', 'tripGuide', 'me'].includes(route.page);

export type HistoryRoute = Extract<Route, { page: 'history' | 'event' | 'match' | 'players' | 'player' | 'superlatives' }>;

export const isHistoryRoute = (route: Route): route is HistoryRoute =>
  ['history', 'event', 'match', 'players', 'player', 'superlatives'].includes(route.page);

export const homePath = () => BASE;
export const guidePath = (slug: string) => `${BASE}${encodeURIComponent(slug)}/guide`;
export const historyPath = () => `${BASE}history`;
export const eventPath = (eventId: string) => `${BASE}history/${encodeURIComponent(eventId)}`;
export const matchPath = (eventId: string, matchId: string) => `${eventPath(eventId)}/${encodeURIComponent(matchId)}`;
export const playersPath = () => `${BASE}players`;
export const playerPath = (playerId: string) => `${BASE}players/${encodeURIComponent(playerId)}`;
export const superlativesPath = () => `${BASE}superlatives`;
export const moveOverPath = () => `${BASE}move-over`;
export const nextHomePath = () => `${BASE}next`;
export const finishSignInPath = () => `${BASE}finish-sign-in`;
export const chapterPath = (chapterId: string, tab: ChapterTab = 'trips') =>
  `${BASE}${encodeURIComponent(chapterId)}${tab === 'trips' ? '' : `/${tab}`}`;
export const mePath = () => `${BASE}me`;
export const tripGuidePath = (chapterId: string, tripId: string) => `${BASE}${encodeURIComponent(chapterId)}/${encodeURIComponent(tripId)}/guide`;

export const currentRoute = (): Route => parseRoute(window.location.pathname, window.location.hash);

export function parseRoute(pathname: string, hash = ''): Route {
  const legacy = hash.match(/^#\/guide\/(.+)$/);
  if (legacy) return { page: 'legacyGuide', tripId: decodeURIComponent(legacy[1]) };
  const path = pathname.startsWith(BASE) ? pathname.slice(BASE.length).replace(/\/$/, '') : '';
  const parts = path.split('/').map(decodeURIComponent);
  if (parts.length === 2 && parts[1] === 'guide') return { page: 'guide', slug: parts[0] };
  if (parts[0] === 'history') {
    if (parts.length === 1) return { page: 'history' };
    if (parts.length === 2) return { page: 'event', eventId: parts[1] };
    if (parts.length === 3) return { page: 'match', eventId: parts[1], matchId: parts[2] };
  }
  if (parts[0] === 'players') {
    if (parts.length === 1) return { page: 'players' };
    if (parts.length === 2) return { page: 'player', playerId: parts[1] };
  }
  if (path === 'superlatives') return { page: 'superlatives' };
  if (path === 'move-over') return { page: 'moveOver' };
  if (path === 'next') return { page: 'nextHome' };
  if (path === 'finish-sign-in') return { page: 'finishSignIn' };
  if (path === 'me') return { page: 'me' };
  if (parts.length === 3 && isValidChapterId(parts[0]) && parts[1] && parts[2] === 'guide') {
    return { page: 'tripGuide', chapterId: parts[0], tripId: parts[1] };
  }
  if (parts.length === 1 && isValidChapterId(parts[0])) return { page: 'chapter', chapterId: parts[0], tab: 'trips' };
  if (parts.length === 2 && isValidChapterId(parts[0]) && CHAPTER_TABS.includes(parts[1] as ChapterTab) && parts[1] !== 'trips') {
    return { page: 'chapter', chapterId: parts[0], tab: parts[1] as ChapterTab };
  }
  return { page: 'home' };
}

// Changes the address without reloading; App listens for popstate
export function navigate(path: string, { replace = false } = {}) {
  if (replace) window.history.replaceState(null, '', path);
  else window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

// For <a> clicks: open in-app, but let Cmd/Ctrl-click etc. open a new tab as usual
export function followLink(e: React.MouseEvent<HTMLAnchorElement>, path: string) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  navigate(path);
}
