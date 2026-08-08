import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type {
  CatalogueBrand,
  CatalogueItem,
  CatalogueMedia,
} from "./model.js";
import type {
  CatalogueObservationRepository,
  PriceDrop,
  RecordedObservation,
} from "./repository.js";

type ItemRow = {
  id: string;
  source: CatalogueItem["source"];
  source_product_id: string;
  brand_id: string;
  name: string;
  url: string;
  image_url: string;
  currency: string;
  available: number;
  current_price: number;
  previous_price: number | null;
  observed_at: string;
};

type PriceRow = {
  price: number;
  currency: string;
};

type MediaRow = {
  type: CatalogueMedia["type"];
  url: string;
};

const itemSelect = `
  SELECT
    item.id,
    item.source,
    item.source_product_id,
    item.brand_id,
    item.name,
    item.url,
    item.image_url,
    item.currency,
    item.available,
    (
      SELECT observation.price
      FROM price_observations AS observation
      WHERE observation.item_id = item.id
      ORDER BY observation.observed_at DESC, observation.id DESC
      LIMIT 1
    ) AS current_price,
    (
      SELECT observation.price
      FROM price_observations AS observation
      WHERE observation.item_id = item.id
      ORDER BY observation.observed_at DESC, observation.id DESC
      LIMIT 1 OFFSET 1
    ) AS previous_price,
    (
      SELECT observation.observed_at
      FROM price_observations AS observation
      WHERE observation.item_id = item.id
      ORDER BY observation.observed_at DESC, observation.id DESC
      LIMIT 1
    ) AS observed_at
  FROM catalogue_items AS item
`;

function rowToItem(row: ItemRow, media: CatalogueMedia[]): CatalogueItem {
  return {
    id: row.id,
    source: row.source,
    sourceProductId: row.source_product_id,
    brandId: row.brand_id,
    name: row.name,
    url: row.url,
    imageUrl: row.image_url,
    media,
    currentPrice: row.current_price,
    previousPrice: row.previous_price,
    currency: row.currency,
    available: row.available === 1,
    observedAt: row.observed_at,
  };
}

export class SqliteCatalogueRepository
  implements CatalogueObservationRepository
{
  private readonly database: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA foreign_keys = ON");
    this.database.exec("PRAGMA journal_mode = WAL");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS catalogue_brands (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS catalogue_items (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        source_product_id TEXT NOT NULL,
        brand_id TEXT NOT NULL REFERENCES catalogue_brands(id),
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        image_url TEXT NOT NULL,
        currency TEXT NOT NULL,
        available INTEGER NOT NULL CHECK (available IN (0, 1)),
        UNIQUE (source, source_product_id)
      );

      CREATE TABLE IF NOT EXISTS price_observations (
        id INTEGER PRIMARY KEY,
        item_id TEXT NOT NULL REFERENCES catalogue_items(id),
        price REAL NOT NULL CHECK (price >= 0),
        currency TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        UNIQUE (item_id, observed_at)
      );

      CREATE TABLE IF NOT EXISTS catalogue_media (
        item_id TEXT NOT NULL REFERENCES catalogue_items(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('image', 'video')),
        url TEXT NOT NULL,
        PRIMARY KEY (item_id, position)
      );

      CREATE INDEX IF NOT EXISTS price_observations_item_time
      ON price_observations(item_id, observed_at DESC);
    `);
  }

  async listBrands(): Promise<CatalogueBrand[]> {
    const rows = this.database
      .prepare("SELECT id, name FROM catalogue_brands ORDER BY name")
      .all() as unknown as CatalogueBrand[];
    return rows.map((row) => ({ ...row }));
  }

  async listItems(brandId: string): Promise<CatalogueItem[]> {
    const rows = this.database
      .prepare(`${itemSelect} WHERE item.brand_id = ? ORDER BY item.name`)
      .all(brandId) as unknown as ItemRow[];
    return rows.map((row) => rowToItem(row, this.mediaFor(row.id, row.image_url)));
  }

  async getItem(itemId: string): Promise<CatalogueItem | null> {
    const row = this.database
      .prepare(`${itemSelect} WHERE item.id = ?`)
      .get(itemId) as unknown as ItemRow | undefined;
    return row ? rowToItem(row, this.mediaFor(row.id, row.image_url)) : null;
  }

  async recordObservation(
    brand: CatalogueBrand,
    item: CatalogueItem,
  ): Promise<RecordedObservation> {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const previous = this.database
        .prepare(`
          SELECT price, currency
          FROM price_observations
          WHERE item_id = ?
          ORDER BY observed_at DESC, id DESC
          LIMIT 1
        `)
        .get(item.id) as unknown as PriceRow | undefined;

      this.database
        .prepare(`
          INSERT INTO catalogue_brands (id, name)
          VALUES (?, ?)
          ON CONFLICT (id) DO UPDATE SET name = excluded.name
        `)
        .run(brand.id, brand.name);

      this.database
        .prepare(`
          INSERT INTO catalogue_items (
            id, source, source_product_id, brand_id, name, url, image_url,
            currency, available
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET
            source = excluded.source,
            source_product_id = excluded.source_product_id,
            brand_id = excluded.brand_id,
            name = excluded.name,
            url = excluded.url,
            image_url = excluded.image_url,
            currency = excluded.currency,
            available = excluded.available
        `)
        .run(
          item.id,
          item.source,
          item.sourceProductId,
          item.brandId,
          item.name,
          item.url,
          item.imageUrl,
          item.currency,
          item.available ? 1 : 0,
        );

      this.database
        .prepare("DELETE FROM catalogue_media WHERE item_id = ?")
        .run(item.id);
      const insertMedia = this.database.prepare(`
        INSERT INTO catalogue_media (item_id, position, type, url)
        VALUES (?, ?, ?, ?)
      `);
      item.media.forEach((media, position) => {
        insertMedia.run(item.id, position, media.type, media.url);
      });

      this.database
        .prepare(`
          INSERT INTO price_observations (item_id, price, currency, observed_at)
          VALUES (?, ?, ?, ?)
        `)
        .run(item.id, item.currentPrice, item.currency, item.observedAt);

      this.database.exec("COMMIT");

      const priceDrop: PriceDrop | null =
        previous &&
        previous.currency === item.currency &&
        item.currentPrice < previous.price
          ? {
              itemId: item.id,
              oldPrice: previous.price,
              newPrice: item.currentPrice,
              currency: item.currency,
              pctOff: Math.round(
                ((previous.price - item.currentPrice) / previous.price) * 100,
              ),
              observedAt: item.observedAt,
            }
          : null;

      return {
        item: { ...item, previousPrice: previous?.price ?? null },
        priceDrop,
      };
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  close(): void {
    this.database.close();
  }

  private mediaFor(itemId: string, fallbackImageUrl: string): CatalogueMedia[] {
    const rows = this.database
      .prepare(`
        SELECT type, url
        FROM catalogue_media
        WHERE item_id = ?
        ORDER BY position
      `)
      .all(itemId) as unknown as MediaRow[];
    return rows.length > 0
      ? rows.map((row) => ({ ...row }))
      : [{ type: "image", url: fallbackImageUrl }];
  }
}
