# Follow a house by name — Design

**Date:** 2026-11-01
**Status:** Awaiting the owner's decision on D1 (gate), then D2–D8
**Touches:** #18 (discovery, not approved), `docs/INGESTION_SOURCE_DECISION.md`

## Problem

The owner's story: type a house's name, pick it from a list, follow it, see its
pieces, covet the ones you like, get an alert when a price drops, buy from the
house.

Today WIST does everything after "see its pieces", but only for pieces someone
pasted a link to. Following a house does not bring in its range, and a house
cannot be found by name until one of its pieces has been pasted.

## What is already true (checked 2026-11-01)

- **Follows live on the phone.** `followedBrandIds` in `src/store/useWistStore.ts`
  (persisted on the device). Discover (`BrowseScreen`) and the onboarding
  houses step (`HousesStep`) list every house from `GET /v1/brands` with a
  Follow button; Home shows pieces from followed houses.
- **Search** (`src/catalogueSearch.ts`) matches piece and house names, but only
  over pieces already in the catalogue.
- **The catalogue only knows pasted pieces.** A house appears when its first
  piece is imported, and the app then follows it (`brandsToFollowAfterImport`).
- **Buying** is "View on <house>", which opens the shop's own page; "I bought
  this" moves the piece into the wardrobe.
- **Gaala and Goelia 1995 publish a product list.** `/products.json` returns 250
  pieces per page, newest-published first, in EUR (Goelia through `/en-eu/`:
  the list price 209.00 matched the product page's 20900 cents). robots.txt
  does not disallow it. Pages are heavy: Gaala 5.5 MB and Goelia 3.0 MB per
  250 pieces. Gaala's sitemap lists about 480 pieces; 228 and 186 of the first
  250 were available.
- **Both shops' terms forbid crawling.** Gaala and Goelia use Shopify's standard
  terms, which forbid using the service "to spam, phish, pharm, pretext,
  spider, crawl, or scrape" (`gaala.com/policies/terms-of-service`,
  `www.goelia1995.com/en-eu/policies/terms-of-service`, read 2026-11-01).
- Sézane (DataDome challenge) and Jonak Paris (redirects WIST's client) cannot
  be read at all.

## The gate — owner decision first

- [ ] **D1. Terms of use.** Reading a house's range on a schedule is crawling
  under both shops' terms. Options:
  1. Ask each house for written permission. WIST drafts the email; the owner
     sends it.
  2. Use an affiliate or partner product feed where the house offers one (to
     research per house, as for Sézane's Awin feed).
  3. Do not build discovery; keep paste-a-link only.

  Recommendation: 1 for Gaala and Goelia while 2 is researched. Build nothing
  below until a house has said yes or a feed exists.

  Note for the owner: the same clause can be read to cover the 6-hourly checks
  of coveted pieces that already run (approved 2026-10-11 for the local
  single-user prototype). That is the owner's call; this spec is not legal
  advice.

## Design once a house has cleared D1

**Owner:** the catalogue service. The ingestion decision already gives it
ingestion, normalization, price history and retries. The new responsibility is
keeping a small, current slice of each cleared house's range. The app stays a
reader.

```
every 24 h:  range refresh ─ politeFetch ─▶ <house>/products.json?limit=50
                   │
                   ▼
             recordObservation (same path as a pasted piece)
                   │
                   ▼
             catalogue_items ─▶ GET /v1/brands, /v1/brands/:id/items ─▶ app
```

- [ ] **D2. Which houses.** A fixed list in code, like `JSON_LD_STOREFRONTS`,
  holding only houses cleared by D1: name and product-list URL (Goelia:
  `https://www.goelia1995.com/en-eu/products.json`, Gaala:
  `https://gaala.com/products.json`). Adding a house is a code change. No
  owner-editable registry and no new table.
- [ ] **D3. Which pieces.** One page per house: the newest 50 published
  pieces (`?limit=50`), keeping only those with at least one available size.
  At most 50 pieces per house, so at most 100 for the two houses. Read limit
  2 MB per page (estimated 1.1 MB for Gaala, 0.6 MB for Goelia).
- [ ] **D4. Schedule.** A range refresh when the service starts, then every
  24 hours (`CATALOGUE_RANGE_INTERVAL_MS`, default 86 400 000). Houses are
  refreshed one after another through the shared politeFetch: robots.txt
  honoured, WIST's user agent, 10 s between requests (Gaala 60 s), 15 s
  timeout. That is one request per house per day, plus robots.txt. Watched
  pieces keep their own 6-hour checks, unchanged.
- [ ] **D5. Stored data.** Range pieces go into the existing tables through
  `recordObservation`, with the same ids as pasted pieces
  (`shopify-<host>-<productId>`), so coveting a range piece needs no import.
  No new tables or columns. Growth: at most 100 `price_observations` rows a
  day, about 36 500 a year.
- [ ] **D6. Retention.** A piece that is not watched, not linked to a wardrobe
  garment, and has not been observed for 30 days is deleted with its media,
  variants and observations. This keeps the catalogue to roughly the current
  slice.
- [ ] **D7. Failures.** No retries. A house whose refresh fails is logged and
  tried at the next 24-hour run; its pieces stay as they were.
- [ ] **D8. App.** The Discover search field also suggests houses as you type
  (a dropdown of matching house names from `GET /v1/brands`). Picking one
  opens that house's tab with its Follow button. Follows stay on the phone.

## Out of scope

- Sézane (waits for an Awin publisher account) and Jonak Paris (blocks WIST).
- Ranges for Bobbies, Sandro and Claudie Pierlot: each piece would need its
  own page request, and their terms have not been reviewed.
- Adding an arbitrary house by typing its name: WIST can only offer houses it
  has been set up to read.
- Checkout inside WIST: these shops offer no third-party checkout. Affiliate
  links would be a separate decision.
- Filtering by womenswear or menswear from the onboarding answer (both houses
  sell mostly womenswear; possible later from `product_type`).
