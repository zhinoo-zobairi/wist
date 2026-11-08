# Closet import with cutouts — Design

**Date:** 2026-11-08
**Status:** Decided by the owner on 2026-11-08 ("design and build immediately"); D1–D12 below are the record of those decisions
**Touches:** `docs/WARDROBE_DECISIONS.md` (wardrobe capture, C1.1), `README.md` (Build your wardrobe)

## Problem

Someone who starts using WIST already owns a closet. Today the wardrobe takes one
photo at a time, stores it as shot, and shows it as shot: a coat on a bed, a shoe
on a kitchen floor, a dress on a hanger against a door. Importing thirty pieces
means thirty rounds of Add → photo → editor → back, and the grid never looks like
one wardrobe.

The owner wants: photograph the pieces, pick them all, and have WIST cut each
garment out of its background, put it on one standard canvas, and feed it into
the same wardrobe that outfits are built from.

## What is already true (checked 2026-11-08 on `main`, one commit ahead of `origin/main`)

- **Capture** lives in `src/screens/WardrobeScreen.tsx`: `+ Add` → "Take a photo"
  / "Choose from library", `allowsMultipleSelection: false`, then
  `prepareGarmentPhoto` (long edge ≤ 1,568 px, JPEG 0.8), then
  `POST /v1/wardrobe/photos`, then the editor opens.
- **The backend owns photos and model calls.** `wardrobePhotoRoutes.ts` stores
  the raw bytes in `wardrobe-photos/<uuid>.<ext>` (`DiskGarmentPhotoStore`) and
  runs `ClaudeGarmentTagger` synchronously in the upload request. Tagging reads
  the original bytes. There is no background job, by decision (C1.1).
- **Display** is `GarmentPhoto`: a 4:5 wash-coloured frame, `resizeMode="cover"`,
  loading `/v1/wardrobe/<id>/photo` with the owner token.
- **Outfits never see photos.** `wardrobePromptText.ts` sends id, name,
  category, colours, formality, warmth and occasions only. A cutout changes
  nothing in outfit generation; it changes what the owner sees.
- **No segmentation exists anywhere** in the app, the backend or the docs. The
  image policy in C1.1 is "long edge ≤ 1,568 px, JPEG 0.8" and nothing else.
- **Node 22.23.4**, a single root `package.json`, Vitest, no native Node
  dependencies yet. The atomman runs the service under systemd from `~/wist`.

## Decisions

- **D1. Where the cutout is made: the catalogue backend, in process.** The
  backend already owns the photo bytes and every model call, so a cutout is a
  second derived artefact of the same owner. `@imgly/background-removal-node`
  1.4.5 (ONNX on CPU, "medium" model, weights bundled in the package, 127 MB on
  disk) behind a `CutoutMaker` interface, exactly as `GarmentTagger` fronts
  Claude. Not on the phone (needs a native module, breaks Expo Go) and not an
  external API (photos may show people; no new key, no new vendor).
  **Licence:** the package is AGPL-3.0. Fine for a personal prototype; if WIST
  ever serves other people (accounts design), either buy img.ly's commercial
  licence or swap the implementation behind `CutoutMaker` for an Apache-2.0
  model on `onnxruntime-node`. Record this in the accounts design before D-day.
- **D2. `sharp` ^0.35.5 at the root, forced onto the img.ly package with an npm
  `overrides` entry.** The package pins `sharp ~0.32`, which has no prebuilt
  binary for Node 22 and would compile at install time. Verified 2026-11-08: the
  override installs in 6 s with one sharp and one onnxruntime, and a cutout runs.
- **D3. When: synchronously in the upload request, in parallel with tagging.**
  `Promise.all([tagAndSave, cutAndSave])` on the same bytes. Measured 4.4–4.7 s
  per photo on an M-series Mac for the model step and 0.2 s for normalisation;
  the atomman is slower but well inside the phone's existing 90,000 ms upload
  timeout. No background job, queue or automatic retry (same policy as tagging).
  The first cutout after a restart loads the model into memory once (tens of
  MB) and keeps it resident.
