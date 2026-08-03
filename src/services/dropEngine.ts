import type { Alert, PriceSnapshot } from "../types";
import { LOCAL_USER_ID } from "../types";
import type { PriceSource } from "./priceSource";

type CaptureResult = {
  snapshots: PriceSnapshot[];
  alerts: Alert[];
};

type CaptureInput = {
  source: PriceSource;
  starredItemIds: string[];
  previousSnapshots: PriceSnapshot[];
  capturedAt?: string;
};

export function captureStarredPrices({
  source,
  starredItemIds,
  previousSnapshots,
  capturedAt = new Date().toISOString(),
}: CaptureInput): CaptureResult {
  const snapshots: PriceSnapshot[] = [];
  const alerts: Alert[] = [];
  const latestByItem = new Map<string, PriceSnapshot>();
  previousSnapshots.forEach((snapshot) => {
    latestByItem.set(snapshot.itemId, snapshot);
  });

  starredItemIds.forEach((itemId, index) => {
    const previous = latestByItem.get(itemId);
    const price = source.getPrice(itemId);
    const snapshot: PriceSnapshot = {
      id: `snapshot-${itemId}-${capturedAt}-${index}`,
      itemId,
      price,
      capturedAt,
    };
    snapshots.push(snapshot);

    if (previous && price < previous.price) {
      alerts.push({
        id: `alert-${itemId}-${capturedAt}`,
        userId: LOCAL_USER_ID,
        itemId,
        oldPrice: previous.price,
        newPrice: price,
        pctOff: Math.round(((previous.price - price) / previous.price) * 100),
        createdAt: capturedAt,
        read: false,
      });
    }
  });

  return { snapshots, alerts };
}

export function retainLatestSnapshots(
  snapshots: PriceSnapshot[],
): PriceSnapshot[] {
  const latestByItem = new Map<string, PriceSnapshot>();
  snapshots.forEach((snapshot) => latestByItem.set(snapshot.itemId, snapshot));
  return [...latestByItem.values()];
}
