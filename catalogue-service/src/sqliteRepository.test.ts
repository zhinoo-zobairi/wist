import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
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
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    repositories.splice(0).forEach((repository) => repository.close());
    temporaryDirectories
      .splice(0)
      .forEach((directory) => rmSync(directory, { force: true, recursive: true }));
  });

  const createRepository = (path = ":memory:") => {
    const repository = new SqliteCatalogueRepository(path);
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

  it("announces a drop below the coveted price and exposes the previous price", async () => {
    const repository = createRepository();
    await repository.recordObservation(
      brand,
      itemAt(225, "2026-08-08T12:00:00.000Z"),
    );
    await repository.watchItem("bobbies-L-M24WO-OPE01");

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

  // Alerts exist to tell the owner about pieces they asked for. An observation of
  // something nobody coveted has no price the owner cared about to measure
  // against, so it stays history rather than becoming a notification.
  it("announces nothing for an item that was never coveted", async () => {
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
    ).resolves.toMatchObject({ alerted: false, priceDrop: null });
    await expect(repository.listPriceDropAlerts()).resolves.toEqual([]);
  });

  // The false signal this baseline exists to kill: a real decrease that still
  // leaves the piece dearer than it was when the owner wanted it.
  it("stays quiet when a decrease is still above the coveted price", async () => {
    const repository = createRepository();
    await repository.recordObservation(
      brand,
      itemAt(225, "2026-08-08T12:00:00.000Z"),
    );
    await repository.watchItem("bobbies-L-M24WO-OPE01");
    await repository.recordObservation(
      brand,
      itemAt(300, "2026-08-09T12:00:00.000Z"),
    );

    await expect(
      repository.recordObservation(
        brand,
        itemAt(260, "2026-08-10T12:00:00.000Z"),
      ),
    ).resolves.toMatchObject({ priceDrop: null });
    await expect(repository.listPriceDropAlerts()).resolves.toEqual([]);
  });

  it("announces a sale price once rather than on every later check", async () => {
    const repository = createRepository();
    await repository.recordObservation(
      brand,
      itemAt(225, "2026-08-08T12:00:00.000Z"),
    );
    await repository.watchItem("bobbies-L-M24WO-OPE01");
    await repository.recordObservation(
      brand,
      itemAt(180, "2026-08-09T12:00:00.000Z"),
    );

    await expect(
      repository.recordObservation(
        brand,
        itemAt(180, "2026-08-10T12:00:00.000Z"),
      ),
    ).resolves.toMatchObject({ priceDrop: null });
    await expect(repository.listPriceDropAlerts()).resolves.toHaveLength(1);
  });

  it("announces a further drop under the price already announced", async () => {
    const repository = createRepository();
    await repository.recordObservation(
      brand,
      itemAt(225, "2026-08-08T12:00:00.000Z"),
    );
    await repository.watchItem("bobbies-L-M24WO-OPE01");
    await repository.recordObservation(
      brand,
      itemAt(180, "2026-08-09T12:00:00.000Z"),
    );

    await expect(
      repository.recordObservation(
        brand,
        itemAt(135, "2026-08-10T12:00:00.000Z"),
      ),
    ).resolves.toMatchObject({
      priceDrop: { newPrice: 135, oldPrice: 225, pctOff: 40 },
    });
    await expect(repository.listPriceDropAlerts()).resolves.toHaveLength(2);
  });

  // The baseline is the price on the day the owner coveted the piece, not the
  // first price the catalogue ever saw.
  it("measures against the price at covet time, not the first observation", async () => {
    const repository = createRepository();
    await repository.recordObservation(
      brand,
      itemAt(300, "2026-08-07T12:00:00.000Z"),
    );
    await repository.recordObservation(
      brand,
      itemAt(225, "2026-08-08T12:00:00.000Z"),
    );
    await repository.watchItem("bobbies-L-M24WO-OPE01");

    await expect(
      repository.recordObservation(
        brand,
        itemAt(180, "2026-08-09T12:00:00.000Z"),
      ),
    ).resolves.toMatchObject({
      priceDrop: { newPrice: 180, oldPrice: 225, pctOff: 20 },
    });
  });

  // Coveting a piece again is the owner saying they want it at today's price, so
  // it starts a fresh baseline and forgets what was already announced.
  it("starts a fresh baseline when the item is coveted again", async () => {
    const repository = createRepository();
    await repository.recordObservation(
      brand,
      itemAt(225, "2026-08-08T12:00:00.000Z"),
    );
    await repository.watchItem("bobbies-L-M24WO-OPE01");
    await repository.recordObservation(
      brand,
      itemAt(180, "2026-08-09T12:00:00.000Z"),
    );

    await repository.unwatchItem("bobbies-L-M24WO-OPE01");
    await repository.watchItem("bobbies-L-M24WO-OPE01");

    await expect(
      repository.recordObservation(
        brand,
        itemAt(171, "2026-08-10T12:00:00.000Z"),
      ),
    ).resolves.toMatchObject({
      priceDrop: { newPrice: 171, oldPrice: 180, pctOff: 5 },
    });
    await expect(repository.listPriceDropAlerts()).resolves.toHaveLength(2);
  });

  // A drop the owner never heard about because it missed their size must stay
  // announceable, so a silenced drop does not count as already announced.
  it("announces a silenced price once the chosen size is back in stock", async () => {
    const repository = createRepository();
    const soldOut = (price: number, observedAt: string): CatalogueItem => ({
      ...itemAt(price, observedAt),
      variants: [{ id: "137", label: "39", available: false }],
    });
    await repository.recordObservation(
      brand,
      soldOut(225, "2026-08-08T12:00:00.000Z"),
    );
    await repository.watchItem("bobbies-L-M24WO-OPE01");
    await repository.replaceWatchSizes("bobbies-L-M24WO-OPE01", ["39"]);
    await repository.recordObservation(
      brand,
      soldOut(180, "2026-08-09T12:00:00.000Z"),
    );
    await expect(repository.listPriceDropAlerts()).resolves.toEqual([]);

    await expect(
      repository.recordObservation(brand, {
        ...itemAt(180, "2026-08-10T12:00:00.000Z"),
        variants: [{ id: "137", label: "39", available: true }],
      }),
    ).resolves.toMatchObject({ alerted: true });
    await expect(repository.listPriceDropAlerts()).resolves.toHaveLength(1);
  });

  // The upgrade path for pieces coveted before baselines were recorded. What
  // they were coveted at is unknowable, so such a watch adopts the next observed
  // price. It must not read that adoption as a drop, or every existing watch
  // would fire a false alert on the first check after the upgrade.
  it("adopts a watch made before baselines were recorded", async () => {
    const directory = mkdtempSync(join(tmpdir(), "wist-catalogue-"));
    temporaryDirectories.push(directory);
    const repository = createRepository(join(directory, "catalogue.sqlite"));
    await repository.recordObservation(
      brand,
      itemAt(225, "2026-08-08T12:00:00.000Z"),
    );
    await repository.watchItem("bobbies-L-M24WO-OPE01");

    const database = new DatabaseSync(join(directory, "catalogue.sqlite"));
    database.exec("DELETE FROM catalogue_watch_prices");
    database.close();

    await expect(
      repository.recordObservation(
        brand,
        itemAt(180, "2026-08-09T12:00:00.000Z"),
      ),
    ).resolves.toMatchObject({ priceDrop: null });
    await expect(repository.listPriceDropAlerts()).resolves.toEqual([]);

    await expect(
      repository.recordObservation(
        brand,
        itemAt(135, "2026-08-10T12:00:00.000Z"),
      ),
    ).resolves.toMatchObject({
      priceDrop: { newPrice: 135, oldPrice: 180, pctOff: 25 },
    });
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
