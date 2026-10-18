import type { Brand, Item } from "./types";

// "Sézane" and "sezane" must meet: decompose accents (NFD) and drop the marks.
const normalize = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Items whose name or brand name contains every whitespace-separated term. */
export function searchItems(items: Item[], brands: Brand[], query: string): Item[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return items;
  const brandNames = new Map(brands.map((brand) => [brand.id, normalize(brand.name)]));
  return items.filter((item) => {
    const haystack = `${normalize(item.name)} ${brandNames.get(item.brandId) ?? ""}`;
    return terms.every((term) => haystack.includes(term));
  });
}
