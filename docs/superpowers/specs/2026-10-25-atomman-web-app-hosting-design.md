# WIST on the AtomMan as a web app — Design

**Date:** 2026-10-25
**Status:** Awaiting the owner's decision on D1–D6 below
**Issues:** #21 (always-on host with HTTPS), #22 (backups), touches #19, #20, #25

## Problem

WIST should run 24/7 on the AtomMan mini PC and open on the iPhone with the
Mac off. `docs/HOSTING_ATOMMAN.md` already describes the catalogue service as a
systemd unit in WSL, reached over Tailscale. Two things are missing:

1. The app itself still needs the Mac (`npm start` serves the code to Expo Go).
2. Nothing on the AtomMan has been checked from this side: Tailscale is not
   installed on the Mac, and `.env.local` on the Mac points
   `EXPO_PUBLIC_CATALOGUE_URL` at the Mac's own LAN address, not at the AtomMan.

## What is already true (checked 2026-10-25)

- `npx expo export --platform web` works on SDK 57 with the metro bundler:
  `index.html`, one JS bundle (895 KB), fonts and images under `assets/`,
  7.2 MB in total. `EXPO_PUBLIC_CATALOGUE_URL` and the owner token are compiled
  into the bundle at export time.
- Expo uses `public/index.html` as the HTML template when it exists, and copies
  everything else in `public/` into the export (`@expo/cli` `webTemplate.js`,
  `publicFolder.js`).
- `catalogue-service/src/server.ts` answers every path through `handleRequest`;
  unknown paths get `404 {"error":"not_found"}`. All API routes are `/health`
  and `/v1/...`.
- `web-build/` is already in `.gitignore`.
- Web already skips local notifications (`src/services/notifications.ts`).

## Decisions — owner approval required

- [ ] **D1. HTTPS through Tailscale Serve.** In WSL: `tailscale serve --bg 4000`.
  The app is then `https://<atomman>.<tailnet>.ts.net` on the tailnet only
  (port 443, certificate issued by Tailscale). Needs MagicDNS and "HTTPS
  Certificates" switched on once in the Tailscale admin console (DNS page).
  Why not plain `http://100.x.y.z:4000`: iOS Safari refuses geolocation on an
  insecure origin, so the weather pick would not work, and a home-screen web
  app wants a secure origin. **Never `tailscale funnel`**: the bundle holds the
  owner token (D5).
- [ ] **D2. One process.** The catalogue service serves the web bundle itself
  from `web-build/` when that folder exists: `/` → `index.html`, any other
  path that is a file under `web-build/` → that file with its content type,
  everything else → the existing API handling (so `/health` and `/v1/...` are
  unchanged and unknown paths still get the JSON 404). No second systemd unit,
  no nginx. The folder can be overridden with `CATALOGUE_WEB_DIR`.
- [ ] **D3. Listen on `127.0.0.1` only.** Tailscale Serve proxies from inside
  WSL to `127.0.0.1:4000`, so `CATALOGUE_HOST=0.0.0.0` (the current doc) is no
  longer needed and would also expose plain HTTP on the home Wi-Fi. The
  AtomMan `.env.local` drops `CATALOGUE_HOST`; port 4000 stays.
- [ ] **D4. Restart policy unchanged.** `Restart=on-failure` as already
  documented (existing behaviour, not a new choice). A clean stop is only
  `systemctl stop`. The timer for backups stays at 04:30 with 7 kept copies
  (existing).
- [ ] **D5. The owner token stays in the web bundle for now.** Anyone who can
  load the page can read it, which is why the page must only be reachable on
  the tailnet (D1). Issue #20 stays open and gets a note; it is the fix.
- [ ] **D6. Home-screen behaviour.** `public/index.html` adds
  `apple-mobile-web-app-capable=yes`, `apple-mobile-web-app-title=WIST`,
  `apple-mobile-web-app-status-bar-style=default`, `theme-color=#FAF7F2` and an
  `apple-touch-icon` (`public/apple-touch-icon.png`, a copy of
  `assets/icon.png`). "Add to Home Screen" then opens WIST full screen without
  Safari's bars; links to shops open in Safari. No service worker, no offline
  mode.

## Design

```text
iPhone Safari ──https (Tailscale, 443)──▶ WSL tailscaled (Serve)
                                            └─▶ 127.0.0.1:4000 wist-catalogue (systemd)
                                                  ├─ /health, /v1/...   → API (unchanged)
                                                  └─ /, /_expo/..., /assets/... → web-build/
```

### Build

- `package.json`: `"web:build": "expo export --platform web --output-dir web-build"`.
- Run on the AtomMan after `git pull`, with `EXPO_PUBLIC_CATALOGUE_URL=https://<atomman>.<tailnet>.ts.net`
  in `~/wist/.env.local` (Expo reads `.env.local` at export time, as it does for
  `npm start`). The same origin serves API and page, so CORS is not involved.

### Static handler (`catalogue-service/src/staticWeb.ts`)

- `createStaticWebHandler(dir)` returns `null` when `dir` does not exist, else
  `(pathname) => { status, headers, body } | null`.
- Resolves `pathname` under `dir` and refuses anything that escapes it (path
  traversal). `/` maps to `index.html`. Only `GET` and `HEAD`.
- Content types: html, js, css, json, png, jpg, svg, ico, ttf, woff, woff2.
- `server.ts` consults it before `handleRequest`; a `null` result falls through.
- Tests: serves `index.html` for `/`, serves a nested file with its type,
  returns `null` for `/v1/x`, `/health` and a missing file, refuses `/../`.

### AtomMan steps (added to `docs/HOSTING_ATOMMAN.md`)

1. Tailscale admin console: enable MagicDNS and HTTPS Certificates.
2. `.env.local`: add `EXPO_PUBLIC_CATALOGUE_URL=https://<atomman>.<tailnet>.ts.net`, remove `CATALOGUE_HOST`.
3. `npm run web:build && npm run catalogue:build && sudo systemctl restart wist-catalogue`.
4. `sudo tailscale serve --bg 4000` (persists across reboots).
5. iPhone: open the URL in Safari, Share → Add to Home Screen.

### Updating

`git pull && npm install && npm run catalogue:build && npm run web:build && sudo systemctl restart wist-catalogue`.

## Out of scope

Pairing without a bundled token (#20), a container (#19), remote push (#25),
a public host (#21's original plan: replaced by this tailnet-only setup).
