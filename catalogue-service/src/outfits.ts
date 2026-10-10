import { OCCASIONS, type Occasion } from "./styleProfile.js";

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

// Used by the stateless suggestions route until it is removed.
export type OutfitContext = { occasion: Occasion };
export type Outfit = { garmentIds: string[]; reason: string };

export function parseOutfitRequest(value: unknown): OutfitContext | null {
  if (typeof value !== "object" || value === null || !("context" in value)) return null;
  const context = value.context;
  if (typeof context !== "object" || context === null || !("occasion" in context) ||
    !OCCASIONS.includes(context.occasion as Occasion)) return null;
  return { occasion: context.occasion as Occasion };
}

export function keepValidOutfits(value: unknown, eligibleIds: ReadonlySet<string>): Outfit[] {
  if (!Array.isArray(value)) return [];
  const outfits: Outfit[] = [];
  for (const candidate of value) {
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) continue;
    const { garmentIds, reason } = candidate as Record<string, unknown>;
    if (!Array.isArray(garmentIds) || garmentIds.length < 2 || garmentIds.length > 6 ||
      garmentIds.some((id) => typeof id !== "string" || !eligibleIds.has(id)) ||
      new Set(garmentIds).size !== garmentIds.length || typeof reason !== "string" || !reason.trim()) continue;
    outfits.push({ garmentIds, reason: reason.trim().slice(0, 200) });
    if (outfits.length === 3) break;
  }
  return outfits;
}
