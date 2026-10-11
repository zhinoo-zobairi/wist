import {
  fetchJsonLdProduct,
  parseJsonLdProductPage,
  type JsonLdStorefront,
} from "./jsonLdProduct.js";
import type { CatalogueItem } from "./model.js";

type Fetch = typeof fetch;

export const claudiePierlotStorefront: JsonLdStorefront = {
  source: "claudie-pierlot",
  brand: { id: "claudie-pierlot", name: "Claudie Pierlot" },
  host: "de.claudiepierlot.com",
  pageKind: "product page",
  validatePath: (url) => url.pathname.startsWith("/de_DE/p/"),
  maxHtmlBytes: 1_000_000,
};

export function parseClaudiePierlotProductPage(
  html: string,
  observedAt: string,
): CatalogueItem {
  return parseJsonLdProductPage(claudiePierlotStorefront, html, observedAt);
}

export function fetchClaudiePierlotProduct(
  productUrl: string,
  fetchImpl: Fetch = fetch,
  observedAt = new Date().toISOString(),
): Promise<CatalogueItem> {
  return fetchJsonLdProduct(
    claudiePierlotStorefront,
    productUrl,
    fetchImpl,
    observedAt,
  );
}
