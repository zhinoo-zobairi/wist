import type { Item } from "../types";

export interface PriceSource {
  getItems(brandId: string): Item[];
  getPrice(itemId: string): number;
}
