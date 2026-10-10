import type { ApiResponse, RequestOptions } from "./app.js";
import { productTagInput, tagAndSave } from "./garmentTagging.js";
import type { CatalogueRepository } from "./repository.js";
import { MAX_GARMENTS } from "./wardrobe.js";
import { WardrobeFullError, type WardrobeRepository } from "./wardrobeRepository.js";

function parseItemId(body: string | undefined): string | null {
  try {
    const value: unknown = JSON.parse(body ?? "");
    if (typeof value !== "object" || value === null || Array.isArray(value) ||
        !("itemId" in value) || typeof value.itemId !== "string" || !value.itemId.trim()) return null;
    return value.itemId;
  } catch { return null; }
}

export async function createPurchase(
  catalogue: CatalogueRepository, wardrobe: WardrobeRepository, options: RequestOptions,
): Promise<ApiResponse> {
  if (options.bodyTooLarge) return { status: 413, body: { error: "payload_too_large" } };
  const itemId = parseItemId(options.body);
  if (!itemId) return { status: 400, body: { error: "invalid_purchase_request" } };
  const item = await catalogue.getItem(itemId);
  if (!item) return { status: 404, body: { error: "item_not_found" } };
  if (await wardrobe.countGarments() >= MAX_GARMENTS) {
    return { status: 409, body: { error: "wardrobe_full" } };
  }
  // Read before unwatching removes the selection. No brand image is downloaded.
  const sizes = await catalogue.listWatchSizes(item.id);
  const notes = sizes.length === 1 ? `Size: ${sizes[0]}` : null;
  const tagInput = options.tagger ? await productTagInput(item, item.imageUrl, catalogue) : undefined;
  let garment;
  try {
    garment = await wardrobe.createPurchaseGarment(item.id, item.imageUrl, notes);
  } catch (error) {
    if (error instanceof WardrobeFullError) return { status: 409, body: { error: "wardrobe_full" } };
    throw error;
  }
  if (options.tagger && tagInput) {
    garment = (await tagAndSave(wardrobe, options.tagger, garment.id, tagInput, undefined, notes)).garment
      ?? await wardrobe.getGarment(garment.id);
  }
  let unwatched = true;
  try { await catalogue.unwatchItem(item.id); } catch (error) {
    unwatched = false;
    console.error("Could not unwatch purchased item", item.id, { errorClass: error instanceof Error ? error.name : "UnknownError" });
  }
  return garment
    ? { status: 201, body: { garment, unwatched } }
    : { status: 404, body: { error: "garment_not_found" } };
}
