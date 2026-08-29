import { fetchProductObservation } from "./productObservation.js";
import type { CatalogueObservationRepository } from "./repository.js";

type ObserveProduct = typeof fetchProductObservation;

export async function importProduct(
  repository: CatalogueObservationRepository,
  productUrl: string,
  observeProduct: ObserveProduct = fetchProductObservation,
) {
  const observation = await observeProduct(productUrl);
  const recorded = await repository.recordObservation(
    observation.brand,
    observation.item,
  );
  return recorded.item;
}
