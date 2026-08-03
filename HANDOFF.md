# Covet — Build Handoff (for Codex)

> Visual reference: open `index.html` in this folder. It is the source of truth for look & feel.
> This document is the source of truth for scope, data model, and sequencing.

---

## 0. What you're building
**Covet** is a *signal-detection app for fashion* — "Dataminr, but for clothes." A user follows a
curated set of indie fashion brands, browses them in an Instagram-familiar feed, **stars** the pieces
they love, and gets a **push notification the moment a starred item goes on sale**. That price-drop
alert is the entire point of v1. It is not a social network; the feed is a delivery surface for signals.

---

## 1. v1 scope — build THIS, not THAT

| ✅ In v1 (build this) | ❌ Out of v1 (do NOT build) |
|---|---|
| Instagram-style **feed** of followed brands | Wardrobe scan / digital closet |
| Per-brand **browse** (grid) | AI outfit generation / stylist |
| **Follow** a brand | Google image / product matching |
| **Star** an item → adds to watchlist | Restock / low-stock / new-drop alerts |
| **Price-drop detection** on starred items | Size-aware alerts (→ v1.5) |
| **Push notification** on a drop (the hero) | Non-clothing categories (electronics, etc.) |
| **Alerts screen** (drop history) | Buy-through / purchase import |
| Seeded/mock data layer behind a clean interface | **Live web scraping** (see §6 — gated on a pending decision) |

**Hero signal: PRICE DROP only.** Everything else is a later chapter.

---

## 2. Stack — CONFIRMED
- **Expo (React Native) + TypeScript.** ✅ Decided by owner.
- Reason: the hero feature is a **push notification** when a price drops. Native push is reliable via
  Expo; web push (esp. iOS Safari) is not. One codebase, fast iteration, real notifications.
- State: keep it boring — React state + a light store (Zustand). No Redux.
- Local persistence: SQLite (expo-sqlite) or AsyncStorage for follows/stars.
- Push: expo-notifications (local notifications are enough for the v1 seed-data loop).

---

## 3. Screens to build (match `index.html`)
1. **Feed** — top wordmark bar; followed-brand avatars row (Stories-style); vertical cards.
   Each card: brand avatar + name + Following pill, item image (4:5, rounded), star toggle,
   share, bookmark, item name, price. A **dropped** item shows a `▾ 30% · Price dropped` tag,
   the new price in garnet, old price struck through.
2. **Alerts ("Your drops")** — reverse-chronological list of price drops on starred items.
   Each row: thumbnail, brand (uppercase caps), item name (serif), `€ old → € new · % off`,
   timestamp, View button. Unread rows subtly tinted.
3. **Bottom tab bar** — Home · Search/Browse · Alerts (badge dot) · Saved · Profile.
   (Search/Saved/Profile can be stubs in the first milestone.)

Interactions: tapping the **star** on any item adds/removes it from the watchlist and is what makes
that item eligible for a price-drop alert.

---

## 4. Design tokens — LOCKED (values from `index.html`)
```
Fonts
  Display : "Cormorant Garamond", 600   → wordmark, item names, section titles
  Text    : "Inter", 400/500/600        → prices, captions, UI chrome

Palette
  --paper  #FAF7F2   page background (warm white)
  --card   #FFFFFF   surfaces
  --ink    #211E1B   primary text (warm near-black)
  --muted  #9A9088   secondary text
  --line   #ECE6DC   hairline borders
  --wine   #7A2E3B   ACCENT — price-drop moments ONLY (sale price, drop tag, badges)
  --ring   #C9A96A   soft gold avatar ring

Shape
  card radius   20px
  pill radius   999px  (Following pill, View button)
  borders       1px hairline (--line)
  shadows       near-zero; rely on radius + hairlines, not elevation
  avatars       circular, 1–2px gold ring, serif monogram (not logos)
```
Aesthetic in one line: **Instagram bones, Vogue skin — quiet luxury.** Garnet is precious; use it
sparingly so a sale literally glows.

---

## 5. Data model (v1)
```
Brand        { id, name, monogram, curated:true }
Item         { id, brandId, name, imageUrl, currentPrice, currency, url }
PriceSnapshot{ id, itemId, price, capturedAt }        // the diff source
User         { id }                                   // single user ok for v1 (see §8)
Follow       { userId, brandId }
Star         { userId, itemId }                       // starred == watched
Alert        { id, userId, itemId, oldPrice, newPrice, pctOff, createdAt, read:bool }
```
Price-drop rule: for each starred item, when the newest `PriceSnapshot.price` is lower than the
previous one, create an `Alert` and fire a push notification.

---

## 6. The engine + the critical boundary  ⚠️ READ THIS
The engine is **diff-over-time**: snapshot item prices on a cadence; a lower snapshot than the
previous one = a drop = an alert.

**Where price data comes from is NOT decided yet** (affiliate feeds vs. official APIs vs. scraping —
this is a legal/ownership decision the owner must make; see §8). So:

- Define a single interface: `PriceSource { getItems(brandId): Item[]; getPrice(itemId): number }`.
- v1 ships a **`SeedPriceSource`**: hard-coded brands/items + a scripted price drop (e.g. a timer or
  a dev button that lowers a starred item's price) so the full flow — star → drop → alert → push —
  works end to end **against fake data**.
- **Do NOT build live scraping or hit real brand sites in v1.** The real `PriceSource` implementation
  slots in behind this interface once the ingestion decision is made. Building it now risks throwing
  away work and crosses a legal boundary that hasn't been cleared.

This keeps v1 fully buildable today while the data-source question is resolved in parallel.

---

## 7. First milestones (commit in slices — one reviewable idea each)
1. `chore`: scaffold Expo + TS project, fonts loaded, tokens as a theme file.
2. `feat`: Feed screen (static, seed data) matching the mockup.
3. `feat`: bottom tab bar + navigation between Feed and Alerts.
4. `feat`: follow-brand and star-item toggles with local persistence.
5. `feat`: `PriceSource` interface + `SeedPriceSource` with a dev "trigger drop" action.
6. `feat`: drop detection → create Alert → Alerts screen renders it.
7. `feat`: local push notification on a drop (Expo notifications).
8. `docs`: README with how to run + how the seed drop is triggered.

Each milestone should build and run before the next.

---

## 8. Open decisions Codex must NOT guess on
Escalate these to the owner; do not invent answers:
1. **Ingestion source** (the big one) — affiliate product feeds (Awin/Rakuten/Sovrn — legit data +
   commission revenue), official brand APIs, or scraping. Gates the real `PriceSource`.
2. **Seed brand list** — which ~5–15 brands. Defines the audience. (Mockup uses Totême, Ganni,
   Arket, Nanushka, Sézane as placeholders.)
3. **Ingestion cadence** — how often prices are re-checked.
4. **Single-user vs multi-user** — v1 can be single-user local; confirm before adding auth/backend.

---

## 9. Definition of done (v1)
A user can: follow brands → browse them → star an item → and when that item's (seeded) price drops,
receive a push notification and see it in **Your drops**, styled per §4. All on seed data, no live
ingestion. That proves the loop the whole product is built on.
