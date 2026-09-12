import { afterEach, describe, expect, it } from "vitest";

import type { CatalogueItem } from "./model.js";
import { SqliteCatalogueRepository } from "./sqliteRepository.js";

const brand = { id: "bobbies", name: "Bobbies" };

const itemAt = (price: number, observedAt: string): CatalogueItem => ({
  id: "bobbies-L-M24WO-OPE01",
  source: "bobbies",
  sourceProductId: "L-M24WO-OPE01",
  brandId: "bobbies",
  name: "Opéra - Iridescent Champagne",
  url: "https://www.bobbies.com/en/opera.html",
  imageUrl: "https://images.bobbies.com/opera.jpg",
  media: [{ type: "image", url: "https://images.bobbies.com/opera.jpg" }],
  variants: [
    { id: "137", label: "39", available: false },
    { id: "138", label: "40", available: true },
  ],
  currentPrice: price,
  previousPrice: null,
  currency: "EUR",
  available: true,
  observedAt,
});

describe("SQLite catalogue repository", () => {
  const repositories: SqliteCatalogueRepository[] = [];

  afterEach(() => {
    repositories.splice(0).forEach((repository) => repository.close());
  });

  const createRepository = () => {
    const repository = new SqliteCatalogueRepository(":memory:");
    repositories.push(repository);
    return repository;
  };

  it("persists a first product observation", async () => {
    const repository = createRepository();

    await expect(
      repository.recordObservation(
        brand,
        itemAt(225, "2026-08-08T12:00:00.000Z"),
      ),
    ).resolves.toMatchObject({ priceDrop: null });

    await expect(repository.listBrands()).resolves.toEqual([brand]);
    await expect(repository.listItems("bobbies")).resolves.toEqual([
      itemAt(225, "2026-08-08T12:00:00.000Z"),
    ]);
  });

  it("detects a lower observation and exposes the previous price", async () => {
    const repository = createRepository();
    await repository.recordObservation(
      brand,
      itemAt(225, "2026-08-08T12:00:00.000Z"),
    );

    await expect(
      repository.recordObservation(
        brand,
        itemAt(180, "2026-08-09T12:00:00.000Z"),
      ),
    ).resolves.toMatchObject({
      item: { currentPrice: 180, previousPrice: 225 },
      priceDrop: {
        oldPrice: 225,
        newPrice: 180,
        currency: "EUR",
        pctOff: 20,
      },
    });

    await expect(
      repository.getItem("bobbies-L-M24WO-OPE01"),
    ).resolves.toMatchObject({ currentPrice: 180, previousPrice: 225 });
    await expect(repository.listPriceDropAlerts()).resolves.toMatchObject([
      {
        id: "price-drop-1",
        itemId: "bobbies-L-M24WO-OPE01",
        oldPrice: 225,
        newPrice: 180,
        currency: "EUR",
        pctOff: 20,
        observedAt: "2026-08-09T12:00:00.000Z",
      },
    ]);
  });

  it("persists one idempotent single-user watch per item", async () => {
    const repository = createRepository();
    const item = itemAt(225, "2026-08-08T12:00:00.000Z");
    await repository.recordObservation(brand, item);

    await repository.watchItem(item.id);
    await repository.watchItem(item.id);
    await expect(repository.listWatchedItemIds()).resolves.toEqual([item.id]);

    await repository.unwatchItem(item.id);
    await repository.unwatchItem(item.id);
    await expect(repository.listWatchedItemIds()).resolves.toEqual([]);
  });

  it("remembers the sizes chosen for a watch", async () => {
    const repository = createRepository();
    const item = itemAt(225, "2026-08-08T12:00:00.000Z");
    await repository.recordObservation(brand, item);
    await repository.watchItem(item.id);

    await expect(repository.listWatchSizes(item.id)).resolves.toEqual([]);

    await repository.replaceWatchSizes(item.id, ["40", "39"]);
    await expect(repository.listWatchSizes(item.id)).resolves.toEqual([
      "39",
      "40",
    ]);
  });

  it("replaces the chosen sizes rather than adding to them", async () => {
    const repository = createRepository();
    const item = itemAt(225, "2026-08-08T12:00:00.000Z");
    await repository.recordObservation(brand, item);
    await repository.watchItem(item.id);

    await repository.replaceWatchSizes(item.id, ["39"]);
    await repository.replaceWatchSizes(item.id, ["40"]);

    await expect(repository.listWatchSizes(item.id)).resolves.toEqual(["40"]);
  });

  // Variant rows are deleted and reinserted on every observation. The chosen
  // sizes must not be collateral damage, or a watch would quietly lose them
  // every six hours.
  it("keeps the chosen sizes when the product is observed again", async () => {
    const repository = createRepository();
    const item = itemAt(225, "2026-08-08T12:00:00.000Z");
    await repository.recordObservation(brand, item);
    await repository.watchItem(item.id);
    await repository.replaceWatchSizes(item.id, ["40"]);

    await repository.recordObservation(
      brand,
      itemAt(180, "2026-08-09T12:00:00.000Z"),
    );

    await expect(repository.listWatchSizes(item.id)).resolves.toEqual(["40"]);
  });

  it("raises no alert when the drop misses every chosen size", async () => {
    const repository = createRepository();
    const item = itemAt(225, "2026-08-08T12:00:00.000Z");
    await repository.recordObservation(brand, item);
    await repository.watchItem(item.id);
    // Size 39 is published but sold out in this fixture.
    await repository.replaceWatchSizes(item.id, ["39"]);

    await expect(
      repository.recordObservation(
        brand,
        itemAt(180, "2026-08-09T12:00:00.000Z"),
      ),
    ).resolves.toMatchObject({
      alerted: false,
      priceDrop: { oldPrice: 225, newPrice: 180 },
    });

    await expect(repository.listPriceDropAlerts()).resolves.toEqual([]);
  });

  it("raises an alert when the drop reaches a chosen size", async () => {
    const repository = createRepository();
    const item = itemAt(225, "2026-08-08T12:00:00.000Z");
    await repository.recordObservation(brand, item);
    await repository.watchItem(item.id);
    // Size 40 is in stock in this fixture.
    await repository.replaceWatchSizes(item.id, ["40"]);

    await expect(
      repository.recordObservation(
        brand,
        itemAt(180, "2026-08-09T12:00:00.000Z"),
      ),
    ).resolves.toMatchObject({ alerted: true });

    await expect(repository.listPriceDropAlerts()).resolves.toHaveLength(1);
  });

  it("forgets the chosen sizes once the item is no longer watched", async () => {
    const repository = createRepository();
    const item = itemAt(225, "2026-08-08T12:00:00.000Z");
    await repository.recordObservation(brand, item);
    await repository.watchItem(item.id);
    await repository.replaceWatchSizes(item.id, ["40"]);

    await repository.unwatchItem(item.id);

    await expect(repository.listWatchSizes(item.id)).resolves.toEqual([]);
  });
});
