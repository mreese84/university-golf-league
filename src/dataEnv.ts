// Which copy of the data this build reads and writes. The live site uses the live data; the dev
// server (npm run dev) and preview links use the dev data (today's "-dev" collections), so trying
// something out never changes what the live site shows. VITE_DATA=live or VITE_DATA=dev overrides
// the default; the preview workflow sets dev.

import type { DataEnv } from './data/types';

export type { DataEnv };

const chosen = import.meta.env.VITE_DATA as string | undefined;
if (chosen && chosen !== 'live' && chosen !== 'dev') {
  throw new Error(`VITE_DATA must be "live" or "dev", not "${chosen}"`);
}

export const dataEnv: DataEnv = chosen === 'live' || chosen === 'dev' ? chosen : import.meta.env.DEV ? 'dev' : 'live';

export const isDevData = dataEnv === 'dev';

// A collection's name in this copy of the data: "guides" in the live data, "guides-dev" in the dev data
export const collectionName = (name: string) => (isDevData ? `${name}-dev` : name);
