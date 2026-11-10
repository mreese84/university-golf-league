import { isDevData } from '../dataEnv';

// The Phase 1 pages (/next, /finish-sign-in, /founders, …) run only on the dev data, on the dev
// server and preview links, until the switch (step 9), when they take over the live site. On the
// live site until then, their addresses go to today's home page.
export const nextPagesEnabled = isDevData;
