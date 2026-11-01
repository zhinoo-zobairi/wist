# User accounts in WIST — Design

**Date:** 2026-11-01
**Status:** Awaiting the owner's decision on D1–D18 below. Nothing is built.
**Issues:** answers the "Accounts" and "Account deletion" bullets of #26;
supersedes the pairing model of #20 (keeps its approved values); needs #24;
changes the shape of #25; replaces #21's public-host plan for now; touches #22
and #13.

## Problem

WIST has one user, the owner. The catalogue service recognises them by one
bearer token, and the same token is compiled into the app bundle. Before anyone
else can use the app it needs:

1. sign up and sign in;
2. each person's coveted pieces, sizes, alerts, style brief, wardrobe and photos,
   outfits, location and daily pick kept apart;
3. account deletion inside the app (App Store guideline 5.1.1(v));
4. GDPR basics: a privacy policy, export and deletion, a stated place where the
   data lives;
5. a limit on what each person can spend of the owner's Anthropic key;
6. a catalogue reachable from the public internet, which today it is not.

## Ownership boundary

After this change the catalogue service is responsible for things it never owned:

| New responsibility | What it means in practice |
|---|---|
| Identity and sessions | It decides who a request belongs to, issues and revokes sessions. |
| Personal data of many people | Style briefs with clothing sizes, wardrobe photos (which may show people), coarse location, shopping wishes. The owner becomes a GDPR controller for strangers. |
| A public endpoint | The AtomMan in the owner's home answers the internet, not only the tailnet. |
| Per-user AI cost | Every person can trigger Opus and Sonnet calls on the owner's key. |
| Deletion and export | It must find and remove or hand over everything one person left behind. |

