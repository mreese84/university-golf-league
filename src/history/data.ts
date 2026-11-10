// The history from the repo's history/ folder, for the Move-over page, which writes it into The
// Founder's Chapter. On the live site that's every real event; the local dev server also includes
// sample events (see vite.config.ts). The app's history pages read each chapter's history from the
// database (src/data/history.ts). This goes in the cleanup after the switch (Phase 1, step 9c).

import history from 'virtual:ugl-history';

export { history };
