// Page addresses, all under the site's base path (/university-golf-league/):
//   /                                 trips, selection, and members tabs
//   /2026-columbia/guide              a trip's Player's Guide
//   /history                          every event
//   /history/2026-columbia            an event's matches
//   /history/2026-columbia/singles-1  one match's scorecard
//   /players, /players/jeff-siarto    player records
//   /superlatives
// GitHub Pages only serves files. The build (vite.config.ts) writes a copy of index.html at each
// guide and history address and as 404.html for anything else, and the app reads the path itself.

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
  | { page: 'superlatives' };

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

export function currentRoute(): Route {
  const legacy = window.location.hash.match(/^#\/guide\/(.+)$/);
  if (legacy) return { page: 'legacyGuide', tripId: decodeURIComponent(legacy[1]) };
  const { pathname } = window.location;
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
