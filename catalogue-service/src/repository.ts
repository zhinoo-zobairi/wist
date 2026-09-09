import type { CatalogueBrand, CatalogueItem } from "./model.js";

export interface CatalogueRepository {
  listBrands(): Promise<CatalogueBrand[]>;
  listItems(brandId: string): Promise<CatalogueItem[]>;
  getItem(itemId: string): Promise<CatalogueItem | null>;
  listWatchedItemIds(): Promise<string[]>;
  watchItem(itemId: string): Promise<void>;
  unwatchItem(itemId: string): Promise<void>;
  /** The storefront size labels the owner wants alerts for; empty means any. */
  listWatchSizes(itemId: string): Promise<string[]>;
  replaceWatchSizes(itemId: string, labels: string[]): Promise<void>;
  listPriceDropAlerts(): Promise<PriceDropAlert[]>;
}

export type PriceDrop = {
  itemId: string;
  oldPrice: number;
  newPrice: number;
  currency: string;
  pctOff: number;
  observedAt: string;
};

export type PriceDropAlert = PriceDrop & {
  id: string;
};

export type RecordedObservation = {
  item: CatalogueItem;
  priceDrop: PriceDrop | null;
};

export interface CatalogueObservationRepository extends CatalogueRepository {
  recordObservation(
    brand: CatalogueBrand,
    item: CatalogueItem,
  ): Promise<RecordedObservation>;
}
