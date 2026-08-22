# Style Profile & Occasion Onboarding — Design

**Date:** 2026-08-21
**Status:** Approved design, revised after spec review
**Slice:** A of a four-part feature (A: style profile · B: wardrobe inventory · C: outfit suggestion · D: buy-through). This spec covers **A only**.

## Problem

Wist has no notion of who the user is stylistically. To build occasion-based outfit
suggestions (slice C) over an owned-garment inventory (slice B), the app first needs
a **style profile**: which occasions a person dresses for, and how they'd describe
their taste. This slice collects that profile and reads it back as a style identity
on the Profile screen. It also fixes the **occasion vocabulary** that slices B and C
will depend on, so those strings are decided once, now.

## Scope

### In scope
- A permanent occasion vocabulary and style vocabulary (stable ids, separate labels).
- Backend ownership of the profile in `catalogue-service` (own module, own tables, own routes).
- `GET`/`PUT /v1/profile` behind the existing owner token.
- A skippable two-step onboarding wizard shown once at first launch.
- An edit path on the Profile screen that also serves as the "your taste" read-back.

### Out of scope
- Feed/Discover re-ranking, alert filtering (no item carries style/occasion attributes yet).
- Any wardrobe, outfit generation, or buy-through work (slices B/C/D).
- Multi-user auth (single owner token remains the gate, as everywhere else in the service).
- A visual pick-A-or-B taste quiz (needs a licensed image library that does not exist).

## Decisions and rationale

| Decision | Choice | Why |
|---|---|---|
| What consumes the profile | A "your taste" summary on Profile; a server-side outfit engine later | No fake personalization over a ~2-product catalogue; the future engine is the real reader, which justifies backend ownership |
| Occasion capture | Fixed enum, multi-select | Matches the codebase's `string[]` idiom (`followedBrandIds`) |
| Taste capture | Style archetypes, multi-select up to 3 | Symmetric with occasions; cap keeps the summary legible |
| Taste scope | Global (not per-occasion) | Two-question onboarding stays short; per-occasion nuance can come from the wardrobe later |
| Ownership | Backend (`catalogue-service`) | A server-side outfit engine will read it — same justification as watches being backend-owned (the scheduler reads them) |
| Set storage | Child tables, delete-then-insert | Follows the existing `catalogue_media` / `catalogue_variants` pattern; uniqueness becomes a DB guarantee |
| Onboarding lifecycle | Skippable; Profile gets EDIT rows | Never block the price-drop hero feature behind a questionnaire; one picker component serves wizard + edit |
| Wizard layout | Editorial two-step (Layout A) | Chosen from visual mockups; most room for the serif voice |

## Vocabulary (permanent — renaming later requires a data migration)

Ids are stored; labels are display copy and may change freely.

### Occasions (5)
| id | Label | Meaning |
|---|---|---|
| `work` | Work | Office, meetings, professional settings |
| `evening` | Evening | Dinners, drinks, going out |
| `weekend` | Weekend | Casual daytime, errands, coffee |
| `celebration` | Celebration | Weddings, parties, milestone events |
| `travel` | Travel | Transit, holidays, packing |

### Styles (6, pick up to 3)
`minimal` · `tailored` · `romantic` · `utilitarian` · `bold` · `eclectic`

Deliberately aesthetic words (a sensibility), not garment words.

## Data model

```ts
// catalogue-service/src/styleProfile.ts  (mirrors model.ts)
export type Occasion = "work" | "evening" | "weekend" | "celebration" | "travel";
export type Style =
  | "minimal" | "tailored" | "romantic" | "utilitarian" | "bold" | "eclectic";

export type StyleProfile = {
  occasions: Occasion[];   // 0..5, unique, order-insensitive
  styles: Style[];         // 0..3, unique, order-insensitive
  updatedAt: string;       // ISO 8601
};
```

The **app** defines its own `Occasion`/`Style` types in `src/types.ts`, matching the
existing package boundary: the app's `src/types.ts` (`Item`, `Brand`) and the service's
`model.ts` (`CatalogueItem`, `CatalogueBrand`) are already separate, parallel definitions
kept in lockstep by hand — `catalogueClient.ts` imports the app-side types from `../types`
and validates the service's JSON into them. The `Occasion`/`Style` enums follow the same
convention: two definitions, hand-synced. The vocabulary is small and permanent, so this
is a deliberate, low-cost duplication, not shared code.

