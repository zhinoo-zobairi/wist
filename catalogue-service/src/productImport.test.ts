import { describe, expect, it, vi } from "vitest";

import { importProduct } from "./productImport.js";
import type { CatalogueObservationRepository } from "./repository.js";

describe("product import", () => {
  it("records the first observation and returns the stored item", async () => {
    const item = {
      id: "sandro-SFPRO00001",
      source: "sandro" as const,
      sourceProductId: "SFPRO00001",
      brandId: "sandro",
      name: "Tweed-Kleid",
      url: "https://de.sandro-paris.com/de/p/tweed-kleid/SFPRO00001.html",
      imageUrl: "https://de.sandro-paris.com/image.jpg",
      media: [
        {
          type: "image" as const,
          url: "https://de.sandro-paris.com/image.jpg",
        },
      ],
      variants: [],
      currentPrice: 345,
      previousPrice: null,
      currency: "EUR",
      available: true,
      observedAt: "2026-08-30T12:00:00.000Z",
    };
    const recordObservation = vi.fn(async () => ({ item, priceDrop: null }));
    const repository = {
      recordObservation,
    } as unknown as CatalogueObservationRepository;
    const observeProduct = vi.fn(async () => ({
      brand: { id: "sandro", name: "Sandro" },
      item,
    }));

    await expect(
      importProduct(repository, item.url, observeProduct),
    ).resolves.toBe(item);
    expect(recordObservation).toHaveBeenCalledWith(
      { id: "sandro", name: "Sandro" },
      item,
    );
  });
});
