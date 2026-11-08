import type { CutoutMaker } from "./cutoutMaker.js";
import type { GarmentPhotoStore, PhotoMediaType } from "./garmentPhotoStore.js";
import type { Garment } from "./wardrobe.js";
import type { WardrobeRepository } from "./wardrobeRepository.js";

/**
 * Makes the garment's cutout and records the outcome. Never throws: a model or disk
 * failure leaves the garment marked failed, with the original photo in use. A null
 * garment means it was deleted while the model ran.
 */
export async function cutAndSave(
  wardrobe: WardrobeRepository, cutoutStore: GarmentPhotoStore, maker: CutoutMaker,
  id: string, bytes: Buffer, mediaType: PhotoMediaType,
): Promise<{ ok: boolean; garment: Garment | null }> {
  let ok = false;
  try {
    const result = await maker.cut(bytes, mediaType);
    if (result.ok) {
      // The disk store never overwrites, so a redo clears the previous file first.
      await cutoutStore.remove(id);
      await cutoutStore.write(id, "image/png", result.png);
      ok = true;
    }
  } catch (error) {
    console.error("Could not make or store a garment cutout", { id, errorClass: error instanceof Error ? error.name : "UnknownError" });
  }
  return { ok, garment: await wardrobe.setCutoutStatus(id, ok ? "ready" : "failed") };
}
