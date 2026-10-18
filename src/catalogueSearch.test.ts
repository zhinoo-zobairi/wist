import { describe, expect, it } from "vitest";

import { searchItems } from "./catalogueSearch";
import type { Brand, Item } from "./types";

const brands: Brand[] = [
  { id: "sezane", name: "Sézane", monogram: "S", curated: true },
  { id: "sandro", name: "Sandro", monogram: "S", curated: true },
];

const item = (id: string, brandId: string, name: string): Item => ({
  id, brandId, name, imageUrl: "", currentPrice: 1, currency: "EUR", url: "",
});

const items = [
  item("coat", "sezane", "Johnson Wool Coat"),
  item("skirt", "sezane", "Naëlle Silk Skirt"),
  item("bag", "sandro", "Tangoso Leather Bag"),
];

describe("searchItems", () => {
  it("returns every item for an empty or blank query", () => {
    expect(searchItems(items, brands, "")).toBe(items);
    expect(searchItems(items, brands, "   ")).toBe(items);
  });

  it("matches the item name ignoring case", () => {
    expect(searchItems(items, brands, "WOOL").map((entry) => entry.id)).toEqual(["coat"]);
  });

  it("matches ignoring diacritics in both directions", () => {
    expect(searchItems(items, brands, "naelle").map((entry) => entry.id)).toEqual(["skirt"]);
    expect(searchItems(items, brands, "sézane").map((entry) => entry.id)).toEqual(["coat", "skirt"]);
  });

  it("matches the brand name", () => {
    expect(searchItems(items, brands, "sandro").map((entry) => entry.id)).toEqual(["bag"]);
  });

  it("requires every term to match", () => {
    expect(searchItems(items, brands, "sezane silk").map((entry) => entry.id)).toEqual(["skirt"]);
    expect(searchItems(items, brands, "sezane leather")).toEqual([]);
  });
});
