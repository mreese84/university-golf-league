import { afterEach, describe, expect, it, vi } from 'vitest';

// dataEnv reads VITE_DATA once, when it loads, so each case loads a fresh copy
async function load(value: string | undefined) {
  vi.resetModules();
  vi.stubEnv('VITE_DATA', value);
  return import('./dataEnv');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('which copy of the data a build uses', () => {
  it('live: today’s collection names', async () => {
    const { dataEnv, isDevData, collectionName } = await load('live');
    expect([dataEnv, isDevData]).toEqual(['live', false]);
    expect(collectionName('guides')).toBe('guides');
  });

  it('dev: the "-dev" collections', async () => {
    const { dataEnv, isDevData, collectionName } = await load('dev');
    expect([dataEnv, isDevData]).toEqual(['dev', true]);
    expect(collectionName('guides')).toBe('guides-dev');
    expect(collectionName('fireball')).toBe('fireball-dev');
  });

  it('stops on anything else, rather than guessing', async () => {
    await expect(load('prod')).rejects.toThrow('VITE_DATA must be "live" or "dev"');
  });
});
