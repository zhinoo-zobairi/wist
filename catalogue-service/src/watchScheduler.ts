import { fetchProductObservation } from "./productObservation.js";
import type { CatalogueObservationRepository } from "./repository.js";

type ObserveProduct = typeof fetchProductObservation;
type ReportError = (message: string, error: unknown) => void;

export type ObservationCycle = {
  checked: number;
  failed: number;
  /** Price decreases detected, including ones no alert was raised for. */
  priceDrops: number;
  /** Of those, the ones that missed every size the owner asked about. */
  silencedDrops: number;
};

export async function observeWatchedProducts(
  repository: CatalogueObservationRepository,
  observeProduct: ObserveProduct = fetchProductObservation,
  reportError: ReportError = (message, error) => console.error(message, error),
): Promise<ObservationCycle> {
  const watchedItemIds = await repository.listWatchedItemIds();
  const result = { checked: 0, failed: 0, priceDrops: 0, silencedDrops: 0 };

  for (const itemId of watchedItemIds) {
    try {
      const storedItem = await repository.getItem(itemId);
      if (!storedItem) throw new Error("Watched item no longer exists");

      const observation = await observeProduct(storedItem.url);
      if (observation.item.id !== itemId) {
        throw new Error(
          `Observed product ${observation.item.id} does not match watched item ${itemId}`,
        );
      }

      const recorded = await repository.recordObservation(
        observation.brand,
        observation.item,
      );
      result.checked += 1;
      if (recorded.priceDrop) result.priceDrops += 1;
      if (recorded.priceDrop && !recorded.alerted) result.silencedDrops += 1;
    } catch (error) {
      result.failed += 1;
      reportError(`Could not observe watched item ${itemId}`, error);
    }
  }

  return result;
}

export function startWatchScheduler(
  repository: CatalogueObservationRepository,
  intervalMs: number,
  reportError?: ReportError,
): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;

  const run = async () => {
    try {
      const result = await observeWatchedProducts(
        repository,
        fetchProductObservation,
        reportError,
      );
      console.log(
        `Watch cycle complete: ${result.checked} checked, ${result.priceDrops} drops (${result.silencedDrops} silenced), ${result.failed} failed`,
      );
    } catch (error) {
      (reportError ?? console.error)("Watch cycle failed", error);
    }

    if (!stopped) timer = setTimeout(run, intervalMs);
  };

  void run();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
