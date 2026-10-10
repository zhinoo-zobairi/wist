import type { OutfitRepository } from "./outfitRepository.js";
import { keepValidGeneratedOutfits } from "./outfits.js";
import type { RunTrigger } from "./outfitSchedule.js";
import type { OutfitSuggester } from "./outfitSuggester.js";
import { OCCASIONS } from "./styleProfile.js";
import type { StyleProfileRepository } from "./styleProfileRepository.js";
import type { WardrobeRepository } from "./wardrobeRepository.js";

export type GenerationDeps = {
  wardrobe: WardrobeRepository;
  outfits: OutfitRepository;
  profiles: StyleProfileRepository;
  suggester: OutfitSuggester;
};

export type GenerationOutcome = { status: "succeeded" | "failed" | "skipped"; added: number };

const MIN_TAGGED_GARMENTS = 3;

export async function runOutfitGeneration(deps: GenerationDeps, trigger: RunTrigger): Promise<GenerationOutcome> {
  // Read the change time before anything else: changes made during the run stay "newer" (D7).
  const inputChangedAt = await deps.wardrobe.lastChangedAt();
  const lastSucceeded = (await deps.outfits.runSummary(new Date(0))).lastSucceededChangedAt;
  const runId = await deps.outfits.startRun(trigger, inputChangedAt);
  const finish = async (outcome: GenerationOutcome, error: string | null = null) => {
    await deps.outfits.finishRun(runId, outcome.status, outcome.added, error);
    return outcome;
  };
  try {
    const all = await deps.wardrobe.listGarments();
    await deps.outfits.deleteSuggestionsWithout(new Set(all.map((garment) => garment.id)));
    const garments = all.filter((garment) => garment.tagStatus === "tagged");
    if (garments.length < MIN_TAGGED_GARMENTS) return finish({ status: "skipped", added: 0 });

    const profile = await deps.profiles.getProfile();
    const occasions = profile && profile.occasions.length > 0 ? profile.occasions : [...OCCASIONS];
    // Only change-triggered runs favour changed pieces (decision 3); More ideas starts fresh.
    const focusGarmentIds = lastSucceeded && trigger !== "more_ideas"
      ? garments.filter((garment) => garment.updatedAt > lastSucceeded).map((garment) => garment.id)
      : [];
    const result = await deps.suggester.suggest({ garments, profile, occasions, focusGarmentIds });
    if (!result.ok) return finish({ status: "failed", added: 0 }, result.reason);

    // Claude can take a minute; only keep pieces that are still owned and tagged now.
    const current = new Set((await deps.wardrobe.listGarments())
      .filter((garment) => garment.tagStatus === "tagged").map((garment) => garment.id));
    const valid = keepValidGeneratedOutfits(result.outfits, current, occasions);
    if (valid.length === 0) return finish({ status: "failed", added: 0 }, "no_valid_outfits");
    return finish({ status: "succeeded", added: await deps.outfits.storeSuggestions(valid) });
  } catch (error) {
    console.error("Outfit generation failed", { errorClass: error instanceof Error ? error.name : "UnknownError" });
    return finish({ status: "failed", added: 0 }, error instanceof Error ? error.name : "UnknownError");
  }
}
