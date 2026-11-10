import HistoryPages from '../../components/history/HistoryPages';
import { HistoryContext } from '../../history/historyContext';
import type { HistoryRoute } from '../../routes';
import { Waiting } from '../parts';
import { useChapterHistory } from './chapterHistory';
import type { ChapterData } from './data';

// The chapter's History tab: today's history pages, on this chapter's record from the database
export default function HistoryView({ data, route }: { data: ChapterData; route: HistoryRoute }) {
  const { ready, model } = useChapterHistory(data);
  if (!ready) return <Waiting>Loading…</Waiting>;
  return (
    <HistoryContext.Provider value={model}>
      <HistoryPages route={route} />
    </HistoryContext.Provider>
  );
}
