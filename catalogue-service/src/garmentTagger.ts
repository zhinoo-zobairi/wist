import type { PhotoMediaType } from "./garmentPhotoStore.js";
import type { GarmentInput } from "./wardrobe.js";

export type GarmentTags = GarmentInput;
export type TagResult =
  | { ok: true; tags: GarmentTags }
  | { ok: false; reason: "refused" | "invalid_output" | "api_error" };
export type TagInput =
  | { kind: "photo"; bytes: Buffer; mediaType: PhotoMediaType }
  | { kind: "product"; imageUrl: string; productName: string; brandName: string };

export interface GarmentTagger {
  tag(input: TagInput): Promise<TagResult>;
}
