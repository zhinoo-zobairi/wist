import { bobbiesStorefront } from "./bobbiesProduct.js";
import { claudiePierlotStorefront } from "./claudiePierlotProduct.js";
import { fetchJsonLdProduct } from "./jsonLdProduct.js";
import type { CatalogueBrand, CatalogueItem } from "./model.js";
import { sandroStorefront } from "./sandroProduct.js";
import { fetchShopifyProduct } from "./shopifyProduct.js";

type Fetch = typeof fetch;

export type ProductObservation = {
  brand: CatalogueBrand;
  item: CatalogueItem;
};

const JSON_LD_STOREFRONTS = [
  sandroStorefront,
  claudiePierlotStorefront,
  bobbiesStorefront,
];

export async function fetchProductObservation(
  productUrl: string,
  fetchImpl: Fetch = fetch,
  observedAt = new Date().toISOString(),
): Promise<ProductObservation> {
  let hostname: string;
  try {
    hostname = new URL(productUrl).hostname;
  } catch {
    throw new Error("A valid supported product URL is required");
  }

  const storefront = JSON_LD_STOREFRONTS.find((store) => store.host === hostname);
  if (storefront) {
    return {
      brand: storefront.brand,
      item: await fetchJsonLdProduct(storefront, productUrl, fetchImpl, observedAt),
    };
  }

  return fetchShopifyProduct(productUrl, fetchImpl, observedAt);
}
