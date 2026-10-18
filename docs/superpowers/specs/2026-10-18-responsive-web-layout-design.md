# Responsive Web Layout — Design

**Date:** 2026-10-18
**Status:** Decisions approved by the owner on 2026-10-18
**Slice:** U3. Mobile and web, one codebase. Follows U1 (#28) and U2 (#29).

## Problem

Wist is a product for web and for the phone, but the web build is a phone
column: `App.tsx` caps the root at 480 px (commit `ae75f99`, a preview fix
from August). On a desktop the single-column Feed, the alternating product rows,
the bottom tab bar and the magazine intro all sit in a narrow strip in the
middle of the window.

## What changes

| Before | After |
|---|---|
| One layout, 480 px column on web | Two layouts by window width: `compact` below 720 px (today's phone layout, unchanged on iOS), `wide` from 720 px |
| Bottom tab bar everywhere | Bottom tab bar on compact; a top bar with the wordmark and five uppercase links on wide |
| Content edge to edge inside the column | Content centred at a maximum of 1200 px with 40 px gutters on wide; reading screens centred at 760 px |
| Intro as a single column | Intro as double-page spreads on wide: photographs on the left page, copy on the right |

**Ownership change.** None. No new state, dependencies or backend work.

## Approved decisions

| # | Decision | Value |
|---|---|---|
| 1 | Breakpoint | `wide` when `useWindowDimensions().width >= 720` |
| 2 | Wide navigation | Top bar: wordmark left, HOME · DISCOVER · COVETED · ALERTS · PROFILE right in Jost uppercase, alert dot on ALERTS, 64 px tall, hairline below. Bottom tab bar hidden on wide. Product detail keeps the top bar on wide |
| 3 | Content width | 1200 px centred, 40 px gutters. Profile, Wardrobe, Garment, Dress me and the onboarding questions use a 760 px reading column |
| 4 | Intro on wide | Double-page spreads: left page carries the plates with parallax, right page the kicker, headline, body, credit; folio bottom-right of the right page; the hero spread puts the features on the right page and the tilted print on the left |
| 5 | Feed on wide | Headline and dek left, signal or quiet block right (two columns 7:5); houses row unchanged; "The edit" four columns |
| 6 | Discover on wide | Search and brand tabs on one row; pieces as a three-column grid of cards (image, brand, name, price, covet) instead of alternating rows; search results the same grid |
| 7 | Product on wide | Media gallery left (7), details right (5); media height follows the column width |
| 8 | Coveted on wide | Import card left (5, sticky at top), list right (7) |
| 9 | Alerts on wide | Hero left (6), earlier signals right (6); quiet state centred |
| 10 | Wardrobe on wide | Grid of four; Dress me cards two across |
| 11 | Compact | Pixel-identical to today. The only compact change is that nothing from the wide layout leaks in |

## Design

### Layout hook (`src/layout.ts`)

```ts
export const WIDE_BREAKPOINT = 720;
export const CONTENT_MAX_WIDTH = 1200;
export const READING_MAX_WIDTH = 760;
export type Layout = { wide: boolean; width: number };
export function useLayout(): Layout;
/** Style for a ScrollView's contentContainer or a screen's root column. */
export function pageStyle(layout: Layout, reading?: boolean): ViewStyle;
```

`pageStyle` centres the content and adds the wide gutter. Inner components keep
their compact 22 px padding, so on wide the page adds the remaining 18 px
(`spacing.gutterWide - spacing.gutter`) to reach 40 px in total. Screens apply
it to the `contentContainerStyle` of their ScrollView or FlatList, or to the
root `View` of non-scrolling screens.

### Top navigation (`src/components/TopNav.tsx`)

Same props as `BottomTabBar` (`activeTab`, `hasUnreadAlerts`, `onChange`).
Renders on wide only, above the content, outside the page scroll.

### App shell (`App.tsx`)

- `useLayout()` once. On wide: no `maxWidth` on the container, `TopNav` above
  the content, no bottom bar. On compact: unchanged.
- The root background stays `colors.line` behind the compact column; on wide
  the page is `colors.paper` edge to edge.

### Screens

Each screen reads `useLayout()` once and derives `wide`. Styles stay in one
`StyleSheet` with `*Wide` variants applied conditionally. Lists use `numColumns`
(FlatList) or a wrapping row with percentage widths (`31%` for three columns,
`23%` for four).

### Intro (`src/screens/IntroScreen.tsx`)

On wide each page becomes a row: left page `flex: 1` with the plates
positioned inside it, right page `width: 44%` with the copy centred vertically,
paper background, a hairline between the pages. The cover's full-bleed plate
spans the left page only. Parallax ranges unchanged.

### Testing

- `npm run typecheck && npm test` after every commit.
- Headless Chrome at 390 px and 1280 px: intro spreads, Feed, Discover and
  search, product, Coveted, Alerts, Profile, Wardrobe, Dress me. Simulator for
  compact.

## Out of scope

Keyboard shortcuts, hover styles beyond the existing pressed state, a tablet
breakpoint between the two, server rendering.
