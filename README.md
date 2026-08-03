# Covet v1

Covet is a local-first fashion price-drop signal prototype built with Expo and TypeScript. Follow a curated brand, star a piece, trigger a seeded price change, and Covet creates an alert and schedules a local push notification.

## Run it

Requirements: Node.js 20+ and a native simulator/device with Expo Go.

```bash
npm install
npm run ios
```

Use `npm run android` for Android or `npm run web` for the browser preview. The in-app drop flow works on web, but browser previews intentionally skip native local notifications.

## Prove the price-drop loop

1. Open **Feed** or **Browse** and star a piece.
2. Open **Saved**.
3. Tap **Trigger seed drop**.
4. Allow notifications when the native permission prompt appears.
5. Observe the unread dot on **Alerts**, the local notification, and the new sale styling in Feed.
6. Open **Alerts** to see the old price, new price, percentage off, and timestamp.

The trigger lowers the first starred item's current seed price by 30%. Starring records the item's baseline `PriceSnapshot`; triggering records the next snapshot; the drop engine creates an `Alert` only when the new price is lower.

## Checks

```bash
npm run typecheck
npm test
```

## Architecture boundary

`PriceSource` is the only catalogue-price boundary. `SeedPriceSource` is the v1 implementation and uses the four approved seed brands: Sézane, Claudie Pierlot, & Other Stories, and Sandro.

This build does **not** scrape or call brand sites. It has no ingestion cadence, remote backend, authentication, or multi-user data. Follows, stars, the latest snapshot per watched item, and up to 100 recent alerts belong to one local user and persist through AsyncStorage. A future approved ingestion implementation can replace `SeedPriceSource` without changing drop detection or UI state.
