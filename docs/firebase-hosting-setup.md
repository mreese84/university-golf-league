# Firebase Hosting setup

One-time steps for Phase 1, step 1. They're all done in web consoles, signed in as the Firebase project's owner. Do them before merging the hosting pull request: until they're done, its deploy fails and the site stays on GitHub Pages as it is.

## 1. Create the Hosting site

1. In the [Firebase console](https://console.firebase.google.com/), open the project and go to **Build → Hosting**.
2. If Hosting has never been used, click **Get started** and click through (skip the command-line steps). This creates a default site named after the project ID.
3. At the bottom of the Hosting page, under **Advanced**, click **Add another site** and enter `university-golf-league`.

If that name is taken, pick another and tell Claude: it appears in `firebase.json`, `index.html` and `forwarder/index.html`.

## 2. Create the deploy account

GitHub needs a key to publish the site and the database rules.

1. In the [Google Cloud console](https://console.cloud.google.com/), pick the same project, then go to **IAM & Admin → Service Accounts → Create service account**.
2. Name it `github-deploy`. Give it these roles:
   - Firebase Hosting Admin
   - Firebase Rules Admin
   - API Keys Viewer
   - Service Usage Consumer
3. Open the new account, go to **Keys → Add key → Create new key → JSON**. A file downloads.
4. In GitHub, open the repo's **Settings → Secrets and variables → Actions → New repository secret**. Name it `FIREBASE_SERVICE_ACCOUNT` and paste the whole file as the value.
5. Delete the downloaded file.

## 3. Allow sign-in on the new address

1. Firebase console → **Authentication → Settings → Authorized domains**: add `university-golf-league.web.app` if it isn't listed.
2. Google Cloud console → **APIs & Services → Credentials**: open the web OAuth client the site signs in with (its ID is the `VITE_GOOGLE_CLIENT_ID` secret). Under **Authorized JavaScript origins**, add `https://university-golf-league.web.app`.

## 4. Check the database rules

From now on, every deploy publishes `firestore.rules` from the repo, replacing what's in the console. In the Firebase console, open **Firestore → Rules** and check they match `firestore.rules`. If the console has something the repo doesn't, tell Claude before merging.

## 5. Try the preview, then merge

1. On the hosting pull request, re-run the **Preview** check (open the check's details, then **Re-run jobs**). This tries the deploy account without touching the live site.
2. When it passes, it comments the preview address on the pull request, something like `https://university-golf-league--preview-abc123.web.app`. Add that address as in step 3, to both lists, so sign-in works on previews.
3. Merge the pull request. The **Deploy** workflow publishes to Firebase first, then turns the GitHub Pages address into a forwarder.
4. Check:
   - `https://university-golf-league.web.app/` loads, signing in works, and a guide opens.
   - `https://mreese84.github.io/university-golf-league/2026-columbia/guide` lands on `https://university-golf-league.web.app/2026-columbia/guide`.

The preview address stays the same as long as a preview is published at least every 30 days. If it changes, add the new one as in step 3.

## Later: the `ugl-selector` forwarder

The old `ugl-selector` repo forwards to the GitHub Pages address, which now forwards to the new one. That works, but when this repo goes private (step 9), GitHub Pages stops, so before then `ugl-selector` should point straight at `https://university-golf-league.web.app`.
