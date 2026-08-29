# Wist v1

Wist (pronounced “weest,” from Kurdish for deeply wanting something) is a personal fashion intelligence prototype built with Expo and TypeScript. It displays real products observed by the catalogue service and lets a user covet pieces for future price-drop monitoring.

## Run it

Requirements: Node.js 22.5+ and a native simulator/device with Expo Go.

```bash
npm install
npm run ios
```

Use `npm run android` for Android or `npm run web` for the browser preview. The in-app drop flow works on web, but browser previews intentionally skip native local notifications.

### Run the first personal version on an iPhone

This path runs Wist inside Expo Go. It is intentionally the smallest way to
try the real workflow before creating a standalone App Store-style build.

1. Install **Expo Go** on the iPhone and connect the iPhone and Mac to the same
   Wi-Fi network.
2. In macOS, open **System Settings → Wi-Fi → Details → TCP/IP** and note the
   Mac's IPv4 address.
3. Copy `.env.example` to `.env.local`, use the same random owner token for both
   token variables, and set these device-specific values:

   ```dotenv
   CATALOGUE_HOST=0.0.0.0
   EXPO_PUBLIC_CATALOGUE_URL=http://192.168.1.20:4000
   ```

   Replace `192.168.1.20` with the Mac's IPv4 address. The owner token is a
   personal prototype secret; never commit `.env.local`.
4. Start the backend in one terminal with `npm run catalogue:start`.
5. Start Expo in another terminal with `npm start`, then scan its QR code with
   the iPhone camera and open it in Expo Go.
6. Finish the short onboarding, open **Coveted**, and paste a supported product
   URL into **Watch a product**.

For this local milestone, the Mac must remain awake and running the catalogue
service. The app currently supports Shopify product pages such as Goelia,
Bobbies English, and Sandro Germany. It synchronizes price-drop alerts while
open and then creates a local iOS notification. A continuously hosted backend
plus remote push delivery is the next step required for notifications while
Wist is closed.

## Catalogue backend

The first backend slice is a separate TypeScript catalogue service. It owns the
normalized brand/product API contract and the single-user watch list consumed
by the mobile app.

```bash
npm run catalogue:start
```

The service listens on `http://127.0.0.1:4000` by default. Set `PORT` to change
it. Available endpoints are:

- `GET /health`
- `GET /v1/brands`
- `GET /v1/brands/:brandId/items`
- `GET /v1/items/:itemId`
- `GET /v1/watches` (owner token)
- `POST /v1/watches` with `{ "url": "https://…" }` (owner token)
- `PUT /v1/watches/:itemId` (owner token)
- `DELETE /v1/watches/:itemId` (owner token)
- `GET /v1/alerts` (owner token)

The service uses a local SQLite database. Configure the owner token before
starting it:

```bash
cp .env.example .env.local
# Replace both token placeholders with the same random owner value.
npm run catalogue:start
```

Products can then be imported from the Coveted screen. Shopify product pages,
Bobbies English, and Sandro Germany are supported. The
`catalogue:observe -- <product-url>` command remains available for direct
backend testing.

Set `CATALOGUE_DB_PATH` to choose another database location. Each observation
stores an immutable price snapshot and reports a price drop when the new price
is lower than the previous observation in the same currency. Covet and Uncovet
use owner-token-authenticated endpoints and persist one user's watches in the
backend. While the catalogue service is running, it immediately checks every
watched product and repeats the cycle every six hours. Set
`CATALOGUE_WATCH_INTERVAL_MS` to a positive number of milliseconds to change
that cadence. Checks run sequentially, failed products do not stop the cycle,
and detected drops persist for the app to synchronize. Bobbies observations
also persist the size availability published by the product page, which the
product detail screen displays. There is no product discovery, restock
notification, remote push delivery, or automatic checkout yet.

This bearer token is a narrow personal-prototype gate. The Expo-prefixed copy
is bundled into the client, so it must be replaced by real user authentication
before Wist becomes a multi-user or publicly distributed service.

The Expo app loads this catalogue at startup. Web and iOS Simulator use
`http://127.0.0.1:4000` by default. Set `EXPO_PUBLIC_CATALOGUE_URL` to the
Mac's LAN URL for local iPhone development or to the public HTTPS URL for a
deployed backend.

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

1. Start the catalogue service and Expo app.
2. Open **Coveted** and paste a Shopify, Bobbies English, or Sandro Germany
   product URL.
3. Confirm the imported product appears in the collection.
4. Open it to see its real image/video gallery and observation details.

The rendered app no longer mixes placeholder products with the live catalogue.
The backend owns the watch list; AsyncStorage caches it for responsive UI.
The app synchronizes persisted price-drop alerts once per minute while it is
active. Remote push is still a separate integration, so a terminated app shows
a drop after it is reopened rather than receiving a background notification.
The cached field remains named `starredItemIds` for backward compatibility, but
the product exposes one save verb: **Covet**.

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

The catalogue service calls brand sites only for explicitly observed products
that are subsequently coveted; it does not crawl storefronts or discover
products. Manual observation commands seed Bobbies or Sandro products in
SQLite, and the service owns their recurring snapshots, price-drop history,
and single-user watches. The mobile app reads those records through an owner
bearer token. Full authentication, multi-user data, and distributed scheduler
coordination remain out of scope.
