/** How many library photos one "Add several" round may take; the wardrobe's own cap still applies. */
export const IMPORT_BATCH_LIMIT = 20;
const MAX_WARDROBE_GARMENTS = 300;

export function importSelectionLimit(owned: number): number {
  return Math.max(0, Math.min(IMPORT_BATCH_LIMIT, MAX_WARDROBE_GARMENTS - owned));
}

export type ImportProgress = { done: number; total: number };
/** `stoppedBy` is the error that ended the round early (a full wardrobe); the rest were never tried. */
export type ImportOutcome = { added: number; failed: number; stoppedBy: unknown };

/**
 * Uploads one photo after another, so the backend runs one paid tag and one cutout at a
 * time. A failed photo is counted and the round carries on, unless the caller says the
 * error is final.
 */
export async function importGarmentPhotos<T>(
  items: readonly T[],
  upload: (item: T) => Promise<unknown>,
  options: { onProgress?: (progress: ImportProgress) => void; stopWhen?: (error: unknown) => boolean } = {},
): Promise<ImportOutcome> {
  let added = 0;
  let failed = 0;
  for (const [index, item] of items.entries()) {
    options.onProgress?.({ done: index, total: items.length });
    try {
      await upload(item);
      added += 1;
    } catch (error) {
      failed += 1;
      if (options.stopWhen?.(error)) return { added, failed, stoppedBy: error };
    }
  }
  return { added, failed, stoppedBy: undefined };
}
