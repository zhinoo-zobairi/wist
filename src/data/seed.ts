import type { Brand, Item } from "../types";

export const seedBrands: Brand[] = [
  { id: "sezane", name: "Sézane", monogram: "S", curated: true },
  {
    id: "claudie-pierlot",
    name: "Claudie Pierlot",
    monogram: "CP",
    curated: true,
  },
  {
    id: "other-stories",
    name: "& Other Stories",
    monogram: "&",
    curated: true,
  },
  { id: "sandro", name: "Sandro", monogram: "S", curated: true },
];

export const seedItems: Item[] = [
  {
    id: "sezane-wool-coat",
    brandId: "sezane",
    name: "Johnson Wool Coat",
    imageUrl: "https://picsum.photos/seed/sezane-wool-coat/800/1000",
    currentPrice: 550,
    currency: "EUR",
    url: "https://example.com/items/sezane-wool-coat",
  },
  {
    id: "sezane-silk-skirt",
    brandId: "sezane",
    name: "Naelle Silk Skirt",
    imageUrl: "https://picsum.photos/seed/sezane-silk-skirt/800/1000",
    currentPrice: 165,
    currency: "EUR",
    url: "https://example.com/items/sezane-silk-skirt",
  },
  {
    id: "claudie-tailored-jacket",
    brandId: "claudie-pierlot",
    name: "Vania Tailored Jacket",
    imageUrl: "https://picsum.photos/seed/claudie-tailored-jacket/800/1000",
    currentPrice: 395,
    currency: "EUR",
    url: "https://example.com/items/claudie-tailored-jacket",
  },
  {
    id: "claudie-midi-dress",
    brandId: "claudie-pierlot",
    name: "Riviera Midi Dress",
    imageUrl: "https://picsum.photos/seed/claudie-midi-dress/800/1000",
    currentPrice: 325,
    currency: "EUR",
    url: "https://example.com/items/claudie-midi-dress",
  },
  {
    id: "stories-knit-cardigan",
    brandId: "other-stories",
    name: "Alpaca Blend Cardigan",
    imageUrl: "https://picsum.photos/seed/stories-knit-cardigan/800/1000",
    currentPrice: 149,
    currency: "EUR",
    url: "https://example.com/items/stories-knit-cardigan",
  },
  {
    id: "stories-leather-boots",
    brandId: "other-stories",
    name: "Pointed Leather Boots",
    imageUrl: "https://picsum.photos/seed/stories-leather-boots/800/1000",
    currentPrice: 229,
    currency: "EUR",
    url: "https://example.com/items/stories-leather-boots",
  },
  {
    id: "sandro-tweed-dress",
    brandId: "sandro",
    name: "Contrast Tweed Dress",
    imageUrl: "https://picsum.photos/seed/sandro-tweed-dress/800/1000",
    currentPrice: 345,
    currency: "EUR",
    url: "https://example.com/items/sandro-tweed-dress",
  },
  {
    id: "sandro-leather-bag",
    brandId: "sandro",
    name: "Tangoso Leather Bag",
    imageUrl: "https://picsum.photos/seed/sandro-leather-bag/800/1000",
    currentPrice: 295,
    currency: "EUR",
    url: "https://example.com/items/sandro-leather-bag",
  },
];

export const brandsById = Object.fromEntries(
  seedBrands.map((brand) => [brand.id, brand]),
) as Record<string, Brand>;

export const itemsById = Object.fromEntries(
  seedItems.map((item) => [item.id, item]),
) as Record<string, Item>;
