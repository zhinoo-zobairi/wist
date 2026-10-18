# UI Unification and Scrollytelling Intro — Design

**Date:** 2026-10-18
**Status:** Decisions approved by the owner on 2026-10-18 ("do everything, no limitations")
**Slice:** U1. Mobile only. No backend change.

## Problem

The app grew in two visual languages. The catalogue side (Feed, Discover,
Alerts, Product) is sharp editorial: square ink buttons, hairlines, wine accent,
radius 3. The wardrobe side (Wardrobe, Dress me, Garment editor, the Coveted
import card) is soft: 20 px rounded cards, pill buttons, moss accent. There is
no shared Button, no shared header, three back-link glyphs, two wordmark fonts,
seven hardcoded tint colours and kicker text at 7 to 9 px.

Four things are broken outright:

1. **Alerts reads seed data.** `AlertsScreen` resolves items through
   `src/data/seed.ts`, so a real price drop on a live item renders "The room is
   quiet" and history rows return null.
2. **Profile lists seed brands** under "Followed houses" while the count beside
   the heading counts live ids.
3. **Discover's search row does nothing.** It is a `Pressable` with no handler.
4. **Product detail shows "1 / 1"** over single-image products.

The owner also wants an elegant scrollytelling intro before the profile
questions, and the whole UI must work on iOS and web.

## What changes

| Before | After |
|---|---|
| Two visual languages | One editorial language: square (radius 3), hairlines, ink primary, wine for price-drop moments, moss for wardrobe actions |
| Five button styles, inline | One `Button` primitive: primary (filled), secondary (outlined), any accent colour, busy and disabled states, pressed feedback |
| Three back-link glyphs, two wordmark fonts | `BackLink` and a shared wordmark style (Cormorant Garamond, letter-spaced) |
| Kickers at 7–9 px | Type scale with a floor: kicker 10, caption 11, body 13 |
| Seven hardcoded tints | Named theme tokens for text on wine and on moss |
| Onboarding opens on "01 · YOUR WORLD" | Four-panel scroll-driven intro, then the same two questions |
| Alerts and Profile read seed data | Both receive `brands` and `items` like every other screen |
| Dead search row | Client-side filter across the loaded catalogue |

**Ownership change.** None. No new persisted state, tables, jobs or dependencies.

## Approved decisions

| # | Decision | Value |
|---|---|---|
| 1 | Scope | Unify every screen, fix the four bugs, add the intro |
| 2 | Button shape | Square editorial: radius 3, min height 50, uppercase 10 px label, 1.2 letter spacing. Primary = filled, secondary = 1 px outline. Default colour ink; wardrobe actions pass moss; onboarding passes wine |
| 3 | Chips and inputs | Same radius 3 as buttons (selection chips, size boxes, text inputs, photo frames, cards). `radii.pill` remains only for progress dots and badges |
| 4 | Type floor | Kicker 10 / caption 11 / body 13. Screen title 44/46, section 28, item name 20/22, small item name 18/20. Wordmark Cormorant 600, 22 px, 4 letter spacing |
| 5 | Palette | Unchanged. Add named tints: `onWineMuted #E7BEC3`, `onWineSoft #F2DADD`, `onWineLine #C86570`, `onMossMuted #C9D0C4`, `onMossSoft #D8DDD4` |
| 6 | Pressed feedback | Every tappable surface dims to 0.7 opacity while pressed (images 0.85). Web gets this for free through `Pressable` |
| 7 | Search | `searchItems(items, brands, query)` in `src/catalogueSearch.ts`: case- and diacritic-insensitive match on item name or brand name, every term must match. When the query is non-empty, Discover hides the brand tabs and brand head and lists matches across all brands with a count line and a clear button |
| 8 | Intro gating | The intro shows whenever onboarding would show (`profileStatus === "unknown"`), as a phase inside `OnboardingScreen`. No new persisted flag. Killing the app mid-intro replays it |
| 9 | Intro mechanics | Vertical `Animated.ScrollView`, `pagingEnabled`, panel height from `onLayout`. Opacity and translateY interpolate from the scroll offset (built-in `Animated`, `useNativeDriver` only off web). Reduced motion (`AccessibilityInfo.isReduceMotionEnabled`) disables the translate and keeps the fade |
| 10 | Intro content | 1 "Wist." + the Kurdish definition · 2 "You covet a piece." with the heart · 3 "Wist watches its price, quietly." · 4 wine panel "When it drops, you know first." with € 550 struck through and € 385 beside it, then a BEGIN button. SKIP top-right on every panel, same action as today's skip |
| 11 | Media counter | Hidden when a product has one media entry |
| 12 | Loading screen | Wordmark above the activity indicator instead of a bare spinner |
| 13 | Web column | Unchanged: the app stays a centred 480 px column on wide screens |

