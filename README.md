# Wist v1

Wist (pronounced “weest,” from Kurdish for deeply wanting something) is a personal fashion intelligence prototype built with Expo and TypeScript. It displays real products observed by the catalogue service and lets a user covet pieces for future price-drop monitoring.

## Run it

Requirements: Node.js 22.5+ and a native simulator/device with Expo Go.

```bash
npm install
npm run ios
```

Use `npm run android` for Android or `npm run web` for the browser preview. The in-app drop flow works on web, but browser previews intentionally skip native local notifications.

### Run the first personal version on an iPhone

This path runs Wist inside Expo Go. It is intentionally the smallest way to
try the real workflow before creating a standalone App Store-style build.

1. Install **Expo Go** on the iPhone and connect the iPhone and Mac to the same
   Wi-Fi network.
2. In macOS, open **System Settings → Wi-Fi → Details → TCP/IP** and note the
   Mac's IPv4 address.
3. Copy `.env.example` to `.env.local`, use the same random owner token for both
   token variables, and set these device-specific values:

   ```dotenv
   CATALOGUE_HOST=0.0.0.0
   EXPO_PUBLIC_CATALOGUE_URL=http://192.168.1.20:4000
   ```

   Replace `192.168.1.20` with the Mac's IPv4 address. The owner token is a
   personal prototype secret; never commit `.env.local`.
4. Start the backend in one terminal with `npm run catalogue:start`.
5. Start Expo in another terminal with `npm start`, then scan its QR code with
   the iPhone camera and open it in Expo Go.
6. Finish the short onboarding, open **Coveted**, and paste a supported product
   URL into **Watch a product**.

For this local milestone, the Mac must remain awake and running the catalogue
service. The app currently supports Shopify product pages such as Goelia,
Bobbies English, and Sandro Germany. It synchronizes price-drop alerts while
open and then creates a local iOS notification. A continuously hosted backend
plus remote push delivery is the next step required for notifications while
Wist is closed.

## Catalogue backend

### Build your wardrobe

Open **Profile → Wardrobe → Add**, then take a photo or choose one from your
library. Wist converts it to JPEG at quality 0.8, limiting the longest edge to
1,568 pixels without enlarging smaller images. After “Reading your garment…”,
the editor opens so you can check the name, category, colors, formality,
warmth, occasions, and notes. Save sends the changes to the backend. Tap a
garment later to edit it, re-read its photo, or permanently delete it after
confirmation. Re-reading replaces saved details and notes and may incur
another model charge.

Run the backend using the same owner token as the phone. A backend-only
`ANTHROPIC_API_KEY` enables automatic tagging; without it, photos remain
**Not tagged · Retry** and can still be edited by hand. **Couldn't tag · Retry**
means an attempted read failed. There is no background tagging job.

Uploads and photo re-reading have a **90,000 ms phone timeout**, with no
automatic client retries. The backend's retries can take longer. If the
connection ends before an upload response arrives, the garment may already
exist and still be processing: **Retry refreshes the wardrobe**. Explicitly
adding the photo again can create a duplicate and repeat paid processing.
Other wardrobe calls have no application-level timeout. Records update only
from server responses; failed actions preserve the current list. Wardrobe
records and pending actions are never saved in AsyncStorage or queued offline.

Photos use authenticated native image requests. Browser previews may ignore
image authorization headers and show **Photo unavailable**; the native app is
the intended photo workflow. Camera and library permission copy is configured
for native builds; no microphone permission is requested by wardrobe capture.

```text
App profileView → Profile → WardrobeScreen / GarmentEditScreen
                              ├→ image picker → garmentPhoto → JPEG URI
                              └→ useWistStore → catalogueClient → wardrobe API
```

The first backend slice is a separate TypeScript catalogue service. It owns the
normalized brand/product API contract and the single-user watch list consumed
by the mobile app.

```bash
npm run catalogue:start
```

The service listens on `http://127.0.0.1:4000` by default. Set `PORT` to change
it. Available endpoints are:

