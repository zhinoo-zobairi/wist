# iOS Browsing Rework — Design

**Date:** 2026-10-25
**Status:** Decisions approved by the owner on 2026-10-25 ("approach B, yes to all")
**Source:** [iOS app audit and proposal](2026-10-25-ios-app-audit-and-proposal.md), approach B. Finding ids (F01…) refer to that document.
**Slice:** Mobile, compact layout. The wide web layout must keep rendering but is not redesigned. No navigation library.

## Problem

The app's look is coherent, but four state bugs undermine it (follows re-seeded on every launch, a notification tap that opens nothing, prices that go stale after a drop, a dead backend with no recovery), and the two browsing screens are thin: Home shows no product before scrolling and Discover shows about one and a half pieces per screen.

## Approved decisions

| # | Decision | Value |
|---|---|---|
| 1 | Auto-follow (F01) | Seed follows only while `followedBrandIds` still equals the seed default; after an import follow only brand ids absent from the previous catalogue. No new persisted key |
| 2 | Request timeout (F05) | 10 000 ms on every `catalogueClient` call through one `AbortController` wrapper (the `saveLocation` precedent). First-run gate unchanged |
| 3 | Catalogue recovery (F03) | `catalogueStatus: "loading" \| "ready" \| "error"` passed to Feed, Discover, Coveted, Alerts; honest copy per state; a primary "Try again" Button on error; pull-to-refresh (`RefreshControl`, the Wardrobe pattern) on Feed, Discover and Coveted. No automatic retry |
| 4 | Catalogue freshness (F06, F28) | Reload the catalogue when the poll sees a new newest alert id, and on every `AppState` "active" transition together with `refreshWatches`. No periodic reload |
| 5 | Notification permission (F27) | Ask on the first successful covet when permission is undetermined, after one line of context ("Wist will tell you when this drops."); the poll only checks |
| 6 | Notification tap (F02) | Opens the product page: `useLastNotificationResponse`, held in a ref until the item is loaded, then `markAlertRead` + `viewAlertItem` |
| 7 | Launch fetch (F23) | Brand items fetched with `Promise.all` |
| 8 | Hydration failure (F29) | Mark hydration settled, run with defaults, keep the stored blob, `console.warn` |
| 9 | Covet and import sync (F24, F25) | `refreshWatches` after every successful covet write; import clears the field on POST success and reports a refresh failure as "Added. Wist could not refresh the list yet." |
| 10 | Muted token (F37) | `colors.muted` becomes `#6B675F` (4.99:1 on paper). Revisits "palette unchanged" |
| 11 | Product page exits (F08) | Tab bar stays mounted on product detail; any tab tap exits. No push transition, no edge swipe |
| 12 | Home first viewport (F10, F11) | Quiet block folded into one kicker line under the dek; `intro.paddingTop` 20, `houses.paddingBottom` 24; the edit shows 8 pieces; "FOR YOU" kicker removed; house tiles get gap 6 inside and 20 between, width 106. Section order unchanged |
| 13 | Remove on Coveted (F22) | Inline confirm box, the Garment editor pattern: "Remove" / "Keep" ActionLinks |
| 14 | Product video (F35) | Plays only while its page is active; `nativeControls` off |
| 15 | Tile image URLs (F36) | The Demandware adapter appends `?sw=800` to `image_url` only; media keeps the hi-res URL; Bobbies unchanged |
| 16 | Intro plates (F32) | `Plate` gets the `GarmentPhoto` failed state (wash rectangle, credit hidden). No bundling, no prefetch |
| 17 | View on brand (F34) | `Linking.openURL(...).catch` sets the screen's error text; the service resolves relative offer URLs against the product URL |
| 18 | Cold start (F33) | `fontError` counts as ready; `app.json` splash `backgroundColor` becomes `#F4F1EB`. No splash hold |
| 19 | Intro page height (F09) | Stop rounding the stage height; safe areas unchanged |
| 20 | Discover header (F14) | Header moves into `ListHeaderComponent`; the "CURATED HOUSE / name" block collapses to one "N pieces · FOLLOW" row |

Also approved as non-consequential, one commit each: F07 gallery windowing (horizontal FlatList), F12 Icon colour one-liner, F15 ActionLink alignment, F17 keyboard taps on Coveted, F18 4:5 everywhere, F19 `ProductPhoto` with failure state, F20 gutter alignment, F21 size-chip role and copy, F26 badge consistency, F38 intro credit size, F39 chip and input borders, F40–F43 accessibility roles, labels, announcements and tap targets, F44 user-facing error copy.

**Ownership change.** None new in the app. The catalogue service gains two small adapter rules (tile URL, absolute offer URL).

## Design

- **App shell** (`App.tsx`): `catalogueStatus` state beside `liveCatalogue`; one `reloadCatalogue()` used at launch, on "Try again", on pull-to-refresh, on a new alert id and on foreground; one `AppState` listener; one `useLastNotificationResponse` effect; `addFollowedBrands` only when the persisted set equals the seed default; tab bar no longer hidden on product detail.
- **Client** (`src/services/catalogueClient.ts`): `withTimeout(ms)` helper; `Promise.all` in `loadCatalogue`.
- **Store** (`src/store/useWistStore.ts`): `onRehydrateStorage` handles the error argument.
- **Notifications** (`src/services/notifications.ts`): `requestPriceDropPermission()` for the covet moment; `sendPriceDropNotification` only checks.
- **Screens**: Feed, Browse, Saved, Alerts take `catalogueStatus` and `onReload`; `ProductPhoto` replaces bare `Image`s; Browse renders its header inside the FlatList.
- **Theme**: one token change.
- **Catalogue service**: `jsonLdProduct.ts` tile URL and absolute offer URL, with tests.

## Testing

`npm run typecheck && npm test` after every commit. New unit tests where logic is pure: follow seeding, timeout wrapper, hydration error, notification response handling, adapter URL rules. Simulator walkthrough at the end: Home quiet and drop states, Discover, product, Coveted remove, Alerts, cold start against a stopped backend.

## Out of scope

Approach C (development build, splash hold, in-app browser, navigation library, icon regeneration), remote push, dark mode, the wide layout.
