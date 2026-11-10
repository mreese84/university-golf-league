// Which copy of the data this build reads and writes. The live site uses the live data (envs/live);
// the dev server (npm run dev) and preview links use the dev data (envs/dev), so trying something
// out never changes what the live site shows. VITE_DATA=live or VITE_DATA=dev overrides the default;
// the preview workflow sets dev.

import type { DataEnv } from './data/types';

export type { DataEnv };

const chosen = import.meta.env.VITE_DATA as string | undefined;
if (chosen && chosen !== 'live' && chosen !== 'dev') {
  throw new Error(`VITE_DATA must be "live" or "dev", not "${chosen}"`);
}

export const dataEnv: DataEnv = chosen === 'live' || chosen === 'dev' ? chosen : import.meta.env.DEV ? 'dev' : 'live';

export const isDevData = dataEnv === 'dev';
