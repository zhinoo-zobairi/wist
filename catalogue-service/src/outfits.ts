import { OCCASIONS, type Occasion } from "./styleProfile.js";

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
