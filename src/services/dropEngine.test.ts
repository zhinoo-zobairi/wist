import { describe, expect, it } from "vitest";

import type { PriceSource } from "./priceSource";
import { captureStarredPrices, retainLatestSnapshots } from "./dropEngine";

const sourceAt = (price: number): PriceSource => ({
  getItems: () => [],
  getPrice: () => price,
});

describe("captureStarredPrices", () => {
  it("records a baseline without creating an alert", () => {
    const result = captureStarredPrices({
      capturedAt: "2026-08-03T10:00:00.000Z",
      previousSnapshots: [],
      source: sourceAt(550),
      starredItemIds: ["coat"],
    });

    expect(result.snapshots).toHaveLength(1);
    expect(result.alerts).toEqual([]);
  });

  it("creates an alert when the newest price is lower", () => {
    const result = captureStarredPrices({
      capturedAt: "2026-08-03T11:00:00.000Z",
      previousSnapshots: [
        {
          id: "baseline",
          itemId: "coat",
          price: 550,
          capturedAt: "2026-08-03T10:00:00.000Z",
        },
      ],
      source: sourceAt(385),
      starredItemIds: ["coat"],
    });

    expect(result.alerts).toMatchObject([
      { itemId: "coat", oldPrice: 550, newPrice: 385, pctOff: 30, read: false },
    ]);
  });

  it.each([550, 600])(
    "does not alert when the newest price is %s",
    (price) => {
      const result = captureStarredPrices({
        previousSnapshots: [
          {
            id: "baseline",
            itemId: "coat",
            price: 550,
            capturedAt: "2026-08-03T10:00:00.000Z",
          },
        ],
        source: sourceAt(price),
        starredItemIds: ["coat"],
      });

      expect(result.alerts).toEqual([]);
    },
  );

  it("does not inspect unstarred items", () => {
    const result = captureStarredPrices({
      previousSnapshots: [],
      source: {
        getItems: () => [],
        getPrice: () => {
          throw new Error("should not be called");
        },
      },
      starredItemIds: [],
    });

    expect(result).toEqual({ snapshots: [], alerts: [] });
  });

  it("alerts only the watched item whose price changed", () => {
    const prices: Record<string, number> = { coat: 385, bag: 295 };
    const result = captureStarredPrices({
      capturedAt: "2026-08-03T11:00:00.000Z",
      previousSnapshots: [
        { id: "coat-base", itemId: "coat", price: 550, capturedAt: "10:00" },
        { id: "bag-base", itemId: "bag", price: 295, capturedAt: "10:00" },
      ],
      source: {
        getItems: () => [],
        getPrice: (itemId) => prices[itemId] ?? 0,
      },
      starredItemIds: ["coat", "bag"],
    });

    expect(result.snapshots).toHaveLength(2);
    expect(result.alerts).toMatchObject([{ itemId: "coat" }]);
  });

  it("retains only the newest snapshot for each item", () => {
    expect(
      retainLatestSnapshots([
        { id: "old", itemId: "coat", price: 550, capturedAt: "10:00" },
        { id: "bag", itemId: "bag", price: 295, capturedAt: "10:00" },
        { id: "new", itemId: "coat", price: 385, capturedAt: "11:00" },
      ]),
    ).toMatchObject([
      { id: "new", itemId: "coat" },
      { id: "bag", itemId: "bag" },
    ]);
  });
});
