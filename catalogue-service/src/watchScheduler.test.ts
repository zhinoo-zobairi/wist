import { describe, expect, it, vi } from "vitest";

import type { CatalogueItem } from "./model.js";
import { SqliteCatalogueRepository } from "./sqliteRepository.js";
import { observeWatchedProducts } from "./watchScheduler.js";

const brand = { id: "bobbies", name: "Bobbies" };
const itemAt = (id: string, price: number, observedAt: string): CatalogueItem => ({
  id,
  source: "bobbies",
  sourceProductId: id.replace("bobbies-", ""),
  brandId: "bobbies",
  name: id,
  url: `https://www.bobbies.com/en/${id}.html`,
  imageUrl: `https://images.bobbies.com/${id}.jpg`,
  media: [{ type: "image", url: `https://images.bobbies.com/${id}.jpg` }],
  variants: [],
  currentPrice: price,
  previousPrice: null,
  currency: "EUR",
  available: true,
  observedAt,
});

describe("watched product observation", () => {
  it("checks watched products sequentially and records drops", async () => {
    const repository = new SqliteCatalogueRepository(":memory:");
    const first = itemAt("bobbies-first", 200, "2026-08-14T00:00:00.000Z");
    const second = itemAt("bobbies-second", 300, "2026-08-14T00:00:00.000Z");
    await repository.recordObservation(brand, first);
    await repository.recordObservation(brand, second);
    await repository.watchItem(first.id);
    await repository.watchItem(second.id);

    let activeRequests = 0;
    let maximumActiveRequests = 0;
    const observeProduct = vi.fn(async (url: string) => {
      activeRequests += 1;
      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
      await Promise.resolve();
      activeRequests -= 1;
      const stored = url.includes("first") ? first : second;
      return {
        brand,
        item: itemAt(
          stored.id,
          stored.id === first.id ? 150 : stored.currentPrice,
          "2026-08-15T00:00:00.000Z",
        ),
      };
    });

    await expect(
      observeWatchedProducts(repository, observeProduct),
    ).resolves.toEqual({
      checked: 2,
      failed: 0,
      priceDrops: 1,
      silencedDrops: 0,
    });
    expect(maximumActiveRequests).toBe(1);
    await expect(repository.listPriceDropAlerts()).resolves.toHaveLength(1);
    repository.close();
  });

  it("continues after one watched product fails", async () => {
    const repository = new SqliteCatalogueRepository(":memory:");
    const first = itemAt("bobbies-first", 200, "2026-08-14T00:00:00.000Z");
    const second = itemAt("bobbies-second", 300, "2026-08-14T00:00:00.000Z");
    await repository.recordObservation(brand, first);
    await repository.recordObservation(brand, second);
    await repository.watchItem(first.id);
    await repository.watchItem(second.id);
    const reportError = vi.fn();
    const observeProduct = vi
      .fn()
      .mockRejectedValueOnce(new Error("blocked"))
      .mockResolvedValueOnce({
        brand,
        item: itemAt(second.id, 300, "2026-08-15T00:00:00.000Z"),
      });

    await expect(
      observeWatchedProducts(repository, observeProduct, reportError),
    ).resolves.toEqual({
      checked: 1,
      failed: 1,
      priceDrops: 0,
      silencedDrops: 0,
    });
    expect(reportError).toHaveBeenCalledOnce();
    repository.close();
  });

  // A drop that misses the owner's size is still a real observation worth
  // counting, so the cycle reports it separately rather than pretending nothing
  // was detected.
  it("counts a drop that misses the chosen size as silenced", async () => {
    const repository = new SqliteCatalogueRepository(":memory:");
    const sized = (price: number, observedAt: string): CatalogueItem => ({
      ...itemAt("bobbies-sized", price, observedAt),
      variants: [
        { id: "137", label: "39", available: false },
        { id: "138", label: "40", available: true },
      ],
    });
    await repository.recordObservation(brand, sized(200, "2026-08-14T00:00:00.000Z"));
    await repository.watchItem("bobbies-sized");
    await repository.replaceWatchSizes("bobbies-sized", ["39"]);

    const observeProduct = vi.fn(async () => ({
      brand,
      item: sized(150, "2026-08-15T00:00:00.000Z"),
    }));

    await expect(
      observeWatchedProducts(repository, observeProduct),
    ).resolves.toEqual({
      checked: 1,
      failed: 0,
      priceDrops: 1,
      silencedDrops: 1,
    });
    await expect(repository.listPriceDropAlerts()).resolves.toEqual([]);
    repository.close();
  });
});
