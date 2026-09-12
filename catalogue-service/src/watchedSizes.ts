import type { CatalogueVariant } from "./model.js";

type ReachesWatchedSizeArgs = {
  variants: CatalogueVariant[];
  watchedSizes: string[];
};

// Decides whether a detected price drop is worth telling the owner about.
//
// Sizes are matched on the label the storefront published for this exact product,
// never on a normalized or global size. There is no shared taxonomy to normalize
// against — Bobbies publishes footwear numbers, Sandro clothing numbers, and an
// arbitrary Shopify store whatever it likes — so a cross-brand "your size" would
// quietly produce wrong answers. Labels arrive already trimmed from the adapters,
// which is the right layer for that.
//
// Comparison is by label rather than variant id on purpose: variant rows are
// rebuilt on every observation, so ids churn when a storefront restructures and
// an id-keyed selection would orphan without any visible symptom.
export function reachesWatchedSize({
  variants,
  watchedSizes,
}: ReachesWatchedSizeArgs): boolean {
  // No chosen size means the owner wants any drop, which is the behaviour that
  // predates this rule.
  if (watchedSizes.length === 0) return true;

  // Fail open when there are no sizes to judge. Staying quiet here would be
  // indistinguishable from "no drop happened", so a product that stops
  // publishing variants — or an adapter regression — must not silently switch
  // alerts off. Must be checked before matching, or this returns false instead.
  if (variants.length === 0) return true;

  const watched = new Set(watchedSizes);
  return variants.some(
    (variant) => variant.available && watched.has(variant.label),
  );
}

// A watch may care about at most this many sizes, and each label is bounded, so
// a hostile or buggy client cannot store an unbounded selection. There is no
// taxonomy to validate against here — that a label is one the storefront really
// published for this item is checked at the request layer against its variants.
export const MAX_WATCH_SIZES = 24;
export const MAX_WATCH_SIZE_LABEL_LENGTH = 32;

// Parses the sizes a watch asks alerts for out of an untrusted request body into
// a clean list of unique, trimmed, non-empty labels, or null when the shape is
// wrong. An empty array is valid and means "clear the selection".
export function parseWatchSizes(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_WATCH_SIZES) return null;

  const labels: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") return null;
    const label = entry.trim();
    if (label.length === 0 || label.length > MAX_WATCH_SIZE_LABEL_LENGTH) {
      return null;
    }
    labels.push(label);
  }

  return [...new Set(labels)];
}
