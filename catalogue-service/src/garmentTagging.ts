import type { GarmentTagger, TagResult, TagInput } from "./garmentTagger.js";
import type { CatalogueItem } from "./model.js";
import type { CatalogueRepository } from "./repository.js";
import type { WardrobeRepository } from "./wardrobeRepository.js";

/** Crawled storefront data: only a credential-free https URL may be stored or sent to the model. */
export function isPublicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch { return false; }
}

export async function productTagInput(
  item: CatalogueItem, imageUrl: string, catalogue: CatalogueRepository,
): Promise<Extract<TagInput, { kind: "product" }>> {
  const brand = (await catalogue.listBrands()).find((entry) => entry.id === item.brandId);
  if (!brand) throw new Error("Catalogue item has no brand");
  return { kind: "product", imageUrl, productName: item.name, brandName: brand.name };
}

export async function tagAndSave(
  wardrobe: WardrobeRepository, tagger: GarmentTagger, id: string,
  photo: Parameters<GarmentTagger["tag"]>[0], expectedUpdatedAt?: string, notes?: string | null,
) {
  let result: TagResult;
  try {
    result = await tagger.tag(photo);
  } catch (error) {
    console.error("Garment tagger failed", { errorClass: error instanceof Error ? error.name : "UnknownError" });
    result = { ok: false, reason: "api_error" };
  }
  const garment = result.ok
    ? await wardrobe.applyTags(id, notes === undefined ? result.tags : { ...result.tags, notes }, expectedUpdatedAt)
    : await wardrobe.markTagFailed(id);
  return { ok: result.ok, garment };
}
