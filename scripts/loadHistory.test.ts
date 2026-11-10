import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { standings } from '../src/history/stats.ts';
import { loadHistory, publicHistory } from './loadHistory.ts';

const dir = resolve(import.meta.dirname, '..', 'history');

describe('history files', () => {
  it('load with nothing to fix', async () => {
    const { errors } = await loadHistory(dir);
    expect(errors).toEqual([]);
  });

  it('add up to UGL2’s result: Palmetto 9½, Crescent 1½', async () => {
    const { data } = await loadHistory(dir);
    const ugl2 = publicHistory(data, false).events.find((e) => e.id === '2026-columbia');
    expect(ugl2).toBeDefined();
    const s = standings(ugl2!);
    expect(s.points).toEqual({ palmetto: 9.5, crescent: 1.5 });
    expect(s.total).toBe(11);
    expect(s.complete).toBe(true);
    expect(s.winner).toBe('palmetto');
  });
});
