# Phase 1 Plan

How we'll build Phase 1, following the [Phase 1 decisions](phase-1-decisions.md). Drafted 2026-11-09 for Mark's review.

Each numbered step below is one pull request. The live site keeps working after every one.

## In short

1. **Groundwork:** hosting, tests, the new database layout and its rules, and a tool that moves today's data into The Founder's Chapter. Members see no change.
2. **The Founder's Chapter goes live:** today's features, rebuilt on the new database at chapter addresses, then one switch moves everyone over.
3. **Edit everything in the app:** guide editors, handicaps, invites and RSVPs, results, chapter requests, and the installable app.

UGL2 is done and the next trip is a year off, so the switch can happen whenever it's ready, with nobody mid-trip.

## Two decisions (approved 2026-11-09)

### 1. Move the Firebase project to the Blaze plan

Blaze is pay-as-you-go with the same free allowances as today's Spark plan. At our size the bill should stay at $0. Set a budget alert at $5 a month (an alert warns; it doesn't cap spending).

Why:

- **Photos and logos.** Since February 2026, Cloud Storage needs Blaze. Spark projects can't use storage at all ([Firebase FAQ](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)).
- **Email-link sign-in.** On Spark, Firebase sends at most 5 sign-in emails a day for the whole project; Blaze's limit is far higher ([Firebase limits](https://firebase.google.com/docs/auth/limits)). A new chapter's organizer inviting a dozen people who don't use Google would hit that on day one.
- **Push notifications** (after Phase 1) need a small server function to send them, and Cloud Functions need Blaze.

Mark switches the plan before step 5, when email-link sign-in arrives.

### 2. Move hosting to Firebase Hosting

- **Address:** a Hosting site named `university-golf-league` gives `https://university-golf-league.web.app` (if the name is free), with no `ugl-selector` in it. A custom domain can be added later.
- **Clean addresses:** one rewrite rule serves the app at every address. Today the build writes a copy of the page for every guide and history address, and once trips and history are members-only, the build can't read them to write those copies anyway.
- **Rules deploy with the site** from the repo, instead of being pasted into the Firebase console.
- **Preview link:** pull requests publish to a preview address to try on a phone before merging. From step 2, previews use dev data.
- **Free** on either plan at this size.
- **The repo can go private**, which it will at the switch (step 9). GitHub Pages needs a paid GitHub plan for private repos; Firebase Hosting doesn't care.
- **Old links keep working:** until the switch, the GitHub Pages address forwards to the new one. When the repo goes private, GitHub Pages stops, so the `ugl-selector` forwarder points straight at the new address instead. The `mreese84.github.io/university-golf-league` address only went up on 2026-11-09, so few links use it.

## Database layout