Accepted trade-offs: chips lose their pill shape; the intro cannot be
dismissed permanently without finishing or skipping onboarding, which is the
existing behaviour for the questions too.

## Design

### Theme (`src/theme.ts`)

Add `type` (named text styles built from `fonts`) and the five tint colours.
Add `spacing.gutter = 22`, the screen side padding every screen already uses by
number. Keep `radii.card = 3`.

```ts
export const type = {
  wordmark: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 4, color: colors.ink },
  kicker:   { fontFamily: fonts.textSemibold, fontSize: 10, letterSpacing: 1.6, color: colors.muted },
  label:    { fontFamily: fonts.textSemibold, fontSize: 10, letterSpacing: 1.2, color: colors.ink },
  caption:  { fontFamily: fonts.text, fontSize: 11, lineHeight: 16, color: colors.muted },
  body:     { fontFamily: fonts.text, fontSize: 13, lineHeight: 20, color: colors.muted },
  price:    { fontFamily: fonts.textSemibold, fontSize: 13, color: colors.ink },
  titleXL:  { fontFamily: fonts.display, fontSize: 44, lineHeight: 46, color: colors.ink },
  titleL:   { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.ink },
  titleM:   { fontFamily: fonts.display, fontSize: 20, lineHeight: 22, color: colors.ink },
  titleS:   { fontFamily: fonts.display, fontSize: 18, lineHeight: 20, color: colors.ink },
} as const;
```

Screens spread these into their own `StyleSheet` entries (`{ ...type.kicker,
color: colors.wine }`), so a screen can still override colour.

### Primitives (`src/components/`)

- **`Button`** — `label`, `onPress`, `variant?: "primary" | "secondary"`
  (default primary), `color?: string` (default `colors.ink`), `busy?`,
  `disabled?`, `icon?: IconName` (drawn after the label), `compact?` (height 38,
  horizontal padding 14, for inline follow buttons). Busy shows an
  `ActivityIndicator` in the label colour and disables presses. Disabled is
  0.35 opacity. Pressed is 0.7 opacity. `accessibilityRole="button"`,
  `accessibilityState={{ disabled, busy }}`.
- **`BackLink`** — `label`, `onPress`. Chevron icon plus uppercase label in
  `type.label`. Replaces "← BACK", "‹ PROFILE", "‹ WARDROBE".
- **`ActionLink`** — `label`, `onPress`, `color?`, `disabled?`. Uppercase
  `type.label` text with pressed feedback. Replaces inline uppercase text
  links (DISCOVER ALL, REMOVE, EDIT, OPEN, + ADD, SKIP, the confirm choices).
- **`ScreenHeader`** — `kicker?`, `title`, `subtitle?`, `right?: ReactNode`.
  Used by Discover, Alerts, Coveted, Profile, Wardrobe, Dress me, Garment
  details. Feed keeps its own wordmark bar.
- **`Icon`** gains `chevron` (`M15 6l-6 6 6 6`).

### Screen changes

Every screen replaces inline buttons, back links, headers and small text with
the primitives and `type` tokens, removes its hardcoded tints, sets radius 3 on
cards, chips, inputs and frames, and adds pressed feedback on image and row
taps. Specific changes beyond that:

- **App** — pass `brands` and `items` to `AlertsScreen` and `ProfileScreen`.
  Loading state shows the wordmark above the indicator.
- **Feed** — wordmark style shared. "DISCOVER ALL" becomes an `ActionLink`.
- **Discover** — header via `ScreenHeader`; the search row becomes a
  `TextInput` with a clear button; query non-empty switches the list to
  `searchItems` results across all brands with "N pieces match". Follow is a
  compact secondary `Button` ("FOLLOW") or compact primary ("FOLLOWING").
