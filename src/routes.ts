// Page addresses, all under the site's base path (/):
//   /                                 the landing page, or your chapter once you're signed in
//   /finish-sign-in                   where email sign-in links land
//   /me                               your profile
//   /founders                         a chapter's trips; /founders/selection, /founders/members
//   /founders/2026-columbia/guide     a trip's Player's Guide
//   /founders/history                 the chapter's events; /founders/history/2026-columbia, and
//                                     /founders/history/2026-columbia/singles-1 for one match
//   /founders/players, /founders/players/jeff-siarto, /founders/superlatives
// Addresses from before the switch (Phase 1, step 9) redirect into The Founder's Chapter:
//   /2026-columbia/guide              → /founders/2026-columbia/guide
//   /history…, /players…, /superlatives → the same under /founders
//   #/guide/<old trip ID>             → /founders (the old IDs aren't kept)
//   /next                             → /
// Anything else goes to /. Firebase Hosting serves index.html at every address (firebase.json), and
// the app reads the path itself.

import { isValidChapterId } from './data/ids';

const BASE = import.meta.env.BASE_URL;

// The chapter today's league moved into, where the old addresses lead
export const FOUNDERS = 'founders';

export type HistoryRoute =
  | { page: 'history' }
  | { page: 'event'; eventId: string }
  | { page: 'match'; eventId: string; matchId: string }
  | { page: 'players' }
  | { page: 'player'; playerId: string }
  | { page: 'superlatives' };

export type ChapterTab = 'trips' | 'selection' | 'members' | 'history';
const CHAPTER_TABS: ChapterTab[] = ['trips', 'selection', 'members'];

export type Route =
  | { page: 'home' }
  | { page: 'finishSignIn' }
  | { page: 'me' }
  | { page: 'chapter'; chapterId: string; tab: ChapterTab; history?: HistoryRoute }
  | { page: 'tripGuide'; chapterId: string; tripId: string }
  | { page: 'redirect'; to: string }; // an old or unknown address, replaced on arrival

export const homePath = () => BASE;
export const finishSignInPath = () => `${BASE}finish-sign-in`;
export const chapterPath = (chapterId: string, tab: ChapterTab = 'trips') =>
  `${BASE}${encodeURIComponent(chapterId)}${tab === 'trips' ? '' : `/${tab}`}`;
export const mePath = () => `${BASE}me`;
export const tripGuidePath = (chapterId: string, tripId: string) => `${BASE}${encodeURIComponent(chapterId)}/${encodeURIComponent(tripId)}/guide`;

// A chapter's history addresses
export function chapterHistoryLinks(chapterId: string) {
  const root = `${BASE}${encodeURIComponent(chapterId)}`;
  const event = (eventId: string) => `${root}/history/${encodeURIComponent(eventId)}`;
  return {
    events: `${root}/history`,
    event,
    match: (eventId: string, matchId: string) => `${event(eventId)}/${encodeURIComponent(matchId)}`,
    players: `${root}/players`,
    player: (playerId: string) => `${root}/players/${encodeURIComponent(playerId)}`,
    superlatives: `${root}/superlatives`,
  };
}

// history/…, players/…, superlatives, as a history page
function historyRouteOf(parts: string[]): HistoryRoute | null {
  if (parts[0] === 'history') {
    if (parts.length === 1) return { page: 'history' };
    if (parts.length === 2) return { page: 'event', eventId: parts[1] };
    if (parts.length === 3) return { page: 'match', eventId: parts[1], matchId: parts[2] };
  }
  if (parts[0] === 'players') {
    if (parts.length === 1) return { page: 'players' };
    if (parts.length === 2) return { page: 'player', playerId: parts[1] };
  }
  if (parts[0] === 'superlatives' && parts.length === 1) return { page: 'superlatives' };
  return null;
}

export const currentRoute = (): Route => parseRoute(window.location.pathname, window.location.hash);

const redirect = (to: string): Route => ({ page: 'redirect', to });

export function parseRoute(pathname: string, hash = ''): Route {
  if (/^#\/guide\/./.test(hash)) return redirect(chapterPath(FOUNDERS));
  if (!pathname.startsWith(BASE)) return redirect(homePath());
  // Links from the GitHub Pages days can end in a slash (/2026-columbia/guide/); keep the tidy form
  if (pathname.length > BASE.length && pathname.endsWith('/')) return redirect(pathname.replace(/\/+$/, ''));
  const path = pathname.slice(BASE.length);
  if (path === '') return { page: 'home' };
  let parts: string[];
  try {
    parts = path.split('/').map(decodeURIComponent);
  } catch {
    return redirect(homePath()); // a mangled address (%E0)
  }

  if (path === 'finish-sign-in') return { page: 'finishSignIn' };
  if (path === 'me') return { page: 'me' };

  // Old addresses
  if (path === 'next') return redirect(homePath());
  if (historyRouteOf(parts)) return redirect(`${BASE}${FOUNDERS}/${path}`);
  if (parts.length === 2 && parts[1] === 'guide' && parts[0] && !isValidChapterId(parts[0])) return redirect(tripGuidePath(FOUNDERS, parts[0]));

  // A chapter's pages
  if (isValidChapterId(parts[0])) {
    const chapterId = parts[0];
    const history = historyRouteOf(parts.slice(1));
    if (history) return { page: 'chapter', chapterId, tab: 'history', history };
    if (parts.length === 1) return { page: 'chapter', chapterId, tab: 'trips' };
    if (parts.length === 2 && CHAPTER_TABS.includes(parts[1] as ChapterTab) && parts[1] !== 'trips') {
      return { page: 'chapter', chapterId, tab: parts[1] as ChapterTab };
    }
    if (parts.length === 3 && parts[1] && parts[2] === 'guide') return { page: 'tripGuide', chapterId, tripId: parts[1] };
  }
  return redirect(homePath());
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
