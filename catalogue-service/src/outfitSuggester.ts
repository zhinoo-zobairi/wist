import type { Outfit, OutfitContext } from "./outfits.js";
import type { StyleProfile } from "./styleProfile.js";
import type { Garment } from "./wardrobe.js";

export type SuggestionResult =
  | { ok: true; outfits: Outfit[] }
  | { ok: false; reason: "refused" | "invalid_output" | "api_error" };

export interface OutfitSuggester {
  suggest(input: { garments: Garment[]; profile: StyleProfile | null; context: OutfitContext }): Promise<SuggestionResult>;
}
