# Phase 1 Plan

How we'll build Phase 1, following the [Phase 1 decisions](phase-1-decisions.md). Drafted 2026-11-09 for Mark's review.

Each numbered step below is one pull request. The live site keeps working after every one.

## In short

1. **Groundwork:** hosting, tests, the new database layout and its rules, and a tool that moves today's data into The Founder's Chapter. Members see no change.
2. **The Founder's Chapter goes live:** today's features, rebuilt on the new database at chapter addresses, then one switch moves everyone over.
3. **Edit everything in the app:** guide editors, handicaps, invites and RSVPs, results, chapter requests, and the installable app.

UGL2 is done and the next trip is a year off, so the switch can happen whenever it's ready, with nobody mid-trip.

## Two decisions first

### 1. Move the Firebase project to the Blaze plan (recommended)

Blaze is pay-as-you-go with the same free allowances as today's Spark plan. At our size the bill should stay at $0. Set a budget alert at $5 a month (an alert warns; it doesn't cap spending).

Why:

- **Photos and logos.** Since February 2026, Cloud Storage needs Blaze. Spark projects can't use storage at all ([Firebase FAQ](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)).
- **Email-link sign-in.** On Spark, Firebase sends at most 5 sign-in emails a day for the whole project; Blaze's limit is far higher ([Firebase limits](https://firebase.google.com/docs/auth/limits)). A new chapter's organizer inviting a dozen people who don't use Google would hit that on day one.
- **Push notifications** (after Phase 1) need a small server function to send them, and Cloud Functions need Blaze.

If we stay on Spark: photos and logos get resized in the browser and stored in the database (fine at this size), email sign-in stays capped at 5 a day, and push waits.

Phase 1 doesn't upload photos (that's Phase 2), so this is needed by step 5, when email-link sign-in arrives.

### 2. Move hosting to Firebase Hosting (recommended)

- **Address:** a Hosting site named `university-golf-league` gives `https://university-golf-league.web.app` (if the name is free), with no `ugl-selector` in it. A custom domain can be added later.
- **Clean addresses:** one rewrite rule serves the app at every address. Today the build writes a copy of the page for every guide and history address, and once trips and history are members-only, the build can't read them to write those copies anyway.
- **Rules deploy with the site** from the repo, instead of being pasted into the Firebase console.
- **Preview links:** every pull request gets its own address to try on a phone before merging.
- **Free** on either plan at this size.
- **The repo could go private** afterwards. GitHub Pages needs a paid GitHub plan for private repos.
- **Old links keep working:** the GitHub Pages address forwards to the new one, the way `ugl-selector` forwards today.

## Database layout

```
config/admins                     { personIds }                  co-admins (the commissioner is fixed in the rules)
logins/{email}                    { personId, chapterId }        one per email: how a sign-in finds its person
people/{personId}                 { name, college, bio, ghin, photo, chapterIds, organizerOf, updatedAt }
chapterRequests/{requestId}       { name, note, requestedBy, status, decidedBy, createdAt }

chapters/{chapterId}              { name, createdAt }
  members/{personId}              { role: organizer | member, status: active | alumni | guest | invitee, since }
  trips/{tripId}                  { number, title, year, month, location, dates, timeZone, theme, competition,
                                    attendeeIds, selectedById, nextSelectorId }
    content/guide                 { flights, teams, rounds, format, football, nightlife }
    private/draft                 { published, captains, teams, rounds }       pairings draft, organizers only
    handicaps/{personId}          { index, updatedAt, updatedBy }               one pre-trip index per player
    rsvps/{personId}              { response: invited | yes | maybe | no, note, updatedAt }
    fireball/{personId}           { counts, updatedAt }
    matches/{matchId}             { session, match, sides, result, totals, scores }   today's match files
```

- **IDs are readable and permanent.** People keep today's history IDs (`mark-reese`); new people get one from their name. A trip's ID is its address (`2026-columbia`). The Founder's Chapter is `founders`.
- **One person record each.** It replaces today's two lists ("Mark R" on the Members page and "mark-reese" in the history), which are matched by name.
- **Guide and history share one model.** A trip's teams, rounds and sessions serve both. Rounds gain par and stroke index, and sessions gain how they're scored, as in today's `event.json`. The history pages assemble the same shape they read today, so the records and superlatives code stays as it is.
- **Numbering:** `number` is per chapter: UGL1 (2025 Lubbock, `competition: false`) and UGL2 (2026 Columbia) in The Founder's Chapter. A new chapter starts at 1.
- **Emails live only in `logins`**, so members don't see each other's addresses. Organizers see the emails their chapter invited.
- **Invitees are hidden from members.** Until someone joins, their roster entry, person record and RSVPs are visible only to organizers and admins. Their first sign-in with the invited email completes the join: their status changes to what the organizer invited them as (active member or guest), and members can see them from then on.
- **`chapterIds` and `organizerOf`** on a person mirror the rosters, so the rules can check "shares a chapter with" in one lookup. They're saved together with the roster, and the rules reject a save where they'd disagree.
- **Handicaps are their own records** so a player can enter their own. Members of the chapter can see them.
- **Offline:** the app keeps a local copy of what it has read, so the guide opens with no signal and Fireball shots save when the phone reconnects (today that only works while the page stays open).

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
- Every cell of the table becomes a test, allowed and denied, run against Firebase's local emulator on each pull request.

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