`0` is a valid count for both: the wizard is skippable, so an empty profile is a
**resolved** state, not an invalid one.

## Service design

### Ownership boundary
This change makes `catalogue-service` responsible for durable owner taste data, which is
a service-level ownership expansion even though the profile is **not** part of the
catalogue domain. Co-location is deliberate for the single-user prototype: the process
already owns the owner's watches and alerts, and the planned outfit engine will consume
the profile. The profile keeps its own module, interface, and SQLite implementation so
the domain boundary remains visible; a separate service is not justified yet.

`model.ts` and `repository.ts` remain untouched. `sqliteRepository.ts` only gains the
same `busy_timeout` used by the new repository. The profile shares only the process,
the SQLite file, and the owner token with the catalogue module.

```
server.ts  (reads request body; owns both repositories)
  ├─ /v1/brands · /v1/items · /v1/watches · /v1/alerts → CatalogueRepository (unchanged)
  └─ /v1/profile                                        → StyleProfileRepository (NEW)
                                                             └─ style_profiles
                                                                style_profile_occasions
                                                                style_profile_styles
```

### New files
| File | Mirrors | Holds |
|---|---|---|
| `styleProfile.ts` | `model.ts` | `Occasion`, `Style`, `StyleProfile`, `parseStyleProfile()` |
| `styleProfileRepository.ts` | `repository.ts` | `StyleProfileRepository` interface |
| `sqliteStyleProfileRepository.ts` | `sqliteRepository.ts` | SQLite implementation, its own connection to the same DB file |

WAL permits concurrent readers, but SQLite still serializes writes from the catalogue
scheduler and profile repository. Both connections set a short `busy_timeout`, allowing
the tiny profile transaction to wait for an active catalogue write instead of failing
immediately with `SQLITE_BUSY`. A shared handle is unnecessary for this prototype.

### Schema (additive; plain `CREATE TABLE IF NOT EXISTS`, no migration framework exists)
```sql
CREATE TABLE IF NOT EXISTS style_profiles (
  id         TEXT PRIMARY KEY,   -- always 'owner' while single-user
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS style_profile_occasions (
  profile_id TEXT NOT NULL REFERENCES style_profiles(id) ON DELETE CASCADE,
  occasion   TEXT NOT NULL,
  PRIMARY KEY (profile_id, occasion)
);
CREATE TABLE IF NOT EXISTS style_profile_styles (
  profile_id TEXT NOT NULL REFERENCES style_profiles(id) ON DELETE CASCADE,
  style      TEXT NOT NULL,
  PRIMARY KEY (profile_id, style)
);
```

`PUT` writes with delete-then-insert on the child tables inside a transaction,
matching `recordObservation`'s handling of media/variants.

### API
Both routes are registered **above** the `method !== "GET"` guard at `app.ts:85`, and
both require the owner token.

```
GET /v1/profile → 200 { profile: { occasions, styles, updatedAt } | null }
PUT /v1/profile → 200 { profile: { occasions, styles, updatedAt } }
   body: { "occasions": ["work","evening"], "styles": ["minimal","tailored"] }
```

- `PUT` **replaces** (not merges) — both wizard and edit submit the complete set, so
  replace is idempotent and needs no merge logic.
- `profile: null` distinguishes *never answered* from *answered with nothing* — this
  drives the wizard gate.

Errors (following existing vocabulary):
| Status | Body | When |
|---|---|---|
| 503 | `profile_api_not_configured` | No owner token, or repository unavailable |
| 401 | `unauthorized` | Bad/missing token |
| 400 | `invalid_profile` | Malformed JSON, non-object/missing fields, unknown enum, duplicate, or >3 styles |
| 413 | `payload_too_large` | Body exceeds 8 KB cap |
| 405 | `method_not_allowed` | Any method other than GET/PUT |

### Required changes to existing service code (both additive/non-breaking)
1. **`handleRequest` gains a 5th options argument** `{ body?, profiles? }`. Every existing
   call site and test keeps compiling. `server.ts` reads the request stream with an **8 KB
   cap** (matching the response-size caps the probes already enforce).
2. **`watchAuthError` generalizes to `ownerAuthError(auth, notConfiguredError)`.** Watch
   routes keep passing `"watch_api_not_configured"`; no existing test or contract changes.

## App design

