import type { Garment, GarmentInput } from "./wardrobe.js";

export class WardrobeFullError extends Error {
  constructor() {
    super("Wardrobe is full");
    this.name = "WardrobeFullError";
  }
}

export interface WardrobeRepository {
  listGarments(): Promise<Garment[]>;
  getGarment(id: string): Promise<Garment | null>;
  createGarment(input: GarmentInput, source: Garment["source"]): Promise<Garment>;
  createPhotoGarment(mediaType: string): Promise<Garment>;
  getPhotoMediaType(id: string): Promise<string | null>;
  // null also means a human edit made the garment tagged while the LLM ran.
  applyTags(id: string, tags: GarmentInput, force?: boolean): Promise<Garment | null>;
  markTagFailed(id: string, force?: boolean): Promise<Garment | null>;
  replaceGarment(id: string, input: GarmentInput): Promise<Garment | null>;
  deleteGarment(id: string): Promise<boolean>;
  countGarments(): Promise<number>;
}