- `GET /health`
- `GET /v1/brands`
- `GET /v1/brands/:brandId/items`
- `GET /v1/items/:itemId`
- `GET /v1/watches` (owner token) — returns `itemIds` plus a `sizes` map of the labels each watch alerts on
- `POST /v1/watches` with `{ "url": "https://…" }` (owner token)
- `PUT /v1/watches/:itemId` (owner token) — optional `{ "sizes": ["38"] }` body; an absent key leaves the selection untouched, `[]` clears it
- `DELETE /v1/watches/:itemId` (owner token)
- `GET /v1/alerts` (owner token)
- `GET /v1/wardrobe` (owner token) — lists owned garments, newest first
- `POST /v1/wardrobe` (owner token) — creates a garment from typed-in attributes
- `GET /v1/wardrobe/:id` (owner token)
- `PUT /v1/wardrobe/:id` (owner token) — replaces all editable attributes
- `DELETE /v1/wardrobe/:id` (owner token) — permanently deletes the garment
- `POST /v1/wardrobe/photos` (owner token) — uploads raw JPEG, PNG, or WebP bytes
- `GET /v1/wardrobe/:id/photo` (owner token) — returns the stored image bytes
- `POST /v1/wardrobe/:id/tag` (owner token) — retries photo tagging; optional `{ "force": true }` overwrites existing tags
- `POST /v1/outfits/suggestions` (owner token) — suggests outfits from tagged owned garments

Wardrobe records belong to the same single owner as the style profile and are
stored in their own SQLite tables. Garment input is `{ name, category, colors,
formality, warmth, occasions, notes? }`. Categories are `top`, `bottom`, `dress`,
`outerwear`, `shoes`, `bag`, and `accessory`; formality is `casual`,
`smart_casual`, or `formal`; warmth is `light`, `medium`, or `heavy`. Occasions
reuse `work`, `evening`, `weekend`, `celebration`, and `travel` (an empty selection
is valid). Colors contain 1–3 unique labels, trimmed and lowercased, each at most
24 characters; names are nonempty and at most 80 characters, and optional notes
are at most 280 characters. A wardrobe holds at most 300 garments; further
creation returns `409 wardrobe_full`. Deletion has no undo. Writes use the
existing SQLite WAL mode and a 5,000 ms lock wait; a write that remains blocked
fails without automatic retry and rolls back its changes.

Photo uploads use `Content-Type: image/jpeg`, `image/png`, or `image/webp` and a
nonempty binary body, not JSON or base64. The limit is 5 MiB (5,242,880 bytes);
larger bodies return `413 payload_too_large`, and unsupported types return
`415 unsupported_media_type`. Without a tagging key, an upload creates a `source: "photo"` garment
with `tagStatus: "untagged"` and a relative `photoUrl`. Initial attributes are
“Untitled garment”, `top`, `["unknown"]`, `casual`, `medium`, and no occasions;
editing attributes marks it `tagged` and preserves its source and photo.
Manual garments are already `tagged` and have no photo URL.

Photos live at `<database directory>/wardrobe-photos/<garment UUID>.<ext>` and
are kept until the garment is deleted. Back up that directory together with
SQLite; Wist adds no separate backup mechanism. A failed photo write removes
the new garment and returns `500 photo_store_failed`. Deletion removes the
database record first; if file removal fails, the error is logged and deletion
still succeeds, potentially leaving an inaccessible orphan file. Existing
wardrobe databases upgrade in place, preserving their garments and child rows.

To enable automatic garment tagging, set **`ANTHROPIC_API_KEY`** in the backend's
`.env.local` or environment. Never use an `EXPO_PUBLIC_` prefix for this key;
the mobile app never calls an LLM. This integration uses **direct Anthropic**
at `https://api.anthropic.com`, explicitly ignoring the shell's LiteLLM
`ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN`. Leaving the key empty keeps
uploads working with `tagStatus: "untagged"`; manual tagging then returns
`503 tagging_not_configured`.

With the key configured, the upload saves the photo and synchronously asks
`claude-opus-5-5` to tag it before responding. It uses low effort, a maximum of
2,000 output tokens, a 60,000 ms timeout **per attempt**, and two SDK retries
(up to three attempts plus backoff, not a 60-second overall deadline).
Server-side refusal fallback is enabled with
`server-side-fallback-2026-07-01` and `fallbacks: "default"`. The implementation
uses `client.beta.messages.parse` and Zod structured output, followed by the
same domain validator used for manual input. A refusal, invalid output, or API
failure keeps the garment and photo and still returns `201` with
`tagStatus: "failed"`.

Retry failed or untagged photos with `POST /v1/wardrobe/:id/tag`. There is no
background job or startup retry. Tagged garments return `409 already_tagged`
unless the JSON body is `{ "force": true }`. A human edit during an ordinary
tagging call is preserved, and that retag returns `409 already_tagged` too.
Force allows overwriting the attributes, including notes, but only as they
stood when the retag started: if the garment is edited while the model call
runs, the edit is kept and the retag returns `409 garment_changed`. A failed
retag never marks a tagged garment `failed`; it stays as it was and the retag
returns `502 tagging_failed`. Colours the model repeats in another casing are
merged before validation. The existing HTTP
server accepts concurrent requests, so simultaneous uploads can run paid calls
concurrently. An interrupted or timed-out call may have already incurred a
charge; SDK retries or a later manual retry can repeat that processing. A
restart does not automatically resume unfinished tagging.

