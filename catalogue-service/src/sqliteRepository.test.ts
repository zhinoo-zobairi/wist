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
  });
});
