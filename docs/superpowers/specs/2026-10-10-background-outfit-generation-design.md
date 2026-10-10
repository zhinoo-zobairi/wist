# Background Outfit Generation — Design

**Date:** 2026-10-10
**Status:** Decisions approved by the owner; implementation details below awaiting spec review
**Slice:** C1.3. Builds on C1.1 (#8, stateless suggestions) and C1.2 (#9, "Dress me" screen).

## Problem

"Dress me" calls Claude while the owner waits (10–30 s, up to 120 s). The moment
someone needs an outfit — early morning, before a party — is the moment they
have least patience. Outfits should already exist when the screen opens.

## What changes

| Before (#8/#9) | After (C1.3) |
|---|---|
| Stateless: nothing stored, every tap is a billed Claude call | Suggestions are generated in the background and stored |
| The owner waits for Claude | "Dress me" reads stored outfits instantly; no Claude call while waiting |
| No way to keep an outfit | ♡ saves an outfit permanently |

**Ownership change.** The catalogue service now owns stored outfit suggestions,
saved outfits, a background job, a run log, and a daily spending cap. This
reverses #8's "stateless" decision on purpose (owner-approved 2026-10-10).

## Approved decisions

| # | Decision | Value |
|---|---|---|
| 1 | Change trigger (debounce) | Any garment add, edit, delete or tagging result records a change time. A run starts once **10 minutes** pass with no further change. |
| 2 | Nightly trigger | **Catch-up only** at **03:00 server-local time**: runs only if outfits are still out of date (a failed run, or changes left over after the cap). Quiet nights cost nothing. |
| 2b | "More ideas" | A button on Dress me queues **one** background run. It counts toward the daily cap. |
| 3 | One run | **One Claude call** asking for up to **2 new outfits per occasion** in the owner's profile. A change-triggered run asks Claude to favour the pieces changed since the last successful run. |
| 4 | Model | `claude-opus-5-5`, effort `medium`, `max_tokens` 16 000, 90 s timeout, 2 SDK retries, server-side refusal fallback (same as #8). |
| 5 | Spending cap | At most **12 runs per calendar day** (server-local), all triggers together. |
| 6 | Failures | No retry loop. The wardrobe stays "out of date", so the next trigger (another change, More ideas, or the 03:00 catch-up) tries again. The error is logged and recorded in the run log. |
| 7 | Pool size | At most **10 unsaved suggestions per occasion**; inserting more deletes the oldest unsaved. |
| 8 | Duplicates | A new outfit with exactly the same garment set (order-independent) as an existing suggestion or saved outfit is dropped, in code. |
| 9 | Saved outfits | ♡ moves a suggestion into **Saved**. Saved outfits are never deleted automatically; the owner can remove them. |
| 10 | Deleted garment | Suggestions containing it are deleted. Saved outfits stay and list the missing garment. |
| 11 | No waiting path | `POST /v1/outfits/suggestions` and the waiting UI are removed. Empty state: "Preparing ideas…" plus **More ideas**. |
| 12 | No API key | The job is disabled; no new ideas are made; ideas already prepared and saved outfits still show, and More ideas returns `503`. |
| 13 | Ownership | `catalogue-service`, own module and tables, in-process scheduler like `watchScheduler.ts`. Runs only while the service runs (on the owner's Mac until hosting, #21). |

Weather (#10) and calendar (#11) will rank stored outfits on request instead
of calling Claude; those issues are re-scoped separately.

## Implementation details (for spec review)

These are not new product decisions, but they are visible enough to confirm:

- **D1. No profile:** if the owner skipped onboarding, a run covers all five occasions (up to 10 outfits).
- **D2. Minimum wardrobe:** with fewer than 3 tagged garments a run is skipped without calling Claude and does **not** count toward the cap.
- **D3. Scheduler tick:** the scheduler checks every **60 s**. Debounce and the 03:00 catch-up therefore fire within a minute of their time.
- **D4. Run log retention:** the run log keeps **7 days** (enough to count today's runs and diagnose failures); older rows are pruned at each run.
- **D5. Dress me refresh:** while the screen is open and a run is pending or in progress, the app re-reads `GET /v1/outfits` every **15 s** (free, no Claude call). It stops when the screen closes.
- **D6. Saving removes from the pool:** a saved outfit no longer appears among suggestions, so it is never shown twice.
- **D7. Changes during a run:** a change made while a run is in progress leaves the wardrobe out of date afterwards, so it gets its own debounced run.

## Architecture

```
SqliteWardrobeRepository (every write)
   └─ upserts wardrobe_change_log.last_changed_at  (same transaction)

server.ts
   └─ startOutfitScheduler({ wardrobe, outfits, profiles, generator, now, tickMs: 60_000 })
         every tick: decideRun(state, now) → "debounced" | "catch_up" | "more_ideas" | null
            └─ runOutfitGeneration(...)
                  ├─ wardrobe.listGarments() → tagged only → <3 ? skip
                  ├─ generator.generate({ garments, profile, occasions, focusGarmentIds })   ← one Claude call
                  ├─ keepValidGeneratedOutfits(...)   (ids, sizes, occasion, ≤2 per occasion)
                  └─ outfits.storeSuggestions(...)    (dedupe, cap 10/occasion) + run log

GET  /v1/outfits                  ─▶ suggestions + saved + status   (instant)
POST /v1/outfits/saved            ─▶ save a suggestion
DELETE /v1/outfits/saved/:id      ─▶ remove a saved outfit
POST /v1/outfits/more             ─▶ queue one run (202) or 429 daily_limit_reached
```

`decideRun` is a **pure function** over (last change time, input marker of the
last successful run, today's run count, pending "more ideas" flag, last
catch-up date, now). All timing rules are tested there with fixed clocks.

### "Out of date"
The wardrobe is out of date when `last_changed_at` is later than the
`input_changed_at` recorded by the last **successful** run (the change time it
read before calling Claude). A failed run records nothing, so the wardrobe
stays out of date (decision 6).

### Data (same SQLite file, new `SqliteOutfitRepository`)
```sql
wardrobe_change_log(id INTEGER PRIMARY KEY CHECK (id = 1), last_changed_at TEXT NOT NULL)
outfit_suggestions(id TEXT PRIMARY KEY, occasion TEXT NOT NULL CHECK (occasion IN (...)), reason TEXT NOT NULL,
                   garment_key TEXT NOT NULL, created_at TEXT NOT NULL)
outfit_suggestion_garments(outfit_id TEXT REFERENCES outfit_suggestions(id) ON DELETE CASCADE,
                           position INTEGER, garment_id TEXT NOT NULL, PRIMARY KEY (outfit_id, position))
saved_outfits(id TEXT PRIMARY KEY, occasion TEXT NOT NULL, reason TEXT NOT NULL, garment_key TEXT NOT NULL, saved_at TEXT NOT NULL)
saved_outfit_garments(saved_id TEXT REFERENCES saved_outfits(id) ON DELETE CASCADE,
                      position INTEGER, garment_id TEXT NOT NULL, PRIMARY KEY (saved_id, position))
outfit_runs(id INTEGER PRIMARY KEY, trigger TEXT CHECK (trigger IN ('debounced','catch_up','more_ideas')),
            started_at TEXT NOT NULL, finished_at TEXT, status TEXT CHECK (status IN ('running','succeeded','failed','skipped')),
            input_changed_at TEXT, added INTEGER, error TEXT)
outfit_requests(id INTEGER PRIMARY KEY CHECK (id = 1), more_ideas_requested_at TEXT)
```
- `outfit_requests.more_ideas_requested_at` is set by `POST /v1/outfits/more` and cleared when a run **starts** (whatever its outcome), so one tap queues exactly one run; tapping again while one is pending changes nothing.
- `garment_key` = sorted garment ids joined by `,`. It makes the duplicate check (decision 8) one indexed lookup.
- Garment ids in outfit tables carry **no foreign key** to `garments`. Deleted garments are handled by decision 10: at the start of every run **and** whenever suggestions are read, any suggestion with a garment that no longer exists is deleted, so a deleted garment can never be shown or fed back to Claude. Saved outfits report `missingGarmentIds`.

### Claude call
Same client, prompt rules and data-not-instructions guard as `ClaudeOutfitSuggester`, extended:
- the user message lists the occasions to cover and, for a change-triggered run, the ids to favour;
- output schema `{ outfits: [{ occasion, garmentIds, reason }] }`;
- validation drops outfits with unknown or duplicate garment ids, fewer than 2 or more than 6 garments, an occasion that wasn't requested, or an empty reason; keeps at most 2 per occasion; trims each reason to 200 characters (same rules as `keepValidOutfits` today);
- `stop_reason` handling as today (`refusal`, `max_tokens` → `truncated`).

### API
| Route | Result |
|---|---|
| `GET /v1/outfits` | `200 { suggestions: [{ id, occasion, reason, createdAt, garments }], saved: [{ id, occasion, reason, savedAt, garments, missingGarmentIds }], status: { pending, running, lastRunAt, lastRunStatus, runsLeftToday, generationEnabled } }` |
| `POST /v1/outfits/saved` `{ suggestionId }` | `201 { saved }` · `404 suggestion_not_found` |
| `DELETE /v1/outfits/saved/:id` | `200 { id, deleted: true }` · `404 saved_outfit_not_found` |
| `POST /v1/outfits/more` | `202 { queued: true }` · `429 daily_limit_reached` · `422 wardrobe_too_small` · `503 outfits_not_configured` |

All routes need the owner token. `POST /v1/outfits/suggestions` is removed.

### Mobile ("Dress me")
- Opens instantly from `GET /v1/outfits`; occasion chips filter locally.
- Each suggestion card has ♡ (save). A **Saved** section lists saved outfits; missing pieces show "Missing a piece".
- Empty state: "Preparing ideas…" when a run is pending or running, otherwise "No ideas yet" + **More ideas**.
- **More ideas** queues a run; `429` shows "You've reached today's limit of new ideas."
- Refresh rule D5. Nothing persisted on the phone.

## Testing
- `decideRun`: debounce restart, 10-minute boundary, cap of 12, catch-up only when out of date and only once per night, More ideas honoured within the cap, D2 skip not counted.
- Repository: change log written by every wardrobe write; dedupe by `garment_key`; cap 10/occasion evicts oldest unsaved only; saving moves out of the pool; deleted-garment cleanup; missing pieces on saved outfits; run-log pruning.
- Generator: request shape (occasions, focus ids, cached wardrobe block), validation, stop reasons — fake transport only.
- Routes: auth, each status code above, removed endpoint returns 404.
- Scheduler: one run at a time; a failed run leaves the wardrobe out of date.
- Mobile: client parsing and error mapping; screen behaviour by manual run.

## Out of scope
Weather/calendar ranking (#10, #11 re-scope), push notification when ideas are
ready (#25), multi-user, editing a saved outfit's pieces.
