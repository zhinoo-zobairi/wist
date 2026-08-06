import type { CatalogueBrand, CatalogueItem } from "./model.js";

export interface CatalogueRepository {
  listBrands(): Promise<CatalogueBrand[]>;
  listItems(brandId: string): Promise<CatalogueItem[]>;
  getItem(itemId: string): Promise<CatalogueItem | null>;
}
