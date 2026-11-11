# University Golf League

College Football. Average Golf. Unlimited Fireball.

The league's web app. Each chapter has its trips, the selection draw, its members, the Player's Guide for each trip (with the Fireball tracker) and its competition history, for signed-in members only. Live at https://university-golf-league.web.app.

The first chapter is The Founder's Chapter, at `/founders`. Addresses from before chapters (`/2026-columbia/guide`, `/history`, `/players`, `/superlatives`) lead to the same pages there. Organizers can download everything in their chapter from **Export chapter** at the bottom of its page.

## On a phone

It installs like an app and works with no signal (whatever it has already loaded):
- **iPhone:** open it in Safari, tap Share, then **Add to Home Screen**.
- **Android:** open it in Chrome, tap the menu, then **Install app** (or **Add to Home screen**).

## Running it locally

```sh
npm install
npm run dev
```

The dev server needs the Firebase settings in `.env.local` (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` and `VITE_GOOGLE_CLIENT_ID`).

It uses the **dev data** (`envs/dev` in the database), a separate copy in the same Firebase project, so nothing you do there changes the live site (`envs/live`). A "Dev data" banner across the top is the reminder. Sign-in is the same as on the live site (Google, or an emailed link), and you see the chapters your email belongs to in the dev data.

## Tests

| Command | What it checks | Where it runs |
| --- | --- | --- |
| `npm test` | Code: the selection draw, addresses, pairings, the guide converters, and a chapter's history from the database (UGL2 adds up to 9½–1½, with the records and superlatives it had before the move) | Anywhere |
| `npm run lint` | Code style and React mistakes (ESLint) | Anywhere, and on GitHub with every pull request |
| `npm run test:rules` | The database rules (`firestore.rules`): who can read and change what | GitHub, on every pull request. It runs Firebase's local emulator, a throwaway database, which needs Java 21 or newer, so there's no need to run it on your own computer |

Neither one touches the live data.

## Deploys

- **Merging to `main`** publishes the site to Firebase Hosting together with `firestore.rules`. One-time setup: [docs/firebase-hosting-setup.md](docs/firebase-hosting-setup.md).
- **Each pull request** publishes a preview, using the dev data, and comments its address on the pull request.

## More

- [Phase 1 decisions](docs/phase-1-decisions.md) and [Phase 1 plan](docs/phase-1-plan.md)
