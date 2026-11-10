import { useState, useRef, useEffect, useMemo } from 'react';
import { AppProvider, useAppState } from './store';
import { useAuth } from './auth';
import Layout from './components/Layout';
import MembersTab from './components/MembersTab';
import TripsTab from './components/TripsTab';
import SelectionTab from './components/SelectionTab';
import GuidePage from './components/guide/GuidePage';
import HistoryPages from './components/history/HistoryPages';
import MoveOverPage from './components/MoveOverPage';
import NextApp from './next/NextApp';
import { nextPagesEnabled } from './next/enabled';
import { history, publicModel } from './history/data';
import { HistoryContext } from './history/historyContext';
import { currentRoute, followLink, guidePath, historyPath, homePath, isHistoryRoute, isNextRoute, moveOverPath, navigate, tripSlugs, type Route } from './routes';

type Tab = 'members' | 'trips' | 'selection' | 'history';

// The History tab appears once there's an event to show (the live site skips sample events)
const showHistory = history.events.length > 0;

function AppContent({ route }: { route: Route }) {
  const { trips, loading, exportData, importData } = useAppState();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('trips');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const slugs = useMemo(() => tripSlugs(trips), [trips]);

  // Old #/guide/<tripId> links move to the trip's /<year-city>/guide address once trips load;
  // any other unknown address goes home
  useEffect(() => {
    if (route.page === 'legacyGuide' && !loading) {
      const slug = slugs.get(route.tripId);
      navigate(slug ? guidePath(slug) : homePath(), { replace: true });
    } else if (route.page === 'home' && window.location.pathname !== homePath()) {
      navigate(homePath(), { replace: true });
    } else if (route.page !== 'home' && window.location.pathname.endsWith('/')) {
      // Links from the GitHub Pages days can end in a slash (/<trip>/guide/); keep the tidy form
      navigate(window.location.pathname.replace(/\/+$/, ''), { replace: true });
    }
  }, [route, loading, slugs]);

  const onHome = route.page === 'home';
  const guideTripId =
    route.page === 'guide' ? ([...slugs].find(([, slug]) => slug === route.slug)?.[0] ?? null) : null;

  const closeGuide = () => navigate(homePath());

  const handleTabChange = (tab: Tab) => {
    if (tab === 'history') {
      navigate(historyPath());
      return;
    }
    if (!onHome) closeGuide();
    setActiveTab(tab);
  };

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ugl-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        importData(ev.target?.result as string);
      } catch {
        alert('Invalid data file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <Layout
      activeTab={isHistoryRoute(route) ? 'history' : onHome ? activeTab : 'trips'}
      onTabChange={handleTabChange}
      showHistory={showHistory}
    >
      {isHistoryRoute(route) ? (
        <HistoryContext.Provider value={publicModel}>
          <HistoryPages route={route} />
        </HistoryContext.Provider>
      ) : route.page === 'moveOver' ? (
        <MoveOverPage />
      ) : !onHome ? (
        <GuidePage tripId={guideTripId} onBack={closeGuide} />
      ) : (
        <>
          {activeTab === 'members' && <MembersTab />}
          {activeTab === 'trips' && <TripsTab />}
          {activeTab === 'selection' && <SelectionTab />}
        </>
      )}

      {/* Footer with data management */}
      {isAdmin && onHome && (
        <div className="mt-12 pt-6 border-t border-gray-100 flex items-center justify-center gap-4 text-xs text-gray-400">
          <button onClick={handleExport} className="hover:text-green-600 transition-colors cursor-pointer">
            Export Data
          </button>
          <span>·</span>
          <button onClick={() => fileInputRef.current?.click()} className="hover:text-green-600 transition-colors cursor-pointer">
            Import Data
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <span>·</span>
          <a href={moveOverPath()} onClick={(e) => followLink(e, moveOverPath())} className="hover:text-green-600 transition-colors">
            Move-over
          </a>
        </div>
      )}
    </Layout>
  );
}

export default function App() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const onNavigate = () => {
      setRoute(currentRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', onNavigate);
    window.addEventListener('hashchange', onNavigate);
    return () => {
      window.removeEventListener('popstate', onNavigate);
      window.removeEventListener('hashchange', onNavigate);
    };
  }, []);

  // The Phase 1 pages run on dev data until the switch, without today's data (app/data) loaded; on
  // the live site their addresses go home
  if (isNextRoute(route) && nextPagesEnabled) return <NextApp route={route} />;
  return (
    <AppProvider>
      <AppContent route={isNextRoute(route) ? { page: 'home' } : route} />
    </AppProvider>
  );
}