Old addresses (`/2026-columbia/guide`, `/history/…`, `/players/…`, `/superlatives`) go to the same page in The Founder's Chapter. Chapter IDs can't be words the app uses (`history`, `players`, `admin`, `me` and so on).

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
- **The draw.** Today's code leaves "Adam C" out of the draw by name. The new draw uses active members, so the name check goes away and Adam's status decides it.

## Steps

### A. Groundwork (members see no change)

**1. Hosting and deploys.**
Firebase Hosting with one rewrite rule; `firebase.json`; GitHub Actions deploys the site and the database rules; preview links on pull requests; GitHub Pages forwards to the new address. The build stops writing page copies.
Mark does, once: create the Hosting site, run `firebase init hosting:github`, allow the deploy account to publish rules, and add the new address to Google sign-in's allowed origins and Firebase's authorized domains. Before the first deploy, check that the rules in the console match `firestore.rules`.
Done when the site serves from the new address, old links forward, and a pull request shows a preview link.

**2. Tests and a local database.**
Vitest, the Firebase emulators (database and sign-in), `npm test`, and tests on every pull request. Local development can run against the emulators with sample data instead of the `-dev` collections.
Mark does, once: install Java (the emulator needs it).

**3. Data model and rules.**
Types and data hooks for the new layout, and rules for it, with a test for every cell of the role table. Today's rules stay as they are.

**4. Move-over.**
The move as plain code with the UGL2 comparison test, then the admin-only Move-over page.
Done when The Founder's Chapter is in the database and the test passes.

### B. The Founder's Chapter goes live

Steps 5 to 8 build the new pages at `/founders/…`, linked for admins only, while everyone else keeps using today's pages.

**5. Sign-in and landing page.**
Email-link sign-in next to Google; the signed-out landing page (logo, tagline, sign-in); a sign-in finds its person, and an invitee's first sign-in completes their join; a "you're not in a chapter yet" page.

**6. Chapter home.**
Trips, Selection (active members), Members (roster with statuses and roles; organizers invite by email and see invitees, members don't), and My profile (bio, college, GHIN number).

**7. Guide in the chapter.**
The guide, pairings, Fireball (it knows who's signed in, so no more "pick yourself") and player profiles. Importing a guide file stays until step 10.

**8. History in the chapter.**
History pages read the database, per chapter, members only. Player pages, the Players list and superlatives drop team logos; event and match pages keep that year's teams.

**9. The switch.**
Today's data goes read-only; a final move-over; old addresses redirect; everyone lands in The Founder's Chapter; Export downloads the whole chapter as a backup. Then the old code, old rules, history build step and `-dev` collections go.
History is members-only now, so the history files leave the public repo (they stay in its git history unless the repo goes private). Profile photos stay in the repo until Phase 2 moves them to uploaded storage.

### C. Edit everything in the app

**10. Guide editors.**
Trip details, flights, houses and teams (name, color, emblem), rounds and tee times (with par and stroke index), format and rules (with how each session is scored), and football. Nightlife already has one. Importing guide files goes away.

**11. Handicaps, invites and RSVPs.**
One pre-trip index per player, entered by the player or the organizer, next to their GHIN number linked to the official lookup. Pairings use it. Invites and RSVPs replace the planning spreadsheet's Invites tab: organizers see everyone invited, and members see RSVPs from people who have joined.

**12. Results.**
A results editor to add or fix a match. The Squabbit converter writes straight to the database instead of to files.

**13. Chapters.**
Request a chapter (from the landing page, after signing in). Admins approve, and the requester becomes its organizer. An admin page for chapters, organizers and co-admins (co-admins: commissioner only).

**14. Installable app.**
Manifest, icons and a service worker: add to Home Screen, opens offline. It's small and independent, so it can move earlier.

## After Phase 1

- **Phase 2:** Squabbit import in the app; photo and team logo upload.
- **Later:** push notifications (Blaze and a server function); App Store or TestFlight by wrapping this codebase with Capacitor.

## Questions for Mark

1. **Blaze plan** with a $5 budget alert? Needed by step 5.
2. **Firebase Hosting** at `university-golf-league.web.app`? Needed for step 1.
3. **Adam C:** today's draw leaves him out by name. Should he be a guest (not in the draw) or an active member?
4. **Private repo** after the switch, so the old history files aren't public either? Optional.

Settled: the four assumptions in the decisions doc are confirmed, with invitees hidden from members until they join.
