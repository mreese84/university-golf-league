import type { NextRoute } from '../routes';
import ChapterPage from './ChapterPage';
import FinishSignIn from './FinishSignIn';
import HomePage from './HomePage';
import { NextLayout } from './parts';
import { SessionProvider } from './session';

// The Phase 1 pages, on dev data until the switch (see enabled.ts)
export default function NextApp({ route }: { route: NextRoute }) {
  return (
    <SessionProvider>
      <NextLayout>
        {route.page === 'finishSignIn' && <FinishSignIn />}
        {route.page === 'nextHome' && <HomePage />}
        {route.page === 'chapter' && <ChapterPage key={route.chapterId} chapterId={route.chapterId} />}
      </NextLayout>
    </SessionProvider>
  );
}
