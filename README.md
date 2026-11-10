# University Golf League

College Football. Average Golf. Unlimited Fireball.

The league's web app: trips, the selection draw, the Player's Guide (with the Fireball tracker) and the competition history. Live at https://university-golf-league.web.app.

## Running it locally

```sh
npm install
npm run dev
```

The dev server needs the Firebase settings in `.env.local` (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` and `VITE_GOOGLE_CLIENT_ID`).

It uses the **dev data**, a separate copy in the same Firebase project, so nothing you do there changes the live site. A "Dev data" banner across the top is the reminder. Sign-in uses the same Google accounts as the live site.

## Tests

| Command | What it checks | Where it runs |
| --- | --- | --- |
| `npm test` | Code: the selection draw, trip addresses, pairings, and that the history files load and add up | Anywhere |
| `npm run test:rules` | The database rules (`firestore.rules`): who can read and change what | GitHub, on every pull request. It runs Firebase's local emulator, a throwaway database, which needs Java 21 or newer, so there's no need to run it on your own computer |

Neither one touches the live data.

## Deploys

- **Merging to `main`** publishes the site to Firebase Hosting together with `firestore.rules`, and keeps the old GitHub Pages address forwarding to the new one. One-time setup: [docs/firebase-hosting-setup.md](docs/firebase-hosting-setup.md).
- **Each pull request** publishes a preview, using the dev data, and comments its address on the pull request.

## More

- [Phase 1 decisions](docs/phase-1-decisions.md) and [Phase 1 plan](docs/phase-1-plan.md)
- [History data](history/README.md): the competition record and the Squabbit converter
