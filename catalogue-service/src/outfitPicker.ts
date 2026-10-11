import type { Occasion } from "./styleProfile.js";
import type { Garment } from "./wardrobe.js";
import type { WeatherSummary } from "./weather.js";

/** One stored outfit to rank: an idea (`saved: false`) or a saved outfit. */
export type PickOutfit = { id: string; occasion: Occasion; garmentIds: string[]; saved: boolean };

export type PickInput = { garments: Garment[]; weather: WeatherSummary; outfits: PickOutfit[] };

export type PickResult =
  | { ok: true; order: string[]; top: { id: string; reason: string }[] }
  | { ok: false; reason: "refused" | "truncated" | "invalid_output" | "api_error" };

export interface OutfitPicker {
  pick(input: PickInput): Promise<PickResult>;
}