Is the catalogue the right owner? It already holds all of this data for one
person, in one process and one SQLite file, and the app only talks to it. A
second service (an auth server, a hosted user database) would not remove any of
the five responsibilities: the personal rows stay in the catalogue either way.
So this design keeps **one service** and adds the thinnest identity layer that
works: **Apple owns the credentials, the catalogue owns sessions and data.** The
owner must accept these five responsibilities before anything below matters
(that is the go/no-go of #26).

What the design adds, in total: **two new tables** (`users`, `sessions`), a
`user_id` on the personal tables, **no new schedule and no polling** (expired
sessions are cleaned at sign-in; rate and AI counters live in memory), two
outbound calls to Apple (at sign-in and at deletion), and one public hostname.

## What is already true (checked in the code, 2026-11-01)

**The single owner**

- `catalogue-service/src/ownerAuth.ts` compares SHA-256 of the `Authorization`
  header with SHA-256 of `Bearer <CATALOGUE_OWNER_TOKEN>` using `timingSafeEqual`.
  No token configured → `503 <route>_not_configured`; wrong or missing → `401`.
- `ownerAuthError` guards `/v1/profile`, `/v1/watches`, `/v1/watches/:id`,
  `/v1/alerts`, `/v1/location`, `/v1/wardrobe/...`, `/v1/outfits/...`
  (`app.ts`, `locationRoutes.ts`, `wardrobeRoutes.ts`, `outfitRoutes.ts`).
- **No token is needed** for `GET /health`, `/v1/brands`, `/v1/brands/:id/items`
  and `/v1/items/:id`.
- `server.ts` sends `access-control-allow-origin: *`, binds `CATALOGUE_HOST`
  (default `127.0.0.1`), and on the AtomMan sits behind Tailscale Serve
  (`docs/HOSTING_ATOMMAN.md`, never Funnel, because the web bundle holds the token).
- The app reads `EXPO_PUBLIC_CATALOGUE_OWNER_TOKEN` in
  `src/services/catalogueClient.ts`; `authorizationHeaders` throws without it,
  and `garmentPhotoSource` puts the same header on wardrobe photo loads.
- `.env.example` holds both variables. No JWT, Keychain or Apple sign-in package
  is a dependency today (`package.json`). The iOS bundle id is `com.wist.app`
  (`app.json`).

**Tables holding the owner's data (all in one SQLite file)**

| Repository | Table | Today's key | Personal? |
|---|---|---|---|
| `sqliteRepository.ts` | `catalogue_brands`, `catalogue_items`, `catalogue_media`, `catalogue_variants`, `price_observations` | item / brand id | **Shared** product facts |
| | `catalogue_watches` | `item_id` PK | Personal (coveted) |
| | `catalogue_watch_sizes` | `(item_id, label)` | Personal |
| | `catalogue_watch_prices` | `item_id` PK | Personal (coveted price, lowest announced) |
| | `price_drop_alerts` | `UNIQUE (item_id, observed_at)` | Personal (depends on the person's coveted price and threshold) |
| `sqliteStyleProfileRepository.ts` | `style_profiles` (+ `drop_threshold`, `size_*`, `fit_*`, `taste_*`, `shops_for` columns) | `id = 'owner'` (`OWNER_PROFILE_ID`) | Personal |
| | `style_profile_occasions`, `_styles`, `_help`, `_palettes`, `_never_colours`, `_signature`, `_gaps` | `profile_id` | Personal |
| `sqliteWardrobeRepository.ts` | `garments`, `garment_colors`, `garment_occasions` | garment UUID | Personal |
| | `wardrobe_change_log` | singleton `id = 1` | Personal |
| `sqliteOutfitRepository.ts` | `outfit_suggestions`, `outfit_suggestion_garments`, `saved_outfits`, `saved_outfit_garments` | outfit id | Personal |
| | `outfit_runs` | run id, pruned after 7 days | Personal |
| | `outfit_requests`, `outfit_location`, `daily_pick` | singleton `id = 1` | Personal (location is rounded to 0.01°, `weather.ts`) |
| `garmentPhotoStore.ts` | `wardrobe-photos/<garmentUuid>.<ext>` on disk, ≤ 5 MB each | garment UUID | Personal |

- `SqliteCatalogueRepository` reads the one drop threshold through
  `dropThreshold: () => profiles.getDropThreshold()` (`server.ts`).
- The watch cycle (`watchScheduler.ts`) observes every watched item once per
  6 h, one after another, through `politeFetch` (10 s between requests to one
  host, 60 s for `gaala.com`). An alert is decided in `recordObservation`
  against the one coveted price, the one size list and the one threshold.
- Product import (`POST /v1/watches`) goes through `productObservation.ts`: a
  known JSON-LD storefront by host, **otherwise the generic Shopify path, which
  accepts any `https` hostname** that is not `localhost` or an IP literal
  (`shopifyProduct.ts` `validateProductUrl`).
- Backups (`backupData.ts`): nightly `VACUUM INTO` plus a full copy of
  `wardrobe-photos/` into `/mnt/c/WistBackups` on the same machine, **7 kept**.

**What lives only on the phone** (`src/store/useWistStore.ts`, AsyncStorage key
`wist-preferences`): `followedBrandIds`, `followsSeeded`, `introSeen`,
`onboardingDraft`, `notifiedAlertIds`, `alertBaselineEstablished`, `snapshots`,
`priceOverrides`, plus cached copies of server state (`starredItemIds`,
`watchedSizesByItemId`, `alerts`, the style answers, `profileUnsynced`). The app
polls `/v1/alerts` every 60 s while open (`App.tsx`) and raises local
notifications.

**AI calls, all on one `ANTHROPIC_API_KEY`**

| Call | Model, `max_tokens` | When | Cap today |
|---|---|---|---|
| `claudeGarmentTagger.ts` | Opus 5.5, 2,000 | Synchronously in the photo upload request and in a forced retag | None |
| `claudeOutfitSuggester.ts` | Opus 5.5, 16,000 | Outfit run: 10 min after a wardrobe/brief change, 03:00 catch-up, "more ideas" | `DAILY_RUN_CAP = 12` runs per cap day (03:00→03:00), `429 daily_limit_reached` |
| `claudeOutfitPicker.ts` | Sonnet 5.5, 8,000 | Daily pick at 06:00 local, only with a location | Once per day |

`outfitScheduler.ts` ticks every 60 s and runs one Claude call at a time.

**Issues read:** #20 (pairing; approved values: wrong-token throttle 10 per IP
per 10 min, a correct token always wins, in-memory, 10,000-IP cap, proxy header
only with `CATALOGUE_TRUST_PROXY=1`, https-only server URLs in release builds),
#21 (Fly.io, deferred for the AtomMan), #24 (TestFlight, needs the Apple
Developer membership), #25 (push, devices unkeyed by person), #26 (the gate;
lists accounts, deletion, #13 legal, costs at scale, privacy policy).

**Apple and Expo facts (fetched 2026-11-01)**

- Guideline 4.8: an app that uses a third-party or social login for the primary
  account must also offer a login that limits data to name and email, lets the
  user hide their email, and does not track. Not needed when the app uses only
  its own account system. Sign in with Apple meets it.
- Guideline 5.1.1(v): an app that supports account creation must offer
  account deletion in the app. Apple's deletion page says apps using Sign in with
  Apple *should* revoke the user's tokens through the Sign in with Apple REST
  API; confirming the user's intent (re-authentication) is allowed; data kept for
  legal reasons must be disclosed.
- Guideline 3.1.1: unlocking features (subscriptions, premium content) inside the
  app must use in-app purchase.
