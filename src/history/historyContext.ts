import { createContext, useContext } from 'react';
import type { HistoryModel } from './model';

// The history the pages show: today's public one, or a chapter's
export const HistoryContext = createContext<HistoryModel | null>(null);

export function useHistory() {
  const model = useContext(HistoryContext);
  if (!model) throw new Error('useHistory must be inside a HistoryContext provider');
  return model;
}
