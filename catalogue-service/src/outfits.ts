import type { Occasion } from "./styleProfile.js";

export type GeneratedOutfit = { occasion: Occasion; garmentIds: string[]; reason: string };

export const MAX_OUTFITS_PER_OCCASION_PER_RUN = 2;
const MAX_REASON_LENGTH = 200;

/** Order-independent identity of an outfit's pieces, used for duplicate checks. */
export function garmentKey(garmentIds: readonly string[]): string {
  return [...garmentIds].sort().join(",");
}

export function keepValidGeneratedOutfits(
  value: unknown, eligibleIds: ReadonlySet<string>, occasions: readonly Occasion[],
): GeneratedOutfit[] {
  if (!Array.isArray(value)) return [];
  const perOccasion = new Map<Occasion, number>();
  const kept: GeneratedOutfit[] = [];
  for (const candidate of value) {
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) continue;
    const { occasion, garmentIds, reason } = candidate as Record<string, unknown>;
    if (!occasions.includes(occasion as Occasion) || !Array.isArray(garmentIds) ||
      garmentIds.length < 2 || garmentIds.length > 6 ||
      garmentIds.some((id) => typeof id !== "string" || !eligibleIds.has(id)) ||
      new Set(garmentIds).size !== garmentIds.length ||
      typeof reason !== "string" || !reason.trim()) continue;
    const count = perOccasion.get(occasion as Occasion) ?? 0;
    if (count >= MAX_OUTFITS_PER_OCCASION_PER_RUN) continue;
    perOccasion.set(occasion as Occasion, count + 1);
    kept.push({
      occasion: occasion as Occasion,
      garmentIds: garmentIds as string[],
      reason: reason.trim().slice(0, MAX_REASON_LENGTH),
    });
  }
  return kept;
}
