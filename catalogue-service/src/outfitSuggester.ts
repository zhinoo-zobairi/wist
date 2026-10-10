import type { GeneratedOutfit } from "./outfits.js";
import type { Occasion, StyleProfile } from "./styleProfile.js";
import type { Garment } from "./wardrobe.js";

export type SuggestionInput = {
  garments: Garment[];
  profile: StyleProfile | null;
  /** Occasions to cover in this run, up to 2 new outfits each. */
  occasions: Occasion[];
  /** Garments changed since the last successful run; Claude should favour them. */
  focusGarmentIds: string[];
};

export type SuggestionResult =
  | { ok: true; outfits: GeneratedOutfit[] }
  | { ok: false; reason: "refused" | "truncated" | "invalid_output" | "api_error" };

export interface OutfitSuggester {
  suggest(input: SuggestionInput): Promise<SuggestionResult>;
}
