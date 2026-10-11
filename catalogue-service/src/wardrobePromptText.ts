import type { Garment } from "./wardrobe.js";

/** ID-sorted JSON lines; notes, photos and links never leave the service. Stable text keeps the prompt cache prefix stable. */
export function wardrobePromptText(garments: readonly Garment[]): string {
  return [...garments].sort((a, b) => a.id.localeCompare(b.id)).map((garment) => {
    const { id, name, category, colors, formality, warmth, occasions } = garment;
    return JSON.stringify({ id, name, category, colors, formality, warmth, occasions });
  }).join("\n");
}
