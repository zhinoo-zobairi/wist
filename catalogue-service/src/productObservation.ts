import { fetchBobbiesProduct } from "./bobbiesProduct.js";
import type { CatalogueBrand, CatalogueItem } from "./model.js";
import { fetchSandroProduct } from "./sandroProduct.js";

type Fetch = typeof fetch;

export type ProductObservation = {
  brand: CatalogueBrand;
  item: CatalogueItem;
};

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

  if (hostname === "www.bobbies.com") {
    return {
      brand: { id: "bobbies", name: "Bobbies" },
      item: await fetchBobbiesProduct(productUrl, fetchImpl, observedAt),
    };
  }

  if (hostname === "de.sandro-paris.com") {
    return {
      brand: { id: "sandro", name: "Sandro" },
      item: await fetchSandroProduct(productUrl, fetchImpl, observedAt),
    };
  }

  throw new Error("Only Bobbies and Sandro product URLs are supported");
}
