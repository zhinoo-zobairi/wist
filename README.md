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

For a coveted piece you bought on the brand's site, open its product screen
and tap **I bought this**. Confirm **Add to your wardrobe? You'll stop getting
price alerts for it.** Wist adds the piece using its product image and opens the
garment editor so you can check the tags. It removes the piece from Coveted
only after the backend confirms the watch was removed. If that removal fails,
the editor explains that you can uncovet it manually. Buying the same item again
is allowed: covet it again and repeat the flow to create another garment.

Run the backend using the same owner token as the phone. A backend-only
`ANTHROPIC_API_KEY` enables automatic tagging; without it, photos remain
**Not tagged · Retry** and can still be edited by hand. **Couldn't tag · Retry**
means an attempted read failed. There is no background tagging job.

Uploads and photo re-reading have a **90,000 ms phone timeout**, with no
automatic client retries. The backend's retries can take longer. If the
connection ends before an upload response arrives, the garment may already
exist and still be processing: **Retry refreshes the wardrobe**. Explicitly
adding the photo again can create a duplicate and repeat paid processing.
**I bought this** also waits at most **90,000 ms** on the phone, with zero
automatic retries. Leaving its screen prevents late navigation; a successful
late response still updates the store. On timeout or network loss, **Refresh**
reloads both wardrobe and watches without buying again. If the item is no
longer coveted, Wist says it is in the wardrobe and offers no repeat. If it
is still coveted, an explicit **Try again** can add a duplicate garment and
repeat paid tagging; the backend may still be finishing the first request.
Other wardrobe calls have no application-level timeout. Records update only
from server responses; failed actions preserve the current list. Wardrobe
records and pending actions are never saved in AsyncStorage or queued offline.

Uploaded photos use authenticated native image requests. Purchased-product
images use their public URLs without owner authorization headers. Browser previews may ignore
image authorization headers and show **Photo unavailable**; the native app is
the intended photo workflow. Camera and library permission copy is configured
for native builds; no microphone permission is requested by wardrobe capture.

