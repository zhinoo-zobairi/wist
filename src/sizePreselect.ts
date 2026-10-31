import type { ItemVariant, SizeKind } from "./types";

const normalized = (label: string) => label.trim().toLowerCase();

// Sizes are each storefront's own labels and WIST does not convert between
// brands (decision of 2026-09-13), so a default only picks a label that is the
// same label: "36" never matches "36/38". The shop's own label is returned,
// because the watch API checks labels against the item's variants.
export function preselectedSizes(
  variants: readonly ItemVariant[],
  defaults: Partial<Record<SizeKind, string>>,
): string[] {
  const wanted = new Set(
    Object.values(defaults).flatMap((label) => (label ? [normalized(label)] : [])),
  );
  return [
    ...new Set(
      variants.map((variant) => variant.label).filter((label) => wanted.has(normalized(label))),
    ),
  ];
}
