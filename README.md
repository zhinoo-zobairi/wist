# Wist v1

Wist (pronounced “weest,” from Kurdish for deeply wanting something) is a personal fashion intelligence prototype built with Expo and TypeScript. It displays real products observed by the catalogue service and lets a user covet pieces for future price-drop monitoring.

## Run it

Requirements: Node.js 22.5+ and a native simulator/device with Expo Go.

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

The service uses a local SQLite database. Record an explicit supported product
before starting it:

```bash
npm run catalogue:observe -- https://www.bobbies.com/en/4000785248-opera-iridescent-champagne-3663902758263.html
npm run catalogue:start
```

Set `CATALOGUE_DB_PATH` to choose another database location. Each observation
stores an immutable price snapshot and reports a price drop when the new price
is lower than the previous observation in the same currency. There is no
scheduler, authentication, watch registration, or remote push delivery yet.

The Expo app loads this catalogue at startup. Web and iOS Simulator use
`http://127.0.0.1:4000` by default. Set `EXPO_PUBLIC_CATALOGUE_URL` to the
public HTTPS service URL for a physical device or deployed backend.

### Prove direct Sandro product access

The MVP's active ingestion proof reads one explicit public product page from
Sandro Germany and normalizes its Product JSON-LD into the catalogue model:

```bash
npm run catalogue:probe:sandro -- https://de.sandro-paris.com/de/p/haargummi-mit-paisley-print/SFABI00075_80.html
```

The command accepts only HTTPS product URLs on `de.sandro-paris.com`, refuses
redirects, caps the response size, and does not crawl the product sitemap. It
is a technical feasibility probe, not permission for recurring or bulk use.

### Prove direct Bobbies product access

The same bounded proof is available for one explicit English Bobbies product
page:

```bash
npm run catalogue:probe:bobbies -- https://www.bobbies.com/en/4000785248-opera-iridescent-champagne-3663902758263.html
```

The Bobbies adapter is source-specific but returns the same normalized
catalogue model. It does not crawl, persist observations, or run on a cadence.

### Optional Awin feed-access probe

After obtaining an Awin publisher product-feed API key, run:

```bash
AWIN_PRODUCT_FEED_API_KEY=<your-key> npm run catalogue:probe:awin
```

The probe downloads Awin's feed list, reports whether the verified Sézane and
Sandro advertiser IDs are accessible, and omits credential-bearing download
URLs from its output. Never commit the key.

## Use the live catalogue

1. Record an explicit Bobbies or Sandro product with `catalogue:observe`.
2. Start the catalogue service.
3. Start Expo and open **Home** or **Discover**.
4. Open a product to see its real image/video gallery and observation details.
5. Covet it and confirm it appears under **Coveted**.

The rendered app no longer mixes placeholder products with the live catalogue.
Backend-owned watches, scheduled observation, and remote push are the next
integration. The persisted local field remains named `starredItemIds` for
backward compatibility, but the product exposes one save verb: **Covet**.

## Checks

```bash
npm run typecheck
npm test
npm run catalogue:build
```

## Architecture boundary

The rendered mobile catalogue uses an asynchronous HTTP client. The legacy
`SeedPriceSource` remains only for isolated drop-engine tests and does not
provide products or placeholder images to the UI.

The API runtime does **not** call brand sites. Manual observation commands call
the bounded Bobbies or Sandro adapter and store results in SQLite; the service
only reads the stored catalogue. It has no ingestion cadence. The mobile app
reads products from the catalogue API, but authentication and multi-user data
remain out of scope. Follows, coveted items, the latest mobile snapshot per
watched item, and up to 100 recent alerts still belong to one local user in
AsyncStorage.
