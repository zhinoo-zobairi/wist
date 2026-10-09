import type { PhotoMediaType } from "./garmentPhotoStore.js";
import type { GarmentInput } from "./wardrobe.js";

export type GarmentTags = GarmentInput;
export type TagResult =
  | { ok: true; tags: GarmentTags }
  | { ok: false; reason: "refused" | "invalid_output" | "api_error" };

export interface GarmentTagger {
  tag(photo: { bytes: Buffer; mediaType: PhotoMediaType }): Promise<TagResult>;
}
