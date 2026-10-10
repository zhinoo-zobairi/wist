# Wardrobe decisions — 2026-10-10

The owner approved these decisions in the implementation session for
[epic #1](https://github.com/zhinoo-zobairi/wist/issues/1) and issues
[#3](https://github.com/zhinoo-zobairi/wist/issues/3),
[#4](https://github.com/zhinoo-zobairi/wist/issues/4), and
[#5](https://github.com/zhinoo-zobairi/wist/issues/5). This records agreement;
the original unticked proposals on GitHub have not been edited.

## Ownership and records (#3)

The existing backend owns durable wardrobe records, photos, and model calls,
alongside its existing owner style profile. Wardrobe has its own repository,
tables, and routes; it shares the SQLite file, process, and owner token with
the other modules. The mobile app never receives an API key or calls a model.

| Rule | Approved value |
|---|---|
| Categories | `top`, `bottom`, `dress`, `outerwear`, `shoes`, `bag`, `accessory` |
| Formality | `casual`, `smart_casual`, `formal` |
| Warmth | `light`, `medium`, `heavy` |
| Occasions | Reuse `work`, `evening`, `weekend`, `celebration`, `travel`; unique; may be empty |
| Colors | 1–3 unique labels, trimmed/lowercased, each 1–24 characters. Manual input with duplicates is rejected; colours from the tagger are de-duplicated first ("Navy", "navy" → "navy") |
| Name | Trimmed, nonempty, at most 80 characters |
| Notes | Optional, trimmed, at most 280 characters |
| Capacity | 300 garments, including photo garments; creation then returns `409 wardrobe_full` |
| Deletion | Permanent parent and child-row deletion; no undo |
| SQLite | Existing WAL mode, foreign keys enabled, `busy_timeout = 5000` ms; transactional writes |

The capacity check runs inside `BEGIN IMMEDIATE` to prevent races. A database
lock lasting beyond the five-second wait fails the request; changes inside
the transaction roll back, with no application retry. Vocabulary changes will
need a data migration. The photo-source migration preserves existing manual
garments, colors, occasions, and timestamps.

## Photos (#4)

| Rule | Approved value |
|---|---|
| Location | `<dirname(CATALOGUE_DB_PATH)>/wardrobe-photos/<server-generated UUID>.<ext>` |
| Formats | `image/jpeg`, `image/png`, `image/webp` |
| Upload cap | 5 MiB = 5,242,880 bytes; raw binary body |
| Retention | Until garment deletion; no separate backup mechanism |
| Initial attributes | `Untitled garment`, `top`, `["unknown"]`, `casual`, `medium`, `[]`, notes `null` |
| Initial status | Photo garments `untagged`; manual garments `tagged` |
| File-write failure | Remove the garment, attempt partial-file cleanup, return `500 photo_store_failed` |
| File-delete failure | Log the garment id and keep the successful database deletion; an inaccessible orphan may remain |

Paths use a stored server-generated UUID and fixed media-type extension map,
never the raw request path. Photo reads require the owner token. Backups must
include both the database and photo directory.

## Tagging (#5)

The owner selected the issue's direct Anthropic proposal over the offered
Sonnet/LiteLLM alternative. This task-specific choice overrides the personal
default for this integration only.

| Rule | Approved value |
|---|---|
| Provider | Direct `https://api.anthropic.com`; backend-only `ANTHROPIC_API_KEY` |
| Model | `claude-opus-5-5` |
| Effort | `low` |
| Output cap | `max_tokens = 2000` |
| Timing | Synchronous after photo persistence, before the upload response |
| Attempt timeout | 60,000 ms |
| SDK retries | 2 (up to 3 attempts plus SDK backoff); includes connection failures/timeouts and retryable HTTP responses |
| Refusal fallback | `betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"` |
| Failure | Keep the garment/photo, set `failed`; upload still returns `201` |
| Later retry | Manual `POST /v1/wardrobe/:id/tag`; no background or startup retry |
| Overwrite | Only `untagged`/`failed` unless `{ "force": true }`; re-check status when applying the result |
| No key | Upload stays `untagged`; retag returns `503 tagging_not_configured` |
| Dependencies | `@anthropic-ai/sdk` and `zod` |
| Provider privacy | Clothing photos are sent to Anthropic; the account's API retention policy applies |

SDK 0.133.0 supports `client.beta.messages.parse`, so the implementation uses
that single path with the beta fallback parameters. Zod checks structured
output; `parseGarmentInput` checks vocabulary, lengths, counts, and uniqueness.
The parser preserves refusals and malformed output for explicit classification.
Errors log class/status, not provider payloads, photos, or keys. SDK logging
is disabled. Explicit base URL and `authToken: null` keep shell LiteLLM settings
from rerouting this integration.

## Remaining limitations

- No overall 60-second deadline: three attempts plus backoff can take longer.
  A timeout can occur after the provider did paid work; retries may repeat it.
  Provider fallback can also perform additional processing. Actual cost and
  model/fallback access have not been verified against the owner's account.
- Existing HTTP concurrency is unchanged. Concurrent uploads can run paid calls
  concurrently; there is no new queue or request concurrency limit.
- A normal shutdown waits for in-flight HTTP requests. Forced termination after
  a photo is saved can leave tagging unfinished. A manual retry after restart
  may repeat an already-paid call; no model results or checkpoints are stored.
- SQLite and disk are separate stores. A crash between row insertion and file
  write can leave a garment without a photo; its photo endpoint returns 404.
  A crash after row deletion but before file removal can leave an orphan.
  No reconciliation job or file garbage collector was added.
- A human edit during an ordinary call is preserved; a retag then returns
  `409 already_tagged`, even if the model call incurred a charge. Explicit force
  allows overwriting current attributes and notes, but only if the garment is
  unchanged since the retag started; an edit saved mid-call is kept and the
  retag returns `409 garment_changed`. A failed attempt, forced or not, never
  marks a tagged garment `failed`: its attributes and status are untouched and
  the retag returns `502 tagging_failed`, so a later ordinary retag is still
  refused with `409 already_tagged`. (Changed 2026-10-10; previously a failed
  forced attempt marked the garment `failed`.)
- Photos and garments remain single-owner. Multi-user auth, cloud storage,
  calendar processing is later work; outfit generation is documented below.
- The live photo acceptance check remains pending: no backend
  `ANTHROPIC_API_KEY` is configured in the shell or `.env.local`. Automated tests
  replace the tagger or SDK transport and make no Anthropic calls.

## Mobile wardrobe (#6)

Approved in the same implementation session:

| Rule | Approved value |
|---|---|
| Ownership | Backend remains authoritative; phone owns capture and draft editing only |
| Navigation | Wardrobe row at the top of Profile; five tabs; existing state-based navigation |
| Dependencies | SDK 57-compatible `expo-image-picker` and `expo-image-manipulator` |
| Image policy | Long edge ≤1,568 px; no upscaling; JPEG quality 0.8 |
| Camera copy | “Wist uses your camera to photograph clothes you own.” |
| Library copy | “Wist reads the photos you choose to add clothes you own.” |
| Capture | Photos only; `microphonePermission: false`; no microphone request |
| Upload and retag timeout | 90,000 ms on the phone; no automatic client retry |
| Other calls | Existing client behavior: no application-level timeout |
| Updates | Server responses only; no optimistic changes; errors preserve records |
| Offline | No action queue or wardrobe persistence in AsyncStorage |
| Untagged copy | “Not tagged · Retry”; tagging does not run in the background |
| Uncertain upload | Retry refreshes records; no automatic re-upload |

The backend can continue processing after the phone disconnects or times out.
Explicitly adding the photo again may duplicate both a garment and paid work.
Re-reading requires explicit confirmation before sending `{force:true}`;
it replaces saved attributes/notes and unsaved editor changes. Deletion requires
an in-app confirmation and remains permanent. Leaving a screen does not cancel
server work; late results update the store but cannot navigate that old screen.
A list read started before a confirmed mutation cannot undo the newer response.

Native image sources attach the owner token only to the garment's exact relative
backend photo route. Web image elements may ignore authorization headers and
show a placeholder; native is the intended photo workflow for this prototype.
Permission plugin changes take effect in rebuilt native binaries, not in an
already-installed Expo Go binary's own permission wording.

Automated coverage verifies client transport/auth, strict response validation,
90-second deadlines, uncertain outcomes, server-authoritative store updates,
no device persistence, and the resize/JPEG/resource-release policy. Native
camera/library/manual end-to-end verification remains pending: simulator access
was blocked by the sandbox and its escalation could not run because automatic
approval review returned 403 (reviewer model unavailable). No physical iPhone
was available. This is a review infrastructure failure, not an unsafe-action
finding. Live tagging also requires a backend key that is not configured here.
The web export passed, but an attempted sandboxed Chrome launch aborted before
loading the app; browser interactions and screenshots are also unverified.
Expo introspection confirms the exact permission wording and absence of an iOS
microphone usage description. The existing `expo-video` Android configuration
still includes `RECORD_AUDIO`; wardrobe adds no microphone request and capture
is photos only.

## Outfit suggestions (#8)

Superseded by background outfit generation (C1.3, below): the route described
here is removed. Kept as the record of what #8 approved.

The owner approved these exact policies before implementation:

| Rule | Approved value |
|---|---|
| Ownership | Backend reads its existing wardrobe/profile and performs inference; no new durable state |
| Provider/client | Shared direct Anthropic client; backend-only `ANTHROPIC_API_KEY` |
| Model/effort | `claude-opus-5-5`, `medium` |
| Output cap | `max_tokens = 16000` (thinking counts toward it); `stop_reason: "max_tokens"` is reported as `truncated` and returns `502 suggestion_failed`. Changed 2026-10-10 from 2000, which could cut off medium-effort thinking on large wardrobes |
| Input | Tagged garments as text plus profile selections and occasion; no notes/photos |
| Minimum | 3 tagged garments; fewer returns `422 wardrobe_too_small` without inference |
| Output | 1–3 outfits, each with 2–6 unique eligible owned IDs |
| Filtering | Drop invalid outfits, including unknown/duplicate IDs; no survivors returns `502 suggestion_failed` |
| Reason length | Trimmed and truncated to 200 characters |
| Attempt timeout | 90,000 ms |
| SDK retries | 2; up to 3 attempts plus backoff |
| Refusal fallback | `betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"` |
| Model failure | `502 suggestion_failed`; no provider error payload returned/logged |
| Missing configuration | `503 outfits_not_configured` |
| Suggestion storage | None; every request performs billed inference |
| Prompt cache | Wardrobe text block only, `cache_control: {type:"ephemeral", ttl:"5m"}` |
| HTTP concurrency | Existing behavior unchanged; no new limit/queue |

`POST /v1/outfits/suggestions` accepts `{context:{occasion}}`. Authentication,
the 8,192-byte JSON body cap, and request concurrency follow the existing
server. A profile can be absent; the request still proceeds using wardrobe and
occasion. Garment JSON lines are sorted by ID and include exactly `id`, `name`,
`category`, `colors`, `formality`, `warmth`, `occasions`. System instructions
define occasion/style meanings and treat all user strings as data. Profile
and context follow the cached wardrobe block so they do not change its prefix.

The route filters IDs against both the prompt snapshot and current tagged
ownership before returning full records. Deleting a garment during inference
can invalidate outfits after a paid call; if none remain, the response is 502.
Current garment attributes are returned, but a reason may reflect the earlier
attributes if the garment was edited during inference.

There is no overall 90-second deadline. SDK retries and server fallback can
repeat paid work; interrupted requests have no durable checkpoints, and a new
request after timeout/restart performs fresh inference. Prompt caching caches
input processing, not suggestions; it can expire after five minutes and may
not activate for small wardrobes. Account retention, model/fallback access,
cache-read usage, and cost (including the issue's unverified $0.05–$0.10 estimate
for roughly 100 garments) require a live account check. No key is configured
here, so live outfit sensibility and cache-hit acceptance checks remain pending.

## Verification for #6 and #8

- `npm run typecheck` — passed for app and backend.
- `npm test` — 311 tests across 31 files passed, including fake SDK transport.
- `npm run catalogue:build` — passed.
- Expo web export — passed after the final mobile change.
- HTTP smoke against the compiled server with an isolated temporary database —
  outfit 401 authentication, 503 without a model key, 413 above 8,192 bytes,
  405 for unsupported method, and wardrobe creation/list/deletion passed.
- Native camera/library, rendered screenshots, live tagging/outfit quality,
  account cost/access, and actual provider cache hits remain unverified for the
  environment reasons above. No real model calls were made.

All implementation commits are local; no push, issue edit, or issue closure
was performed.

## Mobile outfit suggestions (#9)

Superseded by background outfit generation (C1.3, below): Dress me no longer
requests suggestions or waits for them. Kept as the record of what #9 approved.

The owner approved these screen and request policies before implementation:

| Rule | Approved value |
|---|---|
| Ownership | Existing backend owns records/inference; phone owns current screen presentation only |
| Entry | “Dress me” at the top of Wardrobe; no new tab or navigation library |
| Default | First occasion from existing mobile style-profile selections; no answered profile/no occasions requires a choice |
| Request trigger | Suggest, Retry, or Try again only; never on screen open or occasion selection |
| Occasion change | Clear existing results/errors without requesting new suggestions |
| Result lifetime | Screen state only; leaving discards results; no Zustand/AsyncStorage persistence |
| Editor navigation | Tapping a garment opens its existing editor; Back/Save/Delete returns to a fresh Dress me screen without results |
| Phone timeout | 120,000 ms using AbortController |
| Client retry | Zero automatic retries; manual Retry/Try again repeats the same occasion |
| Phone concurrency | One pending request per open screen; prevent repeated taps while pending |
| Leaving | Abort the phone's wait and ignore late responses |
| Too-small copy | “Add at least 3 tagged pieces to get outfit ideas.” plus Back to Wardrobe |
| Other failure copy | “Couldn't put outfits together right now.” plus Retry |

The client sends only `{context:{occasion}}` with owner auth. It validates 1–3
outfits, each containing 2–6 unique tagged garment records and a nonempty reason
at most 200 characters. Malformed responses map to the same unavailable state
as 502/503, network errors, and timeouts. It reuses garment validation and
authenticated photo sources from #6. Existing manual/photo garment sources
remain unchanged; manual garments with no photo show the existing placeholder.
Public purchase photos depend on the separate purchase feature.

The editor receives only the selected garment record, never outfit reasons or
the result collection. A newer suggestion record can be used when the wardrobe
store's last refresh is older or missing it; a newer store record takes priority.
Opening the editor unmounts the suggestion screen and discards all its results.
Reasons use the bundled Cormorant Garamond 600 italic font; garment names use
Inter. Collages have 2–3 columns, 4:5 photos and 20 px corners. Existing theme
tokens are reused, with moss actions and no wine/garnet accent.

The phone's timeout is independent of the existing backend policy: direct
Opus 5.5, medium effort, the current 16,000-token output cap, 90,000 ms per
attempt, two SDK retries, server-side fallback, and five-minute input caching
are preserved. Backend work can continue and incur charges after a client
timeout, navigation, or connection loss. An explicit new request can repeat
paid processing. No answers, checkpoints, background retry, or offline queue
are added. The one-request phone guard is per screen instance; leaving and
reopening does not limit work still running on the backend.

Device and live model acceptance checks remain pending under the owner's
existing instruction. No simulator/browser escalation or real model call is
required for this implementation; screenshots and live outfit quality/cache
checks are not claimed.

Verification for #9:

- Type checking for app/backend and the catalogue build passed.
- 348 tests across 33 files passed, including 27 new outfit-client cases.
- The Expo web export passed with the new screen and bundled italic font.
- A temporary JSDOM harness bundled the actual screen/client/store with React
  Native Web and fake HTTP. It checked required/default occasion, zero automatic
  calls, double-tap prevention, loading, 422/502/503 copy/actions, same-occasion
  retry, collage/editor callbacks, clearing on occasion change, fresh reopening,
  cancellation, and ignored late results. This verifies state and events, not
  native rendering, physical photo display, or screenshots.
- The DOM check found the existing picker omitted web `aria-checked`; it now
  exposes that alongside its native accessibility state.
- No real model calls, device checks, GitHub edits, pushes, or issue closures
  were performed.

## Background outfit generation (C1.3)

Approved by the owner on 2026-10-10; full design in
`docs/superpowers/specs/2026-10-10-background-outfit-generation-design.md`.
This replaces the stateless suggestion endpoint: `POST /v1/outfits/suggestions`
is removed and Dress me never waits for Claude. The catalogue service now owns
stored ideas, saved outfits, a run log and an in-process scheduler.

| Rule | Approved value |
|---|---|
| Change trigger | One run 10 minutes after the last change to the tagged wardrobe; each change restarts the wait. Photo uploads awaiting tags and failed tagging are not changes |
| Catch-up | At 03:00 local only if outfits are out of date; checked once per day |
| More ideas | One tap queues one run; counts toward the cap; `503` without a key, checked before the wardrobe size |
| One run | One Claude call, up to 2 new outfits per profile occasion (all five without a profile); change-triggered runs favour pieces changed since the last success |
| Model | `claude-opus-5-5`, `medium`, `max_tokens` 16000, 90 s, 2 SDK retries, refusal fallback, 5-minute prompt cache |
| Cap | 12 runs per cap day, 03:00–03:00 local (also across daylight-saving changes); skipped runs (under 3 tagged pieces) do not count; status stops reporting pending once the cap is reached |
| No key | No new ideas are made; ideas already prepared and saved outfits still show |
| Scheduler | 60 s tick, one run at a time; interrupted runs are marked failed at startup, with or without a key |
| Failures | No retry loop; the next trigger retries |
| Pool | 10 newest unsaved ideas per occasion; exact duplicates (same pieces) dropped |
| Saved | Kept until removed; deleted pieces reported as missing |
| Deleted garment | Ideas using it are removed at each run and each read |
| Run log | 7 days, always keeping the latest successful run |
| Refresh | Dress me re-reads stored outfits every 15 s while a run is pending or running |

Remaining limitations: no real model call, device run, cost or cache-hit check
has been made; the job runs only while the service runs (on the owner's Mac
until hosting, #21).

## Bought catalogue pieces (#7)

Approved by the owner on 2026-10-10. The catalogue service owns the purchased
garment and nullable `catalogueItemId` link. The catalogue repository still owns
the product and watch; there is no foreign key across those repositories.

| Rule | Approved value |
|---|---|
| Image | Reuse the catalogue item's absolute public `imageUrl`; the backend never downloads or stores it. Missing brand images show a placeholder |
| Tag input | Product image by URL, plus JSON-quoted product name and brand as text; product text is untrusted data, not instructions |
| Tagging policy | Same as photo tagging: direct Anthropic `claude-opus-5-5`, effort `low`, `max_tokens = 2000`, 60,000 ms per attempt, 2 SDK retries (up to 3 attempts plus backoff), beta `server-side-fallback-2026-07-01`, `fallbacks: "default"` |
| Watch | Call the same `repository.unwatchItem` as watch deletion. Failure preserves the garment and returns `201` with `unwatched: false`; the item can still be uncoveted manually |
| Size | Exactly one selected watch size becomes `Size: <label>` in notes; zero or multiple selections leave notes `null` |
| Duplicates | Allowed; every purchase creates a separate garment, subject to the existing 300-garment cap |

`POST /v1/wardrobe/from-item` accepts `{itemId}` with owner authentication and
the existing 8,192-byte JSON cap. It returns `{garment, unwatched}` with `201`.
An unknown product returns `404 item_not_found`; a full wardrobe returns
`409 wardrobe_full`, including a race after the precheck. Initial attributes
match photo uploads: `Untitled garment`, `top`, `["unknown"]`, `casual`,
`medium`, no occasions, `untagged`, plus the selected-size note above.

Tagging is synchronous. Missing configuration leaves the purchase `untagged`;
a model failure marks it `failed`, and both still attempt unwatching and return
`201`. Untagged creation and failed tagging do not write `wardrobe_change_log`,
including on reopening the database. Applying tags records the change inside
its transaction, so the existing background outfit scheduler sees the purchase.
The nullable link and public URL are added with guarded `ALTER TABLE` migrations;
existing records, child sets and timestamps survive.

Manual retry uses `POST /v1/wardrobe/:id/tag` and the garment's stored URL with
the catalogue product's current name and brand. Initial, ordinary and
forced retry all preserve the existing notes (the `Size: <label>` note cannot be
restored from the image). A tagged garment requires `{force:true}`; force replaces
details, but not notes, only while the garment's read timestamp is unchanged.
Photo garments keep today's behavior: a forced retag replaces their notes.
(Changed 2026-10-10; previously force erased a purchase's notes.) A missing catalogue product prevents retagging
with `404 item_not_found`. Purchase deletion never touches disk photo storage.

A purchase whose catalogue image is not an absolute `https:` URL without
credentials (crawled data can be relative, `http:` or carry credentials) is
refused with `422 item_image_unavailable`; nothing is created, tagged or
unwatched. Retagging a purchase garment with such a stored URL returns the same
error instead of sending it to Anthropic. The phone accepts only `https:`
purchase photos, so one bad garment cannot break the whole wardrobe load.

Public purchase photo sources omit all owner authorization headers. Wardrobe,
the editor, and outfit cards share `GarmentPhoto`; protected photo garments
retain the exact relative backend route and owner authentication.

There is no new inference cache, queue, automatic application retry, image
retention mechanism, or request-concurrency limit. The existing SDK retries and
provider fallback can repeat paid processing. Restart after garment creation
can leave tagging or unwatching unfinished; no purchase reconciliation job or
checkpoint is added. Brand images can disappear, and Anthropic fetches the
provided URL; provider access, retention and cost have not been verified live.
Native display and live model checks remain pending under the owner's earlier
instruction.

The owner additionally approved the purchase phone policy in this session:

| Rule | Approved value |
|---|---|
| Phone timeout | 90,000 ms with AbortController |
| Automatic client retries | Zero |
| Leaving | Prevent late navigation; a successful late response still updates the store; leaving does not abort the phone wait or backend processing |
| Uncertain outcome | Say the piece may already have been added; offer Refresh before any repeat |
| Refresh | Reload wardrobe and watches together; no purchase POST. A failed read preserves both current lists and still requires Refresh |
| After refresh, no longer coveted | Say it is in the wardrobe; offer no repeat |
| After refresh, still coveted | Offer explicit Try again; a repeat can create a duplicate garment and repeat paid tagging |
| Successful response | Add the authoritative garment; remove coveted ID and chosen-size cache only when `unwatched: true`; otherwise show the owner-facing unwatch notice in the editor |

The backend still uses 60,000 ms per attempt, two SDK retries and fallback,
so processing can exceed the phone's wait and continue after network loss.
No purchase operation is queued offline. The screen prevents duplicate taps
while its request is pending, allows cancellation of the confirmation sheet,
and waits for any in-flight watch or size write before starting a purchase.
Backend error codes pass through `wardrobeMessages` and never appear on screen.
Wardrobe records are authoritative server responses and remain memory-only on
the phone; the existing coveted/size cache follows the confirmed unwatch result.
Independent in-memory revisions guard wardrobe and watch reads: a stale startup
or import read cannot re-covet a confirmed purchase, while an unrelated garment
edit during recovery does not discard the authoritative watch response.

```text
App → ProductDetailScreen "I bought this" → useWistStore.addGarmentFromItem
  → catalogueClient.addGarmentFromItem → POST /v1/wardrobe/from-item
  → handleRequest → handleWardrobeRequest → createPurchase
  → catalogue.getItem/listWatchSizes → wardrobe.createPurchaseGarment
  → tagger.tag(product URL + quoted name/brand) → wardrobe.applyTags/markTagFailed
  → catalogue.unwatchItem → {garment, unwatched} → store → GarmentEditScreen
```


Verification for #7:

- Test-first changes cover schema migration, catalogue links, fake SDK product
  transport, purchase routes, the transactional capacity race, change logging,
  client photo-source decisions, owner-facing copy and store synchronization.
- App/backend type checking, 429 tests across 39 files, and the catalogue build
  pass. Tests use fake HTTP/taggers/SDK transports and make no real model calls.
- Expo web export passes.
- A temporary JSDOM/React Native Web harness using the actual purchase screen,
  store and client passed 10 UI checks: entry/confirmation/cancel, single pending
  request and loading, editor callbacks, watch success/failure, uncertain
  recovery reads, owned/no-repeat and watched/explicit-repeat states, error
  copy, and late success updating the store without navigating after unmount.
  Visual-only Icon/video/safe-area wrappers and HTTP were replaced; this does
  not verify native rendering, image retrieval, device screenshots or live
  provider behavior.
- Step 1 is committed locally as `fe8218b`. Later commits are left to the owner
  after automatic approval review returned 403 for `codex-auto-review`; no
  review check was bypassed. No push, issue update or closure was performed.
