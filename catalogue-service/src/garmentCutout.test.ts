import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { CutoutMaker } from "./cutoutMaker.js";
import { cutAndSave } from "./garmentCutout.js";
import { DiskGarmentPhotoStore } from "./garmentPhotoStore.js";
import { SqliteWardrobeRepository } from "./sqliteWardrobeRepository.js";

describe("cutAndSave", () => {
  it("replaces the previous cutout file on a redo and reports ready", async () => {
    const directory = mkdtempSync(join(tmpdir(), "wist-cutouts-"));
    const wardrobe = new SqliteWardrobeRepository(":memory:");
    try {
      const store = new DiskGarmentPhotoStore(directory);
      const garment = await wardrobe.createPhotoGarment("image/jpeg");
      const cut = vi.fn<CutoutMaker["cut"]>()
        .mockResolvedValueOnce({ ok: true, png: Buffer.from([1]) })
        .mockResolvedValueOnce({ ok: true, png: Buffer.from([2]) });
      await expect(cutAndSave(wardrobe, store, { cut }, garment.id, Buffer.from([0]), "image/jpeg"))
        .resolves.toMatchObject({ ok: true, garment: { id: garment.id, cutoutStatus: "ready" } });
      await expect(cutAndSave(wardrobe, store, { cut }, garment.id, Buffer.from([0]), "image/jpeg"))
        .resolves.toMatchObject({ ok: true });
      await expect(store.read(garment.id, "image/png")).resolves.toEqual(Buffer.from([2]));
    } finally {
      wardrobe.close();
      rmSync(directory, { recursive: true });
    }
  });

  it("reports a garment that vanished while the model ran", async () => {
    const wardrobe = new SqliteWardrobeRepository(":memory:");
    try {
      const store = new DiskGarmentPhotoStore(mkdtempSync(join(tmpdir(), "wist-cutouts-")));
      const garment = await wardrobe.createPhotoGarment("image/jpeg");
      const maker: CutoutMaker = { cut: async () => { await wardrobe.deleteGarment(garment.id); return { ok: false, reason: "empty" }; } };
      await expect(cutAndSave(wardrobe, store, maker, garment.id, Buffer.from([0]), "image/jpeg"))
        .resolves.toEqual({ ok: false, garment: null });
    } finally {
      wardrobe.close();
    }
  });
});