**Privacy:** garment photos are sent to Anthropic, including its configured
fallback model when used. Anthropic's API retention policy for the owner's
account applies independently of Wist's local retention; check it in the
Anthropic Console. SDK payload logging is disabled, and tagging errors log
only error class/status or the failure reason, never image bytes or keys.
Local photos remain until garment deletion. Backing up SQLite alone does not
back up photos. The full approved policies and crash limitations are recorded
in [Wardrobe decisions](docs/WARDROBE_DECISIONS.md).

The backend wiring is:

```text
catalogue:start → server.ts → Anthropic client → ClaudeGarmentTagger
                  └→ handleRequest → handleWardrobeRequest → photo/tag routes
                                                             ├→ photoStore.write/read
                                                             └→ tagger.tag → wardrobe.applyTags/markTagFailed
```

Tests use fake taggers and a stubbed SDK transport; they do not call Anthropic.
A live tagging check requires a real backend key and a garment photo. Native
capture/review is available through Profile → Wardrobe.

### Suggest outfits from owned garments

With at least **three tagged garments** and a backend `ANTHROPIC_API_KEY`, send
`POST /v1/outfits/suggestions` with the owner bearer token and this JSON body:

```json
{ "context": { "occasion": "work" } }
```

The response is `{ "outfits": [{ "garments": [/* full owned garment records */],
"reason": "…" }] }`. Occasions use the same five profile options. The backend
loads the wardrobe and style profile, sends text tags (no notes or photos) to
the shared direct Anthropic client, and returns **1–3 outfits**, each with
**2–6 unique owned garment IDs**. It drops invalid combinations and truncates
reasons to **200 characters**. Before responding it checks ownership/tagged
status again and returns current records; an explanation can still reflect
attributes from before an edit made during processing.

| Status | Meaning |
|---|---|
| `400 invalid_outfit_request` | Invalid JSON or occasion |
| `422 wardrobe_too_small` | Fewer than three tagged garments; no model call |
| `502 suggestion_failed` | Model error, refusal, invalid output, or no surviving outfits |
| `503 outfits_not_configured` | Missing owner token, repositories, or backend key |

Authentication failures return 401, bodies above the existing **8,192-byte**
JSON limit return 413, and unsupported methods return 405.

Inference uses **`claude-opus-5-5`**, **medium effort**, **2,000 output tokens**,
a **90,000 ms timeout per attempt**, **two SDK retries**, and the same approved
server-side fallback as tagging. Three attempts plus backoff and fallback can
repeat paid processing and exceed 90 seconds overall. Every request calls the
model; Wist saves/caches no suggestions and adds no queue, startup recovery,
or concurrency limit. Anthropic prompt caching marks the stable, ID-sorted
wardrobe text with an explicit **5-minute TTL**. It caches input processing,
not answers; short wardrobes may not reach the provider's cache threshold.

Wardrobe names/tags and profile selections are sent to Anthropic. Account
retention, model access, actual costs, and cache hits remain unverified here;
the issue's $0.05–$0.10 estimate around 100 garments is not a measured price.
Unit/API tests use fake inference and SDK transport, never real model calls.
The outfit screen is a separate issue; #8 provides this backend endpoint.

```text
catalogue:start → server.ts → shared Anthropic → ClaudeOutfitSuggester
                  └→ handleRequest → handleOutfitRequest
                                      ├→ wardrobe.listGarments / profiles.getProfile
                                      ├→ suggester.suggest → structured IDs/reasons
                                      └→ keepValidOutfits → current owned Garment records
```

The service uses a local SQLite database. Configure the owner token before
starting it:

```bash
cp .env.example .env.local
# Replace both token placeholders with the same random owner value.
npm run catalogue:start
```

Products can then be imported from the Coveted screen. Shopify product pages,
Bobbies English, and Sandro Germany are supported. The
`catalogue:observe -- <product-url>` command remains available for direct
backend testing.

