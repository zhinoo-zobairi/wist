# Closet Import with Cutouts — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-11-08-closet-import-cutouts-design.md` (D1–D12, decided 2026-11-08).

## Conventions

- Repo root `/Users/zhinoo.zobairi/Code/WIST`, branch `main`. Never push.
- `npm run typecheck && npm test` green before every commit. Tests never render screens or load the real model.
- One reviewable idea per commit, subject `type(scope): description`, scope `app` or `catalogue`. No attribution trailers. Stage only the slice's files.
- Follow existing primitives and patterns: `GarmentTagger`/`tagAndSave` for the maker, `DiskGarmentPhotoStore` for storage, `ActionLink` for links, `wardrobeMessages.ts` for owner copy.

## Tasks (in order)

### T1 · Dependencies
`package.json`: add `@imgly/background-removal-node@1.4.5` and `sharp@^0.35.5`; `overrides` forcing the img.ly package onto that sharp. `npm install`, confirm one `sharp` in the tree. Commit `build(catalogue): add background removal and sharp`.

### T2 · Cutout maker and normalisation (catalogue)
New `cutoutMaker.ts` (interface), `imglyCutoutMaker.ts` (`ImglyCutoutMaker`, `normaliseCutout`), tests for `normaliseCutout` with a sharp-generated fixture, opt-in real-model test. Commit `feat(catalogue): cut garments out of their photos`.

### T3 · Record and storage (catalogue)
`wardrobe.ts` (`CutoutStatus`, `cutoutStatus` on `Garment`), `wardrobeRepository.ts` (`setCutoutStatus`), `sqliteWardrobeRepository.ts` (migration, row mapping), tests (migration from a pre-cutout schema, status write leaves `updated_at` and change log alone). Commit `feat(catalogue): record a garment's cutout status`.

### T4 · Routes (catalogue)
`garmentCutout.ts` (`cutAndSave`), `wardrobePhotoRoutes.ts` (parallel at upload, photo route preference, `POST …/cutout`), `wardrobeRoutes.ts` (delete removes the cutout), `app.ts` options, `server.ts` wiring and env switch, `backupData.ts`. Route and backup tests. Commit `feat(catalogue): serve cutouts and let the owner redo them`.

### T5 · Phone types and client
`src/types.ts`, `catalogueClient.ts` (`toGarment`, `cutoutGarment`), `useWistStore.ts`, tests. Commit `feat(app): read cutout status and request a cutout`.

### T6 · Bulk import (phone)
New `src/wardrobeImport.ts` (`importGarmentPhotos`), `wardrobeMessages.ts` (`importSummaryMessage`), `WardrobeScreen.tsx` chooser and progress. Tests for the helper and the copy. Commit `feat(app): add several garments from the library at once`.

### T7 · Editor (phone)
`GarmentEditScreen.tsx`: "Remove background" / "Redo background removal" link, failed line. Commit `feat(app): let the owner redo a garment's background removal`.

### T8 · Verification and docs
Full `npm run typecheck && npm test`; real cutout through the local catalogue (`curl` upload of a fixture, fetch the photo route, inspect the PNG); simulator walkthrough of "Add several from library" if the simulator is free. `README.md` (Build your wardrobe, API list, env), `docs/WARDROBE_DECISIONS.md` (new section pointing at the spec), `.env.example`. Commit `docs(app): record closet import and cutouts`.
