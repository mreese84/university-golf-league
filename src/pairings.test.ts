import { describe, expect, it } from 'vitest';
import { planPairings, type PairingInput } from './pairings';

const handicaps: Record<string, number> = { a: 4, b: 8, c: 10, d: 12, e: 15, f: 17, g: 20, h: 24 };

const input = (overrides: Partial<PairingInput> = {}): PairingInput => ({
  playerIds: Object.keys(handicaps),
  handicaps,
  teamIds: ['red', 'blue'],
  captains: { red: 'a', blue: 'h' },
  groupsPerRound: 2,
  ...overrides,
});

describe('planPairings', () => {
  const plan = planPairings(input());
  const teamOf = (id: string) => (plan.teams.red.includes(id) ? 'red' : 'blue');

  it('splits everyone into two even teams with the captains apart', () => {
    expect(plan.teams.red).toHaveLength(4);
    expect(plan.teams.blue).toHaveLength(4);
    expect(plan.teams.red).toContain('a');
    expect(plan.teams.blue).toContain('h');
    expect(new Set([...plan.teams.red, ...plan.teams.blue]).size).toBe(8);
  });

  it('keeps the team handicap totals close', () => {
    const total = (ids: string[]) => ids.reduce((sum, id) => sum + handicaps[id], 0);
    expect(Math.abs(total(plan.teams.red) - total(plan.teams.blue))).toBe(plan.teamGap);
    expect(plan.teamGap).toBeLessThanOrEqual(2);
  });

  it('plays everyone once a day, in team order', () => {
    for (const day of [plan.fourball, plan.singles]) {
      expect(day.flat().sort()).toEqual(Object.keys(handicaps).sort());
    }
    for (const group of plan.fourball) expect(group.map(teamOf)).toEqual(['red', 'red', 'blue', 'blue']);
    for (const group of plan.singles) expect(group.map(teamOf)).toEqual(['red', 'blue', 'red', 'blue']);
  });

  it('never repeats a best-ball opponent in singles', () => {
    const opponents = new Map<string, string[]>();
    for (const [a1, a2, b1, b2] of plan.fourball) {
      for (const id of [a1, a2]) opponents.set(id, [b1, b2]);
      for (const id of [b1, b2]) opponents.set(id, [a1, a2]);
    }
    for (const [a1, b1, a2, b2] of plan.singles) {
      expect(opponents.get(a1)).not.toContain(b1);
      expect(opponents.get(a2)).not.toContain(b2);
    }
  });

  it('explains what it needs', () => {
    expect(() => planPairings(input({ playerIds: ['a', 'b', 'c'] }))).toThrow('multiple of 4');
    expect(() => planPairings(input({ captains: { red: 'a', blue: 'a' } }))).toThrow('different captain');
    expect(() => planPairings(input({ handicaps: { ...handicaps, c: Number.NaN } }))).toThrow('needs a handicap');
    expect(() => planPairings(input({ groupsPerRound: 3 }))).toThrow('tee times');
  });
});
