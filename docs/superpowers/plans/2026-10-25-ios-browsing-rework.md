# iOS Browsing Rework — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-10-25-ios-browsing-rework-design.md` (decisions D1–D20, approved 2026-10-25). Finding ids (Fxx) refer to `docs/superpowers/specs/2026-10-25-ios-app-audit-and-proposal.md`, which carries evidence, line numbers, the proposed fix and, where present, the skeptic's narrower fix: prefer the narrower fix.

## Conventions

- Repo root `/Users/zhinoo.zobairi/Code/WIST`, branch `main`. Never push.
- `npm run typecheck && npm test` must be green before every commit. Tests never render screens; add unit tests only for pure logic (new helpers, store behaviour, adapters).
- One reviewable idea per commit, subject `type(scope): description` (lowercase, imperative, no period), scope `app` or `catalogue`. No co-author or AI attribution trailers. Stage only the files of the slice (`git add <paths>`), never `git add -A`.
- Follow the existing primitives (`Button`, `ActionLink`, `ScreenHeader`, `GarmentPhoto`, `pageStyle`/`useLayout`, theme tokens). No new dependencies. Keep the wide (web) layout rendering: when a compact style changes, leave the `*Wide` variants intact.
- Do not touch the simulators; do not run `npm run web` or Metro.

## Tasks (in order; T1 and T6 touch disjoint files and may run in parallel)

### T1 · Catalogue lifecycle and state integrity
Files: `App.tsx`, `src/services/catalogueClient.ts`, `src/store/useWistStore.ts`, `src/profileGate.ts`, `src/screens/{FeedScreen,BrowseScreen,SavedScreen,AlertsScreen}.tsx`, `app.json`, tests.
1. F05 / D2: `withTimeout` (10 000 ms, `AbortController`, modelled on `saveLocation`) applied to every client call; test it.
2. F23 / D7: `loadCatalogue` fetches brand items with `Promise.all`.
3. F29 / D8: `onRehydrateStorage` receives `(state, error)`; on error warn and still settle hydration so `App` leaves the spinner with defaults.
4. F33 / D18: `const [fontsLoaded, fontError] = useFonts(...)`; `fontsLoaded || fontError !== null` feeds `resolveProfileGate`; `app.json` splash `backgroundColor` `#F4F1EB`; `profileGate.test.ts` case.
5. F03 / D3: `catalogueStatus` state and `reloadCatalogue()` in `App.tsx`, passed to Feed, Discover, Coveted, Alerts; copy: loading "Loading the index…", error "Couldn't reach the index." + primary `Button` "Try again"; Coveted/Alerts in error say how many pieces are coveted from the persisted ids and "reconnect to see them"; `RefreshControl` on Feed, Discover (FlatList) and Coveted.
6. F06, F28 / D4: in the poll, reload the catalogue when `remoteAlerts[0]?.id` differs from the previous newest id; one `AppState` "change" listener that on "active" runs `reloadCatalogue()` and `refreshWatches()`.
7. F01 / D1: at launch call `addFollowedBrands` only while `followedBrandIds` deep-equals the seed default; after an import follow only brand ids absent from the previous catalogue. Unit test on the pure decision (extract a helper).
8. F24, F25 / D9: `refreshWatches()` after a successful `setCatalogueWatch`; `importLiveProduct` clears the field on POST success and reports a refresh failure as "Added. Wist could not refresh the list yet." (SavedScreen shows it as a notice, not an error).

### T2 · The price-drop moment
Files: `src/services/notifications.ts`, `App.tsx`, `src/components/BottomTabBar.tsx`, `src/screens/{FeedScreen,AlertsScreen,BrowseScreen,IntroScreen}.tsx`.
1. F27 / D5: `requestPriceDropPermission()`; in `toggleLiveCovet` when `watched` becomes true and permission is undetermined, show the context line then request; `sendPriceDropNotification` only checks.
2. F02 / D6: `Notifications.useLastNotificationResponse()` in `App.tsx`; keep `itemId`/`alertId` in a ref until `itemsById` has the item, then `markAlertRead` and `viewAlertItem`. Web: no-op.
3. F26: derive describable alerts once; `hasUnreadAlerts` computed over the same list.
4. F41: two-way `accessibilityLabel` on the Alerts tab and the Feed bell.
5. F18: `aspectRatio: 4 / 5` on Feed edit tiles, Browse rows and the Alerts hero (thumb 60×75).
6. F38: delete `fontSize: 9` and `letterSpacing: 1.2` from the intro credit.

