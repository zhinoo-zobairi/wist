# Daily Weather Pick — Design

**Date:** 2026-10-11
**Status:** Decisions approved by the owner on 2026-10-11
**Slice:** C2.1. Replaces the phone-side warmth ranking from #10. Builds on #27 (background generation) and #10 (Open-Meteo weather).

## Problem

#10 ranks stored outfits on the phone with a fixed warmth rule. It is free and
instant, but blunt: it knows only warmth, not rain, fabric or layering. The owner
wants Claude to choose what suits today's weather, without waiting for it when
Dress me opens.

## What changes

| Before (#10) | After (C2.1) |
|---|---|
| Phone reads location and the backend fetches weather when Dress me opens | Phone stores its rounded location on the backend when Dress me opens; the backend fetches weather at 06:00 |
| Phone ranks outfits by a warmth rule | One Claude call at 06:00 ranks every stored outfit for today's weather |
| Weather line shows live weather | Weather line shows the 06:00 forecast used by the pick |

**Ownership change.** The catalogue service now stores the owner's latest
rounded location and one daily pick, and runs one more scheduled Claude call.

## Approved decisions

| # | Decision | Value |
|---|---|---|
| 1 | Location source | The phone sends its location, rounded to 2 decimals (~1 km), each time Dress me opens with location permission. The backend keeps **only the latest** (one row, overwritten); no history. Open-Meteo request logs as already approved for #10 |
| 2 | Schedule | **06:00 server-local**, **one attempt per day**, on the existing outfit scheduler's 60 s tick. Separate from the 12/day generation cap |
| 3 | Skips | No stored location, no outfits, or no API key → no call that day |
| 4 | Model | `claude-sonnet-5-5`, effort `medium`, `max_tokens` 8000, 90 s timeout, 2 SDK retries, server-side refusal fallback |
| 5 | Output | A **full ranking**: an ordered list of every stored outfit id (ideas and saved) plus a reason of at most 200 characters for the **top 3** |
| 6 | Failure | No retry. That day Dress me shows the server order (newest first) and "Today's pick isn't ready". The next attempt is tomorrow at 06:00 |
| 7 | Validation | Unknown and duplicate ids dropped. Stored outfits missing from Claude's order, or created after the pick, follow the ranked ones, newest first |
| 8 | Storage | Only the latest pick is kept (replaced each day) |
| 9 | Removed | Phone warmth ranking (`src/outfitRanking.ts`), `GET /v1/weather`, the phone's live weather call (`loadWeather`) |
| 10 | Display | Weather line from the pick's forecast; the top 3 in the current occasion filter are marked "For today" with their reason |

Accepted trade-offs: ideas generated after 06:00 are ranked the next day; on the
first morning of a trip the pick uses the previous day's location.

## Architecture

```
OutfitSuggestionsScreen (open, location allowed)
  └─ currentCoarseLocation ─▶ PUT /v1/location {latitude, longitude} ─▶ outfit_location (1 row)

startOutfitScheduler (60 s tick)
  ├─ runDueOutfitGeneration   (unchanged)
  └─ runDueDailyPick
        due when: server-local hour ≥ 6 and no pick attempted for today's local date
        ├─ no location / no outfits / no suggester → record skipped, no call
        ├─ weatherSource.today(location)            (Open-Meteo, existing)
        ├─ picker.pick({ weather, outfits })         ← one claude-sonnet-5-5 call
        ├─ keepValidRanking(...)                     (drop unknown/duplicate ids)
        └─ outfits.storeDailyPick(...)               (replaces the previous one)

GET /v1/outfits ─▶ { suggestions, saved, status, today: { day, weather, order, reasons } | null }
```

- "Today" for the pick is the **server-local calendar date**; the attempt is
  recorded before the call so a failure or restart does not repeat it that day.
- Weather failure counts as a failed attempt (no call to Claude).
- The picker input reuses the generation wardrobe text (ID-sorted garment lines)
  and lists each outfit as `id`, occasion, garment ids, and whether it is saved.
  Garment and outfit text are data, never instructions.

## API

| Route | Result |
|---|---|
| `PUT /v1/location` `{ latitude, longitude }` | `204`; `400 invalid_location`; rounded to 2 decimals server-side too |
| `GET /v1/outfits` | adds `today: { day, weather, order: string[], reasons: Record<string,string> } \| null` |

Both need the owner token. `GET /v1/weather` is removed.

## Mobile

- On open: `currentCoarseLocation()` → `saveLocation()` once per visit,
  fire-and-forget (errors ignored, never blocks the board).
- Sort ideas and saved outfits by `today.order`; unranked ones follow, newest first.
- Weather line: the pick's forecast ("This morning's forecast: 6–11 °C · rain likely · Open-Meteo"),
  "Today's pick isn't ready" when `today` is null.
- "For today" marker plus reason on the top 3 of the current filter that have a reason.

## Testing

- Schedule: due at/after 06:00 once per local date; not before; skipped cases record an attempt and make no call.
- Picker: request shape (model, effort, tokens, weather + outfit text after the cached wardrobe block), stop reasons, schema.
- Validation: unknown/duplicate ids dropped; reasons only for ranked ids, trimmed to 200.
- Repository: one location row overwritten; one pick replaced.
- Routes: auth, `PUT /v1/location` validation and rounding, `GET /v1/outfits` `today` shape, removed `/v1/weather` → 404.
- Mobile: client parsing of `today`, `saveLocation` request; pure ordering function with ranked, unranked and missing ids.

## Out of scope

Re-picking during the day, trip detection, push notifications (#25), flat-lay collages.