- **D4. What a cutout is.** PNG with alpha. The subject is trimmed to its
  bounding box, fitted inside 896 × 1,120 px without enlarging past the source,
  and centred on a transparent 1,024 × 1,280 px canvas: the same 4:5 as
  `GarmentPhoto`, with a 6% margin, so `cover` shows the whole garment.
- **D5. Storage: `wardrobe-cutouts/<uuid>.png`** next to `wardrobe-photos/`,
  through a second `DiskGarmentPhotoStore` instance. The original is kept
  untouched: tagging and retagging always read it, and the owner can fall back
  to it. Backup copies the folder when it exists; restore puts it back when the
  backup has one. A restored database whose cutout file is missing falls back
  to the original (D7).
- **D6. Record: one column, `cutout_status`** on `garments`, `'none' | 'ready' |
  'failed'`, default `'none'`, added by `ALTER TABLE` like the purchase columns.
  Exposed as `cutoutStatus` on every garment; manual and purchase garments stay
  `'none'`. Setting it never touches `updated_at` or the change log: a cutout
  is not a tag, so it must not trigger a paid outfit run.
- **D7. Serving: the existing photo route returns the best image.**
  `GET /v1/wardrobe/<id>/photo` serves the cutout PNG when `cutout_status` is
  `ready` and the file exists, otherwise the original. One URL, so
  `GarmentPhoto`, `garmentPhotoSource` and every collage keep working unchanged.
- **D8. Retry: `POST /v1/wardrobe/<id>/cutout`** re-runs the cutout for a photo
  garment, whatever its status (it costs local CPU, not money). `503
  cutouts_not_configured` without a maker, `404 photo_not_found` for a garment
  without a stored photo, `502 cutout_failed` when the model fails (status
  becomes `failed`). Returns `{garment}`.
- **D9. Bulk import on the phone: "Add several from library".** Multi-select
  with `selectionLimit = min(20, 300 − wardrobe.length)`. Uploads run one after
  another (one paid tag and one cutout at a time), with "Adding 3 of 12…" while
  they run and "Added 11 of 12. 1 photo could not be added." when they finish.
  The editor does not open; the grid fills as each garment arrives, and the
  existing "Not tagged · Retry" chip covers anything the tagger missed. "Take a
  photo" stays one shot, then the editor, as today: a closet is shot with the
  Camera app and picked in one go.
- **D10. Editor: "Remove background" / "Redo background removal".** On a photo
  garment the editor shows the link under the photo; when `cutoutStatus` is
  `failed` a line says "Couldn't remove the background. The original photo is
  shown." The call uses the 90,000 ms wardrobe timeout and the uncertain-request
  handling of retag.
- **D11. Switch: `CATALOGUE_CUTOUTS=off`** leaves the maker unset (uploads work
  as today, retry returns 503). Default on. Tests never load the model: they
  use a fake `CutoutMaker`; one opt-in test (`CUTOUT_PROBE=1`) runs the real
  one on a fixture.
- **D12. Client parsing accepts a missing `cutoutStatus` as `'none'`** and
  rejects any other value than the three. A phone updated before the atomman
  keeps working; a wrong value is still an invalid garment.

## Design

### Backend

```
POST /v1/wardrobe/photos
  └─ uploadPhoto()                      wardrobePhotoRoutes.ts
       ├─ createPhotoGarment            (as today)
       ├─ photoStore.write              wardrobe-photos/<id>.jpg
       └─ Promise.all
            ├─ tagAndSave → ClaudeGarmentTagger → applyTags        (as today)
            └─ cutAndSave → CutoutMaker → cutoutStore.write → setCutoutStatus
GET  /v1/wardrobe/:id/photo   → cutout PNG if ready + present, else original
POST /v1/wardrobe/:id/cutout  → cutAndSave again → {garment}
DELETE /v1/wardrobe/:id       → removes photo and cutout files (as today + cutout)
```

- `cutoutMaker.ts` — `interface CutoutMaker { cut(bytes: Buffer, mediaType: PhotoMediaType): Promise<CutoutResult> }`,
  `CutoutResult = { ok: true; png: Buffer } | { ok: false; reason: "model_error" | "empty" }`.