Set `CATALOGUE_DB_PATH` to choose another database location. Each observation
stores an immutable price snapshot. A drop is reported when the new price is
below the price the piece was coveted at — not merely below the previous
observation — and below anything already announced since. Comparing consecutive
observations made the reference point arbitrary: a piece coveted at €300 that
climbed to €400 and eased back to €350 showed a decrease, so it announced "13%
off" for a price worse than the one the owner wanted. Requiring a new low also
stops a sale being re-announced on every six-hour check while it lasts. A drop
silenced by the size rule stays announceable, so the same price can still arrive
once that size is back in stock. Coveting a piece records its baseline;
un-coveting and coveting it again re-baselines to the price standing then. A
piece that was never coveted raises no alert at all. Covet and Uncovet
use owner-token-authenticated endpoints and persist one user's watches in the
backend. While the catalogue service is running, it immediately checks every
watched product and repeats the cycle every six hours. Set
`CATALOGUE_WATCH_INTERVAL_MS` to a positive number of milliseconds to change
that cadence. Checks run sequentially, failed products do not stop the cycle,
and detected drops persist for the app to synchronize. Shopify and Bobbies observations
also persist the size availability published by the product page, which the
product detail screen displays and lets you tap to choose which sizes matter.
A watch with chosen sizes only turns a drop into an alert when one of those
labels is available in the new observation; a watch with no chosen sizes alerts
on any drop, as before. Sandro pages do not expose sizes yet, so a Sandro watch
always alerts on any drop. Sizes are matched on the storefront's own published
labels, so there is no cross-brand size normalization. There is no product
discovery, restock notification, remote push delivery, or automatic checkout
yet.

This bearer token is a narrow personal-prototype gate. The Expo-prefixed copy
is bundled into the client, so it must be replaced by real user authentication
before Wist becomes a multi-user or publicly distributed service.

The Expo app loads this catalogue at startup. Web and iOS Simulator use
`http://127.0.0.1:4000` by default. Set `EXPO_PUBLIC_CATALOGUE_URL` to the
Mac's LAN URL for local iPhone development or to the public HTTPS URL for a
deployed backend.

### Prove direct Sandro product access

The MVP's active ingestion proof reads one explicit public product page from
Sandro Germany and normalizes its Product JSON-LD into the catalogue model:

```bash
npm run catalogue:probe:sandro -- https://de.sandro-paris.com/de/p/haargummi-mit-paisley-print/SFABI00075_80.html
```

The command accepts only HTTPS product URLs on `de.sandro-paris.com`, refuses
redirects, caps the response size, and does not crawl the product sitemap. It
is a technical feasibility probe, not permission for recurring or bulk use.

### Prove direct Bobbies product access

The same bounded proof is available for one explicit English Bobbies product
page:

```bash
npm run catalogue:probe:bobbies -- https://www.bobbies.com/en/4000785248-opera-iridescent-champagne-3663902758263.html
```

The Bobbies adapter is source-specific but returns the same normalized
catalogue model. It does not crawl, persist observations, or run on a cadence.

### Optional Awin feed-access probe

After obtaining an Awin publisher product-feed API key, run:

```bash
AWIN_PRODUCT_FEED_API_KEY=<your-key> npm run catalogue:probe:awin
```

The probe downloads Awin's feed list, reports whether the verified Sézane and
Sandro advertiser IDs are accessible, and omits credential-bearing download
URLs from its output. Never commit the key.

## Use the live catalogue

1. Start the catalogue service and Expo app.
2. Open **Coveted** and paste a Shopify, Bobbies English, or Sandro Germany
   product URL.
3. Confirm the imported product appears in the collection.
4. Open it to see its real image/video gallery and observation details.

The rendered app no longer mixes placeholder products with the live catalogue.
The backend owns the watch list; AsyncStorage caches it for responsive UI.
The app synchronizes persisted price-drop alerts once per minute while it is
active and raises a local notification for each newly detected drop. Remote push
is still a separate integration, so a terminated app shows a drop after it is
reopened rather than receiving a background notification.

The device — not the catalogue — remembers which drops it has already announced,
so a drop notifies exactly once no matter how often the app synchronizes. The
first synchronization after a fresh install is deliberately silent: it records
the alerts that already exist instead of announcing the whole stored history at
once. Drops detected after that point notify normally, including ones that
landed while Wist was closed.
The cached field remains named `starredItemIds` for backward compatibility, but
the product exposes one save verb: **Covet**.

## Checks

```bash
npm run typecheck
npm test
npm run catalogue:build
```

## Architecture boundary

The rendered mobile catalogue uses an asynchronous HTTP client. The legacy
`SeedPriceSource` remains only for isolated drop-engine tests and does not
provide products or placeholder images to the UI.

The catalogue service calls brand sites only for explicitly observed products
that are subsequently coveted; it does not crawl storefronts or discover
products. Manual observation commands seed Bobbies or Sandro products in
SQLite, and the service owns their recurring snapshots, price-drop history,
and single-user watches. The mobile app reads those records through an owner
bearer token. Full authentication, multi-user data, and distributed scheduler
coordination remain out of scope.