### T3 · Product page media and the catalogue adapters
Files: `src/screens/ProductDetailScreen.tsx`, new `src/components/ProductPhoto.tsx`, `catalogue-service/src/jsonLdProduct.ts` (+ tests), screens using bare `Image`.
1. F07: gallery as a horizontal `FlatList` (`pagingEnabled`, `getItemLayout`, `initialNumToRender` 1, `windowSize` 3).
2. F35 / D14: `ProductVideo` gets `active`; play/pause in an effect; `nativeControls={false}`.
3. F19: `ProductPhoto` ({ uri, style, accessibilityLabel }, wash frame, `onError` → "Photo unavailable", no caption on the 60×75 thumb) replacing the bare `Image`s on Feed, Browse, Saved, Alerts and the product gallery.
4. F21: size chips get `accessibilityRole="button"` and the un-coveted note "Covet this piece to pick the sizes Wist should alert you on. Faded sizes were unavailable at the last check."
5. F34 / D17: `Linking.openURL(item.url).catch(() => setBuyError("Could not open the brand page"))`; in the service resolve relative offer URLs with `new URL(offers.url, productUrl)`; test.
6. F36 / D15: Demandware adapter appends `?sw=800` to `image_url` only (media keeps hi-res); test.

### T4 · Home and Discover browsing rework
Files: `App.tsx`, `src/components/{ActionLink,BackLink,Icon}.tsx`, `src/screens/{FeedScreen,BrowseScreen,SavedScreen,AlertsScreen,ProfileScreen}.tsx`.
1. F08 / D11: tab bar stays mounted on product detail (drop the `!selectedItemId` condition).
2. F15: delete `alignSelf: "flex-start"` from `ActionLink` (and `BackLink`).
3. F20: the hard-coded 14s become `spacing.gutter` (Feed 164/187, Browse 200, Saved 159/168, Alerts 112, Profile 284).
4. F12: `Icon.tsx` forces wine only when the caller passed the default ink; Feed covet button inset 12.
5. F10 / D12: Home quiet block → one `typography.kicker` line under the dek; `intro.paddingTop` 20; `houses.paddingBottom` 24; edit `slice(0, 8)`; "FOR YOU" removed. Keep `quietSignalWide`.
6. F11 / D12: house tiles gap 6 inside, `houses.gap` 20, width 106, no fixed height.
7. F14 / D20: Browse header into `ListHeaderComponent`; "CURATED HOUSE / name" block → one "N pieces · FOLLOW" row.
8. F22 / D13: inline confirm for Remove on Coveted (the GarmentEdit pattern).
9. F17: `keyboardShouldPersistTaps="handled"` on the Coveted ScrollView; `accessibilityLabel="Shop link"`, `returnKeyType="go"` on the input.

### T5 · Accessibility and copy
Files: `src/theme.ts`, `src/components/OccasionStylePicker.tsx`, `src/screens/*.tsx`, `src/wardrobeMessages.ts` (+ test), `src/services/catalogueClient.ts`.
1. F37 / D10: `colors.muted` `#6B675F`.
2. F39: `borderColor: colors.muted` on the unselected picker chip and the garment-edit input only.
3. F40: `accessibilityRole="button"` and labels on every row/image/covet Pressable on the browse path; `accessibilityElementsHidden` on index numbers; role tab + selected on Browse brand tabs.
4. F43: `hitSlop` top/bottom 12 on Browse tabs, 8 on the Discover covet row, Feed covet button 44×44, `ActionLink` hitSlop 10.
5. F42: `AccessibilityInfo.announceForAccessibility` on transitions only (Dress me waiting→ready; debounced search count).
6. F44: owner/server copy thrown as `WardrobeNotice` from `responseJson`; `importErrorMessage()` in `wardrobeMessages.ts` with a test; fixed sentences for the Profile and Onboarding alerts.

### T6 · Intro
Files: `src/screens/IntroScreen.tsx`.
1. F09 / D19: `setStage({ width: Math.round(width), height })`.
2. F32 / D16: `Plate` gets the `GarmentPhoto` failed state (wash rectangle, credit hidden on failure).

### T7 · Verification and ticket
Simulator walkthrough of the changed screens; GitHub issue in the repo's format with an "In plain words" section, the decisions table, acceptance checkboxes and the commit list.
