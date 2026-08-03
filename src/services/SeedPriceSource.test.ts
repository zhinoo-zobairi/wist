import { describe, expect, it } from "vitest";

import { SeedPriceSource } from "./SeedPriceSource";

describe("SeedPriceSource", () => {
  it("returns only items from the requested brand", () => {
    const source = new SeedPriceSource();

    expect(source.getItems("sezane")).toHaveLength(2);
    expect(source.getItems("sezane").every((item) => item.brandId === "sezane")).toBe(
      true,
    );
  });

  it("scripts a 30 percent price drop", () => {
    const source = new SeedPriceSource();

    expect(source.triggerPriceDrop("sezane-wool-coat")).toEqual({
      itemId: "sezane-wool-coat",
      oldPrice: 550,
      newPrice: 385,
    });
    expect(source.getPrice("sezane-wool-coat")).toBe(385);
  });

  it("restores persisted prices and ignores unknown items", () => {
    const source = new SeedPriceSource();

    source.restorePrices({ "sezane-wool-coat": 350, unknown: 1 });

    expect(source.getPrice("sezane-wool-coat")).toBe(350);
    expect(() => source.getPrice("unknown")).toThrow("Unknown seed item");
  });
});
