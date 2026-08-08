import { seedItems } from "../data/seed";
import type { Item } from "../types";
import type { PriceSource } from "./priceSource";

export type TriggeredDrop = {
  itemId: string;
  oldPrice: number;
  newPrice: number;
};

export class SeedPriceSource implements PriceSource {
  private readonly prices = new Map(
    seedItems.map((item) => [item.id, item.currentPrice]),
  );

  getItems(brandId: string): Item[] {
    return seedItems
      .filter((item) => item.brandId === brandId)
      .map((item) => ({ ...item, currentPrice: this.getPrice(item.id) }));
  }

  getPrice(itemId: string): number {
    const price = this.prices.get(itemId);
    if (price === undefined) {
      throw new Error(`Unknown seed item: ${itemId}`);
    }
    return price;
  }

  hasItem(itemId: string): boolean {
    return this.prices.has(itemId);
  }

  getAllItems(): Item[] {
    return seedItems.map((item) => ({
      ...item,
      currentPrice: this.getPrice(item.id),
    }));
  }

  triggerPriceDrop(itemId: string, percentage = 30): TriggeredDrop {
    const oldPrice = this.getPrice(itemId);
    const newPrice = Math.max(1, Math.round(oldPrice * (1 - percentage / 100)));
    this.prices.set(itemId, newPrice);
    return { itemId, oldPrice, newPrice };
  }

  restorePrices(overrides: Record<string, number>): void {
    Object.entries(overrides).forEach(([itemId, price]) => {
      if (this.prices.has(itemId)) this.prices.set(itemId, price);
    });
  }
}

export const seedPriceSource = new SeedPriceSource();
