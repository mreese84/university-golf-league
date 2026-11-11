# Firebase Hosting setup

One-time steps for Phase 1, step 1. They're all done in web consoles, signed in as the Firebase project's owner. Do them before merging the hosting pull request: until they're done, its deploy fails and the site stays on GitHub Pages as it is.

## 1. Create the Hosting site

1. In the [Firebase console](https://console.firebase.google.com/), open the project and go to **Build → Hosting**.
2. If Hosting has never been used, click **Get started** and click through (skip the command-line steps). This creates a default site named after the project ID.
3. At the bottom of the Hosting page, under **Advanced**, click **Add another site** and enter `university-golf-league`.

If that name is taken, pick another and tell Claude: it appears in `firebase.json` and `index.html`.

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

Previews use the dev data, not the live data, so trying something there never changes the live site. A "Dev data" banner across the top says so.

## Email-link sign-in (Phase 1, step 5)

For people who'd rather not sign in with Google, Firebase emails them a sign-in link. It's off until it's turned on:

1. Firebase console → **Authentication → Sign-in method → Add new provider → Email/Password**.
2. Turn on **Email/Password**, then **Email link (passwordless sign-in)**, and save. (Password sign-in itself isn't used; the app has no password form.)
3. Optional but worth it: **Project settings → General → Public-facing name** → `University Golf League`. The sign-in emails use this name; otherwise they show the project's ID.

The links come back to `/finish-sign-in` on whichever address asked for them (the live site or the preview), and both are already authorized domains from step 3 above.

## Making the repo private (Phase 1, step 9c)

Until step 9c, the GitHub Pages address (`mreese84.github.io/university-golf-league`) forwarded to the new one, and the old `ugl-selector` repo forwarded to that. GitHub Pages stops when a repo goes private (on GitHub's free plan), so:

1. Point `ugl-selector` straight at `https://university-golf-league.web.app`: replace its `index.html` and `404.html` (the same file) with a forwarder to the new address that keeps the path, query and hash. Check that `https://mreese84.github.io/ugl-selector/2026-columbia/guide` lands on the guide.
2. Merge step 9c. Deploys stop republishing the GitHub Pages forwarder; the copy already published keeps working until the next step.
3. In GitHub, open this repo's **Settings → General**, scroll to **Danger Zone**, click **Change visibility** and choose **Make private**. The `mreese84.github.io/university-golf-league` address stops working; it only went up on 2026-11-09, so few links use it.

Deploys, previews and tests keep running in a private repo. GitHub's free plan includes 2,000 minutes of Actions a month for private repos, far more than these use.

## Photos and logos (Phase 2)

Profile photos and team logos are uploaded to Cloud Storage for Firebase, which the Blaze plan covers. Storage has to be turned on before the Phase 2 pull request is merged, since every deploy then publishes `storage.rules`:

1. Firebase console → **Build → Storage → Get started**. Choose **production mode** (the repo's rules replace the console's on the next deploy). If it asks for a location, pick `us-central1`, `us-east1` or `us-west1`: those keep the bucket within Firebase's no-cost usage.
2. At the top of Storage's **Files** tab is the bucket's name, like `gs://ugl-selector.firebasestorage.app`. If it isn't your project ID followed by `.firebasestorage.app`, add a GitHub secret `VITE_FIREBASE_STORAGE_BUCKET` with the name, leaving out `gs://`. Otherwise there's nothing to add.
3. Merge. The **Deploy** workflow publishes the site and the database rules, then the storage rules in a step of its own, naming the bucket from step 2 (Firebase's lookup of a project's default bucket can say there's none even when the console shows one). If that step fails with a permission error, add the role **Cloud Storage for Firebase Admin** to the `github-deploy` account (as in step 2 above) and re-run the workflow; the site has gone out either way.
4. Move the photos that are built into the app: on the live site open **Admin → Profile photos** and press **Move all 8**. Do the same on the preview, which uses the dev data, if you want them there too. Then tell Claude, and the built-in copies come out of the repo.

Who can change what: a person, their chapter's organizers and admins can change their profile photo (on **Your profile**, or the **Members** tab), and organizers upload team logos in the Player's Guide's **Teams and houses** editor. Uploads go into the uploader's own folder (`envs/live/uploads/…` or `envs/dev/uploads/…`); photos are cropped to 900×1200 and logos fitted into 512×512 before they go up, and anything over 2 MB, or that isn't a JPEG or PNG, is refused.