- `imglyCutoutMaker.ts` — `removeBackground` with `model: "medium"`, `publicPath`
  pointed at the package's own `dist/`, then `normaliseCutout(png)` (sharp:
  trim → fit inside 896 × 1,120 → extend to 1,024 × 1,280, transparent).
  `normaliseCutout` is exported and unit-tested with a synthetic image; a
  cutout whose trimmed subject is empty returns `{ ok: false, reason: "empty" }`.
- `garmentCutout.ts` — `cutAndSave(wardrobe, cutoutStore, maker, id, bytes, mediaType)`:
  write the PNG, then `setCutoutStatus(id, "ready")`; on any failure log the
  error class and `setCutoutStatus(id, "failed")`. Never throws.
- `wardrobeRepository.ts` — `setCutoutStatus(id, status): Promise<Garment | null>`.
- `sqliteWardrobeRepository.ts` — `migrateCutoutColumn()`; `cutout_status` in
  `GarmentRow`, `readGarment` and `insertGarment`.
- `app.ts` — `RequestOptions` gains `cutoutStore?: GarmentPhotoStore` and
  `cutoutMaker?: CutoutMaker`.
- `server.ts` — `cutoutStore = new DiskGarmentPhotoStore(join(dataDir, "wardrobe-cutouts"))`;
  `cutoutMaker = process.env.CATALOGUE_CUTOUTS === "off" ? undefined : new ImglyCutoutMaker()`;
  the JSON-body list gains the cutout route (empty body).
- `backupData.ts` — copy `wardrobe-cutouts/` when present; restore it when the
  backup has it, else remove the live folder so no stale cutout outlives its row.

### Phone

- `src/types.ts` and `catalogueClient.toGarment` — `cutoutStatus`.
- `catalogueClient.ts` — `cutoutGarment(id)` (POST, 90,000 ms, uncertain on
  transport failure, like `retagGarment`).
- `useWistStore.ts` — `cutoutGarment(id)` upserts the result.
- `WardrobeScreen.tsx` — third chooser link "Add several from library";
  `importMany(assets)` loops `prepareGarmentPhoto` → `addPhoto` sequentially,
  counts failures, shows progress and the summary; the single-photo paths are
  unchanged. The loop is a pure helper (`importGarmentPhotos` in
  `src/wardrobeImport.ts`) so the sequencing and the summary copy are unit-tested.
- `GarmentEditScreen.tsx` — the link and the failed line (D10).
- `wardrobeMessages.ts` — `importSummaryMessage(added, total)`.

## Error handling

| Where | Failure | Outcome |
|---|---|---|
| Upload | model throws or returns an empty subject | garment created, `cutoutStatus: "failed"`, original shown, 201 as today |
| Upload | cutout store write fails | same as above; the photo garment is kept |
| Photo route | status `ready` but file missing | original served, warning logged |
| Retry route | no maker | 503 `cutouts_not_configured` |
| Retry route | manual or purchase garment, or missing original | 404 `photo_not_found` |
| Bulk import | one photo fails to prepare or upload | counted, loop continues, summary names the count; `wardrobe_full` stops the loop with the existing message |
| Bulk import | phone times out on one upload (90 s) | counted as failed; the garment may still exist, which the final refresh shows |

## Testing

- Backend: route tests with a fake `CutoutMaker` and `MemoryPhotoStore` for the
  cutout store (upload sets `ready`/`failed`, photo route prefers the cutout and
  falls back, retry route codes, delete removes both files); repository test for
  the migration on an older database and for `setCutoutStatus` not touching
  `updated_at`/the change log; `normaliseCutout` on a generated 300 × 100 image
  with a transparent border (asserts 1,024 × 1,280, alpha, margin).
- Phone: `importGarmentPhotos` sequencing and failure counting; client parsing
  of `cutoutStatus` (absent, valid, invalid); `cutoutGarment` request shape;
  store upsert.
- Real model: one opt-in Vitest case behind `CUTOUT_PROBE=1` plus a manual run
  on the simulator with the local catalogue.

## Out of scope

Cutouts for purchase garments (studio images already), on-device segmentation,
a camera loop, editing or redrawing a mask by hand, any change to what outfits
are built from.