### Store (`useWistStore`) — client cache mirroring the watch pattern
New slice (added to `partialize` so the gate survives restart):
```ts
occasions: Occasion[];
styles: Style[];
profileStatus: "unknown" | "answered" | "skipped";
markProfileSkipped: () => void;
replaceStyleProfile: (occasions, styles) => void; // local commit or synchronized response
```

`profileStatus` is the entire gate:
- `"unknown"` → never resolved → show wizard.
- `"answered"` / `"skipped"` → never auto-show again.

GET mapping: a returned profile → `"answered"`. When GET returns `profile: null`, a
cached `"answered"` profile is PUT back to the backend and reconciled with the response;
this repairs an onboarding write that previously failed offline. Cached `"unknown"` and
`"skipped"` states remain unchanged.

### Gate wiring (App.tsx)
An unpersisted `profileLookupComplete` flag prevents the wizard from racing the initial
backend read. It slots in after the existing hydration gate at `App.tsx:135`:
```
fonts + store hydrated?                              ─no→  spinner
profileStatus unknown + profile lookup incomplete?  ─yes→ spinner
profileStatus === "unknown"?                         ─yes→ <OnboardingScreen />
                                                     ─no→  existing tabs + screens
```
A new `GET /v1/profile` effect mirrors the `loadWatchedItemIds` effect (`App.tsx:89-104`):
same `storeHydrated` guard, cancel flag, and warn-on-failure. The lookup is marked complete
in `finally`. Catalogue offline → status stays whatever the cache says; a fresh install
shows onboarding, while a cached answer or skip continues into the app.

### Wizard (`src/screens/OnboardingScreen.tsx`, Layout A)
Plus one reusable `OccasionStylePicker` chip component (the tap-grid), reused by the edit rows.
```
STEP 1 occasions → STEP 2 styles → local status "answered" → app → PUT /v1/profile
   └── Skip ───────────────────────→ status "skipped" (no network call) → app
```
- Continue is always enabled (empty selections are valid). Styles disables unselected
  chips once 3 are chosen.
- Progress dots + Continue pill; garnet only on selected chips; tokens from `theme.ts`.
- Completing onboarding persists the selections locally before PUT so an outage never
  traps the user in the wizard. A successful PUT reconciles the canonical response; a
  failure reports that the answers are saved on-device. On a later launch, GET `null`
  plus a cached `"answered"` profile triggers another PUT, providing eventual consistency
  without a background queue. The backend remains the durable consumer for outfit logic.

### Edit path (`ProfileScreen`)
Two `EDIT` rows added **above** the `FOLLOWED HOUSES` section — occasions and styles,
showing current selections as read-back text ("Work, Evening"). Tapping opens the same
`OccasionStylePicker` in a modal. Saving sends PUT first, then updates the cache and closes
the modal on success; failure retains the draft. This is both the edit path Layout A lacked
and the "your taste" summary chosen as the consumer.

## Testing (mirrors existing test files)
- `styleProfile.test.ts` — validation: rejects unknown enum / >3 styles / duplicates; accepts empty.
- `sqliteStyleProfileRepository.test.ts` — round-trip, replace-overwrites, cascade delete.
- `app.test.ts` additions — GET null-then-value, PUT replace, 401 / 400 / 413.
- Client tests — response validation and PUT request/response handling.
- Store test — `profileStatus` transitions.
- App gate tests — remote profile suppresses onboarding before first render; null and
  offline fresh-state results show it; cached answered/skipped state bypasses it.
- Synchronization policy test — a cached answer is PUT when the backend returns null.

No new dependencies. No changes to the drop engine, watch scheduler, or catalogue repository.

## Scope summary
| New files | Modified files | Untouched |
|---|---|---|
| `styleProfile.ts`, `styleProfileRepository.ts`, `sqliteStyleProfileRepository.ts`, `OnboardingScreen.tsx`, `OccasionStylePicker.tsx`, + tests | `app.ts`, `server.ts`, `sqliteRepository.ts` (busy timeout only), `useWistStore.ts`, `App.tsx`, `ProfileScreen.tsx`, `src/types.ts` (add `Occasion`/`Style` enums) | catalogue repository interface/model, drop engine, scheduler |

## Future migration triggers (recorded, not built)
- **Multi-user:** replace the `'owner'` profile id and owner token with real per-user auth.
- **Server-side outfit engine:** the engine reads `style_profiles` directly in-process;
  no API change needed. This is the consumer that justifies backend ownership.
