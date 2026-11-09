# Phase 1 Decisions

Decided with Mark on 2026-11-09, after UGL2. These set the direction for Phase 1: one data model in the database, every piece of content edited in the app, chapters, and history that follows individuals rather than teams.

## At a glance

| Area | Decision |
| --- | --- |
| App | Installable web app first (add to Home Screen, offline, push). Decide on the App Store later. One codebase. |
| Chapters | UGL becomes a league of chapters. Today's group is **The Founder's Chapter**. |
| New chapters | Any signed-in member can request one. Once an admin approves, the requester becomes its Chapter Organizer. |
| Who sees what | Members see only the chapters they belong to, and in each one only the people who have joined. Admins see every chapter. |
| Signed-out visitors | A landing page: UGL logo and tagline, sign-in, and a way to request a chapter. Nothing else. |
| Roles | Commissioner (Mark), co-admins (everything, every chapter), Chapter Organizers (everything in their chapter), members. |
| Membership | A person can belong to several chapters, with one profile that follows them. |
| Joining | The organizer invites by email; access comes with signing in with that email. |
| Sign-in | Google, plus a no-password email link for people without Google. |
| Profiles | Each person edits their own photo, bio and college; admins and organizers can fix anyone's. |
| People in a chapter | Active members, alumni, guests and invitees (with RSVPs). |
| History | Members only, per chapter. Records and superlatives belong to a chapter and are never combined across chapters. |
| Guests | Their results count like anyone's: records, superlatives and team points. |
| Teams | Set per trip: name, color and an uploaded logo. Player pages and superlatives show no team logos. |
| Handicaps | One pre-trip index per player per trip, entered by hand, with the player's GHIN number stored and linked to the official lookup. Used for team drafting and history. |
| Numbering | Per chapter: this year stays UGL2 in The Founder's Chapter, and a new chapter starts at 1. |
| Editing | Everything is edited in the app. No more JSON uploads; Export stays as a backup. |

## Name and address

- **Name:** the project is **University Golf League**. The GitHub repo is `university-golf-league` (renamed from `ugl-selector` on 2026-11-09), and so is the folder on Mark's Mac.
- **Address:** `https://mreese84.github.io/university-golf-league/` until there's a custom domain.
- **Old links:** a small `ugl-selector` repo forwards them to the same page at the new address.
- **What still says `ugl-selector`:** only the Firebase project ID, which can't be changed and only shows behind the scenes.

## Details

### App
- **The web app is installable:** a manifest, icons and a service worker, so it can be added to the Home Screen and work offline. On iPhone, push notifications work once it's added to the Home Screen (iOS 16.4+).
- **App Store or TestFlight later:** that would mean wrapping this same codebase with Capacitor. There's no plan for a second codebase.

### Chapters and roles
- **Commissioner:** Mark. Everything, and the only one who can add or remove co-admins.
- **Co-admins:** everything in every chapter, including approving chapter requests.
- **Chapter Organizer:** admin rights for their own chapter's trips, guides, results and people. The person whose request was approved becomes the chapter's first organizer. A chapter can have more than one organizer.
- **Members:** see their own chapters; edit their own profile; log their own Fireball shots.

### People
- **One person record each:** name, email(s), photo, bio, college and GHIN number. It replaces today's two lists: members (for example "Mark R") and history players ("mark-reese"), which are currently matched by name.
- **Chapter status:** in each chapter, a person is an active member, alumni, a guest or an invitee. The selection draw uses active members.
- **Invites and RSVPs:** these replace the planning spreadsheet's Invites tab.
- **Invitees stay hidden until they join.** Members see only people who have joined: active members, alumni and guests, with their RSVPs. Organizers and admins see everyone invited. An invitee joins the first time they sign in with the email they were invited with.

### History
- **Members only, per chapter.** Today's public history pages become sign-in only, so shared links will ask people to sign in and link previews will be generic.
- **Individual pages:** player pages, the Players list and superlatives show photo, name and record, with no team logos. Event and match pages keep that year's teams, names, colors and logos, because that's accurate to the year.
- **Guests:** they count like anyone.

### Handicaps
- **One index per player per trip.** The player or the organizer enters it before the trip, with a link to that player's GHIN record for checking. The USGA has no public GHIN API, so it can't be pulled in automatically.
- **Where it's used:** team drafting and history. Scorecards still record the strokes actually given in each match; those are the facts of the round.
- **UGL2 changes to the pre-trip numbers when it's moved over:** Mark 16.6, Justin 4.0, Jason 18.0, Patrick 15.6; everyone else is unchanged. Match results don't change.

## What Phase 1 involves (for planning)

- **Database layout** (Firestore):
  - people
  - chapters, each with members (role and status), trips and admin requests
  - inside each trip: the guide, teams, handicaps, RSVPs, the pairings draft, matches and Fireball counts
- **Security rules:** chapter membership and roles enforced by the database, not just the app.
- **Admin editors:** for every part of the guide that's file-only today (trip details, flights, houses, rounds and tee times, format and rules, football), for trips, people and chapters, and for results.
- **Move today's data into The Founder's Chapter:**
  - members and trips (including UGL1, 2025 Lubbock, as a trip with no competition)
  - the 2026 guide and draft
  - Fireball counts, bios and colleges
  - the history files, mapping today's member IDs to person records
- **Squabbit import and photo upload in the app** are Phase 2. Until then, results keep coming in through the converter.

## Assumptions, confirmed with Mark on 2026-11-09

1. A chapter can have more than one organizer.
2. Only Mark can add or remove co-admins.
3. Members of a chapter see only confirmed, registered members and guests. They can't see anyone who has been invited until that person officially joins. (Changed: the first draft let members see the invite list.)
4. Players can enter their own pre-trip index, and the organizer can change it.

## Technical questions for the Phase 1 plan

Recommendations for both are in the [Phase 1 plan](phase-1-plan.md).

- **Where photos and logos live:** Firebase Storage may require the pay-as-you-go (Blaze) plan, which costs pennies at this size. The alternative is storing small, resized images directly in the database.
- **Hosting:** stay on GitHub Pages, or move to Firebase Hosting. Firebase Hosting gives clean addresses without generating a page copy for every route.
