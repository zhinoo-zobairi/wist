import { removeBackground as imglyRemoveBackground, type Config, type ImageSource } from "@imgly/background-removal-node";
import sharp from "sharp";

import type { CutoutMaker, CutoutResult } from "./cutoutMaker.js";
import type { PhotoMediaType } from "./garmentPhotoStore.js";

/** The same 4:5 as the phone's garment frame; the subject fills 896 × 1,120 of it, leaving a margin. */
export const CUTOUT_CANVAS = { width: 1024, height: 1280 } as const;
const SUBJECT_BOX = { width: 896, height: 1120 } as const;
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/**
 * Trims a transparent-background PNG to its subject, fits the subject inside the
 * subject box (enlarging a small one, so every garment fills the frame alike) and
 * centres it on a transparent canvas. Null when nothing opaque is left.
 */
export async function normaliseCutout(png: Buffer): Promise<Buffer | null> {
  const stats = await sharp(png).ensureAlpha().stats();
  const alpha = stats.channels[3];
  if (!alpha || alpha.max === 0) return null;
  let trimmed: Buffer;
  try {
    trimmed = await sharp(png).ensureAlpha().trim({ background: TRANSPARENT, threshold: 10 }).toBuffer();
  } catch {
    return null;
  }
  const fitted = await sharp(trimmed).resize({ ...SUBJECT_BOX, fit: "inside" }).png().toBuffer();
  const { width = 0, height = 0 } = await sharp(fitted).metadata();
  const left = Math.floor((CUTOUT_CANVAS.width - width) / 2);
  const top = Math.floor((CUTOUT_CANVAS.height - height) / 2);
  return sharp(fitted).extend({
    top, left, bottom: CUTOUT_CANVAS.height - height - top, right: CUTOUT_CANVAS.width - width - left, background: TRANSPARENT,
  }).png().toBuffer();
}

type RemoveBackground = (image: ImageSource, config?: Config) => Promise<Blob>;

/** Runs img.ly's bundled ONNX model on this machine's CPU; the first call loads the model and keeps it resident. */
export class ImglyCutoutMaker implements CutoutMaker {
  private readonly removeBackground: RemoveBackground;

  constructor(options: { removeBackground?: RemoveBackground } = {}) {
    this.removeBackground = options.removeBackground ?? imglyRemoveBackground;
  }

  async cut(bytes: Buffer, mediaType: PhotoMediaType): Promise<CutoutResult> {
    try {
      const blob = await this.removeBackground(new Blob([new Uint8Array(bytes)], { type: mediaType }), {
        model: "medium", output: { format: "image/png", quality: 1 },
      });
      const png = await normaliseCutout(Buffer.from(await blob.arrayBuffer()));
      return png ? { ok: true, png } : { ok: false, reason: "empty" };
    } catch (error) {
      console.error("Garment cutout failed", { errorClass: error instanceof Error ? error.name : "UnknownError" });
      return { ok: false, reason: "model_error" };
    }
  }
}
