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
  /**
   * Without `expectedUpdatedAt`, only an untagged or failed garment is written.
   * With it (a forced retag), any garment is written, but only if it has not
   * changed since that timestamp was read, so edits made mid-call survive.
   */
  applyTags(id: string, tags: GarmentInput, expectedUpdatedAt?: string): Promise<Garment | null>;
  /** Only an untagged or failed garment is marked; a tagged one is never downgraded. */
  markTagFailed(id: string): Promise<Garment | null>;
  replaceGarment(id: string, input: GarmentInput): Promise<Garment | null>;
  deleteGarment(id: string): Promise<boolean>;
  countGarments(): Promise<number>;
}
