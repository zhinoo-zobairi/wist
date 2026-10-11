import { isDailyPickDue, keepValidRanking, localDay } from "./dailyPick.js";
import type { OutfitPicker, PickOutfit } from "./outfitPicker.js";
import type { OutfitRepository } from "./outfitRepository.js";
import type { WardrobeRepository } from "./wardrobeRepository.js";
import type { WeatherSource } from "./weather.js";

export type DailyPickDeps = {
  wardrobe: WardrobeRepository;
  outfits: OutfitRepository;
  weatherSource: WeatherSource;
  picker: OutfitPicker;
};

export type DailyPickOutcome = "succeeded" | "failed" | "skipped";

/** Makes today's single attempt if it is due; returns its outcome, or null when nothing was due. */
export async function runDueDailyPick(deps: DailyPickDeps, now: Date): Promise<DailyPickOutcome | null> {
  if (!isDailyPickDue(await deps.outfits.dailyPickAttemptedDay(), now)) return null;
  const day = localDay(now);
  // Recorded before any call: a failure or a restart never repeats today's attempt (decisions 2 and 6).
  await deps.outfits.setDailyPickAttemptedDay(day);
  try {
    const location = await deps.outfits.getLocation();
    if (!location) return "skipped";
    // Same as the other entry points: ideas that use a deleted garment are dropped before ranking.
    const all = await deps.wardrobe.listGarments();
    await deps.outfits.deleteSuggestionsWithout(new Set(all.map((garment) => garment.id)));
    const outfits: PickOutfit[] = [
      ...(await deps.outfits.listSuggestions()).map(({ id, occasion, garmentIds }) => ({ id, occasion, garmentIds, saved: false })),
      ...(await deps.outfits.listSaved()).map(({ id, occasion, garmentIds }) => ({ id, occasion, garmentIds, saved: true })),
    ];
    if (outfits.length === 0) return "skipped";

    const weather = await deps.weatherSource.today(location);
    if (!weather) return "failed";
    const garments = (await deps.wardrobe.listGarments()).filter((garment) => garment.tagStatus === "tagged");
    const result = await deps.picker.pick({ garments, weather, outfits });
    if (!result.ok) return "failed";

    const ranking = keepValidRanking(result.order, result.top, new Set(outfits.map((outfit) => outfit.id)));
    if (ranking.order.length === 0) return "failed";
    await deps.outfits.storeDailyPick({ day, weather, ...ranking });
    return "succeeded";
  } catch (error) {
    // Coordinates and payloads are never logged.
    console.error("Daily pick failed", { errorClass: error instanceof Error ? error.name : "UnknownError" });
    return "failed";
  }
}