- `expo-apple-authentication` works on iOS and in Expo Go (Expo Go's
  identifiers differ from a standalone build), not on web. It needs
  `ios.usesAppleSignIn: true` in the app config for real builds.

## Decisions — owner approval required (do not start until ticked)

Every value below is a proposal. "Existing" marks behaviour that is already
true; everything else is a new choice.

### Identity

- [ ] **D1. Sign in with Apple only, asking Apple for no name and no email.**
  The catalogue stores only Apple's stable user id (`sub`). No passwords, no
  email sending, no reset flow, nothing to leak but a pseudonymous id. Apple's
  4.8 rule does not bite because no third-party login is offered.

  | Option | Moving parts | Works for |
  |---|---|---|
  | **Sign in with Apple only (recommended)** | Apple's button, one token check on the server, revocation at deletion (D15) | iOS app and Expo Go. Not web, not Android. |
  | Email magic link | An email provider (new processor), link handling in the app (universal links + a domain), single-use codes with expiry (new table) | Everywhere |
  | Email and password | Password hashes, reset by email (so the email provider anyway), breached-password risk | Everywhere |
  | Apple + magic link | Both columns above | Everywhere |

  Consequence: an account is tied to an Apple ID. Someone with only Android or
  only a browser cannot use WIST (it is an iOS app today). If a person signs in
  on a second iPhone with the same Apple ID they get the same account.

- [ ] **D2. The catalogue service issues and checks sessions itself.** It verifies
  Apple's identity token with **`jose`** (new backend dependency; hand-written
  JWT checks are the classic place for security bugs) and then issues its own
  session token. No hosted auth provider.

  Why not Supabase Auth, Clerk, Firebase Auth or Auth0: with Apple as the only
  method they add nothing Apple does not already do, and they add a processor
  outside the AtomMan (often in the US), a vendor account, pricing tiers
  (not checked here) and a network dependency for every sign-in, while the
  personal rows still live in the catalogue. They would earn their place only
  with email methods (D1 options 2–4).

- [ ] **D3. Session tokens.** 32 random bytes from `crypto.randomBytes`,
  base64url, sent as `Authorization: Bearer <token>`. The server stores only
  SHA-256 of the token in a new `sessions` table, so a copied database holds no
  usable tokens; lookup is by hash, so no timing comparison is involved.
  - **Lifetime: fixed 180 days from sign-in**, no sliding renewal (no write on
    every request). After that the app gets `401` and shows the sign-in button
    again (one tap).
  - **Cleanup without a schedule:** a user's expired sessions are deleted when
    that user next signs in; sign-out deletes its own row; account deletion
    deletes all. Expired rows of people who never return stay until they do
    (a few bytes each; limitation accepted).
  - **On the phone:** the token lives in the iOS Keychain via
    **`expo-secure-store`** (new app dependency), key `wist-session`.
  - Tokens and Apple ids are never logged; logs may name the internal user id.

