import type { PhotoMediaType } from "./garmentPhotoStore.js";

/** A garment on a transparent 4:5 canvas, or why there is none. "empty": the model kept nothing. */
export type CutoutResult =
  | { ok: true; png: Buffer }
  | { ok: false; reason: "model_error" | "empty" };

export interface CutoutMaker {
  cut(bytes: Buffer, mediaType: PhotoMediaType): Promise<CutoutResult>;
}
