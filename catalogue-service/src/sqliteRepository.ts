import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type {
  CatalogueBrand,
  CatalogueItem,
  CatalogueMedia,
  CatalogueVariant,
} from "./model.js";
import type {
  CatalogueObservationRepository,
  PriceDrop,
  PriceDropAlert,
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

type PriceDropAlertRow = {
  id: number;
  item_id: string;
  old_price: number;
  new_price: number;
  currency: string;
  pct_off: number;
  observed_at: string;
};

type MediaRow = {
  type: CatalogueMedia["type"];
  url: string;
};

type VariantRow = {
  id: string;
  label: string;
  available: number;
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

function rowToItem(
  row: ItemRow,
  media: CatalogueMedia[],
  variants: CatalogueVariant[],
): CatalogueItem {
  return {
    id: row.id,
    source: row.source,
    sourceProductId: row.source_product_id,
    brandId: row.brand_id,
    name: row.name,
    url: row.url,
    imageUrl: row.image_url,
    media,
    variants,
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
    this.database.exec("PRAGMA busy_timeout = 5000");
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

      CREATE TABLE IF NOT EXISTS catalogue_variants (
        item_id TEXT NOT NULL REFERENCES catalogue_items(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        label TEXT NOT NULL,
        available INTEGER NOT NULL CHECK (available IN (0, 1)),
        position INTEGER NOT NULL,
        PRIMARY KEY (item_id, id)
      );

      CREATE TABLE IF NOT EXISTS catalogue_watches (
        item_id TEXT PRIMARY KEY REFERENCES catalogue_items(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS price_drop_alerts (
        id INTEGER PRIMARY KEY,
        item_id TEXT NOT NULL REFERENCES catalogue_items(id) ON DELETE CASCADE,
        old_price REAL NOT NULL CHECK (old_price >= 0),
        new_price REAL NOT NULL CHECK (new_price >= 0),
        currency TEXT NOT NULL,
        pct_off INTEGER NOT NULL CHECK (pct_off >= 0),
        observed_at TEXT NOT NULL,
        UNIQUE (item_id, observed_at)
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
    return rows.map((row) =>
      rowToItem(
        row,
        this.mediaFor(row.id, row.image_url),
        this.variantsFor(row.id),
      ),
    );
  }

  async getItem(itemId: string): Promise<CatalogueItem | null> {
    const row = this.database
      .prepare(`${itemSelect} WHERE item.id = ?`)
      .get(itemId) as unknown as ItemRow | undefined;
    return row
      ? rowToItem(
          row,
          this.mediaFor(row.id, row.image_url),
          this.variantsFor(row.id),
        )
      : null;
  }

  async listWatchedItemIds(): Promise<string[]> {
    const rows = this.database
      .prepare("SELECT item_id FROM catalogue_watches ORDER BY created_at, item_id")
      .all() as unknown as Array<{ item_id: string }>;
    return rows.map((row) => row.item_id);
  }

  async watchItem(itemId: string): Promise<void> {
    this.database
      .prepare(`
        INSERT INTO catalogue_watches (item_id, created_at)
        VALUES (?, ?)
        ON CONFLICT (item_id) DO NOTHING
      `)
      .run(itemId, new Date().toISOString());
  }

  async unwatchItem(itemId: string): Promise<void> {
    this.database
      .prepare("DELETE FROM catalogue_watches WHERE item_id = ?")
      .run(itemId);
  }

  async listPriceDropAlerts(): Promise<PriceDropAlert[]> {
    const rows = this.database
      .prepare(`
        SELECT id, item_id, old_price, new_price, currency, pct_off, observed_at
        FROM price_drop_alerts
        ORDER BY observed_at DESC, id DESC
        LIMIT 100
      `)
      .all() as unknown as PriceDropAlertRow[];
    return rows.map((row) => ({
      id: `price-drop-${row.id}`,
      itemId: row.item_id,
      oldPrice: row.old_price,
      newPrice: row.new_price,
      currency: row.currency,
      pctOff: row.pct_off,
      observedAt: row.observed_at,
    }));
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
        .prepare("DELETE FROM catalogue_variants WHERE item_id = ?")
        .run(item.id);
      const insertVariant = this.database.prepare(`
        INSERT INTO catalogue_variants (item_id, id, label, available, position)
        VALUES (?, ?, ?, ?, ?)
      `);
      item.variants.forEach((variant, position) => {
        insertVariant.run(
          item.id,
          variant.id,
          variant.label,
          variant.available ? 1 : 0,
          position,
        );
      });

      this.database
        .prepare(`
          INSERT INTO price_observations (item_id, price, currency, observed_at)
          VALUES (?, ?, ?, ?)
        `)
        .run(item.id, item.currentPrice, item.currency, item.observedAt);

      if (priceDrop) {
        this.database
          .prepare(`
            INSERT INTO price_drop_alerts (
              item_id, old_price, new_price, currency, pct_off, observed_at
            ) VALUES (?, ?, ?, ?, ?, ?)
          `)
          .run(
            priceDrop.itemId,
            priceDrop.oldPrice,
            priceDrop.newPrice,
            priceDrop.currency,
            priceDrop.pctOff,
            priceDrop.observedAt,
          );
      }

      this.database.exec("COMMIT");

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

  private variantsFor(itemId: string): CatalogueVariant[] {
    const rows = this.database
      .prepare(`
        SELECT id, label, available
        FROM catalogue_variants
        WHERE item_id = ?
        ORDER BY position
      `)
      .all(itemId) as unknown as VariantRow[];
    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      available: row.available === 1,
    }));
  }
}
