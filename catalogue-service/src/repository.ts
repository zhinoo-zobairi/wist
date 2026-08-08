import type { CatalogueBrand, CatalogueItem } from "./model.js";

export interface CatalogueRepository {
  listBrands(): Promise<CatalogueBrand[]>;
  listItems(brandId: string): Promise<CatalogueItem[]>;
  getItem(itemId: string): Promise<CatalogueItem | null>;
}

export type PriceDrop = {
  itemId: string;
  oldPrice: number;
  newPrice: number;
  currency: string;
  pctOff: number;
  observedAt: string;
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
