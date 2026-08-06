import type { CatalogueBrand, CatalogueItem } from "./model.js";
import type { CatalogueRepository } from "./repository.js";

const brands: CatalogueBrand[] = [
  { id: "sezane", name: "Sézane" },
  { id: "claudie-pierlot", name: "Claudie Pierlot" },
  { id: "other-stories", name: "& Other Stories" },
  { id: "sandro", name: "Sandro" },
];

const observedAt = "2026-08-06T00:00:00.000Z";

const items: CatalogueItem[] = [
  ["sezane-wool-coat", "sezane", "Johnson Wool Coat", 550],
  ["sezane-silk-skirt", "sezane", "Naelle Silk Skirt", 165],
  ["claudie-tailored-jacket", "claudie-pierlot", "Vania Tailored Jacket", 395],
  ["claudie-midi-dress", "claudie-pierlot", "Riviera Midi Dress", 325],
  ["stories-knit-cardigan", "other-stories", "Alpaca Blend Cardigan", 149],
  ["stories-leather-boots", "other-stories", "Pointed Leather Boots", 229],
  ["sandro-tweed-dress", "sandro", "Contrast Tweed Dress", 345],
  ["sandro-leather-bag", "sandro", "Tangoso Leather Bag", 295],
].map(([id, brandId, name, currentPrice]) => ({
  id: id as string,
  source: "seed",
  sourceProductId: id as string,
  brandId: brandId as string,
  name: name as string,
  url: `https://example.com/items/${id}`,
  imageUrl: `https://picsum.photos/seed/${id}/800/1000`,
  currentPrice: currentPrice as number,
  previousPrice: null,
  currency: "EUR",
  available: true,
  observedAt,
}));

export class SeedCatalogueRepository implements CatalogueRepository {
  async listBrands(): Promise<CatalogueBrand[]> {
    return brands.map((brand) => ({ ...brand }));
  }

  async listItems(brandId: string): Promise<CatalogueItem[]> {
    return items
      .filter((item) => item.brandId === brandId)
      .map((item) => ({ ...item }));
  }

  async getItem(itemId: string): Promise<CatalogueItem | null> {
    const item = items.find((candidate) => candidate.id === itemId);
    return item ? { ...item } : null;
  }
}
