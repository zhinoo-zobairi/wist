# Covet v1

Covet is a local-first personal fashion intelligence prototype built with Expo and TypeScript. Follow a curated brand, covet a piece, trigger a seeded price change, and COVET creates an alert and schedules a local push notification.

## Run it

Requirements: Node.js 20+ and a native simulator/device with Expo Go.

```bash
npm install
npm run ios
```

Use `npm run android` for Android or `npm run web` for the browser preview. The in-app drop flow works on web, but browser previews intentionally skip native local notifications.

## Catalogue backend

The first backend slice is a separate TypeScript catalogue service. It owns the
normalized brand/product API contract while the mobile app remains on its
existing local seed source.

```bash
npm run catalogue:start
```

The service listens on `http://127.0.0.1:4000` by default. Set `PORT` to change
it. Available read endpoints are:

- `GET /health`
- `GET /v1/brands`
- `GET /v1/brands/:brandId/items`
- `GET /v1/items/:itemId`

The service currently uses an in-memory seed repository. It has no database,
scheduler, authentication, or long-running ingestion yet.

### Prove direct Sandro product access

The MVP's active ingestion proof reads one explicit public product page from
Sandro Germany and normalizes its Product JSON-LD into the catalogue model:

```bash
npm run catalogue:probe:sandro -- https://de.sandro-paris.com/de/p/haargummi-mit-paisley-print/SFABI00075_80.html
```

The command accepts only HTTPS product URLs on `de.sandro-paris.com`, refuses
redirects, caps the response size, and does not crawl the product sitemap. It
is a technical feasibility probe, not permission for recurring or bulk use.

### Optional Awin feed-access probe

After obtaining an Awin publisher product-feed API key, run:

```bash
AWIN_PRODUCT_FEED_API_KEY=<your-key> npm run catalogue:probe:awin
```

The probe downloads Awin's feed list, reports whether the verified Sézane and
Sandro advertiser IDs are accessible, and omits credential-bearing download
URLs from its output. Never commit the key.

## Prove the price-drop loop

1. Open **Home** or **Discover** and covet a piece.
2. Open **Coveted**.
3. Use the demo intelligence-loop control at the bottom of the collection.
4. Allow notifications when the native permission prompt appears.
5. Observe the unread dot on **Alerts**, the local notification, and the price-drop signal interrupting Home.
6. Open **Alerts** to see the old price, new price, percentage off, and timestamp.

The trigger lowers the first coveted item's current seed price by 30%. Coveting records the item's baseline `PriceSnapshot`; triggering records the next snapshot; the drop engine creates an `Alert` only when the new price is lower. The persisted field remains named `starredItemIds` for backward compatibility, but the product exposes one save verb: **Covet**.

## Checks

```bash
npm run typecheck
npm test
npm run catalogue:build
```

## Architecture boundary

`PriceSource` remains the mobile prototype's local price boundary.
`SeedPriceSource` uses the four approved seed brands: Sézane, Claudie Pierlot,
& Other Stories, and Sandro. The catalogue service is a separate asynchronous
boundary and does not pretend network I/O is a synchronous `PriceSource`.

The API runtime does **not** call brand sites. The repository contains one
manual, single-product Sandro probe, but the catalogue service has no ingestion
cadence or persistent state and the mobile app is not wired to it yet.
Authentication and multi-user data remain out of scope. Follows, coveted items,
the latest snapshot per watched item, and up to 100 recent alerts belong to one
local user and persist through AsyncStorage.