- [ ] **D4. What the server checks in Apple's identity token.** Signature against
  Apple's published keys (`https://appleid.apple.com/auth/keys`), `iss =
  https://appleid.apple.com`, `aud` in `CATALOGUE_APPLE_AUDIENCES`, not expired,
  and `nonce` equal to SHA-256 of the nonce the app sends next to the token (the
  app makes a fresh random nonce per sign-in).
  - Production `CATALOGUE_APPLE_AUDIENCES=com.wist.app` (the bundle id in
    `app.json`; it must be registered in the owner's Apple Developer account,
    see #24). The Mac's dev catalogue also accepts Expo Go's audience
    (expected `host.exp.Exponent`; confirm on the first Expo Go sign-in).
    **Never** add Expo Go's audience on the AtomMan: any Expo Go project could
    then mint tokens our server accepts.
  - Apple's keys are fetched with `jose`'s remote key set, which caches them and
    refetches when an unknown key id appears. Its default cache and cooldown
    times are inherited (confirm the values when building); the fetch gets a
    **5 s timeout** (new), **no retries**: a failed fetch is a failed sign-in the
    person can repeat.

### Data

- [ ] **D5. Data model: a `user_id` on every personal row, shared tables untouched.**
  New tables:
  ```sql
  CREATE TABLE users (
    id TEXT PRIMARY KEY,              -- random UUID; 'owner' for the migrated owner (D6)
    apple_sub TEXT UNIQUE,            -- NULL only for the unclaimed 'owner'
    created_at TEXT NOT NULL
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,      -- SHA-256 hex of the bearer token
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  ```
  Changed tables (all with `user_id TEXT NOT NULL`):

  | Table | Change |
  |---|---|
  | `catalogue_watches` | PK `(user_id, item_id)` (rebuild) |
  | `catalogue_watch_sizes`, `catalogue_watch_prices` | key `(user_id, item_id, …)`, cascade from the watch (rebuild) |
  | `price_drop_alerts` | `UNIQUE (user_id, item_id, observed_at)` (rebuild) |
  | `style_profiles` and its child tables | **no schema change**: `id` becomes the user id (the owner's row already is `'owner'`) |
  | `garments` | add `user_id`, index it; colours and occasions cascade as today |
  | `outfit_suggestions`, `saved_outfits`, `outfit_runs` | add `user_id`, index it |
  | `wardrobe_change_log`, `outfit_requests`, `outfit_location`, `daily_pick` | singleton `id = 1` → PK `user_id` (rebuild) |

  Unchanged and shared by everyone: `catalogue_brands`, `catalogue_items`,
  `catalogue_media`, `catalogue_variants`, `price_observations`. One storefront
  fetch per watched item per cycle, however many people covet it.
  Photos stay flat in `wardrobe-photos/<garmentUuid>.<ext>`: garment ids are
  UUIDs, ownership comes from `garments.user_id`, and `DiskGarmentPhotoStore`
  does not change.

  Behaviour that becomes per person: `recordObservation` decides an alert for
  **each watcher** of the item with that person's coveted price, lowest
  announced price, sizes and drop threshold (`dropThreshold(userId)`).

  Stays on the phone, unchanged: follows (`followedBrandIds`), intro, onboarding
  draft and the alert-announcement memory. No new server data for them. A new
  device starts with the existing follow seeding.

- [ ] **D6. Migrating the owner's data to their account.**
  1. Before deploying: `npm run catalogue:backup` (existing script). The
     migration is one-way; going back means `npm run catalogue:restore`.
  2. At first start the migration (in each repository's constructor, as today's
     column migrations do, with the `garments_new` rebuild precedent in
     `sqliteWardrobeRepository.ts`) creates user `'owner'` with `apple_sub =
     NULL` **only if personal rows exist**, and writes `user_id = 'owner'` on all
     of them. A fresh database gets no placeholder.
  3. The owner signs in once with the TestFlight build. That creates a new,
     empty account; Profile shows its **account ID** (the internal UUID).
  4. On the AtomMan: `npm run accounts:link-owner -- <account ID>` (new script).
     In one transaction it moves that account's `apple_sub` onto `'owner'` and
     deletes that account with its sessions. If the new account already holds
     rows (for example a brief from onboarding), the script lists them and stops
     unless run again with `--discard`.
  5. On the phone: Sign out, then Sign in. The same Apple ID now opens the
     owner's old data, and sign-out has cleared the empty account's local cache.

  Why a script with an ID read off the owner's own phone, and not "the first
  sign-in claims the owner's data": on a public endpoint a stranger could sign in
  first and receive the owner's wardrobe. The script has no network path, and the
  ID cannot be confused with anyone else's account, so the public hostname may
  already be on.

- [ ] **D7. Every `/v1` route needs a session; `/health` stays open.** Today
  brands and items are readable without a token. On a public host that would let
  anyone list every piece every person ever pasted. Signed-in people see the
  whole shared catalogue, as the owner does today (Home shows pieces from
  followed houses, whoever imported them; no person is named).

### Cost and load per person

- [ ] **D8. Product import accepts only supported houses.** `POST /v1/watches`
  takes a URL only when its exact host is in a fixed list in code. Proposed list,
  checked 2026-11-01:
  - `de.sandro-paris.com`, `de.claudiepierlot.com`, `www.bobbies.com` (the
    `host:` fields in `sandroProduct.ts`, `claudiePierlotProduct.ts`,
    `bobbiesProduct.ts`);
  - `gaala.com`, `www.goelia1995.com` (the Shopify houses with recorded
    fixtures, `fixtures/gaala-product.json`, `fixtures/goelia-product.json`,
    and their test URLs).

  If the owner already covets pieces from another Shopify host on the AtomMan,
  the owner names it and it is added to this list by hand before the change
  lands; the list is never read from the database. Anything not on the list →
  `422 unsupported_house`.
  The list gates **import only**. A piece already coveted from a host that is not
  on the list keeps being observed every 6 h cycle with the existing per-host
  spacing, until it is un-coveted. Today only the owner holds a token, so every
  such piece was chosen by the owner.
  Today any stranger could make the AtomMan fetch any `https` host from the
  owner's home connection, including names that resolve to addresses on the
  home network. Adding a house becomes a one-line code change, as it already is
  for the JSON-LD ones.

- [ ] **D9. Per-person AI limits, the same for every account including the owner's.**
  "Day" is the existing cap day, 03:00→03:00 AtomMan time (Europe/Berlin).

  | Call | Proposed limit | Today |
  |---|---|---|
  | Garment tagging (upload or forced retag) | **20 per person per day**; the 21st upload gets `429 ai_daily_limit` and nothing is stored. Adding a garment by hand is not limited. | Unlimited |
  | Outfit runs | **3 per person per day** (`DAILY_RUN_CAP` 12 → 3) | 12 |
  | Daily pick | 1 per person per day (existing) | 1 |

  - The tagging count is kept **in memory** (resets when the service restarts,
    so on a deploy day a person could get up to 40). Outfit runs are already
    counted in `outfit_runs`, which becomes per person.
  - The scheduler loops over people each 60 s tick and still makes **one Claude
    call at a time** (existing). Consequence: at 06:00 the picks run one after
    another; with 25 people the last one may land several minutes later
    (each call's duration is not measured).
  - Each Claude call logs its `usage` token counts (no personal data), so the
    owner can read real costs instead of these ceilings.
  - **Backstop outside the code:** a monthly spend limit on the Anthropic
    workspace that holds WIST's key, proposed **$100 per month** (the owner's
    budget call; find the exact setting in the Anthropic Console). When it is
    hit, calls fail and the existing failure paths apply (tag status `failed`,
    run `failed`, no pick that day).
  - **No paid plan now.** A paid tier must use in-app purchase (3.1.1), which
    means StoreKit, receipt checks and App Store server notifications: its own
    spec under #26. Prices for such a plan are unknown and not proposed here.

  Ceiling per call, from the code's `max_tokens` and Anthropic's list prices
  (Opus 5.5 $4 in / $20 out per million tokens, Sonnet 5.5 $2 / $10; check the
  live price page before relying on them). Output includes thinking. Input sizes
  are **estimates** (a phone photo ≈ 1,600 tokens after Anthropic downscales
  it; a large wardrobe ≈ 15,000 tokens), to be replaced by the logged `usage`:

  | Call | Output ceiling | Input estimate | Ceiling per call |
  |---|---|---|---|
  | Tagging (Opus) | 2,000 → $0.040 | ~2,600 → $0.010 | ≈ $0.05 |
  | Outfit run (Opus) | 16,000 → $0.320 | ~15,000 → $0.060 | ≈ $0.38 |
  | Daily pick (Sonnet) | 8,000 → $0.080 | ~15,000 → $0.030 | ≈ $0.11 |

  Worst case per person per day with D9's limits: 20 × 0.05 + 3 × 0.38 + 0.11
  ≈ **$2.25**; with 25 accounts (D10) every day for 30 days ≈ **$1,690 per month**.
  That ceiling is why the spend limit exists. Real use should be far lower:
  runs happen only after a wardrobe or brief change, tagging mostly while a
  wardrobe is being built, and replies rarely reach `max_tokens`. Unmeasured.

- [ ] **D10. At most 25 accounts.** `CATALOGUE_MAX_ACCOUNTS=25`, counted in
  `users` (no new data). Sign-in by a new Apple ID beyond that gets
  `403 accounts_full`; the app says WIST is full for now and links to the
  waitlist on the site. Existing accounts always sign in. This bounds cost
  (D9), storage (D11) and the watch cycle.

- [ ] **D11. Per-person storage and watch limits.**
  - **Coveted pieces: at most 50 per person** (new; `409 watch_limit_reached`).
    With 25 people that is at most 1,250 watched items, so one cycle stays
    within the 6 h interval at the existing spacing (10 s per host, 60 s for
    gaala.com: at most 360 gaala.com items per 6 h).
  - **Imports: at most 20 per person per hour** (new, in memory). Each one is a
    storefront fetch from the owner's home connection.
  - **Garments: 300 per person** (existing `MAX_GARMENTS`, now per person).
  - **Photos unchanged:** up to 5 MB each, uploaded at full quality (existing).
    Worst case 300 × 5 MB = 1.5 GB per person; 25 people = 37.5 GB live, and
    the 7 nightly backups copy the photos folder in full each time. Realistic
    (50 garments × 3 MB per person) ≈ 3.75 GB live, ~30 GB with backups.
    The owner checks the AtomMan's free disk before opening sign-ups; shrinking
    photos on the phone before upload is a follow-up if needed.

### Public reachability and security

- [ ] **D12. Throttles (in memory, per process).** Reuses #20's approved shape:
  - Wrong, expired or unknown session tokens: after **10 per IP within 10 min**,
    that IP gets `429 too_many_attempts` for the rest of the window; a valid
    session always wins (#20, approved).
  - Sign-in requests: **10 per IP per 10 min** (new, same numbers).
  - At most **10,000 IPs** tracked; the oldest are forgotten first (#20, approved).
  - The client IP comes from `CF-Connecting-IP` only when
    `CATALOGUE_TRUST_PROXY=1` (#20 approved the switch; the header changes from
    Fly's to Cloudflare's); otherwise the socket address.
  - No general per-request limit: mobile carriers put many people behind one IP,
    and SQLite reads are cheap. The expensive routes are limited by D9 and D11.
  - Existing and kept: request body limits (`MAX_JSON_BODY_BYTES`, 5 MB photos),
    `access-control-allow-origin: *` (fine with bearer tokens, #21's reasoning),
    https-only server URLs in release builds (#20, approved).

- [ ] **D13. The API goes public through the Cloudflare Tunnel the site already
  plans to use.** One more ingress rule: `api.<owner's domain>` →
  `http://127.0.0.1:4000`. The service keeps listening on `127.0.0.1` only
  (existing), so nothing on the home Wi-Fi or router changes and the home IP
  stays hidden. Release builds use `EXPO_PUBLIC_CATALOGUE_URL=https://api.<domain>`.

  | Option | For | Against |
  |---|---|---|
  | **Cloudflare Tunnel (recommended)** | Same `cloudflared` as the site, own domain, home IP hidden, DDoS absorbed | TLS ends at Cloudflare, so Cloudflare sees all API traffic, photos included: it becomes a processor in the privacy policy |
  | Tailscale Funnel | Already installed; TLS ends on the AtomMan | `*.ts.net` name only, the tailnet name becomes public, Serve and Funnel share the node's config |
  | Router port forward + Caddy | No third party in the data path | Home IP public, router changes, attacks hit the home line directly |

  Cloudflare limits a proxied request to about 100 s (verify for tunnels).
  Photo upload tags synchronously in the request, so the Opus call must finish
  inside that; it does today on the Mac (not measured on the AtomMan).

- [ ] **D14. The private web app retires when the owner's TestFlight build is
  signed in.** Sign in with Apple has no web flow in `expo-apple-authentication`,
  and once the owner token is gone the bundle has nothing to sign in with. Steps:
  delete `web-build/` on the AtomMan (the static handler already turns itself
  off when the folder is missing) and `tailscale serve --https=443 off`.
  Tailscale itself stays for the owner's remote access.
  Alternative: keep it on the tailnet with a web-only "paste a session code"
  screen fed by a `npm run accounts:session` script. More code for one user;
  not recommended.

- [ ] **D15. Account deletion in the app.** Profile → "Delete account" → a
  confirmation sheet → Sign in with Apple once more (Apple allows this
  confirmation step; it also yields a fresh one-time authorization code) →
  `DELETE /v1/account { authorizationCode }`. The server, in this order:
  1. exchanges the code for Apple tokens and calls Apple's revoke endpoint, so
     WIST disappears from the person's Apple ID settings. Needs a Sign in with
     Apple key from the Developer account: `APPLE_TEAM_ID`, `APPLE_SIWA_KEY_ID`,
     `APPLE_SIWA_KEY_PATH` (the `.p8` file, outside git). Timeout **5 s**, **no
     retries**; **if Apple fails, deletion goes ahead** and the failure is logged
     (the person can still remove WIST in Settings → Apple ID → Sign in with Apple).
  2. deletes, in one transaction, the user row and every personal row (sessions,
     watches with sizes and prices, alerts, profile, garments, outfits, runs,
     requests, location, daily pick);
  3. deletes that person's photo files.

  Shared product rows stay (they are not personal). The app then clears the
  Keychain session and `wist-preferences` and returns to the sign-in screen.
  Copies remain in the nightly backups for **up to 7 days** (existing retention,
  #22) and the policy says so. No Apple tokens are ever stored.

- [ ] **D16. Data export on request, not in the app.** A person emails the
  contact address with the account ID shown in their Profile; the owner runs
  `npm run accounts:export -- <account ID>` (new script), which writes one folder
  with `account.json` (every personal row) and that person's photos, and sends
  it. GDPR gives one month to answer. Apple does not require an in-app export.
  Limitation: the account ID is the only proof the requester owns the account
  (it is a random UUID visible only inside their signed-in app). An in-app
  export, authenticated by the session, is the later option that removes it.

- [ ] **D17. Privacy policy and where the data lives.** A Datenschutzerklärung at
  `https://<domain>/datenschutz` (the site's existing `[DATENSCHUTZ URL]`
  placeholder), linked from the sign-in screen, Profile and App Store Connect,
  next to the Impressum. The owner writes or commissions the legal text; this
  spec only fixes the facts it must state:
  - controller: the owner (Impressum details); contact address;
  - data: Apple user id (no name, no email), style brief with clothing sizes and
    fit answers, coveted pieces with sizes and prices, alerts, wardrobe items,
    tags and photos, outfits, latest location rounded to about 1 km, daily pick;
    IP addresses held in memory for throttling only;
  - purpose and basis: providing the service the person signed up for
    (Art. 6(1)(b) GDPR); location only when the person allows it in iOS;
  - where: the owner's AtomMan mini PC in their home in Germany; backups on the
    same machine, 7 nightly copies;
  - recipients: Anthropic (photos, tags and brief for tagging and outfits; US),
    Cloudflare (all traffic passes through it, D13; US), Apple (sign-in),
    Open-Meteo (rounded coordinates for the weather). For each, the owner checks
    the data processing terms and the basis for transfers outside the EU before
    publishing; none are verified here;
  - rights: access/export (D16), correction (in the app), deletion (in the app,
    D15), complaint to the owner's state data protection authority;
  - minimum age **16** (the German age of digital consent); no age check in code.

  App Store Connect's privacy questions are answered from the same list: no
  tracking, data linked to the person, nothing used for ads.

- [ ] **D18. Encrypt the AtomMan's disk.** Strangers' photos will sit on a machine
  in a flat. Turn on BitLocker (or Windows device encryption, whichever the
  AtomMan's Windows edition offers; check which) before the first non-owner
  signs up. No code.

## Design

```text
iPhone app ── Sign in with Apple ─▶ Apple ─▶ identity token (+ nonce)
    │
    └─ https ─▶ Cloudflare edge ─▶ cloudflared (WSL) ─▶ 127.0.0.1:4000 wist-catalogue
                                                          ├─ POST /v1/session  → verify token (jose, Apple keys) → users, sessions
                                                          ├─ /v1/... (Bearer)  → sessions → userId → repositories(userId)
                                                          └─ /health           → open
watchScheduler ─▶ distinct watched items ─▶ politeFetch ─▶ recordObservation ─▶ one alert per watcher
outfitScheduler tick ─▶ for each user ─▶ runDueOutfitGeneration / runDueDailyPick (one Claude call at a time)
```

### Server

- New `catalogue-service/src/accounts.ts` (with tests): `SqliteAccountRepository`
  on the same database file (the `SqliteStyleProfileRepository` precedent):
  `findOrCreateByAppleSub(sub)` (refuses past `CATALOGUE_MAX_ACCOUNTS`),
  `createSession(userId)`, `userForToken(token)`, `deleteSession(token)`,
  `deleteAccount(userId)`.
- New `catalogue-service/src/appleSignIn.ts`: `verifyIdentityToken(token, nonce)`
  (`jose` `createRemoteJWKSet` + `jwtVerify`) and `revokeAppleTokens(code)`
  (client secret signed with the `.p8` key, then Apple's token and revoke
  endpoints). Tests use a local key set, no network.
- `ownerAuth.ts` is replaced by `sessionAuth.ts`:
  `sessionAuth(auth): { userId } | ApiResponse`, with the D12 throttle.
  `RequestAuth` changes from `{ authorization, ownerToken }` to
  `{ authorization, ip }`; `RequestOptions` gains the account repository.
- Every repository method that touches personal rows takes `userId` first
  (`CatalogueRepository` watch and alert methods, `StyleProfileRepository`,
  `WardrobeRepository`, `OutfitRepository`). `getDropThreshold(userId)`.
- New routes: `POST /v1/session` (`{ identityToken, nonce }` → `201 { token,
  expiresAt }`), `DELETE /v1/session` (`204`), `DELETE /v1/account`
  (`{ authorizationCode }` → `204`).
- `server.ts`: drops `CATALOGUE_OWNER_TOKEN`; reads `CATALOGUE_APPLE_AUDIENCES`,
  `CATALOGUE_MAX_ACCOUNTS`, `CATALOGUE_TRUST_PROXY`, the three `APPLE_*`
  variables; refuses to start without `CATALOGUE_APPLE_AUDIENCES`.
- Scripts: `accounts:link-owner` (D6), `accounts:export` (D16), wired in
  `package.json` like `catalogue:backup`.

### App

- `src/services/session.ts`: `loadSession`, `saveSession`, `clearSession`
  (`expo-secure-store`).
- `src/screens/SignInScreen.tsx`: Apple's own button
  (`AppleAuthenticationButton`), a privacy policy link, the `accounts_full` copy.
  Shown after the intro and before onboarding when there is no session.
- `catalogueClient.ts`: every `ownerToken = defaultOwnerToken` parameter becomes
  the session token; `EXPO_PUBLIC_CATALOGUE_OWNER_TOKEN` disappears from `src/`,
  `.env.example` and the README (#20's acceptance check).
- Any `401` → `clearSession()` → sign-in screen. Local preferences stay, so an
  expired session costs one tap and no follows.
- Profile: the account ID (copyable, for D6 and D16), "Sign out"
  (`DELETE /v1/session`, clear Keychain and `wist-preferences`, so the next
  person on the same phone starts clean) and "Delete account" (D15).
- `app.json`: `ios.usesAppleSignIn: true`.

### Wiring chain

```text
App start ─▶ session.loadSession ─▶ (none) SignInScreen ─▶ AppleAuthentication.signInAsync(nonce hash)
          ─▶ POST /v1/session ─▶ appleSignIn.verifyIdentityToken ─▶ accounts.findOrCreateByAppleSub ─▶ createSession
          ─▶ session.saveSession ─▶ catalogueClient.*(…, sessionToken)
request ─▶ server.ts ─▶ handleRequest ─▶ sessionAuth ─▶ accounts.userForToken ─▶ route(userId) ─▶ repository(userId)
Profile → Delete ─▶ signInAsync (fresh code) ─▶ DELETE /v1/account ─▶ revokeAppleTokens ─▶ accounts.deleteAccount ─▶ photoStore.remove
```

### Rollout order (the owner's runbook, added to `docs/HOSTING_ATOMMAN.md`)

1. Apple Developer membership, bundle id and Sign in with Apple capability (#24).
2. Disk encryption (D18), privacy policy published (D17).
3. Backup, deploy, migration runs (D6.1–2); `cloudflared` ingress for
   `api.<domain>` (D13), with `CATALOGUE_MAX_ACCOUNTS=2` (the placeholder and
   the owner) until step 4 is done.
4. Owner signs in on TestFlight, `accounts:link-owner`, signs out and in (D6.3–5).
5. Retire the web app (D14); raise `CATALOGUE_MAX_ACCOUNTS` to 25 (D10).
6. Close #20 as superseded, with a comment pointing here.

## Effect on the open issues

- **#20:** superseded. Pairing with a typed owner token is replaced by sign-in;
  its approved throttle, IP and https rules carry over (D12).
- **#21:** the public host is the AtomMan behind Cloudflare Tunnel, not Fly.io.
  #21 stays deferred for a later move to the cloud.
- **#24:** a prerequisite. Sign in with Apple needs the paid membership, the
  capability on `com.wist.app` and a real build.
- **#25:** `push_devices` needs a `user_id`, and pushes go to the devices of the
  person who owns each alert.
- **#26:** this spec answers "Accounts" and "Account deletion". Still open there:
  go/no-go, #13 (image display and recurring collection for a multi-user app,
  the biggest risk), monetisation, costs at scale.

## Out of scope

A paid plan and StoreKit; email or password sign-in; sign-in on web or Android;
Apple's server-to-server notifications (for example an Apple ID being deleted);
deleting inactive accounts automatically (would need a schedule); a list of
signed-in devices; syncing follows across devices; remote push (#25); off-site
backups (#22); moving off the AtomMan or running more than one process (#21);
#13's legal questions.

## Commit plan (after approval)

Tests go in their own commits next to each slice.

1. `build(catalogue): add jose for apple identity tokens`
2. `feat(catalogue): store users and hashed sessions`
3. `feat(catalogue): sign in with an apple identity token`
4. `feat(catalogue): resolve the signed-in user on personal routes`
5. `refactor(catalogue): scope watches, sizes and coveted prices by user`
6. `feat(catalogue): raise price-drop alerts for each watcher`
7. `refactor(catalogue): scope style profiles by user`
8. `refactor(catalogue): scope the wardrobe by user`
9. `refactor(catalogue): scope outfits, location and the daily pick by user`
10. `feat(catalogue): run outfit ideas and the daily pick for each user`
11. `feat(catalogue): limit ai calls, imports and watches per user`
12. `feat(catalogue): import pieces only from supported houses`
13. `feat(catalogue): require a session for catalogue reads`
14. `feat(catalogue): cap the number of accounts`
15. `feat(catalogue): throttle failed sign-ins and sessions per ip`
16. `feat(catalogue): delete an account and revoke its apple tokens`
17. `feat(catalogue): link the owner's existing data to their account`
18. `feat(catalogue): export one account's data`
19. `build(app): add apple authentication and secure store`
20. `feat(app): sign in with apple before onboarding`
21. `refactor(app): send the session token instead of the owner token`
22. `feat(app): sign out and delete the account from profile`
23. `docs(catalogue): describe the public api and the accounts runbook`
