# Covet v1

Covet is a local-first personal fashion intelligence prototype built with Expo and TypeScript. Follow a curated brand, covet a piece, trigger a seeded price change, and COVET creates an alert and schedules a local push notification.

## Run it

Requirements: Node.js 20+ and a native simulator/device with Expo Go.

```bash
npm install
npm run ios
```

Use `npm run android` for Android or `npm run web` for the browser preview. The in-app drop flow works on web, but browser previews intentionally skip native local notifications.

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
```

## Architecture boundary

`PriceSource` is the only catalogue-price boundary. `SeedPriceSource` is the v1 implementation and uses the four approved seed brands: Sézane, Claudie Pierlot, & Other Stories, and Sandro.

This build does **not** scrape or call brand sites. It has no ingestion cadence, remote backend, authentication, or multi-user data. Follows, stars, the latest snapshot per watched item, and up to 100 recent alerts belong to one local user and persist through AsyncStorage. A future approved ingestion implementation can replace `SeedPriceSource` without changing drop detection or UI state.
