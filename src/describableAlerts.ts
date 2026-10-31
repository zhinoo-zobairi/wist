import type { Alert, Brand, Item } from "./types";

export type DescribableAlert = { alert: Alert; brand: Brand; item: Item };

/**
 * The alerts the loaded catalogue can put a name and a photo to, in their
 * original order. Alerts are persisted and the catalogue is not, so after a
 * failed load or when a piece leaves the index some alerts cannot be shown.
 * Everything that says "there is a drop" (the badge, the Alerts hero, the poll's
 * banners) reads this one list, so they never disagree.
 */
export function describableAlerts(alerts: Alert[], items: Item[], brands: Brand[]): DescribableAlert[] {
  const brandsById = new Map(brands.map((brand) => [brand.id, brand]));
  const itemsById = new Map(items.map((item) => [item.id, item]));
  return alerts.flatMap((alert) => {
    const item = itemsById.get(alert.itemId);
    const brand = item ? brandsById.get(item.brandId) : undefined;
    return item && brand ? [{ alert, brand, item }] : [];
  });
}