- **Alerts** — resolves through props. Hero block uses the onWine tokens.
  "VIEW PIECE" is a primary `Button` with `color={colors.card}` and ink label
  (inverse on wine). Earlier rows get pressed feedback.
- **Coveted** — import card becomes a bordered square card; "ADD TO COVETED" is
  a primary `Button` with `busy`; "REMOVE" is an `ActionLink`.
- **Profile** — followed houses come from props; the moss note uses the onMoss
  tokens; the modal save is a wine primary `Button`.
- **Product** — covet is a secondary `Button` that turns primary when coveted;
  "I BOUGHT THIS" is a secondary moss `Button`; the buy sheet uses two
  `Button`s; "VIEW ON brand" is a primary `Button` with the arrow icon; the
  media counter hides for a single entry.
- **Wardrobe** — `BackLink`, `ScreenHeader` with "+ ADD" as the right slot,
  "DRESS ME" moss `Button`, chooser and tag chips square.
- **Garment details** — `BackLink`, "SAVE" top-right `ActionLink`, inputs radius
  3, "SAVE CHANGES" moss `Button`, confirm boxes square, choices `ActionLink`s.
- **Dress me** — `BackLink`, cards square, "MORE IDEAS" moss `Button`, card
  actions secondary moss `Button`s.
- **Onboarding** — gains an `intro` phase rendered by `IntroScreen`; SKIP is an
  `ActionLink`; CONTINUE / SAVE MY PROFILE is a wine primary `Button`.
- **Tab bar** — labels 10 px. Unchanged otherwise.
- **Pickers** — chips radius 3, label 12 px, unchanged behaviour.

### Intro (`src/screens/IntroScreen.tsx`)

```
OnboardingScreen phase: "intro" → "occasions" → "styles"
                         │
                   IntroScreen({ onBegin, onSkip })
                         │
         Animated.ScrollView (vertical, pagingEnabled)
           ├─ Panel 1  Wist. — the definition
           ├─ Panel 2  You covet a piece.           ♥
           ├─ Panel 3  Wist watches its price.      (muted caption)
           └─ Panel 4  (wine) When it drops, you know first.  € 550 → € 385   [BEGIN]
         SKIP (top-right, every panel)   ⌄ scroll hint (panels 1–3)
```

- Panel height comes from the container's `onLayout`, so safe areas and the web
  viewport are both respected without `useWindowDimensions` arithmetic.
- `scrollY` is an `Animated.Value` fed by `Animated.event` with
  `useNativeDriver: Platform.OS !== "web"`.
- Panel *i* interpolates opacity `[(i−1)H, iH, (i+1)H] → [0, 1, 0]` and
  translateY `→ [36, 0, −36]`, clamped. With reduced motion only opacity runs.
- The scroll hint is a chevron that eases down and back on a loop, hidden on
  the last panel.
- Panel 4 is a full-bleed wine panel; its old price has a line-through and the
  new price sits beside it in the display face. BEGIN is a `Button` with
  `color={colors.card}` and wine label.
- `accessibilityRole="header"` on each panel title; the scroll view is
  `accessibilityLabel="Introduction"`.

### Search (`src/catalogueSearch.ts`)

```ts
export function searchItems(items: Item[], brands: Brand[], query: string): Item[]
```

Normalises with `NFD` and strips combining marks, lowercases, splits the query
on whitespace, and keeps an item when every term appears in the item name or
its brand name. Empty or whitespace query returns `items` unchanged. Order is
preserved.

### Error handling

No new failure paths. The intro and search are pure UI over data already in
memory. Alerts and Profile already handle a missing item (row skipped, quiet
state) and keep doing so with live data.

### Testing

- `src/catalogueSearch.test.ts`: empty query, case, diacritics ("sezane"
  matches "Sézane"), brand-name match, multi-term, no match.
- Existing suites unchanged; none render screens.
- Manual: `npm run web` in Chrome at phone width and desktop; `npm run ios`
  in the simulator. Walk intro → questions → Feed → Discover (search) →
  Product → Coveted → Alerts → Profile → Wardrobe → Garment → Dress me.
- `npm run typecheck && npm test` green after every commit.

## Out of scope

Palette changes, dark mode, navigation library, animation libraries,
backend changes, a permanent "intro seen" flag.