```text
App profileView → Profile → WardrobeScreen / GarmentEditScreen
                              ├→ image picker → garmentPhoto → JPEG URI
                              └→ useWistStore → catalogueClient → wardrobe API
ProductDetailScreen "I bought this" → useWistStore.addGarmentFromItem
  → catalogueClient → POST /v1/wardrobe/from-item → catalogue item + watch sizes
  → wardrobe.createPurchaseGarment → tagger.tag(product) → applyTags/markTagFailed
  → catalogue.unwatchItem → returned garment → GarmentEditScreen
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
- `POST /v1/wardrobe/from-item` (owner token) — adds a bought catalogue item with `{ "itemId": "..." }`; returns `201 { garment, unwatched }`
- `GET /v1/wardrobe/:id` (owner token)
- `PUT /v1/wardrobe/:id` (owner token) — replaces all editable attributes
- `DELETE /v1/wardrobe/:id` (owner token) — permanently deletes the garment
- `POST /v1/wardrobe/photos` (owner token) — uploads raw JPEG, PNG, or WebP bytes
- `GET /v1/wardrobe/:id/photo` (owner token) — returns the stored image bytes
- `POST /v1/wardrobe/:id/tag` (owner token) — retries photo or purchased-product tagging; optional `{ "force": true }` overwrites existing tags
- `GET /v1/outfits` (owner token) — stored outfit ideas, saved outfits and background status; never calls Claude
- `POST /v1/outfits/saved` with `{ "suggestionId": "…" }` (owner token) — saves an idea; `DELETE /v1/outfits/saved/:id` removes it
- `POST /v1/outfits/more` (owner token) — queues one background run (`202`), or `429 daily_limit_reached` / `422 wardrobe_too_small` / `503 outfits_not_configured`

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

Bought catalogue pieces use `source: "purchase"`, a `catalogueItemId` link and
the item's public image URL. Wist never copies the brand image; if it disappears,
the garment shows a placeholder. Product tagging sends that image URL and the
quoted name/brand through the same inference policy as photos. Exactly one
chosen watch size becomes `Size: <label>` in notes; other selections leave notes
empty. Purchases may be added more than once. The backend removes the watch
after creation, including when tagging fails; an unwatch failure keeps the
garment and reports `unwatched: false`, so it can still be uncoveted manually.
Only successfully applied tags record a change for background outfit generation.


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

### Prepare outfits in the background

Outfit ideas are generated in the background and stored, so reading them never
waits for Claude. With a backend `ANTHROPIC_API_KEY`, the service's scheduler
checks every **60 seconds** and runs one Claude call when one of these is due:

- **10 minutes after the last change** to the tagged wardrobe (a garment added,
  edited, deleted or successfully tagged); every further change restarts the
  wait. Photo uploads still being tagged and failed tagging are not changes;
- at **03:00** server-local time, only if outfits are still out of date (a
  failed run, or changes left over after the daily limit);
- after `POST /v1/outfits/more` (**More ideas**).

At most **12 runs per day**, where a day runs 03:00–03:00 local time. A run with
fewer than **three tagged garments** is skipped without a model call and does
not count. One run asks for up to **2 new outfits per occasion** in the style
profile (all five without a profile). Runs triggered by a change ask Claude to
favour the pieces changed since the last successful run. Each outfit needs
**2–6 unique tagged garment IDs** and a reason, truncated to **200 characters**;
invalid outfits are dropped. An outfit with exactly the same pieces as an
existing idea or saved outfit is dropped too. Each occasion keeps the **10
newest unsaved ideas**.

Failures are recorded in a run log (kept **7 days**) and not retried in a loop;
the wardrobe stays out of date, so the next trigger tries again. Only one run
happens at a time, and a run interrupted by a restart is marked failed at
startup. The scheduler runs only while the catalogue service runs.

`GET /v1/outfits` returns `{ suggestions, saved, status }`. `status` has
`pending`, `running`, `lastRunAt`, `lastRunStatus`, `runsLeftToday` and
`generationEnabled`. Ideas that use a deleted garment are removed; saved outfits
are kept and list `missingGarmentIds`.

| Route | Result |
|---|---|
| `POST /v1/outfits/saved` | `201 { saved }`, `404 suggestion_not_found` |
| `DELETE /v1/outfits/saved/:id` | `200 { id, deleted: true }`, `404 saved_outfit_not_found` |
| `POST /v1/outfits/more` | `202 { queued: true }`, `503 outfits_not_configured`, `422 wardrobe_too_small`, `429 daily_limit_reached` |

Inference uses **`claude-opus-5-5`**, **medium effort**, **16,000 output tokens**
(thinking counts toward them; running out is logged as `truncated`),
a **90,000 ms timeout per attempt**, **two SDK retries**, and the same approved
server-side fallback as tagging. Anthropic prompt caching marks the stable,
ID-sorted wardrobe text with an explicit **5-minute TTL**.

Wardrobe names/tags and profile selections are sent to Anthropic. Account
retention, model access, actual costs, and cache hits remain unverified here.
Unit/API tests use fake inference and SDK transport, never real model calls.

```text
catalogue:start → server.ts → startOutfitScheduler (60 s)
                    └→ runDueOutfitGeneration → decideRun
                         └→ runOutfitGeneration → ClaudeOutfitSuggester
                              └→ keepValidGeneratedOutfits → SqliteOutfitRepository
GET /v1/outfits → handleOutfitRequest → stored ideas + saved outfits + status
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

### Get outfit ideas

1. Open **Profile → Wardrobe → Dress me**. It opens instantly with the ideas
   the backend has already prepared; it never waits for Claude.
2. Choose an occasion to filter the ideas. The first occasion in your style
   profile is preselected. Without one, all ideas show until you choose.
3. Tap **♡ Save** to keep an idea. Saved outfits are never removed
   automatically and show **Missing a piece** if you delete one of their
   garments. **Remove** deletes a saved outfit.
4. Tap **More ideas** to queue one extra background run. You can leave the
   screen; new ideas appear when it finishes. After the daily limit the app
   shows “You've reached today's limit of new ideas.”
5. Tap a garment to review or edit it.

While a run is pending or running, the **More ideas** button reads “Preparing
ideas…” (and the empty state says so when no idea matches the chosen occasion)
and the screen re-reads `GET /v1/outfits` every **15 seconds** (no model call);
it stops when you leave. Without a backend key no new ideas are made; ideas
already prepared and saved outfits still show. Nothing is stored on the phone.

```text
Wardrobe “Dress me” → OutfitSuggestionsScreen
                        ├→ loadOutfits → GET /v1/outfits (every 15 s while pending/running)
                        ├→ ♡ Save → saveOutfitIdea → POST /v1/outfits/saved
                        ├→ Remove → removeSavedOutfit → DELETE /v1/outfits/saved/:id
                        └→ More ideas → requestMoreIdeas → POST /v1/outfits/more
```

Client tests verify the contract and error mapping. Device screenshots and
real model checks remain pending.

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
