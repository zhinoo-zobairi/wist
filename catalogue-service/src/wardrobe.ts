import { OCCASIONS, type Occasion } from "./styleProfile.js";

export const GARMENT_CATEGORIES = [
  "top", "bottom", "dress", "outerwear", "shoes", "bag", "accessory",
] as const;
export const FORMALITIES = ["casual", "smart_casual", "formal"] as const;
export const WARMTHS = ["light", "medium", "heavy"] as const;
export const MAX_GARMENTS = 300;

export type GarmentCategory = (typeof GARMENT_CATEGORIES)[number];
export type Formality = (typeof FORMALITIES)[number];
export type Warmth = (typeof WARMTHS)[number];

export type GarmentInput = {
  name: string;
  category: GarmentCategory;
  colors: string[];
  formality: Formality;
  warmth: Warmth;
  occasions: Occasion[];
  notes: string | null;
};

export type TagStatus = "untagged" | "tagged" | "failed";

export type Garment = GarmentInput & {
  id: string;
  source: "manual" | "photo" | "purchase";
  catalogueItemId: string | null;
  /** Purchase: absolute public URL. Photo: relative, owner-protected API path. */
  photoUrl: string | null;
  tagStatus: TagStatus;
  createdAt: string;
  updatedAt: string;
};

export function parseGarmentInput(value: unknown): GarmentInput | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.name !== "string" ||
    !GARMENT_CATEGORIES.includes(candidate.category as GarmentCategory) ||
    !FORMALITIES.includes(candidate.formality as Formality) ||
    !WARMTHS.includes(candidate.warmth as Warmth) ||
    !Array.isArray(candidate.colors) ||
    candidate.colors.length < 1 || candidate.colors.length > 3 ||
    candidate.colors.some((color) => typeof color !== "string") ||
    !Array.isArray(candidate.occasions) ||
    candidate.occasions.length > OCCASIONS.length ||
    candidate.occasions.some((occasion) => !OCCASIONS.includes(occasion as Occasion)) ||
    new Set(candidate.occasions).size !== candidate.occasions.length ||
    (candidate.notes != null && typeof candidate.notes !== "string")
  ) {
    return null;
  }

  const name = candidate.name.trim();
  const colors = (candidate.colors as string[]).map((color) => color.trim().toLowerCase());
  const notes = typeof candidate.notes === "string" ? candidate.notes.trim() : null;
  const occasions = new Set(candidate.occasions);
  if (
    name.length === 0 || name.length > 80 ||
    colors.some((color) => color.length === 0 || color.length > 24) ||
    new Set(colors).size !== colors.length ||
    (notes !== null && notes.length > 280)
  ) {
    return null;
  }

  return {
    name,
    category: candidate.category as GarmentCategory,
    colors,
    formality: candidate.formality as Formality,
    warmth: candidate.warmth as Warmth,
    occasions: OCCASIONS.filter((occasion) => occasions.has(occasion)),
    notes,
  };
}