Everything below sits under `envs/live` for the live site, or `envs/dev` for development and previews (see [Live data, dev data and tests](#live-data-dev-data-and-tests)).

```
config/admins                     { personIds }                  co-admins (the commissioner is fixed in the rules)
logins/{email}                    { personId }                   one per email: how a sign-in finds its person
people/{personId}                 { name, college, bio, ghin, photo, chapterIds, invitedTo, organizerOf, updatedAt }
  private/contact                 { emails }                     the person, admins and their organizers only
chapterRequests/{requestId}       { name, note, requestedBy, status, decidedBy, chapterId, createdAt }

chapters/{chapterId}              { name, createdAt }
  members/{personId}              { role: organizer | member, status: active | alumni | guest | invitee,
                                    joinsAs (invitees: active | guest), since }
  trips/{tripId}                  { number, title, year, month, location, dates, timeZone, theme, competition,
                                    attendeeIds, selectedById, nextSelectorId }
    content/guide                 { flights, teams, rounds, format, football, nightlife }
    private/draft                 { published, captains, teams, rounds }       pairings draft, organizers only
    handicaps/{personId}          { index, updatedAt, updatedBy }               one pre-trip index per player
    rsvps/{personId}              { response: invited | yes | maybe | no, note, updatedAt }   people who've joined
    invites/{personId}            { response, note, updatedAt }                organizers' notes on invitees
    fireball/{personId}           { counts, updatedAt }
    matches/{matchId}             { session, match, sides, result, totals, scores }   today's match files
```

- **IDs are readable and permanent.** People keep today's history IDs (`mark-reese`); new people get one from their name. A trip's ID is its address (`2026-columbia`). The Founder's Chapter is `founders`.
- **One person record each.** It replaces today's two lists ("Mark R" on the Members page and "mark-reese" in the history), which are matched by name.
- **Guide and history share one model.** A trip's teams, rounds and sessions serve both. Rounds gain par and stroke index, and sessions gain how they're scored, as in today's `event.json`. The history pages assemble the same shape they read today, so the records and superlatives code stays as it is.
- **Numbering:** `number` is per chapter: UGL1 (2025 Lubbock, `competition: false`) and UGL2 (2026 Columbia) in The Founder's Chapter. A new chapter starts at 1.
- **Emails live in `logins` and each person's private contact record**, so members don't see each other's addresses. Organizers see the emails of people in their chapters, and can look up an email to see whether someone they're inviting is already in the league.
- **Two ways onto a roster.** An organizer either confirms someone straight away as an active member, alumni or guest (members see them at once, and they don't need to sign in, which suits a guest who never uses the app), or invites them.
- **Invitees are hidden from members.** Until someone joins, their roster entry and person record are visible only to organizers and admins, and their answers go in the organizers' `invites` notes rather than `rsvps`. Their first sign-in with the invited email completes the join: their status changes to what the organizer invited them as (active member or guest), and members can see them from then on. An organizer can also confirm an invitee who never signs in.
- **`chapterIds`, `invitedTo` and `organizerOf`** on a person mirror the rosters, so the rules can check "shares a chapter with" in one lookup. They're saved together with the roster (`src/data/writes.ts`), and the rules reject a roster save where they'd disagree. Only admins change `organizerOf`.
- **No account takeovers.** Organizers can attach sign-in emails only to people who are in none but their own chapters and aren't organizers or admins, so nobody can sign in as someone with more rights than their own.
- **Handicaps are their own records** so a player can enter their own. Members of the chapter can see them.
- **Offline:** the app keeps a local copy of what it has read, so the guide opens with no signal and Fireball shots save when the phone reconnects (today that only works while the page stays open).

## Live data, dev data and tests

Nothing in Phase 1 needs Java on Mark's Mac, and no test touches the live data.

| | Data it uses |
| --- | --- |
| The live site | Live data |
| `npm run dev` on Mark's Mac | Dev data (`envs/dev`) in the same Firebase project |
| Preview links | Dev data, from step 2 |
| Code tests (`npm test`) | None: made-up data, and a saved copy of The Founder's Chapter as the move left it, in memory. They run anywhere, Mark's Mac included |
| Rules tests (`npm run test:rules`) | None: a throwaway copy of the database (Firebase's emulator) on the computer running the tests, emptied every run. The emulator needs Java, so these run in GitHub on every pull request and in Claude's cloud sessions |

- **Live and dev data stay apart.** Everything sits under one of two roots: `envs/live` for the live site and `envs/dev` for development and previews.
- **The same rules cover both**, so dev data is just as protected, and what works on dev works live.
- **Dev data started as a copy of the live data.** Before the switch, the move-over wrote The Founder's Chapter into `envs/dev` from the live data, so the move could be rehearsed on real names and results. It's free to change.
- **Sign-in is shared:** the dev server and previews sign in with the same Google accounts as the live site, as today.

## Who can do what

|  | Commissioner | Co-admin | Organizer | Member | Signed in, no chapter | Signed out |
| --- | --- | --- | --- | --- | --- | --- |
| See a chapter: trips, guides, history, and people who've joined, with their RSVPs | every chapter | every chapter | own chapters | own chapters | | |
| Invite people; see invitees and their RSVPs | every chapter | every chapter | own chapters | | | |
| Edit trips, guides, teams, results, roster | every chapter | every chapter | own chapters | | | |
| See and edit the pairings draft | every chapter | every chapter | own chapters | | | |
| Own profile (bio, college, GHIN), handicap, RSVP, Fireball | ✓ | ✓ | ✓ | ✓ | | |
| Fix anyone's profile, handicap, RSVP, Fireball | every chapter | every chapter | own chapters | | | |
| Request a chapter | ✓ | ✓ | ✓ | ✓ | ✓ | sign in first |
| Approve chapter requests; make organizers | ✓ | ✓ | | | | |
| Add or remove co-admins | ✓ | | | | | |
| Landing page only | | | | | | ✓ |

Everyone who has joined a chapter can see it: active members, alumni and guests. Invitees can't see the chapter, and members can't see them, until they join. Status also decides who's in the selection draw (active members).

How the database enforces it:

- A sign-in counts only with a verified email. Google and email links both verify.
- The email's `logins` record gives the person; the roster gives their chapters and role.
- The commissioner is fixed in the rules by email, as today, so the league can never lock itself out. Co-admins come from `config/admins`, which only the commissioner can change.
- Each check reads at most a few records, well inside Firestore's limit of 10.
- Every cell of the table becomes a test, allowed and denied, run against a throwaway copy of the database on each pull request.

## Addresses

```
/                                     signed out: the landing page; signed in: your chapter, or a picker if you're in several
/founders                             Trips, Selection, Members
/founders/2026-columbia/guide         a trip's Player's Guide
/founders/history                     events; /founders/history/2026-columbia; /founders/history/2026-columbia/singles-1
/founders/players                     the Players list; /founders/players/mark-reese
/founders/superlatives
/me                                   your profile
/admin                                chapters, requests and co-admins (admins only)
```

Old addresses (`/2026-columbia/guide`, `/history/…`, `/players/…`, `/superlatives`) go to the same page in The Founder's Chapter; the oldest guide links (`#/guide/<trip>`) go to `/founders`, since the old trip IDs aren't kept. Chapter IDs can't be words the app uses (`history`, `players`, `admin`, `me` and so on).

## Moving today's data into The Founder's Chapter

| Today | Moves to |
| --- | --- |
| Members list (`app/data`: "Mark R", college) | people (full name, college) and the Founder's Chapter roster |
| Guide-access emails (`access/members`) | logins |
| `history/players.json` | people (same IDs and photos) |
| Bios (`profiles`) | people |
| Trips (`app/data`) | The Founder's Chapter's trips: UGL1 2025 Lubbock (no competition) and UGL2 2026 Columbia |
| Guides (`guides`) | the trip and its guide |
| Pairings drafts (`guideDrafts`) | the trip's draft and handicaps |
| Fireball counts (`fireball`) | the trip's Fireball counts |
| `history/2026-columbia/` | the trip's teams, rounds (with par and stroke index), sessions, handicaps and matches |

How it runs:

- **In the app, by Mark.** An admin-only Move-over page does it while Mark is signed in, so there are no keys or scripts to set up.
- **Backup first.** It downloads a copy of everything it reads before writing anything.
- **Mark confirms the people.** It shows each member matched to a person (today's matching, "Mark R" → Mark Reese) and asks for full names of members who aren't in the history yet, and each member's status.
- **Rerunnable.** It rebuilds The Founder's Chapter from today's data each time, so it can run again right before the switch. It never changes today's data.
- **UGL2 pre-trip handicaps** become Mark 16.6, Justin 4.0, Jason 18.0, Patrick 15.6; everyone else keeps their `event.json` number. Scorecard strokes and results don't change.
- **Checked against today's site.** A test computes UGL2's standings, records and superlatives from the moved data and compares them with today's history files. They must match, apart from those four handicaps.
- **The draw.** Today's code leaves "Adam C" out of the draw by name. Adam is an active member, so the name check goes away and he's in the draw from now on.

## Steps

### A. Groundwork (members see no change)

**1. Hosting and deploys.**
Firebase Hosting with one rewrite rule; `firebase.json`; GitHub Actions deploys the site and the database rules; pull requests publish to a preview address; GitHub Pages forwards to the new address. The build stops writing page copies.
Mark does, once ([setup steps](firebase-hosting-setup.md)): create the Hosting site, create the deploy account, allow sign-in on the new address, and check that the rules in the console match `firestore.rules`.
Done when the site serves from the new address, old links forward, and a pull request shows a preview link.

**2. Tests and dev data.**
Vitest and `npm test` for code checks, which run anywhere. `npm run test:rules` for the database rules, which runs in GitHub on every pull request and in Claude's cloud sessions (it needs Java, which Mark's Mac won't have). Previews switch to dev data, and the deploy workflow's GitHub Actions move to current versions. Mark installs nothing.

**3. Data model and rules.**
Types and data hooks for the new layout, under `envs/live` and `envs/dev`, and rules for it, with a test for every cell of the role table. Today's rules stay as they are.

**4. Move-over.**
The move as plain code with the UGL2 comparison test, then the commissioner-only Move-over page at `/move-over` (linked from the admin footer). Run from a preview link or the dev server, it writes the dev copy; it only reads today's data, and each run replaces the chapter with a fresh copy.
Done when the test passes and The Founder's Chapter is in the dev data, copied from the live data, for Mark to look over.

### B. The Founder's Chapter goes live

Steps 5 to 8 build the new pages at `/founders/…` and try them on dev data, on the dev server and preview links. The live site doesn't link to them until the switch, so everyone keeps using today's pages.

**5. Sign-in and landing page.**
Email-link sign-in next to Google; the signed-out landing page (logo, tagline, sign-in); a sign-in finds its person, and an invitee's first sign-in completes their join; a "you're not in a chapter yet" page. Until the switch these live at `/next` (the new home, which becomes `/`), `/finish-sign-in` and `/founders`, on dev data only; on the live site those addresses go to today's home page.
Mark does, once: upgrade to Blaze and set a $5 budget alert (done), and turn on email-link sign-in ([setup steps](firebase-hosting-setup.md#email-link-sign-in-phase-1-step-5)).

**6. Chapter home.**
Trips, Selection (active members), Members (roster with statuses and roles; organizers invite by email and see invitees, members don't), and My profile (bio, college, GHIN number). At `/founders`, `/founders/selection`, `/founders/members` and `/me`, on dev data until the switch. Adding someone sends no email: the organizer tells them which address to sign in with.

**7. Guide in the chapter.**
The guide, pairings, Fireball (it knows who's signed in, so no more "pick yourself") and player profiles. Importing a guide file stays until step 10. At `/founders/2026-columbia/guide`, linked from each trip on the Trips tab, on dev data until the switch.

**8. History in the chapter.**
History pages read the database, per chapter, members only. Player pages, the Players list and superlatives drop team logos; event and match pages keep that year's teams. The chapter's History tab, at `/founders/history`, `/founders/players` and `/founders/superlatives`, on dev data until the switch; today's public history pages keep reading the files until then.

**9. The switch.**
In three parts:
- **9a, freeze.** Today's live data goes read-only (the `-dev` copies stay writable), and today's pages say changes are paused. Once it's deployed, Mark runs the Move-over on the live site, which writes The Founder's Chapter into the live data, and checks its counts.
- **9b, switch**, after the live Move-over. The new pages go on for everyone and `/` becomes the new home; old addresses redirect into `/founders`; organizers' Export chapter downloads everything in the chapter as a backup; today's app code goes. The Move-over page stays, commissioner only, at `/move-over`. Lint runs on every pull request.
- **9c, cleanup**, once Mark is happy with 9b. The old rules go: the collections from before chapters, `-dev` copies included, are closed, and their data stays in the database (readable in the Firebase console) until it's deleted there. The history files and their build step, the Squabbit converter, the Move-over and the GitHub Pages forwarder go. Tests use The Founder's Chapter as the move left it, saved as a test fixture, and check UGL2 still comes out as the history files had it. Dev data lives under `envs/dev`.
History is members-only now, so the repo goes private ([steps](firebase-hosting-setup.md#making-the-repo-private-phase-1-step-9c)). Profile photos stay in the repo until Phase 2 moves them to uploaded storage. The `ugl-selector` forwarder points straight at the new address, since GitHub Pages stops with the repo private.

### C. Edit everything in the app

**10. Guide editors.**
Trip details, flights, houses and teams (name, color, emblem), rounds and tee times (with par and stroke index), format and rules (with how each session is scored), and football. Nightlife already has one. Importing guide files goes away.
Organizers start a trip's guide empty and fill in each part with its own Edit button; members see "The guide isn't ready yet" until something's in it. Teams and rounds keep their IDs, and the pairings draft follows them: removing a tee time takes its group with it, and a removed team leaves the draft. A session's matches are counted from its round's tee times (one per group in fourball, two in singles, one for a team total). For a trip with results, the teams, rounds, sessions and scoring are locked; names, houses, colors, rules and times can still change.

**11. Handicaps, invites and RSVPs.**
One pre-trip index per player, entered by the player or the organizer, next to their GHIN number linked to the official lookup. Pairings use it. Invites and RSVPs replace the planning spreadsheet's Invites tab: organizers see everyone invited, and members see RSVPs from people who have joined.
On the Trips tab, each upcoming trip has a "Who's coming" list. Organizers invite people from the roster (all active members in one click), change anyone's answer, note and handicap, take people off, and make the yeses the trip's attendees. Members see everyone who's joined and their answers, and answer for themselves (yes, maybe or no, with a note); a player who's coming enters their handicap index there, beside their GHIN number. Invitees' answers are organizers' notes, hidden from members, until they join; then an organizer's next save turns the note into an RSVP.

**12. Results.**
A results editor to add or fix a match. The Squabbit converter comes back writing straight to the database instead of to files.
Each trip has a Results page for organizers (`/founders/2026-columbia/results`, linked from its trip card and guide). Each session lists its matches: add one by typing its players and result (the players start from the guide's groups), fix or delete one, or type a team total. The Squabbit converter is part of the page rather than a script, so it needs no database keys: pick a session's group exports (CSV) and it reads them as the old script did (same checks against Squabbit's own net scores, singles pairs suggested from the guide's groups, names Squabbit spells differently picked from a list), fills in the round's par and stroke index and any missing handicaps, and shows the results before saving them in place of the session's. Every save is first checked as the history would be, and nothing is saved if a check fails. The first result makes the trip a competition, so the History tab shows it. Once a trip has results its teams and pairings are locked, like its guide's structure.

**13. Chapters.**
Request a chapter (from the landing page, after signing in). Admins approve, and the requester becomes its organizer. An admin page for chapters, organizers and co-admins (co-admins: commissioner only).
Anyone signed in asks for a chapter at `/request`, linked from "You're not in a chapter yet" and from their profile, and sees how it's going there. Admins get an Admin link in the header, to `/admin`: pending requests, approved with an address (suggested from the name, checked to be valid and free) and an organizer (the requester's existing record, or a new one with a sign-in for their email), or declined; every chapter with its members and organizers, linking to its Members tab, where admins change roles; and co-admins, which the commissioner adds by sign-in email or removes, and co-admins see.

**14. Installable app.**
Manifest, icons and a service worker: add to Home Screen, opens offline. It's small and independent, so it can move earlier.

## Known issues

- **Sign-in emails to Apple addresses** (icloud.com, me.com, mac.com) may never arrive: Apple's mail service tends to drop Firebase's default sender (`noreply@ugl-selector.firebaseapp.com`) without even a junk-folder copy. Gmail and others work. The fix is sending Firebase's emails from a domain the league owns (Firebase's custom email domain), once there is one; it's deferred until then. Meanwhile, anyone with a Google account can sign in with Google.

## After Phase 1

- **Phase 2:** results straight from Squabbit, without exporting files; photo and team logo upload.
- **Later:** push notifications (Blaze and a server function); App Store or TestFlight by wrapping this codebase with Capacitor.

## Decided with Mark on 2026-11-09

1. **Blaze plan** with a $5 budget alert: yes, before step 5.
2. **Firebase Hosting** at `university-golf-league.web.app`: yes, in step 1.
3. **Adam C** is an active member, so he's in the selection draw.
4. **The repo goes private** at the switch.
5. **The four assumptions** in the decisions doc are confirmed, with invitees hidden from members until they join.
