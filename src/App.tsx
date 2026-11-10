import { useEffect, useState } from 'react';
import ChapterPage from './next/ChapterPage';
import FinishSignIn from './next/FinishSignIn';
import HomePage from './next/HomePage';
import { NextLayout } from './next/parts';
import ProfilePage from './next/ProfilePage';
import { SessionProvider } from './next/session';
import { currentRoute, navigate } from './routes';

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

  // Old and unknown addresses are replaced, so Back doesn't return to them
  useEffect(() => {
    if (route.page === 'redirect') navigate(route.to, { replace: true });
  }, [route]);

  if (route.page === 'redirect') return null;
  return (
    <SessionProvider>
      <NextLayout>
        {route.page === 'home' && <HomePage />}
        {route.page === 'finishSignIn' && <FinishSignIn />}
        {route.page === 'me' && <ProfilePage />}
        {route.page === 'chapter' && <ChapterPage key={route.chapterId} chapterId={route.chapterId} tab={route.tab} history={route.history} />}
        {route.page === 'tripGuide' && <ChapterPage key={route.chapterId} chapterId={route.chapterId} tab="trips" guideTripId={route.tripId} />}
      </NextLayout>
    </SessionProvider>
  );
}
