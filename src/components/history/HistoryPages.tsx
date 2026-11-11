import { useHistory } from '../../history/historyContext';
import type { HistoryRoute } from '../../routes';
import { EmblemDefs } from '../guide/Emblem';
import BadgesPage from './BadgesPage';
import EventPage from './EventPage';
import EventsPage from './EventsPage';
import MatchPage from './MatchPage';
import PlayerPage from './PlayerPage';
import PlayersPage from './PlayersPage';
import SuperlativesPage from './SuperlativesPage';
import { Link } from './parts';


function sectionOf(route: HistoryRoute) {
  if (route.page === 'players' || route.page === 'player') return 'players';
  if (route.page === 'superlatives') return 'superlatives';
  if (route.page === 'badges') return 'badges';
  return 'events';
}

function page(route: HistoryRoute) {
  switch (route.page) {
    case 'history':
      return <EventsPage />;
    case 'event':
      return <EventPage eventId={route.eventId} />;
    case 'match':
      return <MatchPage eventId={route.eventId} matchId={route.matchId} />;
    case 'players':
      return <PlayersPage />;
    case 'player':
      return <PlayerPage playerId={route.playerId} />;
    case 'superlatives':
      return <SuperlativesPage />;
    case 'badges':
      return <BadgesPage />;
  }
}

// The history pages, for whichever history the surrounding HistoryContext provides: today's public
// one, or a chapter's
export default function HistoryPages({ route }: { route: HistoryRoute }) {
  const { data, links } = useHistory();
  const current = sectionOf(route);
  const sections = [
    { key: 'events', label: 'Events', path: links.events },
    { key: 'players', label: 'Players', path: links.players },
    { key: 'superlatives', label: 'Superlatives', path: links.superlatives },
    { key: 'badges', label: 'Badges', path: links.badges },
  ] as const;
  return (
    <div className="space-y-6">
      <EmblemDefs />
      <nav className="flex flex-wrap gap-1 sm:gap-1.5">
        {sections.map((s) => (
          <Link
            key={s.key}
            to={s.path}
            className={`px-2.5 sm:px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors
              ${current === s.key
                ? 'bg-green-600 border-green-600 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-green-600 hover:text-green-700'}`}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      {data.events.some((e) => e.sample) && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <span className="font-semibold">Sample data.</span> Made-up teams and scores, shown only when the
          site runs on your computer. The live site leaves sample events out.
        </p>
      )}

      {page(route)}
    </div>
  );
}
